import { ACCENT, GLACIER } from '@/lib/theme'

// Palette oklch alignée sur le design system (cf. theme.ts / globals.css --chart-*)
const PHASE_COLORS: Record<string, string> = {
  prep:  'oklch(0.72 0.04 252)',  // acier
  base:  'oklch(0.74 0.13 233)',  // bleu glacier
  build: 'oklch(0.82 0.15 78)',   // ambre
  peak:  'oklch(0.65 0.20 25)',   // rouge effort
  taper: ACCENT,                  // vert menthe
  race:  'oklch(0.78 0.18 300)',  // violet course
  maintenance: GLACIER,           // teal
}
const PHASE_FALLBACK = 'oklch(0.60 0.02 252)'

const PHASE_LABELS: Record<string, string> = {
  prep: 'Prépa', base: 'Base', build: 'Construction',
  peak: 'Pic', taper: 'Affûtage', race: 'Course', maintenance: 'Maintien',
}

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
  return (
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-3">
        {phases.map((phase) => {
          const widthPct = ((phase.end_week_num - phase.start_week_num + 1) / total_weeks) * 100
          return (
            <div
              key={`${phase.phase}-${phase.start_week_num}`}
              className="transition-all"
              style={{
                width: `${widthPct}%`,
                backgroundColor: PHASE_COLORS[phase.phase] ?? PHASE_FALLBACK,
              }}
              title={`${PHASE_LABELS[phase.phase]} (S${phase.start_week_num}–S${phase.end_week_num})`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {phases.map((phase) => (
          <div
            key={`${phase.phase}-${phase.start_week_num}`}
            className={`flex items-center gap-1.5 text-xs ${
              current_week >= phase.start_week_num && current_week <= phase.end_week_num
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: PHASE_COLORS[phase.phase] ?? PHASE_FALLBACK }}
            />
            {PHASE_LABELS[phase.phase]} S{phase.start_week_num}–{phase.end_week_num}
          </div>
        ))}
      </div>
    </div>
  )
}
