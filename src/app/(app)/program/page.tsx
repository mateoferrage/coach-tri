import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { SectionLabel } from '@/components/common/SectionLabel'
import { PhaseBar } from '@/components/plan/PhaseBar'
import { WeekView } from '@/components/plan/WeekView'
import { StopProgramButton } from '@/components/plan/StopProgramButton'
import { AddRaceDialog } from '@/components/plan/AddRaceDialog'
import { differenceInWeeks, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { PHASE_LABEL } from '@/lib/plan/display'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Programme — Coach Tri' }

export default async function ProgramPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: plan } = (await supabase
    .from('plans')
    .select(
      `
      *,
      goal:goals!plans_goal_id_fkey(race_name, race_date, race_type),
      plan_phases(*),
      plan_weeks(*, sessions(*))
    `,
    )
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: Record<string, unknown> | null }

  // Fetch attached goal ids for the active plan (if any)
  const { data: planGoalsData } = plan
    ? await supabase
        .from('plan_goals')
        .select('goal_id')
        .eq('plan_id', plan.id as string)
    : { data: null }

  const rawCurrentGoalIds =
    planGoalsData?.map((r: Record<string, unknown>) => r.goal_id as string) ?? []
  const currentGoalIds =
    rawCurrentGoalIds.length > 0
      ? rawCurrentGoalIds
      : plan && (plan.goal_id as string | null)
        ? [plan.goal_id as string]
        : []

  // Fetch all active goals for user
  const { data: allGoalsData } = plan
    ? await supabase
        .from('goals')
        .select('id, race_name, race_date, sport')
        .eq('user_id', user.id)
        .eq('status', 'active')
    : { data: null }

  const availableGoals = (allGoalsData ?? [])
    .filter((g: Record<string, unknown>) => !currentGoalIds.includes(g.id as string))
    .map((g: Record<string, unknown>) => ({
      id: g.id as string,
      race_name: g.race_name as string,
      race_date: g.race_date as string,
      sport: g.sport as string | undefined,
    }))

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center">
        <h1 className="text-3xl md:text-4xl">Aucun programme actif</h1>
        <p className="text-muted-foreground">
          Créez votre premier programme pour commencer à vous entraîner.
        </p>
        <Link href="/program/new" className={buttonVariants({ variant: 'highlight', size: 'lg' })}>
          Créer un programme
        </Link>
      </div>
    )
  }

  const weeks =
    (plan.plan_weeks as Record<string, unknown>[])?.sort(
      (a, b) => (a.week_num as number) - (b.week_num as number),
    ) ?? []
  const phases = (plan.plan_phases as Record<string, unknown>[]) ?? []
  const goal = plan.goal as Record<string, unknown> | null
  const total_weeks = weeks.length

  // Determine current week
  const startDate = parseISO(plan.start_date as string)
  const weeksElapsed = Math.max(0, differenceInWeeks(new Date(), startDate))
  const currentWeekNum = Math.min(weeksElapsed + 1, total_weeks)

  // Current phase
  const currentPhase = phases.find(
    (p) =>
      (p.start_week_num as number) <= currentWeekNum &&
      (p.end_week_num as number) >= currentWeekNum,
  )

  // Stats
  const allSessions = weeks.flatMap((w) => (w.sessions as Record<string, unknown>[]) ?? [])
  const doneSessions = allSessions.filter((s) => s.status === 'done').length
  const totalHoursDone = allSessions
    .filter((s) => s.status === 'done')
    .reduce(
      (acc, s) => acc + ((s.actual_duration_min as number) ?? (s.duration_min as number)) / 60,
      0,
    )

  const currentPhaseLabel = currentPhase
    ? (PHASE_LABEL[currentPhase.phase as string] ?? (currentPhase.phase as string))
    : null
  const secondaryRaces = (allGoalsData ?? []).filter(
    (g: Record<string, unknown>) =>
      currentGoalIds.includes(g.id as string) && g.id !== (plan.goal_id as string | null),
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            {total_weeks} semaines · {format(startDate, 'd MMM yyyy', { locale: fr })}
            {plan.end_date
              ? ` → ${format(parseISO(plan.end_date as string), 'd MMM yyyy', { locale: fr })}`
              : ''}
          </p>
          <h1 className="text-3xl md:text-4xl">
            {goal ? (goal.race_name as string) : 'Programme Maintien'}
          </h1>
          {total_weeks > 0 && (
            <p className="text-sm font-semibold text-primary-ink">
              Semaine {currentWeekNum} sur {total_weeks}
              {currentPhaseLabel ? ` · ${currentPhaseLabel}` : ''}
            </p>
          )}
          {secondaryRaces.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Autres courses du programme">
              {secondaryRaces.map((g: Record<string, unknown>) => (
                <li key={g.id as string}>
                  <Badge variant="outline">{g.race_name as string}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(plan.goal_id as string | null) && (
            <AddRaceDialog
              planId={plan.id as string}
              currentGoalIds={currentGoalIds}
              primaryGoalId={plan.goal_id as string}
              availableGoals={availableGoals}
            />
          )}
          <Link href="/program/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Nouveau programme
          </Link>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: String(currentWeekNum), label: 'Semaine en cours' },
          { value: currentPhaseLabel ?? '—', label: 'Phase actuelle' },
          { value: String(doneSessions), label: 'Séances complétées' },
          { value: `${totalHoursDone.toFixed(0)} h`, label: 'Volume accumulé' },
        ].map((stat) => (
          <Card key={stat.label} size="sm">
            <CardContent className="text-center">
              <div className="font-display text-2xl font-bold tabular-nums">{stat.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Phase bar */}
      {phases.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>Périodisation</SectionLabel>
          <PhaseBar
            phases={phases as unknown as Parameters<typeof PhaseBar>[0]['phases']}
            total_weeks={total_weeks}
            current_week={currentWeekNum}
          />
        </div>
      )}

      {/* Weeks */}
      {(() => {
        const currentWeek = weeks.find((w) => (w.week_num as number) === currentWeekNum) ?? null
        const futureWeeks = weeks
          .filter((w) => (w.week_num as number) > currentWeekNum)
          .sort((a, b) => (a.week_num as number) - (b.week_num as number))
        const pastWeeks = weeks
          .filter((w) => (w.week_num as number) < currentWeekNum)
          .sort((a, b) => (b.week_num as number) - (a.week_num as number))

        return (
          <div className="space-y-3">
            <SectionLabel>Semaines</SectionLabel>

            {currentWeek && (
              <WeekView
                key={currentWeek.id as string}
                week={currentWeek as unknown as Parameters<typeof WeekView>[0]['week']}
                planId={plan.id as string}
                isCurrentWeek={true}
              />
            )}

            {futureWeeks.map((week) => (
              <WeekView
                key={week.id as string}
                week={week as unknown as Parameters<typeof WeekView>[0]['week']}
                planId={plan.id as string}
                isCurrentWeek={false}
              />
            ))}

            {pastWeeks.length > 0 && (
              <>
                <SectionLabel as="h3" className="pt-3 text-muted-foreground">
                  Semaines passées
                </SectionLabel>
                {pastWeeks.map((week) => (
                  <WeekView
                    key={week.id as string}
                    week={week as unknown as Parameters<typeof WeekView>[0]['week']}
                    planId={plan.id as string}
                    isCurrentWeek={false}
                  />
                ))}
              </>
            )}
          </div>
        )
      })()}

      {/* Danger zone */}
      <div className="flex justify-center pt-4 pb-8">
        <StopProgramButton planId={plan.id as string} />
      </div>
    </div>
  )
}
