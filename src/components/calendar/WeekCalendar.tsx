'use client'

import { useState, useEffect, useRef } from 'react'
import { addDays, addWeeks, subWeeks, startOfWeek, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { EventModal } from './EventModal'
import { Button } from '@/components/ui/button'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { cn } from '@/lib/utils/cn'
import type { CalendarEvent, ScheduleEventInput } from '@/lib/schemas/schedule'
import {
  HOUR_PX,
  START_HOUR,
  END_HOUR,
  topPx,
  heightPx,
  assignColumns,
} from '@/lib/calendar/layout'
import { timeToFrac } from '@/lib/calendar/time'
import { DISCIPLINE_LABEL } from '@/lib/plan/display'
import { eventTypeColor, eventTypeLabel, withAlpha } from '@/lib/theme'

interface TrainingSession {
  id: string
  title: string | null
  discipline: string
  session_type: string
  session_date: string
  duration_min: number
  status: string
  day_part: string | null
  session_time: string | null // HH:MM — set after drag-and-drop
}

const DAY_PART_HOUR: Record<string, number> = {
  morning: 7,
  midday: 12,
  evening: 18,
}

// A positioned block in a day column — either a personal event or a training session.
type Block =
  | { kind: 'event'; ev: CalendarEvent; start: number; end: number }
  | { kind: 'session'; sess: TrainingSession; start: number; end: number }

export function WeekCalendar() {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [clickedDate, setClickedDate] = useState<string | undefined>()
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [nowFrac, setNowFrac] = useState<number | null>(null)
  const [todayIdx, setTodayIdx] = useState<number | null>(null)
  // Drag & drop (desktop)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [dropTarget, setDropTarget] = useState<{ date: string; hour: number } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const weekStartStr = format(weekStart, 'yyyy-MM-dd')

  useEffect(() => {
    function tick() {
      const now = new Date()
      const todayStr = format(now, 'yyyy-MM-dd')
      const days = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'))
      const idx = days.indexOf(todayStr)
      setTodayIdx(idx === -1 ? null : idx)
      setNowFrac(idx === -1 ? null : now.getHours() + now.getMinutes() / 60)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [weekStart])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const end = format(addDays(weekStart, 6), 'yyyy-MM-dd')
        const [evRes, sessRes] = await Promise.all([
          fetch(`/api/schedule?week_start=${weekStartStr}`),
          fetch(`/api/sessions?start=${weekStartStr}&end=${end}&fields=session_time`),
        ])
        if (!evRes.ok || !sessRes.ok) throw new Error('fetch failed')
        const [evJson, sessJson] = await Promise.all([evRes.json(), sessRes.json()])
        if (cancelled) return
        setCalEvents(evJson)
        setSessions(sessJson)
      } catch {
        if (cancelled) return
        setError('Impossible de charger le calendrier.')
        toast.error('Impossible de charger le calendrier.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [weekStart, weekStartStr, reloadKey])

  // Auto-scroll: position the grid at current hour (−1h buffer) on week change
  useEffect(() => {
    if (!gridRef.current) return
    const h = Math.max(new Date().getHours() - 1, START_HOUR)
    gridRef.current.scrollTo({ top: (h - START_HOUR) * HOUR_PX, behavior: 'instant' })
  }, [weekStartStr])

  async function refreshEvents() {
    const res = await fetch(`/api/schedule?week_start=${weekStartStr}`)
    if (res.ok) setCalEvents(await res.json())
    else toast.error('Impossible de rafraîchir les événements.')
  }

  async function handleSave(data: ScheduleEventInput) {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Erreur serveur')
    }
    await refreshEvents()
  }

  async function handleUpdate(data: ScheduleEventInput) {
    if (!editingEvent) return
    const res = await fetch(`/api/schedule/${editingEvent.source_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Erreur serveur')
    }
    await refreshEvents()
  }

  async function handleDelete(sourceId: string) {
    const res = await fetch(`/api/schedule/${sourceId}`, { method: 'DELETE' })
    if (!res.ok) toast.error("Impossible de supprimer l'événement.")
    setEditingEvent(null)
    await refreshEvents()
  }

  async function handleMoveSession(sessId: string, newDate: string, newHour: number) {
    const timeStr = `${String(newHour).padStart(2, '0')}:00`
    const dayPart = newHour < 12 ? 'morning' : newHour < 17 ? 'midday' : 'evening'
    const previous = sessions

    // Optimistic UI update
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessId
          ? { ...s, session_date: newDate, session_time: timeStr, day_part: dayPart }
          : s,
      ),
    )

    try {
      const res = await fetch(`/api/sessions/${sessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_date: newDate, session_time: timeStr, day_part: dayPart }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setSessions(previous) // rollback de la mise à jour optimiste
      toast.error('Impossible de déplacer la séance.')
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)
  const isEmpty = !loading && !error && calEvents.length === 0 && sessions.length === 0

  // Horizontal geometry from column assignment (side-by-side overlap layout).
  function colStyle(col: number, cols: number) {
    const widthPct = 100 / cols
    return {
      left: `calc(${col * widthPct}% + 3px)`,
      width: `calc(${widthPct}% - 6px)`,
    }
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 0, flex: 1 }}>
      {/* ── Controls ── */}
      <div className="mb-4 flex flex-shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setWeekStart((w) => subWeeks(w, 1))}
            aria-label="Semaine précédente"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="min-w-[180px] px-2 text-center text-sm font-semibold text-foreground tabular-nums">
            {format(weekStart, 'd MMM', { locale: fr })} –{' '}
            {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: fr })}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            aria-label="Semaine suivante"
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ml-1"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Aujourd&apos;hui
          </Button>
        </div>

        <Button
          variant="highlight"
          onClick={() => {
            setClickedDate(undefined)
            setShowModal(true)
          }}
        >
          <Plus aria-hidden />
          Ajouter
        </Button>
      </div>

      {/* ── Legend (par statut) ── */}
      <div className="mb-4 flex flex-shrink-0 flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-4 rounded-sm border-l-4 border-primary bg-accent" />
          Séance
        </div>
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-4 rounded-sm bg-primary-ink" />
          Faite
        </div>
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-3 w-4 rounded-sm border-l-4 border-muted-foreground bg-muted"
          />
          Événement perso
        </div>
        {loading && <span className="ml-auto">Chargement…</span>}
      </div>

      {/* ── Grid ── */}
      <div
        ref={gridRef}
        className="relative overflow-y-auto rounded-xl border border-border bg-card"
        style={{ flex: 1, minHeight: 0 }}
      >
        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-card/90">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              Réessayer
            </Button>
          </div>
        )}

        {isEmpty && (
          <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center">
            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Aucun créneau cette semaine
            </span>
          </div>
        )}

        <div className="bg-card" style={{ minWidth: 640 }}>
          {/* Day headers — sticky */}
          <div
            className="sticky top-0 z-10 grid border-b border-border bg-card"
            style={{ gridTemplateColumns: '44px repeat(7, 1fr)' }}
          >
            <div />
            {days.map((day, i) => {
              const dStr = format(day, 'yyyy-MM-dd')
              const isToday = dStr === todayStr
              return (
                <div key={i} className="px-1 pt-2.5 pb-2 text-center">
                  <div
                    className={cn(
                      'text-xs font-semibold',
                      isToday ? 'text-highlight-deep' : 'text-muted-foreground',
                    )}
                  >
                    {format(day, 'EEE', { locale: fr })}
                  </div>
                  <div
                    className={cn(
                      'mx-auto mt-1 flex size-8 items-center justify-center rounded-full font-display text-xl leading-none font-bold tabular-nums',
                      isToday ? 'bg-highlight text-highlight-foreground' : 'text-foreground',
                    )}
                    aria-current={isToday ? 'date' : undefined}
                  >
                    {format(day, 'd')}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Body: time column + 7 day columns */}
          <div className="flex bg-card">
            {/* Time labels */}
            <div className="flex-shrink-0 border-r border-border bg-card" style={{ width: 44 }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="border-b border-border/60 pt-1 pr-2 text-right text-[11px] font-medium text-muted-foreground tabular-nums select-none"
                  style={{ height: HOUR_PX }}
                >
                  {h}h
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, colIdx) => {
              const dStr = format(day, 'yyyy-MM-dd')
              const dayCalEvs = calEvents.filter((e) => e.date === dStr)
              const daySessions = sessions.filter((s) => s.session_date === dStr)

              const blocks: Block[] = [
                ...dayCalEvs.map((ev) => ({
                  kind: 'event' as const,
                  ev,
                  start: timeToFrac(ev.start_time),
                  end: timeToFrac(ev.end_time),
                })),
                ...daySessions.map((sess) => {
                  const start = sess.session_time
                    ? timeToFrac(sess.session_time)
                    : (DAY_PART_HOUR[sess.day_part ?? ''] ?? 7)
                  return {
                    kind: 'session' as const,
                    sess,
                    start,
                    end: start + (sess.duration_min ?? 60) / 60,
                  }
                }),
              ]
              const placed = assignColumns(
                blocks,
                (b) => b.start,
                (b) => b.end,
              )

              return (
                <div
                  key={colIdx}
                  className={cn('relative flex-1 bg-card', colIdx < 6 && 'border-r border-border')}
                >
                  {/* Background hour slots — also drop targets */}
                  {hours.map((h) => {
                    const isDropTarget = dropTarget?.date === dStr && dropTarget?.hour === h
                    return (
                      <div
                        key={h}
                        onClick={() => {
                          setClickedDate(dStr)
                          setShowModal(true)
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setDropTarget({ date: dStr, hour: h })
                        }}
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setDropTarget(null)
                          const id = draggingId
                          if (id) handleMoveSession(id, dStr, h)
                        }}
                        className={cn(
                          'cursor-pointer border-b border-border/60 transition-colors duration-100',
                          isDropTarget
                            ? 'bg-accent outline outline-1 outline-primary/40'
                            : h % 2 === 0
                              ? 'bg-card'
                              : 'bg-muted/45',
                        )}
                        style={{ height: HOUR_PX }}
                      />
                    )
                  })}

                  {/* Now line */}
                  {todayIdx === colIdx && nowFrac !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-highlight"
                      style={{ top: topPx(nowFrac) }}
                    >
                      <div className="absolute -top-[3px] -left-1 size-2 rounded-full bg-highlight" />
                    </div>
                  )}

                  {/* Blocks: events + sessions, laid out side-by-side on overlap */}
                  {placed.map((p) => {
                    const horiz = colStyle(p.col, p.cols)
                    if (p.item.kind === 'event') {
                      const ev = p.item.ev
                      const color = eventTypeColor(ev.event_type)
                      return (
                        <div
                          key={ev.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`${ev.title}, ${ev.start_time}–${ev.end_time}, ${eventTypeLabel(ev.event_type)} — modifier`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingEvent(ev)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setEditingEvent(ev)
                            }
                          }}
                          className="absolute z-[3] flex cursor-pointer flex-col gap-px overflow-hidden rounded-md px-1.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{
                            top: topPx(p.item.start),
                            height: heightPx(p.item.start, p.item.end),
                            ...horiz,
                            // Couleur selon le type d'événement : seul style inline de couleur.
                            backgroundColor: withAlpha(color, 10),
                            borderLeft: `3px solid ${color}`,
                            color,
                          }}
                        >
                          <div className="truncate text-[11px] leading-tight font-bold">
                            {ev.title}
                          </div>
                          <div className="truncate text-[10px] font-medium tabular-nums">
                            {ev.start_time}–{ev.end_time} · {eventTypeLabel(ev.event_type)}
                          </div>
                        </div>
                      )
                    }

                    const sess = p.item.sess
                    const label = DISCIPLINE_LABEL[sess.discipline] ?? 'Séance'
                    const isDragging = draggingId === sess.id
                    const isDone = sess.status === 'done'
                    const isToday = sess.session_date === todayStr
                    return (
                      <div
                        key={sess.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(sess.id)
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', sess.id)
                        }}
                        onDragEnd={() => {
                          setDraggingId(null)
                          setDropTarget(null)
                        }}
                        className={cn(
                          'absolute z-[4] flex cursor-grab flex-col gap-px overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 transition-opacity duration-150',
                          isDone
                            ? 'bg-primary-ink font-bold text-primary-foreground'
                            : 'bg-accent text-foreground',
                          isToday
                            ? 'border-highlight'
                            : isDone
                              ? 'border-primary-ink'
                              : 'border-primary',
                          isDragging && 'opacity-40',
                        )}
                        style={{
                          top: topPx(p.item.start),
                          height: heightPx(p.item.start, p.item.end),
                          ...horiz,
                        }}
                      >
                        <a
                          href={`/session/${sess.id}`}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`${sess.title ?? label}, ${sess.duration_min} minutes — voir la séance`}
                          className={cn(
                            'flex min-w-0 items-center gap-1 rounded-sm text-[11px] leading-tight font-bold text-inherit no-underline outline-none focus-visible:ring-2',
                            isDone
                              ? 'focus-visible:ring-primary-foreground'
                              : 'focus-visible:ring-ring',
                          )}
                        >
                          <DisciplineIcon
                            discipline={sess.discipline}
                            className="size-3 shrink-0"
                          />
                          <span className="truncate">{sess.title ?? label}</span>
                        </a>
                        <div
                          className={cn(
                            'truncate text-[10px] tabular-nums',
                            isDone ? 'font-semibold' : 'font-medium text-muted-foreground',
                          )}
                        >
                          {sess.session_time ? `${sess.session_time.slice(0, 5)} · ` : ''}
                          {sess.duration_min} min · {label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showModal && (
        <EventModal
          initialDate={clickedDate}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      {editingEvent && (
        <EventModal
          initialEvent={editingEvent}
          onSave={handleUpdate}
          onDelete={() => handleDelete(editingEvent.source_id)}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  )
}
