import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { z } from 'zod'

const PatchSchema = z.object({
  action_status: z.enum(['confirmed', 'rejected']),
})

interface ProposedAction {
  type: 'cancel_session' | 'move_session' | 'adjust_session' | 'regenerate_week'
  description: string
  params: Record<string, unknown>
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id } = await params
  const body = await request.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const { action_status } = parsed.data
  const admin = createAdminClient()

  // Fetch the message with its action
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msg } = await (supabase as any)
    .from('chat_messages')
    .select('id, proposed_action, action_status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: { id: string; proposed_action: ProposedAction | null; action_status: string | null } | null }

  if (!msg) return apiError('Message introuvable', 404)
  if (msg.action_status !== 'pending') return apiError('Action déjà traitée', 409)
  if (!msg.proposed_action) return apiError('Aucune action proposée', 400)

  const action = msg.proposed_action

  // Update status in DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('chat_messages')
    .update({ action_status })
    .eq('id', id)

  if (action_status === 'rejected') {
    return apiSuccess({ action_status: 'rejected' })
  }

  // Execute the action
  const p = action.params

  if (action.type === 'cancel_session') {
    const sessionId = p.session_id as string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('sessions')
      .update({ status: 'skipped' })
      .eq('id', sessionId)
      .eq('user_id', user.id)
    if (error) return apiError(error.message)
    return apiSuccess({ action_status: 'confirmed', type: 'cancel_session' })
  }

  if (action.type === 'move_session') {
    const sessionId = p.session_id as string
    const newDate = p.new_date as string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('sessions')
      .update({ session_date: newDate })
      .eq('id', sessionId)
      .eq('user_id', user.id)
    if (error) return apiError(error.message)
    return apiSuccess({ action_status: 'confirmed', type: 'move_session' })
  }

  if (action.type === 'adjust_session') {
    const sessionId = p.session_id as string
    const updates: Record<string, unknown> = {}
    if (p.duration_min) updates.duration_min = p.duration_min
    if (p.session_type) updates.session_type = p.session_type
    if (p.coaching_note) updates.coaching_note = p.coaching_note
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', user.id)
    if (error) return apiError(error.message)
    return apiSuccess({ action_status: 'confirmed', type: 'adjust_session' })
  }

  if (action.type === 'regenerate_week') {
    // Return params for the client to call the regenerate endpoint
    return apiSuccess({
      action_status: 'confirmed',
      type: 'regenerate_week',
      regenerateParams: {
        plan_id: p.plan_id as string,
        week_num: p.week_num as number,
        available_days: p.available_days as number[],
      },
    })
  }

  return apiError('Type d\'action inconnu', 400)
}
