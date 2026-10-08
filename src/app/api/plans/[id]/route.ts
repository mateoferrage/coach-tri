import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id } = await params

  const { data: plan } = (await supabase
    .from('plans')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()) as { data: Record<string, unknown> | null }

  if (!plan) return apiError('Plan introuvable', 404)

  const admin = createAdminClient()

  const { error } = await admin.from('plans').update({ status: 'archived' }).eq('id', id)

  if (error) return apiError(error.message)
  return apiSuccess({ archived: true })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id } = await params

  const { data, error } = (await supabase
    .from('plans')
    .select(
      `
      *,
      goal:goals!plans_goal_id_fkey(*),
      plan_phases(*),
      plan_weeks(*, sessions(*))
    `,
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()) as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error) return apiError(error.message)
  if (!data) return apiError('Plan introuvable', 404)

  return apiSuccess(data)
}
