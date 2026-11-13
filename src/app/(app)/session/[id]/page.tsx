import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SectionLabel } from '@/components/common/SectionLabel'
import { SessionActions } from '@/components/plan/SessionActions'
import { SessionHero } from '@/components/plan/SessionHero'
import { ActivityLinker, type LinkableActivity } from '@/components/plan/ActivityLinker'
import { SessionComparison } from '@/components/plan/SessionComparison'
import { TestResultCard, type TestPrefill } from '@/components/plan/TestResultCard'
import { testKindFor } from '@/lib/physiology/test-results'
import { compareSession } from '@/lib/activities/compare'
import { fetchLinkedActivities, fetchUnifiedActivities, linkFor, linkKey } from '@/lib/activities/linked'
import type { UnifiedActivity } from '@/lib/activities/unify'
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

/**
 * Libellés des cibles chiffrées. `target_values` vient de l'IA sans validation :
 * une clé peut valoir `null` (« watts": null » sur une séance de renfo) ou ne pas
 * avoir le type attendu — on ignore ce qui n'est pas exploitable.
 */
function targetLabels(values: Record<string, unknown> | null): string[] {
  if (!values) return []
  const range = (v: unknown) =>
    Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === 'number') ? v.join('–') : null
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  const hr = range(values.hr)
  const watts = range(values.watts)
  const paceKm = text(values.pace_per_km) ?? text(values.pace)
  const pace100 = text(values.pace_per_100m)
  const gain =
    typeof values.elevation_gain_m === 'number' && values.elevation_gain_m > 0
      ? Math.round(values.elevation_gain_m)
      : null
  return [
    hr && `FC ${hr} bpm`,
    watts && `${watts} W`,
    paceKm && `Allure ${paceKm}/km`,
    pace100 && `Allure ${pace100}/100 m`,
    gain && `D+ ${gain} m`,
  ].filter((l): l is string => Boolean(l))
}

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
      '*, plan_week:plan_weeks(week_num, phase, start_date)',
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()) as { data: Record<string, unknown> | null }

  if (!session) notFound()

  // Activités Garmin + Strava (dédoublonnées) à ±3 jours, de la même discipline.
  const sessionDate = session.session_date as string
  const discipline = session.discipline as string
  const disciplineTypes: Record<string, string[]> = {
    swim: ['swim'],
    bike: ['bike'],
    run: ['run'],
    brick: ['bike', 'run'],
    strength: ['strength', 'other'],
  }
  const types = disciplineTypes[discipline] ?? []
  const shift = (days: number) =>
    new Date(Date.parse(`${sessionDate}T00:00:00Z`) + days * 86400000).toISOString()
  const nearby = types.length
    ? (await fetchUnifiedActivities(supabase, user.id, shift(-3), shift(2))).filter((a) =>
        types.includes(a.activity_type),
      )
    : []

  const link = {
    garmin_activity_id: session.garmin_activity_id as string | null,
    strava_activity_id: (session.strava_activity_id as string | null) ?? null,
  }
  const toLinkable = (a: UnifiedActivity): LinkableActivity => {
    const l = linkFor(a)
    return {
      key: linkKey(l) ?? a.id,
      garmin_id: l.garmin_activity_id,
      strava_id: l.strava_activity_id,
      sources: a.sources,
      activity_type: a.activity_type,
      name: a.name,
      started_at: a.started_at,
      duration_s: a.duration_s,
      distance_m: a.distance_m,
    }
  }
  const isLinked = (a: UnifiedActivity) => {
    const l = linkFor(a)
    return (
      (!!l.garmin_activity_id && l.garmin_activity_id === link.garmin_activity_id) ||
      (!!l.strava_activity_id && l.strava_activity_id === link.strava_activity_id)
    )
  }
  const linkedUnified = linkKey(link)
    ? (nearby.find(isLinked) ??
      (
        await fetchUnifiedActivities(supabase, user.id, shift(-30), shift(30))
      ).find(isLinked) ??
      null)
    : null
  const linkedActivity = linkedUnified ? toLinkable(linkedUnified) : null
  const candidates = nearby.filter((a) => !isLinked(a)).map(toLinkable)

  const actual = linkKey(link)
    ? (await fetchLinkedActivities(supabase, user.id, [link])).get(linkKey(link)!)
    : undefined
  const comparison = actual
    ? compareSession(
        {
          discipline,
          session_type: session.session_type as string,
          duration_min: session.duration_min as number,
          target_values: session.target_values as Record<string, unknown> | null,
        },
        actual,
      )
    : []

  // Séance de test : saisie du résultat → zones du profil. Pré-remplie depuis
  // l'activité liée quand sa durée correspond au seul bloc de test.
  const isTest =
    session.session_type === 'test' ||
    String(session.template_code ?? '').toUpperCase().startsWith('TEST')
  const testKind = isTest ? testKindFor(discipline) : null
  const actualMin = actual?.duration_s ? actual.duration_s / 60 : 0
  const testPrefill: TestPrefill | undefined =
    testKind === 'run' && actualMin >= 27 && actualMin <= 33
      ? { distance_m: actual?.distance_m, avg_hr: actual?.avg_hr }
      : testKind === 'bike' && actualMin >= 18 && actualMin <= 22
        ? { avg_power: actual?.avg_watts }
        : undefined

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
          <span className="inline-block text-sm font-medium text-muted-foreground first-letter:uppercase">
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
                {targetLabels(targetValues).map((label) => (
                  <span key={label} className="text-xs text-muted-foreground tabular-nums">
                    {label}
                  </span>
                ))}
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

      {testKind && <TestResultCard kind={testKind} prefill={testPrefill} />}

      {/* Prévu / réalisé (activité liée) */}
      <SessionComparison rows={comparison} />

      {/* Lier une activité Garmin ou Strava */}
      {discipline !== 'rest' && (
        <ActivityLinker
          sessionId={id}
          linkedActivity={linkedActivity}
          candidates={candidates}
          initialReview={
            (session.garmin_review as Parameters<typeof ActivityLinker>[0]['initialReview']) ??
            null
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
