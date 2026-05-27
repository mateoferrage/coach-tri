const PHASE_COLORS: Record<string, string> = {
  prep:  'bg-zinc-400',
  base:  'bg-blue-500',
  build: 'bg-orange-500',
  peak:  'bg-red-500',
  taper: 'bg-green-500',
  race:  'bg-purple-600',
  maintenance: 'bg-teal-500',
}

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
              className={`${PHASE_COLORS[phase.phase] ?? 'bg-zinc-400'} transition-all`}
              style={{ width: `${widthPct}%` }}
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
                ? 'font-semibold text-zinc-900'
                : 'text-zinc-500'
            }`}
          >
            <div className={`h-2 w-2 rounded-full ${PHASE_COLORS[phase.phase] ?? 'bg-zinc-400'}`} />
            {PHASE_LABELS[phase.phase]} S{phase.start_week_num}–{phase.end_week_num}
          </div>
        ))}
      </div>
    </div>
  )
}
