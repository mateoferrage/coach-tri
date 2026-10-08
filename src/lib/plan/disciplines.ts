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
