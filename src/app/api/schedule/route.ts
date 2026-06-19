import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { ScheduleEventSchema, type ScheduleEventRow } from '@/lib/schemas/schedule'
import { expandEvents } from '@/lib/calendar/recurrence'
import { addDays, format, parseISO } from 'date-fns'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
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

  const { data, error } = await supabase
    .from('schedule_events')
    .select('*')
    .eq('user_id', user.id)
    .or(
      `and(is_recurring.eq.false,event_date.gte.${weekStartParam},event_date.lte.${weekEndStr}),` +
        `and(is_recurring.eq.true,event_date.lte.${weekEndStr},or(recurrence_end_date.is.null,recurrence_end_date.gte.${weekStartParam}))`,
    )
    .order('event_date', { ascending: true })

  if (error) return apiError(error.message)

  const events = expandEvents((data ?? []) as ScheduleEventRow[], weekStart)
  return apiSuccess(events)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = ScheduleEventSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const { is_recurring, recurrence_day, recurrence_end_date, ...rest } = parsed.data

  const { data, error } = (await supabase
    .from('schedule_events')
    .insert({
      user_id: user.id,
      ...rest,
      is_recurring,
      recurrence_day: is_recurring ? (recurrence_day ?? null) : null,
      recurrence_end_date: is_recurring ? (recurrence_end_date ?? null) : null,
    })
    .select()
    .single()) as { data: ScheduleEventRow | null; error: { message: string } | null }

  if (error) return apiError(error.message)
  return apiSuccess(data, 201)
}
