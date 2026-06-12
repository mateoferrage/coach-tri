import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Session {
  id: string
  title: string
  session_date: string
  discipline: string
  session_type: string
  duration_min: number
  expected_rpe: number | null
  status: string
  coaching_note: string | null
}

const DISCIPLINE_EMOJI: Record<string, string> = {
  swim: '🏊', bike: '🚴', run: '🏃', brick: '⚡', strength: '💪', rest: '😴',
}

const STATUS_STYLES: Record<string, string> = {
  planned: 'border-border bg-card hover:border-primary/50',
  done: 'border-green-500/30 bg-green-500/10',
  skipped: 'border-border bg-muted opacity-60',
  modified: 'border-yellow-500/30 bg-yellow-500/10',
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planifiée', done: 'Complétée', skipped: 'Passée', modified: 'Modifiée',
}

export function SessionCard({ session }: { session: Session }) {
  const emoji = DISCIPLINE_EMOJI[session.discipline] ?? '🏋️'
  const style = STATUS_STYLES[session.status] ?? STATUS_STYLES.planned
  const date = parseISO(session.session_date)

  return (
    <Link
      href={`/session/${session.id}`}
      className={`block rounded-xl border-2 p-4 transition-all ${style}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{emoji}</span>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{session.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(date, 'EEEE d MMM', { locale: fr })} · {session.duration_min} min
            </p>
          </div>
        </div>
        <Badge
          variant={session.status === 'done' ? 'default' : 'secondary'}
          className="shrink-0 text-xs"
        >
          {STATUS_LABELS[session.status] ?? session.status}
        </Badge>
      </div>
      {session.coaching_note && session.status === 'planned' && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">
          {session.coaching_note}
        </p>
      )}
    </Link>
  )
}
