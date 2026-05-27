import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { generateJSON } from '@/lib/gemini/client'
import { TRIATHLON_COACH_SYSTEM, buildMicroPrompt } from '@/lib/gemini/prompts'
import type { MicroSessions } from '@/lib/schemas/plan'
import { z } from 'zod'
import { addDays, format, parseISO } from 'date-fns'

const BodySchema = z.object({
  week_num: z.number().int().positive(),
  available_days: z.array(z.number().int().min(0).max(6)).min(1),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id: plan_id } = await params
  const body = await request.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const { week_num, available_days } = parsed.data
  const admin = createAdminClient()

  // Verify plan ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan } = await (supabase as any)
    .from('plans')
    .select('id, status')
    .eq('id', plan_id)
    .eq('user_id', user.id)
    .single() as { data: { id: string; status: string } | null }

  if (!plan) return apiError('Plan introuvable', 404)

  // Fetch the specific week
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: week } = await (admin as any)
    .from('plan_weeks')
    .select('*')
    .eq('plan_id', plan_id)
    .eq('week_num', week_num)
    .single() as { data: Record<string, unknown> | null }

  if (!week) return apiError(`Semaine ${week_num} introuvable`, 404)

  // Fetch profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('level, weekly_hours_avg, available_disciplines')
    .eq('id', user.id)
    .single() as { data: Record<string, unknown> | null }

  // Fetch previous week sessions for context
  let prevSummary = ''
  if (week_num > 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prevWeek } = await (admin as any)
      .from('plan_weeks')
      .select('id')
      .eq('plan_id', plan_id)
      .eq('week_num', week_num - 1)
      .single() as { data: { id: string } | null }

    if (prevWeek) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prevSessions } = await (admin as any)
        .from('sessions')
        .select('discipline, duration_min, status, actual_rpe, actual_notes')
        .eq('plan_week_id', prevWeek.id) as { data: Array<Record<string, unknown>> | null }

      if (prevSessions?.length) {
        prevSummary = prevSessions.map(s =>
          `${s.discipline} ${s.duration_min}min — ${s.status}${s.actual_rpe ? ` RPE${s.actual_rpe}` : ''}${s.actual_notes ? ` | "${s.actual_notes}"` : ''}`
        ).join('\n')
      }
    }
  }

  // Fetch recent wellness
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wellness } = await (admin as any)
    .from('garmin_wellness')
    .select('date, hrv_rmssd, body_battery_start, resting_hr')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(7) as { data: Array<Record<string, unknown>> | null }

  const wellnessSummary = wellness?.length
    ? `HRV derniers 7j : ${wellness.filter(w => w.hrv_rmssd).map(w => w.hrv_rmssd).join(', ')} ms`
    : ''

  // Fetch schedule events for this week to pass as AI constraints
  const weekStartDate = week.start_date as string
  const weekEndDate = format(addDays(parseISO(weekStartDate), 6), 'yyyy-MM-dd')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawScheduleEvents } = await (supabase as any)
    .from('schedule_events')
    .select('*')
    .eq('user_id', user.id)
    .or(
      `and(is_recurring.eq.false,event_date.gte.${weekStartDate},event_date.lte.${weekEndDate}),` +
      `and(is_recurring.eq.true,event_date.lte.${weekEndDate},or(recurrence_end_date.is.null,recurrence_end_date.gte.${weekStartDate}))`
    ) as { data: Array<Record<string, unknown>> | null }

  const ISO_DAY_NAMES = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  let scheduleConstraints = ''
  if (rawScheduleEvents?.length) {
    const lines: string[] = []
    for (const ev of rawScheduleEvents) {
      if (!ev.is_recurring) {
        const jsDay = parseISO(ev.event_date as string).getDay() // 0=Sun
        const isoDay = jsDay === 0 ? 7 : jsDay
        lines.push(`${ISO_DAY_NAMES[isoDay]} ${ev.event_date} : "${ev.title}" de ${ev.start_time} à ${ev.end_time}`)
      } else {
        const day = ev.recurrence_day as number
        lines.push(`Chaque ${ISO_DAY_NAMES[day]} : "${ev.title}" de ${ev.start_time} à ${ev.end_time}`)
      }
    }
    scheduleConstraints = lines.join('\n')
  }

  const userPrompt = buildMicroPrompt({
    week: {
      week_num: week.week_num as number,
      phase: week.phase as string,
      is_recovery_week: week.is_recovery_week as boolean,
      planned_volume_hours: week.planned_volume_hours as number,
      planned_tss: week.planned_tss as number,
      distribution: (week.distribution as Record<string, number>) ?? { z1z2: 0.8, z3: 0.1, z4z5: 0.1 },
      notes: (week.notes as string) ?? '',
    },
    profile: {
      level: profile?.level as string | null,
      weekly_hours_avg: profile?.weekly_hours_avg as number | null,
      available_disciplines: profile?.available_disciplines as string[] | null,
    },
    available_days,
    week_start_date: week.start_date as string,
    previous_sessions_summary: prevSummary || undefined,
    recent_wellness_summary: wellnessSummary || undefined,
    schedule_constraints: scheduleConstraints || undefined,
  })

  let microPlan: MicroSessions
  try {
    microPlan = await generateJSON<MicroSessions>(TRIATHLON_COACH_SYSTEM, userPrompt)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur Gemini'
    return apiError(`Génération IA échouée : ${msg}`, 500)
  }

  if (!microPlan.sessions?.length) return apiError('Gemini n\'a retourné aucune séance', 500)

  // Delete existing planned sessions for this week (keep done/skipped)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('sessions')
    .delete()
    .eq('plan_week_id', week.id as string)
    .eq('status', 'planned')

  // Insert new sessions
  const sessionRows = microPlan.sessions.map(s => ({
    plan_id,
    plan_week_id: week.id,
    user_id: user.id,
    ...s,
    status: 'planned',
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: insertedSessions, error: insertError } = await (admin as any)
    .from('sessions')
    .insert(sessionRows)
    .select('id, title, session_date, discipline') as { data: Array<Record<string, unknown>> | null; error: { message: string } | null }

  if (insertError) return apiError(insertError.message)

  // Log generation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('plan_generations').insert({
    plan_id,
    trigger: 'week_regenerate',
    scope: { week_num },
    model: 'gemini-2.5-flash',
    response_meta: { sessions_generated: microPlan.sessions.length },
  })

  return apiSuccess({
    week_num,
    sessions_created: insertedSessions?.length ?? 0,
    sessions: insertedSessions,
  })
}
