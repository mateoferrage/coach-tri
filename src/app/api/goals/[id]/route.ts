import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { GoalSchema } from '@/lib/schemas/goal'

/** Met à jour une course existante (modifiée depuis le formulaire de programme). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = GoalSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  // Un triathlon ne garde aucun champ propre à la course à pied (et inversement
  // les distances nage/vélo n'ont pas de sens sur une course à pied).
  const resets =
    parsed.data.sport === 'triathlon'
      ? {
          elevation_loss_m: null,
          surface: null,
          max_altitude_m: null,
          cutoff_time_s: null,
          estimated_finish_time_s: null,
        }
      : { swim_distance_m: null, bike_distance_m: null, bike_elevation_m: null }
  // Les champs absents du JSON ne seraient pas effacés : « terminer » remet les chronos à zéro.
  const targetResets =
    parsed.data.target_type === 'finish'
      ? {
          target_time_seconds: null,
          swim_target_time_s: null,
          t1_target_time_s: null,
          bike_target_time_s: null,
          t2_target_time_s: null,
          run_target_time_s: null,
        }
      : {}

  const { data, error } = await supabase
    .from('goals')
    .update({ ...resets, ...targetResets, ...parsed.data })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle()

  if (error) return apiError((error as { message: string }).message)
  if (!data) return apiError('Course introuvable', 404)
  return apiSuccess(data)
}
