import { addDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

/** Libellés courts, pour les cartes et les listes. */
export const DISCIPLINE_LABEL: Record<string, string> = {
  swim: 'Natation',
  bike: 'Vélo',
  run: 'Course',
  brick: 'Enchaînement',
  strength: 'Renfo',
  rest: 'Repos',
}

export const SESSION_TYPE_LABEL: Record<string, string> = {
  easy: 'Endurance facile',
  tempo: 'Tempo',
  threshold: 'Seuil',
  vo2: 'VO2max',
  race_pace: 'Allure course',
  technique: 'Technique',
  long: 'Sortie longue',
  recovery: 'Récupération active',
  test: 'Test',
}

export const PHASE_LABEL: Record<string, string> = {
  prep: 'Préparation',
  base: 'Base',
  build: 'Construction',
  peak: 'Pic',
  taper: 'Affûtage',
  race: 'Course',
  maintenance: 'Maintien',
}

/** 0 → « — », 45 → « 45 min », 90 → « 1 h 30 », 125 → « 2 h 05 ». */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

/** Semaine de 7 jours à partir de `startDate` : « du 2 au 8 novembre ». */
export function formatWeekRange(startDate: string): string {
  const start = parseISO(startDate)
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const from = format(start, sameMonth ? 'd' : 'd MMMM', { locale: fr })
  return `du ${from} au ${format(end, 'd MMMM', { locale: fr })}`
}
