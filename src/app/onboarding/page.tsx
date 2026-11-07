import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/common/Logo'
import { OnboardingFlow } from '@/components/forms/OnboardingFlow'

export const metadata = { title: 'Configuration — Coach Tri' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = (await supabase
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
    <div className="flex min-h-dvh justify-center bg-primary px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-xl py-10">
        <div className="mb-8 flex justify-center">
          <Logo tone="light" className="text-2xl" />
        </div>
        <div className="mb-6 text-center text-primary-foreground">
          <h1 className="text-3xl">
            {isEditing ? 'Modifier mon profil' : 'Bienvenue sur Coach Tri'}
          </h1>
          <p className="mt-2 text-base font-semibold">
            {isEditing ? 'Mets à jour tes informations' : 'Configurons votre profil en 3 étapes'}
          </p>
        </div>
        <OnboardingFlow initialData={profile} isEditing={isEditing} />
      </div>
    </div>
  )
}
