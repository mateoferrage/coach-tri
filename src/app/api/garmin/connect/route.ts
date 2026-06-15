import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { GarminCredentialsSchema } from '@/lib/schemas/garmin'
import { encryptCredential } from '@/lib/utils/crypto'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiError('Non authentifié', 401)

  const body = await request.json()
  const parsed = GarminCredentialsSchema.safeParse(body)

  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }

  const { email, password } = parsed.data

  try {
    const email_enc = encryptCredential(email)
    const password_enc = encryptCredential(password)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('garmin_credentials')
      .upsert({ user_id: user.id, email_enc, password_enc }, { onConflict: 'user_id' })

    if (error) return apiError((error as { message: string }).message)

    return apiSuccess({ success: true, message: 'Identifiants Garmin sauvegardés' }, 201)
  } catch {
    return apiError('Erreur lors du chiffrement des identifiants')
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiError('Non authentifié', 401)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('garmin_credentials')
    .delete()
    .eq('user_id', user.id)

  if (error) return apiError((error as { message: string }).message)
  return apiSuccess({ success: true })
}
