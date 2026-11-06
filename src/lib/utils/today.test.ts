import { describe, it, expect } from 'vitest'
import { todayIn } from './today'

describe('todayIn', () => {
  it('renvoie la date du jour dans le fuseau demandé', () => {
    const now = new Date('2026-11-06T23:30:00Z')
    expect(todayIn('Europe/Paris', now)).toBe('2026-11-07')
    expect(todayIn('UTC', now)).toBe('2026-11-06')
  })
})
