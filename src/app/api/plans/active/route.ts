import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan, error } = await (supabase as any)
    .from('plans')
    .select(`
      *,
      goal:goals(*),
      plan_phases(*),
      plan_weeks(*, sessions(*))
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as { data: Record<string, unknown> | null; error: { code: string; message: string } | null }

  // PGRST116 = no rows found (no active plan)
  if (error?.code === 'PGRST116') return apiSuccess(null)
  if (error) return apiError(error.message)

  return apiSuccess(plan)
}
