import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { differenceInWeeks, parseISO } from 'date-fns'
import CoachChat from '@/components/coach/CoachChat'
import {
  ACCENT as MINT,
  SURFACE as DARK,
  SURFACE_DEEP,
  DIVIDER as DIV,
  DISCIPLINE,
  disciplineColor,
  withAlpha,
} from '@/lib/theme'

export const metadata = { title: 'Tableau de bord — Coach Tri' }

const DISCIPLINE_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(DISCIPLINE).map(([k, v]) => [k, v.icon]),
)
const DISCIPLINE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(DISCIPLINE).map(([k, v]) => [k, v.label]),
)
const SESSION_TYPE_LABEL: Record<string, string> = {
  easy: 'Endurance facile',
  tempo: 'Tempo',
  threshold: 'Seuil',
  vo2: 'VO2max',
  race_pace: 'Allure course',
  technique: 'Technique',
  long: 'Sortie longue',
  recovery: 'Récupération active',
  test: 'Test',
}
const PHASE_LABELS: Record<string, string> = {
  prep: 'Préparation',
  base: 'Base',
  build: 'Construction',
  peak: 'Pic',
  taper: 'Affûtage',
  race: 'Course',
  maintenance: 'Maintien',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]

  const [profileRes, planRes, todaySessionRes, nextSessionRes] = await Promise.all([
    supabase.from('profiles').select('first_name, level').eq('id', user!.id).single(),

    supabase
      .from('plans')
      .select(
        'id, name, start_date, end_date, status, goal:goals(race_name, race_date), plan_phases(*), plan_weeks(id, week_num, phase)',
      )
      .eq('user_id', user!.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('sessions')
      .select(
        'id, title, discipline, session_type, duration_min, planned_tss, expected_rpe, status, coaching_note',
      )
      .eq('user_id', user!.id)
      .eq('session_date', today)
      .neq('status', 'done')
      .order('day_part', { ascending: true })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('sessions')
      .select('id, title, discipline, session_type, duration_min, session_date, status')
      .eq('user_id', user!.id)
      .eq('status', 'planned')
      .gt('session_date', today)
      .order('session_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const profile = profileRes.data as { first_name: string | null; level: string | null } | null
  const plan = planRes.data as Record<string, unknown> | null
  const todaySession = todaySessionRes.data as Record<string, unknown> | null
  const nextSession = nextSessionRes.data as Record<string, unknown> | null

  const firstName = profile?.first_name ?? 'Athlète'

  // Current week calculation
  let currentWeekNum = 0
  let currentPhaseLabel = '—'
  let totalWeeks = 0

  if (plan) {
    const startDate = parseISO(plan.start_date as string)
    const weeks = (plan.plan_weeks as Record<string, unknown>[]) ?? []
    const phases = (plan.plan_phases as Record<string, unknown>[]) ?? []
    totalWeeks = weeks.length
    currentWeekNum = Math.min(Math.max(0, differenceInWeeks(new Date(), startDate)) + 1, totalWeeks)

    const currentPhase = phases.find(
      (p) =>
        (p.start_week_num as number) <= currentWeekNum &&
        (p.end_week_num as number) >= currentWeekNum,
    )
    currentPhaseLabel = PHASE_LABELS[currentPhase?.phase as string] ?? '—'
  }

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Tableau de bord
        </p>
        <h1 className="text-4xl font-bold uppercase tracking-tight">
          Bonjour, <span style={{ color: MINT }}>{firstName}</span>
        </h1>
        <p className="text-sm text-muted-foreground">Voici votre synthèse d&apos;entraînement</p>
      </div>

      {/* Séance du jour */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
          Aujourd&apos;hui
        </h2>

        {todaySession ? (
          <div
            className="card-elev rounded-2xl overflow-hidden"
            style={{
              backgroundColor: DARK,
              border: `1px solid ${DIV}`,
              borderLeft: `3px solid ${disciplineColor(todaySession.discipline as string)}`,
            }}
          >
            {/* Top */}
            <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{
                    backgroundColor: withAlpha(
                      disciplineColor(todaySession.discipline as string),
                      12,
                    ),
                    border: `1px solid ${withAlpha(disciplineColor(todaySession.discipline as string), 30)}`,
                  }}
                >
                  {DISCIPLINE_EMOJI[todaySession.discipline as string] ?? '⚡'}
                </div>
                <div>
                  <p
                    className="font-semibold uppercase tracking-widest text-sm leading-tight"
                    style={{ color: disciplineColor(todaySession.discipline as string) }}
                  >
                    {DISCIPLINE_LABEL[todaySession.discipline as string]}
                    {todaySession.session_type
                      ? ` · ${SESSION_TYPE_LABEL[todaySession.session_type as string]}`
                      : ''}
                  </p>
                  <p className="text-base font-bold mt-0.5 text-foreground">
                    {(todaySession.title as string | null) ?? 'Séance du jour'}
                  </p>
                </div>
              </div>
              <div
                className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full font-mono"
                style={{ color: MINT, border: `1px solid ${withAlpha(MINT, 60)}` }}
              >
                {todaySession.duration_min as number} min
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3 flex items-center justify-between gap-3"
              style={{ borderTop: `1px solid ${DIV}`, backgroundColor: SURFACE_DEEP }}
            >
              <div className="flex gap-4">
                {(todaySession.planned_tss as number | null) != null && (
                  <span className="text-xs" style={{ color: 'oklch(0.287 0.047 217.9 / 70%)' }}>
                    <span
                      className="font-semibold"
                      style={{ color: 'oklch(0.287 0.047 217.9 / 80%)' }}
                    >
                      {todaySession.planned_tss as number}
                    </span>{' '}
                    TSS
                  </span>
                )}
                {(todaySession.expected_rpe as number | null) != null && (
                  <span className="text-xs" style={{ color: 'oklch(0.287 0.047 217.9 / 70%)' }}>
                    RPE{' '}
                    <span
                      className="font-semibold"
                      style={{ color: 'oklch(0.287 0.047 217.9 / 80%)' }}
                    >
                      {todaySession.expected_rpe as number}/10
                    </span>
                  </span>
                )}
              </div>
              <Link
                href={`/session/${todaySession.id as string}`}
                className="text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ backgroundColor: MINT, color: DARK }}
              >
                Voir la séance →
              </Link>
            </div>
          </div>
        ) : plan && nextSession ? (
          <div
            className="card-elev rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
            style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
          >
            <div>
              <p className="font-bold text-sm" style={{ color: 'oklch(0.287 0.047 217.9)' }}>
                Pas de séance prévue aujourd&apos;hui
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'oklch(0.287 0.047 217.9 / 70%)' }}>
                Prochaine : {DISCIPLINE_EMOJI[nextSession.discipline as string]}{' '}
                {DISCIPLINE_LABEL[nextSession.discipline as string]} —{' '}
                {new Date(nextSession.session_date as string).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            </div>
            <Link
              href="/program"
              className="text-xs font-semibold uppercase tracking-widest px-3 py-2 rounded-xl transition-opacity hover:opacity-80 whitespace-nowrap"
              style={{
                backgroundColor: `${withAlpha(MINT, 12)}`,
                color: MINT,
                border: `1px solid ${withAlpha(MINT, 30)}`,
              }}
            >
              Voir le programme
            </Link>
          </div>
        ) : plan ? (
          <div
            className="card-elev rounded-2xl px-5 py-8 text-center"
            style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
          >
            <p className="text-sm font-bold" style={{ color: 'oklch(0.287 0.047 217.9)' }}>
              Programme terminé 🎉
            </p>
            <p className="text-xs mt-1" style={{ color: 'oklch(0.287 0.047 217.9 / 70%)' }}>
              Toutes les séances sont complétées.
            </p>
          </div>
        ) : (
          <div
            className="card-elev rounded-2xl py-12 text-center space-y-4"
            style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
          >
            <p className="text-sm" style={{ color: 'oklch(0.287 0.047 217.9 / 70%)' }}>
              Aucun programme actif.
            </p>
            <Link
              href="/program/new"
              className="inline-flex items-center justify-center rounded-xl font-semibold uppercase tracking-widest text-sm px-6 py-3 transition-opacity hover:opacity-90"
              style={{ backgroundColor: MINT, color: DARK }}
            >
              ✨ Créer mon programme
            </Link>
          </div>
        )}
      </section>

      {/* Programme actif */}
      {plan && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            Programme actif
          </h2>
          <div
            className="card-elev rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
            style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
          >
            <div>
              <p
                className="font-semibold uppercase tracking-widest text-sm"
                style={{ color: MINT }}
              >
                {((plan.goal as Record<string, unknown> | null)?.race_name as string | null) ??
                  (plan.name as string | null) ??
                  "Programme d'entraînement"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'oklch(0.287 0.047 217.9 / 70%)' }}>
                Sem. {currentWeekNum}/{totalWeeks} · {currentPhaseLabel}
              </p>
            </div>
            <Link
              href="/program"
              className="text-xs font-semibold uppercase tracking-widest px-3 py-2 rounded-xl transition-opacity hover:opacity-80 whitespace-nowrap"
              style={{
                backgroundColor: `${withAlpha(MINT, 12)}`,
                color: MINT,
                border: `1px solid ${withAlpha(MINT, 30)}`,
              }}
            >
              Voir →
            </Link>
          </div>
        </section>
      )}

      {/* Coach IA */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Ton coach</h2>
        <CoachChat />
      </section>
    </div>
  )
}
