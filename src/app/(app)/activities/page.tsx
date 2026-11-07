import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { GarminSyncButton } from '@/components/garmin/GarminSyncButton'
import { AddActivityModal } from '@/components/activities/AddActivityModal'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { SectionLabel } from '@/components/common/SectionLabel'
import { Badge } from '@/components/ui/badge'
import { formatDuration } from '@/lib/plan/display'
import {
  mergeActivities,
  type UnifiedActivity,
  type GarminRow,
  type StravaRow,
} from '@/lib/activities/unify'

export const metadata = { title: 'Activités — Coach Tri' }

type SportInfo = {
  label: string
  isSwim?: boolean
  isCycling?: boolean
  isStrength?: boolean
}

// Keys match mapActivityType() output from the sync route.
// Libellés longs propres à l'historique (« Course à pied », « Musculation », « Triathlon »…) :
// différents de DISCIPLINE_LABEL, d'où cette table locale.
const SPORT_MAP: Record<string, SportInfo> = {
  run: { label: 'Course à pied' },
  bike: { label: 'Vélo', isCycling: true },
  swim: { label: 'Natation', isSwim: true },
  triathlon: { label: 'Triathlon' },
  strength: { label: 'Musculation', isStrength: true },
  other: { label: 'Activité' },
}

function getSport(t: string): SportInfo {
  return SPORT_MAP[t] ?? SPORT_MAP.other
}

// ── Format helpers ────────────────────────────────────────────────────────────

// Les activités stockent des secondes ; formatDuration (display.ts) prend des minutes.
function formatDurationS(s: number | null): string | null {
  if (!s) return null
  return formatDuration(s / 60)
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
  // Même arrondi que formatDurationS (formatDuration) : 3599 s → 1 h.
  const minutes = Math.round(s / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return { value: String(m), unit: 'min' }
  return { value: m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`, unit: '' }
}

function formatDateHeader(iso: string): string {
  return format(new Date(iso), 'EEEE d MMMM yyyy', { locale: fr })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TEBadge({ value }: { value: number | null }) {
  if (!value) return null
  const score = Math.round(value * 10) / 10
  return (
    <Badge variant="outline" className="tabular-nums">
      TE {score.toFixed(1)}
    </Badge>
  )
}

const SOURCE_LABEL: Record<'garmin' | 'strava', string> = { garmin: 'Garmin', strava: 'Strava' }

function ActivityRow({ activity }: { activity: UnifiedActivity }) {
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
    showDuration && { label: 'Durée', value: formatDurationS(activity.duration_s)! },
    pace && { label: sport.isCycling ? 'Vitesse' : 'Allure', value: pace },
    watts && { label: 'Puissance', value: watts },
    avgHr && { label: 'FC moy.', value: avgHr },
    elevation && { label: 'D+', value: elevation },
    maxHr && { label: 'FC max', value: maxHr },
    distSecondary && { label: 'Distance', value: distSecondary },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3 border-t border-border px-3 py-3.5 first:border-t-0">
      <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary-ink">
        <DisciplineIcon discipline={activity.activity_type} size={18} />
      </span>

      <div className="min-w-0 space-y-1.5">
        <div>
          <p className="truncate text-sm font-bold text-foreground">
            {activity.name ?? sport.label}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary-ink">{sport.label}</span>
            {' · '}
            <span className="tabular-nums">{formatTime(activity.started_at)}</span>
          </p>
        </div>

        {stats.length > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {stats.map(({ label, value }) => (
              <div key={label} className="flex items-baseline gap-1">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold text-foreground tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex flex-wrap gap-1.5">
          {activity.sources.map((src) => (
            <Badge key={src} variant="outline">
              {SOURCE_LABEL[src]}
            </Badge>
          ))}
          {isManual ? (
            <Badge variant="outline">Manuel</Badge>
          ) : (
            <TEBadge value={activity.aerobic_te} />
          )}
        </div>
      </div>

      <div className="text-right whitespace-nowrap">
        {hero ? (
          <>
            <span className="font-display text-2xl leading-none font-bold text-foreground tabular-nums">
              {hero.value}
            </span>
            {hero.unit && (
              <span className="ml-1 text-sm font-semibold text-muted-foreground">{hero.unit}</span>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Pas de données</span>
        )}
      </div>
    </li>
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Historique</p>
          <h1 className="text-3xl md:text-4xl">Activités</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {list.length > 0 && <GarminSyncButton />}
          <AddActivityModal />
        </div>
      </div>

      {/* Content */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">Aucune activité synchronisée.</p>
          <p className="text-sm text-muted-foreground">
            Connecte ton compte Garmin ou Strava et lance une synchronisation.
          </p>
          <div className="pt-1">
            <GarminSyncButton />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ dateKey, label, items }) => (
            <section key={dateKey} className="space-y-2">
              <SectionLabel>{label}</SectionLabel>
              <ul className="rounded-xl border border-border bg-card">
                {items.map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
