import { differenceInCalendarDays, differenceInWeeks, parseISO } from 'date-fns'

export interface RaceSummary {
  raceName: string
  raceDate: string
  daysLeft: number
  weekNum: number
  totalWeeks: number
}

export interface RaceSummaryInput {
  raceName: string | null
  raceDate: string | null
  startDate: string
  totalWeeks: number
}

/**
 * Résumé de la course principale affiché dans le menu latéral.
 * Renvoie null si le plan n'a pas de course datée (ancien plan sans objectif), pas de
 * semaines, ou si la course est passée. La semaine en cours suit le même
 * calcul que le tableau de bord.
 */
export function buildRaceSummary(input: RaceSummaryInput, today: Date): RaceSummary | null {
  const { raceName, raceDate, startDate, totalWeeks } = input
  if (!raceName || !raceDate || totalWeeks <= 0) return null

  const daysLeft = differenceInCalendarDays(parseISO(raceDate), today)
  if (daysLeft < 0) return null

  const elapsed = Math.max(0, differenceInWeeks(today, parseISO(startDate)))
  const weekNum = Math.min(elapsed + 1, totalWeeks)

  return { raceName, raceDate, daysLeft, weekNum, totalWeeks }
}

export function formatCountdown(daysLeft: number): string {
  return daysLeft === 0 ? 'Jour J' : `J-${daysLeft}`
}
