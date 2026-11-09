import { generateJSON } from '@/lib/gemini/client'
import { TRIATHLON_COACH_SYSTEM, buildMacroPrompt } from '@/lib/gemini/prompts'
import { normalizePhase, type Phase } from '@/lib/plan/phases'
import type { MacroPlan } from '@/lib/schemas/plan'

/** La structure du plan engage toute la préparation : on laisse l'IA réfléchir. */
const MACRO_THINKING_BUDGET = 2048
const MAX_ATTEMPTS = 2
const MIN_LOAD_SHARE = 0.5
const RECOVERY_SHARE = 0.65

/**
 * Normalise les phases et liste tout ce qui rend la réponse inexploitable :
 * phase inconnue, semaines manquantes ou en double, volume ou intensité absurdes.
 */
export function normalizeMacroPlan(
  raw: Partial<MacroPlan>,
  totalWeeks: number,
): { plan: MacroPlan; errors: string[] } {
  const errors: string[] = []
  const rawPhases = raw.phases ?? []
  const rawWeeks = raw.weeks ?? []
  if (!rawPhases.length || !rawWeeks.length) errors.push('structure manquante')

  const phases = rawPhases.flatMap((p) => {
    const phase = normalizePhase(p.phase)
    if (!phase) {
      errors.push(`phase inconnue : ${p.phase}`)
      return []
    }
    return [{ ...p, phase }]
  })

  const weeks = rawWeeks.map((w) => {
    const phase: Phase | null = normalizePhase(w.phase)
    if (!phase) errors.push(`semaine ${w.week_num} : phase inconnue : ${w.phase}`)
    if (!(w.planned_volume_hours > 0)) errors.push(`semaine ${w.week_num} : volume invalide`)
    const sum = Object.values(w.distribution ?? {}).reduce((s, v) => s + v, 0)
    if (sum < 0.9 || sum > 1.1)
      errors.push(`semaine ${w.week_num} : la répartition d'intensité doit totaliser 1`)
    return { ...w, phase: phase ?? w.phase }
  })

  const nums = weeks.map((w) => w.week_num).sort((a, b) => a - b)
  const expected = Array.from({ length: totalWeeks }, (_, i) => i + 1)
  if (rawWeeks.length && nums.join() !== expected.join())
    errors.push(`les semaines doivent aller de 1 à ${totalWeeks}, une seule fois chacune`)

  return { plan: { phases, weeks }, errors }
}

/** Colonnes de `plan_weeks` issues de l'IA : `planned_tss` est un entier en base. */
export function toWeekColumns(w: MacroPlan['weeks'][number]) {
  return {
    phase: w.phase,
    is_recovery_week: !!w.is_recovery_week,
    planned_volume_hours: w.planned_volume_hours,
    planned_tss: Math.round(w.planned_tss),
    distribution: w.distribution,
    notes: w.notes,
  }
}

/** Un débutant ne travaille pas en Z4-Z5 : cette part est reportée en Z3. */
export function applyLevelRules(weeks: MacroPlan['weeks'], level: string | null) {
  if (level !== 'beginner') return weeks
  return weeks.map((w) => {
    const { z4z5 = 0, z3 = 0 } = w.distribution ?? {}
    return z4z5 > 0 ? { ...w, distribution: { ...w.distribution, z3: z3 + z4z5, z4z5: 0 } } : w
  })
}

/**
 * Garde-fou sur le volume : une semaine de charge ne descend pas sous la moitié de
 * la disponibilité déclarée. L'historique des montres est souvent incomplet et ne
 * doit pas écraser ce que l'athlète annonce. L'affûtage et la course sont exclus.
 */
export function applyVolumeFloor(weeks: MacroPlan['weeks'], weeklyHours: number | null) {
  if (!weeklyHours) return weeks
  return weeks.map((w) => {
    if (w.phase === 'taper' || w.phase === 'race') return w
    const floor = weeklyHours * MIN_LOAD_SHARE * (w.is_recovery_week ? RECOVERY_SHARE : 1)
    if (w.planned_volume_hours >= floor) return w
    const hours = Math.round(floor * 10) / 10
    return {
      ...w,
      planned_volume_hours: hours,
      planned_tss: Math.round((w.planned_tss * hours) / w.planned_volume_hours),
    }
  })
}

/**
 * Génère et normalise la structure macro (phases + semaines) via l'IA, avec une
 * nouvelle tentative corrigée si la réponse est invalide.
 * Lève une Error avec message explicite si elle reste inexploitable.
 * L'appelant gère la persistance et le mapping vers apiError.
 */
export async function generateMacroWeeks(
  input: Parameters<typeof buildMacroPrompt>[0],
): Promise<{ phases: MacroPlan['phases']; weeks: MacroPlan['weeks'] }> {
  const userPrompt = buildMacroPrompt(input)
  let correction = ''
  let errors: string[] = []

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const raw = await generateJSON<Partial<MacroPlan>>(
      TRIATHLON_COACH_SYSTEM,
      userPrompt + correction,
      { thinkingBudget: MACRO_THINKING_BUDGET },
    )
    const result = normalizeMacroPlan(raw, input.total_weeks)
    if (!result.errors.length) {
      return {
        phases: result.plan.phases,
        weeks: applyVolumeFloor(
          applyLevelRules(result.plan.weeks, input.profile.level),
          input.profile.weekly_hours_avg,
        ),
      }
    }
    errors = result.errors
    correction = `\n\nTa réponse précédente était invalide. Corrige impérativement :\n- ${errors.join('\n- ')}`
  }

  throw new Error(`Réponse Gemini invalide — ${errors.slice(0, 3).join(' ; ')}`)
}
