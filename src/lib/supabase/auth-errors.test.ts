import { describe, it, expect } from 'vitest'
import { authErrorMessage, AUTH_FALLBACK_MESSAGE } from './auth-errors'

describe('authErrorMessage', () => {
  it('traduit un code connu', () => {
    expect(
      authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    ).toBe('E-mail ou mot de passe incorrect.')
  })

  it("se rabat sur le texte quand l'erreur n'a pas de code", () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toBe(
      'E-mail ou mot de passe incorrect.',
    )
    expect(authErrorMessage(new Error('User already registered'))).toBe(
      'Un compte existe déjà avec cet e-mail.',
    )
  })

  it("n'affiche jamais un message inconnu en anglais", () => {
    expect(authErrorMessage(new Error('Something unexpected'))).toBe(AUTH_FALLBACK_MESSAGE)
    expect(authErrorMessage(null)).toBe(AUTH_FALLBACK_MESSAGE)
  })
})
