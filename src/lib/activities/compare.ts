// Comparaison prévu / réalisé d'une séance, calculée en code (aucun appel IA) :
// affichée sur la page séance et transmise à l'IA pour adapter la suite.

export interface PlannedSession {
  discipline: string
  session_type: string
  duration_min: number
  target_values: Record<string, unknown> | null
}

export interface ActualActivity {
  duration_s: number | null
  distance_m: number | null
  avg_hr: number | null
  avg_speed_ms: number | null
  elevation_gain_m: number | null
  avg_watts: number | null
}

/** ok = conforme ; over = au-dessus (trop long, trop intense, trop rapide) ; under = en dessous. */
export type Verdict = 'ok' | 'over' | 'under'

export interface ComparisonRow {
  key: 'duration' | 'distance' | 'hr' | 'pace' | 'watts' | 'elevation'
  label: string
  planned: string | null
  actual: string
  verdict: Verdict | null
  note?: string
}

/** Séances à allure constante : la moyenne de l'activité reflète bien l'intensité. */
const STEADY_TYPES = new Set(['easy', 'long', 'recovery'])
const DURATION_TOLERANCE = 0.15
const ELEVATION_TOLERANCE = 0.2
const HR_MARGIN_BPM = 3
const RUN_PACE_MARGIN_S = 5
const SWIM_PACE_MARGIN_S = 3
const WATTS_MARGIN = 0.05
/** Au-delà, une course est vallonnée : l'allure moyenne ne veut plus rien dire. */
const HILLY_M_PER_KM = 15

function range(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length < 2) return null
  const [a, b] = v
  return typeof a === 'number' && typeof b === 'number' ? [Math.min(a, b), Math.max(a, b)] : null
}

/** "5:10-5:45" ou "5:10" → secondes [rapide, lent]. */
export function parsePaceRange(v: unknown): [number, number] | null {
  if (typeof v !== 'string') return null
  const parts = v.match(/\d{1,2}:\d{2}/g)
  if (!parts?.length) return null
  const secs = parts.map((p) => {
    const [m, s] = p.split(':').map(Number)
    return m * 60 + s
  })
  return [Math.min(...secs), Math.max(...secs)]
}

