export interface SessionForAdherence {
  id: string
  session_date: string // YYYY-MM-DD
  session_type: string // 'rest' sessions are excluded from counts
  duration_min: number
  status: 'planned' | 'done' | 'skipped' | 'modified'
  actual_duration_min: number | null
  target_zone: string | null // 'Z1'–'Z5' — used as fallback for intensity distribution
  garmin_activity_id: string | null
}

export interface LinkedActivity {
  id: string
  avg_hr: number | null
  duration_s: number | null
}

/** [min, max] bpm per zone — computed by Karvonen or LTHR method from zones.ts */
export type FcZones = Partial<Record<'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5', [number, number]>>

export interface AdherenceResult {
  weekInProgress: boolean
  sessionsTotal: number
  sessionsDue: number
  sessionsUpcoming: number
  sessionsCompleted: number
  sessionsSkipped: number
  /** 0–100, based on due sessions only (excludes future sessions so in-progress weeks are not penalised) */
  completionRate: number
  plannedDurationMin: number
  actualDurationMin: number
  /** Positive = over plan, negative = under plan */
  volumeDeltaPct: number
  /** Zone → % of total tracked time */
  intensityDistribution: Partial<Record<'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5', number>>
  rule8020: { easyPct: number; hardPct: number; compliant: boolean } | null
  cumulativeProgress: {
    totalCompleted: number
    totalPlanned: number
    weeksElapsed: number
    weeksTotal: number
    overallRate: number
  }
}

/**
 * Compute adherence metrics for a single week.
 *
 * Only sessions whose scheduled_date <= today count as "due".
 * Future sessions are excluded so an in-progress week is not penalised.
 *
 * Intensity distribution is estimated from:
 *   1. avg_hr of linked Garmin activity mapped against fcZones (when available)
 *   2. target_zone of the planned session as a fallback
 */
export function computeWeeklyAdherence(
  sessions: SessionForAdherence[],
  linkedActivities: Record<string, LinkedActivity>,
  weekNumber: number,
  allSessions: SessionForAdherence[],
  programDurationWeeks: number,
  fcZones?: FcZones,
  today?: Date,
): AdherenceResult {
  const todayStr = (today ?? new Date()).toISOString().split('T')[0]

  const active = sessions.filter((s) => s.session_type !== 'rest')
  const due = active.filter((s) => s.session_date <= todayStr)
  const upcoming = active.filter((s) => s.session_date > todayStr)

  const completed = due.filter((s) => s.status === 'done' || s.status === 'modified')
  const skipped = due.filter((s) => s.status === 'skipped')

  const completionRate = due.length > 0 ? Math.round((completed.length / due.length) * 100) : 100

  // ── Volume ──────────────────────────────────────────────────────────────────
  const plannedDurationMin = due.reduce((acc, s) => acc + s.duration_min, 0)
  let actualDurationMin = 0
  for (const s of completed) {
    const act = s.garmin_activity_id ? linkedActivities[s.garmin_activity_id] : null
    if (act?.duration_s) {
      actualDurationMin += act.duration_s / 60
    } else {
      actualDurationMin += s.actual_duration_min ?? s.duration_min
    }
  }

  const volumeDeltaPct =
    plannedDurationMin > 0
      ? Math.round(((actualDurationMin - plannedDurationMin) / plannedDurationMin) * 100)
      : 0

  // ── Intensity distribution ───────────────────────────────────────────────────
  const zoneTotals: Record<string, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 }
  let totalZoneTime = 0

  for (const s of completed) {
    const durationMin = s.actual_duration_min ?? s.duration_min
    const act = s.garmin_activity_id ? linkedActivities[s.garmin_activity_id] : null

    let zone: string | null = null

    if (act?.avg_hr && fcZones) {
      zone = estimateZoneFromHr(act.avg_hr, fcZones)
    }
    if (!zone && s.target_zone && s.target_zone in zoneTotals) {
      zone = s.target_zone
    }

    if (zone) {
      zoneTotals[zone] = (zoneTotals[zone] ?? 0) + durationMin
      totalZoneTime += durationMin
    }
  }

  const intensityDistribution: Partial<Record<'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5', number>> = {}
  if (totalZoneTime > 0) {
    for (const [z, time] of Object.entries(zoneTotals)) {
      if (time > 0) {
        intensityDistribution[z as 'Z1'] = Math.round((time / totalZoneTime) * 1000) / 10
      }
    }
  }

  // ── 80/20 compliance ─────────────────────────────────────────────────────────
  let rule8020: AdherenceResult['rule8020'] = null
  if (totalZoneTime > 0) {
    const easyPct = Math.round(((zoneTotals.Z1 + zoneTotals.Z2) / totalZoneTime) * 1000) / 10
    const hardPct = Math.round(((zoneTotals.Z4 + zoneTotals.Z5) / totalZoneTime) * 1000) / 10
    rule8020 = { easyPct, hardPct, compliant: easyPct >= 75 }
  }

  // ── Cumulative progress ───────────────────────────────────────────────────────
  const allActive = allSessions.filter((s) => s.session_type !== 'rest')
  const allCompleted = allActive.filter((s) => s.status === 'done' || s.status === 'modified')
  const overallRate =
    allActive.length > 0 ? Math.round((allCompleted.length / allActive.length) * 100) : 0

  return {
    weekInProgress: upcoming.length > 0,
    sessionsTotal: active.length,
    sessionsDue: due.length,
    sessionsUpcoming: upcoming.length,
    sessionsCompleted: completed.length,
    sessionsSkipped: skipped.length,
    completionRate,
    plannedDurationMin: Math.round(plannedDurationMin),
    actualDurationMin: Math.round(actualDurationMin),
    volumeDeltaPct,
    intensityDistribution,
    rule8020,
    cumulativeProgress: {
      totalCompleted: allCompleted.length,
      totalPlanned: allActive.length,
      weeksElapsed: weekNumber,
      weeksTotal: programDurationWeeks,
      overallRate,
    },
  }
}

