import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SessionActions } from '@/components/plan/SessionActions'
import { GarminLinker } from '@/components/plan/GarminLinker'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const DISCIPLINE_EMOJI: Record<string, string> = {
  swim: '🏊', bike: '🚴', run: '🏃', brick: '⚡', strength: '💪', rest: '😴',
}
const DISCIPLINE_LABEL: Record<string, string> = {
  swim: 'Natation', bike: 'Vélo', run: 'Course à pied',
  brick: 'Enchaînement', strength: 'Renforcement', rest: 'Récupération',
}
const SESSION_TYPE_LABEL: Record<string, string> = {
  easy: 'Endurance facile', tempo: 'Tempo', threshold: 'Seuil',
  vo2: 'VO2max', race_pace: 'Allure course', technique: 'Technique',
  long: 'Sortie longue', recovery: 'Récupération active', test: 'Test',
}
const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  planned:  { label: 'Planifiée',   variant: 'outline' },
  done:     { label: 'Complétée',   variant: 'default' },
  skipped:  { label: 'Passée',      variant: 'secondary' },
  modified: { label: 'Modifiée',    variant: 'secondary' },
}

const RPE_LABELS: Record<number, string> = {
  1: 'Très facile', 2: 'Facile', 3: 'Modéré', 4: 'Confortable',
  5: 'Modérément difficile', 6: 'Difficile', 7: 'Très difficile',
  8: 'Intense', 9: 'Très intense', 10: 'Maximal',
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = await (supabase as any)
    .from('sessions')
    .select('*, plan_week:plan_weeks(week_num, phase, start_date), linked_garmin:garmin_activity_id(id, activity_type, name, started_at, duration_s, distance_m)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: Record<string, unknown> | null }

  if (!session) notFound()

  // Fetch Garmin activity candidates (same discipline, ±3 days)
  const sessionDate = session.session_date as string
  const disciplineToGarmin: Record<string, string[]> = {
    swim: ['swim'], bike: ['bike'], run: ['run'],
    brick: ['bike', 'run'], strength: ['strength'], rest: [],
  }
  const garminTypes = disciplineToGarmin[session.discipline as string] ?? []
  const dateFrom = new Date(sessionDate); dateFrom.setDate(dateFrom.getDate() - 3)
  const dateTo   = new Date(sessionDate); dateTo.setDate(dateTo.getDate() + 1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: garminCandidates } = garminTypes.length > 0
    ? await (supabase as any)
        .from('garmin_activities')
        .select('id, activity_type, name, started_at, duration_s, distance_m')
        .eq('user_id', user.id)
        .in('activity_type', garminTypes)
        .gte('started_at', dateFrom.toISOString())
        .lte('started_at', dateTo.toISOString())
        .order('started_at', { ascending: false })
    : { data: [] }

  const date = parseISO(session.session_date as string)
  const structure = session.structure as { warmup?: string; main?: string; cooldown?: string } | null
  const targetValues = session.target_values as Record<string, unknown> | null
  const badge = STATUS_BADGE[session.status as string] ?? STATUS_BADGE.planned
  const rpe = session.expected_rpe as number | null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */ null}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span>{format(date, 'EEEE d MMMM yyyy', { locale: fr })}</span>
          <span>·</span>
          <span>Semaine {(session.plan_week as Record<string, unknown>)?.week_num as number}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>{DISCIPLINE_EMOJI[session.discipline as string]}</span>
              {session.title as string}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary">{DISCIPLINE_LABEL[session.discipline as string]}</Badge>
              <Badge variant="outline">{SESSION_TYPE_LABEL[session.session_type as string]}</Badge>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Key metrics */ null}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{session.duration_min as number}<span className="text-sm font-normal ml-1">min</span></div>
            <div className="text-xs text-muted-foreground mt-1">Durée prévue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{(session.planned_tss as number | null) ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">TSS estimé</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{rpe ?? '—'}<span className="text-sm font-normal">/10</span></div>
            <div className="text-xs text-muted-foreground mt-1">RPE cible</div>
            {rpe && <div className="text-xs text-muted-foreground">{RPE_LABELS[rpe]}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Zone cible */ null}
      {(session.target_zone as string | null | undefined) && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Zone cible :</span>
          <Badge variant="outline" className="font-mono">{session.target_zone as string}</Badge>
          {targetValues && Object.entries(targetValues).map(([key, val]) => {
            let label = ''
            if (key === 'hr') label = `FC ${(val as number[]).join('–')} bpm`
            if (key === 'watts') label = `${(val as number[]).join('–')} W`
            if (key === 'pace') label = `Allure ${String(val)}/km`
            if (!label) return null
            return <span key={key} className="text-muted-foreground text-xs">{label}</span>
          })}
        </div>
      )}

      {/* Structure de séance */ null}
      {structure && (
        <Card>
          <CardHeader><CardTitle className="text-base">Déroulé de la séance</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {structure.warmup && (
              <div>
                <p className="font-medium text-foreground mb-1">🔥 Échauffement</p>
                <p className="text-muted-foreground leading-relaxed">{structure.warmup}</p>
              </div>
            )}
            {structure.main && (
              <div>
                <p className="font-medium text-foreground mb-1">⚡ Bloc principal</p>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{structure.main}</p>
              </div>
            )}
            {structure.cooldown && (
              <div>
                <p className="font-medium text-foreground mb-1">🧊 Retour au calme</p>
                <p className="text-muted-foreground leading-relaxed">{structure.cooldown}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Note coach */ null}
      {(session.coaching_note as string | null | undefined) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 text-sm text-amber-800 italic">
            💡 {session.coaching_note as string}
          </CardContent>
        </Card>
      )}

      {/* Lier une activité Garmin */ null}
      {(session.discipline as string) !== 'rest' && (
        <GarminLinker
          sessionId={id}
          linkedActivity={(session.linked_garmin as Record<string, unknown> | null) as Parameters<typeof GarminLinker>[0]['linkedActivity']}
          candidates={(garminCandidates ?? []) as Parameters<typeof GarminLinker>[0]['candidates']}
          initialReview={(session.garmin_review as Parameters<typeof GarminLinker>[0]['initialReview']) ?? null}
        />
      )}

      {/* Actions */ null}
      <SessionActions session={session as unknown as Parameters<typeof SessionActions>[0]['session']} />
    </div>
  )
}
