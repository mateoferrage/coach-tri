import { describe, it, expect } from 'vitest'
import { applyLevelRules, normalizeMacroPlan } from './macro'

const week = (week_num: number, phase = 'base') => ({
  week_num,
  phase,
  is_recovery_week: false,
  planned_volume_hours: 6,
  planned_tss: 300,
  distribution: { z1z2: 0.8, z3: 0.05, z4z5: 0.15 },
  notes: '',
})
const phases = [{ phase: 'base' as const, start_week_num: 1, end_week_num: 2, focus: '' }]

describe('normalizeMacroPlan', () => {
  it('accepte un plan complet et normalise les libellés de phase', () => {
    const { plan, errors } = normalizeMacroPlan({ phases, weeks: [week(1, 'BASE 1'), week(2)] }, 2)
    expect(errors).toEqual([])
    expect(plan.weeks[0].phase).toBe('base')
  })
  it('signale une phase inconnue', () => {
    const { errors } = normalizeMacroPlan({ phases, weeks: [week(1, 'RÉCUP 1'), week(2)] }, 2)
    expect(errors.join()).toContain('RÉCUP 1')
  })
  it('signale une semaine manquante', () => {
    const { errors } = normalizeMacroPlan({ phases, weeks: [week(1)] }, 2)
    expect(errors.join()).toContain('de 1 à 2')
  })
  it('signale une réponse vide', () => {
    expect(normalizeMacroPlan({}, 2).errors).toContain('structure manquante')
  })
})

describe('applyLevelRules', () => {
  it('reporte le Z4-Z5 en Z3 pour un débutant', () => {
    const [w] = applyLevelRules([week(1)], 'beginner')
    expect(w.distribution.z4z5).toBe(0)
    expect(w.distribution.z3).toBeCloseTo(0.2)
  })
  it('ne touche pas aux autres niveaux', () => {
    expect(applyLevelRules([week(1)], 'advanced')[0].distribution.z4z5).toBe(0.15)
  })
})
