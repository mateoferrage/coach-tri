import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'
import { todayIn } from '@/lib/utils/today'
import { autoLinkSessions } from './linked'

/** Liaison automatique après une synchro : un échec ne doit jamais faire échouer la synchro. */
export async function safeAutoLink(client: SupabaseClient<Database>, userId: string): Promise<number> {
  try {
    return await autoLinkSessions(client, userId, todayIn())
  } catch (err) {
    console.error('[auto-link] échec', err)
    return 0
  }
}
