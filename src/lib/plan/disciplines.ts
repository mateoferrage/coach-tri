export type Sport = 'triathlon' | 'running'

const DISCIPLINE_ORDER = ['swim', 'bike', 'run', 'strength'] as const

const DISCIPLINES_BY_SPORT: Record<Sport, string[]> = {
  triathlon: ['swim', 'bike', 'run', 'strength'],
  running: ['run', 'strength'],
}

/**
 * Union ordonnée et dédupliquée des disciplines d'entraînement couvertes par
 * un ensemble de courses. Sans course, on retombe sur le triathlon complet.
 */
export function disciplinesForGoals(goals: { sport: Sport }[]): string[] {
  const set = new Set<string>()
  const list = goals.length ? goals : [{ sport: 'triathlon' as const }]
  for (const g of list) for (const d of DISCIPLINES_BY_SPORT[g.sport]) set.add(d)
  return DISCIPLINE_ORDER.filter((d) => set.has(d))
}

/**
 * Résout les disciplines effectivement entraînées pour un programme :
 *   - `training` : union ordonnée du cœur de l'objectif et des complémentaires.
 *   - `complementary` : complémentaires demandées, filtrées aux disciplines
 *     dispos de l'athlète et privées de celles déjà couvertes par l'objectif.
 *
 * `strength` est toujours disponible comme complémentaire (renfo). Si l'athlète
 * n'a pas de disciplines dispos renseignées (`available` vide/null), on ne
 * filtre pas sur la dispo (on fait confiance à la demande).
 */
export function resolveTrainingDisciplines(params: {
  goalDisciplines: string[]
  requested?: string[] | null
  available?: string[] | null
}): { training: string[]; complementary: string[] } {
  const goalSet = new Set(params.goalDisciplines)
  const hasAvailable = !!params.available?.length
  const availableSet = new Set(params.available ?? [])

  const complementary = DISCIPLINE_ORDER.filter(
    (d) =>
      (params.requested ?? []).includes(d) &&
      !goalSet.has(d) &&
      (d === 'strength' || !hasAvailable || availableSet.has(d)),
  )

  const trainingSet = new Set<string>([...params.goalDisciplines, ...complementary])
  const training = DISCIPLINE_ORDER.filter((d) => trainingSet.has(d))
  return { training, complementary }
}
