import { intensityColor, type IntensitySurface } from '@/lib/theme'
import { formatDuration } from '@/lib/plan/display'
import type { EffortSegment } from '@/lib/plan/effort'
import { cn } from '@/lib/utils/cn'

interface EffortProfileProps {
  segments: EffortSegment[]
  durationMin: number
  surface?: IntensitySurface
}

const PART_LABEL = ['échauffement', 'corps de séance', 'retour au calme']

/** Barres du profil d'effort : largeur = durée, hauteur et couleur = zone. */
export function EffortProfile({ segments, durationMin, surface = 'white' }: EffortProfileProps) {
  if (segments.length === 0) return null
  const description = segments.map((s, i) => `${PART_LABEL[i] ?? 'bloc'} Z${s.zone}`).join(', ')
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="img"
        aria-label={`Profil d'effort : ${description}`}
        className="flex h-16 items-end gap-[3px]"
      >
        {segments.map((s, i) => (
          <span
            key={i}
            className="block min-w-1 rounded-t-[3px]"
            style={{
              flexGrow: s.share,
              flexBasis: 0,
              height: `${s.zone * 20}%`,
              backgroundColor: intensityColor(s.zone, surface),
            }}
          />
        ))}
      </div>
      <div
        className={cn(
          'flex justify-between font-mono text-[11px] font-semibold',
          surface === 'blue' ? 'text-primary-foreground' : 'text-muted-foreground',
        )}
      >
        <span>0</span>
        <span>{formatDuration(durationMin)}</span>
      </div>
    </div>
  )
}
