import { describe, it, expect } from 'vitest'
import { summarizeActivities, summarizeWellness } from './athlete-context'

describe('summarizeActivities', () => {
  it('donne le volume par sport et la moyenne hebdomadaire réelle sur 8 semaines', () => {
    const activities = Array.from({ length: 40 }, () => ({
      activity_type: 'run',
      duration_s: 3600,
    }))
    const out = summarizeActivities(activities)
    expect(out).toContain('run: 40 séances, 40.0h sur 8 semaines')
    expect(out).toContain('Volume moyen réel : 5.0h/semaine')
  })
  it('renvoie une chaîne vide sans activité', () => {
    expect(summarizeActivities([])).toBe('')
  })
})

describe('summarizeWellness', () => {
  it("n'affiche que les données présentes", () => {
    expect(summarizeWellness([{ hrv_rmssd: 50 }, { hrv_rmssd: 70 }])).toBe('HRV moyen : 60 ms')
    expect(summarizeWellness([])).toBe('')
  })
})
