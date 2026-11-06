import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/common/AppNav'
import { CoachDrawerProvider } from '@/components/coach/CoachDrawer'
import { buildRaceSummary } from '@/lib/plan/nav-summary'

interface ActivePlanNav {
  start_date: string
  goal: { race_name: string | null; race_date: string | null } | null
  plan_weeks: { id: string }[] | null
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('plans')
    .select('start_date, goal:goals!plans_goal_id_fkey(race_name, race_date), plan_weeks(id)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const plan = data as unknown as ActivePlanNav | null
  const race = plan
    ? buildRaceSummary(
        {
          raceName: plan.goal?.race_name ?? null,
          raceDate: plan.goal?.race_date ?? null,
          startDate: plan.start_date,
          totalWeeks: plan.plan_weeks?.length ?? 0,
        },
        new Date(),
      )
    : null

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppNav user={user} race={race} />
      <CoachDrawerProvider>
        <main className="container mx-auto min-w-0 max-w-6xl flex-1 px-4 py-8 pb-36 md:px-8 md:pb-24">
          {children}
        </main>
      </CoachDrawerProvider>
    </div>
  )
}
