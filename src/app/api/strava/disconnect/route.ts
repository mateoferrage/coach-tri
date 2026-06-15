import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const admin = createAdminClient()

  const { error: deleteError } = await admin
    .from('strava_credentials')
    .delete()
    .eq('user_id', user.id)
  if (deleteError) return apiError(deleteError.message, 500)

  return apiSuccess({ disconnected: true })
}
