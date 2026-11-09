import { describe, it, expect } from 'vitest'
import {
  ageAt,
  allowedMicroDisciplines,
  buildMacroPrompt,
  buildMicroPrompt,
  buildPerformanceBlock,
  recoveryCycleWeeks,
  remainingVolumeHours,
  type GoalContext,
  type PerformanceData,
} from './prompts'

const profile = {
  first_name: 'Mateo',
  level: 'intermediate',
  weekly_hours_avg: 10,
  available_disciplines: null,
  birth_date: null,
  weight_kg: 70,
}
const trail: GoalContext = {
  role: 'primary',
  sport: 'running',
  race_name: 'UTMB',
  race_type: 'ultra',
  race_date: '2026-08-28',
  run_distance_m: 171000,
  elevation_gain_m: 10000,
  elevation_loss_m: 10000,
  surface: 'mountain',
  terrain: 'mountainous',
  max_altitude_m: 2537,
  cutoff_time_s: 165600,
  estimated_finish_time_s: 140400,
}
const tri: GoalContext = {
  role: 'secondary',
  sport: 'triathlon',
  race_name: 'Triathlon M',
  race_type: 'olympic',
  race_date: '2026-06-15',
  swim_distance_m: 1500,
  bike_distance_m: 40000,
  run_distance_m: 10000,
}

describe('buildMacroPrompt (multi-courses)', () => {
  it('liste la course principale et la secondaire', () => {
    const out = buildMacroPrompt({
      profile,
      methodology: 'polarized',
      start_date: '2026-03-01',
      total_weeks: 25,
      goals: [trail, tri],
    })
    expect(out).toContain('UTMB')
    expect(out).toContain('Triathlon M')
    expect(out).toContain('principale')
    expect(out).toContain('secondaire')
  })
  it('affiche les champs trail (D+, D-, technicité)', () => {
    const out = buildMacroPrompt({
      profile,
      methodology: 'polarized',
      start_date: '2026-03-01',
      total_weeks: 25,
      goals: [trail],
    })
    expect(out).toContain('D+')
    expect(out).toContain('D-')
    expect(out).toMatch(/technicit|mountain|montagne/i)
  })
  it('injecte la spécialisation trail quand une course running est présente', () => {
    const out = buildMacroPrompt({
      profile,
      methodology: 'polarized',
      start_date: '2026-03-01',
      total_weeks: 25,
      goals: [trail],
    })
    expect(out).toContain('SPÉCIALISATION TRAIL')
    expect(out).toContain('excentrique')
  })

  it("n'injecte pas la spécialisation trail pour un triathlon seul", () => {
    const out = buildMacroPrompt({
      profile,
      methodology: 'polarized',
      start_date: '2026-03-01',
      total_weeks: 25,
      goals: [tri],
    })
    expect(out).not.toContain('SPÉCIALISATION TRAIL')
  })

  it('ajoute le bloc disciplines complémentaires quand fourni', () => {
    const out = buildMacroPrompt({
      profile,
      methodology: 'polarized',
      start_date: '2026-03-01',
      total_weeks: 25,
      goals: [trail],
      disciplines: ['swim', 'bike', 'run', 'strength'],
      complementary_disciplines: ['swim', 'bike'],
    })
    expect(out).toContain('DISCIPLINES COMPLÉMENTAIRES')
    expect(out).toMatch(/natation/i)
    expect(out).toMatch(/peak et taper|peak\/taper|affûtage/i)
  })

  it("n'ajoute pas le bloc complémentaire sans disciplines complémentaires", () => {
    const out = buildMacroPrompt({
      profile,
      methodology: 'polarized',
      start_date: '2026-03-01',
      total_weeks: 25,
      goals: [trail],
    })
    expect(out).not.toContain('DISCIPLINES COMPLÉMENTAIRES')
  })
})

const macroBase = {
  profile,
  methodology: 'polarized',
  start_date: '2026-03-01',
  total_weeks: 25,
  goals: [trail],
}

describe('buildMacroPrompt (profil et objectifs)', () => {
  it('transmet âge, sexe, expérience et blessures', () => {
    const out = buildMacroPrompt({
      ...macroBase,
      profile: {
        ...profile,
        birth_date: '1975-06-01',
        sex: 'F',
        experience_years: 7,
        notes: 'tendinite Achille',
      },
    })
    expect(out).toContain('Âge : 50 ans (Masters)')
    expect(out).toContain('Sexe : femme')
    expect(out).toContain('Expérience en endurance : 7')
    expect(out).toContain('tendinite Achille')
    expect(out).toContain('récupération toutes les 3 semaines')
  })
  it("transmet l'ambition et le temps visé", () => {
    const out = buildMacroPrompt({
      ...macroBase,
      goals: [
        {
          ...tri,
          role: 'primary',
          target_type: 'time',
          target_time_seconds: 8100,
          run_target_time_s: 2700,
        },
      ],
    })
    expect(out).toContain('temps visé 2:15:00')
    expect(out).toContain('course 45:00')
  })
  it("ne plafonne pas le volume sur l'historique des montres", () => {
    const out = buildMacroPrompt({
      ...macroBase,
      recent_activity_summary: 'Volume moyen réel : 1.3h/semaine',
    })
    expect(out).not.toContain('sans dépasser de plus de 15%')
    expect(out).toContain('jamais en dessous')
    expect(out).toContain('peut être incomplet')
  })
  it('part du volume actuel déclaré, plafonné à la disponibilité', () => {
    const out = buildMacroPrompt({ ...macroBase, current_weekly_hours: 4 })
    expect(out).toContain('Volume actuel déclaré : 4h/semaine')
    expect(out).toContain('Volume de la semaine 1 = 4h')
    expect(buildMacroPrompt({ ...macroBase, current_weekly_hours: 15 })).toContain(
      'Volume de la semaine 1 = 10h',
    )
  })
  it('impose la liste des phases', () => {
    expect(buildMacroPrompt(macroBase)).toContain('prep, base, build, peak, taper, race')
  })
  it('interdit le Z4-Z5 à un débutant', () => {
    const out = buildMacroPrompt({ ...macroBase, profile: { ...profile, level: 'beginner' } })
    expect(out).toContain('aucune intensité en Z4-Z5')
  })
})

