import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import type { MicroSessions } from '@/lib/schemas/plan'
import { generateWeekSessions, replaceWeekSessions } from '@/lib/plan/micro'
import { buildMicroInputForWeek } from '@/lib/plan/micro-context'
import { z } from 'zod'

export const maxDuration = 120

const BodySchema = z.object({
  week_num: z.number().int().positive(),
  // Choix ponctuel ; par défaut, les jours choisis à la création du plan.
  available_days: z.array(z.number().int().min(0).max(6)).min(1).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id: plan_id } = await params
  const body = await request.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const { week_num, available_days } = parsed.data
  const admin = createAdminClient()

  // Verify plan ownership

  const { data: plan } = (await supabase
    .from('plans')
    .select('id, status')
    .eq('id', plan_id)
    .eq('user_id', user.id)
    .single()) as { data: { id: string; status: string } | null }

  if (!plan) return apiError('Plan introuvable', 404)

  // Fetch the target week row; all remaining context is assembled by
  // buildMicroInputForWeek so this handler stays focused on orchestration.
  const { data: week } = (await admin
    .from('plan_weeks')
    .select('*')
    .eq('plan_id', plan_id)
    .eq('week_num', week_num)
    .single()) as {
    data: {
      id: string
      week_num: number
      phase: string
      is_recovery_week: boolean
      planned_volume_hours: number
      planned_tss: number
      distribution: Record<string, number> | null
      notes: string | null
      start_date: string
    } | null
  }
  if (!week) return apiError(`Semaine ${week_num} introuvable`, 404)

  let sessions: MicroSessions['sessions']
  try {
    sessions = await generateWeekSessions(
      await buildMicroInputForWeek({
        supabase,
        admin,
        userId: user.id,
        plan_id,
        week,
        available_days,
      }),
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur Gemini'
    return apiError(`Génération IA échouée : ${msg}`, 500)
  }

  if (!sessions.length) return apiError('Plus aucune séance à planifier cette semaine', 400)

  const { data: insertedSessions, error: insertError } = await replaceWeekSessions({
    admin,
    plan_id,
    plan_week_id: week.id,
    user_id: user.id,
    sessions,
  })
  if (insertError) return apiError(insertError.message)

  // Log generation

  await admin.from('plan_generations').insert({
    plan_id,
    trigger: 'week_regenerate',
    scope: { week_num },
    model: 'gemini-2.5-flash',
    response_meta: { sessions_generated: sessions.length },
  })

  return apiSuccess({
    week_num,
    sessions_created: insertedSessions?.length ?? 0,
    sessions: insertedSessions,
  })
}
