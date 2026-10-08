import { describe, it, expect } from 'vitest'
import { buildMacroPrompt, type GoalContext } from './prompts'

const profile = {
  first_name: 'Mateo', level: 'intermediate', weekly_hours_avg: 10,
  available_disciplines: null, birth_date: null, weight_kg: 70,
}
const trail: GoalContext = {
  role: 'primary', sport: 'running', race_name: 'UTMB', race_type: 'ultra', race_date: '2026-08-28',
  run_distance_m: 171000, elevation_gain_m: 10000, elevation_loss_m: 10000, surface: 'mountain',
  terrain: 'mountainous', max_altitude_m: 2537, cutoff_time_s: 165600, estimated_finish_time_s: 140400,
}
const tri: GoalContext = {
  role: 'secondary', sport: 'triathlon', race_name: 'Triathlon M', race_type: 'olympic', race_date: '2026-06-15',
  swim_distance_m: 1500, bike_distance_m: 40000, run_distance_m: 10000,
}

describe('buildMacroPrompt (multi-courses)', () => {
  it('liste la course principale et la secondaire', () => {
    const out = buildMacroPrompt({ profile, mode: 'race', methodology: 'polarized', start_date: '2026-03-01', total_weeks: 25, goals: [trail, tri] })
    expect(out).toContain('UTMB')
    expect(out).toContain('Triathlon M')
    expect(out).toContain('principale')
    expect(out).toContain('secondaire')
  })
  it('affiche les champs trail (D+, D-, technicité)', () => {
    const out = buildMacroPrompt({ profile, mode: 'race', methodology: 'polarized', start_date: '2026-03-01', total_weeks: 25, goals: [trail] })
    expect(out).toContain('D+')
    expect(out).toContain('D-')
    expect(out).toMatch(/technicit|mountain|montagne/i)
  })
  it('mode maintenance sans courses', () => {
    const out = buildMacroPrompt({ profile, mode: 'maintenance', methodology: 'polarized', start_date: '2026-03-01', total_weeks: 12 })
    expect(out).toContain('Maintien')
  })

  it('injecte la spécialisation trail quand une course running est présente', () => {
    const out = buildMacroPrompt({
      profile, mode: 'race', methodology: 'polarized', start_date: '2026-03-01', total_weeks: 25, goals: [trail],
    })
    expect(out).toContain('SPÉCIALISATION TRAIL')
    expect(out).toContain('excentrique')
  })

  it("n'injecte pas la spécialisation trail pour un triathlon seul", () => {
    const out = buildMacroPrompt({
      profile, mode: 'race', methodology: 'polarized', start_date: '2026-03-01', total_weeks: 25, goals: [tri],
    })
    expect(out).not.toContain('SPÉCIALISATION TRAIL')
  })

  it('ajoute le bloc disciplines complémentaires quand fourni', () => {
    const out = buildMacroPrompt({
      profile, mode: 'race', methodology: 'polarized', start_date: '2026-03-01', total_weeks: 25,
      goals: [trail], disciplines: ['swim', 'bike', 'run', 'strength'],
      complementary_disciplines: ['swim', 'bike'],
    })
    expect(out).toContain('DISCIPLINES COMPLÉMENTAIRES')
    expect(out).toMatch(/natation/i)
    expect(out).toMatch(/peak et taper|peak\/taper|affûtage/i)
  })

  it("n'ajoute pas le bloc complémentaire sans disciplines complémentaires", () => {
    const out = buildMacroPrompt({
      profile, mode: 'race', methodology: 'polarized', start_date: '2026-03-01', total_weeks: 25, goals: [trail],
    })
    expect(out).not.toContain('DISCIPLINES COMPLÉMENTAIRES')
  })
})
