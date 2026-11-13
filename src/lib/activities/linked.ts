import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'
import type { ActualActivity } from './compare'
import { mergeActivities, type GarminRow, type StravaRow, type UnifiedActivity } from './unify'

type Client = SupabaseClient<Database>

export interface SessionLink {
  garmin_activity_id: string | null
  strava_activity_id: string | null
}

const GARMIN_COLUMNS =
  'id, garmin_activity_id, activity_type, name, started_at, duration_s, distance_m, avg_hr, max_hr, avg_speed_ms, elevation_gain_m, aerobic_te'
const STRAVA_COLUMNS =
  'id, strava_activity_id, activity_type, name, started_at, duration_s, distance_m, avg_hr, max_hr, avg_speed_ms, elevation_gain_m, avg_watts, suffer_score'

/** Clé stable d'une liaison (Garmin prioritaire, Strava sinon). */
export function linkKey(link: SessionLink): string | null {
  return link.garmin_activity_id
    ? `g:${link.garmin_activity_id}`
    : link.strava_activity_id
      ? `s:${link.strava_activity_id}`
      : null
}

/**
 * Données réalisées des activités liées à des séances. Garmin fait foi ; la
 * puissance vient de Strava quand la séance est aussi liée à Strava.
 */
export async function fetchLinkedActivities(
  client: Client,
  userId: string,
  links: SessionLink[],
): Promise<Map<string, ActualActivity>> {
  const garminIds = [...new Set(links.map((l) => l.garmin_activity_id).filter(Boolean))] as string[]
  const stravaIds = [...new Set(links.map((l) => l.strava_activity_id).filter(Boolean))] as string[]
  const [garminRes, stravaRes] = await Promise.all([
    garminIds.length
      ? client.from('garmin_activities').select(GARMIN_COLUMNS).eq('user_id', userId).in('id', garminIds)
      : Promise.resolve({ data: [] }),
    stravaIds.length
      ? client.from('strava_activities').select(STRAVA_COLUMNS).eq('user_id', userId).in('id', stravaIds)
      : Promise.resolve({ data: [] }),
  ])
  const garmin = new Map(((garminRes.data ?? []) as GarminRow[]).map((r) => [r.id, r]))
  const strava = new Map(((stravaRes.data ?? []) as StravaRow[]).map((r) => [r.id, r]))

  const result = new Map<string, ActualActivity>()
  for (const link of links) {
    const key = linkKey(link)
    if (!key || result.has(key)) continue
    const g = link.garmin_activity_id ? garmin.get(link.garmin_activity_id) : undefined
    const s = link.strava_activity_id ? strava.get(link.strava_activity_id) : undefined
    const base = g ?? s
    if (!base) continue
    result.set(key, {
      duration_s: base.duration_s,
      distance_m: base.distance_m,
      avg_hr: base.avg_hr,
      avg_speed_ms: base.avg_speed_ms,
      elevation_gain_m: base.elevation_gain_m,
      avg_watts: s?.avg_watts ?? null,
    })
  }
  return result
}

/** Activités Garmin + Strava (dédoublonnées) d'une période, pour proposer une liaison. */
export async function fetchUnifiedActivities(
  client: Client,
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<UnifiedActivity[]> {
  const [garminRes, stravaRes] = await Promise.all([
    client
      .from('garmin_activities')
      .select(GARMIN_COLUMNS)
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
    client
      .from('strava_activities')
      .select(STRAVA_COLUMNS)
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
  ])
  return mergeActivities(
    (garminRes.data ?? []) as GarminRow[],
    (stravaRes.data ?? []) as StravaRow[],
  )
}

/** Ids à enregistrer sur la séance pour une activité unifiée. */
export function linkFor(a: UnifiedActivity): SessionLink {
  return {
    garmin_activity_id: a.sources.includes('garmin') ? a.id : null,
    strava_activity_id: a.strava_id ?? null,
  }
}

// ─── Liaison automatique ───────────────────────────────────────────────────────

const AUTO_LINK_DAYS = 14
const LINKABLE = new Set(['run', 'bike', 'swim', 'strength'])

export interface AutoLinkSession {
  id: string
  session_date: string
  discipline: string
}

/**
 * Associe séances et activités sans ambiguïté : même jour (heure locale) et
 * même discipline, avec exactement une séance et une activité de chaque côté.
 * Dans le doute, rien n'est lié : l'athlète le fera à la main.
 */
export function matchSessionsToActivities(
  sessions: AutoLinkSession[],
  activities: UnifiedActivity[],
): { session_id: string; activity: UnifiedActivity }[] {
  const group = <T>(items: T[], key: (t: T) => string | null) => {
    const map = new Map<string, T[]>()
    for (const it of items) {
      const k = key(it)
      if (!k) continue
      map.set(k, [...(map.get(k) ?? []), it])
    }
    return map
  }
  const sessionsByKey = group(sessions, (s) =>
    LINKABLE.has(s.discipline) ? `${s.session_date}|${s.discipline}` : null,
  )
  // started_at est l'heure locale stockée en +00 : la date se lit directement.
  const activitiesByKey = group(activities, (a) =>
    LINKABLE.has(a.activity_type) ? `${a.started_at.slice(0, 10)}|${a.activity_type}` : null,
  )
  const matches: { session_id: string; activity: UnifiedActivity }[] = []
  for (const [key, ss] of sessionsByKey) {
    const as = activitiesByKey.get(key)
    if (ss.length === 1 && as?.length === 1) matches.push({ session_id: ss[0].id, activity: as[0] })
  }
  return matches
}

/** Lie automatiquement les séances prévues récentes aux activités synchronisées. */
export async function autoLinkSessions(client: Client, userId: string, today: string): Promise<number> {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - AUTO_LINK_DAYS * 86400000)
    .toISOString()
    .slice(0, 10)

  const { data: sessions } = await client
    .from('sessions')
    .select('id, session_date, discipline, status, garmin_activity_id, strava_activity_id')
    .eq('user_id', userId)
    .gte('session_date', from)
    .lte('session_date', today)
  if (!sessions?.length) return 0

  // Activités déjà liées à une autre séance : jamais réutilisées.
  const taken = new Set(
    sessions.flatMap((s) => [s.garmin_activity_id, s.strava_activity_id]).filter(Boolean),
  )
  const candidates = sessions.filter(
    (s) => s.status === 'planned' && !s.garmin_activity_id && !s.strava_activity_id,
  )
  if (!candidates.length) return 0

  const activities = await fetchUnifiedActivities(
    client,
    userId,
    `${from}T00:00:00Z`,
    `${today}T23:59:59Z`,
  )
  const free = activities.filter((a) => {
    const l = linkFor(a)
    return !(l.garmin_activity_id && taken.has(l.garmin_activity_id)) &&
      !(l.strava_activity_id && taken.has(l.strava_activity_id))
  })

  const matches = matchSessionsToActivities(candidates, free)
  const now = new Date().toISOString()
  for (const m of matches) {
    await client
      .from('sessions')
      .update({ ...linkFor(m.activity), status: 'done', completed_at: now })
      .eq('id', m.session_id)
      .eq('user_id', userId)
  }
  return matches.length
}
