import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptCredential } from '@/lib/utils/crypto'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GarminConnect } = require('garmin-connect')

interface StoredTokens {
  oauth1: { token: string; token_secret: string }
  oauth2: {
    scope: string
    jti: string
    token_type: string
    access_token: string
    refresh_token: string
    expires_in: number
    expires_at: number
    refresh_token_expires_in: number
    refresh_token_expires_at: number
  }
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryGet(
  gc: any,
  url: string,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const data = await gc.get(url)
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) }
  }
}

export async function GET() {
  // Endpoint de diagnostic : jamais exposé en production (données Garmin brutes)
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creds } = await (admin as any)
    .from('garmin_credentials')
    .select('email_enc, password_enc, session_data')
    .eq('user_id', user.id)
    .single()

  if (!creds) return Response.json({ error: 'Pas de compte Garmin' }, { status: 400 })

  const email = decryptCredential(creds.email_enc)
  const password = decryptCredential(creds.password_enc)

  const gc = new GarminConnect({ username: email, password })

  try {
    const t = creds.session_data as Partial<StoredTokens>
    if (t?.oauth1 && t?.oauth2) {
      gc.loadToken(t.oauth1, t.oauth2)
      await gc.getUserProfile()
    } else {
      await gc.login()
    }
  } catch {
    try {
      await gc.login()
    } catch (e) {
      return Response.json({ error: 'Auth failed', detail: String(e) }, { status: 401 })
    }
  }

  const today = toDateStr(new Date())
  const weekAgo = toDateStr(new Date(Date.now() - 7 * 86_400_000))
  const yesterday = toDateStr(new Date(Date.now() - 86_400_000))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let profile: any = null
  try {
    profile = await gc.getUserProfile()
  } catch {
    /* */
  }

  const uid = profile?.id ?? null
  const uuid = profile?.displayName ?? null // opaque UUID
  const uname = profile?.userName ?? null

  const results: Record<string, unknown> = {
    _profile_keys: profile ? Object.keys(profile) : null,
    _uid: uid,
    _uuid: uuid,
    _uname: uname,
    _fullName: profile?.fullName,
    _today: today,
    _weekAgo: weekAgo,
  }

  // ── VO2Max / maxmet variants ─────────────────────────────────────────────
  results['maxmet/daily/today'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/maxmet/daily/${today}`,
  )
  results['maxmet/weekly/today'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/maxmet/weekly/${today}`,
  )
  results['maxmet/daily/yesterday'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/maxmet/daily/${yesterday}`,
  )
  results['maxmet/daily/range'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/maxmet/daily/${weekAgo}/${today}`,
  )
  results['vo2maxtracking/daily/today'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/vo2maxtracking/daily/${today}`,
  )

  // ── Fitnessstats ─────────────────────────────────────────────────────────
  if (uid)
    results[`fitnessstats/id/${uid}`] = await tryGet(
      gc,
      `https://connectapi.garmin.com/fitnessstats-service/athletes/${uid}`,
    )

  // ── Training Readiness variants ──────────────────────────────────────────
  results['readiness/today-today'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/training-readiness/${today}/${today}`,
  )
  results['readiness/weekAgo-today'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/training-readiness/${weekAgo}/${today}`,
  )
  results['readiness/today-only'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/training-readiness/${today}`,
  )
  results['readiness/yesterday-only'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/training-readiness/${yesterday}`,
  )

  // ── Training Load variants ────────────────────────────────────────────────
  results['load/period/stats'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/training-load-service/training-load/period/stats`,
  )
  results['metrics/training-load/range'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/training-load/${weekAgo}/${today}`,
  )
  results['metrics/training-load/summary'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/training-load/summary/${today}`,
  )

  // ── Training Status (may include readiness + load) ────────────────────────
  results['training-status/daily/range'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/training-status/daily/${weekAgo}/${today}`,
  )
  results['training-status-summary/range'] = await tryGet(
    gc,
    `https://connectapi.garmin.com/metrics-service/metrics/training-status-summary/daily/${weekAgo}/${today}`,
  )

  // ── Personal records ──────────────────────────────────────────────────────
  if (uuid)
    results[`prs/uuid`] = await tryGet(
      gc,
      `https://connectapi.garmin.com/personalrecord-service/personalrecord/prs/${uuid}`,
    )
  if (uname)
    results[`prs/uname`] = await tryGet(
      gc,
      `https://connectapi.garmin.com/personalrecord-service/personalrecord/prs/${uname}`,
    )

  // ── What's currently in DB ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stored } = await (admin as any)
    .from('garmin_stats')
    .select(
      'vo2max_run,vo2max_bike,fitness_age,training_readiness,training_load_7d,training_load_28d,display_name,personal_records',
    )
    .eq('user_id', user.id)
    .single()
  results['_stored_stats'] = stored

  return Response.json(results)
}
