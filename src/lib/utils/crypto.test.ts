import { describe, it, expect, beforeAll } from 'vitest'
import { encryptCredential, decryptCredential } from './crypto'

// Clé de test déterministe (64 chars hex = 32 bytes)
const TEST_KEY = 'a'.repeat(64)

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY
})

describe('encryptCredential / decryptCredential', () => {
  it('fait un aller-retour sans perte', () => {
    const secret = 'strava_access_token_abc123'
    expect(decryptCredential(encryptCredential(secret))).toBe(secret)
  })

  it('gère les chaînes vides et les caractères unicode', () => {
    expect(decryptCredential(encryptCredential(''))).toBe('')
    expect(decryptCredential(encryptCredential('é→ñ 🚴'))).toBe('é→ñ 🚴')
  })

  it('produit un ciphertext différent à chaque appel (IV aléatoire)', () => {
    const a = encryptCredential('même valeur')
    const b = encryptCredential('même valeur')
    expect(a).not.toBe(b)
    // mais les deux déchiffrent vers la même valeur
    expect(decryptCredential(a)).toBe(decryptCredential(b))
  })

  it('produit le format ivHex:encryptedHex', () => {
    const [ivHex, encHex] = encryptCredential('x').split(':')
    expect(ivHex).toMatch(/^[0-9a-f]{32}$/) // IV 16 bytes
    expect(encHex).toMatch(/^[0-9a-f]+$/)
  })

  it('rejette un ciphertext mal formé', () => {
    expect(() => decryptCredential('pas_de_separateur')).toThrow('Invalid ciphertext format')
  })

  it('accepte une clé brute de 32 caractères', () => {
    const prev = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'b'.repeat(32)
    expect(decryptCredential(encryptCredential('hello'))).toBe('hello')
    process.env.ENCRYPTION_KEY = prev
  })

  it('rejette une clé de longueur invalide', () => {
    const prev = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'trop_court'
    expect(() => encryptCredential('x')).toThrow('ENCRYPTION_KEY')
    process.env.ENCRYPTION_KEY = prev
  })
})
