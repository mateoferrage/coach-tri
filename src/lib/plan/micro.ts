import { asJson } from '@/lib/utils/json'
import type { MicroSessions } from '@/lib/schemas/plan'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateJSON } from '@/lib/gemini/client'
import {
  TRIATHLON_COACH_SYSTEM,
  allowedMicroDisciplines,
  buildMicroPrompt,
  remainingVolumeHours,
} from '@/lib/gemini/prompts'

type AdminClient = ReturnType<typeof createAdminClient>
type Session = MicroSessions['sessions'][number]

const MAX_ATTEMPTS = 2
/** En dessous de ce volume restant, la semaine est considérée comme terminée. */
const MIN_REMAINING_HOURS = 0.25
/** Le prompt demande ±10 % ; on ne relance l'IA qu'au-delà de cette marge. */
const VOLUME_TOLERANCE = 0.15

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

const VALID_DAY_PARTS = new Set(['morning', 'midday', 'evening'])
/** Créneau choisi par l'IA, sinon soir en semaine, matin le samedi, midi le dimanche. */
export function resolveDayPart(raw: unknown, sessionDate: string): string {
  if (typeof raw === 'string' && VALID_DAY_PARTS.has(raw)) return raw
  const jsDay = new Date(`${sessionDate}T00:00:00Z`).getUTCDay()
  return jsDay === 0 ? 'midday' : jsDay === 6 ? 'morning' : 'evening'
}

/**
 * Sépare les séances conformes de celles que le programme interdit (discipline
 * non entraînée, date non disponible, durée nulle). Les lignes « repos » sont
 * retirées sans être une erreur : un jour sans séance est un jour de repos.
 */
export function validateMicroSessions(
  sessions: Session[],
  constraints: { allowedDates: string[]; allowedDisciplines: string[] },
): { valid: Session[]; violations: string[] } {
  const valid: Session[] = []
  const violations: string[] = []
  for (const s of sessions) {
    const discipline = normalizeDiscipline(s.discipline)
    if (discipline === 'rest') continue
    if (!constraints.allowedDisciplines.includes(discipline)) {
      violations.push(`${s.session_date} : discipline « ${discipline} » interdite`)
    } else if (!constraints.allowedDates.includes(s.session_date)) {
      violations.push(`date ${s.session_date} interdite`)
    } else if (!(s.duration_min > 0)) {
      violations.push(`${s.session_date} : durée invalide`)
    } else {
      valid.push(s)
    }
  }
  return { valid, violations }
}

/** Écart de volume à corriger, ou null si la semaine est dans la tolérance. */
export function volumeViolation(sessions: Session[], targetHours: number): string | null {
  const targetMin = Math.round(targetHours * 60)
  const totalMin = sessions.reduce((acc, s) => acc + s.duration_min, 0)
  if (Math.abs(totalMin - targetMin) <= targetMin * VOLUME_TOLERANCE) return null
  return `volume total de ${totalMin} min au lieu de ${targetMin} min : ajuste les durées pour atteindre la cible à 10% près`
}

/**
 * Génère les séances d'une semaine et vérifie qu'elles respectent le programme,
 * avec une nouvelle tentative corrigée. Renvoie `[]` sans appeler l'IA s'il ne
 * reste rien à planifier ; lève une Error si aucune séance valide n'est produite.
 */
export async function generateWeekSessions(
  input: Parameters<typeof buildMicroPrompt>[0],
): Promise<Session[]> {
  if (!input.available_dates.length) return []
  const targetHours = input.kept_sessions?.length
    ? remainingVolumeHours(input)
    : input.week.planned_volume_hours
  if (input.kept_sessions?.length && targetHours < MIN_REMAINING_HOURS) return []

  const constraints = {
    allowedDates: input.available_dates,
    allowedDisciplines: allowedMicroDisciplines(input),
  }
  const userPrompt = buildMicroPrompt(input)
  let correction = ''
  let best: Session[] = []

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const raw = await generateJSON<Partial<MicroSessions>>(
      TRIATHLON_COACH_SYSTEM,
      userPrompt + correction,
    )
    const { valid, violations } = validateMicroSessions(raw.sessions ?? [], constraints)
    const volumeIssue = valid.length ? volumeViolation(valid, targetHours) : null
    if (volumeIssue) violations.push(volumeIssue)
    if (valid.length && !violations.length) return valid
    // À nombre égal de séances, la réponse corrigée est la meilleure.
    if (valid.length >= best.length) best = valid
    correction = `\n\nTa réponse précédente était invalide. Corrige impérativement :\n- ${
      violations.join('\n- ') || 'aucune séance générée'
    }`
  }

  if (best.length) return best
  throw new Error(`Aucune séance valide générée pour la semaine ${input.week.week_num}`)
}

/**
 * Remplace les séances `planned` d'une semaine par celles générées par l'IA
 * (les séances déjà traitées sont conservées). Renvoie les séances insérées.
 */
export async function replaceWeekSessions(params: {
  admin: AdminClient
  plan_id: string
  plan_week_id: string
  user_id: string
  sessions: Session[]
}): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> {
  const { admin, plan_id, plan_week_id, user_id, sessions } = params

  await admin.from('sessions').delete().eq('plan_week_id', plan_week_id).eq('status', 'planned')
  if (!sessions.length) return { data: [], error: null }

  // Colonnes explicites : un champ inattendu renvoyé par l'IA ne doit pas faire
  // échouer tout l'insert.
  const rows = sessions.map((s) => ({
    plan_id,
    plan_week_id,
    user_id,
    session_date: s.session_date,
    title: s.title,
    duration_min: Math.round(s.duration_min),
    planned_tss: s.planned_tss == null ? null : Math.round(s.planned_tss),
    target_zone: s.target_zone ?? null,
    coaching_note: s.coaching_note ?? null,
    template_code: s.template_code ?? null,
    discipline: normalizeDiscipline(s.discipline),
    session_type: normalizeSessionType(s.session_type),
    expected_rpe: normalizeExpectedRpe(s.expected_rpe),
    day_part: resolveDayPart(s.day_part, s.session_date),
    status: 'planned',
    structure: asJson(s.structure),
    target_values: asJson(s.target_values),
  }))

  return (await admin
    .from('sessions')
    .insert(rows)
    .select('id, title, session_date, discipline')) as {
    data: Array<Record<string, unknown>> | null
    error: { message: string } | null
  }
}
