import { z } from 'zod'

export const PlanGenerationSchema = z
  .object({
    mode: z.enum(['race', 'maintenance']),
    goal_ids: z.array(z.string().uuid()).min(1).max(3).optional(),
    primary_goal_id: z.string().uuid().optional(),
    // Disciplines complémentaires (cross-training) à entraîner en plus de
    // l'objectif, avec progression structurée mais dégressive en peak/taper.
    complementary_disciplines: z
      .array(z.enum(['swim', 'bike', 'run', 'strength']))
      .max(4)
      .optional(),
    methodology: z.enum(['polarized', 'pyramidal', 'threshold']).default('polarized'),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'race') {
      if (!v.goal_ids?.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['goal_ids'], message: 'Au moins une course requise en mode course' })
        return
      }
      if (!v.primary_goal_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['primary_goal_id'], message: 'Course principale requise' })
      } else if (!v.goal_ids.includes(v.primary_goal_id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['primary_goal_id'], message: 'La course principale doit faire partie des courses' })
      }
    }
  })

export type PlanGeneration = z.infer<typeof PlanGenerationSchema>

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
  }[]
}
