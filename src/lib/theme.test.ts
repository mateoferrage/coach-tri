import { describe, it, expect } from 'vitest'
import {
  AMBER_RED,
  AMBER_RED_DEEP,
  ACCENT,
  EVENT_TYPE,
  INK,
  INK_MUTED,
  SKY_INK,
  intensityColor,
  withAlpha,
} from './theme'

describe('intensityColor', () => {
  it('passe en rouge ambré à partir de Z4, sur blanc comme sur bleu', () => {
    expect(intensityColor(4)).toBe(AMBER_RED)
    expect(intensityColor(5)).toBe(AMBER_RED)
    expect(intensityColor(4, 'blue')).toBe(AMBER_RED)
  })

  it('utilise des bleus de plus en plus soutenus de Z1 à Z3 sur blanc', () => {
    const z1 = intensityColor(1)
    const z2 = intensityColor(2)
    const z3 = intensityColor(3)
    expect(new Set([z1, z2, z3]).size).toBe(3)
    for (const c of [z1, z2, z3]) expect(c).toMatch(/^oklch\(/)
  })

  it('utilise du blanc translucide de Z1 à Z3 sur fond bleu', () => {
    expect(intensityColor(1, 'blue')).toBe('oklch(1 0 0 / 40%)')
    expect(intensityColor(2, 'blue')).toBe('oklch(1 0 0 / 40%)')
    expect(intensityColor(3, 'blue')).toBe('oklch(1 0 0 / 72%)')
  })

  it('borne et arrondit les zones hors échelle', () => {
    expect(intensityColor(0)).toBe(intensityColor(1))
    expect(intensityColor(9)).toBe(intensityColor(5))
    expect(intensityColor(2.6)).toBe(intensityColor(3))
    expect(intensityColor(Number.NaN)).toBe(intensityColor(1))
  })
})

describe('alias historiques', () => {
  it('restent compatibles avec withAlpha (oklch)', () => {
    expect(withAlpha(ACCENT, 12)).toBe(`${ACCENT.slice(0, -1)} / 12%)`)
  })

  it('ACCENT pointe sur le bleu lisible', () => {
    expect(ACCENT).toBe(SKY_INK)
  })
})

describe('EVENT_TYPE', () => {
  it('définit chaque couleur en oklch (requis par withAlpha)', () => {
    for (const k of ['cours', 'stage', 'rdv', 'autre']) {
      expect(EVENT_TYPE[k].color).toMatch(/^oklch\(/)
    }
  })

  it('utilise quatre couleurs distinctes', () => {
    const colors = Object.values(EVENT_TYPE).map((t) => t.color)
    expect(colors).toHaveLength(4)
    expect(new Set(colors).size).toBe(4)
  })

  it('suit la palette Élan', () => {
    expect(EVENT_TYPE.cours.color).toBe(INK)
    // Un cran sous AMBER_RED_DEEP, qui échoue en AA sur sa teinte à 14 %.
    expect(EVENT_TYPE.stage.color).not.toBe(AMBER_RED_DEEP)
    expect(EVENT_TYPE.stage.color).toMatch(/^oklch\(0\.52 0\.188 32\.7\)$/)
    expect(EVENT_TYPE.rdv.color).toBe('oklch(0.45 0.09 250)')
    expect(EVENT_TYPE.autre.color).toBe(INK_MUTED)
  })
})
