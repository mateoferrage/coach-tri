import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { TodayBoard } from '@/components/dashboard/TodayBoard'
import { WeekLoad } from '@/components/plan/WeekLoad'
import { PHASE_LABEL, formatWeekRange } from '@/lib/plan/display'
import {
  buildWeekRows,
  findCurrentWeek,
  pickDefaultSessionId,
  summarizeWeekLoad,
  type DashboardSession,
  type PlanWeekRef,
} from '@/lib/plan/week-summary'

export const metadata = { title: 'Tableau de bord — Coach Tri' }

const SESSION_FIELDS =
  'id, title, session_date, day_part, discipline, session_type, duration_min, planned_tss, target_zone, coaching_note, status'

function EmptyState({
  title,
  text,
  href,
  cta,
  tone = 'white',
}: {
  title: string
  text: string
  href: string
  cta: string
  tone?: 'blue' | 'white'
}) {
  const blue = tone === 'blue'
  return (
    <section
      className={
        blue
          ? 'flex flex-col items-start gap-4 rounded-xl bg-primary p-8 text-primary-foreground'
          : 'flex flex-col items-start gap-4 rounded-xl border border-border p-8'
      }
    >
      <h2 className="text-3xl">{title}</h2>
      <p
        className={
          blue ? 'max-w-[52ch] text-base font-semibold' : 'max-w-[52ch] text-muted-foreground'
        }
      >
        {text}
      </p>
      <Link
        href={href}
        className={buttonVariants({ variant: blue ? 'highlight' : 'outline-primary', size: 'lg' })}
      >
        {cta}
      </Link>
    </section>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]

  const [profileRes, planRes] = await Promise.all([
    supabase.from('profiles').select('first_name').eq('id', user!.id).single(),
    supabase
      .from('plans')
      .select('id, plan_weeks(id, week_num, phase, start_date)')
      .eq('user_id', user!.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const firstName = (profileRes.data as { first_name: string | null } | null)?.first_name
  const plan = planRes.data as unknown as { id: string; plan_weeks: PlanWeekRef[] | null } | null
  const weeks = plan?.plan_weeks ?? []
  const week = plan ? findCurrentWeek(weeks, today) : null

  let sessions: DashboardSession[] = []
  if (week) {
    const { data } = await supabase
      .from('sessions')
      .select(SESSION_FIELDS)
      .eq('user_id', user!.id)
      .eq('plan_week_id', week.id)
    sessions = (data ?? []) as unknown as DashboardSession[]
  }

  const rows = week ? buildWeekRows(sessions, week.start_date, today) : []
  const defaultSessionId = pickDefaultSessionId(rows)
  const weekLabel = week
    ? `Semaine ${week.week_num} sur ${weeks.length} · ${PHASE_LABEL[week.phase] ?? week.phase}`
    : ''

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground first-letter:uppercase">
            {format(new Date(), 'EEEE d MMMM', { locale: fr })}
          </p>
          <h1 className="text-3xl md:text-4xl">Bonjour {firstName ?? 'à toi'}</h1>
        </div>
        {week && <p className="text-sm font-semibold text-primary-ink">{weekLabel}</p>}
      </header>

      {!plan ? (
        <EmptyState
          tone="blue"
          title="Aucun programme actif"
          text="Crée ton programme : le coach le construit à partir de ta course et de tes disponibilités."
          href="/program/new"
          cta="Créer mon programme"
        />
      ) : !week ? (
        <EmptyState
          title="Programme terminé"
          text="Toutes les semaines de ton programme sont passées. Lance le suivant quand tu veux."
          href="/program/new"
          cta="Nouveau programme"
        />
      ) : defaultSessionId ? (
        <>
          <TodayBoard
            rows={rows}
            defaultSessionId={defaultSessionId}
            weekLabel={weekLabel}
            weekRange={formatWeekRange(week.start_date)}
          />
          <WeekLoad load={summarizeWeekLoad(rows)} />
        </>
      ) : (
        <EmptyState
          title="Pas de séance cette semaine"
          text="Aucune séance n'est prévue sur cette semaine du programme."
          href="/program"
          cta="Voir le programme"
        />
      )}
    </div>
  )
}
