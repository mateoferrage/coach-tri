const FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Date de dernière synchronisation (« 1 octobre 2026 à 10:49 »), toujours à l'heure de Paris.
 *
 * Le fuseau est fixé pour que le rendu serveur (UTC sur Vercel) et le rendu navigateur
 * produisent le même texte : sinon React signale une erreur d'hydratation (#418).
 */
export function formatSyncDate(iso: string): string {
  return FORMATTER.format(new Date(iso))
}
