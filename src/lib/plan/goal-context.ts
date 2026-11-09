import type { GoalContext } from '@/lib/gemini/prompts'

/**
 * Construit les `GoalContext` injectés dans le prompt macro à partir des lignes
 * `goals` de la base. Partagé par la génération initiale et la replanification
 * pour que le mapping (notamment D+ ← `run_elevation_m`) reste unique.
 */
export function buildGoalContexts(
  goalRows: Array<Record<string, unknown>>,
  primaryGoalId: string,
): GoalContext[] {
  return goalRows.map((g) => ({
    role: g.id === primaryGoalId ? 'primary' : 'secondary',
    sport: (g.sport as 'triathlon' | 'running') ?? 'triathlon',
    race_name: g.race_name as string,
    race_type: g.race_type as string,
    race_date: g.race_date as string,
    swim_distance_m: g.swim_distance_m as number | null,
    bike_distance_m: g.bike_distance_m as number | null,
    run_distance_m: g.run_distance_m as number | null,
    elevation_gain_m: g.run_elevation_m as number | null, // D+ ← colonne DB run_elevation_m
    elevation_loss_m: g.elevation_loss_m as number | null,
    bike_elevation_m: g.bike_elevation_m as number | null,
    surface: g.surface as string | null,
    terrain: g.terrain as string | null,
    max_altitude_m: g.max_altitude_m as number | null,
    cutoff_time_s: g.cutoff_time_s as number | null,
    estimated_finish_time_s: g.estimated_finish_time_s as number | null,
    target_type: g.target_type as string | null,
    target_time_seconds: g.target_time_seconds as number | null,
    swim_target_time_s: g.swim_target_time_s as number | null,
    t1_target_time_s: g.t1_target_time_s as number | null,
    bike_target_time_s: g.bike_target_time_s as number | null,
    t2_target_time_s: g.t2_target_time_s as number | null,
    run_target_time_s: g.run_target_time_s as number | null,
  }))
}
