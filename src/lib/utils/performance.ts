// Dérivation des seuils d'entraînement à partir des performances de référence
// (records). Modèle de Vitesse Critique (CV) : distance = CV · temps + D', où la
// pente CV (m/s) approxime la vitesse au seuil. Fallback : formule de Riegel.

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

/**
 * Dérive une allure/pace au seuil (s par `unitDistance_m`) à partir de records.
 * ≥ 2 records → vitesse critique ; 1 record → Riegel vers `anchor_m`.
 */
function deriveThresholdPace(
  records: DistanceRecord[],
  unitDistance_m: number,
  anchor_m: number,
): number | null {
  if (records.length === 0) return null

  const cv = criticalVelocity(records)
  if (cv) return Math.round(unitDistance_m / cv)

  // Fallback un seul record (ou CV dégénéré) : Riegel vers l'ancre.
  const longest = records.reduce((a, b) => (b.distance_m > a.distance_m ? b : a))
  const anchorTime = riegelPredict(longest, anchor_m)
  const speed = anchor_m / anchorTime // m/s
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
  return list
}

/** Allure au seuil en s/km depuis les records course (ancre Riegel : 10 km). */
export function deriveRunThresholdPaceSecPerKm(r: RunRecords): number | null {
  return deriveThresholdPace(runRecordList(r), 1000, 10000)
}

/** CSS en s/100m depuis les records nage (ancre Riegel : 400 m). */
export function deriveSwimCssSecPer100m(r: SwimRecords): number | null {
  return deriveThresholdPace(swimRecordList(r), 100, 400)
}

/** VMA (km/h) depuis l'allure seuil : seuil ≈ 90 % VMA. */
export function deriveVmaKmh(thresholdPaceSecPerKm: number | null): number | null {
  if (!thresholdPaceSecPerKm || thresholdPaceSecPerKm <= 0) return null
  const thresholdSpeedMs = 1000 / thresholdPaceSecPerKm
  const vmaMs = thresholdSpeedMs / 0.9
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
