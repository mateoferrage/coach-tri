import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { todayIn } from '@/lib/utils/today'
import { computeTestOutcome, TestResultSchema } from '@/lib/physiology/test-results'
import { fetchCurrentPhysiology, saveSnapshot, SNAPSHOT_FIELDS } from '@/lib/physiology/snapshot'

/**
 * Enregistre le résultat d'un test de terrain : nouvelle mesure = dernière
 * mesure connue + valeurs du test, qui priment ensuite sur les records.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const parsed = TestResultSchema.safeParse(await request.json())
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)

  let outcome
  try {
    outcome = computeTestOutcome(parsed.data)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Résultat invalide', 400)
  }

  const current = await fetchCurrentPhysiology(supabase, user.id)
  const carried = Object.fromEntries(
    SNAPSHOT_FIELDS.map((f) => [f, (current?.[f] as number | null | undefined) ?? null]),
  )
  const measured = [...new Set([...(current?.measured_fields ?? []), ...outcome.measured])]

  const { error } = await saveSnapshot(createAdminClient(), {
    user_id: user.id,
    test_date: todayIn(),
    source: 'test',
    ...carried,
    ...outcome.values,
    measured_fields: measured,
  })
  if (error) return apiError(error.message)

  return apiSuccess({ summary: outcome.summary }, 201)
}
