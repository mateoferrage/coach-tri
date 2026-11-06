export type Zone = 1 | 2 | 3 | 4 | 5

export interface EffortSegment {
  zone: Zone
  /** Part de la durée totale, entre 0 et 1. */
  share: number
}

export interface EffortInput {
  discipline: string
  session_type: string
  duration_min: number
  target_zone: string | null
}

const ZONE_BY_TYPE: Record<string, Zone> = {
  easy: 2,
  long: 2,
  technique: 2,
  recovery: 2,
  tempo: 3,
  threshold: 4,
  race_pace: 4,
  vo2: 5,
  test: 5,
}

/** Zone la plus haute citée dans un texte libre (« Z2-Z3 », « Zones 3-4 » → 3, 4), ou null. */
function parseTargetZone(text: string | null): Zone | null {
  if (!text) return null
  const zones = [...text.matchAll(/z(?:ones?)?\s*([1-5])(?:\s*-\s*z?\s*([1-5]))?(?!\d)/gi)].flatMap(
    (m) => [m[1], m[2]].filter(Boolean).map(Number),
  )
  return zones.length ? (Math.max(...zones) as Zone) : null
}

/**
 * Profil d'effort approximé en trois blocs. `sessions.structure` ne contient
 * pas de durées chiffrées : on ne peut pas dessiner les vrais intervalles.
 */
export function effortSegments(session: EffortInput): EffortSegment[] {
  if (session.discipline === 'rest' || session.duration_min <= 0) return []
  const main = parseTargetZone(session.target_zone) ?? ZONE_BY_TYPE[session.session_type] ?? 2
  return [
    { zone: 1, share: 0.2 },
    { zone: main, share: 0.7 },
    { zone: 1, share: 0.1 },
  ]
}
