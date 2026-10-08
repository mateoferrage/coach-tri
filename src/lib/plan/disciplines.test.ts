import { describe, it, expect } from 'vitest'
import { disciplinesForGoals, resolveTrainingDisciplines } from './disciplines'

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

describe('resolveTrainingDisciplines', () => {
  it('trail + complémentaires nage/vélo (dispos) → union ordonnée', () => {
    expect(
      resolveTrainingDisciplines({
        goalDisciplines: ['run', 'strength'],
        requested: ['swim', 'bike'],
        available: ['swim', 'bike', 'run', 'strength'],
      }),
    ).toEqual({
      training: ['swim', 'bike', 'run', 'strength'],
      complementary: ['swim', 'bike'],
    })
  })

  it('retire des complémentaires ce que l’objectif couvre déjà', () => {
    expect(
      resolveTrainingDisciplines({
        goalDisciplines: ['run', 'strength'],
        requested: ['run', 'swim'],
        available: ['swim', 'run'],
      }),
    ).toEqual({ training: ['swim', 'run', 'strength'], complementary: ['swim'] })
  })

  it('filtre les complémentaires non dispos (hors renfo)', () => {
    expect(
      resolveTrainingDisciplines({
        goalDisciplines: ['run', 'strength'],
        requested: ['swim', 'bike'],
        available: ['swim'],
      }),
    ).toEqual({ training: ['swim', 'run', 'strength'], complementary: ['swim'] })
  })

  it('sans demande → complémentaires vides, training = objectif', () => {
    expect(
      resolveTrainingDisciplines({ goalDisciplines: ['run', 'strength'], available: ['swim', 'bike'] }),
    ).toEqual({ training: ['run', 'strength'], complementary: [] })
  })

  it('objectif triathlon → complémentaires sans effet (déjà couvertes)', () => {
    expect(
      resolveTrainingDisciplines({
        goalDisciplines: ['swim', 'bike', 'run', 'strength'],
        requested: ['swim', 'bike'],
        available: ['swim', 'bike', 'run', 'strength'],
      }),
    ).toEqual({ training: ['swim', 'bike', 'run', 'strength'], complementary: [] })
  })

  it('available vide → pas de filtrage sur la dispo', () => {
    expect(
      resolveTrainingDisciplines({
        goalDisciplines: ['run', 'strength'],
        requested: ['swim', 'bike'],
        available: [],
      }),
    ).toEqual({ training: ['swim', 'bike', 'run', 'strength'], complementary: ['swim', 'bike'] })
  })
})
