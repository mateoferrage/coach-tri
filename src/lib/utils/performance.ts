// Dérivation des seuils d'entraînement à partir des performances de référence
// (records). Modèle de Vitesse Critique (CV) : distance = CV · temps + D', où la
// pente CV (m/s) approxime la vitesse au seuil. Fallback : formule de Riegel.

import { THRESHOLD_VMA_FRACTION } from './zones'

const RIEGEL_EXP = 1.06

export interface DistanceRecord {
  distance_m: number
  time_s: number
}

export interface RunRecords {
  run_5k_time_s?: number | null
  run_10k_time_s?: number | null
  run_half_time_s?: number | null
}

export interface SwimRecords {
  swim_100m_time_s?: number | null
  swim_200m_time_s?: number | null
  swim_400m_time_s?: number | null
  swim_800m_time_s?: number | null
}

const HALF_MARATHON_M = 21097.5

/**
 * Ajuste distance = CV · temps + D' par moindres carrés et retourne CV (m/s).
 * Retourne null si < 2 points ou si la pente n'est pas physiologique (≤ 0).
 */
export function criticalVelocity(records: DistanceRecord[]): number | null {
  if (records.length < 2) return null

  const n = records.length
  let sumT = 0
  let sumD = 0
  let sumTT = 0
  let sumTD = 0
  for (const r of records) {
    sumT += r.time_s
    sumD += r.distance_m
    sumTT += r.time_s * r.time_s
    sumTD += r.time_s * r.distance_m
  }
  const denom = n * sumTT - sumT * sumT
  if (denom === 0) return null
  const cv = (n * sumTD - sumT * sumD) / denom
  return cv > 0 ? cv : null
}

/** Prédit le temps (s) sur targetDistance_m à partir d'un record via Riegel. */
export function riegelPredict(base: DistanceRecord, targetDistance_m: number): number {
  return base.time_s * Math.pow(targetDistance_m / base.distance_m, RIEGEL_EXP)
}

/** Distance (m) couverte en `durationS` selon Riegel à partir d'un record. */
export function riegelDistanceFor(base: DistanceRecord, durationS: number): number {
  return base.distance_m * Math.pow(durationS / base.time_s, 1 / RIEGEL_EXP)
}

/** Ancre du seuil quand un seul record est connu : une durée ou une distance. */
type ThresholdAnchor = { duration_s: number } | { distance_m: number }

/**
 * Dérive une allure/pace au seuil (s par `unitDistance_m`) à partir de records.
 * ≥ 2 records → vitesse critique ; 1 record → Riegel vers l'ancre.
 */
function deriveThresholdPace(
  records: DistanceRecord[],
  unitDistance_m: number,
  anchor: ThresholdAnchor,
): number | null {
  if (records.length === 0) return null

  const cv = criticalVelocity(records)
  if (cv) return Math.round(unitDistance_m / cv)

  // Fallback un seul record (ou CV dégénéré) : Riegel vers l'ancre.
  const longest = records.reduce((a, b) => (b.distance_m > a.distance_m ? b : a))
  const speed =
    'duration_s' in anchor
      ? riegelDistanceFor(longest, anchor.duration_s) / anchor.duration_s
      : anchor.distance_m / riegelPredict(longest, anchor.distance_m) // m/s
  return Math.round(unitDistance_m / speed)
}

function runRecordList(r: RunRecords): DistanceRecord[] {
  const list: DistanceRecord[] = []
  if (r.run_5k_time_s) list.push({ distance_m: 5000, time_s: r.run_5k_time_s })
  if (r.run_10k_time_s) list.push({ distance_m: 10000, time_s: r.run_10k_time_s })
  if (r.run_half_time_s) list.push({ distance_m: HALF_MARATHON_M, time_s: r.run_half_time_s })
  return list
}

function swimRecordList(r: SwimRecords): DistanceRecord[] {
  const list: DistanceRecord[] = []
  if (r.swim_100m_time_s) list.push({ distance_m: 100, time_s: r.swim_100m_time_s })
  if (r.swim_200m_time_s) list.push({ distance_m: 200, time_s: r.swim_200m_time_s })
  if (r.swim_400m_time_s) list.push({ distance_m: 400, time_s: r.swim_400m_time_s })
  if (r.swim_800m_time_s) list.push({ distance_m: 800, time_s: r.swim_800m_time_s })
  // Le 100 m est trop anaérobie pour la CSS : on l'écarte dès que 2 records plus longs existent.
  const aerobic = list.filter((x) => x.distance_m >= 200)
  return aerobic.length >= 2 ? aerobic : list
}

/**
 * Allure au seuil en s/km depuis les records course. Un seul record : allure
 * tenable 1 h (définition du seuil), et non l'allure 10 km, trop rapide.
 */
export function deriveRunThresholdPaceSecPerKm(r: RunRecords): number | null {
  return deriveThresholdPace(runRecordList(r), 1000, { duration_s: 3600 })
}

/**
 * CSS en s/100m depuis les records nage. Un seul record : allure 1 500 m
 * (proche de la CSS), et non l'allure 400 m, 5 à 10 s/100 m trop rapide.
 */
export function deriveSwimCssSecPer100m(r: SwimRecords): number | null {
  return deriveThresholdPace(swimRecordList(r), 100, { distance_m: 1500 })
}

/** VMA (km/h) depuis l'allure seuil. */
export function deriveVmaKmh(thresholdPaceSecPerKm: number | null): number | null {
  if (!thresholdPaceSecPerKm || thresholdPaceSecPerKm <= 0) return null
  const thresholdSpeedMs = 1000 / thresholdPaceSecPerKm
  const vmaMs = thresholdSpeedMs / THRESHOLD_VMA_FRACTION
  return Math.round(vmaMs * 3.6 * 10) / 10 // km/h, 1 décimale
}

export interface DerivedPhysiology {
  run_threshold_pace_sec_per_km: number | null
  css_pace_sec_per_100m: number | null
  vma_kmh: number | null
}

/** Agrège toutes les dérivations à partir des records course + nage. */
export function derivePhysiologyFromRecords(records: RunRecords & SwimRecords): DerivedPhysiology {
  const run_threshold_pace_sec_per_km = deriveRunThresholdPaceSecPerKm(records)
  return {
    run_threshold_pace_sec_per_km,
    css_pace_sec_per_100m: deriveSwimCssSecPer100m(records),
    vma_kmh: deriveVmaKmh(run_threshold_pace_sec_per_km),
  }
}

/**
 * Recalcule les seuils à la lecture depuis les records (source de vérité) :
 * les valeurs stockées peuvent dater d'une ancienne formule. Sans record, les
 * valeurs stockées sont conservées.
 */
export function withFreshDerivations<T extends RunRecords & SwimRecords & Partial<DerivedPhysiology>>(
  row: T,
): T {
  const d = derivePhysiologyFromRecords(row)
  return {
    ...row,
    run_threshold_pace_sec_per_km:
      d.run_threshold_pace_sec_per_km ?? row.run_threshold_pace_sec_per_km ?? null,
    vma_kmh: d.vma_kmh ?? row.vma_kmh ?? null,
    css_pace_sec_per_100m: d.css_pace_sec_per_100m ?? row.css_pace_sec_per_100m ?? null,
  }
}
