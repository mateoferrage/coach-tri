import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { generateJSON } from '@/lib/gemini/client'
import {
  COACH_SESSION_REVIEW_SYSTEM,
  buildSessionReviewPrompt,
  type SessionReviewContext,
} from '@/lib/gemini/prompts'
import { asJson, fromJson } from '@/lib/utils/json'
import { compareSession, summarizeComparison } from '@/lib/activities/compare'

interface CoachReview {
  verdict: 'excellent' | 'good' | 'average' | 'poor'
  message: string
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id: session_id } = await params

  // Fetch session with its linked Garmin activity

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select(
      'title, discipline, session_type, duration_min, target_zone, target_values, expected_rpe, structure, coaching_note, actual_rpe, garmin_activity_id, strava_activity_id',
    )
    .eq('id', session_id)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) return apiError('Séance introuvable', 404)
  if (!session.garmin_activity_id && !session.strava_activity_id)
    return apiError('Aucune activité liée à cette séance', 400)

  // Garmin fait foi ; Strava apporte la puissance (ou tout, sans Garmin).
  const [garminRes, stravaRes] = await Promise.all([
    session.garmin_activity_id
      ? supabase
          .from('garmin_activities')
          .select(
            'activity_type, name, duration_s, distance_m, avg_hr, max_hr, avg_speed_ms, elevation_gain_m, aerobic_te, anaerobic_te',
          )
          .eq('id', session.garmin_activity_id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    session.strava_activity_id
      ? supabase
          .from('strava_activities')
          .select(
            'activity_type, name, duration_s, distance_m, avg_hr, max_hr, avg_speed_ms, elevation_gain_m, avg_watts',
          )
          .eq('id', session.strava_activity_id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const garmin = garminRes.data
  const strava = stravaRes.data
  const base = garmin ?? strava
  if (!base) return apiError('Activité introuvable', 404)
  const activity = {
    ...base,
    aerobic_te: garmin?.aerobic_te ?? null,
    anaerobic_te: garmin?.anaerobic_te ?? null,
    avg_watts: strava?.avg_watts ?? null,
  }
  const targetValues = fromJson<Record<string, unknown> | null>(session.target_values)
  const comparison = summarizeComparison(
    compareSession(
      {
        discipline: session.discipline ?? '',
        session_type: session.session_type ?? '',
        duration_min: session.duration_min ?? 0,
        target_values: targetValues,
      },
      activity,
    ),
  )

  const ctx: SessionReviewContext = {
    session: {
      title: session.title ?? '',
      discipline: session.discipline ?? '',
      session_type: session.session_type ?? '',
      duration_min: session.duration_min ?? 0,
      target_zone: session.target_zone ?? null,
      target_values: fromJson<SessionReviewContext['session']['target_values']>(
        session.target_values,
      ),
      expected_rpe: session.expected_rpe ?? null,
      structure: fromJson<SessionReviewContext['session']['structure']>(session.structure),
      coaching_note: session.coaching_note ?? null,
      actual_rpe: session.actual_rpe ?? null,
    },
    activity: {
      activity_type: activity.activity_type ?? '',
      name: activity.name ?? null,
      duration_s: activity.duration_s ?? null,
      distance_m: activity.distance_m ?? null,
      avg_hr: activity.avg_hr ?? null,
      max_hr: activity.max_hr ?? null,
      avg_speed_ms: activity.avg_speed_ms ?? null,
      elevation_gain_m: activity.elevation_gain_m ?? null,
      aerobic_te: activity.aerobic_te ?? null,
      anaerobic_te: activity.anaerobic_te ?? null,
      avg_watts: activity.avg_watts,
    },
    comparison: comparison || undefined,
  }

  const review = await generateJSON<CoachReview>(
    COACH_SESSION_REVIEW_SYSTEM,
    buildSessionReviewPrompt(ctx),
    { temperature: 0.8, conversation: true },
  )

  // Persist review in sessions table
  const admin = createAdminClient()

  await admin
    .from('sessions')
    .update({ garmin_review: asJson(review) })
    .eq('id', session_id)

  return apiSuccess(review)
}
