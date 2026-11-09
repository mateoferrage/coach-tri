import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROGRAM_MODEL } from '@/lib/gemini/client'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import type { PlanWeekOverview, buildMacroPrompt } from '@/lib/gemini/prompts'
import type { MacroPlan, MicroSessions, PlanParams } from '@/lib/schemas/plan'
import { generateMacroWeeks, toWeekColumns } from '@/lib/plan/macro'
import { buildMicroInputForWeek } from '@/lib/plan/micro-context'
import { generateWeekSessions, replaceWeekSessions } from '@/lib/plan/micro'
import { buildGoalContexts } from '@/lib/plan/goal-context'
import { disciplinesForGoals, resolveTrainingDisciplines } from '@/lib/plan/disciplines'
import { fetchAthleteContext } from '@/lib/plan/athlete-context'
import { currentWeekNum } from '@/lib/plan/replan-weeknum'
import { computeReplanScope } from '@/lib/plan/replan'
import { addWeeks, format, parseISO } from 'date-fns'
import { z } from 'zod'

// Quota IA gratuit : seule la première semaine recalculée est générée ici, les
// suivantes le sont à la demande, chacune voyant alors les précédentes.
export const maxDuration = 120

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

  // 1. Lire le plan, le profil, les courses et les semaines existantes.
  const { data: plan } = (await supabase
    .from('plans')
    .select('id, start_date, methodology, params')
    .eq('id', plan_id)
    .eq('user_id', user.id)
    .single()) as {
    data: {
      id: string
      start_date: string
      methodology: string
      params: PlanParams | null
    } | null
  }
  if (!plan) return apiError('Plan introuvable', 404)

  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as { data: Record<string, unknown> | null }
  if (!profile) return apiError('Profil non configuré', 400)

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

  const { data: existingWeeks } = (await admin
    .from('plan_weeks')
    .select('id, week_num, phase, is_recovery_week, planned_volume_hours, planned_tss')
    .eq('plan_id', plan_id)
    .order('week_num')) as { data: Array<PlanWeekOverview & { id: string }> | null }
  const weeks = existingWeeks ?? []

  // 2. Recalculer les disciplines et le périmètre.
  const goalContexts = buildGoalContexts(goalRows, primary_goal_id)
  const availableDisciplines = (profile.available_disciplines as string[] | null) ?? null
  const { training: trainingDisciplines, complementary: complementaryDisciplines } =
    resolveTrainingDisciplines({
      goalDisciplines: disciplinesForGoals(goalContexts).filter(
        (d) =>
          d === 'strength' || !availableDisciplines?.length || availableDisciplines.includes(d),
      ),
      requested: plan.params?.complementary_disciplines,
      available: availableDisciplines,
    })

  const today = format(new Date(), 'yyyy-MM-dd')
  const cutoffWeek = effective_from_week ?? currentWeekNum(plan.start_date, today)
  const newTotalWeeks = Math.max(cutoffWeek, currentWeekNum(plan.start_date, newEndDate))
  const scope = computeReplanScope({
    existingWeekNums: weeks.map((w) => w.week_num),
    cutoffWeek,
    newTotalWeeks,
  })

  // 3. Tout générer en mémoire : tant que ce n'est pas terminé, rien n'est écrit
  // et un échec de l'IA laisse le plan exactement tel qu'il était.
  let macro: { phases: MacroPlan['phases']; weeks: MacroPlan['weeks'] }
  let firstWeekSessions: MicroSessions['sessions'] = []
  const weekStart = (weekNum: number) =>
    format(addWeeks(parseISO(plan.start_date), weekNum - 1), 'yyyy-MM-dd')

  try {
    macro = await generateMacroWeeks({
      profile: profile as unknown as Parameters<typeof buildMacroPrompt>[0]['profile'],
      methodology: plan.methodology,
      start_date: plan.start_date,
      total_weeks: newTotalWeeks,
      current_weekly_hours: plan.params?.current_weekly_hours,
      goals: goalContexts,
      disciplines: trainingDisciplines,
      complementary_disciplines: complementaryDisciplines.length
        ? complementaryDisciplines
        : undefined,
      ...(await fetchAthleteContext(admin, user.id)),
    })

    const tailWeeks = macro.weeks
      .filter((w) => w.week_num >= cutoffWeek)
      .sort((a, b) => a.week_num - b.week_num)
    const planOverview: PlanWeekOverview[] = [
      ...weeks.filter((w) => w.week_num < cutoffWeek),
      ...tailWeeks,
    ]
    const [firstWeek] = tailWeeks
    if (firstWeek) {
      firstWeekSessions = await generateWeekSessions(
        await buildMicroInputForWeek({
          supabase,
          admin,
          userId: user.id,
          plan_id,
          week: {
            ...firstWeek,
            id: weeks.find((w) => w.week_num === firstWeek.week_num)?.id,
            start_date: weekStart(firstWeek.week_num),
          },
          replan: {
            goals: goalContexts,
            training_disciplines: trainingDisciplines,
            complementary_disciplines: complementaryDisciplines,
            plan_overview: planOverview,
          },
        }),
      )
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur Gemini'
    return apiError(msg.startsWith('Réponse Gemini') ? msg : `Génération IA échouée : ${msg}`, 500)
  }

  // 4. Tout a réussi : mettre à jour le plan et ses courses.
  const { error: delGoalsError } = await admin.from('plan_goals').delete().eq('plan_id', plan_id)
  if (delGoalsError)
    return apiError(`Échec mise à jour des courses : ${delGoalsError.message}`, 500)
  const { error: insGoalsError } = await admin
    .from('plan_goals')
    .insert(goal_ids.map((gid) => ({ plan_id, goal_id: gid })))
  if (insGoalsError)
    return apiError(`Échec rattachement des courses : ${insGoalsError.message}`, 500)

  const newParams: PlanParams = {
    ...plan.params,
    total_weeks: newTotalWeeks,
    training_disciplines: trainingDisciplines,
    complementary_disciplines: complementaryDisciplines,
  }
  const { error: planUpdateError } = await admin
    .from('plans')
    .update({
      goal_id: primary_goal_id,
      end_date: newEndDate,
      params: newParams as Record<string, never>,
    })
    .eq('id', plan_id)
  if (planUpdateError)
    return apiError(`Échec mise à jour du plan : ${planUpdateError.message}`, 500)

  // 5. Retirer les semaines au-delà du nouvel horizon (le cascade retire leurs séances).
  if (scope.deleteWeeks.length) {
    const deleteIds = weeks.filter((w) => scope.deleteWeeks.includes(w.week_num)).map((w) => w.id)
    const { error: delWeeksError } = await admin.from('plan_weeks').delete().in('id', deleteIds)
    if (delWeeksError)
      return apiError(`Échec suppression des semaines hors horizon : ${delWeeksError.message}`, 500)
  }

  // 6. Mettre à jour les semaines en place : les supprimer emporterait en cascade
  // les séances déjà réalisées de la semaine en cours.
  const weekIdByNum = new Map(weeks.map((w) => [w.week_num, w.id]))
  for (const week of macro.weeks.filter((w) => w.week_num >= cutoffWeek)) {
    const columns = { ...toWeekColumns(week), start_date: weekStart(week.week_num) }
    const existingId = weekIdByNum.get(week.week_num)
    if (existingId) {
      const { error } = await admin.from('plan_weeks').update(columns).eq('id', existingId)
      if (error) return apiError(`Échec mise à jour des semaines : ${error.message}`, 500)
    } else {
      const { data, error } = (await admin
        .from('plan_weeks')
        .insert({ plan_id, week_num: week.week_num, ...columns })
        .select('id')
        .single()) as { data: { id: string } | null; error: { message: string } | null }
      if (error || !data)
        return apiError(`Échec enregistrement des semaines : ${error?.message ?? 'inconnu'}`, 500)
      weekIdByNum.set(week.week_num, data.id)
    }
  }

  // 7. Remplacer les phases (elles décrivent tout le plan ; les semaines passées
  // gardent leur propre libellé).
  await admin.from('plan_phases').delete().eq('plan_id', plan_id)
  const { error: phaseError } = await admin
    .from('plan_phases')
    .insert(macro.phases.map((p) => ({ plan_id, ...p })))
  if (phaseError) return apiError(`Échec enregistrement des phases : ${phaseError.message}`, 500)

  // 8. Écrire la première semaine et retirer les séances encore planifiées des
  // suivantes : elles ne correspondent plus au nouveau plan.
  const tailWeekNums = macro.weeks
    .map((w) => w.week_num)
    .filter((n) => n >= cutoffWeek)
    .sort((a, b) => a - b)
  for (const [index, weekNum] of tailWeekNums.entries()) {
    const { error } = await replaceWeekSessions({
      admin,
      plan_id,
      plan_week_id: weekIdByNum.get(weekNum)!,
      user_id: user.id,
      sessions: index === 0 ? firstWeekSessions : [],
    })
    if (error) return apiError(`Échec enregistrement des séances : ${error.message}`, 500)
  }

  // 9. Journaliser (`adjustment` : valeur admise par la contrainte de la table).
  await admin.from('plan_generations').insert({
    plan_id,
    trigger: 'adjustment',
    scope: { from_week: cutoffWeek, goal_ids, new_total_weeks: newTotalWeeks },
    model: PROGRAM_MODEL,
    response_meta: {
      preserved: scope.preservedWeeks.length,
      regenerated: scope.regenerateWeeks.length,
      created: scope.createWeeks.length,
      deleted: scope.deleteWeeks.length,
    },
  })

  return apiSuccess({
    plan_id,
    cutoff_week: cutoffWeek,
    new_total_weeks: newTotalWeeks,
    ...scope,
  })
}
