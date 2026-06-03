import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/utils/errors";
import { generateJSON } from "@/lib/gemini/client";
import {
  COACH_SESSION_REVIEW_SYSTEM,
  buildSessionReviewPrompt,
  type SessionReviewContext,
} from "@/lib/gemini/prompts";

interface CoachReview {
  verdict: "excellent" | "good" | "average" | "poor";
  message: string;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return apiError("Non authentifié", 401);

  const { id: session_id } = await params;

  // Fetch session with its linked Garmin activity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session, error: sessionError } = await (supabase as any)
    .from("sessions")
    .select(
      "title, discipline, session_type, duration_min, target_zone, target_values, expected_rpe, structure, coaching_note, actual_rpe, garmin_activity_id"
    )
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) return apiError("Séance introuvable", 404);
  if (!session.garmin_activity_id)
    return apiError("Aucune activité Garmin liée à cette séance", 400);

  // Fetch the full Garmin activity data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activity, error: activityError } = await (supabase as any)
    .from("garmin_activities")
    .select(
      "activity_type, name, duration_s, distance_m, avg_hr, max_hr, avg_speed_ms, elevation_gain_m, aerobic_te, anaerobic_te"
    )
    .eq("id", session.garmin_activity_id)
    .eq("user_id", user.id)
    .single();

  if (activityError || !activity)
    return apiError("Activité Garmin introuvable", 404);

  const ctx: SessionReviewContext = {
    session: {
      title: session.title ?? "",
      discipline: session.discipline ?? "",
      session_type: session.session_type ?? "",
      duration_min: session.duration_min ?? 0,
      target_zone: session.target_zone ?? null,
      target_values: session.target_values ?? null,
      expected_rpe: session.expected_rpe ?? null,
      structure: session.structure ?? null,
      coaching_note: session.coaching_note ?? null,
      actual_rpe: session.actual_rpe ?? null,
    },
    activity: {
      activity_type: activity.activity_type ?? "",
      name: activity.name ?? null,
      duration_s: activity.duration_s ?? null,
      distance_m: activity.distance_m ?? null,
      avg_hr: activity.avg_hr ?? null,
      max_hr: activity.max_hr ?? null,
      avg_speed_ms: activity.avg_speed_ms ?? null,
      elevation_gain_m: activity.elevation_gain_m ?? null,
      aerobic_te: activity.aerobic_te ?? null,
      anaerobic_te: activity.anaerobic_te ?? null,
    },
  };

  const review = await generateJSON<CoachReview>(
    COACH_SESSION_REVIEW_SYSTEM,
    buildSessionReviewPrompt(ctx),
    { temperature: 0.8 }
  );

  // Persist review in sessions table
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("sessions")
    .update({ garmin_review: review })
    .eq("id", session_id);

  return apiSuccess(review);
}
