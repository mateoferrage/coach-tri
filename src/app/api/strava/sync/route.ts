import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { refreshIfNeeded, getActivitiesForSync, type StravaTokens } from '@/lib/strava/client'
import { decryptStravaCreds, encryptStravaTokens } from '@/lib/strava/credentials'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { data: creds, error: credsError } = await supabase
    .from('strava_credentials')
    .select('athlete_id, access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .single()

  if (credsError || !creds) return apiError('Compte Strava non connecté', 400)

  const admin = createAdminClient()

  let stored: StravaTokens
  let tokens: StravaTokens
  try {
    stored = decryptStravaCreds(creds)
    tokens = await refreshIfNeeded(stored)
  } catch {
    return apiError('Token Strava expiré — reconnecte ton compte', 401)
  }

  if (tokens.access_token !== stored.access_token) {
    await admin
      .from('strava_credentials')
      .update({
        ...encryptStravaTokens(tokens),
        expires_at: tokens.expires_at,
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

  const rows = activities.map((a) => ({ ...a, user_id: user.id }))

  const { error: upsertError } = await admin
    .from('strava_activities')
    .upsert(rows, { onConflict: 'user_id,strava_activity_id' })

  if (upsertError) return apiError(upsertError.message, 500)

  await admin
    .from('strava_credentials')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return apiSuccess({ activities_synced: activities.length })
}
