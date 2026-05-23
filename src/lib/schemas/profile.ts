import { z } from 'zod'

// Zod v4 — use z.number() without coerce; use valueAsNumber in form inputs
export const ProfileSchema = z.object({
  first_name: z.string().min(1, 'Prénom requis').max(100),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  sex: z.enum(['M', 'F', 'X']),
  weight_kg: z.number().min(30).max(200).optional(),
  height_cm: z.number().min(100).max(250).optional(),
  experience_years: z.number().min(0).max(50).int().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'elite']),
  weekly_hours_avg: z.number().min(1).max(40).optional(),
  available_disciplines: z.array(z.enum(['swim', 'bike', 'run'])).min(1, 'Sélectionner au moins une discipline'),
  notes: z.string().max(1000).optional(),
})

export type Profile = z.infer<typeof ProfileSchema>
