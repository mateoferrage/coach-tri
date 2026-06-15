import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { PlanGenerationSchema, type MacroPlan } from '@/lib/schemas/plan'
import { generateJSON } from '@/lib/gemini/client'
import { TRIATHLON_COACH_SYSTEM, buildMacroPrompt } from '@/lib/gemini/prompts'
import { differenceInWeeks, addWeeks, format, parseISO } from 'date-fns'

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

  const { mode, goal_id, methodology, start_date } = parsed.data

  if (mode === 'race' && !goal_id) return apiError('goal_id requis pour le mode course', 400)

  const admin = createAdminClient()

  // Fetch user profile

  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as { data: Record<string, unknown> | null }

  if (!profile) return apiError('Profil non configuré', 400)

  // Fetch goal if race mode
  let goal: Record<string, unknown> | null = null
  let end_date = format(addWeeks(parseISO(start_date), 16), 'yyyy-MM-dd')

  if (mode === 'race' && goal_id) {
    const { data: goalData } = (await supabase
      .from('goals')
      .select('*')
      .eq('id', goal_id)
      .eq('user_id', user.id)
      .single()) as { data: Record<string, unknown> | null }

    if (!goalData) return apiError('Course introuvable', 404)
    goal = goalData
    end_date = goalData.race_date as string
  }

  const total_weeks = Math.max(4, differenceInWeeks(parseISO(end_date), parseISO(start_date)))

  // Fetch recent Garmin data for context

  const { data: recentActivities } = (await admin
    .from('garmin_activities')
    .select('activity_type, duration_s, distance_m, avg_hr, started_at')
    .eq('user_id', user.id)
    .gte('started_at', format(addWeeks(new Date(), -8), 'yyyy-MM-dd'))
    .order('started_at', { ascending: false })
    .limit(30)) as { data: Array<Record<string, unknown>> | null }

  const { data: recentWellness } = (await admin
    .from('garmin_wellness')
    .select('date, hrv_rmssd, body_battery_start, resting_hr, sleep_score')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(14)) as { data: Array<Record<string, unknown>> | null }

  const activitySummary = buildActivitySummary(recentActivities ?? [])
  const wellnessSummary = buildWellnessSummary(recentWellness ?? [])

  // Build Gemini prompt and generate macro plan
  const userPrompt = buildMacroPrompt({
    profile: profile as Parameters<typeof buildMacroPrompt>[0]['profile'],
    mode,
    methodology,
    start_date,
    total_weeks,
    goal: goal
      ? {
          race_name: goal.race_name as string,
          race_type: goal.race_type as string,
          race_date: goal.race_date as string,
          swim_distance_m: goal.swim_distance_m as number | null,
          bike_distance_m: goal.bike_distance_m as number | null,
          run_distance_m: goal.run_distance_m as number | null,
          terrain: goal.terrain as string | null,
        }
      : undefined,
    recent_activity_summary: activitySummary || undefined,
    recent_wellness_summary: wellnessSummary || undefined,
  })

  let macroPlan: MacroPlan
  try {
    macroPlan = await generateJSON<MacroPlan>(TRIATHLON_COACH_SYSTEM, userPrompt)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur Gemini'
    return apiError(`Génération IA échouée : ${msg}`, 500)
  }

  // Validate basic structure
  if (!macroPlan.phases?.length || !macroPlan.weeks?.length) {
    return apiError('Réponse Gemini invalide — structure manquante', 500)
  }

  // --- Save to database ---

  // 1. Create plan

  const { data: plan, error: planError } = (await admin
    .from('plans')
    .insert({
      user_id: user.id,
      goal_id: goal_id ?? null,
      name: goal ? `Programme ${goal.race_name}` : `Programme Maintien — ${start_date}`,
      start_date,
      end_date,
      methodology,
      periodization: 'linear',
      status: 'active',
      params: { mode, total_weeks },
      summary: { phases_count: macroPlan.phases.length, weeks_count: macroPlan.weeks.length },
    })
    .select()
    .single()) as { data: { id: string } | null; error: { message: string } | null }

  if (planError || !plan) return apiError(planError?.message ?? 'Erreur création plan', 500)

  // 2. Archive other active plans

  await admin
    .from('plans')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .eq('status', 'active')
    .neq('id', plan.id)

  // 3. Insert phases
  const phaseRows = macroPlan.phases.map((p) => ({ plan_id: plan.id, ...p }))

  await admin.from('plan_phases').insert(phaseRows)

  // 4. Insert weeks
  const weekRows = macroPlan.weeks.map((w) => ({
    plan_id: plan.id,
    ...w,
    start_date: format(addWeeks(parseISO(start_date), w.week_num - 1), 'yyyy-MM-dd'),
  }))

  const { data: insertedWeeks } = (await admin
    .from('plan_weeks')
    .insert(weekRows)
    .select('id, week_num')) as { data: Array<{ id: string; week_num: number }> | null }

  // 5. Log generation

  await admin.from('plan_generations').insert({
    plan_id: plan.id,
    trigger: 'initial',
    scope: { weeks: [1, total_weeks] },
    model: 'gemini-2.5-flash',
    response_meta: { weeks_generated: macroPlan.weeks.length },
  })

  return apiSuccess(
    {
      plan_id: plan.id,
      total_weeks,
      phases: macroPlan.phases.length,
      weeks_created: insertedWeeks?.length ?? 0,
      message: 'Programme généré avec succès',
    },
    201,
  )
}

function buildActivitySummary(activities: Array<Record<string, unknown>>): string {
  if (!activities.length) return ''
  const byType: Record<string, { count: number; total_h: number }> = {}
  for (const a of activities) {
    const type = (a.activity_type as string) || 'other'
    if (!byType[type]) byType[type] = { count: 0, total_h: 0 }
    byType[type].count++
    byType[type].total_h += ((a.duration_s as number) || 0) / 3600
  }
  return Object.entries(byType)
    .map(([t, v]) => `${t}: ${v.count} séances, ${v.total_h.toFixed(1)}h sur 8 semaines`)
    .join('\n')
}

function buildWellnessSummary(wellness: Array<Record<string, unknown>>): string {
  if (!wellness.length) return ''
  const avgHRV =
    wellness.filter((w) => w.hrv_rmssd).reduce((s, w) => s + (w.hrv_rmssd as number), 0) /
    (wellness.filter((w) => w.hrv_rmssd).length || 1)
  const avgBB =
    wellness
      .filter((w) => w.body_battery_start)
      .reduce((s, w) => s + (w.body_battery_start as number), 0) /
    (wellness.filter((w) => w.body_battery_start).length || 1)
  return `HRV moyen : ${avgHRV.toFixed(0)} ms | Body Battery moyen : ${avgBB.toFixed(0)}/100`
}
