'use client'

import { useState, useEffect, useRef } from 'react'
import { addDays, addWeeks, subWeeks, startOfWeek, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { EventModal } from './EventModal'
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
import {
  DISCIPLINE,
  disciplineColor,
  EVENT_TYPE,
  eventTypeColor,
  eventTypeLabel,
  withAlpha,
  SURFACE,
  SURFACE_DEEP,
  DIVIDER,
  TEXT,
  TEXT_MUTED,
  TEXT_FAINT,
  ACCENT,
  ACCENT_FG,
} from '@/lib/theme'

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

  const navBtnStyle = {
    backgroundColor: SURFACE,
    border: `1px solid ${DIVIDER}`,
    color: TEXT,
  } as const

  return (
    <div className="flex flex-col" style={{ minHeight: 0, flex: 1 }}>
      {/* ── Controls ── */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => subWeeks(w, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
            style={navBtnStyle}
            aria-label="Semaine précédente"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span
            className="text-sm font-medium px-2"
            style={{ color: TEXT, minWidth: 180, textAlign: 'center' }}
          >
            {format(weekStart, 'd MMM', { locale: fr })} –{' '}
            {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: fr })}
          </span>
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
            style={navBtnStyle}
            aria-label="Semaine suivante"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="ml-1 text-xs px-3 py-1.5 rounded-lg font-bold transition-opacity hover:opacity-70"
            style={{ backgroundColor: SURFACE, border: `1px solid ${DIVIDER}`, color: TEXT_MUTED }}
          >
            Aujourd&apos;hui
          </button>
        </div>

        <button
          onClick={() => {
            setClickedDate(undefined)
            setShowModal(true)
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-90"
          style={{ backgroundColor: ACCENT, color: ACCENT_FG }}
        >
          <span className="text-base leading-none">+</span> Ajouter
        </button>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4 flex-shrink-0">
        {(['swim', 'bike', 'run'] as const).map((d) => (
          <div key={d} className="flex items-center gap-1.5 text-xs" style={{ color: TEXT_MUTED }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: disciplineColor(d) }} />{' '}
            {DISCIPLINE[d].label}
          </div>
        ))}
        <div className="w-px h-4 mx-1" style={{ backgroundColor: DIVIDER }} />
        {(['cours', 'stage', 'rdv', 'autre'] as const).map((t) => (
          <div key={t} className="flex items-center gap-1.5 text-xs" style={{ color: TEXT_MUTED }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: eventTypeColor(t) }} />{' '}
            {EVENT_TYPE[t].label}
          </div>
        ))}
        {loading && (
          <span className="text-xs ml-auto" style={{ color: TEXT_MUTED }}>
            Chargement…
          </span>
        )}
      </div>

      {/* ── Grid ── */}
      <div
        ref={gridRef}
        className="overflow-y-auto rounded-xl relative"
        style={{ flex: 1, minHeight: 0, border: `1px solid ${DIVIDER}`, backgroundColor: SURFACE }}
      >
        {error && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
            style={{ backgroundColor: withAlpha(SURFACE, 90) }}
          >
            <p className="text-sm font-medium" style={{ color: TEXT }}>
              {error}
            </p>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="text-xs px-4 py-2 rounded-lg font-bold uppercase tracking-widest transition-opacity hover:opacity-90"
              style={{ backgroundColor: ACCENT, color: ACCENT_FG }}
            >
              Réessayer
            </button>
          </div>
        )}

        {isEmpty && (
          <div className="absolute inset-x-0 top-20 z-10 flex justify-center pointer-events-none">
            <span
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ backgroundColor: SURFACE_DEEP, color: TEXT_MUTED }}
            >
              Aucun créneau cette semaine
            </span>
          </div>
        )}

        <div style={{ minWidth: 640, backgroundColor: SURFACE }}>
          {/* Day headers — sticky */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: '44px repeat(7, 1fr)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: SURFACE,
              borderBottom: `1px solid ${DIVIDER}`,
            }}
          >
            <div />
            {days.map((day, i) => {
              const dStr = format(day, 'yyyy-MM-dd')
              const isToday = dStr === todayStr
              return (
                <div key={i} style={{ textAlign: 'center', padding: '10px 4px 8px' }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: TEXT_MUTED,
                    }}
                  >
                    {format(day, 'EEE', { locale: fr })}
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      lineHeight: 1,
                      marginTop: 4,
                      color: isToday ? ACCENT_FG : TEXT,
                      backgroundColor: isToday ? ACCENT : 'transparent',
                      borderRadius: '50%',
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '4px auto 0',
                    }}
                  >
                    {format(day, 'd')}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Body: time column + 7 day columns */}
          <div className="flex" style={{ backgroundColor: SURFACE }}>
            {/* Time labels */}
            <div
              style={{
                width: 44,
                flexShrink: 0,
                backgroundColor: SURFACE,
                borderRight: `1px solid ${DIVIDER}`,
              }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  style={{
                    height: HOUR_PX,
                    fontSize: 11,
                    fontWeight: 500,
                    color: TEXT_FAINT,
                    textAlign: 'right',
                    paddingRight: 8,
                    paddingTop: 4,
                    borderBottom: `1px solid ${withAlpha(TEXT, 6)}`,
                    userSelect: 'none',
                  }}
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
                  style={{
                    flex: 1,
                    position: 'relative',
                    backgroundColor: SURFACE,
                    borderRight: colIdx < 6 ? `1px solid ${DIVIDER}` : 'none',
                  }}
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
                        style={{
                          height: HOUR_PX,
                          borderBottom: `1px solid ${withAlpha(TEXT, 6)}`,
                          backgroundColor: isDropTarget
                            ? withAlpha(ACCENT, 10)
                            : h % 2 === 0
                              ? SURFACE
                              : withAlpha(SURFACE_DEEP, 45),
                          outline: isDropTarget ? `1px solid ${withAlpha(ACCENT, 40)}` : 'none',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s',
                        }}
                      />
                    )
                  })}

                  {/* Now line */}
                  {todayIdx === colIdx && nowFrac !== null && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: topPx(nowFrac),
                        height: 2,
                        backgroundColor: ACCENT,
                        zIndex: 5,
                        pointerEvents: 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: ACCENT,
                          position: 'absolute',
                          left: -4,
                          top: -3,
                        }}
                      />
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
                          style={{
                            position: 'absolute',
                            top: topPx(p.item.start),
                            height: heightPx(p.item.start, p.item.end),
                            ...horiz,
                            borderRadius: 6,
                            padding: '2px 6px',
                            backgroundColor: withAlpha(color, 14),
                            borderLeft: `3px solid ${color}`,
                            color: TEXT,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            overflow: 'hidden',
                            zIndex: 3,
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              lineHeight: 1.2,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {ev.title}
                          </div>
                          <div
                            className="flex items-center gap-1"
                            style={{
                              fontSize: 10,
                              color: TEXT_MUTED,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: color,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ev.start_time}–{ev.end_time} · {eventTypeLabel(ev.event_type)}
                            </span>
                          </div>
                        </div>
                      )
                    }

                    const sess = p.item.sess
                    const color = disciplineColor(sess.discipline)
                    const label = DISCIPLINE[sess.discipline]?.label ?? 'Séance'
                    const isDragging = draggingId === sess.id
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
                        style={{
                          position: 'absolute',
                          top: topPx(p.item.start),
                          height: heightPx(p.item.start, p.item.end),
                          ...horiz,
                          borderRadius: 6,
                          padding: '2px 6px',
                          backgroundColor: withAlpha(color, 14),
                          borderLeft: `3px solid ${color}`,
                          color: TEXT,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                          overflow: 'hidden',
                          zIndex: 4,
                          opacity: isDragging ? 0.4 : sess.status === 'done' ? 0.55 : 1,
                          cursor: 'grab',
                          transition: 'opacity 0.15s',
                        }}
                      >
                        <a
                          href={`/session/${sess.id}`}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`${sess.title ?? label}, ${sess.duration_min} minutes — voir la séance`}
                          style={{
                            color: 'inherit',
                            textDecoration: 'none',
                            fontSize: 11,
                            fontWeight: 700,
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {sess.title ?? label}
                        </a>
                        <div
                          className="flex items-center gap-1"
                          style={{
                            fontSize: 10,
                            color: TEXT_MUTED,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: color,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sess.session_time ? `${sess.session_time.slice(0, 5)} · ` : ''}
                            {sess.duration_min} min · {label}
                          </span>
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
