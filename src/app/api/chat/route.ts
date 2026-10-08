import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { generateJSON } from '@/lib/gemini/client'
import { COACH_CHAT_SYSTEM, buildChatContext } from '@/lib/gemini/prompts'
import { z } from 'zod'
import { differenceInWeeks, parseISO } from 'date-fns'
import { refreshIfNeeded, getRecentActivitiesCompact } from '@/lib/strava/client'
import { decryptStravaCreds, encryptStravaTokens } from '@/lib/strava/credentials'
import { buildStravaActivitiesBlock } from '@/lib/gemini/prompts'
import { createAdminClient } from '@/lib/supabase/admin'
import { asJson } from '@/lib/utils/json'

const PostSchema = z.object({
  message: z.string().min(1).max(2000),
})

// Durée de vie d'un message de chat : au-delà, il disparaît de l'affichage et
// du contexte de l'IA (filtre à la lecture, aucune suppression en base).
const CHAT_TTL_MS = 24 * 60 * 60 * 1000
const chatCutoff = () => new Date(Date.now() - CHAT_TTL_MS).toISOString()

interface ChatResponse {
  message: string
  proposedAction: {
    type: string
    description: string
    params: Record<string, unknown>
  } | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return apiError('Non authentifié', 401)

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100)

  const { data, error: fetchError } = await supabase
    .from('chat_messages')
    .select('id, role, content, proposed_action, action_status, created_at')
    .eq('user_id', user.id)
    .is('archived_at', null)
    .gte('created_at', chatCutoff())
    .order('created_at', { ascending: false })
    .limit(limit)

  if (fetchError) return apiError(fetchError.message)
  return apiSuccess(((data ?? []) as unknown[]).reverse())
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const { message } = parsed.data
  const today = new Date().toISOString().split('T')[0]

  // Week boundaries (Mon–Sun)
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek + 1)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Fetch context in parallel
  const [profileRes, planRes, weekSessionsRes, historyRes, stravaCredsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('first_name, level, weekly_hours_avg')
      .eq('id', user.id)
      .single(),

    supabase
      .from('plans')
      .select('id, name, start_date, plan_weeks(week_num, phase), goal:goals!plans_goal_id_fkey(race_name, race_date)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('sessions')
      .select(
        'id, title, discipline, session_type, duration_min, session_date, status, expected_rpe',
      )
      .eq('user_id', user.id)
      .gte('session_date', weekStartStr)
      .lte('session_date', weekEndStr)
      .order('session_date', { ascending: true }),

    supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .gte('created_at', chatCutoff())
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('strava_credentials')
      .select('athlete_id, access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const profile = profileRes.data as {
    first_name: string | null
    level: string | null
    weekly_hours_avg: number | null
  } | null
  const plan = planRes.data as {
    id: string
    name: string | null
    start_date: string
    plan_weeks: Array<{ week_num: number; phase: string }>
    goal: { race_name: string; race_date: string } | null
  } | null
  const weekSessions = (weekSessionsRes.data ?? []) as Array<{
    id: string
    discipline: string
    session_type: string
    title: string | null
    duration_min: number
    session_date: string
    status: string
    expected_rpe: number | null
  }>
  const history = ((historyRes.data ?? []) as Array<{ role: string; content: string }>).reverse()
  const stravaCreds = stravaCredsRes.data as {
    athlete_id: number
    access_token: string
    refresh_token: string
    expires_at: number
  } | null

  // Resolve current week
  let currentWeekNum = 0
  let currentPhase: string | null = null
  if (plan) {
    const startDate = parseISO(plan.start_date)
    currentWeekNum = Math.min(
      Math.max(1, differenceInWeeks(now, startDate) + 1),
      plan.plan_weeks?.length ?? 1,
    )
    currentPhase = plan.plan_weeks?.find((w) => w.week_num === currentWeekNum)?.phase ?? null
  }

  // Strava live context (Scenario C) — silently skip on error
  let stravaActivitiesBlock: string | undefined
  if (stravaCreds) {
    try {
      const stored = decryptStravaCreds(stravaCreds)
      const refreshed = await refreshIfNeeded(stored)
      if (refreshed.access_token !== stored.access_token) {
        const admin = createAdminClient()

        await admin
          .from('strava_credentials')
          .update({
            ...encryptStravaTokens(refreshed),
            expires_at: refreshed.expires_at,
          })
          .eq('user_id', user.id)
      }
      const activities = await getRecentActivitiesCompact(refreshed.access_token, 5)
      stravaActivitiesBlock = buildStravaActivitiesBlock(activities)
    } catch {
      // Strava indisponible — ne pas bloquer le chat
    }
  }

  // Save user message

  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'user',
    content: message,
  })

  // Build context + call Gemini
  const contextBlock = buildChatContext({
    profile,
    plan: plan ? { id: plan.id, name: plan.name, goal: plan.goal } : null,
    currentWeekNum,
    currentPhase,
    weekSessions,
    history,
    today,
    stravaActivitiesBlock,
  })

  const fullPrompt = `${contextBlock}\n\nMessage de l'athlète : "${message}"`

  let aiResponse: ChatResponse
  try {
    aiResponse = await generateJSON<ChatResponse>(COACH_CHAT_SYSTEM, fullPrompt, {
      temperature: 0.85,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur IA'
    return apiError(`Erreur IA : ${msg}`, 500)
  }

  if (!aiResponse.message) return apiError('Réponse IA invalide', 500)

  // Save assistant message

  const { data: savedMsg } = await supabase
    .from('chat_messages')
    .insert({
      user_id: user.id,
      role: 'assistant',
      content: aiResponse.message,
      proposed_action: asJson(aiResponse.proposedAction ?? null),
      action_status: aiResponse.proposedAction ? 'pending' : null,
    })
    .select('id, role, content, proposed_action, action_status, created_at')
    .single()

  return apiSuccess(savedMsg)
}

export async function DELETE(_request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return apiError('Non authentifié', 401)

  const admin = createAdminClient()

  const { error: updateError } = await admin
    .from('chat_messages')
    .update({ archived_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('archived_at', null)

  if (updateError) return apiError(updateError.message)
  return apiSuccess({ archived: true })
}
