// Calculs déterministes autour de la course visée : temps prédit à partir du
// niveau actuel et D+ hebdomadaire cible en trail. Faits en code plutôt que
// laissés à l'IA, qui calcule mal et de façon instable.

const RIEGEL_EXP = 1.06
/** Au-delà du marathon, la fatigue s'accumule plus vite que ne le prévoit Riegel. */
const RIEGEL_EXP_ULTRA = 1.08
const RIEGEL_EXP_LONG_ULTRA = 1.1
const MARATHON_M = 42195
const LONG_ULTRA_EFFORT_M = 100000
/** Règle du « km-effort » : 100 m de D+ ≈ 1 km de plat. */
const ELEVATION_M_PER_EFFORT_KM = 100
/** Ralentissement dû au terrain, en plus du dénivelé (descentes, appuis). */
const SURFACE_FACTOR: Record<string, number> = {
  road: 1,
  gravel: 1.03,
  technical: 1.1,
  mountain: 1.18,
}
/** « Terminer » : allure confortable, ~8 % plus lente que le meilleur temps possible. */
const COMFORT_FACTOR = 1.08

export interface RunRace {
  distance_m: number
  elevation_gain_m?: number | null
  surface?: string | null
  trail: boolean
}

/** Distance « effort » (m) : distance + D+ converti en km de plat (trail). */
export function effortDistanceM(race: RunRace): number {
  const gain = race.trail ? (race.elevation_gain_m ?? 0) : 0
  return race.distance_m + (gain / ELEVATION_M_PER_EFFORT_KM) * 1000
}

/**
 * Temps de course prédit (s) au niveau actuel, à partir de l'allure seuil
 * (allure tenable ~1 h) : Riegel sur la distance effort, puis facteur terrain.
 */
export function predictRunTimeS(thresholdPaceSecPerKm: number, race: RunRace): number {
  const oneHourDistance = (3600 / thresholdPaceSecPerKm) * 1000
  const effort = effortDistanceM(race)
  const exp =
    effort > LONG_ULTRA_EFFORT_M
      ? RIEGEL_EXP_LONG_ULTRA
      : effort > MARATHON_M
        ? RIEGEL_EXP_ULTRA
        : RIEGEL_EXP
  const flatTime = 3600 * Math.pow(effort / oneHourDistance, exp)
  const surface = race.trail ? (SURFACE_FACTOR[race.surface ?? ''] ?? 1.05) : 1
  return Math.round(flatTime * surface)
}

/** Temps confortable pour l'objectif « terminer ». */
export function comfortableFinishTimeS(thresholdPaceSecPerKm: number, race: RunRace): number {
  return Math.round(predictRunTimeS(thresholdPaceSecPerKm, race) * COMFORT_FACTOR)
}

/** Écart (%) entre le chrono visé et le temps prédit : > 0 = objectif plus rapide que le niveau actuel. */
export function targetGapPct(targetTimeS: number, predictedTimeS: number): number {
  return Math.round(((predictedTimeS - targetTimeS) / predictedTimeS) * 1000) / 10
}

// ─── D+ hebdomadaire (trail) ───────────────────────────────────────────────────

export interface WeekOverview {
  week_num: number
  phase: string
  is_recovery_week: boolean
}

/**
 * Pic de D+ hebdomadaire visé selon le D+ de la course (Uphill Athlete) : on
 * dépasse le D+ de course pour les formats courts, on s'en approche (90-100 %)
 * pour les longs, plafonné pour rester absorbable.
 */
export function peakWeeklyElevationM(raceGainM: number): number {
  const factor = raceGainM <= 1500 ? 1.3 : raceGainM <= 4000 ? 1.0 : 0.9
  return Math.round(Math.min(raceGainM * factor, 6000))
}

/**
 * D+ cible d'une semaine : 50 % du pic au départ, montée linéaire jusqu'au pic
 * sur les semaines de charge (base → build → peak), −35 % en récupération,
 * puis décharge à l'affûtage. Plafonné par le temps de course réellement
 * disponible (~350 m de D+ par heure de course en moyenne).
 */
export function weeklyElevationTargetM(params: {
  raceGainM: number
  week: WeekOverview
  overview: WeekOverview[]
  runHours: number
}): number {
  const { raceGainM, week, overview, runHours } = params
  const peak = peakWeeklyElevationM(raceGainM)
  const loadWeeks = overview.filter(
    (w) => !w.is_recovery_week && ['prep', 'base', 'build', 'peak'].includes(w.phase),
  )
  let ratio: number
  if (week.phase === 'taper') ratio = 0.45
  else if (week.phase === 'race') ratio = 0.25
  else {
    const idx = loadWeeks.filter((w) => w.week_num <= week.week_num).length - 1
    const span = Math.max(1, loadWeeks.length - 1)
    ratio = 0.5 + 0.5 * Math.min(1, Math.max(0, idx) / span)
    if (week.is_recovery_week) ratio *= 0.65
  }
  const cap = runHours * 350
  return Math.round(Math.min(peak * ratio, cap) / 50) * 50
}

/** Profil d'un trail selon son D+ par km. */
export function trailProfile(distanceM: number, gainM: number): string {
  const perKm = gainM / (distanceM / 1000)
  if (perKm < 20) return 'roulant (< 20 m D+/km)'
  if (perKm < 40) return 'vallonné (20-40 m D+/km)'
  if (perKm < 60) return 'montagneux (40-60 m D+/km)'
  return 'très montagneux (> 60 m D+/km) : marche active en montée incontournable'
}
