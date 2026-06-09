'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const MINT   = 'oklch(0.843 0.165 157)'
const DARK   = 'oklch(0.116 0.022 155)'
const DARKER = 'oklch(0.09 0.018 155)'
const DIV    = 'oklch(1 0 0 / 8%)'

interface Shoe {
  name: string
  usage: 'footing' | 'dynamic' | 'competition'
  surface: 'road' | 'trail'
  _key?: number
}

interface EquipmentData {
  swim?: { paddles?: boolean; fins?: boolean; pull_buoy?: boolean; kickboard?: boolean; snorkel?: boolean }
  bike?: { aero_bars?: boolean }
  run?: { shoes?: Shoe[] }
}

interface Props {
  initial: EquipmentData
}

const SWIM_ITEMS: { key: keyof NonNullable<EquipmentData['swim']>; label: string }[] = [
  { key: 'paddles',   label: 'Plaquettes mains' },
  { key: 'fins',      label: 'Palmes' },
  { key: 'pull_buoy', label: 'Pullbuoy' },
  { key: 'kickboard', label: 'Planche' },
  { key: 'snorkel',   label: 'Tuba frontal' },
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

function ToggleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
      style={{
        backgroundColor: active ? MINT : 'oklch(1 0 0 / 6%)',
        color: active ? DARK : 'oklch(1 0 0 / 45%)',
        border: `1px solid ${active ? MINT : 'oklch(1 0 0 / 12%)'}`,
      }}
    >
      {label}
    </button>
  )
}

export function EquipmentSection({ initial }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<EquipmentData>(initial ?? {})

  function toggleSwim(key: keyof NonNullable<EquipmentData['swim']>) {
    setData(prev => ({
      ...prev,
      swim: { ...prev.swim, [key]: !prev.swim?.[key] },
    }))
  }

  function toggleAeroBars() {
    setData(prev => ({
      ...prev,
      bike: { aero_bars: !prev.bike?.aero_bars },
    }))
  }

  function addShoe() {
    setData(prev => ({
      ...prev,
      run: { shoes: [...(prev.run?.shoes ?? []), { name: '', usage: 'footing', surface: 'road', _key: Date.now() }] },
    }))
  }

  function removeShoe(i: number) {
    setData(prev => ({
      ...prev,
      run: { shoes: (prev.run?.shoes ?? []).filter((_, idx) => idx !== i) },
    }))
  }

  function updateShoe(i: number, field: keyof Shoe, value: string) {
    setData(prev => {
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
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: DARKER, borderBottom: `1px solid ${DIV}` }}
        >
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'oklch(1 0 0 / 40%)' }}>
            Matériel
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors hover:opacity-70"
            style={{ color: MINT, borderColor: `${MINT}40` }}
          >
            <Pencil size={11} />
            Modifier
          </button>
        </div>

        {!hasAny ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm" style={{ color: 'oklch(1 0 0 / 35%)' }}>
              Aucun matériel renseigné — le coach utilisera des séances standard
            </p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {Object.values(data.swim ?? {}).some(Boolean) && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'oklch(1 0 0 / 38%)' }}>
                  Natation
                </p>
                <div className="flex flex-wrap gap-2">
                  {SWIM_ITEMS.filter(item => data.swim?.[item.key]).map(item => (
                    <span
                      key={item.key}
                      className="px-3 py-1 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: `${MINT}18`, color: MINT, border: `1px solid ${MINT}30` }}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.bike?.aero_bars && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'oklch(1 0 0 / 38%)' }}>
                  Vélo
                </p>
                <span
                  className="px-3 py-1 rounded-lg text-xs font-bold"
                  style={{ backgroundColor: `${MINT}18`, color: MINT, border: `1px solid ${MINT}30` }}
                >
                  Prolongateurs
                </span>
              </div>
            )}

            {(data.run?.shoes?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'oklch(1 0 0 / 38%)' }}>
                  Course
                </p>
                <div className="space-y-1.5">
                  {data.run!.shoes!.map((shoe, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: 'oklch(1 0 0 / 90%)' }}>{shoe.name}</span>
                      <span className="text-xs" style={{ color: 'oklch(1 0 0 / 40%)' }}>
                        {USAGE_LABELS[shoe.usage]} · {SURFACE_LABELS[shoe.surface]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const hasEmptyShoe = (data.run?.shoes ?? []).some(s => !s.name.trim())

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
    >
      <div
        className="px-5 py-4"
        style={{ backgroundColor: DARKER, borderBottom: `1px solid ${DIV}` }}
      >
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'oklch(1 0 0 / 40%)' }}>
          Modifier le matériel
        </p>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* ── Natation ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'oklch(1 0 0 / 38%)' }}>
            Natation
          </p>
          <div className="flex flex-wrap gap-2">
            {SWIM_ITEMS.map(item => (
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
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'oklch(1 0 0 / 38%)' }}>
            Vélo
          </p>
          <ToggleChip
            label="Prolongateurs"
            active={!!data.bike?.aero_bars}
            onClick={toggleAeroBars}
          />
        </div>

        {/* ── Course ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'oklch(1 0 0 / 38%)' }}>
            Course
          </p>
          <div className="space-y-3">
            {(data.run?.shoes ?? []).map((shoe, i) => (
              <div
                key={shoe._key ?? i}
                className="rounded-xl p-3 space-y-2"
                style={{ backgroundColor: 'oklch(1 0 0 / 4%)', border: `1px solid ${DIV}` }}
              >
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nom de la chaussure"
                    value={shoe.name}
                    onChange={e => updateShoe(i, 'name', e.target.value)}
                    className="flex-1 text-sm"
                    style={{ color: 'oklch(1 0 0 / 90%)' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeShoe(i)}
                    className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: 'oklch(0.65 0.20 25)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Select value={shoe.usage} onValueChange={v => { if (v) updateShoe(i, 'usage', v) }}>
                    <SelectTrigger className="flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="footing">Footing</SelectItem>
                      <SelectItem value="dynamic">Dynamique</SelectItem>
                      <SelectItem value="competition">Compétition</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={shoe.surface} onValueChange={v => { if (v) updateShoe(i, 'surface', v) }}>
                    <SelectTrigger className="flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="road">Route</SelectItem>
                      <SelectItem value="trail">Trail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addShoe}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-xl border transition-opacity hover:opacity-70 w-full justify-center"
              style={{ color: MINT, borderColor: `${MINT}30`, backgroundColor: `${MINT}08` }}
            >
              <Plus size={13} />
              Ajouter une paire
            </button>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setData(initial ?? {}); setEditing(false) }}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving || hasEmptyShoe}
            className="flex-1 font-bold"
            style={{ backgroundColor: MINT, color: DARK }}
          >
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </Button>
        </div>
        {error && (
          <p className="text-xs text-center" style={{ color: 'oklch(0.65 0.20 25)' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
