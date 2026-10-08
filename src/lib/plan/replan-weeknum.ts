import { differenceInCalendarDays, parseISO } from 'date-fns'

/**
 * Numéro de semaine (1-based) d'une date donnée relativement au départ du plan.
 * Plancher à 1 si la date précède le départ.
 */
export function currentWeekNum(startDate: string, onDate: string): number {
  const days = differenceInCalendarDays(parseISO(onDate), parseISO(startDate))
  if (days < 0) return 1
  return Math.floor(days / 7) + 1
}
