import { describe, it, expect } from 'vitest'
import { calculateZones, computeFitnessLevel, formatZonesForPrompt } from './zones'

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
    // Z4 Seuil = 91%–105% FTP (Coggan)
    const z4 = z!.bike!.zones[3]
    expect(z4.label).toContain('Seuil')
    expect(z4.watts_min).toBe(228)
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

  it('zones d\'allure course de Friel (% allure seuil)', () => {
    const z = calculateZones({ run_threshold_pace_sec_per_km: 270 }) // 4:30/km
    const [z1, z2, , z4, z5] = z!.run!.zones
    expect(z1.pace_min).toBe('5:48') // 129 %
    expect(z2.pace_min).toBe('5:08') // 114 %
    expect(z4.pace_min).toBe('4:27') // 99 %
    expect(z4.pace_max).toBe('4:46') // 106 %
    expect(z5.pace_max).toBe('4:27')
  })

  it('zones FC course et vélo de Friel (% FC seuil), bornes différentes', () => {
    const z = calculateZones({
      run_threshold_pace_sec_per_km: 270,
      hr_threshold_run: 170,
      ftp_watts: 250,
      hr_threshold_bike: 160,
    })
    expect(z!.run!.zones[1]).toMatchObject({ hr_min: 145, hr_max: 151 }) // 85-89 %
    expect(z!.run!.zones[3]).toMatchObject({ hr_min: 162, hr_max: 168 }) // 95-99 %
    expect(z!.bike!.zones[1]).toMatchObject({ hr_min: 130, hr_max: 142 }) // 81-89 %
  })

  it('donne des zones FC même sans allure ni FTP connus', () => {
    const z = calculateZones({ hr_max: 190 })
    expect(z?.run?.zones[1].hr_max).toBeDefined()
    expect(z?.bike?.zones[1].hr_max).toBeDefined()
    expect(z!.run!.header).toMatch(/ressenti/)
    expect(z!.run!.zones[1].pace_min).toBeUndefined()
  })

  it('zones natation en secondes autour de la CSS', () => {
    const z = calculateZones({ css_pace_sec_per_100m: 105 }) // 1:45
    const [z1, z2, , z4, z5] = z!.swim!.zones
    expect(z1.pace_min).toBe('2:00')
    expect(z2).toMatchObject({ pace_min: '1:53', pace_max: '2:00' })
    expect(z4).toMatchObject({ pace_min: '1:43', pace_max: '1:48' })
    expect(z5.pace_max).toBe('1:43')
  })

  it('formule les zones extrêmes sans ambiguïté (plus lent / plus rapide)', () => {
    const out = formatZonesForPrompt(
      calculateZones({ run_threshold_pace_sec_per_km: 270, css_pace_sec_per_100m: 105 })!,
    )
    expect(out).toContain('plus lent que 5:48/km')
    expect(out).toContain('plus rapide que 4:27/km')
    expect(out).toContain('plus lent que 2:00/100m')
  })

  it('ne garde que les zones des disciplines du programme', async () => {
    const { pickZones } = await import('./zones')
    const all = calculateZones({ hr_max: 190, css_pace_sec_per_100m: 100 })
    expect(Object.keys(pickZones(all, ['run', 'strength'])!)).toEqual(['run'])
    expect(pickZones(all, null)).toBe(all)
    expect(pickZones(calculateZones({ ftp_watts: 200 }), ['run'])).toBeNull()
  })
})
