import { z } from 'zod'

export const ScheduleEventSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(100),
  event_type: z.enum(['cours', 'stage', 'rdv', 'autre']),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide'),
  is_recurring: z.boolean().default(false),
  recurrence_day: z.number().int().min(1).max(7).optional(),
  recurrence_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type ScheduleEventInput = z.infer<typeof ScheduleEventSchema>

export interface ScheduleEventRow extends ScheduleEventInput {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

// Virtual event produced by expanding recurring events for a given week
export interface CalendarEvent {
  id: string
  title: string
  event_type: 'cours' | 'stage' | 'rdv' | 'autre'
  date: string        // YYYY-MM-DD of this occurrence
  start_time: string  // HH:MM
  end_time: string    // HH:MM
  is_recurring: boolean
  source_id: string   // original schedule_events.id
}
