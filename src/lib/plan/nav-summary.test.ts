import { describe, it, expect } from 'vitest'
import { buildRaceSummary, formatCountdown } from './nav-summary'

const TODAY = new Date(2026, 10, 6) // vendredi 6 novembre 2026, heure locale

const base = {
  raceName: 'Triathlon M',
  raceDate: '2027-05-15',
  startDate: '2026-11-02',
  totalWeeks: 27,
}

describe('buildRaceSummary', () => {
  it('calcule le compte à rebours et la semaine en cours', () => {
    expect(buildRaceSummary(base, TODAY)).toEqual({
      raceName: 'Triathlon M',
      raceDate: '2027-05-15',
      daysLeft: 190,
      weekNum: 1,
      totalWeeks: 27,
    })
  })

  it('avance la semaine selon la date de début', () => {
    const s = buildRaceSummary({ ...base, startDate: '2026-10-01' }, TODAY)
    expect(s?.weekNum).toBe(6)
  })

  it('borne la semaine entre 1 et le nombre total de semaines', () => {
    expect(buildRaceSummary({ ...base, startDate: '2026-12-01' }, TODAY)?.weekNum).toBe(1)
    expect(buildRaceSummary({ ...base, startDate: '2024-01-01' }, TODAY)?.weekNum).toBe(27)
  })

  it('renvoie null sans course, sans date, sans semaines ou si la course est passée', () => {
    expect(buildRaceSummary({ ...base, raceName: null }, TODAY)).toBeNull()
    expect(buildRaceSummary({ ...base, raceDate: null }, TODAY)).toBeNull()
    expect(buildRaceSummary({ ...base, totalWeeks: 0 }, TODAY)).toBeNull()
    expect(buildRaceSummary({ ...base, raceDate: '2026-11-05' }, TODAY)).toBeNull()
  })

  it('garde la course le jour J', () => {
    expect(buildRaceSummary({ ...base, raceDate: '2026-11-06' }, TODAY)?.daysLeft).toBe(0)
  })
})

describe('formatCountdown', () => {
  it('affiche J-n, ou « Jour J » le jour de la course', () => {
    expect(formatCountdown(190)).toBe('J-190')
    expect(formatCountdown(1)).toBe('J-1')
    expect(formatCountdown(0)).toBe('Jour J')
  })
})
