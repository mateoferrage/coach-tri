import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) return apiError('Paramètres start et end requis', 400)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Try with session_time first; fall back if the column doesn't exist yet (migration pending)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = await (supabase as any)
    .from('sessions')
    .select(
      'id, title, discipline, session_type, session_date, duration_min, status, day_part, session_time',
    )
    .eq('user_id', user.id)
    .gte('session_date', start)
    .lte('session_date', end)
    .order('session_date', { ascending: true })

  if (error && (error as { message: string }).message?.includes('session_time')) {
    // Column not yet created — retry without it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallback = await (supabase as any)
      .from('sessions')
      .select('id, title, discipline, session_type, session_date, duration_min, status, day_part')
      .eq('user_id', user.id)
      .gte('session_date', start)
      .lte('session_date', end)
      .order('session_date', { ascending: true })
    data = fallback.data
    error = fallback.error
  }

  if (error) return apiError((error as { message: string }).message)
  return apiSuccess(data)
}
