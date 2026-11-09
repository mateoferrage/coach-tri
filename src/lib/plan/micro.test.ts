import { describe, it, expect } from 'vitest'
import { resolveDayPart, validateMicroSessions, volumeViolation } from './micro'
import type { MicroSessions } from '@/lib/schemas/plan'

type Session = MicroSessions['sessions'][number]
const session = (over: Partial<Session>): Session =>
  ({
    session_date: '2026-11-09',
    discipline: 'run',
    session_type: 'easy',
    title: 'x',
    duration_min: 45,
    ...over,
  }) as Session
const constraints = { allowedDates: ['2026-11-09'], allowedDisciplines: ['run', 'strength'] }

describe('validateMicroSessions', () => {
  it('garde une séance conforme', () => {
    const r = validateMicroSessions([session({})], constraints)
    expect(r.valid).toHaveLength(1)
    expect(r.violations).toEqual([])
  })
  it('refuse une discipline hors programme (vélo pour un coureur)', () => {
    const r = validateMicroSessions([session({ discipline: 'bike' })], constraints)
    expect(r.valid).toEqual([])
    expect(r.violations.join()).toContain('bike')
  })
  it('refuse une date non disponible', () => {
    const r = validateMicroSessions([session({ session_date: '2026-11-10' })], constraints)
    expect(r.violations.join()).toContain('2026-11-10')
  })
  it('retire les jours de repos sans les compter comme erreur', () => {
    const r = validateMicroSessions([session({ discipline: 'rest', duration_min: 0 })], constraints)
    expect(r).toEqual({ valid: [], violations: [] })
  })
})

describe('resolveDayPart', () => {
  it("respecte le créneau choisi par l'IA", () => {
    expect(resolveDayPart('morning', '2026-11-10')).toBe('morning')
  })
  it('retombe sur le créneau par défaut du jour', () => {
    expect(resolveDayPart('nuit', '2026-11-10')).toBe('evening') // mardi
    expect(resolveDayPart(undefined, '2026-11-14')).toBe('morning') // samedi
    expect(resolveDayPart(undefined, '2026-11-15')).toBe('midday') // dimanche
  })
})

describe('volumeViolation', () => {
  const twoHours = [session({ duration_min: 60 }), session({ duration_min: 60 })]
  it('accepte un volume dans la tolérance', () => {
    expect(volumeViolation(twoHours, 2.2)).toBeNull()
  })
  it('signale une semaine trop courte', () => {
    expect(volumeViolation(twoHours, 3)).toContain('120 min au lieu de 180 min')
  })
})
