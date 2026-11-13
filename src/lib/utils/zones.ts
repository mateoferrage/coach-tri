interface PhysiologyInput {
  vma_kmh?: number | null
  run_threshold_pace_sec_per_km?: number | null
  hr_max_run?: number | null
  hr_threshold_run?: number | null
  ftp_watts?: number | null
  hr_max?: number | null
  hr_threshold_bike?: number | null
  css_pace_sec_per_100m?: number | null
  // Fallback from garmin_stats when no physiology row
  vo2max_run?: number | null
  // For Karvonen zone calculation (added via migration 0018)
  resting_hr?: number | null
}

// Karvonen bounds per zone (% of heart rate reserve)
const KARVONEN_BOUNDS = [
  { lo: 0.5, hi: 0.6 }, // Z1
  { lo: 0.6, hi: 0.7 }, // Z2
  { lo: 0.7, hi: 0.8 }, // Z3
  { lo: 0.8, hi: 0.9 }, // Z4
  { lo: 0.9, hi: 1.0 }, // Z5
]

/**
 * Classify an athlete's aerobic level from VO2max and sex.
 * Uses standard normative tables (ACSM / Cooper norms).
 */
export function computeFitnessLevel(vo2max: number, sex: 'M' | 'F' | 'X'): string {
  if (sex === 'F') {
    if (vo2max < 30) return 'débutant (faible capacité aérobie)'
    if (vo2max < 38) return 'intermédiaire'
    if (vo2max < 46) return 'avancé'
    if (vo2max < 54) return 'bon niveau'
    return 'excellent / compétiteur'
  }
  // Male or non-binary (use male norms as default)
  if (vo2max < 35) return 'débutant (faible capacité aérobie)'
  if (vo2max < 44) return 'intermédiaire'
  if (vo2max < 53) return 'avancé'
  if (vo2max < 62) return 'bon niveau'
  return 'excellent / compétiteur'
}

