import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from '@/components/forms/OnboardingFlow'

export const metadata = { title: 'Configuration — Coach Tri' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (supabase as any)
    .from('profiles')
    .select(
      'first_name, birth_date, sex, weight_kg, height_cm, level, weekly_hours_avg, available_disciplines',
    )
    .eq('id', user.id)
    .maybeSingle()) as {
    data: {
      first_name: string | null
      birth_date: string | null
      sex: string | null
      weight_kg: number | null
      height_cm: number | null
      level: string | null
      weekly_hours_avg: number | null
      available_disciplines: string[] | null
    } | null
  }

  const isEditing = !!profile?.first_name

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Modifier mon profil' : 'Bienvenue sur Coach Tri'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isEditing ? 'Mets à jour tes informations' : 'Configurons votre profil en 3 étapes'}
          </p>
        </div>
        <OnboardingFlow initialData={profile} isEditing={isEditing} />
      </div>
    </div>
  )
}