function estimateZoneFromHr(avgHr: number, fcZones: FcZones): string | null {
  for (const [z, bounds] of Object.entries(fcZones)) {
    if (bounds && avgHr >= bounds[0] && avgHr <= bounds[1]) return z
  }
  return null
}

/** Format adherence result as a concise text block for injection into AI prompts. */
export function formatAdherenceForPrompt(a: AdherenceResult): string {
  const lines: string[] = []

  lines.push('Suivi hebdomadaire :')
  const progressStr = a.weekInProgress ? ' (semaine en cours)' : ''
  lines.push(
    `  Séances réalisées : ${a.sessionsCompleted}/${a.sessionsDue} (${a.completionRate}%)${progressStr}`,
  )
  if (a.sessionsSkipped > 0) lines.push(`  Séances sautées : ${a.sessionsSkipped}`)

  lines.push(
    `Volume : prévu ${a.plannedDurationMin} min — réel ${a.actualDurationMin} min (${a.volumeDeltaPct > 0 ? '+' : ''}${a.volumeDeltaPct}%)`,
  )

  const zones = Object.entries(a.intensityDistribution)
  if (zones.length > 0) {
    lines.push("Distribution d'intensité réelle :")
    for (const [z, pct] of zones) lines.push(`  ${z} : ${pct}%`)
    if (a.rule8020) {
      const { easyPct, hardPct, compliant } = a.rule8020
      lines.push(
        `  Règle 80/20 : ${easyPct}% facile / ${hardPct}% dur — ${compliant ? '✓ conforme' : "⚠ trop d'intensité en zone médiane"}`,
      )
    }
  }

  const c = a.cumulativeProgress
  lines.push(
    `Progression globale : ${c.totalCompleted}/${c.totalPlanned} séances sur ${c.weeksElapsed}/${c.weeksTotal} semaines (${c.overallRate}%)`,
  )

  return lines.join('\n')
}

/**
 * Build an FcZones map from an athlete's running HR zone rows.
 * Extracts the [min, max] tuple from ZoneRow objects returned by calculateZones().
 */
export function buildFcZonesFromRows(
  zoneRows: Array<{ label: string; hr_min?: number; hr_max?: number }>,
): FcZones {
  const result: FcZones = {}
  const ZONE_KEYS: Array<'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'> = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
  ZONE_KEYS.forEach((key, i) => {
    const row = zoneRows[i]
    if (row?.hr_min != null && row?.hr_max != null) {
      result[key] = [row.hr_min, row.hr_max]
    }
  })
  return result
}
