'use client'

import { useRef, useState } from 'react'
import { SectionLabel } from '@/components/common/SectionLabel'
import { DayRow } from '@/components/plan/DayRow'
import { SessionHero } from '@/components/plan/SessionHero'
import type { WeekRow } from '@/lib/plan/week-summary'

interface TodayBoardProps {
  rows: WeekRow[]
  defaultSessionId: string
  /** « Semaine 1 sur 27 · Préparation » */
  weekLabel: string
  /** « du 2 au 8 novembre » */
  weekRange: string
}

/** Carte de la séance sélectionnée + liste de la semaine ; un clic sur un jour change la carte. */
export function TodayBoard({ rows, defaultSessionId, weekLabel, weekRange }: TodayBoardProps) {
  const [selectedId, setSelectedId] = useState(defaultSessionId)
  const heroRef = useRef<HTMLDivElement>(null)
  const selected = rows.find((r) => r.session?.id === selectedId) ?? rows.find((r) => r.session)

  function select(id: string) {
    setSelectedId(id)
    // Sous lg, la carte est au-dessus de la liste : on la ramène à l'écran.
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      heroRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
      <div ref={heroRef} aria-live="polite" className="scroll-mt-20">
        {selected?.session && (
          <SessionHero
            session={selected.session}
            isToday={selected.isToday}
            weekLabel={weekLabel}
          />
        )}
      </div>
      <section
        aria-labelledby="week-title"
        className="rounded-xl border border-border px-2 pt-4 pb-2"
      >
        <SectionLabel id="week-title" className="mb-2 px-3">
          Cette semaine{' '}
          <span className="font-semibold tracking-normal text-muted-foreground normal-case">
            · {weekRange}
          </span>
        </SectionLabel>
        <ul>
          {rows.map((row) => (
            <DayRow
              key={row.key}
              row={row}
              selected={!!row.session && row.session.id === selected?.session?.id}
              onSelect={
                row.session && row.session.discipline !== 'rest'
                  ? () => select(row.session!.id)
                  : undefined
              }
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
