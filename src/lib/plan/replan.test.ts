import { describe, it, expect } from 'vitest'
import { computeReplanScope } from './replan'

const existingWeeks = Array.from({ length: 12 }, (_, i) => ({
  week_num: i + 1,
  start_date: undefined as unknown as string,
}))

describe('computeReplanScope', () => {
  it('préserve les semaines < cutoff, régénère le reste (même horizon)', () => {
    const r = computeReplanScope({
      existingWeekNums: existingWeeks.map((w) => w.week_num),
      cutoffWeek: 3,
      newTotalWeeks: 12,
    })
    expect(r.preservedWeeks).toEqual([1, 2])
    expect(r.regenerateWeeks).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(r.createWeeks).toEqual([])
  })

  it('étend l\'horizon quand la nouvelle course est plus lointaine', () => {
    const r = computeReplanScope({
      existingWeekNums: existingWeeks.map((w) => w.week_num),
      cutoffWeek: 3,
      newTotalWeeks: 16,
    })
    expect(r.regenerateWeeks).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(r.createWeeks).toEqual([13, 14, 15, 16])
  })

  it('raccourcit l\'horizon quand le nouveau pic est plus proche', () => {
    const r = computeReplanScope({
      existingWeekNums: existingWeeks.map((w) => w.week_num),
      cutoffWeek: 3,
      newTotalWeeks: 8,
    })
    expect(r.regenerateWeeks).toEqual([3, 4, 5, 6, 7, 8])
    expect(r.deleteWeeks).toEqual([9, 10, 11, 12])
    expect(r.createWeeks).toEqual([])
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
