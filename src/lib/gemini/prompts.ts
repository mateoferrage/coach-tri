import {
  KNOWLEDGE_BASE_CORE,
  KNOWLEDGE_BASE_MICRO,
  KNOWLEDGE_BASE_CHAT,
  KNOWLEDGE_BASE_TRAIL,
} from '@/lib/coach/knowledge'
import { currentWeekNum } from '@/lib/plan/replan-weeknum'
import { PHASE_VALUES } from '@/lib/plan/phases'
import type { StravaActivityCompact, StravaStatsCompact } from '@/lib/strava/client'

// ─── Equipment ─────────────────────────────────────────────────────────────────

export interface EquipmentData {
  swim?: {
    paddles?: boolean
    fins?: boolean
    pull_buoy?: boolean
    kickboard?: boolean
    snorkel?: boolean
  }
  bike?: {
    aero_bars?: boolean
  }
  run?: {
    shoes?: Array<{
      name: string
      usage: 'footing' | 'dynamic' | 'competition'
      surface: 'road' | 'trail'
    }>
  }
}

const EQUIPMENT_USAGE_FR: Record<string, string> = {
  footing: 'footing',
  dynamic: 'dynamique',
  competition: 'compétition',
}
const EQUIPMENT_SURFACE_FR: Record<string, string> = { road: 'route', trail: 'trail' }

export function buildEquipmentBlock(eq: EquipmentData): string {
  const lines: string[] = ['MATÉRIEL DISPONIBLE :']

  const swim = eq.swim
  if (swim && Object.values(swim).some((v) => v !== undefined)) {
    const items = [
      `plaquettes mains ${swim.paddles ? '✓' : '✗'}`,
      `palmes ${swim.fins ? '✓' : '✗'}`,
      `pullbuoy ${swim.pull_buoy ? '✓' : '✗'}`,
      `planche ${swim.kickboard ? '✓' : '✗'}`,
      `tuba frontal ${swim.snorkel ? '✓' : '✗'}`,
    ]
    lines.push(`Natation : ${items.join(', ')}`)
  }

  const bike = eq.bike
  if (bike && bike.aero_bars !== undefined) {
    lines.push(`Vélo : prolongateurs ${bike.aero_bars ? '✓' : '✗'}`)
  }

  const shoes = eq.run?.shoes
  if (shoes?.length) {
    lines.push('Course :')
    for (const s of shoes) {
      lines.push(
        `  - ${s.name} (${EQUIPMENT_USAGE_FR[s.usage] ?? s.usage} · ${EQUIPMENT_SURFACE_FR[s.surface] ?? s.surface})`,
      )
    }
  }

  return lines.join('\n')
}

// ─── System prompt ─────────────────────────────────────────────────────────────

export const TRIATHLON_COACH_SYSTEM = `
Tu es un coach expert certifié en triathlon ET en course à pied / trail / ultra, spécialisé dans la préparation des athlètes de tous niveaux (débutant à élite). Tu maîtrises aussi bien l'équilibre des trois disciplines du triathlon que la préparation spécifique au dénivelé (D+ et D-), à la technicité du terrain et aux formats ultra.

## Principes de périodisation triathlon

**Cycle de progression** : 3 semaines de charge progressive + 1 semaine de récupération (volume réduit de 30-40%).

**Phases et objectifs** :
- PREP (optionnel, si > 20 semaines) : adaptation progressive, travail technique, volume faible
- BASE : développement aérobie, 75-85% vol. en Z1-Z2, renforcement foncier
- BUILD : introduction intensité, 60-70% endurance + 20-30% intensité seuil/VO2
- PEAK : haute intensité, séances spécifiques course, volume légèrement réduit
- TAPER : réduction volume 40-60%, maintien intensité, préparer la fraîcheur

**Équilibre disciplinaire** (objectif triathlon uniquement, ajustable selon profil ; n'entraîne jamais une discipline qui n'est pas au programme de l'athlète) :
- Natation : 25-30% du volume total
- Vélo : 35-40% du volume total
- Course à pied : 30-35% du volume total

**Règles de récupération** :
- Ne jamais augmenter la charge de plus de 10% par semaine
- Au moins 1 jour de repos complet par semaine
- Ne pas planifier 2 séances longues consécutives
- Respecter 48h de récupération après une séance d'intervalles

**Structure d'une séance qualitative** :
1. Échauffement progressif (15-25 min selon la durée totale)
2. Bloc principal avec objectif précis et mesurable
3. Retour au calme (10-15 min)

**Types de séances par discipline** :
- Natation : technique, endurance, éducatifs, vitesse, CSS, seuil
- Vélo : SFR, endurance, tempo, FTP, VO2max, sprint, sortie longue
- Course : foulée, endurance, progression, allure seuil, VMA, fractionné
- Course (trail/ultra) : côtes, descente technique, rando-course, sortie longue avec D+, allure spécifique trail

Réponds toujours en JSON valide et uniquement en JSON. Pas de texte en dehors du JSON.

---

## BASE DE CONNAISSANCES SCIENTIFIQUE

${KNOWLEDGE_BASE_CORE}
`.trim()

// ─── Macro generation ──────────────────────────────────────────────────────────

export interface PerformanceData {
  run_5k_time_s: number | null
  run_10k_time_s: number | null
  run_half_time_s: number | null
  swim_100m_time_s: number | null
  swim_200m_time_s: number | null
  swim_400m_time_s: number | null
  swim_800m_time_s: number | null
  ftp_watts: number | null
  hr_max: number | null
  resting_hr: number | null
  vma_kmh: number | null
  run_threshold_pace_sec_per_km: number | null
  css_pace_sec_per_100m: number | null
}

