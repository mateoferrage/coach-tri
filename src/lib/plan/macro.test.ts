import { describe, it, expect } from 'vitest'
import { applyLevelRules, applyVolumeGuards, normalizeMacroPlan } from './macro'

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

describe('applyVolumeGuards', () => {
  const at = (hours: number, over = {}) => ({
    ...week(1),
    planned_volume_hours: hours,
    planned_tss: 100,
    ...over,
  })
  it('remonte une semaine de charge à la moitié de la disponibilité (cas réel 1,5 h pour 12 h)', () => {
    const [w] = applyVolumeGuards([at(1.5)], 12)
    expect(w.planned_volume_hours).toBe(6)
    expect(w.planned_tss).toBe(400)
  })
  it('garde un plancher plus bas pour une semaine de récupération', () => {
    expect(
      applyVolumeGuards([at(1.4, { is_recovery_week: true })], 12)[0].planned_volume_hours,
    ).toBe(3.9)
  })
  it("ne touche ni à l'affûtage, ni à la course, ni aux semaines déjà suffisantes", () => {
    expect(applyVolumeGuards([at(3, { phase: 'taper' })], 12)[0].planned_volume_hours).toBe(3)
    expect(applyVolumeGuards([at(3, { phase: 'race' })], 12)[0].planned_volume_hours).toBe(3)
    expect(applyVolumeGuards([at(9)], 12)[0].planned_volume_hours).toBe(9)
  })
  it('ne fait rien sans disponibilité renseignée', () => {
    expect(applyVolumeGuards([at(1.5)], null)[0].planned_volume_hours).toBe(1.5)
  })
})

describe('applyVolumeGuards avec volume actuel déclaré', () => {
  const at = (week_num: number, hours: number, over = {}) => ({
    ...week(week_num),
    planned_volume_hours: hours,
    planned_tss: 100,
    ...over,
  })
  it('garde une semaine 1 proche du volume actuel', () => {
    expect(applyVolumeGuards([at(1, 8.4)], 12, 4)[0].planned_volume_hours).toBe(4.6)
    expect(applyVolumeGuards([at(1, 1.5)], 12, 4)[0].planned_volume_hours).toBe(3.6)
  })
  it('laisse la progression monter ensuite', () => {
    expect(applyVolumeGuards([at(5, 7)], 12, 4)[0].planned_volume_hours).toBe(7)
  })
  it('ne dépasse jamais la disponibilité', () => {
    expect(applyVolumeGuards([at(10, 14)], 12, 4)[0].planned_volume_hours).toBe(12)
  })
  it('ramène un volume actuel supérieur à la disponibilité', () => {
    expect(applyVolumeGuards([at(1, 15)], 10, 15)[0].planned_volume_hours).toBe(10)
  })
})
