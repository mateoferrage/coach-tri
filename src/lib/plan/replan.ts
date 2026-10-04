export interface ReplanScopeInput {
  /** Numéros de semaines existantes du plan (1-based). */
  existingWeekNums: number[]
  /** Première semaine recalculée (incluse). Tout ce qui précède est figé. */
  cutoffWeek: number
  /** Nombre total de semaines du nouveau plan (nouvel horizon). */
  newTotalWeeks: number
}

export interface ReplanScope {
  /** Semaines conservées intactes (< cutoff). */
  preservedWeeks: number[]
  /** Semaines existantes à régénérer (>= cutoff, <= newTotalWeeks). */
  regenerateWeeks: number[]
  /** Semaines à créer (extension au-delà de l'horizon existant). */
  createWeeks: number[]
  /** Semaines existantes à supprimer (au-delà du nouvel horizon raccourci). */
  deleteWeeks: number[]
}

/**
 * Détermine le périmètre d'une replanification : fige le passé (< cutoff),
 * recalcule la queue, étend ou raccourcit l'horizon selon le nouveau pic.
 */
export function computeReplanScope(input: ReplanScopeInput): ReplanScope {
  const { existingWeekNums, cutoffWeek, newTotalWeeks } = input
  const existing = [...existingWeekNums].sort((a, b) => a - b)
  const maxExisting = existing.length ? existing[existing.length - 1] : 0

  const preservedWeeks = existing.filter((w) => w < cutoffWeek)
  const regenerateWeeks = existing.filter((w) => w >= cutoffWeek && w <= newTotalWeeks)
  const deleteWeeks = existing.filter((w) => w > newTotalWeeks)

  const createWeeks: number[] = []
  for (let w = Math.max(maxExisting, cutoffWeek - 1) + 1; w <= newTotalWeeks; w++) {
    createWeeks.push(w)
  }

  return { preservedWeeks, regenerateWeeks, createWeeks, deleteWeeks }
}
