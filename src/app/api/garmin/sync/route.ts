import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { decryptCredential } from '@/lib/utils/crypto'
import { buildGarminClient, type StoredTokens } from '@/lib/garmin/client'
import { asJson } from '@/lib/utils/json'
import type { TablesInsert } from '@/types/db'

const MAX_DAYS = 14

/* ── Types ──────────────────────────────────────────────────────────────── */

interface GarminActivity {
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
  training_effect: number | null
  aerobic_te: number | null
  anaerobic_te: number | null
  raw_data: unknown
}

interface GarminWellness {
  date: string
  sleep_duration_s: number | null
  sleep_score: number | null
  hrv_rmssd: number | null
  body_battery_start: number | null
  body_battery_end: number | null
  stress_avg: number | null
  resting_hr: number | null
  steps: number | null
  total_calories: number | null
}

interface GarminStats {
  display_name: string | null
  garmin_username: string | null
  profile_image_url: string | null
  vo2max_run: number | null
  vo2max_bike: number | null
  fitness_age: number | null
  training_readiness: number | null
  training_load_7d: number | null
  training_load_28d: number | null
  personal_records: unknown
  raw_profile: unknown
  raw_fitness: unknown
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function mapActivityType(typeKey: string): string {
  const MAP: Record<string, string> = {
    swimming: 'swim',
    pool_swimming: 'swim',
    lap_swimming: 'swim',
    open_water_swimming: 'swim',
    indoor_swimming: 'swim',
    cycling: 'bike',
    road_biking: 'bike',
    mountain_biking: 'bike',
    indoor_cycling: 'bike',
    virtual_ride: 'bike',
    gravel_cycling: 'bike',
    e_bike_fitness: 'bike',
    bmx: 'bike',
    running: 'run',
    trail_running: 'run',
    treadmill_running: 'run',
    track_running: 'run',
    indoor_running: 'run',
    ultra_run: 'run',
    triathlon: 'triathlon',
    open_water_triathlon: 'triathlon',
    indoor_triathlon: 'triathlon',
    multisport: 'triathlon',
    strength_training: 'strength',
    fitness_equipment: 'strength',
    weight_training: 'strength',
    yoga: 'strength',
    pilates: 'strength',
    crossfit: 'strength',
  }
  return MAP[typeKey] ?? 'other'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivity(a: any): GarminActivity | null {
  if (!a?.activityId) return null
  return {
    garmin_activity_id: Number(a.activityId),
    activity_type: mapActivityType(a.activityType?.typeKey ?? ''),
    name: a.activityName ?? null,
    started_at: a.startTimeLocal ?? a.startTimeGMT,
    duration_s: a.duration != null ? Math.round(Number(a.duration)) : null,
    distance_m: a.distance ?? null,
    avg_hr: a.averageHR ?? null,
    max_hr: a.maxHR ?? null,
    avg_speed_ms: a.averageSpeed ?? null,
    elevation_gain_m: a.elevationGain ?? null,
    training_effect: a.aerobicTrainingEffect ?? null,
    aerobic_te: a.aerobicTrainingEffect ?? null,
    anaerobic_te: a.anaerobicTrainingEffect ?? null,
    raw_data: a,
  }
}

/* ── Encoding fix (Garmin lib returns latin-1 as UTF-8 sometimes) ────────── */
function fixEncoding(s: string | null | undefined): string | null {
  if (!s) return null
  try {
    return Buffer.from(s, 'latin1').toString('utf8')
  } catch {
    return s
  }
}

/* ── Fetch Garmin Stats (non-fatal, best-effort) ────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchGarminStats(gc: any): Promise<GarminStats> {
  const stats: GarminStats = {
    display_name: null,
    garmin_username: null,
    profile_image_url: null,
    vo2max_run: null,
    vo2max_bike: null,
    fitness_age: null,
    training_readiness: null,
    training_load_7d: null,
    training_load_28d: null,
    personal_records: null,
    raw_profile: null,
    raw_fitness: null,
  }

  let garminDisplayName: string | null = null // UUID used for PR endpoint
  const today = toDateStr(new Date())
  const weekAgo = toDateStr(new Date(Date.now() - 7 * 86_400_000))

  // ── 1. User profile ──────────────────────────────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile: any = await gc.getUserProfile()
    // fullName is the real name; displayName is an opaque UUID in some accounts
    stats.display_name = fixEncoding(profile?.fullName ?? profile?.userProfileFullName ?? null)
    stats.garmin_username = profile?.userName ?? null
    stats.profile_image_url =
      profile?.profileImageUrlMedium ??
      profile?.profileImageUrlLarge ??
      profile?.profileImage ??
      null
    garminDisplayName = profile?.displayName ?? null // UUID — works for API paths
    stats.raw_profile = profile
  } catch {
    /* non-fatal */
  }

