import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { derivePhysiologyFromRecords } from '@/lib/utils/performance'
import { z } from 'zod'

// L'athlète saisit des records (temps) + FTP + FC ; les seuils (allure seuil,
// VMA, CSS) sont dérivés côté serveur puis stockés (voir performance.ts).
const PhysiologySchema = z.object({
  // Records course (secondes)
  run_5k_time_s: z.number().int().min(600).max(3600).nullable().optional(),
  run_10k_time_s: z.number().int().min(1200).max(7200).nullable().optional(),
  run_half_time_s: z.number().int().min(2700).max(18000).nullable().optional(),
  // Records nage (secondes)
  swim_100m_time_s: z.number().int().min(45).max(300).nullable().optional(),
  swim_200m_time_s: z.number().int().min(90).max(600).nullable().optional(),
  swim_400m_time_s: z.number().int().min(180).max(1200).nullable().optional(),
  swim_800m_time_s: z.number().int().min(360).max(2400).nullable().optional(),
  // Vélo + cardio saisis directement
  ftp_watts: z.number().int().min(50).max(600).nullable().optional(),
  hr_max: z.number().int().min(100).max(230).nullable().optional(),
  resting_hr: z.number().int().min(25).max(100).nullable().optional(),
  test_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { data } = (await supabase
    .from('physiology_current')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()) as { data: Record<string, unknown> | null }

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
  const parsed = PhysiologySchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Dérive allure seuil / VMA / CSS depuis les records saisis.
  const derived = derivePhysiologyFromRecords(parsed.data)

  const { data, error } = (await admin
    .from('physiology')
    .insert({
      user_id: user.id,
      test_date: parsed.data.test_date ?? today,
      source: 'manual',
      // Records saisis (source de vérité)
      run_5k_time_s: parsed.data.run_5k_time_s ?? null,
      run_10k_time_s: parsed.data.run_10k_time_s ?? null,
      run_half_time_s: parsed.data.run_half_time_s ?? null,
      swim_100m_time_s: parsed.data.swim_100m_time_s ?? null,
      swim_200m_time_s: parsed.data.swim_200m_time_s ?? null,
      swim_400m_time_s: parsed.data.swim_400m_time_s ?? null,
      swim_800m_time_s: parsed.data.swim_800m_time_s ?? null,
      // Vélo + cardio saisis directement
      ftp_watts: parsed.data.ftp_watts ?? null,
      hr_max: parsed.data.hr_max ?? null,
      resting_hr: parsed.data.resting_hr ?? null,
      // Seuils dérivés (pour que le calcul de zones reste inchangé)
      run_threshold_pace_sec_per_km: derived.run_threshold_pace_sec_per_km,
      vma_kmh: derived.vma_kmh,
      css_pace_sec_per_100m: derived.css_pace_sec_per_100m,
    })
    .select()
    .single()) as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error) return apiError(error.message)
  return apiSuccess(data, 201)
}
