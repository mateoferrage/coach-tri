export type ActivitySource = 'garmin' | 'strava'

export type UnifiedActivity = {
  id: string
  activity_type: string
  name: string | null
  started_at: string
  duration_s: number | null
  distance_m: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_speed_ms: number | null
  elevation_gain_m: number | null
  aerobic_te: number | null // Garmin uniquement
  avg_watts: number | null // Strava uniquement
  suffer_score: number | null // Strava uniquement
  is_manual: boolean
  sources: ActivitySource[]
}

export type GarminRow = {
  id: string
  garmin_activity_id: number
  activity_type: string
  name: string | null
  started_at: string
  duration_s: number | null
  distance_m: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_speed_ms: number | null
  elevation_gain_m: number | null
  aerobic_te: number | null
}

export type StravaRow = {
  id: string
  strava_activity_id: number
  activity_type: string
  name: string | null
  started_at: string
  duration_s: number | null
  distance_m: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_speed_ms: number | null
  elevation_gain_m: number | null
  avg_watts: number | null
  suffer_score: number | null
}

export function normalizeGarmin(row: GarminRow): UnifiedActivity {
  return {
    id: row.id,
    activity_type: row.activity_type,
    name: row.name,
    started_at: row.started_at,
    duration_s: row.duration_s,
    distance_m: row.distance_m,
    avg_hr: row.avg_hr,
    max_hr: row.max_hr,
    avg_speed_ms: row.avg_speed_ms,
    elevation_gain_m: row.elevation_gain_m,
    aerobic_te: row.aerobic_te,
    avg_watts: null,
    suffer_score: null,
    is_manual: row.garmin_activity_id < 0,
    sources: ['garmin'],
  }
}

export function normalizeStrava(row: StravaRow): UnifiedActivity {
  return {
    id: row.id,
    activity_type: row.activity_type,
    name: row.name,
    started_at: row.started_at,
    duration_s: row.duration_s,
    distance_m: row.distance_m,
    avg_hr: row.avg_hr,
    max_hr: row.max_hr,
    avg_speed_ms: row.avg_speed_ms,
    elevation_gain_m: row.elevation_gain_m,
    aerobic_te: null,
    avg_watts: row.avg_watts,
    suffer_score: row.suffer_score,
    is_manual: false,
    sources: ['strava'],
  }
}

const DEDUP_WINDOW_MS = 10 * 60 * 1000 // ±10 min
const DEDUP_DISCIPLINES = new Set(['run', 'bike', 'swim'])

function canDedup(a: UnifiedActivity): boolean {
  return !a.is_manual && DEDUP_DISCIPLINES.has(a.activity_type)
}

// Même discipline + début à ≤10 min suffit. Pas de garde-fou de durée :
// Strava mesure le temps écoulé (repos inclus), Garmin le temps actif —
// l'écart peut dépasser 50 % (surtout en natation) sans qu'il s'agisse de
// séances distinctes. Démarrer deux séances du même sport à <10 min est improbable.
function isSameSession(garmin: UnifiedActivity, strava: UnifiedActivity): boolean {
  if (garmin.activity_type !== strava.activity_type) return false
  const diff = Math.abs(Date.parse(garmin.started_at) - Date.parse(strava.started_at))
  return diff <= DEDUP_WINDOW_MS
}

export function mergeActivities(garmin: GarminRow[], strava: StravaRow[]): UnifiedActivity[] {
  const ug = garmin.map(normalizeGarmin)
  const us = strava.map(normalizeStrava)
  const usedStrava = new Set<number>()
  const result: UnifiedActivity[] = []

  for (const gActivity of ug) {
    let match: { idx: number; diff: number } | null = null
    if (canDedup(gActivity)) {
      us.forEach((sActivity, idx) => {
        if (usedStrava.has(idx) || !canDedup(sActivity)) return
        if (!isSameSession(gActivity, sActivity)) return
        const diff = Math.abs(Date.parse(gActivity.started_at) - Date.parse(sActivity.started_at))
        if (!match || diff < match.diff) match = { idx, diff }
      })
    }
    if (match) {
      const sActivity = us[(match as { idx: number; diff: number }).idx]
      usedStrava.add((match as { idx: number; diff: number }).idx)
      result.push({
        ...gActivity,
        avg_watts: sActivity.avg_watts,
        suffer_score: sActivity.suffer_score,
        sources: ['garmin', 'strava'],
      })
    } else {
      result.push(gActivity)
    }
  }

  us.forEach((sActivity, idx) => {
    if (!usedStrava.has(idx)) result.push(sActivity)
  })

  result.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
  return result
}
