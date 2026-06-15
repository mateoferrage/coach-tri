const STRAVA_API = 'https://www.strava.com/api/v3'
const TOKEN_URL  = 'https://www.strava.com/oauth/token'

export interface StravaTokens {
  access_token:  string
  refresh_token: string
  expires_at:    number
  athlete_id:    number
}

export interface StravaActivityCompact {
  date:             string
  type:             string
  name:             string | null
  duration_min:     number | null
  distance_km:      number | null
  avg_hr:           number | null
  avg_watts:        number | null
  elevation_gain_m: number | null
  suffer_score:     number | null
}

export interface StravaActivityRecord {
  strava_activity_id: number
  activity_type:      string
  name:               string | null
  started_at:         string
  duration_s:         number | null
  distance_m:         number | null
  avg_hr:             number | null
  max_hr:             number | null
  avg_speed_ms:       number | null
  elevation_gain_m:   number | null
  avg_watts:          number | null
  suffer_score:       number | null
}

export interface StravaStatsCompact {
  ytd_run_km:     number
  ytd_bike_km:    number
  ytd_swim_km:    number
  recent_run_km:  number
  recent_bike_km: number
  recent_swim_km: number
}

interface StravaRawActivity {
  id:                    number
  name:                  string
  type:                  string
  start_date_local:      string
  elapsed_time:          number
  distance:              number
  average_heartrate?:    number
  max_heartrate?:        number
  average_speed?:        number
  average_watts?:        number
  total_elevation_gain?: number
  suffer_score?:         number
}

function normalizeType(stravaType: string): string {
  const t = stravaType.toLowerCase()
  if (t === 'ride' || t === 'virtualride') return 'bike'
  if (t === 'run'  || t === 'trailrun')   return 'run'
  if (t === 'swim')                        return 'swim'
  return 'other'
}

function projectActivity(raw: StravaRawActivity): StravaActivityCompact {
  return {
    date:             raw.start_date_local?.split('T')[0] ?? '',
    type:             normalizeType(raw.type),
    name:             raw.name ?? null,
    duration_min:     raw.elapsed_time ? Math.round(raw.elapsed_time / 60) : null,
    distance_km:      raw.distance ? Math.round(raw.distance / 100) / 10 : null,
    avg_hr:           raw.average_heartrate ?? null,
    avg_watts:        raw.average_watts ?? null,
    elevation_gain_m: raw.total_elevation_gain ? Math.round(raw.total_elevation_gain) : null,
    suffer_score:     raw.suffer_score ?? null,
  }
}

// Strava renvoie des décimaux (ex. 180.7 W, 145.3 bpm) ; ces colonnes sont des integer en DB.
const toInt = (n: number | undefined): number | null =>
  n == null ? null : Math.round(n)

function toRecord(raw: StravaRawActivity): StravaActivityRecord {
  return {
    strava_activity_id: raw.id,
    activity_type:      normalizeType(raw.type),
    name:               raw.name ?? null,
    started_at:         raw.start_date_local,
    duration_s:         toInt(raw.elapsed_time),
    distance_m:         raw.distance ?? null,
    avg_hr:             toInt(raw.average_heartrate),
    max_hr:             toInt(raw.max_heartrate),
    avg_speed_ms:       raw.average_speed ?? null,
    elevation_gain_m:   raw.total_elevation_gain ?? null,
    avg_watts:          toInt(raw.average_watts),
    suffer_score:       toInt(raw.suffer_score),
  }
}

export async function refreshIfNeeded(tokens: StravaTokens): Promise<StravaTokens> {
  const nowSec = Math.floor(Date.now() / 1000)
  if (tokens.expires_at > nowSec + 300) return tokens

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  })
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`)
  const data = await res.json() as { access_token: string; refresh_token: string; expires_at: number }
  return { ...tokens, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at }
}

export async function exchangeCode(code: string): Promise<StravaTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Strava code exchange failed: ${res.status}`)
  const data = await res.json() as {
    access_token: string; refresh_token: string; expires_at: number;
    athlete: { id: number }
  }
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    data.expires_at,
    athlete_id:    data.athlete.id,
  }
}

export async function getRecentActivitiesCompact(
  accessToken: string,
  perPage = 5
): Promise<StravaActivityCompact[]> {
  const res = await fetch(`${STRAVA_API}/athlete/activities?per_page=${perPage}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`)
  const raw = await res.json() as StravaRawActivity[]
  return raw.map(projectActivity)
}

export async function getActivitiesForSync(
  accessToken: string,
  afterTimestamp: number,
  perPage = 30
): Promise<StravaActivityRecord[]> {
  const res = await fetch(
    `${STRAVA_API}/athlete/activities?after=${afterTimestamp}&per_page=${perPage}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`Strava sync fetch failed: ${res.status}`)
  const raw = await res.json() as StravaRawActivity[]
  return raw.map(toRecord)
}

export async function getAthleteStatsCompact(
  accessToken: string,
  athleteId: number
): Promise<StravaStatsCompact> {
  const res = await fetch(`${STRAVA_API}/athletes/${athleteId}/stats`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava stats fetch failed: ${res.status}`)
  const d = await res.json() as {
    ytd_run_totals:     { distance: number }
    ytd_ride_totals:    { distance: number }
    ytd_swim_totals:    { distance: number }
    recent_run_totals:  { distance: number }
    recent_ride_totals: { distance: number }
    recent_swim_totals: { distance: number }
  }
  const km = (m: number) => Math.round(m / 100) / 10
  return {
    ytd_run_km:     km(d.ytd_run_totals?.distance ?? 0),
    ytd_bike_km:    km(d.ytd_ride_totals?.distance ?? 0),
    ytd_swim_km:    km(d.ytd_swim_totals?.distance ?? 0),
    recent_run_km:  km(d.recent_run_totals?.distance ?? 0),
    recent_bike_km: km(d.recent_ride_totals?.distance ?? 0),
    recent_swim_km: km(d.recent_swim_totals?.distance ?? 0),
  }
}
