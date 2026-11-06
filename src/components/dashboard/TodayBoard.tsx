'use client'

import { useState } from 'react'
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
  const selected = rows.find((r) => r.session?.id === selectedId) ?? rows.find((r) => r.session)

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
      {selected?.session && (
        <SessionHero session={selected.session} isToday={selected.isToday} weekLabel={weekLabel} />
      )}
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
              onSelect={row.session ? () => setSelectedId(row.session!.id) : undefined}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
