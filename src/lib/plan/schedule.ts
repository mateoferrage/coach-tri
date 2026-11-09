/** Jours utilisés pour les plans créés avant le choix des jours (lundi–samedi). */
export const LEGACY_AVAILABLE_DAYS = [1, 2, 3, 4, 5, 6]

/**
 * Jours d'entraînement à utiliser pour une génération (0=dim … 6=sam) : un choix
 * ponctuel (ex. demandé au coach) l'emporte sur ceux choisis à la création du plan.
 */
export function resolveAvailableDays(
  override?: number[] | null,
  planDays?: number[] | null,
): number[] {
  if (override?.length) return override
  if (planDays?.length) return planDays
  return LEGACY_AVAILABLE_DAYS
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Jour de la semaine (0=dim … 6=sam) d'une date `yyyy-MM-dd`. */
export function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

/**
 * Dates réellement planifiables d'une semaine de plan. Une semaine de plan court
 * sur 7 jours à partir de sa date de début, qui n'est pas forcément un lundi.
 *
 * Sont exclus : les jours non disponibles, les dates bloquées (séance déjà
 * traitée, jour de course), tout ce qui suit la course principale et, pour la
 * semaine en cours uniquement, les jours déjà passés.
 */
export function availableDatesForWeek(params: {
  week_start_date: string
  available_days: number[]
  blocked_dates?: string[]
  last_date?: string | null
  today?: string
}): string[] {
  const { week_start_date, available_days, last_date, today } = params
  const blocked = new Set(params.blocked_dates ?? [])
  const week = Array.from({ length: 7 }, (_, i) => addDaysIso(week_start_date, i))
  const isCurrentWeek = !!today && today >= week[0] && today <= week[6]

  return week.filter(
    (date) =>
      available_days.includes(dayOfWeek(date)) &&
      !blocked.has(date) &&
      (!last_date || date <= last_date) &&
      (!isCurrentWeek || date >= today),
  )
}
