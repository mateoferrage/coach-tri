import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCode } from '@/lib/strava/client'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) return redirect('/profile?strava_error=access_denied')

  // CSRF verification
  const stateParam = searchParams.get('state')
  const cookieStore = await cookies()
  const storedState = cookieStore.get('strava_oauth_state')?.value
  cookieStore.delete('strava_oauth_state')
  if (!stateParam || stateParam !== storedState) {
    return redirect('/profile?strava_error=state_mismatch')
  }

  try {
    const tokens = await exchangeCode(code)
    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('strava_credentials').upsert(
      {
        user_id: user.id,
        athlete_id: tokens.athlete_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
        scope: 'read,activity:read',
      },
      { onConflict: 'user_id' },
    )
  } catch {
    return redirect('/profile?strava_error=token_exchange')
  }

  return redirect('/profile?strava_connected=1')
}
