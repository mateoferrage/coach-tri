import { describe, it, expect, beforeAll } from 'vitest'
import { decryptStravaCreds, encryptStravaTokens } from './credentials'
import type { StravaTokens } from './client'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
})

const tokens: StravaTokens = {
  access_token: 'access_xyz',
  refresh_token: 'refresh_xyz',
  expires_at: 1_900_000_000,
  athlete_id: 42,
}

describe('encryptStravaTokens / decryptStravaCreds', () => {
  it('chiffre puis déchiffre les tokens sans perte', () => {
    const enc = encryptStravaTokens(tokens)
    const row = { ...enc, athlete_id: tokens.athlete_id, expires_at: tokens.expires_at }
    const decrypted = decryptStravaCreds(row)
    expect(decrypted).toEqual(tokens)
  })

  it("ne stocke jamais les tokens en clair (vérifie que c'est bien chiffré)", () => {
    const enc = encryptStravaTokens(tokens)
    expect(enc.access_token).not.toContain('access_xyz')
    expect(enc.refresh_token).not.toContain('refresh_xyz')
    expect(enc.access_token).toContain(':') // format ivHex:encHex
  })

  it('lève sur une ligne legacy stockée en clair (à reconnecter)', () => {
    const legacyRow = {
      athlete_id: 42,
      access_token: 'plaintext_legacy_token',
      refresh_token: 'plaintext_legacy_refresh',
      expires_at: 1_900_000_000,
    }
    expect(() => decryptStravaCreds(legacyRow)).toThrow()
  })
})
