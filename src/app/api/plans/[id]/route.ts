import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan } = await (supabase as any)
    .from('plans')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle() as { data: Record<string, unknown> | null }

  if (!plan) return apiError('Plan introuvable', 404)

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('plans')
    .update({ status: 'archived' })
    .eq('id', id)

  if (error) return apiError(error.message)
  return apiSuccess({ archived: true })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('plans')
    .select(`
      *,
      goal:goals(*),
      plan_phases(*),
      plan_weeks(*, sessions(*))
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error) return apiError(error.message)
  if (!data) return apiError('Plan introuvable', 404)

  return apiSuccess(data)
}