function secToMinSec(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// VMA (km/h) from VO2max using standard linear approximation
function vmaFromVo2max(vo2max: number): number {
  return (((vo2max - 3.5) / 0.2) * 60) / 1000
}

export interface ZoneRow {
  label: string
  pace_min?: string // min pace boundary (faster end) as "m:ss"
  pace_max?: string // max pace boundary (slower end) as "m:ss"
  watts_min?: number
  watts_max?: number
  hr_min?: number
  hr_max?: number
}

export interface AthleteZones {
  run?: { header: string; zones: ZoneRow[] }
  bike?: { header: string; zones: ZoneRow[] }
  swim?: { header: string; zones: ZoneRow[] }
}

/**
 * Allure seuil ≈ 87 % de la VMA chez l'amateur entraîné (85 % débutant, 90 %
 * élite). Partagé avec la dérivation des records pour rester cohérent.
 */
export const THRESHOLD_VMA_FRACTION = 0.87

/** Allure seuil (s/km) et VMA (km/h), chacune déduite de l'autre si besoin. */
export function resolveRunThreshold(p: PhysiologyInput): {
  threshPace: number | null
  vma: number | null
} {
  let vma = p.vma_kmh ?? null
  let threshPace = p.run_threshold_pace_sec_per_km ?? null
  if (!vma && !threshPace && p.vo2max_run) vma = vmaFromVo2max(p.vo2max_run)
  if (!threshPace && vma) threshPace = 3600 / (vma * THRESHOLD_VMA_FRACTION)
  if (!vma && threshPace) vma = 3600 / (threshPace * THRESHOLD_VMA_FRACTION)
  return { threshPace, vma }
}

// Zones d'allure course (Friel), en multiple de l'allure seuil (plus grand = plus lent).
const RUN_PACE_ZONES = [
  { label: 'Z1 Récup', slowMult: null, fastMult: 1.29 },
  { label: 'Z2 Endurance', slowMult: 1.29, fastMult: 1.14 },
  { label: 'Z3 Tempo', slowMult: 1.14, fastMult: 1.06 },
  { label: 'Z4 Seuil', slowMult: 1.06, fastMult: 0.99 },
  { label: 'Z5 VO2max', slowMult: 0.99, fastMult: null },
]
const RUN_LABELS = RUN_PACE_ZONES.map((z) => z.label)

// Zones FC en % de la FC au seuil (LTHR), Friel : bornes différentes course / vélo.
const RUN_HR_ZONES = [
  { loMult: 0.0, hiMult: 0.85 },
  { loMult: 0.85, hiMult: 0.89 },
  { loMult: 0.9, hiMult: 0.94 },
  { loMult: 0.95, hiMult: 0.99 },
  { loMult: 1.0, hiMult: 1.06 },
]
const BIKE_HR_ZONES = [
  { loMult: 0.0, hiMult: 0.81 },
  { loMult: 0.81, hiMult: 0.89 },
  { loMult: 0.9, hiMult: 0.93 },
  { loMult: 0.94, hiMult: 0.99 },
  { loMult: 1.0, hiMult: 1.06 },
]
/** LTHR estimée sans test : ≈ 90 % de la FC max. */
const LTHR_FROM_FCMAX = 0.9

type HrMethod = 'lthr' | 'karvonen' | 'pct_fcmax'

/**
 * Bornes FC par zone selon la meilleure donnée disponible :
 * 1. FC seuil mesurée (test) ; 2. Karvonen (FC max + FC repos) ; 3. FC seuil
 * estimée depuis la FC max. Null si aucune FC n'est connue.
 */
function hrBounds(
  lthr: number | null,
  fcMax: number | null,
  resting: number | null,
  lthrZones: typeof RUN_HR_ZONES,
): { method: HrMethod; bounds: { lo: number; hi: number }[] } | null {
  const fromLthr = (t: number) =>
    lthrZones.map((z) => ({ lo: Math.round(t * z.loMult), hi: Math.round(t * z.hiMult) }))
  if (lthr) return { method: 'lthr', bounds: fromLthr(lthr) }
  if (fcMax && resting) {
    const reserve = fcMax - resting
    return {
      method: 'karvonen',
      bounds: KARVONEN_BOUNDS.map((b) => ({
        lo: Math.round(resting + b.lo * reserve),
        hi: Math.round(resting + b.hi * reserve),
      })),
    }
  }
  if (fcMax) return { method: 'pct_fcmax', bounds: fromLthr(Math.round(fcMax * LTHR_FROM_FCMAX)) }
  return null
}

function hrHeader(
  hr: ReturnType<typeof hrBounds>,
  lthr: number | null,
  fcMax: number | null,
  resting: number | null,
): string | null {
  if (!hr) return null
  if (hr.method === 'lthr') return `FC seuil: ${lthr} bpm`
  if (hr.method === 'karvonen') return `FC zones Karvonen (max: ${fcMax}, repos: ${resting} bpm)`
  return `FCmax: ${fcMax} bpm (FC seuil estimée)`
}

export function calculateZones(p: PhysiologyInput): AthleteZones | null {
  const result: AthleteZones = {}

  // ── Course à pied ──────────────────────────────────────────────────────────
  const { threshPace, vma } = resolveRunThreshold(p)
  const runLthr = p.hr_threshold_run ?? null
  const runFcMax = p.hr_max_run ?? p.hr_max ?? null
  const runHr = hrBounds(runLthr, runFcMax, p.resting_hr ?? null, RUN_HR_ZONES)

  if (threshPace || runHr) {
    const zones: ZoneRow[] = RUN_LABELS.map((label, i) => {
      const row: ZoneRow = { label }
      const z = RUN_PACE_ZONES[i]
      if (threshPace && z.fastMult) row.pace_min = secToMinSec(threshPace * z.fastMult)
      if (threshPace && z.slowMult) row.pace_max = secToMinSec(threshPace * z.slowMult)
      if (runHr) {
        row.hr_min = runHr.bounds[i].lo
        row.hr_max = runHr.bounds[i].hi
      }
      return row
    })
    const headerParts = [
      vma && `VMA: ${vma.toFixed(1)} km/h`,
      threshPace && `Seuil: ${secToMinSec(threshPace)}/km`,
      hrHeader(runHr, runLthr, runFcMax, p.resting_hr ?? null),
      !threshPace && 'pas d\'allure connue : prescrire à la FC et au ressenti',
    ].filter(Boolean)
    result.run = { header: `Course à pied (${headerParts.join(' | ')})`, zones }
  }

  // ── Vélo ───────────────────────────────────────────────────────────────────
  const ftp = p.ftp_watts ?? null
  const bikeLthr = p.hr_threshold_bike ?? null
  const bikeFcMax = p.hr_max ?? null
  const bikeHr = hrBounds(bikeLthr, bikeFcMax, p.resting_hr ?? null, BIKE_HR_ZONES)

  if (ftp || bikeHr) {
    // Zones Coggan (% FTP).
    const WATT_ZONES = [
      { label: 'Z1 Récup', loFtp: 0.0, hiFtp: 0.55 },
      { label: 'Z2 Endurance', loFtp: 0.56, hiFtp: 0.75 },
      { label: 'Z3 Tempo', loFtp: 0.76, hiFtp: 0.9 },
      { label: 'Z4 Seuil', loFtp: 0.91, hiFtp: 1.05 },
      { label: 'Z5 VO2max', loFtp: 1.06, hiFtp: 1.2 },
    ]
    const zones: ZoneRow[] = WATT_ZONES.map((z, i) => {
      const row: ZoneRow = { label: z.label }
      if (ftp) {
        row.watts_min = Math.round(ftp * z.loFtp)
        row.watts_max = Math.round(ftp * z.hiFtp)
      }
      if (bikeHr) {
        row.hr_min = bikeHr.bounds[i].lo
        row.hr_max = bikeHr.bounds[i].hi
      }
      return row
    })
    const headerParts = [
      ftp && `FTP: ${ftp}W`,
      hrHeader(bikeHr, bikeLthr, bikeFcMax, p.resting_hr ?? null),
      !ftp && 'pas de FTP : prescrire à la FC et au ressenti',
    ].filter(Boolean)
    result.bike = { header: `Vélo (${headerParts.join(' | ')})`, zones }
  }

  // ── Natation ───────────────────────────────────────────────────────────────
  // Zones en secondes ajoutées à la CSS (/100 m) : c'est l'écart absolu qui
  // compte en natation, pas un pourcentage.
  if (p.css_pace_sec_per_100m) {
    const css = p.css_pace_sec_per_100m
    const SWIM_ZONES = [
      { label: 'Z1 Récup', fast: 15, slow: null },
      { label: 'Z2 Endurance', fast: 8, slow: 15 },
      { label: 'Z3 Tempo', fast: 3, slow: 8 },
      { label: 'Z4 CSS/Seuil', fast: -2, slow: 3 },
      { label: 'Z5 Vitesse', fast: null, slow: -2 },
    ]
    const zones: ZoneRow[] = SWIM_ZONES.map((z) => {
      const row: ZoneRow = { label: z.label }
      // pace_min = borne rapide (moins de secondes), pace_max = borne lente.
      if (z.fast != null) row.pace_min = secToMinSec(css + z.fast)
      if (z.slow != null) row.pace_max = secToMinSec(css + z.slow)
      return row
    })
    result.swim = { header: `Natation (CSS: ${secToMinSec(css)}/100m)`, zones }
  }

  return Object.keys(result).length > 0 ? result : null
}

/** Ne garde que les zones des disciplines entraînées (toutes si inconnues). */
export function pickZones(
  zones: AthleteZones | null,
  disciplines: string[] | null,
): AthleteZones | null {
  if (!zones || !disciplines?.length) return zones
  const kept = Object.fromEntries(
    Object.entries(zones).filter(([k]) => disciplines.includes(k)),
  ) as AthleteZones
  return Object.keys(kept).length ? kept : null
}

function hrText(z: ZoneRow): string {
  return z.hr_min ? `FC ${z.hr_min}-${z.hr_max} bpm` : `FC < ${z.hr_max} bpm`
}

export function formatZonesForPrompt(zones: AthleteZones): string {
  const sections: string[] = []

  for (const [key, data] of Object.entries(zones) as [
    string,
    { header: string; zones: ZoneRow[] },
  ][]) {
    const lines: string[] = [`${data.header}:`]
    for (const z of data.zones) {
      const parts: string[] = [`  ${z.label.padEnd(14)}`]

      // pace_min = borne rapide, pace_max = borne lente ; une zone extrême n'en a qu'une.
      const paceText = (unit: string) =>
        !z.pace_max
          ? `plus lent que ${z.pace_min}${unit}`
          : !z.pace_min
            ? `plus rapide que ${z.pace_max}${unit}`
            : `${z.pace_min}-${z.pace_max}${unit}`
      if (key === 'swim') {
        parts.push(paceText('/100m'))
      } else if (key === 'run') {
        if (z.pace_min || z.pace_max) parts.push(paceText('/km'))
        if (z.hr_max) parts.push(hrText(z))
      } else if (key === 'bike') {
        if (z.watts_max) parts.push(z.watts_min ? `${z.watts_min}-${z.watts_max}W` : `< ${z.watts_max}W`)
        if (z.hr_max) parts.push(hrText(z))
      }

      lines.push(parts.join(' | '))
    }
    sections.push(lines.join('\n'))
  }

  return sections.join('\n\n')
}
