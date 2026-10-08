import type { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildMicroPrompt,
  buildEquipmentBlock,
  buildStravaStatsBlock,
  type PriorWeek,
  type PlanWeekOverview,
  type EquipmentData,
} from '@/lib/gemini/prompts'
import { calculateZones, formatZonesForPrompt } from '@/lib/utils/zones'
import { addDays, format, parseISO } from 'date-fns'
import { refreshIfNeeded, getAthleteStatsCompact } from '@/lib/strava/client'
import { decryptStravaCreds, encryptStravaTokens } from '@/lib/strava/credentials'

/**
 * Construit l'objet de contexte passé à `buildMicroPrompt` pour une semaine
 * donnée : profil + zones, semaines antérieures et leurs séances, vue macro du
 * plan, bien-être, contraintes d'agenda, stats Strava et équipement.
 *
 * L'appelant reste responsable de récupérer la ligne `week` ciblée (via
 * `week_num`) et de la fournir ici ; cette fonction récupère tout le reste pour
 * être autonome.
 */
export async function buildMicroInputForWeek(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  admin: ReturnType<typeof createAdminClient>
  userId: string
  plan_id: string
  week: {
    id: string
    week_num: number
    phase: string
    is_recovery_week: boolean
    planned_volume_hours: number
    planned_tss: number
    distribution: Record<string, number> | null
    notes: string | null
    start_date: string
  }
  available_days: number[]
}): Promise<Parameters<typeof buildMicroPrompt>[0]> {
  const { supabase, admin, userId, plan_id, week, available_days } = params
  const week_num = week.week_num

  const [profileResult, allPlanWeeksResult, wellnessResult, physiologyResult, garminStatsResult] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('level, weekly_hours_avg, available_disciplines, equipment')
        .eq('id', userId)
        .single(),
      admin
        .from('plan_weeks')
        .select(
          'id, week_num, phase, is_recovery_week, planned_volume_hours, planned_tss, start_date',
        )
        .eq('plan_id', plan_id)
        .order('week_num', { ascending: true }),
      admin
        .from('garmin_wellness')
        .select('date, hrv_rmssd, body_battery_start, resting_hr')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7),
      // Physiology — use the view that returns the most recent measure
      admin
        .from('physiology_current')
        .select(
          'vma_kmh, run_threshold_pace_sec_per_km, hr_max_run, hr_threshold_run, ftp_watts, hr_max, hr_threshold_bike, css_pace_sec_per_100m, resting_hr',
        )
        .eq('user_id', userId)
        .maybeSingle(),
      // Garmin stats for VO2max fallback when no physiology data
      admin.from('garmin_stats').select('vo2max_run').eq('user_id', userId).maybeSingle(),
    ])

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
    resting_hr: physiology?.resting_hr as number | null,
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

    const { data: priorSessions } = (await admin
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
  const weekStartDate = week.start_date
  const weekEndDate = format(addDays(parseISO(weekStartDate), 6), 'yyyy-MM-dd')

  const { data: rawScheduleEvents } = (await supabase
    .from('schedule_events')
    .select('*')
    .eq('user_id', userId)
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

  const { data: stravaCreds } = await supabase
    .from('strava_credentials')
    .select('athlete_id, access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (stravaCreds) {
    try {
      const stored = decryptStravaCreds(stravaCreds)
      const refreshed = await refreshIfNeeded(stored)
      if (refreshed.access_token !== stored.access_token) {
        const adminClient = createAdminClient()

        await adminClient
          .from('strava_credentials')
          .update({
            ...encryptStravaTokens(refreshed),
            expires_at: refreshed.expires_at,
          })
          .eq('user_id', userId)
      }
      const stats = await getAthleteStatsCompact(refreshed.access_token, refreshed.athlete_id)
      stravaStatsBlock = buildStravaStatsBlock(stats)
    } catch {
      // Strava indisponible — génération continue sans ce contexte
    }
  }

  return {
    week: {
      week_num: week.week_num,
      phase: week.phase,
      is_recovery_week: week.is_recovery_week,
      planned_volume_hours: week.planned_volume_hours,
      planned_tss: week.planned_tss,
      distribution: week.distribution ?? {
        z1z2: 0.8,
        z3: 0.1,
        z4z5: 0.1,
      },
      notes: week.notes ?? '',
    },
    profile: {
      level: profile?.level as string | null,
      weekly_hours_avg: profile?.weekly_hours_avg as number | null,
      available_disciplines: profile?.available_disciplines as string[] | null,
    },
    available_days,
    week_start_date: week.start_date,
    prior_weeks: priorWeeks.length ? priorWeeks : undefined,
    plan_overview: planOverview.length ? planOverview : undefined,
    athlete_zones: athleteZones,
    recent_wellness_summary: wellnessSummary || undefined,
    schedule_constraints: scheduleConstraints || undefined,
    strava_stats_block: stravaStatsBlock,
    equipment_block: equipmentBlock,
  }
}
