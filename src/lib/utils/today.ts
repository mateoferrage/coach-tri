/** Date du jour (`yyyy-MM-dd`) dans un fuseau donné, Paris par défaut. */
export function todayIn(timeZone = 'Europe/Paris', now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
