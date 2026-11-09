import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROGRAM_MODEL } from '@/lib/gemini/client'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { PlanGenerationSchema, type MacroPlan, type PlanParams } from '@/lib/schemas/plan'
import { generateMacroWeeks, toWeekColumns } from '@/lib/plan/macro'
import { buildGoalContexts } from '@/lib/plan/goal-context'
import { disciplinesForGoals, resolveTrainingDisciplines } from '@/lib/plan/disciplines'
import { fetchAthleteContext } from '@/lib/plan/athlete-context'
import { currentWeekNum } from '@/lib/plan/replan-weeknum'
import type { buildMacroPrompt } from '@/lib/gemini/prompts'
import { addWeeks, format, parseISO } from 'date-fns'

export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = PlanGenerationSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const {
    goal_ids,
    primary_goal_id,
    complementary_disciplines,
    methodology,
    start_date,
    available_days,
    current_weekly_hours,
  } = parsed.data

  const admin = createAdminClient()

  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as { data: Record<string, unknown> | null }
  if (!profile) return apiError('Profil non configuré', 400)

  const { data } = (await supabase
    .from('goals')
    .select('*')
    .in('id', goal_ids)
    .eq('user_id', user.id)) as { data: Array<Record<string, unknown>> | null }
  const goalRows = data ?? []
  if (goalRows.length !== goal_ids.length) return apiError('Course(s) introuvable(s)', 404)
  const primaryGoal = goalRows.find((g) => g.id === primary_goal_id)
  if (!primaryGoal) return apiError('Course principale introuvable', 404)

  const end_date = primaryGoal.race_date as string
  if (end_date <= start_date)
    return apiError('La course principale doit avoir lieu après le début du programme', 400)

  // La dernière semaine du plan est celle qui contient la course.
  const total_weeks = currentWeekNum(start_date, end_date)

  const athleteContext = await fetchAthleteContext(admin, user.id)
  const goalContexts = buildGoalContexts(goalRows, primary_goal_id)

  // Disciplines à entraîner = cœur des sports des courses + éventuelles
  // disciplines complémentaires (cross-training) choisies par l'athlète,
  // restreintes aux disciplines dont il dispose (le renfo reste toujours ok).
  const availableDisciplines = (profile.available_disciplines as string[] | null) ?? null
  const goalDisciplines = disciplinesForGoals(goalContexts).filter(
    (d) => d === 'strength' || !availableDisciplines?.length || availableDisciplines.includes(d),
  )
  const { training: scopedDisciplines, complementary: complementaryDisciplines } =
    resolveTrainingDisciplines({
      goalDisciplines,
      requested: complementary_disciplines,
      available: availableDisciplines,
    })

  // `generateMacroWeeks` valide les phases contre la contrainte CHECK de
  // `plan_phases.phase` avant toute écriture.
  let validPhases: MacroPlan['phases']
  let normalizedWeeks: MacroPlan['weeks']
  try {
    const macro = await generateMacroWeeks({
      profile: profile as unknown as Parameters<typeof buildMacroPrompt>[0]['profile'],
      methodology,
      start_date,
      total_weeks,
      current_weekly_hours,
      goals: goalContexts,
      disciplines: scopedDisciplines,
      complementary_disciplines: complementaryDisciplines.length
        ? complementaryDisciplines
        : undefined,
      ...athleteContext,
    })
    validPhases = macro.phases
    normalizedWeeks = macro.weeks
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur Gemini'
    return apiError(msg.startsWith('Réponse Gemini') ? msg : `Génération IA échouée : ${msg}`, 500)
  }

  // --- Save to database ---

  // 1. Create plan
  const params: PlanParams = {
    total_weeks,
    training_disciplines: scopedDisciplines,
    complementary_disciplines: complementaryDisciplines,
    available_days,
    current_weekly_hours,
  }

  const { data: plan, error: planError } = (await admin
    .from('plans')
    .insert({
      user_id: user.id,
      goal_id: primary_goal_id,
      name: `Programme ${primaryGoal.race_name}`,
      start_date,
      end_date,
      methodology,
      periodization: 'linear',
      status: 'active',
      params: { mode: 'race', ...params },
      summary: { phases_count: validPhases.length, weeks_count: normalizedWeeks.length },
    })
    .select()
    .single()) as { data: { id: string } | null; error: { message: string } | null }

  if (planError || !plan) return apiError(planError?.message ?? 'Erreur création plan', 500)

  // Rattacher toutes les courses au plan. Écriture porteuse : en cas d'échec on
  // supprime le plan (le cascade nettoie) pour ne pas laisser un plan incomplet.
  const { error: planGoalsError } = await admin
    .from('plan_goals')
    .insert(goal_ids.map((gid) => ({ plan_id: plan.id, goal_id: gid })))
  if (planGoalsError) {
    await admin.from('plans').delete().eq('id', plan.id)
    return apiError(`Échec rattachement des courses : ${planGoalsError.message}`, 500)
  }

  // 2. Insert phases
  const phaseRows = validPhases.map((p) => ({ plan_id: plan.id, ...p }))

  const { error: phaseError } = await admin.from('plan_phases').insert(phaseRows)
  if (phaseError) {
    // Don't leave a half-built plan behind (cascade removes any rows).
    await admin.from('plans').delete().eq('id', plan.id)
    return apiError(`Échec enregistrement des phases : ${phaseError.message}`, 500)
  }

  // 3. Insert weeks
  const weekRows = normalizedWeeks.map((w) => ({
    plan_id: plan.id,
    week_num: w.week_num,
    ...toWeekColumns(w),
    start_date: format(addWeeks(parseISO(start_date), w.week_num - 1), 'yyyy-MM-dd'),
  }))

  const { data: insertedWeeks, error: weeksError } = (await admin
    .from('plan_weeks')
    .insert(weekRows)
    .select('id, week_num')) as {
    data: Array<{ id: string; week_num: number }> | null
    error: { message: string } | null
  }
  if (weeksError) {
    await admin.from('plans').delete().eq('id', plan.id)
    return apiError(`Échec enregistrement des semaines : ${weeksError.message}`, 500)
  }

  // 4. Le nouveau plan est complet : archiver les autres plans actifs.
  await admin
    .from('plans')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .eq('status', 'active')
    .neq('id', plan.id)

  // 5. Log generation
  await admin.from('plan_generations').insert({
    plan_id: plan.id,
    trigger: 'initial',
    scope: { weeks: [1, total_weeks] },
    model: PROGRAM_MODEL,
    response_meta: { weeks_generated: normalizedWeeks.length },
  })

  return apiSuccess(
    {
      plan_id: plan.id,
      total_weeks,
      phases: validPhases.length,
      weeks_created: insertedWeeks?.length ?? 0,
      message: 'Programme généré avec succès',
    },
    201,
  )
}
