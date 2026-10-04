import { describe, it, expect } from 'vitest'
import { GoalSchema } from './goal'

const triathlon = {
  sport: 'triathlon',
  race_name: 'Ironman Nice',
  race_date: '2026-06-28',
  race_type: 'full',
}

const trail = {
  sport: 'running',
  race_name: 'UTMB',
  race_date: '2026-08-28',
  race_type: 'ultra',
  run_distance_m: 171000,
  run_elevation_m: 10000,
  elevation_loss_m: 10000,
  surface: 'mountain',
  terrain: 'mountainous',
  max_altitude_m: 2537,
  cutoff_time_s: 165600,
  estimated_finish_time_s: 140400,
}

describe('GoalSchema', () => {
  it('accepte un triathlon valide', () => {
    expect(GoalSchema.safeParse(triathlon).success).toBe(true)
  })

  it('applique sport=triathlon par défaut', () => {
    const parsed = GoalSchema.parse(triathlon)
    expect(parsed.sport).toBe('triathlon')
  })

  it('accepte une course trail valide avec champs trail', () => {
    expect(GoalSchema.safeParse(trail).success).toBe(true)
  })

  it('rejette un race_type triathlon sur un sport running', () => {
    const bad = { ...trail, race_type: 'olympic' }
    expect(GoalSchema.safeParse(bad).success).toBe(false)
  })

  it('rejette un race_type running sur un sport triathlon', () => {
    const bad = { ...triathlon, race_type: 'trail' }
    expect(GoalSchema.safeParse(bad).success).toBe(false)
  })

  it('rejette les champs trail sur un triathlon', () => {
    const bad = { ...triathlon, elevation_loss_m: 500 }
    expect(GoalSchema.safeParse(bad).success).toBe(false)
  })

  it('rejette une surface hors énumération', () => {
    const bad = { ...trail, surface: 'sand' }
    expect(GoalSchema.safeParse(bad).success).toBe(false)
  })
})
