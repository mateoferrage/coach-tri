'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Pencil, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const MINT  = 'oklch(0.843 0.165 157)'
const DARK  = 'oklch(0.116 0.022 155)'
const DARKER = 'oklch(0.09 0.018 155)'
const DIV   = 'oklch(1 0 0 / 8%)'
const MUTED = 'oklch(1 0 0 / 40%)'

// ── Helpers ──────────────────────────────────────────────────────────────────

function secToMinSec(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function minSecToSec(str: string): number | null {
  const clean = str.trim()
  if (!clean) return null
  const parts = clean.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s
  }
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

function numOrNull(v: string): number | null {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

// ── Test suggestion tooltip ───────────────────────────────────────────────────

function TestHint({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-80"
        style={{ color: MINT }}
      >
        <FlaskConical size={11} />
        Comment mesurer ?
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <div
          className="mt-2 rounded-xl p-3 text-xs leading-relaxed"
          style={{ backgroundColor: `${MINT}10`, border: `1px solid ${MINT}25`, color: 'oklch(1 0 0 / 65%)' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ── Field components ─────────────────────────────────────────────────────────

function Field({
  label, unit, value, onChange, placeholder, hint,
}: {
  label: string
  unit?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>
          {label}
        </label>
        {unit && <span className="text-[10px]" style={{ color: 'oklch(1 0 0 / 25%)' }}>{unit}</span>}
      </div>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        className="h-9 text-sm font-bold bg-transparent border-white/10 focus:border-white/30"
        style={{ color: 'oklch(0.97 0 0)' }}
      />
      {hint}
    </div>
  )
}

// ── Display row (read mode) ───────────────────────────────────────────────────

function ValueRow({ label, value, unit }: { label: string; value: string | null; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: DIV }}>
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>{label}</span>
      <span className="text-sm font-black" style={{ color: value ? MINT : 'oklch(1 0 0 / 20%)' }}>
        {value ?? '—'}{value && unit ? <span className="text-xs font-medium ml-1" style={{ color: MUTED }}>{unit}</span> : null}
      </span>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PhysiologyData {
  vma_kmh: number | null
  run_threshold_pace_sec_per_km: number | null
  hr_max_run: number | null
  hr_threshold_run: number | null
  ftp_watts: number | null
  hr_max: number | null
  hr_threshold_bike: number | null
  css_pace_sec_per_100m: number | null
  test_date: string | null
}

// ── Main component ────────────────────────────────────────────────────────────

export function PhysiologySection({ initial }: { initial: PhysiologyData | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // form state (string inputs for pace fields)
  const [vma, setVma] = useState(initial?.vma_kmh?.toString() ?? '')
  const [runPace, setRunPace] = useState(secToMinSec(initial?.run_threshold_pace_sec_per_km ?? null))
  const [hrMaxRun, setHrMaxRun] = useState(initial?.hr_max_run?.toString() ?? '')
  const [hrThreshRun, setHrThreshRun] = useState(initial?.hr_threshold_run?.toString() ?? '')
  const [ftp, setFtp] = useState(initial?.ftp_watts?.toString() ?? '')
  const [hrMax, setHrMax] = useState(initial?.hr_max?.toString() ?? '')
  const [hrThreshBike, setHrThreshBike] = useState(initial?.hr_threshold_bike?.toString() ?? '')
  const [css, setCss] = useState(secToMinSec(initial?.css_pace_sec_per_100m ?? null))

  const hasAnyData = !!(initial?.vma_kmh || initial?.ftp_watts || initial?.css_pace_sec_per_100m)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body = {
        vma_kmh: numOrNull(vma),
        run_threshold_pace_sec_per_km: minSecToSec(runPace),
        hr_max_run: numOrNull(hrMaxRun),
        hr_threshold_run: numOrNull(hrThreshRun),
        ftp_watts: numOrNull(ftp),
        hr_max: numOrNull(hrMax),
        hr_threshold_bike: numOrNull(hrThreshBike),
        css_pace_sec_per_100m: minSecToSec(css),
      }

      const res = await fetch('/api/physiology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Erreur serveur')
      }

      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ backgroundColor: DARKER, borderBottom: `1px solid ${DIV}` }}
      >
        <div>
          <p className="text-sm font-black uppercase tracking-widest" style={{ color: 'oklch(0.97 0 0)' }}>
            Données physiologiques
          </p>
          {initial?.test_date && !editing && (
            <p className="text-[10px] mt-0.5" style={{ color: 'oklch(1 0 0 / 35%)' }}>
              Dernière mesure : {new Date(initial.test_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-70"
            style={{ color: MINT, borderColor: `${MINT}40` }}
          >
            <Pencil size={11} />
            {hasAnyData ? 'Modifier' : 'Renseigner'}
          </button>
        )}
      </div>

      {/* Read mode */}
      {!editing && (
        <div className="px-5 divide-y" style={{ borderColor: DIV }}>
          {/* Running */}
          <div className="py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'oklch(1 0 0 / 30%)' }}>Course à pied</p>
            <ValueRow label="VMA" value={initial?.vma_kmh != null ? initial.vma_kmh.toFixed(1) : null} unit="km/h" />
            <ValueRow label="Allure seuil" value={initial?.run_threshold_pace_sec_per_km != null ? secToMinSec(initial.run_threshold_pace_sec_per_km) : null} unit="/km" />
            <ValueRow label="FC max" value={initial?.hr_max_run?.toString() ?? null} unit="bpm" />
            <ValueRow label="FC seuil" value={initial?.hr_threshold_run?.toString() ?? null} unit="bpm" />
          </div>
          {/* Cycling */}
          <div className="py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'oklch(1 0 0 / 30%)' }}>Vélo</p>
            <ValueRow label="FTP" value={initial?.ftp_watts?.toString() ?? null} unit="W" />
            <ValueRow label="FC max" value={initial?.hr_max?.toString() ?? null} unit="bpm" />
            <ValueRow label="FC seuil" value={initial?.hr_threshold_bike?.toString() ?? null} unit="bpm" />
          </div>
          {/* Swimming */}
          <div className="py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'oklch(1 0 0 / 30%)' }}>Natation</p>
            <ValueRow label="CSS" value={initial?.css_pace_sec_per_100m != null ? secToMinSec(initial.css_pace_sec_per_100m) : null} unit="/100m" />
          </div>

          {!hasAnyData && (
            <div className="py-4 text-center">
              <p className="text-xs" style={{ color: 'oklch(1 0 0 / 35%)' }}>
                Aucune donnée — renseigne tes valeurs pour des séances avec allures et watts précis.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="px-5 py-4 space-y-6">

          {/* ── Course ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'oklch(1 0 0 / 30%)' }}>Course à pied</p>

            <Field
              label="VMA"
              unit="km/h"
              value={vma}
              onChange={setVma}
              placeholder="ex : 16.5"
              hint={!vma && (
                <TestHint>
                  <strong>Test 6 minutes</strong> : après échauffement, cours 6 min à fond.
                  Mesure la distance parcourue. VMA ≈ distance (km) × 10.<br /><br />
                  <strong>Test Cooper 12 min</strong> : distance (m) / 12 = vitesse en m/min → ÷ 16.67 = km/h.
                </TestHint>
              )}
            />

            <Field
              label="Allure au seuil"
              unit="mm:ss / km"
              value={runPace}
              onChange={setRunPace}
              placeholder="ex : 4:30"
              hint={!runPace && (
                <TestHint>
                  <strong>Test 30 min</strong> : cours 30 min le plus vite possible à allure constante.
                  L'allure moyenne = ton allure au seuil lactique.<br /><br />
                  <strong>Depuis la VMA</strong> : seuil ≈ 85–90% VMA. À 16 km/h VMA → seuil ≈ 14 km/h → 4:17/km.
                </TestHint>
              )}
            />

            <Field
              label="FC max course"
              unit="bpm"
              value={hrMaxRun}
              onChange={setHrMaxRun}
              placeholder="ex : 185"
              hint={!hrMaxRun && (
                <TestHint>
                  Sprinte 2–3 fois 30 s à fond avec 30 s de récup après un bon échauffement.
                  La FC max = valeur la plus haute vue sur ta montre pendant l'effort.
                </TestHint>
              )}
            />

            <Field
              label="FC au seuil course"
              unit="bpm"
              value={hrThreshRun}
              onChange={setHrThreshRun}
              placeholder="ex : 168"
              hint={!hrThreshRun && (
                <TestHint>
                  Lis la FC moyenne sur tes 20–30 dernières minutes lors d'un test à allure seuil.
                  Ou estime : FC seuil ≈ 88–92% de ta FC max.
                </TestHint>
              )}
            />
          </div>

          {/* ── Vélo ───────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'oklch(1 0 0 / 30%)' }}>Vélo</p>

            <Field
              label="FTP"
              unit="watts"
              value={ftp}
              onChange={setFtp}
              placeholder="ex : 240"
              hint={!ftp && (
                <TestHint>
                  <strong>Test 20 min</strong> : après 45 min d'échauffement avec 3 × 1 min vifs,
                  pédale 20 min à fond. FTP = puissance moyenne × 0.95.<br /><br />
                  <strong>Test rampe</strong> : augmente la puissance de 20W chaque minute jusqu'à l'échec.
                  FTP ≈ puissance max atteinte × 0.75.
                </TestHint>
              )}
            />

            <Field
              label="FC max vélo"
              unit="bpm"
              value={hrMax}
              onChange={setHrMax}
              placeholder="ex : 178"
              hint={!hrMax && (
                <TestHint>
                  Généralement 5–10 bpm plus basse qu'en course.
                  Mesure lors du dernier sprint d'un test FTP ou lors d'une montée à fond.
                </TestHint>
              )}
            />

            <Field
              label="FC au seuil vélo"
              unit="bpm"
              value={hrThreshBike}
              onChange={setHrThreshBike}
              placeholder="ex : 158"
              hint={!hrThreshBike && (
                <TestHint>
                  FC moyenne des 20 dernières minutes de ton test FTP.
                  Ou estime : FC seuil vélo ≈ 88–92% de ta FC max vélo.
                </TestHint>
              )}
            />
          </div>

          {/* ── Natation ───────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'oklch(1 0 0 / 30%)' }}>Natation</p>

            <Field
              label="CSS (Critical Swim Speed)"
              unit="mm:ss / 100m"
              value={css}
              onChange={setCss}
              placeholder="ex : 1:52"
              hint={!css && (
                <TestHint>
                  <strong>Protocole CSS</strong> :<br />
                  1. Nage 400m le plus vite possible → note T400<br />
                  2. Récupère 10 min<br />
                  3. Nage 200m le plus vite possible → note T200<br /><br />
                  CSS = (400 − 200) / (T400 − T200) → exprimé en sec/100m.<br />
                  <em>Exemple : T400 = 7:00 (420s), T200 = 3:10 (190s) → CSS = 200/(230) × 100 = 87s = 1:27/100m</em>
                </TestHint>
              )}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => { setEditing(false); setError(null) }}
              disabled={saving}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 font-bold"
              style={{ backgroundColor: MINT, color: DARK }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
