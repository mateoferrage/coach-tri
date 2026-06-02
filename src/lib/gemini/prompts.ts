// ─── System prompt ─────────────────────────────────────────────────────────────

export const TRIATHLON_COACH_SYSTEM = `
Tu es un coach triathlon expert certifié, spécialisé dans la préparation des athlètes de tous niveaux (débutant à élite).

## Principes de périodisation triathlon

**Cycle de progression** : 3 semaines de charge progressive + 1 semaine de récupération (volume réduit de 30-40%).

**Phases et objectifs** :
- PREP (optionnel, si > 20 semaines) : adaptation progressive, travail technique, volume faible
- BASE : développement aérobie, 75-85% vol. en Z1-Z2, renforcement foncier
- BUILD : introduction intensité, 60-70% endurance + 20-30% intensité seuil/VO2
- PEAK : haute intensité, séances spécifiques course, volume légèrement réduit
- TAPER : réduction volume 40-60%, maintien intensité, préparer la fraîcheur

**Équilibre disciplinaire** (ajustable selon profil) :
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

Réponds toujours en JSON valide et uniquement en JSON. Pas de texte en dehors du JSON.
`.trim()

// ─── Macro generation ──────────────────────────────────────────────────────────

interface MacroContext {
  profile: {
    first_name: string | null
    level: string | null
    weekly_hours_avg: number | null
    available_disciplines: string[] | null
    birth_date: string | null
    weight_kg: number | null
  }
  mode: 'race' | 'maintenance'
  methodology: string
  start_date: string
  total_weeks: number
  goal?: {
    race_name: string
    race_type: string
    race_date: string
    swim_distance_m: number | null
    bike_distance_m: number | null
    run_distance_m: number | null
    terrain: string | null
  }
  recent_activity_summary?: string
  recent_wellness_summary?: string
}

