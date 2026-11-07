import { describe, it, expect, vi, afterEach } from 'vitest'
import { getActivitiesForSync } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getActivitiesForSync', () => {
  it("enregistre l'heure locale de départ, comme Garmin", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json([
          {
            id: 1,
            name: 'Course à pied dans l’après-midi',
            type: 'Run',
            start_date: '2026-11-06T16:41:07Z',
            start_date_local: '2026-11-06T17:41:07Z',
            elapsed_time: 3960,
            distance: 11740,
          },
        ]),
      ),
    )
    const [activity] = await getActivitiesForSync('token', 0)
    expect(activity.started_at).toBe('2026-11-06T17:41:07Z')
  })
})
