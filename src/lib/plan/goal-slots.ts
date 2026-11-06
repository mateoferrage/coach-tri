// Assemble les ids de courses d'un programme à partir des slots résolus
// (objectif A principal + B/C secondaires), une fois chaque course existante
// choisie ou chaque nouvelle course créée.
//
// Règles :
//   - La course principale (A) ouvre toujours la liste et devient `primary_goal_id`.
//   - Les secondaires sont dédupliqués, privés de la principale, et limités à 2.
export function assembleGoalIds(input: {
  primaryId: string
  secondaryIds: Array<string | undefined>
}): { goal_ids: string[]; primary_goal_id: string } {
  const seen = new Set<string>([input.primaryId])
  const secondaries: string[] = []
  for (const id of input.secondaryIds) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    secondaries.push(id)
    if (secondaries.length === 2) break
  }
  return {
    goal_ids: [input.primaryId, ...secondaries],
    primary_goal_id: input.primaryId,
  }
}
