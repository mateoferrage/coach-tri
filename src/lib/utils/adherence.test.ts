import { describe, it, expect } from 'vitest'
import { computeWeeklyAdherence, type SessionForAdherence } from './adherence'

const TODAY = new Date('2026-06-15T12:00:00Z')

function session(partial: Partial<SessionForAdherence> & { id: string }): SessionForAdherence {
  return {
    session_date: '2026-06-10',
    session_type: 'easy',
    duration_min: 60,
    status: 'planned',
    actual_duration_min: null,
    target_zone: null,
    garmin_activity_id: null,
    ...partial,
  }
}

const week: SessionForAdherence[] = [
  session({
    id: 's1',
    session_date: '2026-06-10',
    status: 'done',
    target_zone: 'Z2',
    duration_min: 60,
  }),
  session({
    id: 's2',
    session_date: '2026-06-12',
    status: 'done',
    target_zone: 'Z4',
    duration_min: 90,
  }),
  session({
    id: 's3',
    session_date: '2026-06-13',
    status: 'skipped',
    target_zone: 'Z2',
    duration_min: 45,
  }),
  session({ id: 's4', session_date: '2026-06-14', session_type: 'rest', duration_min: 0 }),
  session({ id: 's5', session_date: '2026-06-20', status: 'planned', duration_min: 60 }),
]

describe('computeWeeklyAdherence', () => {
  const r = computeWeeklyAdherence(week, {}, 3, week, 12, undefined, TODAY)

  it('exclut les séances de repos et les séances futures du décompte "dû"', () => {
    expect(r.sessionsTotal).toBe(4) // exclut rest
    expect(r.sessionsDue).toBe(3) // s1, s2, s3
    expect(r.sessionsUpcoming).toBe(1) // s5
    expect(r.weekInProgress).toBe(true)
  })

  it('calcule le taux de complétion sur les séances dues uniquement', () => {
    expect(r.sessionsCompleted).toBe(2)
    expect(r.sessionsSkipped).toBe(1)
    expect(r.completionRate).toBe(67) // 2/3
  })

  it('calcule le delta de volume (réel vs prévu)', () => {
    expect(r.plannedDurationMin).toBe(195) // 60+90+45
    expect(r.actualDurationMin).toBe(150) // s1+s2 réalisées
    expect(r.volumeDeltaPct).toBe(-23)
  })

  it("dérive la distribution d'intensité depuis target_zone en l'absence de FC", () => {
    expect(r.intensityDistribution.Z2).toBe(40)
    expect(r.intensityDistribution.Z4).toBe(60)
    expect(r.rule8020).toEqual({ easyPct: 40, hardPct: 60, compliant: false })
  })

  it('agrège la progression cumulée du programme', () => {
    expect(r.cumulativeProgress).toMatchObject({
      totalCompleted: 2,
      totalPlanned: 4,
      weeksElapsed: 3,
      weeksTotal: 12,
      overallRate: 50,
    })
  })

  it('renvoie 100% de complétion pour une semaine sans séance due', () => {
    const future = [session({ id: 'f1', session_date: '2026-06-25', status: 'planned' })]
    const res = computeWeeklyAdherence(future, {}, 1, future, 12, undefined, TODAY)
    expect(res.sessionsDue).toBe(0)
    expect(res.completionRate).toBe(100)
  })
})
