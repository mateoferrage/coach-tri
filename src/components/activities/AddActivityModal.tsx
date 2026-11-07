'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NATIVE_FIELD_CLASS } from '@/components/ui/field-class'
import { SectionLabel } from '@/components/common/SectionLabel'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { cn } from '@/lib/utils/cn'

// Libellés propres au formulaire (« Muscu », « Autre ») : différents de DISCIPLINE_LABEL.
const DISCIPLINES = [
  { value: 'run', label: 'Course' },
  { value: 'bike', label: 'Vélo' },
  { value: 'swim', label: 'Natation' },
  { value: 'strength', label: 'Muscu' },
  { value: 'other', label: 'Autre' },
]

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export function AddActivityModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Date/heure locales (toISOString renverrait la date UTC → décalage en soirée)
  const today = format(new Date(), 'yyyy-MM-dd')
  const nowTime = new Date().toTimeString().slice(0, 5)

  const [form, setForm] = useState({
    discipline: 'run',
    name: '',
    date: today,
    time: nowTime,
    duration_min: '',
    distance: '',
    avg_hr: '',
    elevation_gain_m: '',
  })

  const isSwim = form.discipline === 'swim'
  const isStrength = form.discipline === 'strength'
  const discInfo = DISCIPLINES.find((d) => d.value === form.discipline)!

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setApiError(null)
  }

  function handleClose() {
    setOpen(false)
    setApiError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const duration_min = parseFloat(form.duration_min)
    if (!duration_min || duration_min <= 0) {
      setApiError('La durée est requise')
      return
    }

    const rawDist = parseFloat(form.distance)
    const distance_m = form.distance ? (isSwim ? rawDist : rawDist * 1000) : undefined

    const payload = {
      discipline: form.discipline,
      name: form.name || undefined,
      started_at: `${form.date}T${form.time}:00`,
      duration_min,
      ...(distance_m ? { distance_m } : {}),
      ...(form.avg_hr ? { avg_hr: parseInt(form.avg_hr) } : {}),
      ...(form.elevation_gain_m ? { elevation_gain_m: parseFloat(form.elevation_gain_m) } : {}),
    }

    setLoading(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json()
        setApiError(body.error ?? "Erreur lors de l'ajout")
        return
      }
      handleClose()
      router.refresh()
    } catch {
      setApiError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="highlight" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Ajouter une activité
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (loading) return
          if (!next) handleClose()
        }}
      >
        <DialogContent showCloseButton={false} className="p-6 sm:max-w-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Header */}
            <DialogHeader className="flex-row items-start justify-between gap-4">
              <div className="space-y-1.5">
                <SectionLabel as="p">Saisie manuelle</SectionLabel>
                <DialogTitle className="font-display text-2xl leading-tight font-extrabold">
                  Ajouter une activité
                </DialogTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleClose}
                aria-label="Fermer"
                className="-mt-1 -mr-2"
              >
                <X aria-hidden />
              </Button>
            </DialogHeader>

            {/* Discipline */}
            <div className="space-y-1.5">
              <Label id="activity-discipline-label">Discipline</Label>
              <div
                role="group"
                aria-labelledby="activity-discipline-label"
                className="flex flex-wrap gap-2"
              >
                {DISCIPLINES.map((d) => {
                  const selected = form.discipline === d.value
                  return (
                    <button
                      key={d.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => set('discipline', d.value)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        selected
                          ? 'border-primary bg-accent text-primary-ink'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <DisciplineIcon discipline={d.value} size={14} />
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Titre */}
            <Field id="activity-name" label="Titre (optionnel)">
              <Input
                id="activity-name"
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={discInfo.label}
                className="h-9"
              />
            </Field>

            {/* Date + Heure */}
            <div className="grid grid-cols-2 gap-3">
              <Field id="activity-date" label="Date">
                <input
                  id="activity-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                  required
                  className={NATIVE_FIELD_CLASS}
                />
              </Field>
              <Field id="activity-time" label="Heure">
                <input
                  id="activity-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => set('time', e.target.value)}
                  required
                  className={cn(NATIVE_FIELD_CLASS, 'tabular-nums')}
                />
              </Field>
            </div>

            {/* Durée + Distance */}
            <div className="grid grid-cols-2 gap-3">
              <Field id="activity-duration" label="Durée (min)">
                <Input
                  id="activity-duration"
                  type="number"
                  value={form.duration_min}
                  onChange={(e) => set('duration_min', e.target.value)}
                  placeholder="60"
                  min={1}
                  required
                  className="h-9 tabular-nums"
                />
              </Field>
              {!isStrength && (
                <Field id="activity-distance" label={`Distance (${isSwim ? 'm' : 'km'})`}>
                  <Input
                    id="activity-distance"
                    type="number"
                    value={form.distance}
                    onChange={(e) => set('distance', e.target.value)}
                    placeholder={isSwim ? '1500' : '10.5'}
                    step={isSwim ? '50' : '0.01'}
                    min={0}
                    className="h-9 tabular-nums"
                  />
                </Field>
              )}
            </div>

            {/* FC + Dénivelé */}
            <div className="grid grid-cols-2 gap-3">
              <Field id="activity-hr" label="FC moy. (bpm)">
                <Input
                  id="activity-hr"
                  type="number"
                  value={form.avg_hr}
                  onChange={(e) => set('avg_hr', e.target.value)}
                  placeholder="145"
                  min={40}
                  max={220}
                  className="h-9 tabular-nums"
                />
              </Field>
              {!isSwim && !isStrength && (
                <Field id="activity-elevation" label="Dénivelé+ (m)">
                  <Input
                    id="activity-elevation"
                    type="number"
                    value={form.elevation_gain_m}
                    onChange={(e) => set('elevation_gain_m', e.target.value)}
                    placeholder="200"
                    min={0}
                    className="h-9 tabular-nums"
                  />
                </Field>
              )}
            </div>

            {apiError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {apiError}
              </p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? 'Enregistrement…' : "Enregistrer l'activité"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
