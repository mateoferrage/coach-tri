import { describe, it, expect } from 'vitest'
import { expandEvents } from './recurrence'
import type { ScheduleEventRow } from '@/lib/schemas/schedule'

const base: Omit<ScheduleEventRow, 'id' | 'event_date' | 'is_recurring'> = {
  user_id: 'u1',
  title: 'Test',
  event_type: 'cours',
  start_time: '08:00',
  end_time: '10:00',
  created_at: '',
  updated_at: '',
}

// Week of Mon 2026-06-15 .. Sun 2026-06-21
const weekStart = new Date(2026, 5, 15)

describe('expandEvents', () => {
  it('emits a one-off event that falls in the week', () => {
    const rows = [{ ...base, id: '1', is_recurring: false, event_date: '2026-06-17' }]
    const out = expandEvents(rows as ScheduleEventRow[], weekStart)
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-06-17')
    expect(out[0].source_id).toBe('1')
  })

  it('expands a weekly recurring event to its matching day', () => {
    // recurrence_day 3 = Wednesday → 2026-06-17
    const rows = [
      {
        ...base,
        id: '2',
        is_recurring: true,
        event_date: '2026-06-03',
        recurrence_day: 3,
        recurrence_end_date: '2026-12-31',
      },
    ]
    const out = expandEvents(rows as ScheduleEventRow[], weekStart)
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-06-17')
    expect(out[0].is_recurring).toBe(true)
  })

  it('does not emit recurring occurrences after recurrence_end_date', () => {
    const rows = [
      {
        ...base,
        id: '3',
        is_recurring: true,
        event_date: '2026-06-03',
        recurrence_day: 3,
        recurrence_end_date: '2026-06-10',
      },
    ]
    expect(expandEvents(rows as ScheduleEventRow[], weekStart)).toHaveLength(0)
  })

  it('does not emit occurrences before the series start (event_date)', () => {
    const rows = [
      {
        ...base,
        id: '4',
        is_recurring: true,
        event_date: '2026-06-18', // Thursday, after the Wed occurrence
        recurrence_day: 3,
      },
    ]
    expect(expandEvents(rows as ScheduleEventRow[], weekStart)).toHaveLength(0)
  })

  it('derives recurrence_day from event_date when absent', () => {
    const rows = [
      { ...base, id: '5', is_recurring: true, event_date: '2026-06-03' }, // a Wednesday
    ]
    const out = expandEvents(rows as ScheduleEventRow[], weekStart)
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-06-17')
  })
})
