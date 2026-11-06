import { describe, it, expect } from 'vitest'
import { effortSegments } from './effort'

const base = { discipline: 'run', session_type: 'easy', duration_min: 50, target_zone: null }

describe('effortSegments', () => {
  it('découpe en échauffement 20 %, corps 70 %, retour au calme 10 %', () => {
    expect(effortSegments({ ...base, session_type: 'threshold' })).toEqual([
      { zone: 1, share: 0.2 },
      { zone: 4, share: 0.7 },
      { zone: 1, share: 0.1 },
    ])
  })

  it('prend la zone la plus haute citée dans target_zone', () => {
    expect(effortSegments({ ...base, target_zone: 'Z3' })[1].zone).toBe(3)
    expect(effortSegments({ ...base, target_zone: 'Z2-Z3' })[1].zone).toBe(3)
    expect(effortSegments({ ...base, target_zone: 'zone 5' })[1].zone).toBe(5)
  })

  it('se rabat sur le type de séance si target_zone est vide ou invalide', () => {
    expect(effortSegments({ ...base, target_zone: 'Z7' })[1].zone).toBe(2)
    expect(effortSegments({ ...base, target_zone: '' })[1].zone).toBe(2)
    expect(effortSegments({ ...base, target_zone: 'seuil' })[1].zone).toBe(2)
  })

  it('associe chaque type de séance à une zone', () => {
    const zoneOf = (t: string) => effortSegments({ ...base, session_type: t })[1].zone
    expect(['easy', 'long', 'technique', 'recovery'].map(zoneOf)).toEqual([2, 2, 2, 2])
    expect(zoneOf('tempo')).toBe(3)
    expect(zoneOf('threshold')).toBe(4)
    expect(zoneOf('race_pace')).toBe(4)
    expect(zoneOf('vo2')).toBe(5)
    expect(zoneOf('test')).toBe(5)
    expect(zoneOf('inconnu')).toBe(2)
  })

  it('ne renvoie rien pour un repos ou une durée nulle', () => {
    expect(effortSegments({ ...base, discipline: 'rest' })).toEqual([])
    expect(effortSegments({ ...base, duration_min: 0 })).toEqual([])
  })
})
