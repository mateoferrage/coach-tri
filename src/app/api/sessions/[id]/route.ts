import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const UpdateSchema = z.object({
  status: z.enum(['planned', 'done', 'skipped', 'modified']).optional(),
  actual_duration_min: z.number().int().positive().optional(),
  actual_rpe: z.number().int().min(1).max(10).optional(),
  actual_notes: z.string().max(2000).optional(),
  completed_at: z.string().optional(),
  // Rescheduling via drag-and-drop
  session_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  session_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  day_part: z.enum(['morning', 'midday', 'evening']).nullable().optional(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id } = await params

  const { data, error } = (await supabase
    .from('sessions')
    .select('*, plan_week:plan_weeks(week_num, phase, start_date)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()) as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error) return apiError(error.message)
  if (!data) return apiError('Séance introuvable', 404)

  return apiSuccess(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id } = await params
  const body = await request.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const updates = {
    ...parsed.data,
    ...(parsed.data.status === 'done' && !parsed.data.completed_at
      ? { completed_at: new Date().toISOString() }
      : {}),
  }

  const { data, error } = (await supabase
    .from('sessions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()) as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error) return apiError(error.message)
  revalidatePath('/program')
  return apiSuccess(data)
}
