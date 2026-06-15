import { describe, it, expect } from 'vitest'
import { calculateZones, computeFitnessLevel } from './zones'

describe('computeFitnessLevel', () => {
  it('classe selon les normes masculines par défaut', () => {
    expect(computeFitnessLevel(30, 'M')).toBe('débutant (faible capacité aérobie)')
    expect(computeFitnessLevel(48, 'M')).toBe('avancé')
    expect(computeFitnessLevel(65, 'M')).toBe('excellent / compétiteur')
  })

  it('applique des seuils plus bas pour les normes féminines', () => {
    // 40 = "avancé" chez la femme mais "intermédiaire" chez l'homme
    expect(computeFitnessLevel(40, 'F')).toBe('avancé')
    expect(computeFitnessLevel(40, 'M')).toBe('intermédiaire')
  })
})

describe('calculateZones', () => {
  it('retourne null sans aucune donnée physiologique exploitable', () => {
    expect(calculateZones({})).toBeNull()
  })

  it('calcule les zones vélo à partir du FTP', () => {
    const z = calculateZones({ ftp_watts: 250 })
    expect(z?.bike).toBeDefined()
    expect(z?.bike?.zones).toHaveLength(5)
    // Z4 Seuil = 90%–105% FTP
    const z4 = z!.bike!.zones[3]
    expect(z4.label).toContain('Seuil')
    expect(z4.watts_min).toBe(225)
    expect(z4.watts_max).toBe(263)
    expect(z!.bike!.header).toContain('FTP: 250W')
  })

  it('dérive les zones course à partir de la VMA seule', () => {
    const z = calculateZones({ vma_kmh: 18 })
    expect(z?.run).toBeDefined()
    expect(z?.run?.zones).toHaveLength(5)
    expect(z!.run!.header).toContain('VMA: 18.0 km/h')
  })

  it('ajoute les zones FC en méthode Karvonen quand FCmax + FC repos sont connues', () => {
    const z = calculateZones({
      vma_kmh: 18,
      hr_max_run: 190,
      resting_hr: 50,
    })
    expect(z!.run!.header).toContain('Karvonen')
    const z1 = z!.run!.zones[0]
    // réserve = 140 ; Z1 = 50%–60% → 120–134 bpm
    expect(z1.hr_min).toBe(120)
    expect(z1.hr_max).toBe(134)
  })

  it('calcule les zones natation à partir de la CSS', () => {
    const z = calculateZones({ css_pace_sec_per_100m: 90 })
    expect(z?.swim).toBeDefined()
    expect(z?.swim?.zones).toHaveLength(5)
    expect(z!.swim!.header).toContain('CSS: 1:30/100m')
  })
})
