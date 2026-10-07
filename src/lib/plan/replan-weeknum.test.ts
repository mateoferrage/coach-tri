import { describe, it, expect } from 'vitest'
import { currentWeekNum } from './replan-weeknum'

describe('currentWeekNum', () => {
  it('semaine 1 le jour du départ', () => {
    expect(currentWeekNum('2026-01-05', '2026-01-05')).toBe(1)
  })
  it('semaine 1 à J+6', () => {
    expect(currentWeekNum('2026-01-05', '2026-01-11')).toBe(1)
  })
  it('semaine 2 à J+7', () => {
    expect(currentWeekNum('2026-01-05', '2026-01-12')).toBe(2)
  })
  it('semaine 3 à J+16', () => {
    expect(currentWeekNum('2026-01-05', '2026-01-21')).toBe(3)
  })
  it('plancher à 1 si la date est avant le départ', () => {
    expect(currentWeekNum('2026-01-05', '2026-01-01')).toBe(1)
  })
})
