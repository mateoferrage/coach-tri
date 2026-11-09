import { describe, it, expect } from 'vitest'
import { availableDatesForWeek, dayOfWeek, resolveAvailableDays } from './schedule'

describe('availableDatesForWeek', () => {
  it('associe chaque jour à sa vraie date quand le plan démarre un mercredi', () => {
    // 2026-11-11 = mercredi → la semaine de plan va jusqu'au mardi suivant
    const dates = availableDatesForWeek({
      week_start_date: '2026-11-11',
      available_days: [1, 3, 6],
    })
    expect(dates).toEqual(['2026-11-11', '2026-11-14', '2026-11-16'])
    expect(dates.map(dayOfWeek)).toEqual([3, 6, 1])
  })

  it('retire les dates bloquées et tout ce qui suit la course principale', () => {
    expect(
      availableDatesForWeek({
        week_start_date: '2026-11-09',
        available_days: [0, 1, 2, 3, 4, 5, 6],
        blocked_dates: ['2026-11-10'],
        last_date: '2026-11-12',
      }),
    ).toEqual(['2026-11-09', '2026-11-11', '2026-11-12'])
  })

  it('retire les jours passés seulement pour la semaine en cours', () => {
    const base = { week_start_date: '2026-11-09', available_days: [1, 3, 5] }
    expect(availableDatesForWeek({ ...base, today: '2026-11-11' })).toEqual([
      '2026-11-11',
      '2026-11-13',
    ])
    expect(availableDatesForWeek({ ...base, today: '2026-12-25' })).toHaveLength(3)
  })
})

describe('resolveAvailableDays', () => {
  it('privilégie le choix ponctuel, puis celui du plan, puis lundi–samedi', () => {
    expect(resolveAvailableDays([2], [1, 3])).toEqual([2])
    expect(resolveAvailableDays(undefined, [1, 3])).toEqual([1, 3])
    expect(resolveAvailableDays(undefined, null)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
