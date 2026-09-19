import { describe, it, expect } from 'vitest'
import {
  criticalVelocity,
  riegelPredict,
  deriveRunThresholdPaceSecPerKm,
  deriveSwimCssSecPer100m,
  deriveVmaKmh,
  derivePhysiologyFromRecords,
} from './performance'

describe('criticalVelocity', () => {
  it('retourne la pente exacte pour deux points alignés', () => {
    // 5 km en 20:00 (1200 s), 10 km en 41:40 (2500 s)
    const cv = criticalVelocity([
      { distance_m: 5000, time_s: 1200 },
      { distance_m: 10000, time_s: 2500 },
    ])
    // (10000-5000)/(2500-1200) = 3.8462 m/s
    expect(cv).toBeCloseTo(3.8462, 3)
  })

  it('retourne null avec moins de deux points', () => {
    expect(criticalVelocity([{ distance_m: 5000, time_s: 1200 }])).toBeNull()
    expect(criticalVelocity([])).toBeNull()
  })

  it('retourne null si la pente est non physiologique (<= 0)', () => {
    // temps qui décroît quand la distance augmente → pente négative
    const cv = criticalVelocity([
      { distance_m: 5000, time_s: 2500 },
      { distance_m: 10000, time_s: 1200 },
    ])
    expect(cv).toBeNull()
  })
})

describe('riegelPredict', () => {
  it('prédit le même temps pour la même distance', () => {
    expect(riegelPredict({ distance_m: 10000, time_s: 2500 }, 10000)).toBeCloseTo(2500, 5)
  })

  it('utilise l’exposant 1.06 de Riegel', () => {
    // t2 = 1200 * (10000/5000)^1.06
    const expected = 1200 * Math.pow(2, 1.06)
    expect(riegelPredict({ distance_m: 5000, time_s: 1200 }, 10000)).toBeCloseTo(expected, 3)
  })
})

describe('deriveRunThresholdPaceSecPerKm', () => {
  it('dérive l’allure seuil depuis 5 km + 10 km via le modèle de vitesse critique', () => {
    const pace = deriveRunThresholdPaceSecPerKm({
      run_5k_time_s: 1200,
      run_10k_time_s: 2500,
    })
    // CV = 3.8462 m/s → 1000/CV = 260 s/km
    expect(pace).toBe(260)
  })

  it('retombe sur Riegel (ancre 10 km) avec un seul record', () => {
    const pace = deriveRunThresholdPaceSecPerKm({ run_5k_time_s: 1200 })
    // Riegel 5k→10k : 1200*2^1.06 = 2502 s → /10 = 250 s/km
    expect(pace).toBe(250)
  })

  it('retourne null sans aucun record course', () => {
    expect(deriveRunThresholdPaceSecPerKm({})).toBeNull()
  })
})

describe('deriveSwimCssSecPer100m', () => {
  it('calcule le CSS depuis le protocole 400/200', () => {
    // T400 = 7:00 (420 s), T200 = 3:10 (190 s)
    const css = deriveSwimCssSecPer100m({
      swim_200m_time_s: 190,
      swim_400m_time_s: 420,
    })
    // CSS = 200/230 = 0.8696 m/s → 100/CSS = 115 s/100m
    expect(css).toBe(115)
  })

  it('retombe sur Riegel avec un seul record nage', () => {
    const css = deriveSwimCssSecPer100m({ swim_400m_time_s: 420 })
    // ancre = 400 m → pace = 420/4 = 105 s/100m
    expect(css).toBe(105)
  })

  it('retourne null sans aucun record nage', () => {
    expect(deriveSwimCssSecPer100m({})).toBeNull()
  })
})

describe('deriveVmaKmh', () => {
  it('dérive la VMA depuis l’allure seuil (seuil ≈ 90% VMA)', () => {
    // seuil 260 s/km → 3.846 m/s → /0.9 = 4.274 m/s → 15.39 km/h
    const vma = deriveVmaKmh(260)
    expect(vma).toBeCloseTo(15.4, 1)
  })

  it('retourne null pour une allure nulle ou absente', () => {
    expect(deriveVmaKmh(null)).toBeNull()
    expect(deriveVmaKmh(0)).toBeNull()
  })
})

describe('derivePhysiologyFromRecords', () => {
  it('agrège les dérivations course et nage', () => {
    const d = derivePhysiologyFromRecords({
      run_5k_time_s: 1200,
      run_10k_time_s: 2500,
      swim_200m_time_s: 190,
      swim_400m_time_s: 420,
    })
    expect(d.run_threshold_pace_sec_per_km).toBe(260)
    expect(d.css_pace_sec_per_100m).toBe(115)
    expect(d.vma_kmh).toBeCloseTo(15.4, 1)
  })

  it('laisse les dérivés à null quand les records manquent', () => {
    const d = derivePhysiologyFromRecords({})
    expect(d.run_threshold_pace_sec_per_km).toBeNull()
    expect(d.css_pace_sec_per_100m).toBeNull()
    expect(d.vma_kmh).toBeNull()
  })
})
