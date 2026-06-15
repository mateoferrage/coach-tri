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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: goals } = (await (supabase as any)
    .from('goals')
    .select('id, race_name, race_date, race_type, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('race_date', { ascending: true })) as { data: Array<Record<string, unknown>> | null }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Nouveau programme</h1>
        <p className="text-muted-foreground mt-1">
          L&apos;IA va générer votre programme complet en quelques secondes.
        </p>
      </div>
      <ProgramForm goals={(goals ?? []) as unknown as Parameters<typeof ProgramForm>[0]['goals']} />
    </div>
  )
}
