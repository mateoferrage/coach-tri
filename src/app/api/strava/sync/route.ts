import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { refreshIfNeeded, getActivitiesForSync, type StravaTokens } from '@/lib/strava/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creds, error: credsError } = await (supabase as any)
    .from('strava_credentials')
    .select('athlete_id, access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .single()

  if (credsError || !creds) return apiError('Compte Strava non connecté', 400)

  const admin = createAdminClient()

  let tokens: StravaTokens
  try {
    tokens = await refreshIfNeeded({
      access_token:  creds.access_token,
      refresh_token: creds.refresh_token,
      expires_at:    creds.expires_at,
      athlete_id:    creds.athlete_id,
    })
  } catch {
    return apiError('Token Strava expiré — reconnecte ton compte', 401)
  }

  if (tokens.access_token !== creds.access_token) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('strava_credentials')
      .update({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at:    tokens.expires_at,
      })
      .eq('user_id', user.id)
  }

  const afterTimestamp = Math.floor(Date.now() / 1000) - 30 * 24 * 3600
  let activities
  try {
    activities = await getActivitiesForSync(tokens.access_token, afterTimestamp, 30)
  } catch {
    return apiError('Impossible de récupérer les activités Strava', 502)
  }

  if (activities.length === 0) {
    return apiSuccess({ activities_synced: 0 })
  }

  const rows  = activities.map(a => ({ ...a, user_id: user.id }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (admin as any)
    .from('strava_activities')
    .upsert(rows, { onConflict: 'user_id,strava_activity_id' })

  if (upsertError) return apiError(upsertError.message, 500)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('strava_credentials')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return apiSuccess({ activities_synced: activities.length })
}