export function buildMacroPrompt(ctx: MacroContext): string {
  const disciplineLabels: Record<string, string> = { swim: 'natation', bike: 'vélo', run: 'course à pied' }
  const disciplines = (ctx.profile.available_disciplines ?? ['swim', 'bike', 'run'])
    .map(d => disciplineLabels[d] ?? d).join(', ')

  const levelLabels: Record<string, string> = {
    beginner: 'Débutant', intermediate: 'Intermédiaire',
    advanced: 'Avancé', elite: 'Élite',
  }

  const methodologyLabels: Record<string, string> = {
    polarized: 'Polarisé (80% basse intensité / 20% haute intensité)',
    pyramidal: 'Pyramidal (70% Z1-Z2 / 20% Z3 / 10% Z4-Z5)',
    threshold: 'Seuil (focus sur la Zone 3-4)',
  }

  const goalSection = ctx.mode === 'race' && ctx.goal
    ? `
OBJECTIF DE COURSE :
- Nom : ${ctx.goal.race_name}
- Type : ${ctx.goal.race_type}
- Date : ${ctx.goal.race_date}
- Distances : ${ctx.goal.swim_distance_m ?? '?'}m nage / ${ctx.goal.bike_distance_m ?? '?'}m vélo / ${ctx.goal.run_distance_m ?? '?'}m course
- Terrain : ${ctx.goal.terrain ?? 'non précisé'}
`.trim()
    : 'MODE : Maintien de forme (programme continu sans objectif de course)'

  return `
PROFIL ATHLÈTE :
- Prénom : ${ctx.profile.first_name ?? 'Athlète'}
- Niveau : ${levelLabels[ctx.profile.level ?? ''] ?? ctx.profile.level ?? 'Non précisé'}
- Disponibilité : ${ctx.profile.weekly_hours_avg ?? 8}h/semaine
- Disciplines : ${disciplines}
- Poids : ${ctx.profile.weight_kg ? ctx.profile.weight_kg + ' kg' : 'non précisé'}

${goalSection}

PROGRAMME :
- Méthodologie : ${methodologyLabels[ctx.methodology] ?? ctx.methodology}
- Début : ${ctx.start_date}
- Durée totale : ${ctx.total_weeks} semaines

${ctx.recent_activity_summary ? `HISTORIQUE RÉCENT :\n${ctx.recent_activity_summary}` : ''}
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
- Inclure toutes les ${ctx.total_weeks} semaines (week_num de 1 à ${ctx.total_weeks})
- Semaines de récupération toutes les 4 semaines (is_recovery_week: true, volume réduit de 35%)
- Volume de la semaine 1 = 70% du volume cible de l'athlète (montée progressive)
- La dernière semaine (taper final) doit avoir un volume de 40-50% du pic
- planned_tss cohérent avec le volume et l'intensité (1h Z2 vélo ≈ 50 TSS, 1h run Z2 ≈ 60 TSS)
`.trim()
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
  profile: {
    level: string | null
    weekly_hours_avg: number | null
    available_disciplines: string[] | null
  }
  available_days: number[] // 0=dim, 1=lun … 6=sam
  week_start_date: string // YYYY-MM-DD (lundi)
  prior_weeks?: PriorWeek[]
  plan_overview?: PlanWeekOverview[]
  athlete_zones?: string            // pre-formatted zone table from calculateZones()
  recent_wellness_summary?: string
  schedule_constraints?: string
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const PHASE_LABELS: Record<string, string> = {
  prep: 'Préparation', base: 'Base', build: 'Construction',
  peak: 'Pic', taper: 'Affûtage', race: 'Course', maintenance: 'Maintien',
}
const DISCIPLINE_FR: Record<string, string> = {
  swim: 'Natation', bike: 'Vélo', run: 'Course', brick: 'Enchaînement',
  strength: 'Renforcement', rest: 'Repos',
}

export function buildMicroPrompt(ctx: MicroContext): string {
  const dist = ctx.week.distribution
  const intensityDesc = `${Math.round((dist.z1z2 ?? 0) * 100)}% Z1-Z2, ${Math.round((dist.z3 ?? 0) * 100)}% Z3, ${Math.round((dist.z4z5 ?? 0) * 100)}% Z4-Z5`

  // Map available_days to actual dates (week_start = Monday)
  const weekStartMs = new Date(ctx.week_start_date).getTime()
  const dayDateMap: Record<number, string> = {}
  ctx.available_days.forEach(dayOfWeek => {
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const date = new Date(weekStartMs + offset * 86400000)
    dayDateMap[dayOfWeek] = date.toISOString().split('T')[0]
  })

  const sessionsPerDay = ctx.available_days.map(d => `  - ${DAY_NAMES[d]} ${dayDateMap[d]}`).join('\n')
  const disciplines = ctx.profile.available_disciplines ?? ['swim', 'bike', 'run']

  // ── Plan overview block ──────────────────────────────────────────────────────
  let planOverviewBlock = ''
  if (ctx.plan_overview?.length) {
    const lines = ctx.plan_overview.map(w => {
      const marker = w.week_num < ctx.week.week_num
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
    const weekBlocks = ctx.prior_weeks.map(pw => {
      const actualVolMin = pw.sessions.reduce((acc, s) => acc + (s.actual_duration_min ?? s.duration_min), 0)
      const actualTSS = pw.sessions.reduce((acc, s) => acc + (s.planned_tss ?? 0), 0)
      const header = `=== SEMAINE ${pw.week_num} — ${PHASE_LABELS[pw.phase] ?? pw.phase}${pw.is_recovery_week ? ' (RÉCUP)' : ''} | Cible ${pw.planned_volume_hours}h / ${pw.planned_tss} TSS ===`
      const sessionLines = pw.sessions
        .sort((a, b) => a.session_date.localeCompare(b.session_date))
        .map(s => {
          const dur = s.actual_duration_min ?? s.duration_min
          const rpe = s.actual_rpe ? ` | RPE réel: ${s.actual_rpe}` : ''
          const zone = s.target_zone ? ` | ${s.target_zone}` : ''
          const tss = s.planned_tss ? ` | TSS: ${s.planned_tss}` : ''
          const status = s.status === 'done' ? '✓' : s.status === 'skipped' ? '✗' : '○'
          return `  ${status} ${s.session_date} : ${DISCIPLINE_FR[s.discipline] ?? s.discipline} ${dur}min — ${s.session_type}${zone}${tss}${rpe}`
        })
        .join('\n')
      const summary = `  → Volume réel : ${(actualVolMin / 60).toFixed(1)}h | TSS total : ${actualTSS}`
      return `${header}\n${sessionLines}\n${summary}`
    })
    priorWeeksBlock = `SEMAINES PRÉCÉDEMMENT GÉNÉRÉES (contexte de progression) :\n\n${weekBlocks.join('\n\n')}`
  }

  const zonesBlock = ctx.athlete_zones
    ? `ZONES D'ENTRAÎNEMENT PERSONNALISÉES (utilise ces valeurs pour target_values) :\n${ctx.athlete_zones}`
    : ''

  return `
${planOverviewBlock ? planOverviewBlock + '\n\n' : ''}${priorWeeksBlock ? priorWeeksBlock + '\n\n' : ''}${zonesBlock ? zonesBlock + '\n\n' : ''}GÉNÉRATION — SEMAINE ${ctx.week.week_num} — Phase : ${PHASE_LABELS[ctx.week.phase] ?? ctx.week.phase}${ctx.week.is_recovery_week ? ' (SEMAINE DE RÉCUPÉRATION)' : ''}

Cibles de la semaine :
- Volume : ${ctx.week.planned_volume_hours}h
- TSS : ${ctx.week.planned_tss}
- Répartition intensité : ${intensityDesc}
- Note du coach : ${ctx.week.notes}

Profil athlète : niveau ${ctx.profile.level ?? 'intermédiaire'}, ${ctx.profile.weekly_hours_avg ?? 8}h/semaine disponibles
Disciplines pratiquées : ${disciplines.join(', ')}

Jours d'entraînement disponibles :
${sessionsPerDay}

${ctx.recent_wellness_summary ? `Bien-être récent :\n${ctx.recent_wellness_summary}\n` : ''}${ctx.schedule_constraints ? `\nEMPLOI DU TEMPS PERSONNEL (créneaux OCCUPÉS — ne jamais placer d'entraînement dessus) :\n${ctx.schedule_constraints}\n` : ''}
Génère TOUTES les séances de cette semaine en JSON avec ce format EXACT :

{
  "sessions": [
    {
      "session_date": "YYYY-MM-DD",
      "discipline": "swim|bike|run|brick|strength|rest",
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
- Une séance par jour disponible (max 2 si brick)
- Volume total des séances ≈ ${ctx.week.planned_volume_hours}h (±10%)
- Respecter la répartition d'intensité : ${intensityDesc}
- ${ctx.week.is_recovery_week ? 'SEMAINE RÉCUP : séances courtes, intensité basse, aucune séance longue ou intensive' : ctx.prior_weeks?.length ? 'Assurer une progression cohérente par rapport aux semaines précédentes (types de séances, durées, intensités)' : 'Commencer progressivement (semaine 1 = ~70% du volume cible)'}
- session_date doit être exactement l'une des dates listées ci-dessus
- discipline DOIT être exactement l'une de : swim, bike, run, brick, strength, rest
- session_type DOIT être exactement l'une de : easy, tempo, threshold, vo2, race_pace, technique, long, recovery, test
${ctx.athlete_zones ? `- target_values DOIT utiliser les zones personnalisées fournies ci-dessus (watts pour vélo, pace_per_km pour course, pace_per_100m pour natation, hr pour toutes les disciplines)` : `- target_values : inclure "hr" quand possible, "watts" pour vélo, "pace_per_km" pour course, "pace_per_100m" pour natation`}
`.trim()
}

// ─── Chat coach ────────────────────────────────────────────────────────────────

export const COACH_CHAT_SYSTEM = `
Tu es Coach Tri, un coach triathlon IA personnel, bienveillant et expert.
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
    // regenerate_week → { "plan_id": "uuid", "week_num": 3, "available_days": [1,3,5,6] }
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
  profile: { first_name: string | null; level: string | null; weekly_hours_avg: number | null } | null
  plan: { id: string; name: string | null; goal: { race_name: string; race_date: string } | null } | null
  currentWeekNum: number
  currentPhase: string | null
  weekSessions: ChatSession[]
  history: Array<{ role: string; content: string }>
  today: string
}

const STATUS_FR: Record<string, string> = {
  planned: 'PLANIFIÉE', done: 'TERMINÉE', skipped: 'ANNULÉE', modified: 'MODIFIÉE',
}

export function buildChatContext(ctx: ChatContext): string {
  const planLabel = ctx.plan?.goal?.race_name ?? ctx.plan?.name ?? 'Programme d\'entraînement'
  const levelLabels: Record<string, string> = {
    beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé', elite: 'Élite',
  }

  const sessionsBlock = ctx.weekSessions.length
    ? ctx.weekSessions.map(s => {
        const date = new Date(s.session_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
        return `  * ${date} [${s.id}] : ${DISCIPLINE_FR[s.discipline] ?? s.discipline} ${s.duration_min}min — ${STATUS_FR[s.status] ?? s.status}`
      }).join('\n')
    : '  (aucune séance cette semaine)'

  const historyBlock = ctx.history.length
    ? ctx.history.map(m => `[${m.role === 'user' ? 'Athlète' : 'Coach'}]: ${m.content}`).join('\n')
    : '(début de conversation)'

  return `
CONTEXTE ATHLÈTE (${ctx.today}) :
- Prénom : ${ctx.profile?.first_name ?? 'Athlète'}
- Niveau : ${levelLabels[ctx.profile?.level ?? ''] ?? ctx.profile?.level ?? 'Non précisé'}
- Programme : "${planLabel}"${ctx.plan ? ` (Sem. ${ctx.currentWeekNum}, Phase ${ctx.currentPhase ?? '—'})` : ''}
${ctx.plan ? `- Plan ID : ${ctx.plan.id}` : ''}

SÉANCES DE LA SEMAINE EN COURS :
${sessionsBlock}

HISTORIQUE RÉCENT DU CHAT :
${historyBlock}
`.trim()
}
