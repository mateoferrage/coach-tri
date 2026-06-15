import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { generateJSON } from '@/lib/gemini/client'
import {
  TRIATHLON_COACH_SYSTEM,
  buildMicroPrompt,
  buildEquipmentBlock,
  buildStravaStatsBlock,
  type PriorWeek,
  type PlanWeekOverview,
  type EquipmentData,
} from '@/lib/gemini/prompts'
import { calculateZones, formatZonesForPrompt } from '@/lib/utils/zones'
import type { MicroSessions } from '@/lib/schemas/plan'
import { z } from 'zod'
import { addDays, format, parseISO } from 'date-fns'
import { refreshIfNeeded, getAthleteStatsCompact, type StravaTokens } from '@/lib/strava/client'

const BodySchema = z.object({
  week_num: z.number().int().positive(),
  available_days: z.array(z.number().int().min(0).max(6)).min(1),
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

  const { week_num, available_days } = parsed.data
  const admin = createAdminClient()

  // Verify plan ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan } = (await (supabase as any)
    .from('plans')
    .select('id, status')
    .eq('id', plan_id)
    .eq('user_id', user.id)
    .single()) as { data: { id: string; status: string } | null }

  if (!plan) return apiError('Plan introuvable', 404)

  // Fetch ALL plan_weeks (for macro overview + prior weeks context) in parallel with other data
  const [
    weekResult,
    profileResult,
    allPlanWeeksResult,
    wellnessResult,
    physiologyResult,
    garminStatsResult,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('plan_weeks')
      .select('*')
      .eq('plan_id', plan_id)
      .eq('week_num', week_num)
      .single() as Promise<{ data: Record<string, unknown> | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('profiles')
      .select('level, weekly_hours_avg, available_disciplines, equipment')
      .eq('id', user.id)
      .single() as Promise<{ data: Record<string, unknown> | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('plan_weeks')
      .select(
        'id, week_num, phase, is_recovery_week, planned_volume_hours, planned_tss, start_date',
      )
      .eq('plan_id', plan_id)
      .order('week_num', { ascending: true }) as Promise<{
      data: Array<Record<string, unknown>> | null
    }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('garmin_wellness')
      .select('date, hrv_rmssd, body_battery_start, resting_hr')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(7) as Promise<{ data: Array<Record<string, unknown>> | null }>,
    // Physiology — use the view that returns the most recent measure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('physiology_current')
      .select(
        'vma_kmh, run_threshold_pace_sec_per_km, hr_max_run, hr_threshold_run, ftp_watts, hr_max, hr_threshold_bike, css_pace_sec_per_100m',
      )
      .eq('user_id', user.id)
      .maybeSingle() as Promise<{ data: Record<string, unknown> | null }>,
    // Garmin stats for VO2max fallback when no physiology data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('garmin_stats')
      .select('vo2max_run')
      .eq('user_id', user.id)
      .maybeSingle() as Promise<{ data: Record<string, unknown> | null }>,
  ])

  const week = weekResult.data
  if (!week) return apiError(`Semaine ${week_num} introuvable`, 404)

  const profile = profileResult.data
  const equipmentRaw = profile?.equipment as EquipmentData | null
  const equipmentBlock =
    equipmentRaw && Object.keys(equipmentRaw).length > 0
      ? buildEquipmentBlock(equipmentRaw)
      : undefined
  const allPlanWeeks = allPlanWeeksResult.data ?? []
  const wellness = wellnessResult.data ?? []
  const physiology = physiologyResult.data
  const garminStats = garminStatsResult.data

  // ── Athlete training zones ─────────────────────────────────────────────────
  const zones = calculateZones({
    vma_kmh: physiology?.vma_kmh as number | null,
    run_threshold_pace_sec_per_km: physiology?.run_threshold_pace_sec_per_km as number | null,
    hr_max_run: physiology?.hr_max_run as number | null,
    hr_threshold_run: physiology?.hr_threshold_run as number | null,
    ftp_watts: physiology?.ftp_watts as number | null,
    hr_max: physiology?.hr_max as number | null,
    hr_threshold_bike: physiology?.hr_threshold_bike as number | null,
    css_pace_sec_per_100m: physiology?.css_pace_sec_per_100m as number | null,
    // VO2max fallback for VMA estimation when no physiology data
    vo2max_run:
      !physiology?.vma_kmh && !physiology?.run_threshold_pace_sec_per_km
        ? (garminStats?.vo2max_run as number | null)
        : null,
  })
  const athleteZones = zones ? formatZonesForPrompt(zones) : undefined

  // ── Plan overview (all weeks, macro) ────────────────────────────────────────
  const planOverview: PlanWeekOverview[] = allPlanWeeks.map((w) => ({
    week_num: w.week_num as number,
    phase: w.phase as string,
    is_recovery_week: w.is_recovery_week as boolean,
    planned_volume_hours: w.planned_volume_hours as number,
    planned_tss: w.planned_tss as number,
  }))

  // ── Prior weeks with their generated sessions ────────────────────────────────
  const priorWeekRows = allPlanWeeks.filter((w) => (w.week_num as number) < week_num)
  let priorWeeks: PriorWeek[] = []

  if (priorWeekRows.length > 0) {
    const priorWeekIds = priorWeekRows.map((w) => w.id as string)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: priorSessions } = (await (admin as any)
      .from('sessions')
      .select(
        'plan_week_id, session_date, discipline, session_type, title, duration_min, planned_tss, target_zone, status, actual_rpe, actual_duration_min',
      )
      .in('plan_week_id', priorWeekIds)
      .order('session_date', { ascending: true })) as {
      data: Array<Record<string, unknown>> | null
    }

    const sessionsByWeekId = new Map<string, Array<Record<string, unknown>>>()
    for (const s of priorSessions ?? []) {
      const wid = s.plan_week_id as string
      if (!sessionsByWeekId.has(wid)) sessionsByWeekId.set(wid, [])
      sessionsByWeekId.get(wid)!.push(s)
    }

    priorWeeks = priorWeekRows.map((w) => ({
      week_num: w.week_num as number,
      phase: w.phase as string,
      is_recovery_week: w.is_recovery_week as boolean,
      planned_volume_hours: w.planned_volume_hours as number,
      planned_tss: w.planned_tss as number,
      sessions: (sessionsByWeekId.get(w.id as string) ?? []).map((s) => ({
        session_date: s.session_date as string,
        discipline: s.discipline as string,
        session_type: s.session_type as string,
        title: s.title as string | null,
        duration_min: s.duration_min as number,
        planned_tss: s.planned_tss as number | null,
        target_zone: s.target_zone as string | null,
        status: s.status as string,
        actual_rpe: s.actual_rpe as number | null,
        actual_duration_min: s.actual_duration_min as number | null,
      })),
    }))
  }

  // ── Wellness summary ─────────────────────────────────────────────────────────
  const wellnessSummary = wellness.length
    ? `HRV derniers 7j : ${wellness
        .filter((w) => w.hrv_rmssd)
        .map((w) => w.hrv_rmssd)
        .join(', ')} ms`
    : ''

  // ── Schedule constraints for this week ───────────────────────────────────────
  const weekStartDate = week.start_date as string
  const weekEndDate = format(addDays(parseISO(weekStartDate), 6), 'yyyy-MM-dd')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawScheduleEvents } = (await (supabase as any)
    .from('schedule_events')
    .select('*')
    .eq('user_id', user.id)
    .or(
      `and(is_recurring.eq.false,event_date.gte.${weekStartDate},event_date.lte.${weekEndDate}),` +
        `and(is_recurring.eq.true,event_date.lte.${weekEndDate},or(recurrence_end_date.is.null,recurrence_end_date.gte.${weekStartDate}))`,
    )) as { data: Array<Record<string, unknown>> | null }

  const ISO_DAY_NAMES = [
    '',
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
    'Dimanche',
  ]
  let scheduleConstraints = ''
  if (rawScheduleEvents?.length) {
    const lines: string[] = []
    for (const ev of rawScheduleEvents) {
      if (!ev.is_recurring) {
        const jsDay = parseISO(ev.event_date as string).getDay()
        const isoDay = jsDay === 0 ? 7 : jsDay
        lines.push(
          `${ISO_DAY_NAMES[isoDay]} ${ev.event_date} : "${ev.title}" de ${ev.start_time} à ${ev.end_time}`,
        )
      } else {
        const day = ev.recurrence_day as number
        lines.push(
          `Chaque ${ISO_DAY_NAMES[day]} : "${ev.title}" de ${ev.start_time} à ${ev.end_time}`,
        )
      }
    }
    scheduleConstraints = lines.join('\n')
  }

  // Strava stats for Scenario B (silently skip if not connected)
  let stravaStatsBlock: string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stravaCreds } = await (supabase as any)
    .from('strava_credentials')
    .select('athlete_id, access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (stravaCreds) {
    try {
      const tokens: StravaTokens = {
        access_token: stravaCreds.access_token,
        refresh_token: stravaCreds.refresh_token,
        expires_at: stravaCreds.expires_at,
        athlete_id: stravaCreds.athlete_id,
      }
      const refreshed = await refreshIfNeeded(tokens)
      if (refreshed.access_token !== stravaCreds.access_token) {
        const adminClient = createAdminClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient as any)
          .from('strava_credentials')
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: refreshed.expires_at,
          })
          .eq('user_id', user.id)
      }
      const stats = await getAthleteStatsCompact(refreshed.access_token, refreshed.athlete_id)
      stravaStatsBlock = buildStravaStatsBlock(stats)
    } catch {
      // Strava indisponible — génération continue sans ce contexte
    }
  }

  const userPrompt = buildMicroPrompt({
    week: {
      week_num: week.week_num as number,
      phase: week.phase as string,
      is_recovery_week: week.is_recovery_week as boolean,
      planned_volume_hours: week.planned_volume_hours as number,
      planned_tss: week.planned_tss as number,
      distribution: (week.distribution as Record<string, number>) ?? {
        z1z2: 0.8,
        z3: 0.1,
        z4z5: 0.1,
      },
      notes: (week.notes as string) ?? '',
    },
    profile: {
      level: profile?.level as string | null,
      weekly_hours_avg: profile?.weekly_hours_avg as number | null,
      available_disciplines: profile?.available_disciplines as string[] | null,
    },
    available_days,
    week_start_date: week.start_date as string,
    prior_weeks: priorWeeks.length ? priorWeeks : undefined,
    plan_overview: planOverview.length ? planOverview : undefined,
    athlete_zones: athleteZones,
    recent_wellness_summary: wellnessSummary || undefined,
    schedule_constraints: scheduleConstraints || undefined,
    strava_stats_block: stravaStatsBlock,
    equipment_block: equipmentBlock,
  })

  let microPlan: MicroSessions
  try {
    microPlan = await generateJSON<MicroSessions>(TRIATHLON_COACH_SYSTEM, userPrompt)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur Gemini'
    return apiError(`Génération IA échouée : ${msg}`, 500)
  }

  if (!microPlan.sessions?.length) return apiError("Gemini n'a retourné aucune séance", 500)

  const VALID_SESSION_TYPES = new Set([
    'easy',
    'tempo',
    'threshold',
    'vo2',
    'race_pace',
    'technique',
    'long',
    'recovery',
    'test',
  ])
  const SESSION_TYPE_MAP: Record<string, string> = {
    endurance: 'easy',
    interval: 'vo2',
    intervals: 'vo2',
    ftp: 'threshold',
    sprint: 'vo2',
    speed: 'vo2',
    strength: 'easy',
    brick: 'easy',
    'race pace': 'race_pace',
    moderate: 'tempo',
    z2: 'easy',
    base: 'easy',
  }
  function normalizeSessionType(raw: string): string {
    const lower = (raw ?? '').toLowerCase().trim()
    if (VALID_SESSION_TYPES.has(lower)) return lower
    return SESSION_TYPE_MAP[lower] ?? 'easy'
  }

  const VALID_DISCIPLINES = new Set(['swim', 'bike', 'run', 'brick', 'strength', 'rest'])
  function normalizeDiscipline(raw: string): string {
    const lower = (raw ?? '').toLowerCase().trim()
    return VALID_DISCIPLINES.has(lower) ? lower : 'run'
  }

  // Delete existing planned sessions for this week (keep done/skipped)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('sessions')
    .delete()
    .eq('plan_week_id', week.id as string)
    .eq('status', 'planned')

  // Insert new sessions
  const sessionRows = microPlan.sessions.map((s) => {
    const jsDay = new Date(s.session_date + 'T00:00:00').getDay() // 0=dim, 6=sam
    // Weekdays → evening (18h), Saturday → morning (7h), Sunday → midday (12h)
    const day_part = jsDay === 0 ? 'midday' : jsDay === 6 ? 'morning' : 'evening'
    return {
      plan_id,
      plan_week_id: week.id,
      user_id: user.id,
      ...s,
      discipline: normalizeDiscipline(s.discipline),
      session_type: normalizeSessionType(s.session_type),
      day_part,
      status: 'planned',
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: insertedSessions, error: insertError } = (await (admin as any)
    .from('sessions')
    .insert(sessionRows)
    .select('id, title, session_date, discipline')) as {
    data: Array<Record<string, unknown>> | null
    error: { message: string } | null
  }

  if (insertError) return apiError(insertError.message)

  // Log generation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('plan_generations').insert({
    plan_id,
    trigger: 'week_regenerate',
    scope: { week_num },
    model: 'gemini-2.5-flash',
    response_meta: { sessions_generated: microPlan.sessions.length },
  })

  return apiSuccess({
    week_num,
    sessions_created: insertedSessions?.length ?? 0,
    sessions: insertedSessions,
  })
}
