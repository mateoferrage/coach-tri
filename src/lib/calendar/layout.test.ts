import { describe, it, expect } from 'vitest'
import { topPx, heightPx, assignColumns, HOUR_PX, START_HOUR } from './layout'

const get = (x: { s: number; e: number }) => [x.s, x.e] as const

describe('topPx / heightPx', () => {
  it('places START_HOUR at the top', () => {
    expect(topPx(START_HOUR)).toBe(0)
  })
  it('one hour below start is HOUR_PX', () => {
    expect(topPx(START_HOUR + 1)).toBe(HOUR_PX)
  })
  it('enforces a minimum height', () => {
    expect(heightPx(8, 8)).toBeGreaterThanOrEqual(20)
  })
})

describe('assignColumns', () => {
  it('gives a single column when nothing overlaps', () => {
    const items = [
      { s: 6, e: 7 },
      { s: 8, e: 9 },
    ]
    const out = assignColumns(
      items,
      (x) => get(x)[0],
      (x) => get(x)[1],
    )
    expect(out.every((o) => o.cols === 1 && o.col === 0)).toBe(true)
  })
  it('splits two overlapping items into two columns', () => {
    const items = [
      { s: 6, e: 8 },
      { s: 7, e: 9 },
    ]
    const out = assignColumns(
      items,
      (x) => get(x)[0],
      (x) => get(x)[1],
    )
    expect(out.map((o) => o.cols)).toEqual([2, 2])
    expect(new Set(out.map((o) => o.col))).toEqual(new Set([0, 1]))
  })
  it('splits three simultaneous items into three columns', () => {
    const items = [
      { s: 6, e: 9 },
      { s: 6, e: 9 },
      { s: 6, e: 9 },
    ]
    const out = assignColumns(
      items,
      (x) => get(x)[0],
      (x) => get(x)[1],
    )
    expect(out.every((o) => o.cols === 3)).toBe(true)
    expect(new Set(out.map((o) => o.col))).toEqual(new Set([0, 1, 2]))
  })
  it('treats adjacent (touching) items as non-overlapping', () => {
    const items = [
      { s: 6, e: 7 },
      { s: 7, e: 8 },
    ]
    const out = assignColumns(
      items,
      (x) => get(x)[0],
      (x) => get(x)[1],
    )
    expect(out.every((o) => o.cols === 1)).toBe(true)
  })
})
