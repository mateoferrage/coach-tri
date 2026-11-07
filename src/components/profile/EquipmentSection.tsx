'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { cn } from '@/lib/utils/cn'

interface Shoe {
  name: string
  usage: 'footing' | 'dynamic' | 'competition'
  surface: 'road' | 'trail'
  _key?: number
}

interface EquipmentData {
  swim?: {
    paddles?: boolean
    fins?: boolean
    pull_buoy?: boolean
    kickboard?: boolean
    snorkel?: boolean
  }
  bike?: { aero_bars?: boolean }
  run?: { shoes?: Shoe[] }
}

interface Props {
  initial: EquipmentData
}

const SWIM_ITEMS: { key: keyof NonNullable<EquipmentData['swim']>; label: string }[] = [
  { key: 'paddles', label: 'Plaquettes mains' },
  { key: 'fins', label: 'Palmes' },
  { key: 'pull_buoy', label: 'Pullbuoy' },
  { key: 'kickboard', label: 'Planche' },
  { key: 'snorkel', label: 'Tuba frontal' },
]

const USAGE_LABELS: Record<Shoe['usage'], string> = {
  footing: 'Footing',
  dynamic: 'Dynamique',
  competition: 'Compétition',
}

const SURFACE_LABELS: Record<Shoe['surface'], string> = {
  road: 'Route',
  trail: 'Trail',
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        active
          ? 'border-primary bg-accent text-primary-ink'
          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {active && <Check aria-hidden className="size-3.5" />}
      {label}
    </button>
  )
}

function CategoryRow({
  discipline,
  label,
  children,
}: {
  discipline: string
  label: string
  children: React.ReactNode
}) {
  return (
    <li className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 sm:flex-row sm:items-start sm:gap-4">
      <span className="flex w-28 shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground sm:pt-0.5">
        <DisciplineIcon discipline={discipline} className="size-4 text-primary-ink" />
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}

export function EquipmentSection({ initial }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<EquipmentData>(initial ?? {})

  function toggleSwim(key: keyof NonNullable<EquipmentData['swim']>) {
    setData((prev) => ({
      ...prev,
      swim: { ...prev.swim, [key]: !prev.swim?.[key] },
    }))
  }

  function toggleAeroBars() {
    setData((prev) => ({
      ...prev,
      bike: { aero_bars: !prev.bike?.aero_bars },
    }))
  }

  function addShoe() {
    setData((prev) => ({
      ...prev,
      run: {
        shoes: [
          ...(prev.run?.shoes ?? []),
          { name: '', usage: 'footing', surface: 'road', _key: Date.now() },
        ],
      },
    }))
  }

  function removeShoe(i: number) {
    setData((prev) => ({
      ...prev,
      run: { shoes: (prev.run?.shoes ?? []).filter((_, idx) => idx !== i) },
    }))
  }

  function updateShoe(i: number, field: keyof Shoe, value: string) {
    setData((prev) => {
      const shoes = [...(prev.run?.shoes ?? [])]
      shoes[i] = { ...shoes[i], [field]: value }
      return { ...prev, run: { shoes } }
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipment: data }),
    })
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Erreur lors de la sauvegarde')
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    const hasAny =
      Object.values(data.swim ?? {}).some(Boolean) ||
      data.bike?.aero_bars ||
      (data.run?.shoes?.length ?? 0) > 0

    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-end gap-3 border-b border-border px-5 py-4">
          <Button
            type="button"
            variant="outline-primary"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
            Modifier
          </Button>
        </div>

        {!hasAny ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun matériel renseigné — le coach utilisera des séances standard
            </p>
          </div>
        ) : (
          <ul className="px-5">
            {Object.values(data.swim ?? {}).some(Boolean) && (
              <CategoryRow discipline="swim" label="Natation">
                <div className="flex flex-wrap gap-1.5">
                  {SWIM_ITEMS.filter((item) => data.swim?.[item.key]).map((item) => (
                    <Badge key={item.key} variant="outline">
                      {item.label}
                    </Badge>
                  ))}
                </div>
              </CategoryRow>
            )}

            {data.bike?.aero_bars && (
              <CategoryRow discipline="bike" label="Vélo">
                <Badge variant="outline">Prolongateurs</Badge>
              </CategoryRow>
            )}

            {(data.run?.shoes?.length ?? 0) > 0 && (
              <CategoryRow discipline="run" label="Course">
                <ul className="space-y-1.5">
                  {data.run!.shoes!.map((shoe, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-foreground">{shoe.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {USAGE_LABELS[shoe.usage]} · {SURFACE_LABELS[shoe.surface]}
                      </span>
                    </li>
                  ))}
                </ul>
              </CategoryRow>
            )}
          </ul>
        )}
      </div>
    )
  }

  const hasEmptyShoe = (data.run?.shoes ?? []).some((s) => !s.name.trim())

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base">Modifier l&apos;équipement</h3>
      </div>

      <div className="space-y-6 px-5 py-5">
        {/* ── Natation ── */}
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <DisciplineIcon discipline="swim" className="size-4 text-primary-ink" />
            Natation
          </p>
          <div className="flex flex-wrap gap-2">
            {SWIM_ITEMS.map((item) => (
              <ToggleChip
                key={item.key}
                label={item.label}
                active={!!data.swim?.[item.key]}
                onClick={() => toggleSwim(item.key)}
              />
            ))}
          </div>
        </div>

        {/* ── Vélo ── */}
        <div className="space-y-3 border-t border-border pt-6">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <DisciplineIcon discipline="bike" className="size-4 text-primary-ink" />
            Vélo
          </p>
          <ToggleChip
            label="Prolongateurs"
            active={!!data.bike?.aero_bars}
            onClick={toggleAeroBars}
          />
        </div>

        {/* ── Course ── */}
        <div className="space-y-3 border-t border-border pt-6">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <DisciplineIcon discipline="run" className="size-4 text-primary-ink" />
            Course
          </p>
          <div className="space-y-3">
            {(data.run?.shoes ?? []).length > 0 && (
              <ul className="rounded-xl border border-border">
                {(data.run?.shoes ?? []).map((shoe, i) => (
                  <li
                    key={shoe._key ?? i}
                    className="space-y-2 border-t border-border p-3 first:border-t-0"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Nom de la chaussure"
                        value={shoe.name}
                        onChange={(e) => updateShoe(i, 'name', e.target.value)}
                        className="flex-1 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeShoe(i)}
                        aria-label={shoe.name ? `Supprimer ${shoe.name}` : 'Supprimer cette paire'}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={shoe.usage}
                        onValueChange={(v) => {
                          if (v) updateShoe(i, 'usage', v)
                        }}
                      >
                        <SelectTrigger className="flex-1 text-sm" aria-label="Usage">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="footing">Footing</SelectItem>
                          <SelectItem value="dynamic">Dynamique</SelectItem>
                          <SelectItem value="competition">Compétition</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={shoe.surface}
                        onValueChange={(v) => {
                          if (v) updateShoe(i, 'surface', v)
                        }}
                      >
                        <SelectTrigger className="flex-1 text-sm" aria-label="Surface">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="road">Route</SelectItem>
                          <SelectItem value="trail">Trail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="outline-primary"
              size="sm"
              onClick={addShoe}
              className="w-full"
            >
              <Plus aria-hidden />
              Ajouter une paire
            </Button>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setData(initial ?? {})
              setEditing(false)
            }}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button type="button" onClick={save} disabled={saving || hasEmptyShoe} className="flex-1">
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </Button>
        </div>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}
