"use client";

import { useState } from "react";
import { format, getISODay } from "date-fns";
import type { ScheduleEventInput, CalendarEvent } from "@/lib/schemas/schedule";
import { ACCENT as MINT, ACCENT_FG, SURFACE as DARK, SURFACE as CARD, DIVIDER as BORDER, TEXT_FAINT as MUTED } from "@/lib/theme";

const EVENT_TYPES = [
  { value: "cours", label: "📚 Cours" },
  { value: "stage", label: "💼 Stage" },
  { value: "rdv",   label: "🏥 Rendez-vous" },
  { value: "autre", label: "📌 Autre" },
] as const;

const ISO_DAYS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface EventModalProps {
  initialDate?: string;       // YYYY-MM-DD — used in create mode
  initialEvent?: CalendarEvent; // if set → edit mode
  onSave: (data: ScheduleEventInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function EventModal({ initialDate, initialEvent, onSave, onDelete, onClose }: EventModalProps) {
  const isEdit = !!initialEvent;

  // format() = date locale (toISOString renverrait la date UTC → mauvais jour en soirée)
  const today   = initialEvent?.event_date ?? initialDate ?? format(new Date(), "yyyy-MM-dd");
  const initDay = getISODay(new Date(today + "T00:00:00"));

  const [title,         setTitle]         = useState(initialEvent?.title ?? "");
  const [eventType,     setEventType]     = useState<ScheduleEventInput["event_type"]>(initialEvent?.event_type ?? "cours");
  const [eventDate,     setEventDate]     = useState(today);
  const [startTime,     setStartTime]     = useState(initialEvent?.start_time ?? "08:00");
  const [endTime,       setEndTime]       = useState(initialEvent?.end_time   ?? "12:00");
  const [isRecurring,   setIsRecurring]   = useState(initialEvent?.is_recurring ?? false);
  const [recurrenceDay, setRecurrenceDay] = useState(initialEvent?.recurrence_day ?? initDay);
  const [recurrenceEnd, setRecurrenceEnd] = useState(initialEvent?.recurrence_end_date ?? "");
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [error,         setError]         = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) { setError("Titre requis"); return; }
    if (startTime >= endTime) { setError("L'heure de fin doit être après l'heure de début"); return; }
    if (isRecurring && !recurrenceEnd) { setError("Date de fin de récurrence requise"); return; }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        event_type: eventType,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        is_recurring: isRecurring,
        recurrence_day: isRecurring ? recurrenceDay : undefined,
        recurrence_end_date: isRecurring ? recurrenceEnd : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setError("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  }

  const inputStyle = {
    backgroundColor: DARK,
    border: `1px solid ${BORDER}`,
    color: "oklch(0.97 0 0)",
    colorScheme: "dark" as const,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold uppercase tracking-widest" style={{ color: MINT }}>
            {isEdit ? "Modifier l'événement" : "Nouvel événement"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none"
            style={{ color: MUTED }}
          >
            ✕
          </button>
        </div>

        {isEdit && initialEvent?.is_recurring && (
          <div
            className="rounded-xl px-3 py-2 text-xs"
            style={{ backgroundColor: "oklch(0.88 0.16 157 / 10%)", border: "1px solid oklch(0.88 0.16 157 / 25%)", color: "oklch(0.88 0.16 157)" }}
          >
            ↻ Événement récurrent — les modifications s&apos;appliquent à toutes les occurrences.
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
            Titre
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex. Cours de droit, Stage entreprise…"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
            style={inputStyle}
            autoFocus={!isEdit}
          />
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
            Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEventType(value)}
                className="rounded-lg px-3 py-2 text-xs font-bold transition-all text-left"
                style={{
                  backgroundColor: eventType === value ? "oklch(0.63 0.18 300 / 15%)" : DARK,
                  border: `1px solid ${eventType === value ? "oklch(0.63 0.18 300)" : BORDER}`,
                  color: eventType === value ? "oklch(0.78 0.18 300)" : MUTED,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date + jour */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => {
                setEventDate(e.target.value);
                if (e.target.value) setRecurrenceDay(getISODay(new Date(e.target.value + "T00:00:00")));
              }}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
              {isRecurring ? "Jour répété" : "Jour"}
            </label>
            {isRecurring ? (
              <select
                value={recurrenceDay}
                onChange={(e) => setRecurrenceDay(Number(e.target.value))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              >
                {ISO_DAYS.slice(1).map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            ) : (
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: DARK, border: `1px solid ${BORDER}`, color: MUTED }}
              >
                {eventDate ? ISO_DAYS[getISODay(new Date(eventDate + "T00:00:00"))] : "—"}
              </div>
            )}
          </div>
        </div>

        {/* Horaires */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>Début</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value.slice(0, 5))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>Fin</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value.slice(0, 5))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Récurrence */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isRecurring}
              onClick={() => setIsRecurring(!isRecurring)}
              className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
              style={{ backgroundColor: isRecurring ? MINT : BORDER }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: isRecurring ? "calc(100% - 18px)" : "2px" }}
              />
            </button>
            <span className="text-xs font-medium" style={{ color: MUTED }}>
              Répéter chaque semaine
            </span>
          </div>

          {isRecurring && (
            <div className="flex items-center gap-2 pl-[52px]">
              <span className="text-xs" style={{ color: MUTED }}>jusqu&apos;au</span>
              <input
                type="date"
                value={recurrenceEnd}
                onChange={(e) => setRecurrenceEnd(e.target.value)}
                className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none"
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {/* AI notice */}
        <div
          className="rounded-xl px-3 py-2.5 text-xs"
          style={{ backgroundColor: "oklch(0.63 0.18 300 / 8%)", border: "1px solid oklch(0.63 0.18 300 / 20%)", color: "oklch(0.78 0.18 300)" }}
        >
          ⚡ Le coach IA tiendra compte de ce créneau pour ne pas placer d&apos;entraînement dessus.
        </div>

        {error && (
          <p className="text-xs font-medium" style={{ color: "oklch(0.65 0.22 25)" }}>{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 rounded-xl py-2.5 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ backgroundColor: "oklch(0.65 0.20 25 / 15%)", border: "1px solid oklch(0.65 0.20 25 / 40%)", color: "oklch(0.75 0.18 25)" }}
            >
              {deleting ? "…" : "Supprimer"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
            style={{ backgroundColor: DARK, border: `1px solid ${BORDER}`, color: MUTED }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-[2] rounded-xl py-2.5 text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: MINT, color: ACCENT_FG }}
          >
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
}
