'use client'

import { useState } from 'react'
import { format, getISODay } from 'date-fns'
import { Repeat, Sparkles, X } from 'lucide-react'
import type { ScheduleEventInput, CalendarEvent } from '@/lib/schemas/schedule'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NATIVE_FIELD_CLASS } from '@/components/ui/field-class'
import { SectionLabel } from '@/components/common/SectionLabel'
import { cn } from '@/lib/utils/cn'
import { eventTypeColor } from '@/lib/theme'

// Libellés longs propres au formulaire (« Rendez-vous » au lieu de « RDV » d'EVENT_TYPE).
const EVENT_TYPES = [
  { value: 'cours', label: 'Cours' },
  { value: 'stage', label: 'Stage' },
  { value: 'rdv', label: 'Rendez-vous' },
  { value: 'autre', label: 'Autre' },
] as const

const ISO_DAYS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

interface EventModalProps {
  initialDate?: string // YYYY-MM-DD — used in create mode
  initialEvent?: CalendarEvent // if set → edit mode
  onSave: (data: ScheduleEventInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export function EventModal({
  initialDate,
  initialEvent,
  onSave,
  onDelete,
  onClose,
}: EventModalProps) {
  const isEdit = !!initialEvent

  // format() = date locale (toISOString renverrait la date UTC → mauvais jour en soirée)
  const today = initialEvent?.event_date ?? initialDate ?? format(new Date(), 'yyyy-MM-dd')
  const initDay = getISODay(new Date(today + 'T00:00:00'))

  const [title, setTitle] = useState(initialEvent?.title ?? '')
  const [eventType, setEventType] = useState<ScheduleEventInput['event_type']>(
    initialEvent?.event_type ?? 'cours',
  )
  const [eventDate, setEventDate] = useState(today)
  const [startTime, setStartTime] = useState(initialEvent?.start_time ?? '08:00')
  const [endTime, setEndTime] = useState(initialEvent?.end_time ?? '12:00')
  const [isRecurring, setIsRecurring] = useState(initialEvent?.is_recurring ?? false)
  const [recurrenceDay, setRecurrenceDay] = useState(initialEvent?.recurrence_day ?? initDay)
  const [recurrenceEnd, setRecurrenceEnd] = useState(initialEvent?.recurrence_end_date ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Titre requis')
      return
    }
    if (startTime >= endTime) {
      setError("L'heure de fin doit être après l'heure de début")
      return
    }
    if (isRecurring && !recurrenceEnd) {
      setError('Date de fin de récurrence requise')
      return
    }

    setSaving(true)
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
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch {
      setError('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (saving || deleting) return
        if (!open) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="p-6 sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Header */}
          <DialogHeader className="flex-row items-start justify-between gap-4">
            <div className="space-y-1.5">
              <SectionLabel as="p">Événement perso</SectionLabel>
              <DialogTitle className="font-display text-2xl leading-tight font-extrabold">
                {isEdit ? "Modifier l'événement" : 'Nouvel événement'}
              </DialogTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Fermer"
              className="-mt-1 -mr-2"
            >
              <X aria-hidden />
            </Button>
          </DialogHeader>

          {isEdit && initialEvent?.is_recurring && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/40 bg-accent px-3 py-2 text-xs font-medium text-primary-ink">
              <Repeat aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>
                Événement récurrent — les modifications s&apos;appliquent à toutes les occurrences.
              </span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Titre</Label>
            <Input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex. Cours de droit, Stage entreprise…"
              className="h-9"
              autoFocus={!isEdit}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label id="event-type-label">Type</Label>
            <div role="group" aria-labelledby="event-type-label" className="flex flex-wrap gap-2">
              {EVENT_TYPES.map(({ value, label }) => {
                const selected = eventType === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setEventType(value)}
                    className={cn(
                      'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      selected
                        ? 'border-primary bg-accent text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: eventTypeColor(value) }}
                    />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date + jour */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Date</Label>
              <input
                id="event-date"
                type="date"
                value={eventDate}
                onChange={(e) => {
                  setEventDate(e.target.value)
                  if (e.target.value)
                    setRecurrenceDay(getISODay(new Date(e.target.value + 'T00:00:00')))
                }}
                className={NATIVE_FIELD_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-day">{isRecurring ? 'Jour répété' : 'Jour'}</Label>
              {isRecurring ? (
                <select
                  id="event-day"
                  value={recurrenceDay}
                  onChange={(e) => setRecurrenceDay(Number(e.target.value))}
                  className={NATIVE_FIELD_CLASS}
                >
                  {ISO_DAYS.slice(1).map((name, i) => (
                    <option key={i + 1} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  id="event-day"
                  className="flex h-9 items-center rounded-lg border border-border bg-muted px-2.5 text-sm text-muted-foreground"
                >
                  {eventDate ? ISO_DAYS[getISODay(new Date(eventDate + 'T00:00:00'))] : '—'}
                </div>
              )}
            </div>
          </div>

          {/* Horaires */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Début</Label>
              <input
                id="event-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value.slice(0, 5))}
                className={cn(NATIVE_FIELD_CLASS, 'tabular-nums')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">Fin</Label>
              <input
                id="event-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value.slice(0, 5))}
                className={cn(NATIVE_FIELD_CLASS, 'tabular-nums')}
              />
            </div>
          </div>

          {/* Récurrence */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isRecurring}
                aria-labelledby="event-recurring-label"
                onClick={() => setIsRecurring(!isRecurring)}
                className={cn(
                  'relative h-5 w-10 flex-shrink-0 rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  isRecurring ? 'bg-primary' : 'bg-muted-foreground/40',
                )}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                  style={{ left: isRecurring ? 'calc(100% - 18px)' : '2px' }}
                />
              </button>
              <span id="event-recurring-label" className="text-sm font-medium text-foreground">
                Répéter chaque semaine
              </span>
            </div>

            {isRecurring && (
              <div className="flex items-center gap-2 pl-[52px]">
                <Label htmlFor="event-recurrence-end" className="font-normal text-muted-foreground">
                  jusqu&apos;au
                </Label>
                <input
                  id="event-recurrence-end"
                  type="date"
                  value={recurrenceEnd}
                  onChange={(e) => setRecurrenceEnd(e.target.value)}
                  className={cn(NATIVE_FIELD_CLASS, 'h-8 flex-1')}
                />
              </div>
            )}
          </div>

          {/* AI notice */}
          <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Sparkles aria-hidden className="mt-px size-3.5 shrink-0 text-primary-ink" />
            <span>
              Le coach IA tiendra compte de ce créneau pour ne pas placer d&apos;entraînement
              dessus.
            </span>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {isEdit && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '…' : 'Supprimer'}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" disabled={saving} className="flex-[2]">
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
