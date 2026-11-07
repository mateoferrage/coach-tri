import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SectionLabel } from '@/components/common/SectionLabel'
import { SessionActions } from '@/components/plan/SessionActions'
import { SessionHero } from '@/components/plan/SessionHero'
import { GarminLinker } from '@/components/plan/GarminLinker'
import { PHASE_LABEL, SESSION_TYPE_LABEL } from '@/lib/plan/display'
import { effortSegments } from '@/lib/plan/effort'
import type { DashboardSession } from '@/lib/plan/week-summary'
import { intensityColor } from '@/lib/theme'
import { todayIn } from '@/lib/utils/today'
import { cn } from '@/lib/utils/cn'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export const metadata = { title: 'Séance — Coach Tri' }

const STATUS_BADGE: Record<
  string,
  { label: string; variant?: 'default' | 'outline'; className: string }
> = {
  planned: { label: 'Planifiée', className: 'border-border text-foreground' },
  // Badge sur fond bleu : 13 px semibold minimum (spec Élan).
  done: {
    label: 'Complétée',
    variant: 'default',
    className: 'h-auto px-2.5 py-0.5 text-[13px] font-semibold',
  },
  skipped: { label: 'Sautée', className: 'border-border text-muted-foreground' },
  modified: {
    label: 'Modifiée',
    className: 'border-highlight/40 bg-highlight/10 text-highlight-deep',
  },
}

const RPE_LABELS: Record<number, string> = {
  1: 'Très facile',
  2: 'Facile',
  3: 'Modéré',
  4: 'Confortable',
  5: 'Modérément difficile',
  6: 'Difficile',
  7: 'Très difficile',
  8: 'Intense',
  9: 'Très intense',
  10: 'Maximal',
}

