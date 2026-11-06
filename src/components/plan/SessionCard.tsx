import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Check } from 'lucide-react'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { DISCIPLINE_LABEL, formatDuration, sessionTitle } from '@/lib/plan/display'
import { cn } from '@/lib/utils/cn'

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
  planned_tss?: number | null
}

function StatusTag({ status }: { status: string }) {
  if (status === 'done')
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-primary-ink">
        <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check size={11} strokeWidth={3} aria-hidden />
        </span>
        Faite
      </span>
    )
  if (status === 'modified')
    return <span className="text-xs font-bold text-highlight-deep">Modifiée</span>
  if (status === 'skipped')
    return <span className="text-xs font-semibold text-muted-foreground">Sautée</span>
  return <span className="text-xs font-semibold text-muted-foreground">Prévue</span>
}

export function SessionCard({ session }: { session: Session }) {
  const date = parseISO(session.session_date)
  const meta = [
    DISCIPLINE_LABEL[session.discipline] ?? session.discipline,
    session.duration_min ? formatDuration(session.duration_min) : null,
    session.planned_tss ? `${session.planned_tss} TSS` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="border-t border-border first:border-t-0">
      <Link
        href={`/session/${session.id}`}
        className={cn(
          'relative grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted',
          'before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full',
          session.status === 'done' ? 'before:bg-primary' : 'before:bg-transparent',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        )}
      >
        <span className="flex flex-col pl-2 text-[11px] leading-tight font-medium text-muted-foreground capitalize">
          {format(date, 'EEE', { locale: fr })}
          <b className="font-display text-xl font-bold text-foreground">{format(date, 'd')}</b>
        </span>
        <span className="flex min-w-0 flex-col">
          <b
            className={cn(
              'truncate text-sm font-bold',
              session.status === 'skipped' && 'text-muted-foreground',
            )}
          >
            {sessionTitle(session)}
          </b>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DisciplineIcon discipline={session.discipline} size={13} />
            {meta}
          </span>
          {session.coaching_note && session.status === 'planned' && (
            <span className="mt-1 line-clamp-2 text-xs text-muted-foreground italic">
              {session.coaching_note}
            </span>
          )}
        </span>
        <StatusTag status={session.status} />
      </Link>
    </li>
  )
}
