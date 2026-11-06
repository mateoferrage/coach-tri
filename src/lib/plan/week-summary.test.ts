import { describe, it, expect } from 'vitest'
import {
  buildWeekRows,
  findCurrentWeek,
  pickDefaultSessionId,
  summarizeWeekLoad,
  type DashboardSession,
  type PlanWeekRef,
} from './week-summary'

const weeks: PlanWeekRef[] = [
  { id: 'w2', week_num: 2, phase: 'prep', start_date: '2026-11-09' },
  { id: 'w1', week_num: 1, phase: 'prep', start_date: '2026-11-02' },
]

describe('findCurrentWeek', () => {
  it('trouve la semaine qui contient la date', () => {
    expect(findCurrentWeek(weeks, '2026-11-06')?.id).toBe('w1')
    expect(findCurrentWeek(weeks, '2026-11-09')?.id).toBe('w2')
    expect(findCurrentWeek(weeks, '2026-11-15')?.id).toBe('w2')
  })

  it('renvoie la première semaine avant le début, null après la fin', () => {
    expect(findCurrentWeek(weeks, '2026-10-20')?.id).toBe('w1')
    expect(findCurrentWeek(weeks, '2026-11-16')).toBeNull()
    expect(findCurrentWeek([], '2026-11-06')).toBeNull()
  })

  it('garde la dernière semaine commencée quand la date tombe entre deux semaines', () => {
    const gapped: PlanWeekRef[] = [
      { id: 'a', week_num: 1, phase: 'prep', start_date: '2026-11-02' },
      { id: 'b', week_num: 2, phase: 'prep', start_date: '2026-11-16' },
    ]
    expect(findCurrentWeek(gapped, '2026-11-10')?.id).toBe('a')
    expect(findCurrentWeek(gapped, '2026-11-22')?.id).toBe('b')
    expect(findCurrentWeek(gapped, '2026-11-23')).toBeNull()
  })
})

function mk(over: Partial<DashboardSession> & Pick<DashboardSession, 'id'>): DashboardSession {
  return {
    title: null,
    session_date: '2026-11-02',
    day_part: null,
    discipline: 'run',
    session_type: 'easy',
    duration_min: 45,
    planned_tss: 40,
    target_zone: null,
    coaching_note: null,
    status: 'planned',
    ...over,
  }
}

const sessions: DashboardSession[] = [
  mk({ id: 'sun', session_date: '2026-11-08', planned_tss: 68 }),
  mk({
    id: 'fri-pm',
    session_date: '2026-11-06',
    day_part: 'evening',
    discipline: 'strength',
    planned_tss: 25,
  }),
  mk({ id: 'fri-am', session_date: '2026-11-06', day_part: 'morning', planned_tss: 62 }),
  mk({ id: 'wed', session_date: '2026-11-04', discipline: 'bike', planned_tss: 70 }),
  mk({
    id: 'tue',
    session_date: '2026-11-03',
    discipline: 'swim',
    planned_tss: 45,
    status: 'done',
  }),
  mk({
    id: 'mon',
    session_date: '2026-11-02',
    discipline: 'rest',
    duration_min: 0,
    planned_tss: null,
  }),
]

describe('buildWeekRows', () => {
  const rows = buildWeekRows(sessions, '2026-11-02', '2026-11-06')

  it('produit une ligne par séance et une ligne repos par jour vide', () => {
    expect(rows.map((r) => r.session?.id ?? null)).toEqual([
      'mon',
      'tue',
      'wed',
      null,
      'fri-am',
      'fri-pm',
      null,
      'sun',
    ])
    expect(rows.map((r) => r.date)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ])
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
  })

  it('calcule le statut de chaque ligne', () => {
    expect(rows.map((r) => r.status)).toEqual([
      'rest',
      'done',
      'missed',
      'rest',
      'today',
      'today',
      'rest',
      'planned',
    ])
    expect(rows.filter((r) => r.isToday).map((r) => r.session?.id)).toEqual(['fri-am', 'fri-pm'])
  })

  it('marque une séance sautée comme manquée, même dans le futur', () => {
    const r = buildWeekRows(
      [mk({ id: 'x', session_date: '2026-11-08', status: 'skipped' })],
      '2026-11-02',
      '2026-11-06',
    )
    expect(r.find((row) => row.session?.id === 'x')?.status).toBe('missed')
  })

  it('garde le statut repos pour un jour de repos marqué sauté', () => {
    const r = buildWeekRows(
      [mk({ id: 'r', session_date: '2026-11-03', discipline: 'rest', status: 'skipped' })],
      '2026-11-02',
      '2026-11-06',
    )
    expect(r.find((row) => row.session?.id === 'r')?.status).toBe('rest')
  })
})

describe('pickDefaultSessionId', () => {
  it('choisit la première séance du jour', () => {
    expect(pickDefaultSessionId(buildWeekRows(sessions, '2026-11-02', '2026-11-06'))).toBe('fri-am')
  })

  it('sinon la première séance prévue', () => {
    expect(pickDefaultSessionId(buildWeekRows(sessions, '2026-11-02', '2026-11-01'))).toBe('wed')
  })

  it('sinon la première séance hors repos de la semaine, ou null sans séance', () => {
    const allDone = sessions.map((s) => ({ ...s, status: 'done' as const }))
    expect(pickDefaultSessionId(buildWeekRows(allDone, '2026-11-02', '2026-11-20'))).toBe('tue')
    expect(pickDefaultSessionId(buildWeekRows([], '2026-11-02', '2026-11-06'))).toBeNull()
  })

  it('se rabat sur une séance de repos s’il n’y a rien d’autre', () => {
    const onlyRest = sessions.filter((s) => s.discipline === 'rest')
    expect(pickDefaultSessionId(buildWeekRows(onlyRest, '2026-11-02', '2026-11-06'))).toBe('mon')
  })
})

describe('summarizeWeekLoad', () => {
  it('additionne la charge prévue, faite et du jour, et la répartit par discipline', () => {
    const load = summarizeWeekLoad(buildWeekRows(sessions, '2026-11-02', '2026-11-06'))
    expect(load).toEqual({
      planned: 270,
      done: 45,
      today: 87,
      sessionsDone: 1,
      sessionsTotal: 5,
      byDiscipline: [
        { discipline: 'run', tss: 130 },
        { discipline: 'bike', tss: 70 },
        { discipline: 'swim', tss: 45 },
        { discipline: 'strength', tss: 25 },
      ],
    })
  })
})
