import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { z } from 'zod'

const PhysiologySchema = z.object({
  vma_kmh: z.number().min(5).max(30).nullable().optional(),
  run_threshold_pace_sec_per_km: z.number().min(120).max(600).nullable().optional(),
  hr_max_run: z.number().int().min(100).max(230).nullable().optional(),
  hr_threshold_run: z.number().int().min(80).max(210).nullable().optional(),
  ftp_watts: z.number().int().min(50).max(600).nullable().optional(),
  hr_max: z.number().int().min(100).max(230).nullable().optional(),
  hr_threshold_bike: z.number().int().min(80).max(210).nullable().optional(),
  css_pace_sec_per_100m: z.number().min(60).max(240).nullable().optional(),
  test_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('physiology_current')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle() as { data: Record<string, unknown> | null }

  return apiSuccess(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = PhysiologySchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('physiology')
    .insert({
      user_id: user.id,
      test_date: parsed.data.test_date ?? today,
      vma_kmh: parsed.data.vma_kmh ?? null,
      run_threshold_pace_sec_per_km: parsed.data.run_threshold_pace_sec_per_km ?? null,
      hr_max_run: parsed.data.hr_max_run ?? null,
      hr_threshold_run: parsed.data.hr_threshold_run ?? null,
      ftp_watts: parsed.data.ftp_watts ?? null,
      hr_max: parsed.data.hr_max ?? null,
      hr_threshold_bike: parsed.data.hr_threshold_bike ?? null,
      css_pace_sec_per_100m: parsed.data.css_pace_sec_per_100m ?? null,
    })
    .select()
    .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error) return apiError(error.message)
  return apiSuccess(data, 201)
}
