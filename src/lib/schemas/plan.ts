import { z } from 'zod'

export const PlanGenerationSchema = z
  .object({
    goal_ids: z.array(z.string().uuid()).min(1, 'Au moins une course requise').max(3),
    primary_goal_id: z.string().uuid({ message: 'Course principale requise' }),
    // Disciplines complémentaires (cross-training) à entraîner en plus de
    // l'objectif, avec progression structurée mais dégressive en peak/taper.
    complementary_disciplines: z
      .array(z.enum(['swim', 'bike', 'run', 'strength']))
      .max(4)
      .optional(),
    methodology: z.enum(['polarized', 'pyramidal', 'threshold']).default('polarized'),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // Jours où l'athlète peut s'entraîner (0=dim … 6=sam).
    available_days: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Choisis au moins un jour d'entraînement")
      .max(7),
  })
  .superRefine((v, ctx) => {
    if (!v.goal_ids.includes(v.primary_goal_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primary_goal_id'],
        message: 'La course principale doit faire partie des courses',
      })
    }
  })

export type PlanGeneration = z.infer<typeof PlanGenerationSchema>

/** Configuration d'un plan persistée dans `plans.params`. */
export interface PlanParams {
  total_weeks?: number
  training_disciplines?: string[] | null
  complementary_disciplines?: string[] | null
  available_days?: number[] | null
}

// Gemini macro response shape
export interface MacroPlan {
  phases: {
    phase: 'prep' | 'base' | 'build' | 'peak' | 'taper' | 'race'
    start_week_num: number
    end_week_num: number
    focus: string
  }[]
  weeks: {
    week_num: number
    phase: string
    is_recovery_week: boolean
    planned_volume_hours: number
    planned_tss: number
    distribution: Record<string, number>
    notes: string
  }[]
}

// Gemini micro response shape
export interface MicroSessions {
  sessions: {
    session_date: string
    discipline: string
    session_type: string
    title: string
    duration_min: number
    planned_tss: number | null
    structure: { warmup: string; main: string; cooldown: string }
    target_values: Record<string, unknown> | null
    target_zone: string | null
    expected_rpe: number | null
    coaching_note: string | null
    day_part?: string | null
    template_code?: string | null
  }[]
}
