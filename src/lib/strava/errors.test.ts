import { describe, it, expect } from 'vitest'
import { hasActivityScope, stravaSyncErrorMessage } from './errors'

describe('hasActivityScope', () => {
  it("accepte les droits de lecture d'activités", () => {
    expect(hasActivityScope('read,activity:read')).toBe(true)
    expect(hasActivityScope('read,activity:read_all')).toBe(true)
  })

  it("refuse quand l'accès aux activités a été décoché", () => {
    expect(hasActivityScope('read')).toBe(false)
    expect(hasActivityScope(null)).toBe(false)
  })
})

describe('stravaSyncErrorMessage', () => {
  it('demande de reconnecter en cas de refus', () => {
    expect(stravaSyncErrorMessage(401)).toMatch(/reconnecte ton compte/)
    expect(stravaSyncErrorMessage(403)).toMatch(/reconnecte ton compte/)
  })

  it('signale la limite de requêtes', () => {
    expect(stravaSyncErrorMessage(429)).toMatch(/15 minutes/)
  })

  it('donne le code pour les autres erreurs', () => {
    expect(stravaSyncErrorMessage(500)).toBe(
      'Impossible de récupérer les activités Strava (erreur 500)',
    )
    expect(stravaSyncErrorMessage(null)).toBe('Impossible de récupérer les activités Strava')
  })
})
