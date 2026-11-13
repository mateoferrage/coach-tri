import { describe, it, expect } from 'vitest'
import { syncSummary } from './sync-summary'

describe('syncSummary', () => {
  it('résume deux synchros réussies', () => {
    expect(
      syncSummary([
        { source: 'garmin', ok: true, count: 3 },
        { source: 'strava', ok: true, count: 1 },
      ]),
    ).toEqual({ level: 'success', message: 'Garmin : 3 activités · Strava : 1 activité' })
  })

  it('avertit quand une source échoue', () => {
    expect(
      syncSummary([
        { source: 'garmin', ok: true, count: 0 },
        { source: 'strava', ok: false, error: 'reconnecte ton compte' },
      ]),
    ).toEqual({ level: 'warning', message: 'Garmin : 0 activité · Strava : reconnecte ton compte' })
  })

  it('signale une erreur quand tout échoue', () => {
    expect(syncSummary([{ source: 'garmin', ok: false, error: 'erreur réseau' }])).toEqual({
      level: 'error',
      message: 'Garmin : erreur réseau',
    })
  })

  it('mentionne les séances validées automatiquement', () => {
    const { message } = syncSummary([
      { source: 'garmin', ok: true, count: 3, linked: 2 },
      { source: 'strava', ok: true, count: 1, linked: 0 },
    ])
    expect(message).toMatch(/2 séances validées automatiquement$/)
  })
})
