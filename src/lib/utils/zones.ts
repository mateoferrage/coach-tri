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

export function calculateZones(p: PhysiologyInput): AthleteZones | null {
  const result: AthleteZones = {}

  // ── Running ────────────────────────────────────────────────────────────────
  // Derive VMA and threshold pace from each other if only one is present
  let vma = p.vma_kmh ?? null
  let threshPace = p.run_threshold_pace_sec_per_km ?? null

  if (!vma && p.vo2max_run) {
    vma = vmaFromVo2max(p.vo2max_run)
  }
  if (!threshPace && vma) {
    // Threshold pace ≈ pace at 90% VMA for well-trained athletes
    threshPace = 3600 / (vma * 0.9)
  }
  if (!vma && threshPace) {
    vma = 3600 / (threshPace * 0.9)
  }

  if (threshPace && vma) {
    // Zone boundaries as multipliers of threshold pace (higher = slower)
    const PACE_ZONES = [
      { label: 'Z1 Récup', slowMult: null, fastMult: 1.4 },
      { label: 'Z2 Endurance', slowMult: 1.4, fastMult: 1.18 },
      { label: 'Z3 Tempo', slowMult: 1.18, fastMult: 1.07 },
      { label: 'Z4 Seuil', slowMult: 1.07, fastMult: 0.98 },
      { label: 'Z5 VO2max', slowMult: 0.98, fastMult: null },
    ]

    // HR zone method priority:
    // 1. Test-measured LTHR (hr_threshold_run)
    // 2. Karvonen when FCmax + resting_hr are both known
    // 3. Estimated LTHR = FCmax × 0.92 (fallback)
    const lthr = p.hr_threshold_run ?? null
    const hrFcMax = p.hr_max_run ?? p.hr_max ?? null
    const hrResting = p.resting_hr ?? null

    type HrMethod = 'lthr' | 'karvonen' | 'pct_fcmax' | null
    let hrMethod: HrMethod = null
    if (lthr) hrMethod = 'lthr'
    else if (hrFcMax && hrResting) hrMethod = 'karvonen'
    else if (hrFcMax) hrMethod = 'pct_fcmax'

    const HR_ZONES = [
      { loMult: 0.0, hiMult: 0.82 },
      { loMult: 0.82, hiMult: 0.89 },
      { loMult: 0.89, hiMult: 0.94 },
      { loMult: 0.94, hiMult: 1.0 },
      { loMult: 1.0, hiMult: 1.06 },
    ]

    const zones: ZoneRow[] = PACE_ZONES.map((z, i) => {
      const row: ZoneRow = { label: z.label }
      if (z.fastMult) row.pace_min = secToMinSec(threshPace! * z.fastMult)
      if (z.slowMult) row.pace_max = secToMinSec(threshPace! * z.slowMult)

      if (hrMethod === 'lthr' && lthr) {
        row.hr_min = Math.round(lthr * HR_ZONES[i].loMult)
        row.hr_max = Math.round(lthr * HR_ZONES[i].hiMult)
      } else if (hrMethod === 'karvonen' && hrFcMax && hrResting) {
        const reserve = hrFcMax - hrResting
        row.hr_min = Math.round(hrResting + KARVONEN_BOUNDS[i].lo * reserve)
        row.hr_max = Math.round(hrResting + KARVONEN_BOUNDS[i].hi * reserve)
      } else if (hrMethod === 'pct_fcmax' && hrFcMax) {
        const estLthr = Math.round(hrFcMax * 0.92)
        row.hr_min = Math.round(estLthr * HR_ZONES[i].loMult)
        row.hr_max = Math.round(estLthr * HR_ZONES[i].hiMult)
      }
      return row
    })

    const headerParts = [`VMA: ${vma.toFixed(1)} km/h`, `Seuil: ${secToMinSec(threshPace)}/km`]
    if (hrMethod === 'lthr' && lthr) headerParts.push(`FC seuil: ${lthr} bpm`)
    else if (hrMethod === 'karvonen')
      headerParts.push(`FC zones Karvonen (repos: ${hrResting} bpm)`)
    else if (hrMethod === 'pct_fcmax' && hrFcMax) headerParts.push(`FCmax: ${hrFcMax} bpm`)

    result.run = { header: `Course à pied (${headerParts.join(' | ')})`, zones }
  }

  // ── Cycling ────────────────────────────────────────────────────────────────
  if (p.ftp_watts) {
    const ftp = p.ftp_watts
    const WATT_ZONES = [
      { label: 'Z1 Récup', loFtp: 0.0, hiFtp: 0.55 },
      { label: 'Z2 Endurance', loFtp: 0.55, hiFtp: 0.75 },
      { label: 'Z3 Tempo', loFtp: 0.75, hiFtp: 0.9 },
      { label: 'Z4 Seuil', loFtp: 0.9, hiFtp: 1.05 },
      { label: 'Z5 VO2max', loFtp: 1.05, hiFtp: 1.2 },
    ]
    const lthrBike = p.hr_threshold_bike ?? null
    const bikeHrFcMax = p.hr_max ?? null
    const bikeHrResting = p.resting_hr ?? null

    type BikHrMethod = 'lthr' | 'karvonen' | 'pct_fcmax' | null
    let bikeHrMethod: BikHrMethod = null
    if (lthrBike) bikeHrMethod = 'lthr'
    else if (bikeHrFcMax && bikeHrResting) bikeHrMethod = 'karvonen'
    else if (bikeHrFcMax) bikeHrMethod = 'pct_fcmax'

    const HR_ZONES = [
      { loMult: 0.0, hiMult: 0.82 },
      { loMult: 0.82, hiMult: 0.89 },
      { loMult: 0.89, hiMult: 0.94 },
      { loMult: 0.94, hiMult: 1.0 },
      { loMult: 1.0, hiMult: 1.06 },
    ]

    const zones: ZoneRow[] = WATT_ZONES.map((z, i) => {
      const row: ZoneRow = {
        label: z.label,
        watts_min: Math.round(ftp * z.loFtp),
        watts_max: Math.round(ftp * z.hiFtp),
      }
      if (bikeHrMethod === 'lthr' && lthrBike) {
        row.hr_min = Math.round(lthrBike * HR_ZONES[i].loMult)
        row.hr_max = Math.round(lthrBike * HR_ZONES[i].hiMult)
      } else if (bikeHrMethod === 'karvonen' && bikeHrFcMax && bikeHrResting) {
        const reserve = bikeHrFcMax - bikeHrResting
        row.hr_min = Math.round(bikeHrResting + KARVONEN_BOUNDS[i].lo * reserve)
        row.hr_max = Math.round(bikeHrResting + KARVONEN_BOUNDS[i].hi * reserve)
      } else if (bikeHrMethod === 'pct_fcmax' && bikeHrFcMax) {
        const estLthr = Math.round(bikeHrFcMax * 0.92)
        row.hr_min = Math.round(estLthr * HR_ZONES[i].loMult)
        row.hr_max = Math.round(estLthr * HR_ZONES[i].hiMult)
      }
      return row
    })

    const headerParts = [`FTP: ${ftp}W`]
    if (bikeHrMethod === 'lthr' && lthrBike) headerParts.push(`FC seuil: ${lthrBike} bpm`)
    else if (bikeHrMethod === 'karvonen')
      headerParts.push(`FC zones Karvonen (repos: ${bikeHrResting} bpm)`)
    else if (bikeHrMethod === 'pct_fcmax' && bikeHrFcMax)
      headerParts.push(`FCmax: ${bikeHrFcMax} bpm`)

    result.bike = { header: `Vélo (${headerParts.join(' | ')})`, zones }
  }

  // ── Swimming ───────────────────────────────────────────────────────────────
  if (p.css_pace_sec_per_100m) {
    const css = p.css_pace_sec_per_100m
    const SWIM_ZONES = [
      { label: 'Z1 Récup', fastMult: null, slowMult: 1.35 },
      { label: 'Z2 Endurance', fastMult: 1.35, slowMult: 1.18 },
      { label: 'Z3 Tempo', fastMult: 1.18, slowMult: 1.07 },
      { label: 'Z4 CSS/Seuil', fastMult: 1.07, slowMult: 0.97 },
      { label: 'Z5 Vitesse', fastMult: 0.97, slowMult: null },
    ]

    const zones: ZoneRow[] = SWIM_ZONES.map((z) => {
      const row: ZoneRow = { label: z.label }
      if (z.fastMult) row.pace_min = secToMinSec(css * z.fastMult) // faster = min
      if (z.slowMult) row.pace_max = secToMinSec(css * z.slowMult) // slower = max
      return row
    })

    result.swim = { header: `Natation (CSS: ${secToMinSec(css)}/100m)`, zones }
  }

  return Object.keys(result).length > 0 ? result : null
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

      if (key === 'swim') {
        if (!z.pace_min) parts.push(`> ${z.pace_max}/100m`)
        else if (!z.pace_max) parts.push(`< ${z.pace_min}/100m`)
        else parts.push(`${z.pace_min}-${z.pace_max}/100m`)
      } else if (key === 'run') {
        if (!z.pace_min) parts.push(`> ${z.pace_max}/km`)
        else if (!z.pace_max) parts.push(`< ${z.pace_min}/km`)
        else parts.push(`${z.pace_min}-${z.pace_max}/km`)
        if (z.hr_min && z.hr_max) parts.push(`FC ${z.hr_min}-${z.hr_max} bpm`)
      } else if (key === 'bike') {
        if (!z.watts_min || z.watts_min === 0) parts.push(`< ${z.watts_max}W`)
        else if (!z.watts_max) parts.push(`> ${z.watts_min}W`)
        else parts.push(`${z.watts_min}-${z.watts_max}W`)
        if (z.hr_min && z.hr_max) parts.push(`FC ${z.hr_min}-${z.hr_max} bpm`)
      }

      lines.push(parts.join(' | '))
    }
    sections.push(lines.join('\n'))
  }

  return sections.join('\n\n')
}
