import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { ScheduleEventSchema, type ScheduleEventRow, type CalendarEvent } from '@/lib/schemas/schedule'
import { addDays, getISODay, format, parseISO } from 'date-fns'

// Expand recurring events into concrete occurrences for a 7-day window
function expandEvents(rows: ScheduleEventRow[], weekStart: Date): CalendarEvent[] {
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

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { searchParams } = new URL(request.url)
  const weekStartParam = searchParams.get('week_start')
  if (!weekStartParam || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    return apiError('Paramètre week_start requis (YYYY-MM-DD)', 400)
  }

  const weekStart = parseISO(weekStartParam)
  const weekEnd = addDays(weekStart, 6)
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  // Fetch one-off events in the week + recurring events that overlap the week
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('schedule_events')
    .select('*')
    .eq('user_id', user.id)
    .or(
      `and(is_recurring.eq.false,event_date.gte.${weekStartParam},event_date.lte.${weekEndStr}),` +
      `and(is_recurring.eq.true,event_date.lte.${weekEndStr},or(recurrence_end_date.is.null,recurrence_end_date.gte.${weekStartParam}))`
    )
    .order('event_date', { ascending: true }) as { data: ScheduleEventRow[] | null; error: { message: string } | null }

  if (error) return apiError(error.message)

  const events = expandEvents(data ?? [], weekStart)
  return apiSuccess(events)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = ScheduleEventSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const { is_recurring, recurrence_day, recurrence_end_date, ...rest } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('schedule_events')
    .insert({
      user_id: user.id,
      ...rest,
      is_recurring,
      recurrence_day: is_recurring ? (recurrence_day ?? null) : null,
      recurrence_end_date: is_recurring ? (recurrence_end_date ?? null) : null,
    })
    .select()
    .single() as { data: ScheduleEventRow | null; error: { message: string } | null }

  if (error) return apiError(error.message)
  return apiSuccess(data, 201)
}
