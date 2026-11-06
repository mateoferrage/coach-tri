import { describe, it, expect } from 'vitest'
import {
  DISCIPLINE_LABEL,
  PHASE_LABEL,
  SESSION_TYPE_LABEL,
  formatDuration,
  formatWeekRange,
} from './display'

describe('formatDuration', () => {
  it('affiche un tiret pour 0, des minutes sous 1 h, puis h et minutes', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1 h 30')
    expect(formatDuration(125)).toBe('2 h 05')
  })
})

describe('formatWeekRange', () => {
  it('ne répète pas le mois quand la semaine tient dans un seul mois', () => {
    expect(formatWeekRange('2026-11-02')).toBe('du 2 au 8 novembre')
  })

  it('affiche les deux mois quand la semaine change de mois ou d’année', () => {
    expect(formatWeekRange('2026-10-29')).toBe('du 29 octobre au 4 novembre')
    expect(formatWeekRange('2026-12-28')).toBe('du 28 décembre au 3 janvier')
  })
})

describe('libellés', () => {
  it('couvre toutes les disciplines, types de séance et phases connus', () => {
    for (const d of ['swim', 'bike', 'run', 'brick', 'strength', 'rest']) {
      expect(DISCIPLINE_LABEL[d]).toBeTruthy()
    }
    for (const t of [
      'easy',
      'tempo',
      'threshold',
      'vo2',
      'race_pace',
      'technique',
      'long',
      'recovery',
      'test',
    ]) {
      expect(SESSION_TYPE_LABEL[t]).toBeTruthy()
    }
    for (const p of ['prep', 'base', 'build', 'peak', 'taper', 'race', 'maintenance']) {
      expect(PHASE_LABEL[p]).toBeTruthy()
    }
  })
})