function fmtDuration(sec: number | null): string | null {
  if (!sec) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Bloc "PERFORMANCES DE RÉFÉRENCE" : records saisis + seuils dérivés. */
export function buildPerformanceBlock(p: PerformanceData): string {
  const run = [
    p.run_5k_time_s && `5 km ${fmtDuration(p.run_5k_time_s)}`,
    p.run_10k_time_s && `10 km ${fmtDuration(p.run_10k_time_s)}`,
    p.run_half_time_s && `semi ${fmtDuration(p.run_half_time_s)}`,
  ].filter(Boolean)
  const swim = [
    p.swim_100m_time_s && `100m ${fmtDuration(p.swim_100m_time_s)}`,
    p.swim_200m_time_s && `200m ${fmtDuration(p.swim_200m_time_s)}`,
    p.swim_400m_time_s && `400m ${fmtDuration(p.swim_400m_time_s)}`,
    p.swim_800m_time_s && `800m ${fmtDuration(p.swim_800m_time_s)}`,
  ].filter(Boolean)

  const runDerived = [
    p.run_threshold_pace_sec_per_km &&
      `allure seuil ${fmtDuration(p.run_threshold_pace_sec_per_km)}/km`,
    p.vma_kmh && `VMA ${p.vma_kmh.toFixed(1)} km/h`,
  ].filter(Boolean)
  const swimDerived = p.css_pace_sec_per_100m
    ? [`CSS ${fmtDuration(p.css_pace_sec_per_100m)}/100m`]
    : []

  // Records et seuils sont indépendants : un seuil connu sans record reste utile.
  const perfLine = (label: string, records: unknown[], derived: unknown[]) => {
    const parts = [
      records.length ? `records ${records.join(', ')}` : '',
      derived.length ? `${derived.join(', ')} (estimés)` : '',
    ].filter(Boolean)
    return parts.length ? `- ${label} : ${parts.join(' → ')}` : null
  }

  const lines: string[] = []
  const runLine = perfLine('Course', run, runDerived)
  if (runLine) lines.push(runLine)
  if (p.ftp_watts) lines.push(`- Vélo : FTP ${p.ftp_watts} W`)
  const swimLine = perfLine('Natation', swim, swimDerived)
  if (swimLine) lines.push(swimLine)
  const hr = [
    p.hr_max && `FC max ${p.hr_max} bpm`,
    p.resting_hr && `FC repos ${p.resting_hr} bpm`,
  ].filter(Boolean)
  if (hr.length) lines.push(`- Cardio : ${hr.join(', ')}`)

  if (lines.length === 0) return ''
  return `PERFORMANCES DE RÉFÉRENCE (niveau actuel de l'athlète) :\n${lines.join('\n')}`
}

export interface GoalContext {
  role: 'primary' | 'secondary'
  sport: 'triathlon' | 'running'
  race_name: string
  race_type: string
  race_date: string
  swim_distance_m?: number | null
  bike_distance_m?: number | null
  run_distance_m?: number | null
  elevation_gain_m?: number | null
  elevation_loss_m?: number | null
  bike_elevation_m?: number | null
  surface?: string | null
  terrain?: string | null
  max_altitude_m?: number | null
  cutoff_time_s?: number | null
  estimated_finish_time_s?: number | null
  target_type?: string | null
  target_time_seconds?: number | null
  swim_target_time_s?: number | null
  t1_target_time_s?: number | null
  bike_target_time_s?: number | null
  t2_target_time_s?: number | null
  run_target_time_s?: number | null
}

function fmtHms(sec?: number | null): string {
  if (sec == null) return '?'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

const SURFACE_FR: Record<string, string> = {
  road: 'route',
  gravel: 'chemin roulant',
  technical: 'sentier technique',
  mountain: 'montagne',
}

/** Ambition de l'athlète sur la course (terminer, chrono, podium). */
function describeTarget(g: GoalContext): string | null {
  const splits = [
    g.swim_target_time_s && `natation ${fmtDuration(g.swim_target_time_s)}`,
    g.t1_target_time_s && `T1 ${fmtDuration(g.t1_target_time_s)}`,
    g.bike_target_time_s && `vélo ${fmtDuration(g.bike_target_time_s)}`,
    g.t2_target_time_s && `T2 ${fmtDuration(g.t2_target_time_s)}`,
    g.run_target_time_s && `course ${fmtDuration(g.run_target_time_s)}`,
  ].filter(Boolean)
  const detail = splits.length ? ` (${splits.join(', ')})` : ''
  if (g.target_type === 'podium') return `Ambition : viser le podium${detail}`
  if (g.target_type === 'time' || g.target_time_seconds) {
    return `Ambition : temps visé ${fmtDuration(g.target_time_seconds ?? null) ?? 'non précisé'}${detail}`
  }
  return g.target_type === 'finish' ? 'Ambition : terminer la course' : null
}

/** Décrit une course (tri ou running/trail) pour les prompts macro et micro. */
function describeGoal(g: GoalContext, planStartDate?: string): string {
  const roleFr =
    g.role === 'primary'
      ? 'Course principale — OBJECTIF PRINCIPAL (pic de forme)'
      : 'Course secondaire — objectif intermédiaire'
  const weekFr = planStartDate ? `, semaine ${currentWeekNum(planStartDate, g.race_date)}` : ''
  const lines = [`${roleFr} — ${g.race_name} (${g.race_type}, ${g.race_date}${weekFr})`]
  if (g.sport === 'running') {
    lines.push(
      `  Course à pied : ${g.run_distance_m ?? '?'}m, D+ ${g.elevation_gain_m ?? '?'}m, D- ${g.elevation_loss_m ?? '?'}m`,
    )
    const detail = [
      g.surface && `technicité ${SURFACE_FR[g.surface] ?? g.surface}`,
      g.terrain && `profil ${g.terrain}`,
      g.max_altitude_m != null && `altitude max ${g.max_altitude_m}m`,
      g.cutoff_time_s != null && `barrière horaire ${fmtHms(g.cutoff_time_s)}`,
      g.estimated_finish_time_s != null && `temps estimé ${fmtHms(g.estimated_finish_time_s)}`,
    ].filter(Boolean)
    if (detail.length) lines.push(`  ${detail.join(', ')}`)
  } else {
    lines.push(
      `  Triathlon : ${g.swim_distance_m ?? '?'}m nage / ${g.bike_distance_m ?? '?'}m vélo / ${g.run_distance_m ?? '?'}m course${g.terrain ? ` (terrain ${g.terrain})` : ''}`,
    )
    const elevation = [
      g.bike_elevation_m != null && `D+ vélo ${g.bike_elevation_m}m`,
      g.elevation_gain_m != null && `D+ course ${g.elevation_gain_m}m`,
    ].filter(Boolean)
    if (elevation.length) lines.push(`  ${elevation.join(', ')}`)
  }
  const target = describeTarget(g)
  if (target) lines.push(`  ${target}`)
  return lines.join('\n')
}

function sortGoals(goals: GoalContext[]): GoalContext[] {
  return goals
    .slice()
    .sort((a, b) => (a.role === 'primary' ? 0 : 1) - (b.role === 'primary' ? 0 : 1))
}

// ─── Athlete details ───────────────────────────────────────────────────────────

/** À partir de cet âge : cycle de 3 semaines (voir « Masters » dans la base). */
const MASTERS_AGE = 45

export interface AthleteDetails {
  birth_date?: string | null
  sex?: string | null
  weight_kg?: number | null
  height_cm?: number | null
  experience_years?: number | null
  notes?: string | null
}

export function ageAt(birthDate: string | null | undefined, onDate: string): number | null {
  if (!birthDate) return null
  const years = Number(onDate.slice(0, 4)) - Number(birthDate.slice(0, 4))
  return onDate.slice(5) < birthDate.slice(5) ? years - 1 : years
}

/** Longueur du cycle charge + récupération : plus court pour un athlète Masters. */
export function recoveryCycleWeeks(age: number | null): 3 | 4 {
  return age != null && age >= MASTERS_AGE ? 3 : 4
}

const SEX_FR: Record<string, string> = { M: 'homme', F: 'femme' }

/** Lignes du profil partagées par les prompts macro et micro. */
function buildAthleteDetailLines(p: AthleteDetails, onDate: string): string[] {
  const age = ageAt(p.birth_date, onDate)
  return [
    age != null && `- Âge : ${age} ans${age >= MASTERS_AGE ? ' (Masters)' : ''}`,
    p.sex && SEX_FR[p.sex] && `- Sexe : ${SEX_FR[p.sex]}`,
    p.weight_kg && `- Poids : ${p.weight_kg} kg`,
    p.height_cm && `- Taille : ${p.height_cm} cm`,
    p.experience_years != null && `- Expérience en endurance : ${p.experience_years} an(s)`,
    p.notes?.trim() &&
      `- Blessures et contraintes (à respecter STRICTEMENT, adapter ou éviter les séances concernées) : ${p.notes.trim()}`,
  ].filter((l): l is string => !!l)
}

const METHODOLOGY_LABELS: Record<string, string> = {
  polarized: 'Polarisé (80% basse intensité / 20% haute intensité)',
  pyramidal: 'Pyramidal (70% Z1-Z2 / 20% Z3 / 10% Z4-Z5)',
  threshold: 'Seuil (focus sur la Zone 3-4)',
}

interface MacroContext {
  profile: AthleteDetails & {
    first_name: string | null
    level: string | null
    weekly_hours_avg: number | null
    available_disciplines: string[] | null
  }
  methodology: string
  start_date: string
  total_weeks: number
  goals: GoalContext[]
  /** Volume hebdomadaire actuel déclaré à la création du programme. */
  current_weekly_hours?: number | null
  /** Disciplines à entraîner (dérivées des courses ∩ profil). Si absent, on
   *  retombe sur les disciplines du profil. */
  disciplines?: string[]
  /** Disciplines complémentaires (cross-training) : entraînées en plus de
   *  l'objectif, avec progression structurée mais dégressive en peak/taper. */
  complementary_disciplines?: string[]
  performance?: PerformanceData
  recent_activity_summary?: string
  recent_wellness_summary?: string
}

export function buildMacroPrompt(ctx: MacroContext): string {
  const disciplineLabels: Record<string, string> = {
    swim: 'natation',
    bike: 'vélo',
    run: 'course à pied',
    strength: 'renforcement',
  }
  const disciplines = (
    ctx.disciplines ??
    ctx.profile.available_disciplines ?? ['swim', 'bike', 'run']
  )
    .map((d) => disciplineLabels[d] ?? d)
    .join(', ')

  const levelLabels: Record<string, string> = {
    beginner: 'Débutant',
    intermediate: 'Intermédiaire',
    advanced: 'Avancé',
    elite: 'Élite',
  }

  const performanceBlock = ctx.performance ? buildPerformanceBlock(ctx.performance) : ''

  const goalSection = `OBJECTIF(S) DE COURSE :\n${sortGoals(ctx.goals)
    .map((g) => describeGoal(g, ctx.start_date))
    .join('\n')}`

  const age = ageAt(ctx.profile.birth_date, ctx.start_date)
  const cycle = recoveryCycleWeeks(age)
  const detailLines = buildAthleteDetailLines(ctx.profile, ctx.start_date)
  const hasSecondaryGoal = ctx.goals.some((g) => g.role === 'secondary')

  const startHours = ctx.current_weekly_hours
    ? Math.min(ctx.current_weekly_hours, ctx.profile.weekly_hours_avg ?? ctx.current_weekly_hours)
    : null
  const volumeRules = startHours
    ? `- Volume de la semaine 1 = ${startHours}h (±10%), le volume actuel déclaré par l'athlète : il prime sur l'historique enregistré
- Ensuite, progression régulière vers la disponibilité hebdomadaire, sans dépasser +10 à 15% d'une semaine de charge à la suivante`
    : `- Le volume cible est la disponibilité hebdomadaire : les semaines de charge les plus hautes doivent en être proches (90-100%)
- Volume de la semaine 1 = 70% du volume cible de l'athlète (montée progressive)${ctx.recent_activity_summary ? ". L'historique peut être incomplet (séances non enregistrées) : s'il est nettement plus bas, descends jusqu'à 50% du volume cible, jamais en dessous" : ''}`

  const hasRunningGoal = ctx.goals.some((g) => g.sport === 'running')
  const trailBlock = hasRunningGoal
    ? `\n\n---\n\nSPÉCIALISATION TRAIL :\n${KNOWLEDGE_BASE_TRAIL}`
    : ''

  const complementaryBlock = ctx.complementary_disciplines?.length
    ? `\n\nDISCIPLINES COMPLÉMENTAIRES (cross-training) : ${ctx.complementary_disciplines
        .map((d) => disciplineLabels[d] ?? d)
        .join(', ')}
- À entraîner EN PLUS de l'objectif, avec une vraie progression structurée (endurance + intensité), comme un entraînement dédié — pas du simple remplissage.
- Part de volume SECONDAIRE et CROISSANTE en phases base/build (l'objectif principal reste prioritaire).
- RÉDUIRE nettement en phases peak et taper, et supprimer sur la dernière semaine, pour ne jamais compromettre les séances clés ni l'affûtage de l'objectif principal.`
    : ''

  return `
BASE DE CONNAISSANCES (méthodologies + zones de référence) :
${KNOWLEDGE_BASE_CORE}${trailBlock}

---

PROFIL ATHLÈTE :
- Prénom : ${ctx.profile.first_name ?? 'Athlète'}
- Niveau : ${levelLabels[ctx.profile.level ?? ''] ?? ctx.profile.level ?? 'Non précisé'}
- Disponibilité : ${ctx.profile.weekly_hours_avg ?? 8}h/semaine
- Disciplines : ${disciplines}
${ctx.current_weekly_hours ? `- Volume actuel déclaré : ${ctx.current_weekly_hours}h/semaine\n` : ''}${detailLines.join('\n')}

${performanceBlock ? performanceBlock + '\n' : ''}
${goalSection}${complementaryBlock}

PROGRAMME :
- Méthodologie : ${METHODOLOGY_LABELS[ctx.methodology] ?? ctx.methodology}
- Début : ${ctx.start_date}
- Durée totale : ${ctx.total_weeks} semaines

${ctx.recent_activity_summary ? `HISTORIQUE RÉCENT (activités enregistrées, peut être incomplet) :\n${ctx.recent_activity_summary}` : ''}
${ctx.recent_wellness_summary ? `\nDONNÉES BIEN-ÊTRE :\n${ctx.recent_wellness_summary}` : ''}

Génère la structure complète du programme en JSON avec ce format EXACT :

{
  "phases": [
    {
      "phase": "base",
      "start_week_num": 1,
      "end_week_num": 6,
      "focus": "Développement de la base aérobie et de l'endurance fondamentale"
    }
  ],
  "weeks": [
    {
      "week_num": 1,
      "phase": "base",
      "is_recovery_week": false,
      "planned_volume_hours": 7.5,
      "planned_tss": 280,
      "distribution": {"z1z2": 0.80, "z3": 0.10, "z4z5": 0.10},
      "notes": "Semaine d'introduction : priorité à l'endurance fondamentale"
    }
  ]
}

Règles :
- Inclure toutes les ${ctx.total_weeks} semaines (week_num de 1 à ${ctx.total_weeks}) ; la semaine ${ctx.total_weeks} est celle de la course principale
- "phase" DOIT être exactement l'une de : ${PHASE_VALUES.join(', ')} (jamais d'autre libellé ; une semaine de récupération garde la phase de son bloc)
- La somme de "distribution" vaut 1 pour chaque semaine
- Semaines de récupération toutes les ${cycle} semaines${cycle === 3 ? ' (athlète Masters : 2 semaines de charge + 1 de récupération)' : ''} (is_recovery_week: true, volume réduit de 35%)
- La disponibilité hebdomadaire est un plafond : aucune semaine ne la dépasse
${volumeRules}
- La dernière semaine (taper final) doit avoir un volume de 40-50% du pic
- planned_tss cohérent avec le volume et l'intensité (1h Z2 vélo ≈ 50 TSS, 1h run Z2 ≈ 60 TSS)
- L'ambition de chaque course (terminer, temps visé, podium) détermine la part de travail à allure spécifique en phases build et peak
${ctx.profile.level === 'beginner' ? '- Athlète débutant : aucune intensité en Z4-Z5 (z4z5 = 0), quelle que soit la méthodologie\n' : ''}${hasSecondaryGoal ? '- Course secondaire : alléger 3 à 5 jours avant et prévoir 3 à 5 jours faciles après, sans casser la progression vers la course principale\n' : ''}`.trim()
}

// ─── Micro generation (sessions detail) ────────────────────────────────────────

export interface PriorWeekSession {
  session_date: string
  discipline: string
  session_type: string
  title: string | null
  duration_min: number
  planned_tss: number | null
  target_zone: string | null
  status: string
  actual_rpe: number | null
  actual_duration_min: number | null
}

export interface PriorWeek {
  week_num: number
  phase: string
  is_recovery_week: boolean
  planned_volume_hours: number
  planned_tss: number
  sessions: PriorWeekSession[]
}

export interface PlanWeekOverview {
  week_num: number
  phase: string
  is_recovery_week: boolean
  planned_volume_hours: number
  planned_tss: number
}

interface MicroContext {
  week: {
    week_num: number
    phase: string
    is_recovery_week: boolean
    planned_volume_hours: number
    planned_tss: number
    distribution: Record<string, number>
    notes: string
  }
  profile: AthleteDetails & {
    level: string | null
    weekly_hours_avg: number | null
    available_disciplines: string[] | null
  }
  /** Dates planifiables (YYYY-MM-DD), déjà filtrées. */
  available_dates: string[]
  week_start_date: string // YYYY-MM-DD, pas forcément un lundi
  /** Courses visées par le plan. */
  goals?: GoalContext[]
  methodology?: string
  /** Disciplines effectivement entraînées (cœur de l'objectif ∪ complémentaires).
   *  Si absent, on retombe sur `profile.available_disciplines`. */
  training_disciplines?: string[]
  /** Sous-ensemble complémentaire (cross-training), dégressif en peak/taper. */
  complementary_disciplines?: string[]
  /** Séances de la semaine déjà traitées, conservées à la régénération. */
  kept_sessions?: PriorWeekSession[]
  prior_weeks?: PriorWeek[]
  plan_overview?: PlanWeekOverview[]
  athlete_zones?: string // pre-formatted zone table from calculateZones()
  recent_wellness_summary?: string
  schedule_constraints?: string
  strava_stats_block?: string
  equipment_block?: string
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const PHASE_LABELS: Record<string, string> = {
  prep: 'Préparation',
  base: 'Base',
  build: 'Construction',
  peak: 'Pic',
  taper: 'Affûtage',
  race: 'Course',
}
const DISCIPLINE_FR: Record<string, string> = {
  swim: 'Natation',
  bike: 'Vélo',
  run: 'Course',
  brick: 'Enchaînement',
  strength: 'Renforcement',
  rest: 'Repos',
}

type MicroDisciplineInput = Pick<MicroContext, 'training_disciplines' | 'profile' | 'goals'>

/** Disciplines qu'une séance peut porter : l'enchaînement est réservé au triathlon. */
export function allowedMicroDisciplines(ctx: MicroDisciplineInput): string[] {
  const training = ctx.training_disciplines ??
    ctx.profile.available_disciplines ?? ['swim', 'bike', 'run']
  const canBrick =
    training.includes('bike') &&
    training.includes('run') &&
    (!ctx.goals?.length || ctx.goals.some((g) => g.sport === 'triathlon'))
  return canBrick ? [...training, 'brick'] : training
}

/** Volume restant à planifier, une fois déduites les séances déjà réalisées. */
export function remainingVolumeHours(ctx: Pick<MicroContext, 'week' | 'kept_sessions'>): number {
  const doneMin = (ctx.kept_sessions ?? [])
    .filter((s) => s.status !== 'skipped')
    .reduce((acc, s) => acc + (s.actual_duration_min ?? s.duration_min), 0)
  return Math.max(0, Math.round((ctx.week.planned_volume_hours - doneMin / 60) * 10) / 10)
}

function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}

/** Consignes propres aux courses qui tombent dans la semaine générée. */
function buildRaceWeekLines(goals: GoalContext[], weekStart: string): string[] {
  const weekEnd = addDaysIso(weekStart, 6)
  return goals
    .filter((g) => g.race_date >= weekStart && g.race_date <= weekEnd)
    .map((g) =>
      g.role === 'primary'
        ? `- COURSE PRINCIPALE le ${g.race_date} (${g.race_name}) : aucune séance ce jour-là, fraîcheur maximale, activation courte de 20-30 min avec quelques accélérations la veille.`
        : `- Course secondaire le ${g.race_date} (${g.race_name}) : aucune séance ce jour-là, alléger les 2-3 jours avant, uniquement du facile le lendemain.`,
    )
}

export function buildMicroPrompt(ctx: MicroContext): string {
  const dist = ctx.week.distribution
  const intensityDesc = `${Math.round((dist.z1z2 ?? 0) * 100)}% Z1-Z2, ${Math.round((dist.z3 ?? 0) * 100)}% Z3, ${Math.round((dist.z4z5 ?? 0) * 100)}% Z4-Z5`

  const sessionsPerDay = ctx.available_dates
    .map((date) => `  - ${DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()]} ${date}`)
    .join('\n')
  const allowedDisciplines = allowedMicroDisciplines(ctx)
  const targetVolume = ctx.kept_sessions?.length
    ? remainingVolumeHours(ctx)
    : ctx.week.planned_volume_hours
  const goals = sortGoals(ctx.goals ?? [])
  const raceWeekLines = buildRaceWeekLines(goals, ctx.week_start_date)
  const detailLines = buildAthleteDetailLines(ctx.profile, ctx.week_start_date)

  const goalsBlock = goals.length
    ? `\nOBJECTIF(S) DE LA PRÉPARATION (chaque séance doit y préparer spécifiquement l'athlète, selon la phase) :\n${goals
        .map((g) => describeGoal(g))
        .join(
          '\n',
        )}\n${raceWeekLines.length ? `\nCETTE SEMAINE :\n${raceWeekLines.join('\n')}\n` : ''}`
    : ''
  const trailBlock = goals.some((g) => g.sport === 'running')
    ? `\n\nSPÉCIALISATION TRAIL (intégrer le travail de dénivelé, de terrain et de descente demandé par la course) :\n${KNOWLEDGE_BASE_TRAIL}`
    : ''

  const keptBlock = ctx.kept_sessions?.length
    ? `\nSÉANCES DÉJÀ TRAITÉES CETTE SEMAINE (conservées, ne pas les reprogrammer) :\n${ctx.kept_sessions
        .map(
          (s) =>
            `  - ${s.session_date} : ${DISCIPLINE_FR[s.discipline] ?? s.discipline} ${s.actual_duration_min ?? s.duration_min}min — ${s.session_type} — ${STATUS_FR[s.status] ?? s.status}`,
        )
        .join(
          '\n',
        )}\nNe planifie que le volume restant, en tenant compte de la fatigue de ces séances.\n`
    : ''

  // Bloc disciplines complémentaires : progression structurée, mais dégressive
  // en pic/affûtage pour protéger les séances clés de l'objectif.
  const isPeakOrTaper = ctx.week.phase === 'peak' || ctx.week.phase === 'taper'
  const complementaryBlock = ctx.complementary_disciplines?.length
    ? `\nDISCIPLINES COMPLÉMENTAIRES (cross-training) : ${ctx.complementary_disciplines
        .map((d) => DISCIPLINE_FR[d] ?? d)
        .join(', ')}
- Séances STRUCTURÉES et progressives (endurance + un peu d'intensité/technique), pas du simple footing/pédalage facile — l'athlète doit progresser dessus.
- Elles restent SECONDAIRES : ne jamais empiéter sur les séances clés de l'objectif principal.
- ${isPeakOrTaper ? 'Phase pic/affûtage → RÉDUIRE fortement (1 séance courte et facile max par discipline, voire aucune) pour préserver la fraîcheur sur l’objectif.' : 'Volume modéré et en progression cohérente avec les semaines précédentes.'}\n`
    : ''

  // ── Plan overview block ──────────────────────────────────────────────────────
  let planOverviewBlock = ''
  if (ctx.plan_overview?.length) {
    const lines = ctx.plan_overview.map((w) => {
      const marker =
        w.week_num < ctx.week.week_num
          ? ' ✓ déjà générée'
          : w.week_num === ctx.week.week_num
            ? ' ← SEMAINE EN COURS'
            : ''
      const label = `${w.is_recovery_week ? '[RÉCUP] ' : ''}${PHASE_LABELS[w.phase] ?? w.phase}`
      return `  Sem ${w.week_num} (${label}) : ${w.planned_volume_hours}h / ${w.planned_tss} TSS${marker}`
    })
    planOverviewBlock = `PLAN GLOBAL (${ctx.plan_overview.length} semaines) :\n${lines.join('\n')}`
  }

  // ── Prior weeks detail block ─────────────────────────────────────────────────
  let priorWeeksBlock = ''
  if (ctx.prior_weeks?.length) {
    const weekBlocks = ctx.prior_weeks.map((pw) => {
      // Une séance sautée n'a produit ni volume ni charge.
      const trained = pw.sessions.filter((s) => s.status !== 'skipped')
      const actualVolMin = trained.reduce(
        (acc, s) => acc + (s.actual_duration_min ?? s.duration_min),
        0,
      )
      const actualTSS = trained.reduce((acc, s) => acc + (s.planned_tss ?? 0), 0)
      const header = `=== SEMAINE ${pw.week_num} — ${PHASE_LABELS[pw.phase] ?? pw.phase}${pw.is_recovery_week ? ' (RÉCUP)' : ''} | Cible ${pw.planned_volume_hours}h / ${pw.planned_tss} TSS ===`
      const sessionLines = pw.sessions
        .sort((a, b) => a.session_date.localeCompare(b.session_date))
        .map((s) => {
          const dur = s.actual_duration_min ?? s.duration_min
          const rpe = s.actual_rpe ? ` | RPE réel: ${s.actual_rpe}` : ''
          const zone = s.target_zone ? ` | ${s.target_zone}` : ''
          const tss = s.planned_tss ? ` | TSS: ${s.planned_tss}` : ''
          const status = s.status === 'done' ? '✓' : s.status === 'skipped' ? '✗' : '○'
          return `  ${status} ${s.session_date} : ${DISCIPLINE_FR[s.discipline] ?? s.discipline} ${dur}min — ${s.session_type}${zone}${tss}${rpe}`
        })
        .join('\n')
      const summary = `  → Volume hors séances sautées : ${(actualVolMin / 60).toFixed(1)}h | TSS : ${actualTSS}`
      return `${header}\n${sessionLines}\n${summary}`
    })
    priorWeeksBlock = `SEMAINES PRÉCÉDEMMENT GÉNÉRÉES (contexte de progression) :\n\n${weekBlocks.join('\n\n')}`
  }

  const zonesBlock = ctx.athlete_zones
    ? `ZONES D'ENTRAÎNEMENT PERSONNALISÉES (utilise ces valeurs pour target_values) :\n${ctx.athlete_zones}`
    : ''

  const knowledgeMicroBlock = `BASE DE CONNAISSANCES (zones + bibliothèque de séances) :\n${KNOWLEDGE_BASE_MICRO}${trailBlock}`

  return `
${planOverviewBlock ? planOverviewBlock + '\n\n' : ''}${priorWeeksBlock ? priorWeeksBlock + '\n\n' : ''}${knowledgeMicroBlock}\n\n${zonesBlock ? zonesBlock + '\n\n' : ''}GÉNÉRATION — SEMAINE ${ctx.week.week_num} — Phase : ${PHASE_LABELS[ctx.week.phase] ?? ctx.week.phase}${ctx.week.is_recovery_week ? ' (SEMAINE DE RÉCUPÉRATION)' : ''}

Cibles de la semaine :
- Volume${ctx.kept_sessions?.length ? ' restant à planifier' : ''} : ${targetVolume}h
- TSS : ${ctx.week.planned_tss}
- Répartition intensité : ${intensityDesc}${ctx.methodology ? `\n- Méthodologie du plan : ${METHODOLOGY_LABELS[ctx.methodology] ?? ctx.methodology}` : ''}
- Note du coach : ${ctx.week.notes}

Profil athlète : niveau ${ctx.profile.level ?? 'intermédiaire'}, ${ctx.profile.weekly_hours_avg ?? 8}h/semaine disponibles
${detailLines.length ? detailLines.join('\n') + '\n' : ''}Disciplines au programme (aucune autre autorisée) : ${allowedDisciplines.filter((d) => d !== 'brick').join(', ')}
${goalsBlock}${complementaryBlock}${keptBlock}
Dates où l'athlète peut s'entraîner :
${sessionsPerDay}

${ctx.recent_wellness_summary ? `Bien-être récent :\n${ctx.recent_wellness_summary}\n` : ''}${ctx.strava_stats_block ? `\n${ctx.strava_stats_block}\n` : ''}${ctx.schedule_constraints ? `\nEMPLOI DU TEMPS PERSONNEL (créneaux OCCUPÉS — ne jamais placer d'entraînement dessus) :\n${ctx.schedule_constraints}\n` : ''}${ctx.equipment_block ? `\n${ctx.equipment_block}\n\nRÈGLES MATÉRIEL (STRICTES) :\n- Ne jamais prescrire un exercice nécessitant un accessoire marqué ✗\n- Si prolongateurs vélo ✓ : inclure du travail en position aéro dans au moins une séance vélo longue\n- Pour la course : recommander dans le coaching_note la chaussure adaptée (footing → chaussure footing, compétition → chaussure compétition, trail → chaussure trail)\n` : ''}
Génère TOUTES les séances de cette semaine en JSON avec ce format EXACT :

{
  "sessions": [
    {
      "session_date": "YYYY-MM-DD",
      "day_part": "morning|midday|evening",
      "discipline": "${allowedDisciplines.join('|')}",
      "session_type": "easy|tempo|threshold|vo2|race_pace|technique|long|recovery|test",
      "title": "Vélo — Endurance fondamentale",
      "duration_min": 90,
      "planned_tss": 75,
      "structure": {
        "warmup": "15 min échauffement progressif en Z1, puis 5 min en Z2",
        "main": "60 min en Z2 régulier, cadence 85-90 rpm, focus sur l'économie de pédalage",
        "cooldown": "10 min retour au calme en Z1, étirements dynamiques"
      },
      "target_values": {
        "watts": [180, 210],
        "hr": [130, 145],
        "pace_per_km": "5:10-5:45",
        "pace_per_100m": "2:00-2:10"
      },
      "target_zone": "Z2",
      "expected_rpe": 5,
      "coaching_note": "Sortie de base : garder une conversation possible tout au long. Ne pas dépasser Z2."
    }
  ]
}

Contraintes STRICTES :
- Au maximum une séance par date listée (deux seulement pour un enchaînement). Tu n'es PAS obligé d'utiliser toutes les dates : choisis le nombre de séances selon le volume, le niveau et la récupération
- Au moins 1 jour sans séance dans la semaine. Ne génère jamais de séance "rest" : un jour sans séance est un jour de repos
- Volume total des séances ≈ ${targetVolume}h, soit ${Math.round(targetVolume * 60)} min (±10%) : additionne les duration_min avant de répondre et ajuste les durées si besoin
- Respecter la répartition d'intensité : ${intensityDesc}
- ${ctx.week.is_recovery_week ? 'SEMAINE RÉCUP : séances courtes, intensité basse, aucune séance longue ou intensive' : ctx.prior_weeks?.length ? 'Assurer une progression cohérente par rapport aux semaines précédentes (types de séances, durées, intensités)' : 'Commencer progressivement, le volume indiqué tient déjà compte de la montée en charge'}
- session_date doit être exactement l'une des dates listées ci-dessus
- discipline DOIT être exactement l'une de : ${allowedDisciplines.join(', ')}
- day_part : choisis un créneau libre de la journée en tenant compte de l'emploi du temps personnel
- session_type DOIT être exactement l'une de : easy, tempo, threshold, vo2, race_pace, technique, long, recovery, test
${ctx.athlete_zones ? `- target_values DOIT utiliser les zones personnalisées fournies ci-dessus (watts pour vélo, pace_per_km pour course, pace_per_100m pour natation, hr pour toutes les disciplines)` : `- target_values : inclure "hr" quand possible, "watts" pour vélo, "pace_per_km" pour course, "pace_per_100m" pour natation`}
`.trim()
}

// ─── Chat coach ────────────────────────────────────────────────────────────────

export const COACH_CHAT_SYSTEM = `
Tu es Coach Tri, un coach triathlon IA personnel, bienveillant et expert.

BASE DE CONNAISSANCES :
${KNOWLEDGE_BASE_CHAT}

---

Tu connais le programme d'entraînement de l'athlète et tu peux proposer des ajustements si nécessaire.

RÈGLES IMPORTANTES :
1. Tu réponds TOUJOURS en JSON valide : { "message": "...", "proposedAction": null }
2. Tu parles en français, style direct et motivant, tutoiement
3. Tu NE MODIFIES JAMAIS le programme sans proposer l'action dans "proposedAction" — l'athlète confirme toujours
4. Si l'athlète mentionne un empêchement, une fatigue ou demande un ajustement → propose une action précise
5. Pour les échanges simples (conseils, questions) → "proposedAction": null

ACTIONS DISPONIBLES (dans proposedAction) :
- cancel_session  : annuler une séance (la marquer comme passée)
- move_session    : déplacer UNE séance à une autre date (sans conflit)
- swap_sessions   : échanger les dates de DEUX séances entre elles
- adjust_session  : modifier durée/intensité d'une séance
- regenerate_week : régénérer toutes les séances restantes de la semaine

FORMAT proposedAction :
{
  "type": "cancel_session",
  "description": "Annuler la séance de vélo du mercredi (empêchement)",
  "params": {
    // cancel_session  → { "session_id": "uuid" }
    // move_session    → { "session_id": "uuid", "new_date": "YYYY-MM-DD" }
    // swap_sessions   → { "session_id_a": "uuid", "session_id_b": "uuid" }
    // adjust_session  → { "session_id": "uuid", "duration_min": 45, "session_type": "recovery", "coaching_note": "..." }
    // regenerate_week → { "plan_id": "uuid", "week_num": 3 } ; ajoute "available_days": [1,3,5,6] (0=dim … 6=sam) seulement si l'athlète précise ses jours pour cette semaine
  }
}

RÈGLE SWAP : quand l'athlète veut ÉCHANGER deux séances entre elles, utilise TOUJOURS swap_sessions (pas deux move_session).

Réponds uniquement en JSON. Pas de texte en dehors du JSON.
`.trim()

interface ChatSession {
  id: string
  discipline: string
  session_type: string
  title: string | null
  duration_min: number
  session_date: string
  status: string
  expected_rpe: number | null
}

interface ChatContext {
  profile: {
    first_name: string | null
    level: string | null
    weekly_hours_avg: number | null
  } | null
  plan: {
    id: string
    name: string | null
    goal: { race_name: string; race_date: string } | null
  } | null
  currentWeekNum: number
  currentPhase: string | null
  weekSessions: ChatSession[]
  history: Array<{ role: string; content: string }>
  today: string
  stravaActivitiesBlock?: string
}

const STATUS_FR: Record<string, string> = {
  planned: 'PLANIFIÉE',
  done: 'TERMINÉE',
  skipped: 'ANNULÉE',
  modified: 'MODIFIÉE',
}

export function buildChatContext(ctx: ChatContext): string {
  const planLabel = ctx.plan?.goal?.race_name ?? ctx.plan?.name ?? "Programme d'entraînement"
  const levelLabels: Record<string, string> = {
    beginner: 'Débutant',
    intermediate: 'Intermédiaire',
    advanced: 'Avancé',
    elite: 'Élite',
  }

  const sessionsBlock = ctx.weekSessions.length
    ? ctx.weekSessions
        .map((s) => {
          const date = new Date(s.session_date + 'T00:00:00').toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
          return `  * ${date} [${s.id}] : ${DISCIPLINE_FR[s.discipline] ?? s.discipline} ${s.duration_min}min — ${STATUS_FR[s.status] ?? s.status}`
        })
        .join('\n')
    : '  (aucune séance cette semaine)'

  const historyBlock = ctx.history.length
    ? ctx.history
        .map((m) => `[${m.role === 'user' ? 'Athlète' : 'Coach'}]: ${m.content}`)
        .join('\n')
    : '(début de conversation)'

  return `
CONTEXTE ATHLÈTE (${ctx.today}) :
- Prénom : ${ctx.profile?.first_name ?? 'Athlète'}
- Niveau : ${levelLabels[ctx.profile?.level ?? ''] ?? ctx.profile?.level ?? 'Non précisé'}
- Programme : "${planLabel}"${ctx.plan ? ` (Sem. ${ctx.currentWeekNum}, Phase ${ctx.currentPhase ?? '—'})` : ''}
${ctx.plan ? `- Plan ID : ${ctx.plan.id}` : ''}

SÉANCES DE LA SEMAINE EN COURS :
${sessionsBlock}
${ctx.stravaActivitiesBlock ? `\n${ctx.stravaActivitiesBlock}\n` : ''}
HISTORIQUE RÉCENT DU CHAT :
${historyBlock}
`.trim()
}

// ─── Strava context builders ──────────────────────────────────────────────────

export function buildStravaStatsBlock(stats: StravaStatsCompact): string {
  return `STATS STRAVA (année en cours / 4 dernières semaines) :
- Course : ${stats.ytd_run_km} km YTD · ${stats.recent_run_km} km récents
- Vélo   : ${stats.ytd_bike_km} km YTD · ${stats.recent_bike_km} km récents
- Nata   : ${stats.ytd_swim_km} km YTD · ${stats.recent_swim_km} km récents`
}

export function buildStravaActivitiesBlock(activities: StravaActivityCompact[]): string {
  if (!activities.length) return ''
  const TYPE_FR: Record<string, string> = {
    run: 'Course',
    bike: 'Vélo',
    swim: 'Natation',
    other: 'Activité',
  }
  const lines = activities.map((a) => {
    const parts: string[] = [`${a.date} · ${TYPE_FR[a.type] ?? a.type}`]
    if (a.duration_min) parts.push(`${a.duration_min}min`)
    if (a.distance_km) parts.push(`${a.distance_km}km`)
    if (a.avg_hr) parts.push(`FC ${a.avg_hr}bpm`)
    if (a.avg_watts) parts.push(`${a.avg_watts}W`)
    if (a.elevation_gain_m) parts.push(`D+${a.elevation_gain_m}m`)
    if (a.suffer_score) parts.push(`suffer ${a.suffer_score}`)
    return `  - ${parts.join(' · ')}`
  })
  return `ACTIVITÉS STRAVA RÉCENTES :\n${lines.join('\n')}`
}

// ─── Session review after Garmin link ─────────────────────────────────────────

export const COACH_SESSION_REVIEW_SYSTEM = `
Tu es coach triathlon pour des athlètes amateurs — des gens qui s'entraînent avant ou après le boulot, le week-end, entre les contraintes de la vie réelle. Pas des élites. Des passionnés.

Tu connais la physiologie de l'exercice sur le bout des doigts, mais tu ne la récites jamais. Tu t'en sers pour interpréter les données et donner des conseils qui font sens — pas pour impressionner.

## Comment tu parles

Tu t'adresses directement à la personne, avec "tu". Ton ton est celui d'un expert qui parle à un ami : direct, humain, sans condescendance. Tu pars toujours du ressenti ou de l'effort avant de regarder les données. Tu ne noies pas sous les informations — une observation clé, un conseil actionnable, c'est souvent suffisant.

Ce que tu évites :
- Les cours de physiologie ("cette séance a stimulé les adaptations mitochondriales...")
- Les listes exhaustives quand 2 phrases suffisent
- Les félicitations génériques et vides ("Super séance !")
- Le jargon pour le jargon — préfère "allure confortable" à "Z2"
- "Pourquoi tu n'as pas tenu l'allure ?" après une mauvaise séance — on regarde toujours devant
- Commenter une donnée isolée sans contexte

## Quelques règles spécifiques aux amateurs

**Sur les sorties faciles** : la plupart des amateurs courent leurs sorties faciles trop vite. Quand tu vois une endurance bien gérée, dis-le. Donner la permission de ralentir est souvent le conseil le plus utile que tu puisses donner.

**Sur les données** : traduis les chiffres en sens humain. Citer un chiffre précis quand il ancre concrètement un message est bien. Ce qu'il faut éviter : les listes de métriques brutes sans interprétation.

## Zones et récupération

- Body battery : <40 = vidé, 40–60 = récup partielle, >70 = prêt
- FC repos : +5 bpm au-dessus de la référence = fatigue accumulée
- Effet d'entraînement aérobie (Garmin) : 1–2 = maintien, 3 = amélioration, 4–5 = surcharge ou progression majeure

## Ton

Tu parles avec naturel et précision — comme un professionnel qui connaît son sujet et n'a pas besoin de l'étaler. Ni formel ni familier : direct, humain, à l'aise. Pas de formules, pas de mise en scène. Le message compte plus que la façon de le livrer.

## Format de réponse STRICT

Réponds UNIQUEMENT en JSON valide, rien d'autre :
{
  "verdict": "excellent | good | average | poor",
  "message": "Ton retour en français, 2-4 phrases max. Direct, humain, actionnable."
}

Définition des verdicts :
- "excellent" : séance exécutée avec précision et au-delà des attentes
- "good" : séance bien réalisée, objectifs globalement atteints
- "average" : séance correcte mais des écarts significatifs par rapport aux objectifs
- "poor" : séance très éloignée des objectifs ou mal exécutée

Pour les allures : min'sec"/km. Pour les plages FC : en bpm. Réponds en français.
`.trim()

export interface SessionReviewContext {
  session: {
    title: string
    discipline: string
    session_type: string
    duration_min: number
    target_zone: string | null
    target_values: Record<string, unknown> | null
    expected_rpe: number | null
    structure: { warmup?: string; main?: string; cooldown?: string } | null
    coaching_note: string | null
    actual_rpe: number | null
  }
  activity: {
    activity_type: string
    name: string | null
    duration_s: number | null
    distance_m: number | null
    avg_hr: number | null
    max_hr: number | null
    avg_speed_ms: number | null
    elevation_gain_m: number | null
    aerobic_te: number | null
    anaerobic_te: number | null
  }
}

function formatPace(discipline: string, avg_speed_ms: number | null): string | null {
  if (!avg_speed_ms || avg_speed_ms <= 0) return null
  if (discipline === 'bike') {
    return `${(avg_speed_ms * 3.6).toFixed(1)} km/h`
  }
  const totalSec =
    discipline === 'swim' ? Math.round(100 / avg_speed_ms) : Math.round(1000 / avg_speed_ms)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const unit = discipline === 'swim' ? '/100m' : '/km'
  return `${min}'${String(sec).padStart(2, '0')}"${unit}`
}

export function buildSessionReviewPrompt(ctx: SessionReviewContext): string {
  const { session, activity } = ctx
  const actualDurationMin = activity.duration_s ? Math.round(activity.duration_s / 60) : null
  const actualDistanceKm = activity.distance_m
    ? session.discipline === 'swim'
      ? `${Math.round(activity.distance_m)} m`
      : `${(activity.distance_m / 1000).toFixed(2)} km`
    : null
  const pace = formatPace(session.discipline, activity.avg_speed_ms)

  const DISCIPLINE_FR: Record<string, string> = {
    swim: 'Natation',
    bike: 'Vélo',
    run: 'Course à pied',
    brick: 'Enchaînement',
    strength: 'Renforcement',
    rest: 'Repos',
  }
  const SESSION_TYPE_FR: Record<string, string> = {
    easy: 'Endurance facile',
    tempo: 'Tempo',
    threshold: 'Seuil',
    vo2: 'VO2max',
    race_pace: 'Allure course',
    technique: 'Technique',
    long: 'Sortie longue',
    recovery: 'Récupération active',
    test: 'Test',
  }

  const targetHr = session.target_values?.hr as number[] | undefined
  const targetWatts = session.target_values?.watts as number[] | undefined
  const targetPace =
    (session.target_values?.pace_per_km as string | undefined) ??
    (session.target_values?.pace_per_100m as string | undefined)

  return `
SÉANCE PLANIFIÉE :
- Titre : ${session.title}
- Discipline : ${DISCIPLINE_FR[session.discipline] ?? session.discipline}
- Type : ${SESSION_TYPE_FR[session.session_type] ?? session.session_type}
- Durée prévue : ${session.duration_min} min
- Zone cible : ${session.target_zone ?? 'non précisée'}
${targetHr ? `- FC cible : ${targetHr[0]}–${targetHr[1]} bpm` : ''}
${targetWatts ? `- Puissance cible : ${targetWatts[0]}–${targetWatts[1]} W` : ''}
${targetPace ? `- Allure cible : ${targetPace}` : ''}
${session.expected_rpe ? `- RPE prévu : ${session.expected_rpe}/10` : ''}
${session.structure?.main ? `- Bloc principal : ${session.structure.main}` : ''}
${session.coaching_note ? `- Note du coach avant séance : ${session.coaching_note}` : ''}

RÉALISATION (données Garmin) :
- Activité : ${activity.name ?? DISCIPLINE_FR[activity.activity_type] ?? activity.activity_type}
${actualDurationMin ? `- Durée réelle : ${actualDurationMin} min (prévu : ${session.duration_min} min)` : ''}
${actualDistanceKm ? `- Distance : ${actualDistanceKm}` : ''}
${pace ? `- Allure / vitesse moyenne : ${pace}` : ''}
${activity.avg_hr ? `- FC moyenne : ${activity.avg_hr} bpm` : ''}
${activity.max_hr ? `- FC max : ${activity.max_hr} bpm` : ''}
${activity.elevation_gain_m ? `- Dénivelé positif : ${Math.round(activity.elevation_gain_m)} m` : ''}
${activity.aerobic_te !== null && activity.aerobic_te !== undefined ? `- Effet d'entraînement aérobie : ${activity.aerobic_te.toFixed(1)}/5` : ''}
${activity.anaerobic_te !== null && activity.anaerobic_te !== undefined && activity.anaerobic_te > 0 ? `- Effet d'entraînement anaérobie : ${activity.anaerobic_te.toFixed(1)}/5` : ''}
${session.actual_rpe ? `- RPE ressenti par l'athlète : ${session.actual_rpe}/10` : ''}

Donne ton retour de coach sur l'exécution de cette séance. Compare le prévu et le réel, identifie le point clé (positif ou à travailler), et donne un conseil actionnable si pertinent.
`.trim()
}
