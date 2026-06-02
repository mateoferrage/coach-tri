"use client";

import { useState, useEffect, useRef } from "react";
import { addDays, addWeeks, subWeeks, startOfWeek, format, getISODay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { EventModal } from "./EventModal";
import type { CalendarEvent, ScheduleEventInput } from "@/lib/schemas/schedule";

const MINT   = "oklch(0.843 0.165 157)";
const DARK   = "oklch(0.116 0.022 155)";
const CARD   = "oklch(0.14 0.022 155)";
const BORDER = "oklch(1 0 0 / 8%)";
const MUTED  = "oklch(1 0 0 / 40%)";

const HOUR_PX    = 56;
const START_HOUR = 6;
const END_HOUR   = 22;

interface TrainingSession {
  id: string;
  title: string | null;
  discipline: string;
  session_type: string;
  session_date: string;
  duration_min: number;
  status: string;
  day_part: string | null;
  session_time: string | null; // HH:MM — set after drag-and-drop
}

// Explicit hex backgrounds for good visibility on dark theme
const DISC_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  swim:     { bg: "rgba(56,189,248,0.22)",  border: "#38bdf8", text: "#38bdf8"  },
  bike:     { bg: "rgba(251,146,60,0.22)",  border: "#fb923c", text: "#fb923c"  },
  run:      { bg: "rgba(244,114,182,0.22)", border: "#f472b6", text: "#f472b6"  },
  brick:    { bg: "rgba(250,204,21,0.22)",  border: "#facc15", text: "#facc15"  },
  strength: { bg: "rgba(52,211,153,0.22)",  border: "#34d399", text: "#34d399"  },
  rest:     { bg: "rgba(148,163,184,0.22)", border: "#94a3b8", text: "#94a3b8"  },
};
const DISC_FALLBACK = DISC_COLORS.rest;

const EV_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  cours: { bg: "rgba(167,139,250,0.22)", border: "#a78bfa", text: "#a78bfa" },
  stage: { bg: "rgba(251,191,36,0.22)",  border: "#fbbf24", text: "#fbbf24" },
  rdv:   { bg: "rgba(52,211,153,0.22)",  border: "#34d399", text: "#34d399" },
  autre: { bg: "rgba(148,163,184,0.22)", border: "#94a3b8", text: "#94a3b8" },
};

const DISC_LABEL: Record<string, string> = {
  swim: "Natation", bike: "Vélo", run: "Course",
  brick: "Enchaîn.", strength: "Muscu", rest: "Repos",
};
const EV_LABEL: Record<string, string> = {
  cours: "Cours", stage: "Stage", rdv: "RDV", autre: "Autre",
};
const DAY_PART_HOUR: Record<string, number> = {
  morning: 7, midday: 12, evening: 18,
};

function timeToFrac(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}
function topPx(h: number)   { return (h - START_HOUR) * HOUR_PX; }
function heightPx(s: number, e: number) { return Math.max((e - s) * HOUR_PX - 3, 20); }

