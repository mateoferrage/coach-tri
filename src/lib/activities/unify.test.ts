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

import { mergeActivities } from './unify'

function g(over: Partial<GarminRow>): GarminRow {
  return {
    id: 'g', garmin_activity_id: 1, activity_type: 'run', name: null,
    started_at: '2026-06-10T06:00:00+00:00', duration_s: 3600, distance_m: 10000,
    avg_hr: 140, max_hr: 160, avg_speed_ms: 2.78, elevation_gain_m: 0,
    aerobic_te: 3, ...over,
  }
}
function s(over: Partial<StravaRow>): StravaRow {
  return {
    id: 's', strava_activity_id: 2, activity_type: 'run', name: null,
    started_at: '2026-06-10T06:00:00+00:00', duration_s: 3600, distance_m: 10000,
    avg_hr: 140, max_hr: 160, avg_speed_ms: 2.78, elevation_gain_m: 0,
    avg_watts: 200, suffer_score: 80, ...over,
  }
}

describe('mergeActivities', () => {
  it('fusionne un doublon (≤10 min, même sport) : base Garmin + watts Strava', () => {
    const out = mergeActivities(
      [g({ id: 'g1', started_at: '2026-06-10T06:00:00+00:00' })],
      [s({ id: 's1', started_at: '2026-06-10T06:02:00+00:00', avg_watts: 210, suffer_score: 75 })],
    )
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('g1')
    expect(out[0].sources).toEqual(['garmin', 'strava'])
    expect(out[0].avg_watts).toBe(210)
    expect(out[0].suffer_score).toBe(75)
    expect(out[0].aerobic_te).toBe(3)
  })

  it('garde 2 cartes si écart horaire > 10 min', () => {
    const out = mergeActivities(
      [g({ id: 'g1', started_at: '2026-06-10T06:00:00+00:00' })],
      [s({ id: 's1', started_at: '2026-06-10T06:30:00+00:00' })],
    )
    expect(out).toHaveLength(2)
  })

  it('garde 2 cartes si disciplines différentes', () => {
    const out = mergeActivities(
      [g({ id: 'g1', activity_type: 'run' })],
      [s({ id: 's1', activity_type: 'bike' })],
    )
    expect(out).toHaveLength(2)
  })

  it('fusionne malgré des durées très différentes (Strava temps écoulé vs Garmin temps actif)', () => {
    // Cas réel natation : même horodatage, Garmin 18 min (temps de nage),
    // Strava 45 min (temps écoulé, repos inclus). Doit fusionner.
    const out = mergeActivities(
      [g({ id: 'g1', activity_type: 'swim', duration_s: 1102 })],
      [s({ id: 's1', activity_type: 'swim', duration_s: 2708 })],
    )
    expect(out).toHaveLength(1)
    expect(out[0].sources).toEqual(['garmin', 'strava'])
  })

  it('garde une activité Strava sans équivalent Garmin', () => {
    const out = mergeActivities([], [s({ id: 's1' })])
    expect(out).toHaveLength(1)
    expect(out[0].sources).toEqual(['strava'])
  })

  it("n'apparie jamais une activité manuelle Garmin", () => {
    const out = mergeActivities(
      [g({ id: 'g1', garmin_activity_id: -3 })],
      [s({ id: 's1' })],
    )
    expect(out).toHaveLength(2)
  })

  it("ne dédoublonne pas les disciplines hors run/bike/swim", () => {
    const out = mergeActivities(
      [g({ id: 'g1', activity_type: 'strength' })],
      [s({ id: 's1', activity_type: 'other' })],
    )
    expect(out).toHaveLength(2)
  })

  it('trie le résultat par started_at décroissant', () => {
    const out = mergeActivities(
      [
        g({ id: 'old', started_at: '2026-06-01T06:00:00+00:00' }),
        g({ id: 'new', started_at: '2026-06-12T06:00:00+00:00' }),
      ],
      [],
    )
    expect(out.map(a => a.id)).toEqual(['new', 'old'])
  })
})
