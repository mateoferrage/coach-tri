import { asJson } from '@/lib/utils/json'
import type { MicroSessions } from '@/lib/schemas/plan'
import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

const VALID_SESSION_TYPES = new Set([
  'easy',
  'tempo',
  'threshold',
  'vo2',
  'race_pace',
  'technique',
  'long',
  'recovery',
  'test',
])
const SESSION_TYPE_MAP: Record<string, string> = {
  endurance: 'easy',
  interval: 'vo2',
  intervals: 'vo2',
  ftp: 'threshold',
  sprint: 'vo2',
  speed: 'vo2',
  strength: 'easy',
  brick: 'easy',
  'race pace': 'race_pace',
  moderate: 'tempo',
  z2: 'easy',
  base: 'easy',
}
export function normalizeSessionType(raw: string): string {
  const lower = (raw ?? '').toLowerCase().trim()
  if (VALID_SESSION_TYPES.has(lower)) return lower
  return SESSION_TYPE_MAP[lower] ?? 'easy'
}

const VALID_DISCIPLINES = new Set(['swim', 'bike', 'run', 'brick', 'strength', 'rest'])
export function normalizeDiscipline(raw: string): string {
  const lower = (raw ?? '').toLowerCase().trim()
  return VALID_DISCIPLINES.has(lower) ? lower : 'run'
}

// Contrainte DB : expected_rpe doit être null ou un entier entre 1 et 10.
// Gemini renvoie parfois 0 (jour de repos/récup) ou une valeur hors bornes →
// on assainit avant insert pour ne pas violer sessions_expected_rpe_check.
export function normalizeExpectedRpe(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  const rounded = Math.round(raw)
  if (rounded < 1) return null
  return Math.min(rounded, 10)
}

/**
 * Remplace les séances `planned` d'une semaine par celles générées par l'IA
 * (les séances done/skipped sont conservées). Renvoie les séances insérées.
 */
export async function replaceWeekSessions(params: {
  admin: AdminClient
  plan_id: string
  plan_week_id: string
  user_id: string
  sessions: MicroSessions['sessions']
}): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> {
  const { admin, plan_id, plan_week_id, user_id, sessions } = params

  await admin.from('sessions').delete().eq('plan_week_id', plan_week_id).eq('status', 'planned')

  const rows = sessions.map((s) => {
    const jsDay = new Date(s.session_date + 'T00:00:00').getDay() // 0=dim, 6=sam
    // Weekdays → evening (18h), Saturday → morning (7h), Sunday → midday (12h)
    const day_part = jsDay === 0 ? 'midday' : jsDay === 6 ? 'morning' : 'evening'
    return {
      plan_id,
      plan_week_id,
      user_id,
      ...s,
      discipline: normalizeDiscipline(s.discipline),
      session_type: normalizeSessionType(s.session_type),
      expected_rpe: normalizeExpectedRpe(s.expected_rpe),
      day_part,
      status: 'planned',
      structure: asJson(s.structure),
      target_values: asJson(s.target_values),
    }
  })

  return (await admin
    .from('sessions')
    .insert(rows)
    .select('id, title, session_date, discipline')) as {
    data: Array<Record<string, unknown>> | null
    error: { message: string } | null
  }
}
