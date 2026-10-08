import { describe, it, expect } from 'vitest'
import { assembleGoalIds } from './goal-slots'

describe('assembleGoalIds', () => {
  it('garde la principale en tête et comme primary_goal_id', () => {
    expect(assembleGoalIds({ primaryId: 'a', secondaryIds: [] })).toEqual({
      goal_ids: ['a'],
      primary_goal_id: 'a',
    })
  })

  it('ajoute les secondaires dans l’ordre', () => {
    expect(assembleGoalIds({ primaryId: 'a', secondaryIds: ['b', 'c'] })).toEqual({
      goal_ids: ['a', 'b', 'c'],
      primary_goal_id: 'a',
    })
  })

  it('ignore les secondaires vides', () => {
    expect(
      assembleGoalIds({ primaryId: 'a', secondaryIds: [undefined, 'b', undefined] }),
    ).toEqual({ goal_ids: ['a', 'b'], primary_goal_id: 'a' })
  })

  it('déduplique et retire la principale des secondaires', () => {
    expect(
      assembleGoalIds({ primaryId: 'a', secondaryIds: ['a', 'b', 'b', 'c'] }),
    ).toEqual({ goal_ids: ['a', 'b', 'c'], primary_goal_id: 'a' })
  })

  it('limite à 2 secondaires', () => {
    expect(
      assembleGoalIds({ primaryId: 'a', secondaryIds: ['b', 'c', 'd'] }),
    ).toEqual({ goal_ids: ['a', 'b', 'c'], primary_goal_id: 'a' })
  })
})
