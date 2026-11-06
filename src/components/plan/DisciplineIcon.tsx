import {
  Bike,
  Dumbbell,
  Footprints,
  Moon,
  Waves,
  Zap,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  swim: Waves,
  bike: Bike,
  run: Footprints,
  brick: Zap,
  strength: Dumbbell,
  rest: Moon,
}

/** Icône de discipline (remplace les emoji). Décorative : le libellé est toujours à côté. */
export function DisciplineIcon({ discipline, ...props }: { discipline: string } & LucideProps) {
  const Icon = ICONS[discipline] ?? Zap
  return <Icon aria-hidden {...props} />
}
