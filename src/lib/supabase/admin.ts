import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'

// Service role client — server-side only. Never import in client components.
export function createAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
