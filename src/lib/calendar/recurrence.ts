import { addDays, getISODay, format, parseISO } from 'date-fns'
import type { ScheduleEventRow, CalendarEvent } from '@/lib/schemas/schedule'

/** Expand recurring events into concrete occurrences for a 7-day window. */
export function expandEvents(rows: ScheduleEventRow[], weekStart: Date): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const row of rows) {
    if (!row.is_recurring) {
      // One-off: already filtered by DB query, just emit it
      events.push({
        id: `${row.id}__${row.event_date}`,
        title: row.title,
        event_type: row.event_type as CalendarEvent['event_type'],
        date: row.event_date,
        start_time: row.start_time,
        end_time: row.end_time,
        is_recurring: false,
        source_id: row.id,
        event_date: row.event_date,
      })
      continue
    }

    // Recurring: emit one occurrence for each day in the week that matches recurrence_day
    const recurrenceDay = row.recurrence_day ?? getISODay(parseISO(row.event_date))
    const recurrenceEnd = row.recurrence_end_date ? parseISO(row.recurrence_end_date) : null
    const eventStart = parseISO(row.event_date)

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i)
      if (getISODay(day) !== recurrenceDay) continue
      if (day < eventStart) continue
      if (recurrenceEnd && day > recurrenceEnd) continue

      const dateStr = format(day, 'yyyy-MM-dd')
      events.push({
        id: `${row.id}__${dateStr}`,
        title: row.title,
        event_type: row.event_type as CalendarEvent['event_type'],
        date: dateStr,
        start_time: row.start_time,
        end_time: row.end_time,
        is_recurring: true,
        source_id: row.id,
        event_date: row.event_date,
        recurrence_day: row.recurrence_day ?? undefined,
        recurrence_end_date: row.recurrence_end_date ?? undefined,
      })
    }
  }

  return events
}
