import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const clientId    = process.env.STRAVA_CLIENT_ID!
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL!
  const callbackUrl = `${appUrl}/api/strava/callback`
  const scope       = 'read,activity:read'

  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id',       clientId)
  url.searchParams.set('redirect_uri',    callbackUrl)
  url.searchParams.set('response_type',   'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope',           scope)

  return redirect(url.toString())
}
