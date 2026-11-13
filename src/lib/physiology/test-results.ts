import { z } from 'zod'
import { deriveVmaKmh } from '@/lib/utils/performance'

// Résultats des tests de terrain planifiés par le programme (TEST-RUN-30,
// TEST-FTP-20, TEST-CSS) → valeurs à enregistrer dans le profil physiologique.

export const TestResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('run'),
    /** Distance parcourue pendant les 30 min à fond (m). */
    distance_m: z.number().int().min(3000).max(12000),
    /** FC moyenne des 20 dernières minutes (bpm). */
    avg_hr: z.number().int().min(100).max(220).nullable().optional(),
  }),
  z.object({
    kind: z.literal('bike'),
    /** Puissance moyenne des 20 min à fond (W). */
    avg_power_20min: z.number().int().min(60).max(650),
  }),
  z.object({
    kind: z.literal('swim'),
    t400_s: z.number().int().min(180).max(1200),
    t200_s: z.number().int().min(90).max(600),
  }),
])

export type TestResult = z.infer<typeof TestResultSchema>

const RUN_TEST_S = 30 * 60
/** FTP = 95 % de la puissance moyenne sur 20 min (Allen & Coggan). */
const FTP_FROM_20MIN = 0.95

export interface TestOutcome {
  /** Colonnes physiology à écrire. */
  values: Record<string, number>
  /** Colonnes mesurées (non recalculées depuis les records ensuite). */
  measured: string[]
  /** Lignes lisibles à montrer à l'athlète. */
  summary: string[]
}

function fmtPace(sec: number): string {
  const r = Math.round(sec)
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`
}

export function computeTestOutcome(t: TestResult): TestOutcome {
  if (t.kind === 'run') {
    // Friel : allure moyenne du test de 30 min = allure seuil ; FC des 20 dernières min = FC seuil.
    const pace = Math.round(RUN_TEST_S / (t.distance_m / 1000))
    const vma = deriveVmaKmh(pace)
    const values: Record<string, number> = { run_threshold_pace_sec_per_km: pace }
    const measured = ['run_threshold_pace_sec_per_km']
    const summary = [`Allure seuil : ${fmtPace(pace)}/km`]
    if (vma) {
      values.vma_kmh = vma
      measured.push('vma_kmh')
      summary.push(`VMA estimée : ${vma.toFixed(1).replace('.', ',')} km/h`)
    }
    if (t.avg_hr) {
      values.hr_threshold_run = t.avg_hr
      measured.push('hr_threshold_run')
      summary.push(`FC seuil course : ${t.avg_hr} bpm`)
    }
    return { values, measured, summary }
  }
  if (t.kind === 'bike') {
    const ftp = Math.round(t.avg_power_20min * FTP_FROM_20MIN)
    return { values: { ftp_watts: ftp }, measured: ['ftp_watts'], summary: [`FTP : ${ftp} W`] }
  }
  // Natation : les chronos 400/200 sont des records ; la CSS en découle.
  if (t.t400_s <= t.t200_s * 1.6) {
    throw new Error('Le 400 m doit être nettement plus long que le 200 m : vérifie les chronos.')
  }
  const css = Math.round((t.t400_s - t.t200_s) / 2)
  return {
    values: { swim_400m_time_s: t.t400_s, swim_200m_time_s: t.t200_s, css_pace_sec_per_100m: css },
    measured: [],
    summary: [`CSS : ${fmtPace(css)}/100 m`],
  }
}

/** Type de test selon la discipline de la séance. */
export function testKindFor(discipline: string): TestResult['kind'] | null {
  return discipline === 'run' || discipline === 'bike' || discipline === 'swim' ? discipline : null
}
