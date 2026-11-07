/** Erreur HTTP de l'API Strava, avec son statut pour choisir le message affiché. */
export class StravaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Début du corps de la réponse (Strava y précise la cause d'un 403). */
    readonly body = '',
  ) {
    super(message)
    this.name = 'StravaApiError'
  }
}

/** Le callback OAuth renvoie les droits réellement accordés (`scope`) : l'utilisateur peut décocher l'accès aux activités. */
export function hasActivityScope(scope: string | null): boolean {
  return (scope ?? '').split(',').some((s) => s === 'activity:read' || s === 'activity:read_all')
}

/** Message de synchronisation selon la réponse de Strava à la lecture des activités. */
export function stravaSyncErrorMessage(status: number | null): string {
  if (status === 401 || status === 403) {
    return 'Strava refuse l’accès à tes activités — reconnecte ton compte en autorisant « Voir les données de tes activités »'
  }
  if (status === 429) return 'Limite de requêtes Strava atteinte — réessaie dans 15 minutes'
  return status
    ? `Impossible de récupérer les activités Strava (erreur ${status})`
    : 'Impossible de récupérer les activités Strava'
}
