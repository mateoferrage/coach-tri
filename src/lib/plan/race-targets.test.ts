import { describe, it, expect } from 'vitest'
import {
  comfortableFinishTimeS,
  effortDistanceM,
  peakWeeklyElevationM,
  predictRunTimeS,
  targetGapPct,
  trailProfile,
  weeklyElevationTargetM,
  type WeekOverview,
} from './race-targets'

const road = (km: number) => ({ distance_m: km * 1000, trail: false })

describe('predictRunTimeS (seuil 4:30/km)', () => {
  // Équivalences classiques : 10 km ≈ seuil −2 %, semi ≈ +3 %, marathon ≈ +7 %.
  it('10 km ≈ 44 min', () => {
    expect(predictRunTimeS(270, road(10))).toBeGreaterThan(43 * 60)
    expect(predictRunTimeS(270, road(10))).toBeLessThan(45 * 60)
  })
  it('marathon ≈ 3h20-3h25', () => {
    const t = predictRunTimeS(270, road(42.195))
    expect(t).toBeGreaterThan(3 * 3600 + 18 * 60)
    expect(t).toBeLessThan(3 * 3600 + 27 * 60)
  })
  it('un trail est plus long que la même distance sur route (D+ et terrain)', () => {
    const trail = predictRunTimeS(270, {
      distance_m: 30000,
      elevation_gain_m: 1500,
      surface: 'technical',
      trail: true,
    })
    expect(trail).toBeGreaterThan(predictRunTimeS(270, road(45)))
  })
  it('ignore le D+ sur route', () => {
    expect(effortDistanceM({ distance_m: 10000, elevation_gain_m: 300, trail: false })).toBe(10000)
    expect(effortDistanceM({ distance_m: 10000, elevation_gain_m: 300, trail: true })).toBe(13000)
  })
  it('le temps « terminer » est plus lent que le temps prédit', () => {
    expect(comfortableFinishTimeS(270, road(21.1))).toBeGreaterThan(
      predictRunTimeS(270, road(21.1)),
    )
  })
})

describe('targetGapPct', () => {
  it("positif quand l'objectif est plus rapide que le niveau actuel", () => {
    expect(targetGapPct(3 * 3600, 3.3 * 3600)).toBeCloseTo(9.1, 1)
    expect(targetGapPct(3.3 * 3600, 3 * 3600)).toBeLessThan(0)
  })
})

describe('D+ hebdomadaire trail', () => {
  const overview: WeekOverview[] = [
    { week_num: 1, phase: 'base', is_recovery_week: false },
    { week_num: 2, phase: 'base', is_recovery_week: false },
    { week_num: 3, phase: 'base', is_recovery_week: false },
    { week_num: 4, phase: 'base', is_recovery_week: true },
    { week_num: 5, phase: 'build', is_recovery_week: false },
    { week_num: 6, phase: 'build', is_recovery_week: false },
    { week_num: 7, phase: 'peak', is_recovery_week: false },
    { week_num: 8, phase: 'taper', is_recovery_week: false },
  ]
  const target = (w: number, runHours = 20) =>
    weeklyElevationTargetM({ raceGainM: 2000, week: overview[w - 1], overview, runHours })

  it('dépasse le D+ de course pour un format court, s’en approche pour un long', () => {
    expect(peakWeeklyElevationM(1000)).toBe(1300)
    expect(peakWeeklyElevationM(3000)).toBe(3000)
    expect(peakWeeklyElevationM(10000)).toBe(6000)
  })
  it('part de 50 % du pic et y arrive en phase de pic', () => {
    expect(target(1)).toBe(1000)
    expect(target(7)).toBe(2000)
    expect(target(5)).toBeGreaterThan(target(3))
  })
  it('baisse en récupération et en affûtage', () => {
    expect(target(4)).toBeLessThan(target(3))
    expect(target(8)).toBeLessThan(target(7))
  })
  it('reste plafonné par le temps de course disponible', () => {
    expect(target(7, 3)).toBe(1050)
  })
})

describe('trailProfile', () => {
  it('classe selon le D+ par km', () => {
    expect(trailProfile(30000, 300)).toMatch(/roulant/)
    expect(trailProfile(30000, 1500)).toMatch(/montagneux/)
    expect(trailProfile(20000, 1500)).toMatch(/très montagneux/)
  })
})
