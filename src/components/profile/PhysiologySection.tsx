'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Pencil, FlaskConical, HeartPulse } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Format seconds as "m:ss" (used for pace values, always < 60 min).
function secToMinSec(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Format a duration as "m:ss" or "h:mm:ss" (records can exceed an hour: semi).
function secToDuration(sec: number | null): string {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Parse "h:mm:ss", "mm:ss" or a raw number of seconds into seconds.
function durationToSec(str: string): number | null {
  const clean = str.trim()
  if (!clean) return null
  const parts = clean.split(':')
  if (parts.length === 3) {
    const [h, m, s] = parts.map((p) => parseInt(p, 10))
    if (![h, m, s].some(isNaN)) return h * 3600 + m * 60 + s
  }
  if (parts.length === 2) {
    const [m, s] = parts.map((p) => parseInt(p, 10))
    if (![m, s].some(isNaN)) return m * 60 + s
  }
  const n = parseFloat(clean)
  return isNaN(n) ? null : Math.round(n)
}

function intOrNull(v: string): number | null {
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
}

// ── Test suggestion tooltip ───────────────────────────────────────────────────

function TestHint({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-sm text-xs font-semibold text-primary-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <FlaskConical aria-hidden className="size-3.5" />
        Comment mesurer ?
        {open ? (
          <ChevronUp aria-hidden className="size-3.5" />
        ) : (
          <ChevronDown aria-hidden className="size-3.5" />
        )}
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-accent p-3 text-xs leading-relaxed text-foreground">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Field components ─────────────────────────────────────────────────────────

function Field({
  label,
  unit,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  unit?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: React.ReactNode
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {unit && <span className="font-mono text-xs text-muted-foreground">{unit}</span>}
      </div>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        className="h-9 text-sm font-semibold tabular-nums"
      />
      {hint}
    </div>
  )
}

// ── Display tile (read mode) ──────────────────────────────────────────────────

function ValueRow({
  label,
  value,
  unit,
  estimated,
  measured,
}: {
  label: string
  value: string | null
  unit?: string
  estimated?: boolean
  measured?: boolean
}) {
  return (
    <div className="space-y-0.5">
      <p
        className={
          value
            ? 'font-display text-xl leading-tight font-bold text-primary-ink tabular-nums'
            : 'font-display text-xl leading-tight font-bold text-muted-foreground'
        }
      >
        {value ?? '—'}
        {value && unit ? (
          <span className="ml-1 font-sans text-xs font-medium text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      <p className="text-xs text-muted-foreground">
        {label}
        {measured ? (
          <span className="ml-1">(test)</span>
        ) : (
          estimated && <span className="ml-1">(estimé)</span>
        )}
      </p>
    </div>
  )
}

function GroupLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
      {icon}
      {children}
    </p>
  )
}

const iconClass = 'size-4 text-primary-ink'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PhysiologyData {
  // Records saisis
  run_5k_time_s: number | null
  run_10k_time_s: number | null
  run_half_time_s: number | null
  swim_100m_time_s: number | null
  swim_200m_time_s: number | null
  swim_400m_time_s: number | null
  swim_800m_time_s: number | null
  // Vélo + cardio saisis
  ftp_watts: number | null
  hr_max: number | null
  resting_hr: number | null
  // Seuils dérivés (lecture seule)
  vma_kmh: number | null
  run_threshold_pace_sec_per_km: number | null
  css_pace_sec_per_100m: number | null
  // Mesurées par un test de terrain (page de la séance de test)
  hr_threshold_run?: number | null
  hr_threshold_bike?: number | null
  measured_fields?: string[] | null
  test_date: string | null
}

// ── Main component ────────────────────────────────────────────────────────────

export function PhysiologySection({ initial }: { initial: PhysiologyData | null }) {
  const router = useRouter()
  const isMeasured = (f: string) => !!initial?.measured_fields?.includes(f)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // form state (records as mm:ss / h:mm:ss strings)
  const [run5k, setRun5k] = useState(secToDuration(initial?.run_5k_time_s ?? null))
  const [run10k, setRun10k] = useState(secToDuration(initial?.run_10k_time_s ?? null))
  const [runHalf, setRunHalf] = useState(secToDuration(initial?.run_half_time_s ?? null))
  const [swim100, setSwim100] = useState(secToDuration(initial?.swim_100m_time_s ?? null))
  const [swim200, setSwim200] = useState(secToDuration(initial?.swim_200m_time_s ?? null))
  const [swim400, setSwim400] = useState(secToDuration(initial?.swim_400m_time_s ?? null))
  const [swim800, setSwim800] = useState(secToDuration(initial?.swim_800m_time_s ?? null))
  const [ftp, setFtp] = useState(initial?.ftp_watts?.toString() ?? '')
  const [hrMax, setHrMax] = useState(initial?.hr_max?.toString() ?? '')
  const [restingHr, setRestingHr] = useState(initial?.resting_hr?.toString() ?? '')

  const hasAnyData = !!(
    initial?.run_5k_time_s ||
    initial?.run_10k_time_s ||
    initial?.run_half_time_s ||
    initial?.swim_100m_time_s ||
    initial?.swim_200m_time_s ||
    initial?.swim_400m_time_s ||
    initial?.swim_800m_time_s ||
    initial?.ftp_watts ||
    initial?.hr_max
  )

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body = {
        run_5k_time_s: durationToSec(run5k),
        run_10k_time_s: durationToSec(run10k),
        run_half_time_s: durationToSec(runHalf),
        swim_100m_time_s: durationToSec(swim100),
        swim_200m_time_s: durationToSec(swim200),
        swim_400m_time_s: durationToSec(swim400),
        swim_800m_time_s: durationToSec(swim800),
        ftp_watts: intOrNull(ftp),
        hr_max: intOrNull(hrMax),
        resting_hr: intOrNull(restingHr),
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
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-base">Performances de référence</h3>
          {initial?.test_date && !editing && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dernière mise à jour :{' '}
              {new Date(initial.test_date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        {!editing && (
          <Button variant="outline-primary" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            {hasAnyData ? 'Modifier' : 'Renseigner'}
          </Button>
        )}
      </div>

      {/* Read mode */}
      {!editing && (
        <div className="px-5">
          {/* Running */}
          <div className="border-t border-border py-4 first:border-t-0">
            <GroupLabel icon={<DisciplineIcon discipline="run" className={iconClass} />}>
              Course à pied
            </GroupLabel>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ValueRow
                label="5 km"
                value={secToDuration(initial?.run_5k_time_s ?? null) || null}
              />
              <ValueRow
                label="10 km"
                value={secToDuration(initial?.run_10k_time_s ?? null) || null}
              />
              <ValueRow
                label="Semi"
                value={secToDuration(initial?.run_half_time_s ?? null) || null}
              />
              <ValueRow
                label="Allure seuil"
                value={
                  initial?.run_threshold_pace_sec_per_km != null
                    ? secToMinSec(initial.run_threshold_pace_sec_per_km)
                    : null
                }
                unit="/km"
                estimated
                measured={isMeasured('run_threshold_pace_sec_per_km')}
              />
              <ValueRow
                label="VMA"
                value={initial?.vma_kmh != null ? initial.vma_kmh.toFixed(1) : null}
                unit="km/h"
                estimated
                measured={isMeasured('vma_kmh')}
              />
            </div>
          </div>
          {/* Cycling */}
          <div className="border-t border-border py-4 first:border-t-0">
            <GroupLabel icon={<DisciplineIcon discipline="bike" className={iconClass} />}>
              Vélo
            </GroupLabel>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ValueRow
                label="FTP"
                value={initial?.ftp_watts?.toString() ?? null}
                unit="W"
                measured={isMeasured('ftp_watts')}
              />
            </div>
          </div>
          {/* Swimming */}
          <div className="border-t border-border py-4 first:border-t-0">
            <GroupLabel icon={<DisciplineIcon discipline="swim" className={iconClass} />}>
              Natation
            </GroupLabel>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ValueRow
                label="100 m"
                value={secToDuration(initial?.swim_100m_time_s ?? null) || null}
              />
              <ValueRow
                label="200 m"
                value={secToDuration(initial?.swim_200m_time_s ?? null) || null}
              />
              <ValueRow
                label="400 m"
                value={secToDuration(initial?.swim_400m_time_s ?? null) || null}
              />
              <ValueRow
                label="800 m"
                value={secToDuration(initial?.swim_800m_time_s ?? null) || null}
              />
              <ValueRow
                label="CSS"
                value={
                  initial?.css_pace_sec_per_100m != null
                    ? secToMinSec(initial.css_pace_sec_per_100m)
                    : null
                }
                unit="/100m"
                estimated
              />
            </div>
          </div>
          {/* Cardio */}
          <div className="border-t border-border py-4 first:border-t-0">
            <GroupLabel icon={<HeartPulse aria-hidden className={iconClass} />}>
              Fréquence cardiaque
            </GroupLabel>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ValueRow label="FC max" value={initial?.hr_max?.toString() ?? null} unit="bpm" />
              <ValueRow
                label="FC repos"
                value={initial?.resting_hr?.toString() ?? null}
                unit="bpm"
              />
              {initial?.hr_threshold_run != null && (
                <ValueRow
                  label="FC seuil course"
                  value={initial.hr_threshold_run.toString()}
                  unit="bpm"
                  measured
                />
              )}
              {initial?.hr_threshold_bike != null && (
                <ValueRow
                  label="FC seuil vélo"
                  value={initial.hr_threshold_bike.toString()}
                  unit="bpm"
                  measured
                />
              )}
            </div>
          </div>

          {!hasAnyData && (
            <div className="border-t border-border py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Aucune donnée — renseigne tes records pour des séances avec allures et watts précis.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="space-y-6 px-5 py-5">
          {/* ── Course ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <GroupLabel icon={<DisciplineIcon discipline="run" className={iconClass} />}>
              Course à pied — tes meilleurs temps
            </GroupLabel>

            <Field
              label="5 km"
              unit="mm:ss"
              value={run5k}
              onChange={setRun5k}
              placeholder="ex : 22:30"
            />
            <Field
              label="10 km"
              unit="mm:ss"
              value={run10k}
              onChange={setRun10k}
              placeholder="ex : 47:00"
            />
            <Field
              label="Semi-marathon"
              unit="h:mm:ss"
              value={runHalf}
              onChange={setRunHalf}
              placeholder="ex : 1:45:00"
              hint={
                !run5k &&
                !run10k &&
                !runHalf && (
                  <TestHint>
                    Renseigne au moins un temps de course récent, réalisé à fond sur une distance
                    connue (chrono officiel ou séance test). Plus tu en donnes, plus l&apos;allure
                    au seuil et la VMA estimées sont précises.
                  </TestHint>
                )
              }
            />
          </div>

          {/* ── Vélo ───────────────────────────────────────────────────── */}
          <div className="space-y-3 border-t border-border pt-6">
            <GroupLabel icon={<DisciplineIcon discipline="bike" className={iconClass} />}>
              Vélo
            </GroupLabel>

            <Field
              label="FTP"
              unit="watts"
              value={ftp}
              onChange={setFtp}
              placeholder="ex : 240"
              hint={
                !ftp && (
                  <TestHint>
                    <strong>Test 20 min</strong> : après 45 min d&apos;échauffement avec 3 × 1 min
                    vifs, pédale 20 min à fond. FTP = puissance moyenne × 0.95.
                    <br />
                    <br />
                    <strong>Test rampe</strong> : augmente la puissance de 20W chaque minute
                    jusqu&apos;à l&apos;échec. FTP ≈ puissance max atteinte × 0.75.
                  </TestHint>
                )
              }
            />
          </div>

          {/* ── Natation ───────────────────────────────────────────────── */}
          <div className="space-y-3 border-t border-border pt-6">
            <GroupLabel icon={<DisciplineIcon discipline="swim" className={iconClass} />}>
              Natation — tes meilleurs temps
            </GroupLabel>

            <Field
              label="100 m"
              unit="mm:ss"
              value={swim100}
              onChange={setSwim100}
              placeholder="ex : 1:35"
            />
            <Field
              label="200 m"
              unit="mm:ss"
              value={swim200}
              onChange={setSwim200}
              placeholder="ex : 3:20"
            />
            <Field
              label="400 m"
              unit="mm:ss"
              value={swim400}
              onChange={setSwim400}
              placeholder="ex : 7:00"
            />
            <Field
              label="800 m"
              unit="mm:ss"
              value={swim800}
              onChange={setSwim800}
              placeholder="ex : 14:30"
              hint={
                !swim100 &&
                !swim200 &&
                !swim400 &&
                !swim800 && (
                  <TestHint>
                    Nage chaque distance à fond, en bassin, départ chrono. Deux distances suffisent
                    pour estimer ton CSS (Critical Swim Speed) ; le protocole classique est 400 m
                    puis 200 m après 10 min de récup.
                  </TestHint>
                )
              }
            />
          </div>

          {/* ── Fréquence cardiaque ────────────────────────────────────── */}
          <div className="space-y-3 border-t border-border pt-6">
            <GroupLabel icon={<HeartPulse aria-hidden className={iconClass} />}>
              Fréquence cardiaque
            </GroupLabel>

            <Field
              label="FC max"
              unit="bpm"
              value={hrMax}
              onChange={setHrMax}
              placeholder="ex : 188"
              hint={
                !hrMax && (
                  <TestHint>
                    Sprinte 2–3 fois 30 s à fond avec 30 s de récup après un bon échauffement. La FC
                    max = valeur la plus haute vue sur ta montre pendant l&apos;effort.
                  </TestHint>
                )
              }
            />

            <Field
              label="FC de repos"
              unit="bpm"
              value={restingHr}
              onChange={setRestingHr}
              placeholder="ex : 48"
              hint={
                !restingHr && (
                  <TestHint>
                    Mesure le matin au réveil, avant de te lever, après 5 min allongé. Utiliser la
                    valeur moyenne sur 3–5 jours consécutifs. Utilisée pour le calcul des zones FC
                    par la méthode Karvonen.
                  </TestHint>
                )
              }
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 border-t border-border pt-5">
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
              disabled={saving}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
