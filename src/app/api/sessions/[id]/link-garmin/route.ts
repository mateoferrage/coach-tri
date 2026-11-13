import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { z } from 'zod'

// Lie (ou délie, avec des ids null) une séance à une activité Garmin et/ou
// Strava. Une activité vue sur les deux services porte les deux ids.
const Body = z.object({
  garmin_activity_id: z.string().uuid().nullable(),
  strava_activity_id: z.string().uuid().nullable().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id: session_id } = await params
  const body = await request.json()
  const parsed = Body.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const garmin_activity_id = parsed.data.garmin_activity_id
  const strava_activity_id = parsed.data.strava_activity_id ?? null

  // L'activité doit appartenir à l'athlète.
  const [garminRes, stravaRes] = await Promise.all([
    garmin_activity_id
      ? supabase
          .from('garmin_activities')
          .select('id')
          .eq('id', garmin_activity_id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: true }),
    strava_activity_id
      ? supabase
          .from('strava_activities')
          .select('id')
          .eq('id', strava_activity_id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: true }),
  ])
  if (!garminRes.data || !stravaRes.data) return apiError('Activité introuvable', 404)

  const { error } = await supabase
    .from('sessions')
    .update({ garmin_activity_id, strava_activity_id })
    .eq('id', session_id)
    .eq('user_id', user.id)

  if (error) return apiError(error.message)

  return apiSuccess({ linked: Boolean(garmin_activity_id || strava_activity_id) })
}