const ZONES = [1, 2, 3, 4, 5] as const

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: session } = (await supabase
    .from('sessions')
    .select(
      '*, plan_week:plan_weeks(week_num, phase, start_date), linked_garmin:garmin_activity_id(id, activity_type, name, started_at, duration_s, distance_m)',
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()) as { data: Record<string, unknown> | null }

  if (!session) notFound()

  // Fetch Garmin activity candidates (same discipline, ±3 days)
  const sessionDate = session.session_date as string
  const disciplineToGarmin: Record<string, string[]> = {
    swim: ['swim'],
    bike: ['bike'],
    run: ['run'],
    brick: ['bike', 'run'],
    strength: ['strength'],
    rest: [],
  }
  const garminTypes = disciplineToGarmin[session.discipline as string] ?? []
  const dateFrom = new Date(sessionDate)
  dateFrom.setDate(dateFrom.getDate() - 3)
  const dateTo = new Date(sessionDate)
  dateTo.setDate(dateTo.getDate() + 1)

  const { data: garminCandidates } =
    garminTypes.length > 0
      ? await supabase
          .from('garmin_activities')
          .select('id, activity_type, name, started_at, duration_s, distance_m')
          .eq('user_id', user.id)
          .in('activity_type', garminTypes)
          .gte('started_at', dateFrom.toISOString())
          .lte('started_at', dateTo.toISOString())
          .order('started_at', { ascending: false })
      : { data: [] }

  const date = parseISO(session.session_date as string)
  const structure = session.structure as {
    warmup?: string
    main?: string
    cooldown?: string
  } | null
  const targetValues = session.target_values as Record<string, unknown> | null
  const badge = STATUS_BADGE[session.status as string] ?? STATUS_BADGE.planned
  const heroSession = session as unknown as DashboardSession
  const planWeek = session.plan_week as Record<string, unknown> | null
  const phaseLabel = PHASE_LABEL[planWeek?.phase as string]
  const weekLabel = [
    planWeek?.week_num ? `Semaine ${planWeek.week_num as number}` : null,
    phaseLabel,
  ]
    .filter(Boolean)
    .join(' · ')
  const mainZone = effortSegments(heroSession)[1]?.zone ?? null
  const rpe = session.expected_rpe as number | null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Retour + statut */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/program"
          className="inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-primary-ink hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Programme
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm font-medium text-muted-foreground capitalize">
            {format(date, 'EEEE d MMMM yyyy', { locale: fr })}
          </span>
          <Badge variant={badge.variant ?? 'outline'} className={badge.className}>
            {badge.label}
          </Badge>
        </div>
      </div>

      <SessionHero
        session={heroSession}
        isToday={(session.session_date as string) === todayIn()}
        weekLabel={weekLabel}
        variant="white"
        showOpenLink={false}
        titleAs="h1"
        ariaLabel="Séance"
      />

      {/* Type, zone cible et RPE */}
      <section
        aria-labelledby="targets-title"
        className="rounded-xl border border-border bg-card p-5"
      >
        <SectionLabel id="targets-title">Objectifs</SectionLabel>
        <dl className="mt-3 divide-y divide-border text-sm">
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="font-semibold">
              {SESSION_TYPE_LABEL[session.session_type as string] ??
                (session.session_type as string)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-muted-foreground">RPE cible</dt>
            <dd className="text-right">
              <span className="font-display font-bold tabular-nums">{rpe ?? '—'}</span>
              <span className="text-muted-foreground">/10</span>
              {rpe && <span className="ml-2 text-muted-foreground">{RPE_LABELS[rpe]}</span>}
            </dd>
          </div>
          {(session.target_zone as string | null | undefined) && (
            <div className="flex flex-wrap items-end justify-between gap-3 py-2.5">
              <dt className="flex flex-col gap-1">
                <span className="text-muted-foreground">Zone cible</span>
                <span className="font-mono font-semibold">{session.target_zone as string}</span>
                {targetValues &&
                  Object.entries(targetValues).map(([key, val]) => {
                    let label = ''
                    if (key === 'hr') label = `FC ${(val as number[]).join('–')} bpm`
                    if (key === 'watts') label = `${(val as number[]).join('–')} W`
                    if (key === 'pace') label = `Allure ${String(val)}/km`
                    if (!label) return null
                    return (
                      <span key={key} className="text-xs text-muted-foreground tabular-nums">
                        {label}
                      </span>
                    )
                  })}
              </dt>
              {mainZone && (
                <dd
                  role="img"
                  aria-label={`Zone principale : Z${mainZone} sur 5`}
                  className="flex items-end gap-1"
                >
                  {ZONES.map((z) => (
                    <span key={z} className="flex flex-col items-center gap-1">
                      <span
                        className={cn('block w-6 rounded-t-[3px]', z !== mainZone && 'bg-muted')}
                        style={{
                          height: `${z * 6}px`,
                          backgroundColor: z === mainZone ? intensityColor(z, 'white') : undefined,
                        }}
                      />
                      <span
                        className={cn(
                          'font-mono text-[11px] font-semibold',
                          z === mainZone ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        Z{z}
                      </span>
                    </span>
                  ))}
                </dd>
              )}
            </div>
          )}
        </dl>
      </section>

      {/* Structure de séance */}
      {structure && (
        <section
          aria-labelledby="structure-title"
          className="rounded-xl border border-border bg-card p-5"
        >
          <SectionLabel id="structure-title" className="sr-only">
            Déroulé de la séance
          </SectionLabel>
          <div className="divide-y divide-border text-sm">
            {structure.warmup && (
              <div className="py-3 first:pt-0 last:pb-0">
                <SectionLabel as="h3" className="mb-1.5">
                  Échauffement
                </SectionLabel>
                <p className="leading-relaxed text-foreground">{structure.warmup}</p>
              </div>
            )}
            {structure.main && (
              <div className="py-3 first:pt-0 last:pb-0">
                <SectionLabel as="h3" className="mb-1.5">
                  Corps de séance
                </SectionLabel>
                <p className="leading-relaxed whitespace-pre-line text-foreground">
                  {structure.main}
                </p>
              </div>
            )}
            {structure.cooldown && (
              <div className="py-3 first:pt-0 last:pb-0">
                <SectionLabel as="h3" className="mb-1.5">
                  Retour au calme
                </SectionLabel>
                <p className="leading-relaxed text-foreground">{structure.cooldown}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Lier une activité Garmin */}
      {(session.discipline as string) !== 'rest' && (
        <GarminLinker
          sessionId={id}
          linkedActivity={
            session.linked_garmin as Record<string, unknown> | null as Parameters<
              typeof GarminLinker
            >[0]['linkedActivity']
          }
          candidates={(garminCandidates ?? []) as Parameters<typeof GarminLinker>[0]['candidates']}
          initialReview={
            (session.garmin_review as Parameters<typeof GarminLinker>[0]['initialReview']) ?? null
          }
        />
      )}

      {/* Actions */}
      <SessionActions
        session={session as unknown as Parameters<typeof SessionActions>[0]['session']}
      />
    </div>
  )
}
