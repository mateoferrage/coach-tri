import { z } from 'zod'

export const PlanGenerationSchema = z.object({
  mode: z.enum(['race', 'maintenance']),
  goal_id: z.string().uuid().optional(), // required if mode === 'race'
  methodology: z.enum(['polarized', 'pyramidal', 'threshold']).default('polarized'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
