import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/common/AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Filigrane topographique — signature DA Sommet (courbes de niveau).
          `absolute` (et non `fixed`) → défile avec le contenu. */}
      <div className="topo-lines pointer-events-none absolute inset-0 z-0 opacity-[0.14]" />
      <AppNav user={user} />
      <main className="relative z-10 flex-1 container mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  )
}
