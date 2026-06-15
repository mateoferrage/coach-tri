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
  aerobic_te: number | null      // Garmin uniquement
  avg_watts: number | null       // Strava uniquement
  suffer_score: number | null    // Strava uniquement
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
