import { z } from 'zod'

export const TRIATHLON_RACE_TYPES = [
  'sprint',
  'olympic',
  'half',
  'full',
  'xterra',
  'custom',
] as const
export const RUNNING_RACE_TYPES = ['road', 'trail', 'ultra'] as const
export const SURFACE_TYPES = ['road', 'gravel', 'technical', 'mountain'] as const

// Champs spécifiques à la course à pied / trail. Interdits sur un triathlon.
const TRAIL_ONLY_FIELDS = [
  'elevation_loss_m',
  'surface',
  'max_altitude_m',
  'cutoff_time_s',
  'estimated_finish_time_s',
] as const

// Objet de base sans validation croisée. Exporté pour les consommateurs qui
// doivent dériver le schéma (ex. react-hook-form, qui ne peut pas utiliser
// `.omit` sur un objet portant un refinement). La validation croisée
// (sport ↔ race_type, champs trail) vit uniquement sur `GoalSchema`.
export const GoalBaseSchema = z.object({
  sport: z.enum(['triathlon', 'running']).default('triathlon'),
  race_name: z.string().min(1, 'Nom de la course requis'),
  race_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  race_type: z.enum([...TRIATHLON_RACE_TYPES, ...RUNNING_RACE_TYPES]),
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
  // Trail / course à pied
  elevation_loss_m: z.number().int().min(0).optional(),
  surface: z.enum(SURFACE_TYPES).optional(),
  max_altitude_m: z.number().int().min(0).optional(),
  cutoff_time_s: z.number().int().positive().optional(),
  estimated_finish_time_s: z.number().int().positive().optional(),
})

export const GoalSchema = GoalBaseSchema.superRefine((g, ctx) => {
  const isTri = g.sport === 'triathlon'
  const allowed = isTri ? TRIATHLON_RACE_TYPES : RUNNING_RACE_TYPES
  if (!(allowed as readonly string[]).includes(g.race_type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['race_type'],
      message: `race_type invalide pour le sport ${g.sport}`,
    })
  }
  if (isTri) {
    for (const f of TRAIL_ONLY_FIELDS) {
      if (g[f] != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [f],
          message: 'Champ réservé aux courses à pied',
        })
      }
    }
  }
})

export type Goal = z.infer<typeof GoalSchema>

// Distances standard triathlon (mètres)
export const RACE_DISTANCES = {
  sprint: { swim: 750, bike: 20000, run: 5000 },
  olympic: { swim: 1500, bike: 40000, run: 10000 },
  half: { swim: 1900, bike: 90000, run: 21100 },
  full: { swim: 3800, bike: 180000, run: 42195 },
  xterra: { swim: 1500, bike: 30000, run: 10000 },
  custom: { swim: null, bike: null, run: null },
} as const
