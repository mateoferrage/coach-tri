import { encryptCredential, decryptCredential } from '@/lib/utils/crypto'
import type { StravaTokens } from './client'

/** Forme d'une ligne `strava_credentials` telle que stockée (tokens chiffrés AES-256). */
export interface EncryptedStravaCreds {
  athlete_id: number
  access_token: string
  refresh_token: string
  expires_at: number
}

/**
 * Déchiffre une ligne `strava_credentials` en tokens utilisables (access/refresh en clair).
 * Lève si le déchiffrement échoue (clé absente, ou ligne legacy stockée en clair) — les appelants
 * traitent ce cas comme « reconnecter le compte Strava ».
 */
export function decryptStravaCreds(row: EncryptedStravaCreds): StravaTokens {
  return {
    athlete_id: row.athlete_id,
    access_token: decryptCredential(row.access_token),
    refresh_token: decryptCredential(row.refresh_token),
    expires_at: row.expires_at,
  }
}

/** Chiffre les tokens pour stockage dans `strava_credentials` (colonnes access_token/refresh_token). */
export function encryptStravaTokens(tokens: Pick<StravaTokens, 'access_token' | 'refresh_token'>): {
  access_token: string
  refresh_token: string
} {
  return {
    access_token: encryptCredential(tokens.access_token),
    refresh_token: encryptCredential(tokens.refresh_token),
  }
}