  // ── 2. VO2 Max + Fitness Age via maxmet range ────────────────────────────
  // The daily/today endpoint returns 404; the range format works and returns
  // an array of items with nested `generic` (run) and `cycling` sub-objects.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maxmet: any[] = await gc.get(
      `https://connectapi.garmin.com/metrics-service/metrics/maxmet/daily/${weekAgo}/${today}`,
    )
    const arr = Array.isArray(maxmet) ? maxmet : []
    for (const item of arr) {
      // generic = running / multisport VO2Max
      if (item.generic?.vo2MaxPreciseValue != null) {
        stats.vo2max_run = item.generic.vo2MaxPreciseValue
        if (item.generic.fitnessAge != null) stats.fitness_age = item.generic.fitnessAge
      }
      // cycling VO2Max
      if (item.cycling?.vo2MaxPreciseValue != null) {
        stats.vo2max_bike = item.cycling.vo2MaxPreciseValue
        if (stats.fitness_age == null && item.cycling.fitnessAge != null) {
          stats.fitness_age = item.cycling.fitnessAge
        }
      }
    }
    stats.raw_fitness = arr.length > 0 ? arr[arr.length - 1] : null
  } catch {
    /* non-fatal */
  }

  // ── 3. Training Readiness (non-fatal — 404 on many accounts) ─────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readiness: any = await gc.get(
      `https://connectapi.garmin.com/metrics-service/metrics/training-readiness/${weekAgo}/${today}`,
    )
    const r = Array.isArray(readiness) ? readiness[readiness.length - 1] : readiness
    stats.training_readiness = r?.score ?? r?.value ?? r?.trainingReadiness ?? null
  } catch {
    /* non-fatal */
  }

  // ── 4. Training Load (non-fatal — 404 on many accounts) ──────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const load: any = await gc.get(
      `https://connectapi.garmin.com/metrics-service/metrics/training-load/${weekAgo}/${today}`,
    )
    const l = Array.isArray(load) ? load[0] : load
    stats.training_load_7d = l?.sevenDayLoad ?? l?.weekLoad ?? null
    stats.training_load_28d = l?.fourWeekLoad ?? l?.monthLoad ?? null
  } catch {
    /* non-fatal */
  }

  // ── 6. Personal Records — use displayName UUID (not email) ───────────────
  const prKey = garminDisplayName ?? stats.garmin_username
  if (prKey) {
    try {
      const prs = await gc.get(
        `https://connectapi.garmin.com/personalrecord-service/personalrecord/prs/${prKey}`,
      )
      stats.personal_records = prs
    } catch {
      /* non-fatal */
    }
  }

  return stats
}