export function fmtPaceSec(sec: number): string {
  const r = Math.round(sec)
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

function ratioVerdict(actual: number, planned: number, tolerance: number): Verdict {
  if (actual > planned * (1 + tolerance)) return 'over'
  if (actual < planned * (1 - tolerance)) return 'under'
  return 'ok'
}

/** Verdict d'intensité : en séance facile, seul le dépassement compte. */
function intensityVerdict(
  actual: number,
  [lo, hi]: [number, number],
  margin: number,
  easy: boolean,
): Verdict {
  if (actual > hi + margin) return 'over'
  if (!easy && actual < lo - margin) return 'under'
  return 'ok'
}

export function compareSession(planned: PlannedSession, actual: ActualActivity): ComparisonRow[] {
  const rows: ComparisonRow[] = []
  const tv = planned.target_values ?? {}
  const steady = STEADY_TYPES.has(planned.session_type)
  const intervalNote = steady
    ? undefined
    : "Séance à intensités variables : la moyenne inclut échauffement et récupérations, elle n'est pas comparable à la cible."

  if (actual.duration_s) {
    const min = actual.duration_s / 60
    rows.push({
      key: 'duration',
      label: 'Durée',
      planned: fmtMin(planned.duration_min),
      actual: fmtMin(min),
      verdict: planned.duration_min ? ratioVerdict(min, planned.duration_min, DURATION_TOLERANCE) : null,
    })
  }

  if (actual.distance_m) {
    rows.push({
      key: 'distance',
      label: 'Distance',
      planned: null,
      actual:
        planned.discipline === 'swim'
          ? `${Math.round(actual.distance_m)} m`
          : `${(actual.distance_m / 1000).toFixed(1).replace('.', ',')} km`,
      verdict: null,
    })
  }

  const plannedGain = typeof tv.elevation_gain_m === 'number' ? tv.elevation_gain_m : null
  const actualGain = actual.elevation_gain_m != null ? Math.round(actual.elevation_gain_m) : null
  if (plannedGain || (actualGain && planned.discipline !== 'swim')) {
    rows.push({
      key: 'elevation',
      label: 'D+',
      planned: plannedGain ? `${plannedGain} m` : null,
      actual: `${actualGain ?? 0} m`,
      verdict: plannedGain ? ratioVerdict(actualGain ?? 0, plannedGain, ELEVATION_TOLERANCE) : null,
    })
  }

  const hr = range(tv.hr)
  if (actual.avg_hr) {
    rows.push({
      key: 'hr',
      label: 'FC moyenne',
      planned: hr ? `${hr[0]}-${hr[1]} bpm` : null,
      actual: `${Math.round(actual.avg_hr)} bpm`,
      verdict: hr && steady ? intensityVerdict(actual.avg_hr, hr, HR_MARGIN_BPM, true) : null,
      note: hr ? intervalNote : undefined,
    })
  }

  const watts = range(tv.watts)
  if (actual.avg_watts && planned.discipline === 'bike') {
    rows.push({
      key: 'watts',
      label: 'Puissance moyenne',
      planned: watts ? `${watts[0]}-${watts[1]} W` : null,
      actual: `${Math.round(actual.avg_watts)} W`,
      verdict:
        watts && steady
          ? intensityVerdict(actual.avg_watts, watts, watts[1] * WATTS_MARGIN, true)
          : null,
      note: watts ? intervalNote : undefined,
    })
  }

  if (actual.avg_speed_ms && actual.avg_speed_ms > 0) {
    if (planned.discipline === 'run') {
      const secPerKm = 1000 / actual.avg_speed_ms
      const target = parsePaceRange(tv.pace_per_km ?? tv.pace)
      const km = (actual.distance_m ?? 0) / 1000
      const hilly =
        (plannedGain ?? 0) > 0 || (km > 0 && (actualGain ?? 0) / km > HILLY_M_PER_KM)
      // Allure plus rapide = moins de secondes : on compare des « vitesses » inversées.
      const verdict =
        target && steady && !hilly
          ? secPerKm < target[0] - RUN_PACE_MARGIN_S
            ? 'over'
            : 'ok'
          : null
      rows.push({
        key: 'pace',
        label: 'Allure moyenne',
        planned: target ? `${fmtPaceSec(target[0])}-${fmtPaceSec(target[1])}/km` : null,
        actual: `${fmtPaceSec(secPerKm)}/km`,
        verdict,
        note:
          target && hilly
            ? "Parcours vallonné : l'allure moyenne n'est pas comparable, fie-toi à la FC."
            : target
              ? intervalNote
              : undefined,
      })
    } else if (planned.discipline === 'swim') {
      const secPer100 = 100 / actual.avg_speed_ms
      const target = parsePaceRange(tv.pace_per_100m)
      rows.push({
        key: 'pace',
        label: 'Allure moyenne',
        planned: target ? `${fmtPaceSec(target[0])}-${fmtPaceSec(target[1])}/100 m` : null,
        actual: `${fmtPaceSec(secPer100)}/100 m`,
        verdict:
          target && steady ? (secPer100 < target[0] - SWIM_PACE_MARGIN_S ? 'over' : 'ok') : null,
        note: target ? intervalNote : undefined,
      })
    } else if (planned.discipline === 'bike') {
      rows.push({
        key: 'pace',
        label: 'Vitesse moyenne',
        planned: null,
        actual: `${(actual.avg_speed_ms * 3.6).toFixed(1).replace('.', ',')} km/h`,
        verdict: null,
      })
    }
  }

  return rows
}

const VERDICT_WORD: Record<ComparisonRow['key'], Partial<Record<Verdict, string>>> = {
  duration: { over: 'plus long', under: 'écourtée' },
  distance: {},
  hr: { over: 'trop intense' },
  pace: { over: 'trop rapide' },
  watts: { over: 'trop intense' },
  elevation: { over: 'plus de D+', under: 'moins de D+' },
}

/** Résumé compact pour l'IA : « Durée 62 min/60 min ✓ | FC 152 bpm (cible 136-150 bpm) ↑ trop intense ». */
export function summarizeComparison(rows: ComparisonRow[]): string {
  return rows
    .filter((r) => r.key !== 'distance' || rows.length === 1)
    .map((r) => {
      const planned = r.planned ? ` (prévu ${r.planned})` : ''
      const mark =
        r.verdict === 'ok'
          ? ' ✓'
          : r.verdict
            ? ` ${r.verdict === 'over' ? '↑' : '↓'} ${VERDICT_WORD[r.key][r.verdict] ?? ''}`.trimEnd()
            : ''
      return `${r.label} ${r.actual}${planned}${mark}`
    })
    .join(' | ')
}

// ─── Tendances d'exécution (plusieurs semaines) ────────────────────────────────

export interface ExecutedSession {
  session_type: string
  status: string
  expected_rpe: number | null
  actual_rpe: number | null
  rows: ComparisonRow[]
}

const TREND_MIN_SESSIONS = 2
const TREND_SHARE = 0.4
const RPE_GAP = 2

/**
 * Tendances utiles à l'IA pour adapter la suite, à partir des séances récentes :
 * footings trop intenses, séances écourtées ou sautées, ressenti plus dur que
 * prévu, D+ réalisé. Liste vide si rien de notable.
 */
export function executionTrends(sessions: ExecutedSession[]): string[] {
  const trends: string[] = []
  const due = sessions.filter((s) => s.status !== 'planned')
  if (!due.length) return trends

  const skipped = due.filter((s) => s.status === 'skipped').length
  if (skipped >= TREND_MIN_SESSIONS && skipped / due.length >= 0.25) {
    trends.push(
      `${skipped} séances sautées sur ${due.length} : le volume prévu semble trop élevé ou mal placé, ne pas augmenter la charge et privilégier les séances clés.`,
    )
  }

  const done = due.filter((s) => s.status !== 'skipped')
  const easy = done.filter((s) => STEADY_TYPES.has(s.session_type))
  const easyJudged = easy.filter((s) => s.rows.some((r) => (r.key === 'hr' || r.key === 'pace') && r.verdict))
  const easyTooHard = easyJudged.filter((s) =>
    s.rows.some((r) => (r.key === 'hr' || r.key === 'pace' || r.key === 'watts') && r.verdict === 'over'),
  ).length
  if (easyTooHard >= TREND_MIN_SESSIONS && easyTooHard / easyJudged.length >= TREND_SHARE) {
    trends.push(
      `Séances faciles souvent trop intenses (${easyTooHard}/${easyJudged.length}) : rappeler dans coaching_note de ralentir (FC et allure plafond), l'endurance doit rester facile.`,
    )
  }

  const durations = done.filter((s) => s.rows.some((r) => r.key === 'duration' && r.verdict))
  const shortened = durations.filter((s) =>
    s.rows.some((r) => r.key === 'duration' && r.verdict === 'under'),
  ).length
  if (shortened >= TREND_MIN_SESSIONS && shortened / durations.length >= TREND_SHARE) {
    trends.push(
      `Séances souvent écourtées (${shortened}/${durations.length}) : durées plus réalistes, pas de hausse de volume tant que ce n'est pas résorbé.`,
    )
  }

  const rpeRated = done.filter((s) => s.actual_rpe && s.expected_rpe)
  const harder = rpeRated.filter((s) => s.actual_rpe! - s.expected_rpe! >= RPE_GAP).length
  if (harder >= TREND_MIN_SESSIONS && harder / rpeRated.length >= TREND_SHARE) {
    trends.push(
      `Ressenti nettement plus dur que prévu (${harder}/${rpeRated.length} séances, RPE +${RPE_GAP} ou plus) : signe de fatigue, alléger l'intensité cette semaine.`,
    )
  }

  let plannedGain = 0
  let actualGain = 0
  for (const s of done) {
    const r = s.rows.find((x) => x.key === 'elevation' && x.planned)
    if (!r) continue
    plannedGain += parseInt(r.planned!, 10) || 0
    actualGain += parseInt(r.actual, 10) || 0
  }
  if (plannedGain > 0) {
    const pct = Math.round((actualGain / plannedGain) * 100)
    trends.push(
      `D+ réalisé : ${actualGain} m sur ${plannedGain} m prévus (${pct} %)${pct < 75 ? ' : relief probablement insuffisant, proposer des alternatives (côtes répétées sur une même bosse, tapis incliné, escaliers) plutôt que d\'augmenter la cible' : ''}.`,
    )
  }
  return trends
}
