import { describe, it, expect } from 'vitest'
import { normalizePhase, derivePhasesFromWeeks, PHASE_VALUES } from './phases'

describe('normalizePhase', () => {
  it('lowercases uppercase values from the LLM', () => {
    expect(normalizePhase('BASE')).toBe('base')
    expect(normalizePhase('TAPER')).toBe('taper')
  })
  it('trims surrounding whitespace', () => {
    expect(normalizePhase('  Build ')).toBe('build')
  })
  it('accepts all canonical values', () => {
    for (const v of PHASE_VALUES) expect(normalizePhase(v)).toBe(v)
  })
  it('returns null for values outside the allowed set', () => {
    expect(normalizePhase('maintenance')).toBeNull()
    expect(normalizePhase('recovery')).toBeNull()
    expect(normalizePhase('')).toBeNull()
  })
  it('extracts the keyword from enriched multi-race labels', () => {
    expect(normalizePhase('BASE 1')).toBe('base')
    expect(normalizePhase('BUILD 1 (Trail Focus)')).toBe('build')
    expect(normalizePhase('PEAK (Trail Ventoux)')).toBe('peak')
    expect(normalizePhase('TAPER (Tri Test)')).toBe('taper')
  })
  it('extracts the keyword from underscore-joined labels', () => {
    expect(normalizePhase('BASE_VENTOUX')).toBe('base')
    expect(normalizePhase('BUILD_VENTOUX')).toBe('build')
    expect(normalizePhase('PEAK_VENTOUX')).toBe('peak')
    expect(normalizePhase('TAPER_VENTOUX')).toBe('taper')
    expect(normalizePhase('BUILD_TRI')).toBe('build')
    expect(normalizePhase('TAPER_TRI')).toBe('taper')
  })
  it('maps transition/prépa/affûtage/compétition synonyms', () => {
    expect(normalizePhase('TRANSITION (Post-Trail)')).toBe('prep')
    expect(normalizePhase('Préparation générale')).toBe('prep')
    expect(normalizePhase('Affûtage')).toBe('taper')
    expect(normalizePhase('Compétition')).toBe('race')
  })
})

describe('derivePhasesFromWeeks', () => {
  it('groups consecutive weeks of the same (normalized) phase', () => {
    const weeks = [
      { week_num: 1, phase: 'BASE' },
      { week_num: 2, phase: 'BASE' },
      { week_num: 3, phase: 'BASE' },
      { week_num: 4, phase: 'BASE' },
      { week_num: 5, phase: 'BASE' },
      { week_num: 6, phase: 'BASE' },
      { week_num: 7, phase: 'BUILD' },
      { week_num: 8, phase: 'BUILD' },
      { week_num: 9, phase: 'BUILD' },
      { week_num: 10, phase: 'BUILD' },
      { week_num: 11, phase: 'BUILD' },
      { week_num: 12, phase: 'BUILD' },
      { week_num: 13, phase: 'PEAK' },
      { week_num: 14, phase: 'PEAK' },
      { week_num: 15, phase: 'PEAK' },
      { week_num: 16, phase: 'TAPER' },
      { week_num: 17, phase: 'TAPER' },
      { week_num: 18, phase: 'TAPER' },
    ]
    expect(derivePhasesFromWeeks(weeks)).toEqual([
      { phase: 'base', start_week_num: 1, end_week_num: 6 },
      { phase: 'build', start_week_num: 7, end_week_num: 12 },
      { phase: 'peak', start_week_num: 13, end_week_num: 15 },
      { phase: 'taper', start_week_num: 16, end_week_num: 18 },
    ])
  })

  it('sorts unordered input by week_num before grouping', () => {
    const weeks = [
      { week_num: 3, phase: 'base' },
      { week_num: 1, phase: 'base' },
      { week_num: 2, phase: 'base' },
    ]
    expect(derivePhasesFromWeeks(weeks)).toEqual([
      { phase: 'base', start_week_num: 1, end_week_num: 3 },
    ])
  })

  it('starts a new group when the same phase resumes after a gap', () => {
    const weeks = [
      { week_num: 1, phase: 'base' },
      { week_num: 2, phase: 'build' },
      { week_num: 3, phase: 'base' },
    ]
    expect(derivePhasesFromWeeks(weeks)).toEqual([
      { phase: 'base', start_week_num: 1, end_week_num: 1 },
      { phase: 'build', start_week_num: 2, end_week_num: 2 },
      { phase: 'base', start_week_num: 3, end_week_num: 3 },
    ])
  })

  it('skips weeks with an unknown phase value', () => {
    const weeks = [
      { week_num: 1, phase: 'base' },
      { week_num: 2, phase: 'wtf' },
      { week_num: 3, phase: 'build' },
    ]
    expect(derivePhasesFromWeeks(weeks)).toEqual([
      { phase: 'base', start_week_num: 1, end_week_num: 1 },
      { phase: 'build', start_week_num: 3, end_week_num: 3 },
    ])
  })
})
