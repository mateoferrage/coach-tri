import { Activity, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { GarminConnectCard } from '@/components/garmin/GarminConnectCard'
import { PhysiologySection } from '@/components/profile/PhysiologySection'
import { EquipmentSection } from '@/components/profile/EquipmentSection'
import { StravaConnectCard } from '@/components/strava/StravaConnectCard'
import { SectionLabel } from '@/components/common/SectionLabel'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { buttonVariants } from '@/components/ui/button'
import { DISCIPLINE_LABEL } from '@/lib/plan/display'
import { cn } from '@/lib/utils/cn'

export const metadata = { title: 'Profil — Coach Tri' }

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
  elite: 'Élite',
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

/** Section de page : filet au-dessus (sauf la première), intitulé `SectionLabel`. */
function ProfileSection({
  label,
  action,
  children,
}: {
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 border-t border-border pt-8 first:border-t-0 first:pt-0">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <SectionLabel>{label}</SectionLabel>
        {action}
      </div>
      {children}
    </section>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base">{children}</h3>
}

function StatBlock({
  label,
  value,
  unit,
  sub,
  discipline,
  valueClassName = 'text-primary-ink',
}: {
  label: string
  value: string | number | null
  unit?: string
  sub?: string
  discipline?: string
  valueClassName?: string
}) {
  return (
    <div className="space-y-1 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {discipline && <DisciplineIcon discipline={discipline} className="size-3.5" />}
        {label}
      </p>
      {value != null ? (
        <p
          className={cn(
            'font-display text-2xl leading-tight font-bold tabular-nums',
            valueClassName,
          )}
        >
          {value}
          {unit && (
            <span className="ml-1 font-sans text-sm font-medium text-muted-foreground">{unit}</span>
          )}
        </p>
      ) : (
        <p className="font-display text-2xl font-bold text-muted-foreground">—</p>
      )}
      {sub && <p className="text-xs text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  )
}

/* ── PR helpers ───────────────────────────────────────────────────────────── */

function formatSecondsToTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.round(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

// Garmin PR type keys vary — match by distance (meters)
const PR_LABELS: { dist: number; label: string; swim?: boolean }[] = [
  { dist: 400, label: '400m', swim: true },
  { dist: 1000, label: '1 km' },
  { dist: 1609, label: '1 mile' },
  { dist: 5000, label: '5 km' },
  { dist: 10000, label: '10 km' },
  { dist: 21097, label: 'Semi' },
  { dist: 42195, label: 'Marathon' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePRs(raw: any): { label: string; time: string; date: string | null }[] {
  if (!Array.isArray(raw)) return []
  const results: { label: string; time: string; date: string | null }[] = []

  for (const tpl of PR_LABELS) {
    // find a PR record matching distance (±5%)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = raw.find((pr: any) => {
      const d = pr.distance ?? pr.prDistance ?? 0
      return Math.abs(d - tpl.dist) / tpl.dist < 0.05
    })
    if (match) {
      const secs = match.duration ?? match.value ?? match.time ?? null
      if (secs) {
        results.push({
          label: tpl.label,
          time: formatSecondsToTime(Number(secs)),
          date:
            match.prStartTimeGmtFormatted?.split(' ')[0] ??
            match.activityStartDateLocal?.split('T')[0] ??
            null,
        })
      }
    }
  }
  return results
}

/* ── Volume helpers ───────────────────────────────────────────────────────── */

type ActivityRow = {
  activity_type: string
  distance_m: number | null
  duration_s: number | null
  aerobic_te: number | null
}

function computeVolumes(activities: ActivityRow[]) {
  const vol: Record<string, { km: number; h: number; count: number; te: number[] }> = {}
  for (const a of activities) {
    const t = a.activity_type
    if (!vol[t]) vol[t] = { km: 0, h: 0, count: 0, te: [] }
    vol[t].km += (a.distance_m ?? 0) / 1000
    vol[t].h += (a.duration_s ?? 0) / 3600
    vol[t].count += 1
    if (a.aerobic_te) vol[t].te.push(a.aerobic_te)
  }
  return vol
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [profileRes, garminCredsRes, garminStatsRes, activitiesRes, physiologyRes, stravaCredsRes] =
    await Promise.all([
      supabase
        .from('profiles')
        .select(
          'first_name, level, weight_kg, weekly_hours_avg, available_disciplines, birth_date, equipment',
        )
        .eq('id', user!.id)
        .single(),

      supabase.from('garmin_credentials').select('last_sync_at').eq('user_id', user!.id).single(),

      supabase.from('garmin_stats').select('*').eq('user_id', user!.id).single(),

      supabase
        .from('garmin_activities')
        .select('activity_type, distance_m, duration_s, aerobic_te')
        .eq('user_id', user!.id)
        .gte('started_at', thirtyDaysAgo.toISOString())
        .order('started_at', { ascending: false }),

      supabase
        .from('physiology_current')
        .select(
          'run_5k_time_s, run_10k_time_s, run_half_time_s, swim_100m_time_s, swim_200m_time_s, swim_400m_time_s, swim_800m_time_s, ftp_watts, hr_max, resting_hr, vma_kmh, run_threshold_pace_sec_per_km, css_pace_sec_per_100m, test_date',
        )
        .eq('user_id', user!.id)
        .maybeSingle(),

      supabase
        .from('strava_credentials')
        .select('last_sync_at')
        .eq('user_id', user!.id)
        .maybeSingle(),
    ])

  const profile = profileRes.data as {
    first_name: string | null
    level: string | null
    weight_kg: number | null
    weekly_hours_avg: number | null
    available_disciplines: string[] | null
    birth_date: string | null
    equipment: Record<string, unknown> | null
  } | null
  const garminCreds = garminCredsRes.data as { last_sync_at: string | null } | null
  const gStats = garminStatsRes.data as Record<string, unknown> | null
  const activities = (activitiesRes.data ?? []) as ActivityRow[]
  const physiology = physiologyRes.data as {
    run_5k_time_s: number | null
    run_10k_time_s: number | null
    run_half_time_s: number | null
    swim_100m_time_s: number | null
    swim_200m_time_s: number | null
    swim_400m_time_s: number | null
    swim_800m_time_s: number | null
    ftp_watts: number | null
    hr_max: number | null
    resting_hr: number | null
    vma_kmh: number | null
    run_threshold_pace_sec_per_km: number | null
    css_pace_sec_per_100m: number | null
    test_date: string | null
  } | null
  const stravaCreds = stravaCredsRes.data as { last_sync_at: string | null } | null

  // Volume 30j
  const volumes = computeVolumes(activities)
  const totalHours30 = Object.values(volumes).reduce((s, v) => s + v.h, 0)

  // Personal records
  const prs = parsePRs(gStats?.personal_records)

  // Training readiness color
  const readiness = gStats?.training_readiness as number | null
  const readinessClass = !readiness
    ? 'text-muted-foreground'
    : readiness >= 70
      ? 'text-primary-ink'
      : readiness >= 40
        ? 'text-highlight-deep'
        : 'text-destructive'

  const disciplines = profile?.available_disciplines ?? []

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <header className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Mon compte</p>
        <h1 className="text-3xl md:text-4xl">Profil</h1>
      </header>

      <div className="space-y-8">
        {/* ── Identité ── */}
        <ProfileSection
          label="Identité"
          action={
            <a
              href="/onboarding"
              className={buttonVariants({ variant: 'outline-primary', size: 'sm' })}
            >
              Modifier
            </a>
          }
        >
          <div className="rounded-xl border border-border bg-card">
            {!!gStats?.display_name && (
              <div className="flex items-center gap-4 border-b border-border px-5 py-4">
                {gStats.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={gStats.profile_image_url as string}
                    alt="Avatar Garmin"
                    className="size-14 flex-shrink-0 rounded-full border-2 border-primary/40 object-cover"
                  />
                ) : (
                  <div className="flex size-14 flex-shrink-0 items-center justify-center rounded-full border border-primary/40 bg-accent text-primary-ink">
                    <User aria-hidden className="size-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold text-foreground">
                    {gStats.display_name as string}
                  </p>
                  {!!gStats.garmin_username && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      @{gStats.garmin_username as string} · Compte Garmin
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="px-5">
              <InfoRow label="Prénom" value={profile?.first_name ?? '—'} />
              <InfoRow label="Niveau" value={profile?.level ? LEVEL_LABELS[profile.level] : '—'} />
              <InfoRow label="Poids" value={profile?.weight_kg ? `${profile.weight_kg} kg` : '—'} />
              <InfoRow
                label="Disponibilité"
                value={profile?.weekly_hours_avg ? `${profile.weekly_hours_avg}h / semaine` : '—'}
              />
              <InfoRow
                label="Disciplines"
                value={
                  disciplines.length > 0
                    ? disciplines.map((d) => DISCIPLINE_LABEL[d] ?? d).join(' · ')
                    : '—'
                }
              />
            </div>
          </div>
        </ProfileSection>

        {/* ── Volume 30 jours ── */}
        {activities.length > 0 && (
          <ProfileSection label="Volume · 30 derniers jours">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock
                label="Total"
                value={totalHours30 > 0 ? totalHours30.toFixed(1) : null}
                unit="h"
                sub={`${activities.length} séances`}
              />
              {['swim', 'bike', 'run'].map((type) => {
                const v = volumes[type]
                return (
                  <StatBlock
                    key={type}
                    label={DISCIPLINE_LABEL[type] ?? type}
                    discipline={type}
                    value={
                      v
                        ? type === 'swim'
                          ? `${Math.round(v.km * 10) / 10} km`
                          : `${v.km.toFixed(0)} km`
                        : null
                    }
                    sub={v ? `${v.h.toFixed(1)}h · ${v.count} séances` : undefined}
                  />
                )
              })}
            </div>
          </ProfileSection>
        )}

        {/* ── Physiologie ── */}
        <ProfileSection label="Physiologie">
          <div className="space-y-6">
            {/* ── Forme physique ── */}
            {!gStats && garminCreds && (
              <div className="space-y-3">
                <SubTitle>Forme physique</SubTitle>
                <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-5 py-6 text-center">
                  <Activity aria-hidden className="size-6 text-primary-ink" />
                  <p className="text-sm font-semibold text-foreground">
                    Lance un sync Garmin pour voir tes métriques de forme
                  </p>
                  <p className="text-xs text-muted-foreground">
                    VO2 Max course &amp; vélo, âge de forme…
                  </p>
                </div>
              </div>
            )}
            {gStats && (
              <div className="space-y-3">
                <SubTitle>Forme physique</SubTitle>
                {/* VO2 Max — always shown (may be — if not measured yet) */}
                <div className="grid grid-cols-2 gap-3">
                  <StatBlock
                    label="VO2 Max course"
                    value={
                      gStats.vo2max_run != null ? Math.round(gStats.vo2max_run as number) : null
                    }
                    unit="ml/kg/min"
                    sub={
                      (gStats.vo2max_run as number) >= 55
                        ? 'Excellent'
                        : (gStats.vo2max_run as number) >= 45
                          ? 'Bon'
                          : undefined
                    }
                  />
                  <StatBlock
                    label="VO2 Max vélo"
                    value={
                      gStats.vo2max_bike != null ? Math.round(gStats.vo2max_bike as number) : null
                    }
                    unit="ml/kg/min"
                    sub={
                      (gStats.vo2max_bike as number) >= 55
                        ? 'Excellent'
                        : (gStats.vo2max_bike as number) >= 45
                          ? 'Bon'
                          : undefined
                    }
                  />
                </div>

                {/* Training Readiness + Load — only shown if available */}
                {!!(
                  gStats.training_readiness != null ||
                  gStats.training_load_7d != null ||
                  gStats.training_load_28d != null
                ) && (
                  <div className="grid grid-cols-3 gap-3">
                    {gStats.training_readiness != null && (
                      <StatBlock
                        label="Readiness"
                        value={readiness}
                        unit="/100"
                        valueClassName={readinessClass}
                        sub={
                          (readiness ?? 0) >= 70
                            ? 'Prêt'
                            : (readiness ?? 0) >= 40
                              ? 'Modéré'
                              : 'Fatigué'
                        }
                      />
                    )}
                    {gStats.training_load_7d != null && (
                      <StatBlock
                        label="Charge 7j"
                        value={Math.round(gStats.training_load_7d as number)}
                        unit="TSS"
                      />
                    )}
                    {gStats.training_load_28d != null && (
                      <StatBlock
                        label="Charge 28j"
                        value={Math.round(gStats.training_load_28d as number)}
                        unit="TSS"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Records personnels ── */}
            {prs.length > 0 && (
              <div className="space-y-3">
                <SubTitle>Records personnels</SubTitle>
                <ul className="rounded-xl border border-border bg-card px-5">
                  {prs.map((pr) => (
                    <li
                      key={pr.label}
                      className="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0"
                    >
                      <span className="text-sm font-medium text-foreground">{pr.label}</span>
                      <div className="text-right">
                        <span className="font-display text-base font-bold text-primary-ink tabular-nums">
                          {pr.time}
                        </span>
                        {pr.date && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {new Date(pr.date).toLocaleDateString('fr-FR', {
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Données physiologiques ── */}
            <PhysiologySection initial={physiology} />
          </div>
        </ProfileSection>

        {/* ── Équipement ── */}
        <ProfileSection label="Équipement">
          <EquipmentSection initial={profile?.equipment ?? {}} />
        </ProfileSection>

        {/* ── Connexions ── */}
        <ProfileSection label="Connexions">
          <div className="space-y-4">
            <GarminConnectCard
              connected={garminCreds !== null}
              lastSyncAt={garminCreds?.last_sync_at ?? null}
            />
            <StravaConnectCard
              connected={stravaCreds !== null}
              lastSyncAt={stravaCreds?.last_sync_at ?? null}
            />
          </div>
        </ProfileSection>
      </div>
    </div>
  )
}
