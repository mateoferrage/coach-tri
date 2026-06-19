import { parse } from 'date-fns'

/** "HH:MM" or "HH:MM:SS" → hours as a float (e.g. "06:30" → 6.5). */
export function timeToFrac(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

/** Parse a "yyyy-MM-dd" string as a LOCAL date at midnight (avoids UTC day-shift). */
export function parseLocalDate(s: string): Date {
  return parse(s, 'yyyy-MM-dd', new Date())
}
