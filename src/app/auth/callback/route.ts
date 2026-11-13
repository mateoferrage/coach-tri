import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Landing point of the sign-up confirmation e-mail: Supabase appends a PKCE
// `code` that must be exchanged for a session before the user is logged in.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  // Only allow same-site relative paths to avoid an open redirect.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${target}`)
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation`)
}
