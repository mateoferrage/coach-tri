import { addDays, format, parseISO } from 'date-fns'

export interface PlanWeekRef {
  id: string
  week_num: number
  phase: string
  start_date: string
}

export interface DashboardSession {
  id: string
  title: string | null
  session_date: string
  day_part: 'morning' | 'midday' | 'evening' | null
  discipline: string
  session_type: string
  duration_min: number
  planned_tss: number | null
  target_zone: string | null
  coaching_note: string | null
  status: 'planned' | 'done' | 'skipped' | 'modified'
}

export type DayStatus = 'done' | 'today' | 'missed' | 'planned' | 'rest'

export interface WeekRow {
  key: string
  date: string
  session: DashboardSession | null
  status: DayStatus
  isToday: boolean
}

export interface WeekLoadSummary {
  planned: number
  done: number
  today: number
  sessionsDone: number
  sessionsTotal: number
  byDiscipline: { discipline: string; tss: number }[]
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const DAY_PART_ORDER: Record<string, number> = { morning: 0, midday: 1, evening: 2 }

/**
 * Semaine du plan en cours à `today` : la dernière commencée (même si `today` tombe
 * entre deux semaines) ; la première avant le début ; null après la fin de la dernière.
 */
export function findCurrentWeek(weeks: PlanWeekRef[], today: string): PlanWeekRef | null {
  const sorted = [...weeks].sort((a, b) => a.week_num - b.week_num)
  if (sorted.length === 0) return null
  const last = sorted[sorted.length - 1]
  if (today >= iso(addDays(parseISO(last.start_date), 7))) return null
  return sorted.findLast((w) => w.start_date <= today) ?? sorted[0]
}

function statusOf(s: DashboardSession, today: string): DayStatus {
  if (s.status === 'done') return 'done'
  if (s.discipline === 'rest') return 'rest'
  if (s.status === 'skipped') return 'missed'
  if (s.session_date === today) return 'today'
  return s.session_date < today ? 'missed' : 'planned'
}

/** 7 jours à partir de `weekStart` : une ligne par séance, une ligne repos par jour vide. */
export function buildWeekRows(
  sessions: DashboardSession[],
  weekStart: string,
  today: string,
): WeekRow[] {
  const rows: WeekRow[] = []
  for (let i = 0; i < 7; i++) {
    const date = iso(addDays(parseISO(weekStart), i))
    const daySessions = sessions
      .filter((s) => s.session_date === date)
      .sort(
        (a, b) => (DAY_PART_ORDER[a.day_part ?? ''] ?? 3) - (DAY_PART_ORDER[b.day_part ?? ''] ?? 3),
      )
    if (daySessions.length === 0) {
      rows.push({
        key: `rest-${date}`,
        date,
        session: null,
        status: 'rest',
        isToday: date === today,
      })
      continue
    }
    for (const s of daySessions) {
      rows.push({
        key: s.id,
        date,
        session: s,
        status: statusOf(s, today),
        isToday: date === today,
      })
    }
  }
  return rows
}

/**
 * Séance affichée par défaut : du jour, sinon prévue, sinon la première hors repos,
 * sinon un repos ; null sans séance.
 */
export function pickDefaultSessionId(rows: WeekRow[]): string | null {
  const withSession = rows.filter((r) => r.session)
  const pick =
    withSession.find((r) => r.status === 'today') ??
    withSession.find((r) => r.status === 'planned') ??
    withSession.find((r) => r.session!.discipline !== 'rest') ??
    withSession[0]
  return pick?.session?.id ?? null
}

export function summarizeWeekLoad(rows: WeekRow[]): WeekLoadSummary {
  const summary: WeekLoadSummary = {
    planned: 0,
    done: 0,
    today: 0,
    sessionsDone: 0,
    sessionsTotal: 0,
    byDiscipline: [],
  }
  const byDiscipline = new Map<string, number>()
  for (const { session, status } of rows) {
    if (!session || session.discipline === 'rest') continue
    const tss = session.planned_tss ?? 0
    summary.planned += tss
    summary.sessionsTotal += 1
    if (status === 'done') {
      summary.done += tss
      summary.sessionsDone += 1
    }
    if (status === 'today') summary.today += tss
    byDiscipline.set(session.discipline, (byDiscipline.get(session.discipline) ?? 0) + tss)
  }
  summary.byDiscipline = [...byDiscipline]
    .filter(([, tss]) => tss > 0)
    .map(([discipline, tss]) => ({ discipline, tss }))
    .sort((a, b) => b.tss - a.tss)
  return summary
}
