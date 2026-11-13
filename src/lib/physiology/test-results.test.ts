import { describe, it, expect } from 'vitest'
import { computeTestOutcome, TestResultSchema } from './test-results'

describe('computeTestOutcome', () => {
  it('test course 30 min : allure seuil, VMA et FC seuil', () => {
    const o = computeTestOutcome({ kind: 'run', distance_m: 6667, avg_hr: 172 })
    expect(o.values.run_threshold_pace_sec_per_km).toBe(270) // 4:30/km
    expect(o.values.hr_threshold_run).toBe(172)
    expect(o.values.vma_kmh).toBeCloseTo(15.3, 1)
    expect(o.measured).toEqual(['run_threshold_pace_sec_per_km', 'vma_kmh', 'hr_threshold_run'])
    expect(o.summary[0]).toBe('Allure seuil : 4:30/km')
  })
  it('test course sans FC : seulement l’allure', () => {
    const o = computeTestOutcome({ kind: 'run', distance_m: 6000 })
    expect(o.values.hr_threshold_run).toBeUndefined()
  })
  it('test FTP 20 min : 95 % de la puissance', () => {
    expect(computeTestOutcome({ kind: 'bike', avg_power_20min: 250 }).values.ftp_watts).toBe(238)
  })
  it('test CSS : records 400/200 et CSS', () => {
    const o = computeTestOutcome({ kind: 'swim', t400_s: 420, t200_s: 190 })
    expect(o.values).toMatchObject({ swim_400m_time_s: 420, swim_200m_time_s: 190, css_pace_sec_per_100m: 115 })
    expect(o.summary[0]).toBe('CSS : 1:55/100 m')
  })
  it('refuse des chronos de natation incohérents', () => {
    expect(() => computeTestOutcome({ kind: 'swim', t400_s: 300, t200_s: 200 })).toThrow()
  })
  it('valide les bornes', () => {
    expect(TestResultSchema.safeParse({ kind: 'run', distance_m: 500 }).success).toBe(false)
  })
})
