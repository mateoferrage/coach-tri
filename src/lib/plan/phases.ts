// Phases d'un plan course. Doit rester aligné avec la contrainte CHECK de
// `plan_phases.phase` (migration 0005_plans.sql).
export const PHASE_VALUES = ['prep', 'base', 'build', 'peak', 'taper', 'race'] as const
export type Phase = (typeof PHASE_VALUES)[number]

/**
 * Normalise une valeur de phase issue du LLM (casse/espaces non fiables) vers
 * la valeur canonique attendue par la base. Renvoie `null` si la valeur n'est
 * pas reconnue — l'appelant décide quoi en faire (erreur ou skip).
 */
export function normalizePhase(raw: string): Phase | null {
  const v = raw.trim().toLowerCase()
  return (PHASE_VALUES as readonly string[]).includes(v) ? (v as Phase) : null
}

export interface DerivedPhase {
  phase: Phase
  start_week_num: number
  end_week_num: number
}

/**
 * Reconstruit les phases d'un plan à partir de ses semaines, en regroupant les
 * semaines consécutives partageant la même phase (normalisée). Les semaines de
 * phase inconnue sont ignorées.
 */
export function derivePhasesFromWeeks(
  weeks: { week_num: number; phase: string }[],
): DerivedPhase[] {
  const sorted = [...weeks].sort((a, b) => a.week_num - b.week_num)
  const out: DerivedPhase[] = []

  for (const w of sorted) {
    const phase = normalizePhase(w.phase)
    if (!phase) continue
    const last = out[out.length - 1]
    if (last && last.phase === phase && w.week_num === last.end_week_num + 1) {
      last.end_week_num = w.week_num
    } else {
      out.push({ phase, start_week_num: w.week_num, end_week_num: w.week_num })
    }
  }

  return out
}
