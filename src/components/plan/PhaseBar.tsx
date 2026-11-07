import { PHASE_LABEL } from '@/lib/plan/display'
import { cn } from '@/lib/utils/cn'

interface Phase {
  phase: string
  start_week_num: number
  end_week_num: number
  focus: string
}

interface PhaseBarProps {
  phases: Phase[]
  total_weeks: number
  current_week: number
}

export function PhaseBar({ phases, total_weeks, current_week }: PhaseBarProps) {
  const isCurrent = (phase: Phase) =>
    current_week >= phase.start_week_num && current_week <= phase.end_week_num
  const markerPct =
    total_weeks > 0 ? Math.min(100, Math.max(0, ((current_week - 0.5) / total_weeks) * 100)) : 0

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {phases.map((phase) => {
            const widthPct = ((phase.end_week_num - phase.start_week_num + 1) / total_weeks) * 100
            const label = PHASE_LABEL[phase.phase] ?? phase.phase
            return (
              <div
                key={`${phase.phase}-${phase.start_week_num}`}
                className={cn(
                  'border-r-2 border-background last:border-r-0',
                  isCurrent(phase) ? 'bg-primary' : 'bg-primary/25',
                )}
                style={{ width: `${widthPct}%` }}
                title={`${label} (S${phase.start_week_num}–S${phase.end_week_num})`}
              />
            )
          })}
        </div>
        {total_weeks > 0 && (
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-highlight"
            style={{ left: `${markerPct}%` }}
            title={`Semaine ${current_week} en cours`}
            aria-hidden
          />
        )}
      </div>
      <p className="sr-only">
        Semaine {current_week} sur {total_weeks}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {phases.map((phase) => (
          <li
            key={`${phase.phase}-${phase.start_week_num}`}
            className={cn(
              'text-xs font-semibold',
              isCurrent(phase) ? 'text-primary-ink' : 'text-muted-foreground',
            )}
            aria-current={isCurrent(phase) ? 'step' : undefined}
          >
            {PHASE_LABEL[phase.phase] ?? phase.phase}{' '}
            <span className="font-medium tabular-nums">
              S{phase.start_week_num}–{phase.end_week_num}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
