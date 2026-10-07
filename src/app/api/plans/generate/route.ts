import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { PlanGenerationSchema, type MacroPlan } from '@/lib/schemas/plan'
import { generateMacroWeeks } from '@/lib/plan/macro'
import { buildMacroPrompt, type PerformanceData } from '@/lib/gemini/prompts'
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

  const { mode, goal_ids, primary_goal_id, methodology, start_date } = parsed.data

  if (mode === 'race' && (!goal_ids?.length || !primary_goal_id))
    return apiError('Courses requises pour le mode course', 400)

  const admin = createAdminClient()

  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as { data: Record<string, unknown> | null }
  if (!profile) return apiError('Profil non configuré', 400)

  let goalRows: Array<Record<string, unknown>> = []
  let primaryGoal: Record<string, unknown> | null = null
  let end_date = format(addWeeks(parseISO(start_date), 16), 'yyyy-MM-dd')

  if (mode === 'race' && goal_ids?.length) {
    const { data } = (await supabase
      .from('goals')
      .select('*')
      .in('id', goal_ids)
      .eq('user_id', user.id)) as { data: Array<Record<string, unknown>> | null }
    goalRows = data ?? []
    if (goalRows.length !== goal_ids.length) return apiError('Course(s) introuvable(s)', 404)
    primaryGoal = goalRows.find((g) => g.id === primary_goal_id) ?? null
    if (!primaryGoal) return apiError('Course principale introuvable', 404)
    end_date = primaryGoal.race_date as string
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

  // Performances de référence (records + seuils dérivés)
  const { data: physiology } = (await admin
    .from('physiology_current')
    .select(
      'run_5k_time_s, run_10k_time_s, run_half_time_s, swim_100m_time_s, swim_200m_time_s, swim_400m_time_s, swim_800m_time_s, ftp_watts, hr_max, resting_hr, vma_kmh, run_threshold_pace_sec_per_km, css_pace_sec_per_100m',
    )
    .eq('user_id', user.id)
    .maybeSingle()) as { data: PerformanceData | null }

  const activitySummary = buildActivitySummary(recentActivities ?? [])
  const wellnessSummary = buildWellnessSummary(recentWellness ?? [])

  const goalContexts = goalRows.map((g) => ({
    role: g.id === primary_goal_id ? ('primary' as const) : ('secondary' as const),
    sport: (g.sport as 'triathlon' | 'running') ?? 'triathlon',
    race_name: g.race_name as string,
    race_type: g.race_type as string,
    race_date: g.race_date as string,
    swim_distance_m: g.swim_distance_m as number | null,
    bike_distance_m: g.bike_distance_m as number | null,
    run_distance_m: g.run_distance_m as number | null,
    elevation_gain_m: g.run_elevation_m as number | null, // D+ ← colonne DB run_elevation_m
    elevation_loss_m: g.elevation_loss_m as number | null,
    surface: g.surface as string | null,
    terrain: g.terrain as string | null,
    max_altitude_m: g.max_altitude_m as number | null,
    cutoff_time_s: g.cutoff_time_s as number | null,
    estimated_finish_time_s: g.estimated_finish_time_s as number | null,
  }))

  // Build Gemini prompt, generate and normalize the macro structure.
  // `generateMacroWeeks` validates phases against the strict lowercase CHECK
  // constraint on `plan_phases.phase` before any DB write.
  let validPhases: MacroPlan['phases']
  let normalizedWeeks: MacroPlan['weeks']
  try {
    const macro = await generateMacroWeeks({
      profile: profile as Parameters<typeof buildMacroPrompt>[0]['profile'],
      mode,
      methodology,
      start_date,
      total_weeks,
      goals: goalContexts.length ? goalContexts : undefined,
      performance: physiology ?? undefined,
      recent_activity_summary: activitySummary || undefined,
      recent_wellness_summary: wellnessSummary || undefined,
    })
    validPhases = macro.phases
    normalizedWeeks = macro.weeks
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur Gemini'
    return apiError(msg.startsWith('Réponse Gemini') ? msg : `Génération IA échouée : ${msg}`, 500)
  }

  // --- Save to database ---

  // 1. Create plan

  const { data: plan, error: planError } = (await admin
    .from('plans')
    .insert({
      user_id: user.id,
      goal_id: primary_goal_id ?? null,
      name: primaryGoal ? `Programme ${primaryGoal.race_name}` : `Programme Maintien — ${start_date}`,
      start_date,
      end_date,
      methodology,
      periodization: 'linear',
      status: 'active',
      params: { mode, total_weeks },
      summary: { phases_count: validPhases.length, weeks_count: normalizedWeeks.length },
    })
    .select()
    .single()) as { data: { id: string } | null; error: { message: string } | null }

  if (planError || !plan) return apiError(planError?.message ?? 'Erreur création plan', 500)

  // Rattacher toutes les courses au plan. Écriture porteuse : en cas d'échec on
  // supprime le plan (le cascade nettoie) pour ne pas laisser un plan incomplet.
  if (goal_ids?.length) {
    const { error: planGoalsError } = await admin
      .from('plan_goals')
      .insert(goal_ids.map((gid) => ({ plan_id: plan.id, goal_id: gid })))
    if (planGoalsError) {
      await admin.from('plans').delete().eq('id', plan.id)
      return apiError(`Échec rattachement des courses : ${planGoalsError.message}`, 500)
    }
  }

  // 2. Archive other active plans

  await admin
    .from('plans')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .eq('status', 'active')
    .neq('id', plan.id)

  // 3. Insert phases
  const phaseRows = validPhases.map((p) => ({ plan_id: plan.id, ...p }))

  const { error: phaseError } = await admin.from('plan_phases').insert(phaseRows)
  if (phaseError) {
    // Don't leave a half-built plan behind (cascade removes any rows).
    await admin.from('plans').delete().eq('id', plan.id)
    return apiError(`Échec enregistrement des phases : ${phaseError.message}`, 500)
  }

  // 4. Insert weeks
  const weekRows = normalizedWeeks.map((w) => ({
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
