import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { generateJSON } from '@/lib/gemini/client'
import {
  TRIATHLON_COACH_SYSTEM,
  buildMicroPrompt,
  type buildMacroPrompt,
} from '@/lib/gemini/prompts'
import type { MicroSessions } from '@/lib/schemas/plan'
import { generateMacroWeeks } from '@/lib/plan/macro'
import { buildMicroInputForWeek } from '@/lib/plan/micro-context'
import { replaceWeekSessions } from '@/lib/plan/micro'
import { buildGoalContexts } from '@/lib/plan/goal-context'
import { disciplinesForGoals } from '@/lib/plan/disciplines'
import { currentWeekNum } from '@/lib/plan/replan-weeknum'
import { computeReplanScope } from '@/lib/plan/replan'
import { addWeeks, format, parseISO } from 'date-fns'
import { z } from 'zod'

const BodySchema = z.object({
  goal_ids: z.array(z.string().uuid()).min(1).max(3),
  primary_goal_id: z.string().uuid(),
  effective_from_week: z.number().int().positive().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id: plan_id } = await params
  const body = await request.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const { goal_ids, primary_goal_id, effective_from_week } = parsed.data
  if (!goal_ids.includes(primary_goal_id))
    return apiError('La course principale doit figurer dans la liste des courses', 400)

  const admin = createAdminClient()

  // 2. Fetch plan scoped to user
  const { data: plan } = (await supabase
    .from('plans')
    .select('id, start_date, methodology')
    .eq('id', plan_id)
    .eq('user_id', user.id)
    .single()) as {
    data: { id: string; start_date: string; methodology: string } | null
  }
  if (!plan) return apiError('Plan introuvable', 404)

  // 3. Fetch profile (needed for macro)
  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as { data: Record<string, unknown> | null }
  if (!profile) return apiError('Profil non configuré', 400)

  // 4. Fetch goals
  const { data: goalData } = (await supabase
    .from('goals')
    .select('*')
    .in('id', goal_ids)
    .eq('user_id', user.id)) as { data: Array<Record<string, unknown>> | null }
  const goalRows = goalData ?? []
  if (goalRows.length !== goal_ids.length) return apiError('Course(s) introuvable(s)', 404)
  const primaryGoal = goalRows.find((g) => g.id === primary_goal_id)
  if (!primaryGoal) return apiError('Course principale introuvable', 404)
  const newEndDate = primaryGoal.race_date as string

  // 5. Build goal contexts (shared mapping with generate/route.ts)
  const goalContexts = buildGoalContexts(goalRows, primary_goal_id)

  // Disciplines à entraîner = union des sports des courses, restreinte au profil
  // (le renforcement reste toujours inclus).
  const availableDisciplines = (profile.available_disciplines as string[] | null) ?? null
  const scopedDisciplines = disciplinesForGoals(goalContexts).filter(
    (d) => d === 'strength' || !availableDisciplines?.length || availableDisciplines.includes(d),
  )

  // 6. Fetch existing weeks
  const { data: existingWeeks } = (await admin
    .from('plan_weeks')
    .select('id, week_num')
    .eq('plan_id', plan_id)
    .order('week_num')) as { data: Array<{ id: string; week_num: number }> | null }
  const weeks = existingWeeks ?? []

  // 7. Compute replan scope
  const today = format(new Date(), 'yyyy-MM-dd')
  const cutoffWeek = effective_from_week ?? currentWeekNum(plan.start_date, today)
  const newTotalWeeks = Math.max(cutoffWeek, currentWeekNum(plan.start_date, newEndDate))
  const scope = computeReplanScope({
    existingWeekNums: weeks.map((w) => w.week_num),
    cutoffWeek,
    newTotalWeeks,
  })

  // 8. Update attachments: replace plan_goals, repoint plan.goal_id
  const { error: delGoalsError } = await admin
    .from('plan_goals')
    .delete()
    .eq('plan_id', plan_id)
  if (delGoalsError)
    return apiError(`Échec mise à jour des courses : ${delGoalsError.message}`, 500)
  const { error: insGoalsError } = await admin
    .from('plan_goals')
    .insert(goal_ids.map((gid) => ({ plan_id, goal_id: gid })))
  if (insGoalsError)
    return apiError(`Échec rattachement des courses : ${insGoalsError.message}`, 500)
  const { error: repointError } = await admin
    .from('plans')
    .update({ goal_id: primary_goal_id })
    .eq('id', plan_id)
  if (repointError)
    return apiError(`Échec mise à jour de la course principale : ${repointError.message}`, 500)

  // 9. Delete out-of-horizon weeks (cascade removes their sessions)
  if (scope.deleteWeeks.length) {
    const deleteIds = weeks
      .filter((w) => scope.deleteWeeks.includes(w.week_num))
      .map((w) => w.id)
    if (deleteIds.length) {
      const { error: delWeeksError } = await admin.from('plan_weeks').delete().in('id', deleteIds)
      if (delWeeksError)
        return apiError(`Échec suppression des semaines hors horizon : ${delWeeksError.message}`, 500)
    }
  }

  // 10. MACRO regen for the tail
  let macro
  try {
    macro = await generateMacroWeeks({
      profile: profile as Parameters<typeof buildMacroPrompt>[0]['profile'],
      mode: 'race',
      methodology: plan.methodology,
      start_date: plan.start_date,
      total_weeks: newTotalWeeks,
      goals: goalContexts.length ? goalContexts : undefined,
      disciplines: goalContexts.length ? scopedDisciplines : undefined,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur Gemini'
    return apiError(msg.startsWith('Réponse Gemini') ? msg : `Génération IA échouée : ${msg}`, 500)
  }

  const tailWeeks = macro.weeks.filter((w) => w.week_num >= cutoffWeek)

  // Remove existing plan_weeks with week_num >= cutoff, then insert the fresh
  // tail. Past weeks (< cutoff) and their sessions are never touched.
  const staleTailIds = weeks
    .filter((w) => w.week_num >= cutoffWeek && w.week_num <= newTotalWeeks)
    .map((w) => w.id)
  if (staleTailIds.length) {
    const { error: delTailError } = await admin.from('plan_weeks').delete().in('id', staleTailIds)
    if (delTailError)
      return apiError(`Échec remplacement des semaines : ${delTailError.message}`, 500)
  }

  const tailRows = tailWeeks.map((w) => ({
    plan_id,
    ...w,
    start_date: format(addWeeks(parseISO(plan.start_date), w.week_num - 1), 'yyyy-MM-dd'),
  }))
  const { error: weeksError } = await admin.from('plan_weeks').insert(tailRows)
  if (weeksError) return apiError(`Échec enregistrement des semaines : ${weeksError.message}`, 500)

  // Replace plan_phases entirely (phases describe the whole plan; past weeks
  // keep their stored phase labels on their own rows).
  await admin.from('plan_phases').delete().eq('plan_id', plan_id)
  const phaseRows = macro.phases.map((p) => ({ plan_id, ...p }))
  const { error: phaseError } = await admin.from('plan_phases').insert(phaseRows)
  if (phaseError) return apiError(`Échec enregistrement des phases : ${phaseError.message}`, 500)

  // 11. MICRO regen for every week with week_num >= cutoff
  const { data: tailWeekRows } = (await admin
    .from('plan_weeks')
    .select(
      'id, week_num, phase, is_recovery_week, planned_volume_hours, planned_tss, distribution, notes, start_date',
    )
    .eq('plan_id', plan_id)
    .gte('week_num', cutoffWeek)
    .order('week_num')) as {
    data: Array<{
      id: string
      week_num: number
      phase: string
      is_recovery_week: boolean
      planned_volume_hours: number
      planned_tss: number
      distribution: Record<string, number> | null
      notes: string | null
      start_date: string
    }> | null
  }

  // Pré-générer TOUS les micro en mémoire avant d'écrire la moindre séance : si
  // Gemini échoue (ou ne renvoie rien) en cours de route, aucune séance n'est
  // écrite — on évite un plan à moitié peuplé (certaines semaines avec séances,
  // d'autres nues). Défaut semaine complète : le replan est global, pas par-jour.
  const microByWeek: Array<{ weekId: string; sessions: MicroSessions['sessions'] }> = []
  try {
    for (const week of tailWeekRows ?? []) {
      const input = await buildMicroInputForWeek({
        supabase,
        admin,
        userId: user.id,
        plan_id,
        week,
        available_days: [1, 2, 3, 4, 5, 6, 0],
      })
      const micro = await generateJSON<MicroSessions>(
        TRIATHLON_COACH_SYSTEM,
        buildMicroPrompt(input),
      )
      if (!micro.sessions?.length)
        return apiError(`Aucune séance générée pour la semaine ${week.week_num}`, 500)
      microByWeek.push({ weekId: week.id, sessions: micro.sessions })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur Gemini'
    return apiError(`Génération IA échouée : ${msg}`, 500)
  }

  // Toutes les générations ont réussi → écrire les séances.
  for (const { weekId, sessions } of microByWeek) {
    await replaceWeekSessions({
      admin,
      plan_id,
      plan_week_id: weekId,
      user_id: user.id,
      sessions,
    })
  }

  // 12. Log generation
  await admin.from('plan_generations').insert({
    plan_id,
    trigger: 'replan',
    scope: { from_week: cutoffWeek, goal_ids, new_total_weeks: newTotalWeeks },
    model: 'gemini-2.5-flash',
    response_meta: {
      preserved: scope.preservedWeeks.length,
      regenerated: scope.regenerateWeeks.length,
      created: scope.createWeeks.length,
      deleted: scope.deleteWeeks.length,
    },
  })

  // 13. Return scope summary
  return apiSuccess({
    plan_id,
    cutoff_week: cutoffWeek,
    new_total_weeks: newTotalWeeks,
    ...scope,
  })
}
