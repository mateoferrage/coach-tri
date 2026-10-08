import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { PhaseBar } from '@/components/plan/PhaseBar'
import { WeekView } from '@/components/plan/WeekView'
import { StopProgramButton } from '@/components/plan/StopProgramButton'
import { AddRaceDialog } from '@/components/plan/AddRaceDialog'
import { differenceInWeeks, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'

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

  const rawCurrentGoalIds = planGoalsData?.map((r: Record<string, unknown>) => r.goal_id as string) ?? []
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
    .filter(
      (g: Record<string, unknown>) => !currentGoalIds.includes(g.id as string),
    )
    .map((g: Record<string, unknown>) => ({
      id: g.id as string,
      race_name: g.race_name as string,
      race_date: g.race_date as string,
      sport: g.sport as string | undefined,
    }))

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold">Aucun programme actif</h1>
        <p className="text-muted-foreground">
          Créez votre premier programme pour commencer à vous entraîner.
        </p>
        <Link
          href="/program/new"
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2 transition-all hover:bg-primary/80"
        >
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

  const PHASE_LABELS: Record<string, string> = {
    prep: 'Préparation',
    base: 'Base',
    build: 'Construction',
    peak: 'Pic',
    taper: 'Affûtage',
    race: 'Course',
    maintenance: 'Maintien',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {goal ? (goal.race_name as string) : 'Programme Maintien'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {total_weeks} semaines · {format(startDate, 'd MMM yyyy', { locale: fr })}
            {plan.end_date
              ? ` → ${format(parseISO(plan.end_date as string), 'd MMM yyyy', { locale: fr })}`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(plan.goal_id as string | null) && (
            <AddRaceDialog
              planId={plan.id as string}
              currentGoalIds={currentGoalIds}
              primaryGoalId={plan.goal_id as string}
              availableGoals={availableGoals}
            />
          )}
          <Link
            href="/program/new"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card text-sm font-medium px-3 py-1.5 hover:bg-muted transition-colors"
          >
            Nouveau programme
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{currentWeekNum}</div>
            <div className="text-xs text-muted-foreground mt-1">Semaine en cours</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">
              {PHASE_LABELS[currentPhase?.phase as string] ?? '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Phase actuelle</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{doneSessions}</div>
            <div className="text-xs text-muted-foreground mt-1">Séances complétées</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{totalHoursDone.toFixed(0)}h</div>
            <div className="text-xs text-muted-foreground mt-1">Volume accumulé</div>
          </CardContent>
        </Card>
      </div>

      {/* Phase bar */}
      {phases.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Périodisation
          </h2>
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
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Semaines
            </h2>

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
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">
                  Semaines passées
                </h3>
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
