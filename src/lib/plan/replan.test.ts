import { describe, it, expect } from 'vitest'
import { computeReplanScope } from './replan'

const weekNums = Array.from({ length: 12 }, (_, i) => i + 1)

describe('computeReplanScope', () => {
  it('préserve les semaines < cutoff, régénère le reste (même horizon)', () => {
    const r = computeReplanScope({
      existingWeekNums: weekNums,
      cutoffWeek: 3,
      newTotalWeeks: 12,
    })
    expect(r.preservedWeeks).toEqual([1, 2])
    expect(r.regenerateWeeks).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(r.createWeeks).toEqual([])
  })

  it('étend l\'horizon quand la nouvelle course est plus lointaine', () => {
    const r = computeReplanScope({
      existingWeekNums: weekNums,
      cutoffWeek: 3,
      newTotalWeeks: 16,
    })
    expect(r.regenerateWeeks).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(r.createWeeks).toEqual([13, 14, 15, 16])
  })

  it('raccourcit l\'horizon quand le nouveau pic est plus proche', () => {
    const r = computeReplanScope({
      existingWeekNums: weekNums,
      cutoffWeek: 3,
      newTotalWeeks: 8,
    })
    expect(r.regenerateWeeks).toEqual([3, 4, 5, 6, 7, 8])
    expect(r.deleteWeeks).toEqual([9, 10, 11, 12])
    expect(r.createWeeks).toEqual([])
  })

  it('crée toutes les semaines manquantes quand cutoff dépasse l’horizon existant', () => {
    const r = computeReplanScope({
      existingWeekNums: [1, 2, 3, 4],
      cutoffWeek: 6,
      newTotalWeeks: 8,
    })
    expect(r.preservedWeeks).toEqual([1, 2, 3, 4])
    expect(r.regenerateWeeks).toEqual([])
    expect(r.createWeeks).toEqual([5, 6, 7, 8])
    expect(r.deleteWeeks).toEqual([])
  })

  it('cutoff=1 régénère tout (aucune semaine préservée)', () => {
    const r = computeReplanScope({
      existingWeekNums: [1, 2, 3, 4],
      cutoffWeek: 1,
      newTotalWeeks: 4,
    })
    expect(r.preservedWeeks).toEqual([])
    expect(r.regenerateWeeks).toEqual([1, 2, 3, 4])
  })
})
