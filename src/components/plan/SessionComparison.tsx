import { ArrowDown, ArrowUp, Check } from 'lucide-react'
import { SectionLabel } from '@/components/common/SectionLabel'
import type { ComparisonRow } from '@/lib/activities/compare'
import { cn } from '@/lib/utils/cn'

const VERDICT_TEXT: Record<ComparisonRow['key'], { over?: string; under?: string }> = {
  duration: { over: 'Plus long que prévu', under: 'Écourtée' },
  distance: {},
  hr: { over: 'Trop intense pour cette séance' },
  pace: { over: 'Trop rapide pour cette séance' },
  watts: { over: 'Trop intense pour cette séance' },
  elevation: { over: 'Plus de dénivelé que prévu', under: 'Moins de dénivelé que prévu' },
}

/** Prévu / réalisé d'une séance liée à une activité (calcul sans IA). */
export function SessionComparison({ rows }: { rows: ComparisonRow[] }) {
  if (!rows.length) return null
  const notes = [...new Set(rows.map((r) => r.note).filter(Boolean))] as string[]

  return (
    <section
      aria-labelledby="comparison-title"
      className="rounded-xl border border-border bg-card p-5"
    >
      <SectionLabel id="comparison-title">Prévu / réalisé</SectionLabel>
      <dl className="mt-3 divide-y divide-border text-sm">
        {rows.map((r) => {
          const warn = r.verdict === 'over' || r.verdict === 'under'
          const text = warn ? VERDICT_TEXT[r.key][r.verdict as 'over' | 'under'] : null
          return (
            <div key={r.key} className="flex items-start justify-between gap-3 py-2.5">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="text-right">
                <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                  {r.actual}
                  {r.verdict === 'ok' && (
                    <Check aria-label="conforme" className="size-4 text-primary-ink" />
                  )}
                  {r.verdict === 'over' && (
                    <ArrowUp aria-hidden className="size-4 text-highlight-deep" />
                  )}
                  {r.verdict === 'under' && (
                    <ArrowDown aria-hidden className="size-4 text-highlight-deep" />
                  )}
                </span>
                {r.planned && (
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    prévu {r.planned}
                  </span>
                )}
                {text && (
                  <span className={cn('block text-xs font-medium text-highlight-deep')}>
                    {text}
                  </span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
      {notes.map((n) => (
        <p key={n} className="mt-3 text-xs text-muted-foreground">
          {n}
        </p>
      ))}
    </section>
  )
}
