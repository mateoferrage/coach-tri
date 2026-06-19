import { describe, it, expect } from 'vitest'
import { timeToFrac, parseLocalDate } from './time'

describe('timeToFrac', () => {
  it('converts midnight to 0', () => {
    expect(timeToFrac('00:00')).toBe(0)
  })
  it('converts 06:30 to 6.5', () => {
    expect(timeToFrac('06:30')).toBe(6.5)
  })
  it('ignores seconds suffix', () => {
    expect(timeToFrac('22:00:00')).toBe(22)
  })
})

describe('parseLocalDate', () => {
  it('parses yyyy-MM-dd at local midnight (no UTC day shift)', () => {
    const d = parseLocalDate('2026-06-19')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5) // June = 5
    expect(d.getDate()).toBe(19)
    expect(d.getHours()).toBe(0)
  })
})