describe('buildPerformanceBlock', () => {
  it('garde les seuils connus sans record', () => {
    const out = buildPerformanceBlock({
      run_5k_time_s: null,
      run_10k_time_s: null,
      run_half_time_s: null,
      swim_100m_time_s: null,
      swim_200m_time_s: null,
      swim_400m_time_s: null,
      swim_800m_time_s: null,
      ftp_watts: null,
      hr_max: null,
      resting_hr: null,
      vma_kmh: 17,
      run_threshold_pace_sec_per_km: 240,
      css_pace_sec_per_100m: 95,
    } as PerformanceData)
    expect(out).toContain('VMA 17.0 km/h')
    expect(out).toContain('CSS 1:35/100m')
  })
})

describe('ageAt / recoveryCycleWeeks', () => {
  it("tient compte de l'anniversaire", () => {
    expect(ageAt('1980-06-15', '2026-06-14')).toBe(45)
    expect(ageAt('1980-06-15', '2026-06-15')).toBe(46)
    expect(ageAt(null, '2026-06-15')).toBeNull()
  })
  it('raccourcit le cycle à partir de 45 ans', () => {
    expect(recoveryCycleWeeks(44)).toBe(4)
    expect(recoveryCycleWeeks(45)).toBe(3)
    expect(recoveryCycleWeeks(null)).toBe(4)
  })
})

const microBase = {
  week: {
    week_num: 6,
    phase: 'build',
    is_recovery_week: false,
    planned_volume_hours: 5,
    planned_tss: 300,
    distribution: { z1z2: 0.8, z3: 0.05, z4z5: 0.15 },
    notes: 'note',
  },
  profile: { level: 'intermediate', weekly_hours_avg: 6, available_disciplines: ['run'] },
  available_dates: ['2026-11-11', '2026-11-14'],
  week_start_date: '2026-11-11',
  training_disciplines: ['run', 'strength'],
}
const keptDone = {
  session_date: '2026-11-11',
  discipline: 'run',
  session_type: 'easy',
  title: null,
  duration_min: 60,
  planned_tss: 50,
  target_zone: null,
  status: 'done',
  actual_rpe: null,
  actual_duration_min: 90,
}

describe('buildMicroPrompt', () => {
  it('donne à chaque date son vrai jour (plan démarré un mercredi)', () => {
    const out = buildMicroPrompt(microBase)
    expect(out).toContain('Mercredi 2026-11-11')
    expect(out).toContain('Samedi 2026-11-14')
  })
  it('transmet la course, le trail et la méthodologie', () => {
    const out = buildMicroPrompt({
      ...microBase,
      goals: [{ ...trail, role: 'primary' }],
      methodology: 'polarized',
    })
    expect(out).toContain('UTMB')
    expect(out).toContain('D+ 10000m')
    expect(out).toContain('SPÉCIALISATION TRAIL')
    expect(out).toContain('Méthodologie du plan : Polarisé')
  })
  it('signale une course qui tombe dans la semaine', () => {
    const out = buildMicroPrompt({
      ...microBase,
      goals: [{ ...trail, role: 'primary', race_date: '2026-11-15' }],
    })
    expect(out).toContain('COURSE PRINCIPALE le 2026-11-15')
  })
  it("ne laisse que les disciplines du programme, sans obligation d'une séance par jour", () => {
    const out = buildMicroPrompt(microBase)
    expect(out).toContain('"discipline": "run|strength"')
    expect(out).toContain("Tu n'es PAS obligé d'utiliser toutes les dates")
  })
  it('déduit les séances déjà réalisées du volume à planifier', () => {
    const out = buildMicroPrompt({ ...microBase, kept_sessions: [keptDone] })
    expect(out).toContain('SÉANCES DÉJÀ TRAITÉES')
    expect(out).toContain('Volume restant à planifier : 3.5h')
  })
})

describe('remainingVolumeHours', () => {
  it('ne déduit pas une séance sautée', () => {
    expect(
      remainingVolumeHours({ ...microBase, kept_sessions: [{ ...keptDone, status: 'skipped' }] }),
    ).toBe(5)
  })
})

describe('allowedMicroDisciplines', () => {
  const noProfile = { level: null, weekly_hours_avg: null, available_disciplines: null }
  const training_disciplines = ['bike', 'run', 'strength']
  it("réserve l'enchaînement au triathlon", () => {
    expect(
      allowedMicroDisciplines({
        profile: noProfile,
        training_disciplines,
        goals: [{ ...tri, role: 'primary' }],
      }),
    ).toContain('brick')
    expect(
      allowedMicroDisciplines({
        profile: noProfile,
        training_disciplines,
        goals: [{ ...trail, role: 'primary' }],
      }),
    ).not.toContain('brick')
  })
})
