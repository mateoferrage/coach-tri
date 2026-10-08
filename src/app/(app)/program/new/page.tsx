import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProgramForm } from '@/components/forms/ProgramForm'

export const metadata = { title: 'Nouveau programme — Coach Tri' }

export default async function NewProgramPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [goalsRes, profileRes] = await Promise.all([
    supabase
      .from('goals')
      .select('id, race_name, race_date, race_type, sport, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('race_date', { ascending: true }),
    supabase.from('profiles').select('available_disciplines').eq('id', user.id).single(),
  ])
  const goals = goalsRes.data as Array<Record<string, unknown>> | null
  const availableDisciplines =
    ((profileRes.data?.available_disciplines as string[] | null) ?? []) as string[]

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Nouveau programme</h1>
        <p className="text-muted-foreground mt-1">
          L&apos;IA va générer votre programme complet en quelques secondes.
        </p>
      </div>
      <ProgramForm
        goals={(goals ?? []) as unknown as Parameters<typeof ProgramForm>[0]['goals']}
        availableDisciplines={availableDisciplines}
      />
    </div>
  )
}
