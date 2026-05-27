import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { GoalSchema } from '@/lib/schemas/goal'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('goals')
    .select('*')
    .eq('user_id', user.id)
    .neq('status', 'abandoned')
    .order('race_date', { ascending: true })

  if (error) return apiError((error as { message: string }).message)
  return apiSuccess(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = GoalSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('goals')
    .insert({ user_id: user.id, ...parsed.data, status: 'active' })
    .select()
    .single()

  if (error) return apiError((error as { message: string }).message)
  return apiSuccess(data, 201)
}
