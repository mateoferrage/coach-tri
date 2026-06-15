import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { ProfileSchema } from '@/lib/schemas/profile'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiError('Non authentifié', 401)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return apiError((error as { message: string }).message)
  return apiSuccess(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = ProfileSchema.safeParse(body)

  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('profiles').upsert({ id: user.id, ...parsed.data })

  if (error) return apiError((error as { message: string }).message)
  return apiSuccess({ success: true }, 201)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = ProfileSchema.partial().safeParse(body)

  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('profiles').update(parsed.data).eq('id', user.id)

  if (error) return apiError((error as { message: string }).message)
  return apiSuccess({ success: true })
}
