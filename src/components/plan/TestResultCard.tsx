'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/common/SectionLabel'

export type TestKind = 'run' | 'bike' | 'swim'

export interface TestPrefill {
  distance_m?: number | null
  avg_hr?: number | null
  avg_power?: number | null
}

const INTRO: Record<TestKind, string> = {
  run: "Après l'échauffement, 30 min à fond et régulier sur terrain plat. Note la distance parcourue sur les 30 min et ta FC moyenne des 20 dernières minutes (fonction « tour » de la montre à 10 min).",
  bike: 'Après l’échauffement, 20 min à fond et régulier. Note ta puissance moyenne sur ces 20 min (capteur de puissance ou home-trainer).',
  swim: 'Un 400 m chronométré à fond, 10 min de récupération, puis un 200 m à fond. Note les deux chronos.',
}

/** "6:40" ou "400" (s) → secondes. */
function parseDuration(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  if (t.includes(':')) {
    const [m, s] = t.split(':').map((x) => parseInt(x, 10))
    return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : null
  }
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

const toInt = (v: string) => {
  const n = Math.round(parseFloat(v.replace(',', '.')))
  return Number.isFinite(n) ? n : null
}

/**
 * Saisie du résultat d'une séance de test : met à jour les zones du profil
 * (allure et FC seuil, FTP ou CSS) utilisées pour les semaines générées ensuite.
 */
export function TestResultCard({ kind, prefill }: { kind: TestKind; prefill?: TestPrefill }) {
  const router = useRouter()
  const id = useId()
  const [distanceKm, setDistanceKm] = useState(
    prefill?.distance_m ? String(Math.round(prefill.distance_m / 10) / 100) : '',
  )
  const [hr, setHr] = useState(prefill?.avg_hr ? String(Math.round(prefill.avg_hr)) : '')
  const [power, setPower] = useState(prefill?.avg_power ? String(Math.round(prefill.avg_power)) : '')
  const [t400, setT400] = useState('')
  const [t200, setT200] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string[] | null>(null)

  function body(): Record<string, unknown> | string {
    if (kind === 'run') {
      const km = parseFloat(distanceKm.replace(',', '.'))
      if (!(km > 0)) return 'Indique la distance parcourue en 30 min.'
      return { kind, distance_m: Math.round(km * 1000), avg_hr: hr ? toInt(hr) : null }
    }
    if (kind === 'bike') {
      const p = toInt(power)
      if (!p) return 'Indique ta puissance moyenne sur 20 min.'
      return { kind, avg_power_20min: p }
    }
    const a = parseDuration(t400)
    const b = parseDuration(t200)
    if (!a || !b) return 'Indique tes chronos sur 400 m et 200 m (ex. 7:00 et 3:10).'
    return { kind, t400_s: a, t200_s: b }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = body()
    if (typeof payload === 'string') {
      setError(payload)
      return
    }
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/physiology/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { summary?: string[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setSummary(json.summary ?? [])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer le résultat")
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <SectionLabel id={`${id}-title`}>Résultat du test</SectionLabel>

      {summary ? (
        <div role="status" className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 aria-hidden className="size-5 text-primary-ink" />
            Zones mises à jour
          </p>
          <ul className="space-y-0.5 text-sm tabular-nums">
            {summary.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Les prochaines semaines générées utiliseront ces valeurs. Tu les retrouves dans ton
            profil.
          </p>
          <Button variant="link" size="sm" className="px-0" onClick={() => setSummary(null)}>
            Corriger le résultat
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-sm text-muted-foreground">{INTRO[kind]}</p>

          {kind === 'run' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-distance`}>Distance en 30 min</Label>
                <div className="relative">
                  <Input
                    id={`${id}-distance`}
                    inputMode="decimal"
                    placeholder="Ex : 6,5"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    className="h-10 pr-10"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                    km
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-hr`}>FC moyenne</Label>
                <div className="relative">
                  <Input
                    id={`${id}-hr`}
                    inputMode="numeric"
                    placeholder="Ex : 172"
                    value={hr}
                    onChange={(e) => setHr(e.target.value)}
                    className="h-10 pr-12"
                    aria-describedby={`${id}-hr-hint`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                    bpm
                  </span>
                </div>
                <p id={`${id}-hr-hint`} className="text-xs text-muted-foreground">
                  Des 20 dernières minutes (facultatif)
                </p>
              </div>
            </div>
          )}

          {kind === 'bike' && (
            <div className="space-y-1.5 sm:max-w-[50%]">
              <Label htmlFor={`${id}-power`}>Puissance moyenne sur 20 min</Label>
              <div className="relative">
                <Input
                  id={`${id}-power`}
                  inputMode="numeric"
                  placeholder="Ex : 250"
                  value={power}
                  onChange={(e) => setPower(e.target.value)}
                  className="h-10 pr-8"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  W
                </span>
              </div>
            </div>
          )}

          {kind === 'swim' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-t400`}>Chrono 400 m</Label>
                <Input
                  id={`${id}-t400`}
                  placeholder="Ex : 7:00"
                  value={t400}
                  onChange={(e) => setT400(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-t200`}>Chrono 200 m</Label>
                <Input
                  id={`${id}-t200`}
                  placeholder="Ex : 3:10"
                  value={t200}
                  onChange={(e) => setT200(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" variant="default" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 aria-hidden className="animate-spin" />
                Enregistrement…
              </>
            ) : (
              'Mettre à jour mes zones'
            )}
          </Button>
        </form>
      )}
    </section>
  )
}
