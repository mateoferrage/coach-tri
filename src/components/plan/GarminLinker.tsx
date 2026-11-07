'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/common/SectionLabel'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'

const DISCIPLINE_LABEL: Record<string, string> = {
  swim: 'Natation',
  bike: 'Vélo',
  run: 'Course',
  triathlon: 'Triathlon',
  strength: 'Muscu',
  other: 'Activité',
}

const VERDICT_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'highlight' }
> = {
  excellent: { label: 'Excellent', variant: 'default' },
  good: { label: 'Bonne séance', variant: 'secondary' },
  average: { label: 'Correcte', variant: 'outline' },
  poor: { label: 'À revoir', variant: 'highlight' },
}

interface GarminActivity {
  id: string
  activity_type: string
  name: string | null
  started_at: string
  duration_s: number | null
  distance_m: number | null
}

interface CoachReview {
  verdict: 'excellent' | 'good' | 'average' | 'poor'
  message: string
}

interface Props {
  sessionId: string
  linkedActivity: GarminActivity | null
  candidates: GarminActivity[]
  initialReview?: CoachReview | null
}

function fmt(duration_s: number | null, distance_m: number | null, activityType: string): string {
  const parts: string[] = []
  if (duration_s) {
    const h = Math.floor(duration_s / 3600)
    const m = Math.floor((duration_s % 3600) / 60)
    parts.push(h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`)
  }
  if (distance_m) {
    parts.push(
      activityType === 'swim'
        ? `${Math.round(distance_m)} m`
        : `${(distance_m / 1000).toFixed(2)} km`,
    )
  }
  return parts.join(' · ') || '—'
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function GarminLinker({ sessionId, linkedActivity, candidates, initialReview }: Props) {
  const router = useRouter()
  const [linked, setLinked] = useState<GarminActivity | null>(linkedActivity)
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(false)
  const [review, setReview] = useState<CoachReview | null>(initialReview ?? null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  async function fetchReview() {
    setReviewLoading(true)
    setReviewError(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/coach-review`, { method: 'POST' })
      const json = (await res.json()) as CoachReview & { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      if (json.verdict && json.message) setReview({ verdict: json.verdict, message: json.message })
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Impossible d'obtenir le retour du coach")
    } finally {
      setReviewLoading(false)
    }
  }

  async function handleLink(garminId: string | null) {
    setPending(true)
    try {
      const linkRes = await fetch(`/api/sessions/${sessionId}/link-garmin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garmin_activity_id: garminId }),
      })
      if (!linkRes.ok) {
        const json = (await linkRes.json()) as { error?: string }
        setReviewError(json.error ?? 'Erreur lors du lien Garmin')
        return
      }

      const newStatus = garminId ? 'done' : 'planned'
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const found = garminId ? (candidates.find((c) => c.id === garminId) ?? null) : null
      setLinked(found)
      setOpen(false)
      setReview(null)
      router.refresh()
      if (garminId) fetchReview()
    } finally {
      setPending(false)
    }
  }

  const verdictCfg = review ? (VERDICT_CONFIG[review.verdict] ?? VERDICT_CONFIG.good) : null

  return (
    <section aria-labelledby="garmin-title" className="space-y-3">
      <SectionLabel id="garmin-title">Activité Garmin liée</SectionLabel>

      {linked ? (
        /* ── Activité liée ── */
        <div className="flex items-start justify-between gap-3 rounded-xl border border-primary bg-accent p-4">
          <div className="flex min-w-0 items-start gap-3">
            <DisciplineIcon
              discipline={linked.activity_type}
              className="mt-0.5 size-5 shrink-0 text-primary-ink"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {linked.name ?? DISCIPLINE_LABEL[linked.activity_type] ?? 'Activité'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {formatDateTime(linked.started_at)} ·{' '}
                {fmt(linked.duration_s, linked.distance_m, linked.activity_type)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleLink(null)}
            disabled={pending}
            className="shrink-0"
          >
            Délier
          </Button>
        </div>
      ) : (
        /* ── Pas encore liée ── */
        <div>
          {!open ? (
            <Button variant="outline-primary" onClick={() => setOpen(true)} className="w-full">
              <Plus aria-hidden />
              Lier une activité Garmin
            </Button>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {candidates.length === 0 ? (
                <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                  Aucune activité Garmin trouvée à ±3 jours de cette séance.
                </p>
              ) : (
                <ul>
                  {candidates.map((c) => (
                    <li key={c.id} className="border-t border-border first:border-t-0">
                      <button
                        onClick={() => handleLink(c.id)}
                        disabled={pending}
                        className="flex w-full items-center gap-3 border-l-4 border-transparent px-4 py-3 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:border-primary focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50"
                      >
                        <DisciplineIcon
                          discipline={c.activity_type}
                          className="size-5 shrink-0 text-primary-ink"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {c.name ?? DISCIPLINE_LABEL[c.activity_type] ?? 'Activité'}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            {formatDateTime(c.started_at)} ·{' '}
                            {fmt(c.duration_s, c.distance_m, c.activity_type)}
                          </p>
                        </div>
                        <Link2 aria-hidden className="size-4 shrink-0 text-primary-ink" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-border px-2 py-1.5">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Retour du coach ── */}
      {linked && (
        <div className="space-y-2">
          {!review && !reviewLoading && !reviewError && (
            <Button variant="outline-primary" onClick={fetchReview} className="w-full">
              Demander le retour du coach
            </Button>
          )}

          {reviewLoading && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4"
            >
              <Loader2 aria-hidden className="size-4 text-primary-ink motion-safe:animate-spin" />
              <p className="text-sm text-muted-foreground">Le coach analyse ta séance…</p>
            </div>
          )}

          {reviewError && !reviewLoading && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">{reviewError}</p>
              <Button variant="ghost" size="sm" onClick={fetchReview} className="shrink-0">
                Réessayer
              </Button>
            </div>
          )}

          {review && !reviewLoading && verdictCfg && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] tracking-[0.06em] text-primary-ink uppercase">
                  Coach
                </span>
                <Badge
                  variant={verdictCfg.variant}
                  className={cn(
                    (verdictCfg.variant === 'default' || verdictCfg.variant === 'highlight') &&
                      'h-auto px-2.5 py-0.5 text-[13px] font-semibold',
                  )}
                >
                  {verdictCfg.label}
                </Badge>
              </div>
              <p className="border-l-4 border-primary pl-3.5 text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">
                {review.message}
              </p>
              <Button variant="link" size="sm" onClick={fetchReview} className="self-start px-0">
                Régénérer
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
