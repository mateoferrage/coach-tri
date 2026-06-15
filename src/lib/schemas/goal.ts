import { z } from 'zod'

export const GoalSchema = z.object({
  race_name: z.string().min(1, 'Nom de la course requis'),
  race_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  race_type: z.enum(['sprint', 'olympic', 'half', 'full', 'xterra', 'custom']),
  swim_distance_m: z.number().int().positive().optional(),
  bike_distance_m: z.number().int().positive().optional(),
  run_distance_m: z.number().int().positive().optional(),
  bike_elevation_m: z.number().int().min(0).optional(),
  run_elevation_m: z.number().int().min(0).optional(),
  terrain: z.enum(['flat', 'hilly', 'mountainous']).optional(),
  priority: z.enum(['A', 'B', 'C']).default('A'),
  target_type: z.enum(['finish', 'time', 'podium']).default('finish'),
  target_time_seconds: z.number().int().positive().optional(),
  swim_target_time_s: z.number().int().positive().optional(),
  t1_target_time_s: z.number().int().positive().optional(),
  bike_target_time_s: z.number().int().positive().optional(),
  t2_target_time_s: z.number().int().positive().optional(),
  run_target_time_s: z.number().int().positive().optional(),
})

export type Goal = z.infer<typeof GoalSchema>

// Standard triathlon distances (meters)
export const RACE_DISTANCES = {
  sprint: { swim: 750, bike: 20000, run: 5000 },
  olympic: { swim: 1500, bike: 40000, run: 10000 },
  half: { swim: 1900, bike: 90000, run: 21100 },
  full: { swim: 3800, bike: 180000, run: 42195 },
  xterra: { swim: 1500, bike: 30000, run: 10000 },
  custom: { swim: null, bike: null, run: null },
} as const