/* ── Activities + Wellness sync ─────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSync(gc: any, lastSyncAt: string | null) {
  const sinceCapped = new Date(
    Math.max(lastSyncAt ? new Date(lastSyncAt).getTime() : 0, Date.now() - MAX_DAYS * 86_400_000),
  )
  const since = toDateStr(sinceCapped)
  const todayStr = toDateStr(new Date())

  /* Activities */
  const activities: GarminActivity[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await gc.get(
      'https://connectapi.garmin.com/activitylist-service/activities/search/activities',
      { startDate: since, endDate: todayStr, limit: 100, start: 0 },
    )
    for (const a of Array.isArray(raw) ? raw : []) {
      const mapped = mapActivity(a)
      if (mapped) activities.push(mapped)
    }
  } catch {
    /* non-fatal */
  }

  /* Wellness — day by day */
  const wellness: GarminWellness[] = []
  let cursor = new Date(since + 'T12:00:00')
  const end = new Date(todayStr + 'T12:00:00')

  while (cursor <= end) {
    const dateStr = toDateStr(cursor)
    const dateObj = new Date(cursor)

    let sleepDurationS: number | null = null
    let sleepScore: number | null = null
    let hrvRmssd: number | null = null
    let bodyBatteryStart: number | null = null
    let restingHr: number | null = null
    let steps: number | null = null

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = await gc.getSleepData(dateObj)
      sleepDurationS = s?.dailySleepDTO?.sleepTimeSeconds ?? null
      const sc = s?.dailySleepDTO?.sleepScores
      if (sc?.overall?.value != null) sleepScore = sc.overall.value
    } catch {}

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hr: any = await gc.getHeartRate(dateObj)
      restingHr = hr?.restingHeartRate ?? null
    } catch {}

    try {
      const s = await gc.getSteps(dateObj)
      steps = typeof s === 'number' ? s : null
    } catch {}

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hrv: any = await gc.get(`https://connectapi.garmin.com/hrv-service/hrv/${dateStr}`)
      hrvRmssd = hrv?.hrvSummary?.lastNight ?? null
    } catch {}

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bb: any[] = await gc.get(
        `https://connectapi.garmin.com/wellness-service/wellness/bodyBattery/readingList/${dateStr}/${dateStr}`,
      )
      if (Array.isArray(bb) && bb.length > 0) {
        bodyBatteryStart = bb[0]?.bodyBatteryLevel ?? null
      }
    } catch {}

    wellness.push({
      date: dateStr,
      sleep_duration_s: sleepDurationS,
      sleep_score: sleepScore,
      hrv_rmssd: hrvRmssd,
      body_battery_start: bodyBatteryStart,
      body_battery_end: null,
      stress_avg: null,
      resting_hr: restingHr,
      steps,
      total_calories: null,
    })

    await delay(350)
    cursor = addDays(cursor, 1)
  }

  return { activities, wellness }
}

/* ── Route Handler ───────────────────────────────────────────────────────── */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const admin = createAdminClient()

  const { data: creds } = (await admin
    .from('garmin_credentials')
    .select('email_enc, password_enc, session_data, last_sync_at')
    .eq('user_id', user.id)
    .single()) as {
    data: {
      email_enc: string
      password_enc: string
      session_data: unknown
      last_sync_at: string | null
    } | null
  }

  if (!creds) return apiError('Aucun compte Garmin connecté. Connecte ton compte dans Profil.', 400)

  const email = decryptCredential(creds.email_enc)
  const password = decryptCredential(creds.password_enc)

  try {
    // Authenticate once (restores tokens from DB if valid, falls back to full login)
    const { gc } = await buildGarminClient(email, password, creds.session_data)

    // Run in parallel: activities+wellness AND profile stats
    const [{ activities, wellness }, garminStats] = await Promise.all([
      runSync(gc, creds.last_sync_at),
      fetchGarminStats(gc),
    ])

    // Upsert activities
    if (activities.length > 0) {
      await admin.from('garmin_activities').upsert(
        activities.map((a) => ({ ...a, user_id: user.id, raw_data: asJson(a.raw_data) })),
        { onConflict: 'user_id,garmin_activity_id' },
      )
    }

    // Upsert wellness
    if (wellness.length > 0) {
      await admin.from('garmin_wellness').upsert(
        wellness.map((w) => ({ ...w, user_id: user.id })),
        { onConflict: 'user_id,date' },
      )
    }

    // Upsert garmin_stats (one row per user)
    // Only include non-null values so a failed fetch doesn't overwrite previously stored data
    const statsPayload: Record<string, unknown> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }
    for (const [key, value] of Object.entries(garminStats)) {
      if (value !== null) statsPayload[key] = value
    }

    // statsPayload est partiel et construit dynamiquement (clés non-null seulement)
    await admin
      .from('garmin_stats')
      .upsert(statsPayload as TablesInsert<'garmin_stats'>, { onConflict: 'user_id' })

    // Persist refreshed tokens
    const tokens = gc.exportToken() as StoredTokens

    await admin
      .from('garmin_credentials')
      .update({ last_sync_at: new Date().toISOString(), session_data: asJson(tokens) })
      .eq('user_id', user.id)

    return apiSuccess({
      success: true,
      activities_synced: activities.length,
      wellness_synced: wellness.length,
      stats_synced: true,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur de synchronisation Garmin'
    if (message.toLowerCase().includes('unauthorized') || message.includes('401')) {
      return apiError('Identifiants Garmin incorrects. Reconnecte ton compte dans Profil.', 401)
    }
    return apiError(message, 500)
  }
}
