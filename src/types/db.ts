export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      availability_blocks: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          action_status: string | null
          archived_at: string | null
          content: string
          created_at: string
          id: string
          proposed_action: Json | null
          role: string
          user_id: string
        }
        Insert: {
          action_status?: string | null
          archived_at?: string | null
          content: string
          created_at?: string
          id?: string
          proposed_action?: Json | null
          role: string
          user_id: string
        }
        Update: {
          action_status?: string | null
          archived_at?: string | null
          content?: string
          created_at?: string
          id?: string
          proposed_action?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_activities: {
        Row: {
          activity_type: string
          aerobic_te: number | null
          anaerobic_te: number | null
          avg_hr: number | null
          avg_speed_ms: number | null
          created_at: string
          distance_m: number | null
          duration_s: number | null
          elevation_gain_m: number | null
          garmin_activity_id: number
          id: string
          max_hr: number | null
          name: string | null
          raw_data: Json | null
          started_at: string
          training_effect: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          aerobic_te?: number | null
          anaerobic_te?: number | null
          avg_hr?: number | null
          avg_speed_ms?: number | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          garmin_activity_id: number
          id?: string
          max_hr?: number | null
          name?: string | null
          raw_data?: Json | null
          started_at: string
          training_effect?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          aerobic_te?: number | null
          anaerobic_te?: number | null
          avg_hr?: number | null
          avg_speed_ms?: number | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          garmin_activity_id?: number
          id?: string
          max_hr?: number | null
          name?: string | null
          raw_data?: Json | null
          started_at?: string
          training_effect?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garmin_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      garmin_credentials: {
        Row: {
          created_at: string
          email_enc: string
          id: string
          last_sync_at: string | null
          password_enc: string
          session_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enc: string
          id?: string
          last_sync_at?: string | null
          password_enc: string
          session_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enc?: string
          id?: string
          last_sync_at?: string | null
          password_enc?: string
          session_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garmin_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      garmin_stats: {
        Row: {
          display_name: string | null
          fitness_age: number | null
          garmin_username: string | null
          personal_records: Json | null
          profile_image_url: string | null
          raw_fitness: Json | null
          raw_profile: Json | null
          training_load_28d: number | null
          training_load_7d: number | null
          training_readiness: number | null
          updated_at: string
          user_id: string
          vo2max_bike: number | null
          vo2max_run: number | null
        }
        Insert: {
          display_name?: string | null
          fitness_age?: number | null
          garmin_username?: string | null
          personal_records?: Json | null
          profile_image_url?: string | null
          raw_fitness?: Json | null
          raw_profile?: Json | null
          training_load_28d?: number | null
          training_load_7d?: number | null
          training_readiness?: number | null
          updated_at?: string
          user_id: string
          vo2max_bike?: number | null
          vo2max_run?: number | null
        }
        Update: {
          display_name?: string | null
          fitness_age?: number | null
          garmin_username?: string | null
          personal_records?: Json | null
          profile_image_url?: string | null
          raw_fitness?: Json | null
          raw_profile?: Json | null
          training_load_28d?: number | null
          training_load_7d?: number | null
          training_readiness?: number | null
          updated_at?: string
          user_id?: string
          vo2max_bike?: number | null
          vo2max_run?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garmin_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      garmin_wellness: {
        Row: {
          body_battery_end: number | null
          body_battery_start: number | null
          created_at: string
          date: string
          hrv_rmssd: number | null
          id: string
          resting_hr: number | null
          sleep_duration_s: number | null
          sleep_score: number | null
          steps: number | null
          stress_avg: number | null
          total_calories: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body_battery_end?: number | null
          body_battery_start?: number | null
          created_at?: string
          date: string
          hrv_rmssd?: number | null
          id?: string
          resting_hr?: number | null
          sleep_duration_s?: number | null
          sleep_score?: number | null
          steps?: number | null
          stress_avg?: number | null
          total_calories?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body_battery_end?: number | null
          body_battery_start?: number | null
          created_at?: string
          date?: string
          hrv_rmssd?: number | null
          id?: string
          resting_hr?: number | null
          sleep_duration_s?: number | null
          sleep_score?: number | null
          steps?: number | null
          stress_avg?: number | null
          total_calories?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garmin_wellness_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          bike_distance_m: number | null
          bike_elevation_m: number | null
          bike_target_time_s: number | null
          created_at: string
          id: string
          priority: string
          race_date: string
          race_name: string
          race_type: string
          run_distance_m: number | null
          run_elevation_m: number | null
          run_target_time_s: number | null
          status: string
          swim_distance_m: number | null
          swim_target_time_s: number | null
          t1_target_time_s: number | null
          t2_target_time_s: number | null
          target_time_seconds: number | null
          target_type: string
          terrain: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bike_distance_m?: number | null
          bike_elevation_m?: number | null
          bike_target_time_s?: number | null
          created_at?: string
          id?: string
          priority?: string
          race_date: string
          race_name: string
          race_type: string
          run_distance_m?: number | null
          run_elevation_m?: number | null
          run_target_time_s?: number | null
          status?: string
          swim_distance_m?: number | null
          swim_target_time_s?: number | null
          t1_target_time_s?: number | null
          t2_target_time_s?: number | null
          target_time_seconds?: number | null
          target_type?: string
          terrain?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bike_distance_m?: number | null
          bike_elevation_m?: number | null
          bike_target_time_s?: number | null
          created_at?: string
          id?: string
          priority?: string
          race_date?: string
          race_name?: string
          race_type?: string
          run_distance_m?: number | null
          run_elevation_m?: number | null
          run_target_time_s?: number | null
          status?: string
          swim_distance_m?: number | null
          swim_target_time_s?: number | null
          t1_target_time_s?: number | null
          t2_target_time_s?: number | null
          target_time_seconds?: number | null
          target_type?: string
          terrain?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      physiology: {
        Row: {
          created_at: string
          css_pace_sec_per_100m: number | null
          ftp_watts: number | null
          hr_max: number | null
          hr_max_run: number | null
          hr_threshold_bike: number | null
          hr_threshold_run: number | null
          id: string
          resting_hr: number | null
          run_10k_time_s: number | null
          run_5k_time_s: number | null
          run_half_time_s: number | null
          run_threshold_pace_sec_per_km: number | null
          source: string | null
          swim_100m_time_s: number | null
          swim_200m_time_s: number | null
          swim_400m_time_s: number | null
          swim_800m_time_s: number | null
          test_date: string
          updated_at: string
          user_id: string
          vma_kmh: number | null
        }
        Insert: {
          created_at?: string
          css_pace_sec_per_100m?: number | null
          ftp_watts?: number | null
          hr_max?: number | null
          hr_max_run?: number | null
          hr_threshold_bike?: number | null
          hr_threshold_run?: number | null
          id?: string
          resting_hr?: number | null
          run_10k_time_s?: number | null
          run_5k_time_s?: number | null
          run_half_time_s?: number | null
          run_threshold_pace_sec_per_km?: number | null
          source?: string | null
          swim_100m_time_s?: number | null
          swim_200m_time_s?: number | null
          swim_400m_time_s?: number | null
          swim_800m_time_s?: number | null
          test_date?: string
          updated_at?: string
          user_id: string
          vma_kmh?: number | null
        }
        Update: {
          created_at?: string
          css_pace_sec_per_100m?: number | null
          ftp_watts?: number | null
          hr_max?: number | null
          hr_max_run?: number | null
          hr_threshold_bike?: number | null
          hr_threshold_run?: number | null
          id?: string
          resting_hr?: number | null
          run_10k_time_s?: number | null
          run_5k_time_s?: number | null
          run_half_time_s?: number | null
          run_threshold_pace_sec_per_km?: number | null
          source?: string | null
          swim_100m_time_s?: number | null
          swim_200m_time_s?: number | null
          swim_400m_time_s?: number | null
          swim_800m_time_s?: number | null
          test_date?: string
          updated_at?: string
          user_id?: string
          vma_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "physiology_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_generations: {
        Row: {
          created_at: string
          id: string
          model: string | null
          plan_id: string
          prompt_snapshot: string | null
          response_meta: Json | null
          scope: Json | null
          trigger: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          plan_id: string
          prompt_snapshot?: string | null
          response_meta?: Json | null
          scope?: Json | null
          trigger: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          plan_id?: string
          prompt_snapshot?: string | null
          response_meta?: Json | null
          scope?: Json | null
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_generations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_phases: {
        Row: {
          created_at: string
          end_week_num: number
          focus: string | null
          id: string
          phase: string
          plan_id: string
          start_week_num: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_week_num: number
          focus?: string | null
          id?: string
          phase: string
          plan_id: string
          start_week_num: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_week_num?: number
          focus?: string | null
          id?: string
          phase?: string
          plan_id?: string
          start_week_num?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_phases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_weeks: {
        Row: {
          created_at: string
          distribution: Json | null
          id: string
          is_recovery_week: boolean
          notes: string | null
          phase: string
          plan_id: string
          planned_tss: number | null
          planned_volume_hours: number | null
          start_date: string
          updated_at: string
          week_num: number
        }
        Insert: {
          created_at?: string
          distribution?: Json | null
          id?: string
          is_recovery_week?: boolean
          notes?: string | null
          phase: string
          plan_id: string
          planned_tss?: number | null
          planned_volume_hours?: number | null
          start_date: string
          updated_at?: string
          week_num: number
        }
        Update: {
          created_at?: string
          distribution?: Json | null
          id?: string
          is_recovery_week?: boolean
          notes?: string | null
          phase?: string
          plan_id?: string
          planned_tss?: number | null
          planned_volume_hours?: number | null
          start_date?: string
          updated_at?: string
          week_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_weeks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          end_date: string
          goal_id: string | null
          id: string
          methodology: string
          name: string | null
          params: Json | null
          periodization: string
          start_date: string
          status: string
          summary: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          goal_id?: string | null
          id?: string
          methodology: string
          name?: string | null
          params?: Json | null
          periodization: string
          start_date: string
          status?: string
          summary?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          goal_id?: string | null
          id?: string
          methodology?: string
          name?: string | null
          params?: Json | null
          periodization?: string
          start_date?: string
          status?: string
          summary?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          available_disciplines: string[] | null
          birth_date: string | null
          created_at: string
          equipment: Json | null
          experience_years: number | null
          first_name: string | null
          height_cm: number | null
          id: string
          level: string | null
          notes: string | null
          sex: string | null
          updated_at: string
          weekly_hours_avg: number | null
          weight_kg: number | null
        }
        Insert: {
          available_disciplines?: string[] | null
          birth_date?: string | null
          created_at?: string
          equipment?: Json | null
          experience_years?: number | null
          first_name?: string | null
          height_cm?: number | null
          id: string
          level?: string | null
          notes?: string | null
          sex?: string | null
          updated_at?: string
          weekly_hours_avg?: number | null
          weight_kg?: number | null
        }
        Update: {
          available_disciplines?: string[] | null
          birth_date?: string | null
          created_at?: string
          equipment?: Json | null
          experience_years?: number | null
          first_name?: string | null
          height_cm?: number | null
          id?: string
          level?: string | null
          notes?: string | null
          sex?: string | null
          updated_at?: string
          weekly_hours_avg?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      schedule_events: {
        Row: {
          created_at: string
          end_time: string
          event_date: string
          event_type: string
          id: string
          is_recurring: boolean
          recurrence_day: number | null
          recurrence_end_date: string | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          event_date: string
          event_type?: string
          id?: string
          is_recurring?: boolean
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          event_date?: string
          event_type?: string
          id?: string
          is_recurring?: boolean
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          actual_duration_min: number | null
          actual_notes: string | null
          actual_rpe: number | null
          coaching_note: string | null
          completed_at: string | null
          created_at: string
          day_part: string | null
          discipline: string
          duration_min: number
          expected_rpe: number | null
          garmin_activity_id: string | null
          garmin_review: Json | null
          id: string
          plan_id: string
          plan_week_id: string
          planned_tss: number | null
          session_date: string
          session_time: string | null
          session_type: string
          status: string
          structure: Json | null
          target_values: Json | null
          target_zone: string | null
          template_code: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_duration_min?: number | null
          actual_notes?: string | null
          actual_rpe?: number | null
          coaching_note?: string | null
          completed_at?: string | null
          created_at?: string
          day_part?: string | null
          discipline: string
          duration_min: number
          expected_rpe?: number | null
          garmin_activity_id?: string | null
          garmin_review?: Json | null
          id?: string
          plan_id: string
          plan_week_id: string
          planned_tss?: number | null
          session_date: string
          session_time?: string | null
          session_type: string
          status?: string
          structure?: Json | null
          target_values?: Json | null
          target_zone?: string | null
          template_code?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_duration_min?: number | null
          actual_notes?: string | null
          actual_rpe?: number | null
          coaching_note?: string | null
          completed_at?: string | null
          created_at?: string
          day_part?: string | null
          discipline?: string
          duration_min?: number
          expected_rpe?: number | null
          garmin_activity_id?: string | null
          garmin_review?: Json | null
          id?: string
          plan_id?: string
          plan_week_id?: string
          planned_tss?: number | null
          session_date?: string
          session_time?: string | null
          session_type?: string
          status?: string
          structure?: Json | null
          target_values?: Json | null
          target_zone?: string | null
          template_code?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_garmin_activity_id_fkey"
            columns: ["garmin_activity_id"]
            isOneToOne: false
            referencedRelation: "garmin_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_plan_week_id_fkey"
            columns: ["plan_week_id"]
            isOneToOne: false
            referencedRelation: "plan_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_activities: {
        Row: {
          activity_type: string
          avg_hr: number | null
          avg_speed_ms: number | null
          avg_watts: number | null
          created_at: string | null
          distance_m: number | null
          duration_s: number | null
          elevation_gain_m: number | null
          id: string
          max_hr: number | null
          name: string | null
          started_at: string
          strava_activity_id: number
          suffer_score: number | null
          user_id: string
        }
        Insert: {
          activity_type: string
          avg_hr?: number | null
          avg_speed_ms?: number | null
          avg_watts?: number | null
          created_at?: string | null
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          id?: string
          max_hr?: number | null
          name?: string | null
          started_at: string
          strava_activity_id: number
          suffer_score?: number | null
          user_id: string
        }
        Update: {
          activity_type?: string
          avg_hr?: number | null
          avg_speed_ms?: number | null
          avg_watts?: number | null
          created_at?: string | null
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          id?: string
          max_hr?: number | null
          name?: string | null
          started_at?: string
          strava_activity_id?: number
          suffer_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      strava_credentials: {
        Row: {
          access_token: string
          athlete_id: number
          created_at: string | null
          expires_at: number
          id: string
          last_sync_at: string | null
          refresh_token: string
          scope: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          athlete_id: number
          created_at?: string | null
          expires_at: number
          id?: string
          last_sync_at?: string | null
          refresh_token: string
          scope?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          athlete_id?: number
          created_at?: string | null
          expires_at?: number
          id?: string
          last_sync_at?: string | null
          refresh_token?: string
          scope?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      physiology_current: {
        Row: {
          created_at: string | null
          css_pace_sec_per_100m: number | null
          ftp_watts: number | null
          hr_max: number | null
          hr_max_run: number | null
          hr_threshold_bike: number | null
          hr_threshold_run: number | null
          id: string | null
          resting_hr: number | null
          run_10k_time_s: number | null
          run_5k_time_s: number | null
          run_half_time_s: number | null
          run_threshold_pace_sec_per_km: number | null
          source: string | null
          swim_100m_time_s: number | null
          swim_200m_time_s: number | null
          swim_400m_time_s: number | null
          swim_800m_time_s: number | null
          test_date: string | null
          updated_at: string | null
          user_id: string | null
          vma_kmh: number | null
        }
        Relationships: [
          {
            foreignKeyName: "physiology_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
