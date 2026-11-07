import { describe, it, expect } from 'vitest'
import { formatSyncDate } from './format-sync-date'

describe('formatSyncDate', () => {
  it("affiche l'heure de Paris quel que soit le fuseau de la machine", () => {
    // 08:49 UTC = 10:49 à Paris (heure d'été).
    expect(formatSyncDate('2026-10-01T08:49:00Z')).toBe('1 octobre 2026 à 10:49')
  })

  it("tient compte de l'heure d'hiver", () => {
    // 10:53 UTC = 11:53 à Paris en janvier.
    expect(formatSyncDate('2026-01-15T10:53:00Z')).toBe('15 janvier 2026 à 11:53')
  })
})
