// Phases d'un plan course. Doit rester aligné avec la contrainte CHECK de
// `plan_phases.phase` (migration 0005_plans.sql).
export const PHASE_VALUES = ['prep', 'base', 'build', 'peak', 'taper', 'race'] as const
export type Phase = (typeof PHASE_VALUES)[number]

// Synonymes / libellés non canoniques fréquemment produits par le LLM.
// Ex. un bloc « transition » entre deux courses est traité comme de la prépa.
const PHASE_SYNONYMS: Record<string, Phase> = {
  transition: 'prep',
  preparation: 'prep',
  prepa: 'prep',
  intro: 'prep',
  affutage: 'taper',
  competition: 'race',
  course: 'race',
}

/**
 * Normalise une valeur de phase issue du LLM vers la valeur canonique attendue
 * par la base. Le LLM produit souvent des libellés enrichis (« BASE 1 »,
 * « BUILD 2 (Trail Focus) », « TAPER (Tri Test) », « TRANSITION (Post-Trail) »),
 * surtout en multi-course. On extrait donc le mot-clé de phase plutôt que
 * d'exiger une correspondance exacte. Renvoie `null` si rien n'est reconnu —
 * l'appelant décide quoi en faire (erreur ou skip).
 */
export function normalizePhase(raw: string): Phase | null {
  const v = raw.trim().toLowerCase()
  if ((PHASE_VALUES as readonly string[]).includes(v)) return v as Phase
  // Mot-clé canonique présent dans le libellé (ex. « build 2 (trail) » → build).
  for (const p of PHASE_VALUES) {
    if (new RegExp(`\\b${p}\\b`).test(v)) return p
  }
  // Synonymes, accents retirés (affûtage → affutage, récup → recup…).
  const ascii = v.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  for (const [syn, p] of Object.entries(PHASE_SYNONYMS)) {
    if (ascii.includes(syn)) return p
  }
  return null
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
