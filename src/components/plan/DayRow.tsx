import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Check } from 'lucide-react'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { DISCIPLINE_LABEL, formatDuration, sessionTitle } from '@/lib/plan/display'
import type { DayStatus, WeekRow } from '@/lib/plan/week-summary'
import { cn } from '@/lib/utils/cn'

interface DayRowProps {
  row: WeekRow
  selected?: boolean
  onSelect?: () => void
}

const MARKER: Record<DayStatus, string> = {
  done: 'before:bg-primary',
  today: 'before:bg-highlight',
  missed: 'before:bg-border',
  planned: 'before:bg-transparent',
  rest: 'before:bg-transparent',
}

function StatusTag({ status }: { status: DayStatus }) {
  if (status === 'done')
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-primary-ink">
        <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check size={11} strokeWidth={3} aria-hidden />
        </span>
        Faite
      </span>
    )
  if (status === 'today')
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-highlight-deep">
        <span className="size-2.5 rounded-full bg-highlight" aria-hidden />À faire
      </span>
    )
  const label = status === 'missed' ? 'Manquée' : status === 'planned' ? 'Prévue' : 'Repos'
  return <span className="text-xs font-semibold text-muted-foreground">{label}</span>
}

export function DayRow({ row, selected = false, onSelect }: DayRowProps) {
  const date = parseISO(row.date)
  const s = row.session
  const meta = s
    ? [
        DISCIPLINE_LABEL[s.discipline] ?? s.discipline,
        s.duration_min ? formatDuration(s.duration_min) : null,
        s.planned_tss ? `${s.planned_tss} TSS` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Récupération'

  const body = (
    <>
      <span className="flex flex-col pl-2 text-[11px] leading-tight font-medium text-muted-foreground capitalize">
        {format(date, 'EEE', { locale: fr })}
        <b
          className={cn(
            'font-display text-xl font-bold text-foreground',
            row.isToday && 'text-highlight-deep',
          )}
        >
          {format(date, 'd')}
        </b>
      </span>
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-sm font-bold">{s ? sessionTitle(s) : 'Repos'}</b>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {s && <DisciplineIcon discipline={s.discipline} size={13} />}
          {meta}
        </span>
      </span>
      <StatusTag status={row.status} />
    </>
  )

  const cls = cn(
    'relative grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left',
    'before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full',
    MARKER[row.status],
    selected && 'bg-accent',
  )

  return (
    <li className="border-t border-border first:border-t-0">
      {s && s.discipline !== 'rest' && onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected ? 'true' : undefined}
          className={cn(
            cls,
            'cursor-pointer rounded-md transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
            !selected && 'hover:bg-muted',
          )}
        >
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}
