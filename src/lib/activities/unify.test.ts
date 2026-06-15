import { describe, it, expect } from 'vitest'
import { normalizeGarmin, normalizeStrava, type GarminRow, type StravaRow } from './unify'

const garminRow: GarminRow = {
  id: 'g1',
  garmin_activity_id: 1001,
  activity_type: 'run',
  name: 'Footing matinal',
  started_at: '2026-06-10T06:00:00+00:00',
  duration_s: 3600,
  distance_m: 10000,
  avg_hr: 145,
  max_hr: 165,
  avg_speed_ms: 2.78,
  elevation_gain_m: 50,
  aerobic_te: 3.2,
}

const stravaRow: StravaRow = {
  id: 's1',
  strava_activity_id: 2001,
  activity_type: 'bike',
  name: 'Sortie longue',
  started_at: '2026-06-11T08:00:00+00:00',
  duration_s: 7200,
  distance_m: 60000,
  avg_hr: 138,
  max_hr: 160,
  avg_speed_ms: 8.3,
  elevation_gain_m: 600,
  avg_watts: 180,
  suffer_score: 90,
}

describe('normalizeGarmin', () => {
  it('mappe une activité Garmin avec ses sources et drapeaux', () => {
    const u = normalizeGarmin(garminRow)
    expect(u.id).toBe('g1')
    expect(u.sources).toEqual(['garmin'])
    expect(u.aerobic_te).toBe(3.2)
    expect(u.avg_watts).toBeNull()
    expect(u.suffer_score).toBeNull()
    expect(u.is_manual).toBe(false)
  })

  it('marque les activités manuelles (id < 0)', () => {
    const u = normalizeGarmin({ ...garminRow, garmin_activity_id: -5 })
    expect(u.is_manual).toBe(true)
  })
})

describe('normalizeStrava', () => {
  it('mappe une activité Strava avec watts/suffer et sans TE', () => {
    const u = normalizeStrava(stravaRow)
    expect(u.id).toBe('s1')
    expect(u.sources).toEqual(['strava'])
    expect(u.avg_watts).toBe(180)
    expect(u.suffer_score).toBe(90)
    expect(u.aerobic_te).toBeNull()
    expect(u.is_manual).toBe(false)
  })
})