export function WeekCalendar() {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [calEvents, setCalEvents]   = useState<CalendarEvent[]>([]);
  const [sessions, setSessions]     = useState<TrainingSession[]>([]);
  const [loading, setLoading]       = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [clickedDate, setClickedDate] = useState<string | undefined>();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [nowFrac, setNowFrac]       = useState<number | null>(null);
  const [todayIdx, setTodayIdx]     = useState<number | null>(null);
  // Drag & drop
  const draggingId  = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ date: string; hour: number } | null>(null);

  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  useEffect(() => {
    function tick() {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const days = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));
      const idx = days.indexOf(todayStr);
      setTodayIdx(idx === -1 ? null : idx);
      setNowFrac(idx === -1 ? null : now.getHours() + now.getMinutes() / 60);
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [weekStart]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const end = format(addDays(weekStart, 6), "yyyy-MM-dd");
        const [evRes, sessRes] = await Promise.all([
          fetch(`/api/schedule?week_start=${weekStartStr}`),
          fetch(`/api/sessions?start=${weekStartStr}&end=${end}&fields=session_time`),
        ]);
        if (evRes.ok)   setCalEvents(await evRes.json());
        if (sessRes.ok) setSessions(await sessRes.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [weekStartStr, weekStart]);

  async function refreshEvents() {
    const res = await fetch(`/api/schedule?week_start=${weekStartStr}`);
    if (res.ok) setCalEvents(await res.json());
  }

  async function handleSave(data: ScheduleEventInput) {
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Erreur serveur");
    }
    await refreshEvents();
  }

  async function handleUpdate(data: ScheduleEventInput) {
    if (!editingEvent) return;
    const res = await fetch(`/api/schedule/${editingEvent.source_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Erreur serveur");
    }
    await refreshEvents();
  }

  async function handleDelete(sourceId: string) {
    await fetch(`/api/schedule/${sourceId}`, { method: "DELETE" });
    setEditingEvent(null);
    await refreshEvents();
  }

  async function handleMoveSession(sessId: string, newDate: string, newHour: number) {
    const timeStr = `${String(newHour).padStart(2, "0")}:00`;
    const dayPart = newHour < 12 ? "morning" : newHour < 17 ? "midday" : "evening";

    // Optimistic UI update
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessId
          ? { ...s, session_date: newDate, session_time: timeStr, day_part: dayPart }
          : s
      )
    );

    await fetch(`/api/sessions/${sessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_date: newDate, session_time: timeStr, day_part: dayPart }),
    });
  }

  const days    = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const hours   = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const totalH  = (END_HOUR - START_HOUR + 1) * HOUR_PX;

  return (
    <div className="flex flex-col" style={{ minHeight: 0, flex: 1 }}>
      {/* ── Controls ── */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => subWeeks(w, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: "oklch(0.97 0 0)" }}
            aria-label="Semaine précédente"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="text-sm font-medium px-2" style={{ color: "#000000", minWidth: 180, textAlign: "center" }}>
            {format(weekStart, "d MMM", { locale: fr })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}
          </span>
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: "oklch(0.97 0 0)" }}
            aria-label="Semaine suivante"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="ml-1 text-xs px-3 py-1.5 rounded-lg font-bold transition-opacity hover:opacity-70"
            style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: "oklch(0.85 0 0)" }}
          >Aujourd&apos;hui</button>
        </div>

        <button
          onClick={() => { setClickedDate(undefined); setShowModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-opacity hover:opacity-90"
          style={{ backgroundColor: MINT, color: DARK }}
        >
          <span className="text-base leading-none">+</span> Ajouter
        </button>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4 flex-shrink-0">
        {[
          { label: "Natation", color: "#38bdf8" },
          { label: "Vélo",     color: "#fb923c" },
          { label: "Course",   color: "#f472b6" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} /> {label}
          </div>
        ))}
        <div className="w-px h-4 mx-1" style={{ backgroundColor: BORDER }} />
        {[
          { label: "Cours",  color: "#a78bfa" },
          { label: "Stage",  color: "#fbbf24" },
          { label: "RDV",    color: "#34d399" },
          { label: "Autre",  color: "#94a3b8" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} /> {label}
          </div>
        ))}
        {loading && <span className="text-xs ml-auto" style={{ color: MUTED }}>Chargement…</span>}
      </div>

      {/* ── Grid ── */}
      <div className="overflow-y-auto rounded-xl" style={{ flex: 1, minHeight: 0, border: `1px solid ${BORDER}`, backgroundColor: "#0d1710" }}>
        <div style={{ minWidth: 640, backgroundColor: "#0d1710" }}>

          {/* Day headers — sticky */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: "44px repeat(7, 1fr)",
              position: "sticky", top: 0, zIndex: 10,
              backgroundColor: "#0d1710",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div />
            {days.map((day, i) => {
              const dStr = format(day, "yyyy-MM-dd");
              const isToday = dStr === todayStr;
              return (
                <div key={i} style={{ textAlign: "center", padding: "10px 4px 8px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED }}>
                    {format(day, "EEE", { locale: fr })}
                  </div>
                  <div style={{
                    fontSize: 20, fontWeight: 900, lineHeight: 1, marginTop: 4,
                    color: isToday ? DARK : "oklch(0.97 0 0)",
                    backgroundColor: isToday ? MINT : "transparent",
                    borderRadius: "50%", width: 32, height: 32,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "4px auto 0",
                  }}>
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Body: time column + 7 day columns */}
          <div className="flex" style={{ backgroundColor: "#0d1710" }}>

            {/* Time labels */}
            <div style={{ width: 44, flexShrink: 0, backgroundColor: "#0d1710", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
              {hours.map((h) => (
                <div key={h} style={{
                  height: HOUR_PX,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.45)",
                  textAlign: "right",
                  paddingRight: 8,
                  paddingTop: 4,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  userSelect: "none",
                }}>
                  {h}h
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, colIdx) => {
              const dStr = format(day, "yyyy-MM-dd");
              const dayCalEvs  = calEvents.filter((e) => e.date === dStr);
              const daySessions = sessions.filter((s) => s.session_date === dStr);

              return (
                <div
                  key={colIdx}
                  style={{
                    flex: 1,
                    position: "relative",
                    backgroundColor: "#0d1710",
                    borderRight: colIdx < 6 ? "1px solid rgba(255,255,255,0.08)" : "none",
                  }}
                >
                  {/* Background hour slots — also drop targets */}
                  {hours.map((h) => {
                    const isDropTarget = dropTarget?.date === dStr && dropTarget?.hour === h;
                    return (
                      <div
                        key={h}
                        onClick={() => { setClickedDate(dStr); setShowModal(true); }}
                        onDragOver={(e) => { e.preventDefault(); setDropTarget({ date: dStr, hour: h }); }}
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDropTarget(null);
                          const id = draggingId.current;
                          if (id) handleMoveSession(id, dStr, h);
                        }}
                        style={{
                          height: HOUR_PX,
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          backgroundColor: isDropTarget
                            ? "rgba(94,245,160,0.1)"
                            : h % 2 === 0 ? "#0d1710" : "#111a13",
                          outline: isDropTarget ? "1px solid rgba(94,245,160,0.4)" : "none",
                          cursor: "pointer",
                          transition: "background-color 0.1s",
                        }}
                      />
                    );
                  })}

                  {/* Now line */}
                  {todayIdx === colIdx && nowFrac !== null && (
                    <div style={{
                      position: "absolute", left: 0, right: 0,
                      top: topPx(nowFrac), height: 2,
                      backgroundColor: MINT, zIndex: 5, pointerEvents: "none",
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        backgroundColor: MINT,
                        position: "absolute", left: -4, top: -3,
                      }} />
                    </div>
                  )}

                  {/* Personal events */}
                  {dayCalEvs.map((ev) => {
                    const c = EV_COLORS[ev.event_type] ?? EV_COLORS.autre;
                    const s = timeToFrac(ev.start_time);
                    const e = timeToFrac(ev.end_time);
                    return (
                      <div
                        key={ev.id}
                        title={`${ev.title} — cliquer pour modifier`}
                        onClick={(e) => { e.stopPropagation(); setEditingEvent(ev); }}
                        style={{
                          position: "absolute", left: 3, right: 3,
                          top: topPx(s), height: heightPx(s, e),
                          borderRadius: 6, padding: "3px 7px",
                          backgroundColor: c.bg,
                          borderLeft: `3px solid ${c.border}`,
                          color: c.text,
                          overflow: "hidden", zIndex: 3, cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {ev.title}
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.75 }}>{ev.start_time} – {ev.end_time}</div>
                        <span style={{
                          display: "inline-block", fontSize: 9, padding: "1px 5px",
                          borderRadius: 10, fontWeight: 700,
                          backgroundColor: c.border, color: "#0a1a0d",
                        }}>{EV_LABEL[ev.event_type]}</span>
                      </div>
                    );
                  })}

                  {/* Training sessions — draggable */}
                  {daySessions.map((sess) => {
                    const c = DISC_COLORS[sess.discipline] ?? DISC_FALLBACK;
                    // Use precise session_time if set, otherwise fall back to day_part default
                    const startH = sess.session_time
                      ? timeToFrac(sess.session_time)
                      : (DAY_PART_HOUR[sess.day_part ?? ""] ?? 7);
                    const endH = startH + (sess.duration_min ?? 60) / 60;
                    const isDragging = draggingId.current === sess.id;

                    return (
                      <div
                        key={sess.id}
                        draggable
                        onDragStart={(e) => {
                          draggingId.current = sess.id;
                          e.dataTransfer.effectAllowed = "move";
                          // ghost image via dataTransfer
                          e.dataTransfer.setData("text/plain", sess.id);
                        }}
                        onDragEnd={() => { draggingId.current = null; setDropTarget(null); }}
                        style={{
                          position: "absolute", left: 3, right: 3,
                          top: topPx(startH), height: heightPx(startH, endH),
                          borderRadius: 6, padding: "3px 7px",
                          backgroundColor: c.bg,
                          borderLeft: `3px solid ${c.border}`,
                          color: c.text,
                          overflow: "hidden", zIndex: 4,
                          opacity: isDragging ? 0.4 : sess.status === "done" ? 0.5 : 1,
                          cursor: "grab",
                          transition: "opacity 0.15s",
                        }}
                      >
                        {/* Drag handle hint */}
                        <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 1, userSelect: "none" }}>⠿ déplacer</div>
                        <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <a
                            href={`/session/${sess.id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: "inherit", textDecoration: "none" }}
                          >
                            {sess.title ?? DISC_LABEL[sess.discipline]}
                          </a>
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.75 }}>
                          {sess.session_time ? `${sess.session_time.slice(0,5)} · ` : ""}{sess.duration_min} min
                        </div>
                        <span style={{
                          display: "inline-block", fontSize: 9, padding: "1px 5px",
                          borderRadius: 10, fontWeight: 700,
                          backgroundColor: c.border, color: "#0a1a0d",
                        }}>{DISC_LABEL[sess.discipline]}</span>
                      </div>
                    );
                  })}
                </div>
              );
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
  );
}
