// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GarminConnect } = require('garmin-connect')

export interface StoredTokens {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GarminClient = any

/**
 * Build an authenticated GarminConnect client.
 * Tries to restore the session from stored tokens first (fast path).
 * Falls back to a full credential login if tokens are absent or expired.
 * Returns the authenticated client and fresh tokens to persist.
 */
export async function buildGarminClient(
  email: string,
  password: string,
  sessionData: unknown,
): Promise<{ gc: GarminClient; tokens: StoredTokens }> {
  const gc: GarminClient = new GarminConnect({ username: email, password })

  if (sessionData && typeof sessionData === 'object') {
    const t = sessionData as Partial<StoredTokens>
    if (t.oauth1 && t.oauth2) {
      try {
        gc.loadToken(t.oauth1, t.oauth2)
        await gc.getUserProfile()
        return { gc, tokens: gc.exportToken() as StoredTokens }
      } catch {
        // Token expired or invalid — fall through to full login
      }
    }
  }

  await gc.login()
  return { gc, tokens: gc.exportToken() as StoredTokens }
}
