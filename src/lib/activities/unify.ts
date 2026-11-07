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
const ENDURANCE = new Set(['run', 'bike', 'swim'])

const startDiff = (a: UnifiedActivity, b: UnifiedActivity) =>
  Math.abs(Date.parse(a.started_at) - Date.parse(b.started_at))

const isStravaOnly = (a: UnifiedActivity) => a.sources.length === 1 && a.sources[0] === 'strava'

// Même séance : départs à ≤10 min et disciplines compatibles. Pas de garde-fou de durée :
// Strava mesure le temps écoulé (repos inclus), Garmin le temps actif — l'écart peut
// dépasser 50 % (surtout en natation). Strava classe tout ce qui n'est pas course, vélo
// ou natation en « other » : il correspond alors à n'importe quel type Garmin hors endurance.
function isSameSession(a: UnifiedActivity, b: UnifiedActivity): boolean {
  if (startDiff(a, b) > DEDUP_WINDOW_MS) return false
  if (a.activity_type === b.activity_type) return true
  const [strava, other] = isStravaOnly(a) ? [a, b] : isStravaOnly(b) ? [b, a] : [null, null]
  return strava?.activity_type === 'other' && !ENDURANCE.has(other!.activity_type)
}

/** Index du candidat libre le plus proche dans le temps, ou null. */
function closestMatch(
  target: UnifiedActivity,
  candidates: UnifiedActivity[],
  used: Set<number>,
): number | null {
  let best: { idx: number; diff: number } | null = null
  candidates.forEach((c, idx) => {
    if (used.has(idx) || !isSameSession(target, c)) return
    const diff = startDiff(target, c)
    if (!best || diff < best.diff) best = { idx, diff }
  })
  return (best as { idx: number } | null)?.idx ?? null
}

export function mergeActivities(garmin: GarminRow[], strava: StravaRow[]): UnifiedActivity[] {
  const ug = garmin.map(normalizeGarmin)
  const us = strava.map(normalizeStrava)
  const usedStrava = new Set<number>()
  const shown: UnifiedActivity[] = []

  // 1. Garmin synchronisée + Strava : une ligne Garmin enrichie de la puissance Strava.
  for (const gActivity of ug.filter((a) => !a.is_manual)) {
    const idx = closestMatch(gActivity, us, usedStrava)
    if (idx === null) {
      shown.push(gActivity)
      continue
    }
    usedStrava.add(idx)
    shown.push({
      ...gActivity,
      avg_watts: us[idx].avg_watts,
      suffer_score: us[idx].suffer_score,
      sources: ['garmin', 'strava'],
    })
  }
  us.forEach((sActivity, idx) => {
    if (!usedStrava.has(idx)) shown.push(sActivity)
  })

  // 2. Saisies manuelles : masquées quand une activité synchronisée correspond.
  const usedShown = new Set<number>()
  const manualKept: UnifiedActivity[] = []
  for (const manual of ug.filter((a) => a.is_manual)) {
    const idx = closestMatch(manual, shown, usedShown)
    if (idx === null) manualKept.push(manual)
    else usedShown.add(idx)
  }

  const result = [...shown, ...manualKept]
  result.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
  return result
}
