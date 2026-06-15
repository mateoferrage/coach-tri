import { createClient } from '@/lib/supabase/server'
import { GarminSyncButton } from '@/components/garmin/GarminSyncButton'
import { AddActivityModal } from '@/components/activities/AddActivityModal'
import {
  ACCENT as MINT,
  SURFACE as DARK,
  SURFACE_DEEP as DARKER,
  DIVIDER,
  withAlpha,
} from '@/lib/theme'
import {
  mergeActivities,
  type UnifiedActivity,
  type GarminRow,
  type StravaRow,
} from '@/lib/activities/unify'

export const metadata = { title: 'Activités — Coach Tri' }

type SportInfo = {
  label: string
  icon: string
  isSwim?: boolean
  isCycling?: boolean
  isStrength?: boolean
}

// Keys match mapActivityType() output from the sync route
const SPORT_MAP: Record<string, SportInfo> = {
  run: { label: 'Course à pied', icon: '🏃' },
  bike: { label: 'Vélo', icon: '🚴', isCycling: true },
  swim: { label: 'Natation', icon: '🏊', isSwim: true },
  triathlon: { label: 'Triathlon', icon: '🏁' },
  strength: { label: 'Musculation', icon: '💪', isStrength: true },
  other: { label: 'Activité', icon: '⚡' },
}

