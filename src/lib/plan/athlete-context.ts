import { addWeeks, format } from 'date-fns'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { PerformanceData } from '@/lib/gemini/prompts'
import { withFreshDerivations } from '@/lib/utils/performance'

const HISTORY_WEEKS = 8

type ActivityRow = { activity_type?: unknown; duration_s?: unknown }

/** Résumé des activités récentes : par sport et moyenne hebdomadaire réelle. */
export function summarizeActivities(activities: ActivityRow[]): string {
  if (!activities.length) return ''
  const byType: Record<string, { count: number; hours: number }> = {}
  let totalHours = 0
  for (const a of activities) {
    const type = (a.activity_type as string) || 'other'
    const hours = ((a.duration_s as number) || 0) / 3600
    byType[type] ??= { count: 0, hours: 0 }
    byType[type].count++
    byType[type].hours += hours
    totalHours += hours
  }
  const lines = Object.entries(byType).map(
    ([t, v]) => `${t}: ${v.count} séances, ${v.hours.toFixed(1)}h sur ${HISTORY_WEEKS} semaines`,
  )
  lines.push(`Volume moyen réel : ${(totalHours / HISTORY_WEEKS).toFixed(1)}h/semaine`)
  return lines.join('\n')
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

export function summarizeWellness(wellness: Array<Record<string, unknown>>): string {
  const hrv = average(wellness.map((w) => w.hrv_rmssd as number).filter(Boolean))
  const bodyBattery = average(wellness.map((w) => w.body_battery_start as number).filter(Boolean))
  const parts = [
    hrv != null && `HRV moyen : ${hrv.toFixed(0)} ms`,
    bodyBattery != null && `Body Battery moyen : ${bodyBattery.toFixed(0)}/100`,
  ].filter(Boolean)
  return parts.join(' | ')
}

/**
 * Niveau actuel de l'athlète pour le prompt macro. Partagé par la création et la
 * replanification. Garmin est prioritaire ; Strava sert de repli pour ne pas
 * compter deux fois les activités synchronisées sur les deux services.
 */
export async function fetchAthleteContext(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{
  performance?: PerformanceData
  recent_activity_summary?: string
  recent_wellness_summary?: string
}> {
  const since = format(addWeeks(new Date(), -HISTORY_WEEKS), 'yyyy-MM-dd')

  const [garminRes, stravaRes, wellnessRes, physiologyRes] = await Promise.all([
    admin
      .from('garmin_activities')
      .select('activity_type, duration_s')
      .eq('user_id', userId)
      .gte('started_at', since),
    admin
      .from('strava_activities')
      .select('activity_type, duration_s')
      .eq('user_id', userId)
      .gte('started_at', since),
    admin
      .from('garmin_wellness')
      .select('date, hrv_rmssd, body_battery_start, resting_hr, sleep_score')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(14),
    admin
      .from('physiology_current')
      .select(
        'run_5k_time_s, run_10k_time_s, run_half_time_s, swim_100m_time_s, swim_200m_time_s, swim_400m_time_s, swim_800m_time_s, ftp_watts, hr_max, resting_hr, vma_kmh, run_threshold_pace_sec_per_km, css_pace_sec_per_100m',
      )
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const activities = garminRes.data?.length ? garminRes.data : (stravaRes.data ?? [])

  return {
    performance: physiologyRes.data
      ? withFreshDerivations(physiologyRes.data as PerformanceData)
      : undefined,
    recent_activity_summary: summarizeActivities(activities) || undefined,
    recent_wellness_summary:
      summarizeWellness((wellnessRes.data ?? []) as Array<Record<string, unknown>>) || undefined,
  }
}
