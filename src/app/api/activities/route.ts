import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { z } from 'zod'

const CreateSchema = z.object({
  discipline: z.enum(['run', 'bike', 'swim', 'strength', 'other']),
  name: z.string().max(200).optional(),
  started_at: z.string(),
  duration_min: z.number().positive(),
  distance_m: z.number().positive().optional(),
  avg_hr: z.number().int().min(40).max(220).optional(),
  elevation_gain_m: z.number().nonnegative().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const { discipline, name, started_at, duration_min, distance_m, avg_hr, elevation_gain_m } =
    parsed.data
  const admin = createAdminClient()

  const duration_s = Math.round(duration_min * 60)
  const avg_speed_ms = distance_m && duration_s ? distance_m / duration_s : null

  const { data, error } = await admin
    .from('garmin_activities')
    .insert({
      user_id: user.id,
      garmin_activity_id: -Date.now(), // negative = manual; Garmin IDs are always positive
      activity_type: discipline,
      name: name ?? null,
      started_at,
      duration_s,
      distance_m: distance_m ?? null,
      avg_speed_ms,
      avg_hr: avg_hr ?? null,
      elevation_gain_m: elevation_gain_m ?? null,
      raw_data: { source: 'manual' },
    })
    .select('id')
    .single()

  if (error) return apiError(error.message)
  return apiSuccess(data, 201)
}
