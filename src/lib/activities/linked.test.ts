import { describe, it, expect } from 'vitest'
import { linkFor, linkKey, matchSessionsToActivities } from './linked'
import type { UnifiedActivity } from './unify'

const activity = (o: Partial<UnifiedActivity>): UnifiedActivity => ({
  id: 'g1',
  activity_type: 'run',
  name: null,
  started_at: '2026-11-10T18:30:00+00:00',
  duration_s: 3600,
  distance_m: 10000,
  avg_hr: 145,
  max_hr: 170,
  avg_speed_ms: 2.8,
  elevation_gain_m: 50,
  aerobic_te: null,
  avg_watts: null,
  suffer_score: null,
  is_manual: false,
  sources: ['garmin'],
  ...o,
})

describe('matchSessionsToActivities', () => {
  it('lie une séance et une activité du même jour et de la même discipline', () => {
    const m = matchSessionsToActivities(
      [{ id: 's1', session_date: '2026-11-10', discipline: 'run' }],
      [activity({})],
    )
    expect(m).toEqual([{ session_id: 's1', activity: expect.objectContaining({ id: 'g1' }) }])
  })
  it("ne lie rien en cas d'ambiguïté (deux activités le même jour)", () => {
    const m = matchSessionsToActivities(
      [{ id: 's1', session_date: '2026-11-10', discipline: 'run' }],
      [activity({}), activity({ id: 'g2', started_at: '2026-11-10T07:00:00+00:00' })],
    )
    expect(m).toEqual([])
  })
  it('ignore une autre discipline, un autre jour et les enchaînements', () => {
    expect(
      matchSessionsToActivities(
        [
          { id: 's1', session_date: '2026-11-10', discipline: 'bike' },
          { id: 's2', session_date: '2026-11-11', discipline: 'run' },
          { id: 's3', session_date: '2026-11-10', discipline: 'brick' },
        ],
        [activity({})],
      ),
    ).toEqual([])
  })
  it("lit la date en heure locale (pas de décalage d'une activité du soir)", () => {
    const m = matchSessionsToActivities(
      [{ id: 's1', session_date: '2026-11-10', discipline: 'run' }],
      [activity({ started_at: '2026-11-10T23:30:00+00:00' })],
    )
    expect(m).toHaveLength(1)
  })
})

describe('linkFor / linkKey', () => {
  it('Garmin seule, Strava seule, fusionnée', () => {
    expect(linkFor(activity({}))).toEqual({ garmin_activity_id: 'g1', strava_activity_id: null })
    expect(linkFor(activity({ id: 's9', sources: ['strava'], strava_id: 's9' }))).toEqual({
      garmin_activity_id: null,
      strava_activity_id: 's9',
    })
    expect(linkFor(activity({ sources: ['garmin', 'strava'], strava_id: 's9' }))).toEqual({
      garmin_activity_id: 'g1',
      strava_activity_id: 's9',
    })
    expect(linkKey({ garmin_activity_id: null, strava_activity_id: 's9' })).toBe('s:s9')
    expect(linkKey({ garmin_activity_id: null, strava_activity_id: null })).toBeNull()
  })
})
