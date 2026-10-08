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
 * par la base. Le LLM produit souvent des libellés enrichis, surtout en
 * multi-course — avec espaces, parenthèses, chiffres OU underscores :
 * « BASE 1 », « BUILD 2 (Trail Focus) », « BASE_VENTOUX », « TAPER_TRI »…
 * On découpe donc le libellé en tokens (tout ce qui n'est pas une lettre) et
 * on cherche un mot-clé de phase, canonique d'abord puis synonyme. Renvoie
 * `null` si rien n'est reconnu — l'appelant décide quoi en faire.
 */
export function normalizePhase(raw: string): Phase | null {
  const v = raw.trim().toLowerCase()
  if ((PHASE_VALUES as readonly string[]).includes(v)) return v as Phase
  // Accents retirés puis découpe sur tout séparateur non-alphabétique
  // (espace, underscore, tiret, parenthèse, chiffre…).
  const tokens = v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^a-z]+/)
    .filter(Boolean)
  // Un mot-clé canonique l'emporte sur un synonyme (signal plus fort).
  for (const tok of tokens) {
    if ((PHASE_VALUES as readonly string[]).includes(tok)) return tok as Phase
  }
  for (const tok of tokens) {
    if (PHASE_SYNONYMS[tok]) return PHASE_SYNONYMS[tok]
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
