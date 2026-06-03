// Auto-generated types — run `npm run db:types` after connecting Supabase project
// Placeholder until `supabase gen types typescript` is run

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string | null
          birth_date: string | null
          sex: 'M' | 'F' | 'X' | null
          weight_kg: number | null
          height_cm: number | null
          experience_years: number | null
          level: 'beginner' | 'intermediate' | 'advanced' | 'elite' | null
          weekly_hours_avg: number | null
          available_disciplines: string[] | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      physiology: {
        Row: {
          id: string
          user_id: string
          test_date: string
          ftp_watts: number | null
          hr_max: number | null
          hr_threshold_bike: number | null
          vma_kmh: number | null
          run_threshold_pace_sec_per_km: number | null
          hr_max_run: number | null
          hr_threshold_run: number | null
          resting_hr: number | null
          css_pace_sec_per_100m: number | null
          source: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['physiology']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['physiology']['Insert']>
      }
      goals: {
        Row: {
          id: string
          user_id: string
          race_name: string
          race_date: string
          race_type: 'sprint' | 'olympic' | 'half' | 'full' | 'xterra' | 'custom'
          swim_distance_m: number | null
          bike_distance_m: number | null
          run_distance_m: number | null
          bike_elevation_m: number | null
          run_elevation_m: number | null
          terrain: 'flat' | 'hilly' | 'mountainous' | null
          priority: 'A' | 'B' | 'C'
          target_type: 'finish' | 'time' | 'podium'
          target_time_seconds: number | null
          status: 'draft' | 'active' | 'completed' | 'abandoned'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['goals']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['goals']['Insert']>
      }
      plans: {
        Row: {
          id: string
          user_id: string
          goal_id: string
          name: string | null
          start_date: string
          end_date: string
          methodology: 'polarized' | 'pyramidal' | 'threshold' | 'custom'
          periodization: 'linear' | 'block' | 'reverse'
          status: 'active' | 'archived'
          params: Json | null
          summary: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['plans']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['plans']['Insert']>
      }
      sessions: {
        Row: {
          id: string
          plan_id: string
          plan_week_id: string
          user_id: string
          session_date: string
          day_part: 'morning' | 'midday' | 'evening' | null
          discipline: 'swim' | 'bike' | 'run' | 'brick' | 'strength' | 'rest'
          session_type: 'easy' | 'tempo' | 'threshold' | 'vo2' | 'race_pace' | 'technique' | 'long' | 'recovery' | 'test'
          template_code: string | null
          duration_min: number
          planned_tss: number | null
          structure: Json | null
          target_values: Json | null
          target_zone: string | null
          expected_rpe: number | null
          coaching_note: string | null
          status: 'planned' | 'done' | 'skipped' | 'modified'
          actual_duration_min: number | null
          actual_rpe: number | null
          actual_notes: string | null
          completed_at: string | null
          garmin_activity_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['sessions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>
      }
      garmin_credentials: {
        Row: {
          id: string
          user_id: string
          email_enc: string
          password_enc: string
          session_data: Json | null
          last_sync_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['garmin_credentials']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['garmin_credentials']['Insert']>
      }
      garmin_activities: {
        Row: {
          id: string
          user_id: string
          garmin_activity_id: number
          activity_type: string
          started_at: string
          duration_s: number | null
          distance_m: number | null
          avg_hr: number | null
          max_hr: number | null
          avg_speed_ms: number | null
          elevation_gain_m: number | null
          training_effect: number | null
          aerobic_te: number | null
          anaerobic_te: number | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['garmin_activities']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['garmin_activities']['Insert']>
      }
      garmin_wellness: {
        Row: {
          id: string
          user_id: string
          date: string
          sleep_duration_s: number | null
          sleep_score: number | null
          hrv_rmssd: number | null
          body_battery_start: number | null
          body_battery_end: number | null
          stress_avg: number | null
          resting_hr: number | null
          steps: number | null
          total_calories: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['garmin_wellness']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['garmin_wellness']['Insert']>
      }
      garmin_stats: {
        Row: {
          user_id: string
          display_name: string | null
          garmin_username: string | null
          profile_image_url: string | null
          vo2max_run: number | null
          vo2max_bike: number | null
          fitness_age: number | null
          training_readiness: number | null
          training_load_7d: number | null
          training_load_28d: number | null
          personal_records: Json | null
          raw_profile: Json | null
          raw_fitness: Json | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['garmin_stats']['Row'], 'updated_at'> & { updated_at?: string }
        Update: Partial<Database['public']['Tables']['garmin_stats']['Insert']>
      }
      availability_blocks: {
        Row: {
          id: string
          user_id: string
          start_date: string
          end_date: string
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['availability_blocks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['availability_blocks']['Insert']>
      }
    }
    Views: {
      physiology_current: {
        Row: Database['public']['Tables']['physiology']['Row']
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
