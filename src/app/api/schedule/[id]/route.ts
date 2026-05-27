import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { ScheduleEventSchema } from '@/lib/schemas/schedule'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id } = await params
  const body = await request.json()
  const parsed = ScheduleEventSchema.partial().safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('schedule_events')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return apiError((error as { message: string }).message)
  if (!data) return apiError('Événement introuvable', 404)
  return apiSuccess(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('schedule_events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return apiError((error as { message: string }).message)
  return apiSuccess({ deleted: true })
}
