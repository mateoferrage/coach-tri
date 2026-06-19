export const HOUR_PX = 44
export const START_HOUR = 6
export const END_HOUR = 22

export function topPx(h: number): number {
  return (h - START_HOUR) * HOUR_PX
}

export function heightPx(start: number, end: number): number {
  return Math.max((end - start) * HOUR_PX - 3, 20)
}

export interface Placed<T> {
  item: T
  col: number
  cols: number
}

/**
 * Lay out time intervals into side-by-side columns so overlapping items never
 * stack on top of each other. Items that share a connected overlap cluster get
 * the same `cols` (total columns in that cluster); each gets its own `col`.
 * Touching intervals (end === next start) are treated as NON-overlapping.
 */
export function assignColumns<T>(
  items: T[],
  getStart: (item: T) => number,
  getEnd: (item: T) => number,
): Placed<T>[] {
  const sorted = items
    .map((item, i) => ({ item, start: getStart(item), end: getEnd(item), i }))
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const result = new Map<number, { col: number; cols: number }>()
  let cluster: typeof sorted = []
  let clusterEnd = -Infinity

  const flush = () => {
    if (cluster.length === 0) return
    // Greedy column assignment within the cluster.
    const colEnds: number[] = []
    for (const ev of cluster) {
      let placed = -1
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= ev.start) {
          placed = c
          break
        }
      }
      if (placed === -1) {
        placed = colEnds.length
        colEnds.push(ev.end)
      } else {
        colEnds[placed] = ev.end
      }
      result.set(ev.i, { col: placed, cols: 0 })
    }
    const total = colEnds.length
    for (const ev of cluster) result.get(ev.i)!.cols = total
    cluster = []
    clusterEnd = -Infinity
  }

  for (const ev of sorted) {
    if (cluster.length > 0 && ev.start >= clusterEnd) flush()
    cluster.push(ev)
    clusterEnd = Math.max(clusterEnd, ev.end)
  }
  flush()

  return sorted.map(({ item, i }) => ({ item, ...result.get(i)! }))
}
