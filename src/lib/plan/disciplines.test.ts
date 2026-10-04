import { describe, it, expect } from 'vitest'
import { disciplinesForGoals } from './disciplines'

describe('disciplinesForGoals', () => {
  it('running seul → run + strength', () => {
    expect(disciplinesForGoals([{ sport: 'running' }])).toEqual(['run', 'strength'])
  })

  it('triathlon → swim, bike, run, strength', () => {
    expect(disciplinesForGoals([{ sport: 'triathlon' }])).toEqual([
      'swim',
      'bike',
      'run',
      'strength',
    ])
  })

  it('trail + triathlon → union dédupliquée, ordre stable', () => {
    expect(disciplinesForGoals([{ sport: 'running' }, { sport: 'triathlon' }])).toEqual([
      'swim',
      'bike',
      'run',
      'strength',
    ])
  })

  it('aucune course → disciplines triathlon par défaut', () => {
    expect(disciplinesForGoals([])).toEqual(['swim', 'bike', 'run', 'strength'])
  })
})
