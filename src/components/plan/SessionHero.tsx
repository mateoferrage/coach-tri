import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { buttonVariants } from '@/components/ui/button'
import { AskCoachButton } from '@/components/coach/AskCoachButton'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { EffortProfile } from '@/components/plan/EffortProfile'
import { DISCIPLINE_LABEL, sessionTitle } from '@/lib/plan/display'
import { effortSegments } from '@/lib/plan/effort'
import type { DashboardSession } from '@/lib/plan/week-summary'
import { cn } from '@/lib/utils/cn'

interface SessionHeroProps {
  session: DashboardSession
  isToday: boolean
  /** Ex. « Semaine 1 sur 27 · Préparation ». */
  weekLabel: string
  variant?: 'blue' | 'white'
}

export function SessionHero({ session, isToday, weekLabel, variant = 'blue' }: SessionHeroProps) {
  const blue = variant === 'blue'
  const segments = effortSegments(session)
  const maxZone = segments.length ? Math.max(...segments.map((s) => s.zone)) : null
  const title = sessionTitle(session)
  const stats = [
    { label: 'minutes', value: session.duration_min || '—' },
    { label: 'TSS', value: session.planned_tss ?? '—' },
    { label: 'zone max', value: maxZone ? `Z${maxZone}` : '—' },
  ]

  return (
    <section
      aria-label="Séance sélectionnée"
      className={cn(
        'flex flex-col gap-5 rounded-xl p-6',
        blue ? 'bg-primary text-primary-foreground' : 'border border-border bg-card',
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 text-[13px] font-semibold">
        {isToday ? (
          <span className="rounded-full bg-highlight px-3 py-1 text-xs font-bold text-highlight-foreground">
            Aujourd&apos;hui
          </span>
        ) : (
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold capitalize',
              blue ? 'bg-card text-foreground' : 'bg-accent text-primary-ink',
            )}
          >
            {format(parseISO(session.session_date), 'EEE d MMM', { locale: fr })}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <DisciplineIcon discipline={session.discipline} size={15} strokeWidth={2.2} />
          {DISCIPLINE_LABEL[session.discipline] ?? session.discipline} · {weekLabel}
        </span>
      </div>

      <div>
        <h2
          className={cn(
            'text-4xl leading-[0.95] tracking-[-0.03em] [font-stretch:118%] md:text-5xl',
            !blue && 'text-primary',
          )}
        >
          {title}
        </h2>
        {session.coaching_note && (
          <p
            className={cn(
              'mt-3 max-w-[46ch] text-base',
              blue ? 'font-semibold' : 'text-muted-foreground',
            )}
          >
            {session.coaching_note}
          </p>
        )}
      </div>

      <dl className="grid max-w-sm grid-cols-3 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="flex flex-col-reverse gap-1">
            <dt className={cn('text-[13px] font-semibold', !blue && 'text-muted-foreground')}>
              {label}
            </dt>
            <dd className="font-display text-4xl leading-none font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <EffortProfile
        segments={segments}
        durationMin={session.duration_min}
        surface={blue ? 'blue' : 'white'}
      />

      <div className="flex flex-wrap gap-2.5">
        <Link
          href={`/session/${session.id}`}
          className={buttonVariants({ variant: 'highlight', size: 'lg' })}
        >
          Voir la séance
        </Link>
        <AskCoachButton
          prefill={`À propos de ma séance « ${title} » : `}
          tone={blue ? 'blue' : 'white'}
        />
      </div>
    </section>
  )
}
