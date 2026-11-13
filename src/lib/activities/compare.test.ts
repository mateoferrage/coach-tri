import { describe, it, expect } from 'vitest'
import { compareSession, executionTrends, parsePaceRange, summarizeComparison } from './compare'

const easyRun = {
  discipline: 'run',
  session_type: 'easy',
  duration_min: 60,
  target_values: { hr: [136, 150], pace_per_km: '5:20-6:00' },
}
const act = (o: Partial<Parameters<typeof compareSession>[1]> = {}) => ({
  duration_s: 3600,
  distance_m: 10500,
  avg_hr: 145,
  avg_speed_ms: 1000 / 340, // 5:40/km
  elevation_gain_m: 40,
  avg_watts: null,
  ...o,
})
const row = (rows: ReturnType<typeof compareSession>, key: string) => rows.find((r) => r.key === key)

describe('parsePaceRange', () => {
  it('lit une plage ou une valeur unique', () => {
    expect(parsePaceRange('5:10-5:45')).toEqual([310, 345])
    expect(parsePaceRange('4:30')).toEqual([270, 270])
    expect(parsePaceRange(null)).toBeNull()
  })
})

describe('compareSession', () => {
  it('séance facile conforme', () => {
    const rows = compareSession(easyRun, act())
    expect(row(rows, 'duration')?.verdict).toBe('ok')
    expect(row(rows, 'hr')?.verdict).toBe('ok')
    expect(row(rows, 'pace')?.verdict).toBe('ok')
  })
  it('footing couru trop vite / trop haut en FC', () => {
    const rows = compareSession(easyRun, act({ avg_hr: 158, avg_speed_ms: 1000 / 300 }))
    expect(row(rows, 'hr')?.verdict).toBe('over')
    expect(row(rows, 'pace')?.verdict).toBe('over')
  })
  it('plus lent ou plus bas que la cible en facile : pas un problème', () => {
    const rows = compareSession(easyRun, act({ avg_hr: 128, avg_speed_ms: 1000 / 380 }))
    expect(row(rows, 'hr')?.verdict).toBe('ok')
    expect(row(rows, 'pace')?.verdict).toBe('ok')
  })
  it('séance écourtée', () => {
    expect(row(compareSession(easyRun, act({ duration_s: 2400 })), 'duration')?.verdict).toBe(
      'under',
    )
  })
  it('fractionné : pas de verdict sur les moyennes', () => {
    const rows = compareSession({ ...easyRun, session_type: 'vo2' }, act({ avg_hr: 165 }))
    expect(row(rows, 'hr')?.verdict).toBeNull()
    expect(row(rows, 'hr')?.note).toMatch(/intensités variables/)
  })
  it('trail : D+ comparé, allure non jugée', () => {
    const trail = { ...easyRun, session_type: 'long', target_values: { ...easyRun.target_values, elevation_gain_m: 500 } }
    const rows = compareSession(trail, act({ elevation_gain_m: 300, avg_speed_ms: 1000 / 300 }))
    expect(row(rows, 'elevation')?.verdict).toBe('under')
    expect(row(rows, 'pace')?.verdict).toBeNull()
    expect(row(rows, 'pace')?.note).toMatch(/vallonné/)
  })
  it('vélo : puissance moyenne et vitesse', () => {
    const rows = compareSession(
      { discipline: 'bike', session_type: 'easy', duration_min: 90, target_values: { watts: [140, 180] } },
      act({ duration_s: 5400, avg_watts: 200, avg_speed_ms: 8 }),
    )
    expect(row(rows, 'watts')?.verdict).toBe('over')
    expect(row(rows, 'pace')?.actual).toBe('28,8 km/h')
  })
  it('natation : allure /100 m', () => {
    const rows = compareSession(
      { discipline: 'swim', session_type: 'easy', duration_min: 45, target_values: { pace_per_100m: '1:55-2:05' } },
      act({ distance_m: 2000, avg_speed_ms: 100 / 118, elevation_gain_m: null }),
    )
    expect(row(rows, 'pace')).toMatchObject({ actual: '1:58/100 m', verdict: 'ok' })
    expect(row(rows, 'elevation')).toBeUndefined()
  })
})

describe('summarizeComparison', () => {
  it('résume avec les écarts marqués', () => {
    const s = summarizeComparison(compareSession(easyRun, act({ avg_hr: 158 })))
    expect(s).toContain('Durée 1h00 (prévu 1h00) ✓')
    expect(s).toContain('FC moyenne 158 bpm (prévu 136-150 bpm) ↑ trop intense')
  })
})

describe('executionTrends', () => {
  const done = (o: Partial<import('./compare').ExecutedSession> = {}) => ({
    session_type: 'easy',
    status: 'done',
    expected_rpe: 3,
    actual_rpe: 3,
    rows: compareSession(easyRun, act()),
    ...o,
  })
  it('rien de notable', () => {
    expect(executionTrends([done(), done(), done()])).toEqual([])
  })
  it('footings trop intenses', () => {
    const hard = compareSession(easyRun, act({ avg_hr: 160 }))
    const t = executionTrends([done({ rows: hard }), done({ rows: hard }), done()])
    expect(t[0]).toMatch(/Séances faciles souvent trop intenses \(2\/3\)/)
  })
  it('séances sautées et ressenti plus dur', () => {
    const t = executionTrends([
      done({ status: 'skipped', rows: [] }),
      done({ status: 'skipped', rows: [] }),
      done({ actual_rpe: 6 }),
      done({ actual_rpe: 6 }),
    ])
    expect(t.join(' ')).toMatch(/2 séances sautées sur 4/)
    expect(t.join(' ')).toMatch(/Ressenti nettement plus dur/)
  })
  it('D+ réalisé insuffisant', () => {
    const trail = { ...easyRun, target_values: { elevation_gain_m: 500 } }
    const rows = compareSession(trail, act({ elevation_gain_m: 200 }))
    const t = executionTrends([done({ rows }), done({ rows })])
    expect(t.join(' ')).toMatch(/D\+ réalisé : 400 m sur 1000 m prévus \(40 %\) : relief/)
  })
})