function getSport(t: string): SportInfo {
  return SPORT_MAP[t] ?? SPORT_MAP.other
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatDuration(s: number | null): string | null {
  if (!s) return null
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

function formatDistance(m: number | null, isSwim = false): string | null {
  if (!m) return null
  return isSwim ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`
}

function formatPace(speedMs: number | null, isCycling = false, isSwim = false): string | null {
  if (!speedMs || speedMs === 0) return null
  if (isCycling) return `${(speedMs * 3.6).toFixed(1)} km/h`
  if (isSwim) {
    const s = 100 / speedMs
    return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}/100m`
  }
  const s = 1000 / speedMs
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}/km`
}

function heroDistance(m: number | null, isSwim = false): { value: string; unit: string } | null {
  if (!m) return null
  if (isSwim) return { value: String(Math.round(m)), unit: 'm' }
  return { value: (m / 1000).toFixed(2), unit: 'km' }
}

function heroDuration(s: number | null): { value: string; unit: string } | null {
  if (!s) return null
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0
    ? { value: `${h}h${String(m).padStart(2, '0')}`, unit: '' }
    : { value: String(m), unit: 'min' }
}

function formatDateHeader(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TEBadge({ value }: { value: number | null }) {
  if (!value) return null
  const score = Math.round(value * 10) / 10
  const color =
    score < 2
      ? 'oklch(0.6 0.05 200)'
      : score < 3
        ? 'oklch(0.75 0.15 145)'
        : score < 4
          ? MINT
          : 'oklch(0.88 0.16 157)'
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
      style={{ color, border: `1px solid ${color}` }}
    >
      TE {score.toFixed(1)}
    </span>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-[9px] font-bold uppercase tracking-widest"
        style={{ color: 'oklch(1 0 0 / 35%)' }}
      >
        {label}
      </span>
      <span className="text-sm font-semibold" style={{ color: 'oklch(1 0 0 / 85%)' }}>
        {value}
      </span>
    </div>
  )
}

function ManualBadge() {
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
      style={{ color: 'oklch(0.88 0.16 157)', border: '1px solid oklch(0.88 0.16 157)' }}
    >
      Manuel
    </span>
  )
}

function SourceChip({ source }: { source: 'garmin' | 'strava' }) {
  const color = source === 'strava' ? 'oklch(0.70 0.17 35)' : 'oklch(0.72 0.12 230)'
  const label = source === 'strava' ? 'Strava' : 'Garmin'
  return (
    <span
      className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
      style={{ color, border: `1px solid ${color}` }}
    >
      {label}
    </span>
  )
}

function ActivityCard({ activity }: { activity: UnifiedActivity }) {
  const sport = getSport(activity.activity_type)
  const isManual = activity.is_manual

  const hero =
    !sport.isStrength && activity.distance_m
      ? heroDistance(activity.distance_m, sport.isSwim)
      : heroDuration(activity.duration_s)

  const showDuration = !!(!sport.isStrength && activity.distance_m && activity.duration_s)
  const pace = formatPace(activity.avg_speed_ms, sport.isCycling, sport.isSwim)
  const avgHr = activity.avg_hr ? `${activity.avg_hr} bpm` : null
  const maxHr = activity.max_hr ? `${activity.max_hr} bpm` : null
  const watts = activity.avg_watts ? `${activity.avg_watts} W` : null
  const elevation =
    (activity.elevation_gain_m ?? 0) > 0 ? `${Math.round(activity.elevation_gain_m!)} m` : null
  const distSecondary = sport.isStrength ? formatDistance(activity.distance_m, sport.isSwim) : null

  const stats: { label: string; value: string }[] = [
    showDuration && { label: 'Durée', value: formatDuration(activity.duration_s)! },
    pace && { label: sport.isCycling ? 'Vitesse' : 'Allure', value: pace },
    watts && { label: 'Puissance', value: watts },
    avgHr && { label: 'FC moy.', value: avgHr },
    elevation && { label: 'D+', value: elevation },
    maxHr && { label: 'FC max', value: maxHr },
    distSecondary && { label: 'Distance', value: distSecondary },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: DARK, border: `1px solid ${DIVIDER}` }}
    >
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{
                backgroundColor: withAlpha(MINT, 9),
                border: `1px solid ${withAlpha(MINT, 19)}`,
              }}
            >
              {sport.icon}
            </div>
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: MINT }}
              >
                {sport.label}
              </p>
              {activity.name && (
                <p
                  className="text-[12px] font-semibold leading-tight mt-0.5"
                  style={{ color: 'oklch(1 0 0 / 70%)' }}
                >
                  {activity.name}
                </p>
              )}
              <p className="text-[11px]" style={{ color: 'oklch(1 0 0 / 40%)' }}>
                {formatTime(activity.started_at)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-1.5">
              {activity.sources.map((src) => (
                <SourceChip key={src} source={src} />
              ))}
            </div>
            {isManual ? <ManualBadge /> : <TEBadge value={activity.aerobic_te} />}
          </div>
        </div>

        {hero ? (
          <div className="flex items-baseline gap-2">
            <span
              className="text-5xl font-semibold leading-none"
              style={{ color: 'oklch(0.98 0 0)' }}
            >
              {hero.value}
            </span>
            {hero.unit && (
              <span className="text-lg font-bold" style={{ color: 'oklch(1 0 0 / 45%)' }}>
                {hero.unit}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'oklch(1 0 0 / 30%)' }}>
            Pas de données
          </p>
        )}
      </div>

      {stats.length > 0 && (
        <div
          className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-2"
          style={{ borderTop: `1px solid ${DIVIDER}`, backgroundColor: DARKER }}
        >
          {stats.map(({ label, value }) => (
            <StatPill key={label} label={label} value={value} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ActivitiesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [garminRes, stravaRes] = await Promise.all([
    supabase
      .from('garmin_activities')
      .select(
        'id, garmin_activity_id, activity_type, name, started_at, duration_s, distance_m, avg_hr, max_hr, avg_speed_ms, elevation_gain_m, aerobic_te',
      )
      .eq('user_id', user!.id)
      .order('started_at', { ascending: false })
      .limit(100),

    supabase
      .from('strava_activities')
      .select(
        'id, strava_activity_id, activity_type, name, started_at, duration_s, distance_m, avg_hr, max_hr, avg_speed_ms, elevation_gain_m, avg_watts, suffer_score',
      )
      .eq('user_id', user!.id)
      .order('started_at', { ascending: false })
      .limit(100),
  ])

  const garminRows = (garminRes.data ?? []) as GarminRow[]
  const stravaRows = (stravaRes.data ?? []) as StravaRow[]
  const list: UnifiedActivity[] = mergeActivities(garminRows, stravaRows).slice(0, 50)

  // Group by calendar day
  const groups: { dateKey: string; label: string; items: UnifiedActivity[] }[] = []
  for (const activity of list) {
    const dateKey = activity.started_at.split('T')[0]
    const last = groups[groups.length - 1]
    if (last?.dateKey === dateKey) {
      last.items.push(activity)
    } else {
      groups.push({ dateKey, label: formatDateHeader(activity.started_at), items: [activity] })
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Historique
          </p>
          <h1 className="text-3xl font-semibold uppercase tracking-tight">Activités</h1>
        </div>
        <div className="flex items-center gap-2">
          <AddActivityModal />
          <GarminSyncButton />
        </div>
      </div>

      {/* Content */}
      {list.length === 0 ? (
        <div
          className="rounded-2xl py-20 text-center space-y-3"
          style={{ backgroundColor: DARK, border: `1px solid ${DIVIDER}` }}
        >
          <p className="text-4xl">🏃</p>
          <p className="text-sm" style={{ color: 'oklch(1 0 0 / 50%)' }}>
            Aucune activité synchronisée.
          </p>
          <p className="text-xs" style={{ color: 'oklch(1 0 0 / 25%)' }}>
            Connecte ton compte Garmin ou Strava et lance une synchronisation.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ dateKey, label, items }) => (
            <div key={dateKey} className="space-y-3">
              {/* Date separator */}
              <div className="flex items-center gap-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground capitalize whitespace-nowrap">
                  {label}
                </p>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Cards for that day */}
              {items.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
