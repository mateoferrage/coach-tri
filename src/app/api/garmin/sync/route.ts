import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/utils/errors";
import { decryptCredential } from "@/lib/utils/crypto";

interface GarminCreds {
  email_enc: string;
  password_enc: string;
  session_data: Record<string, unknown> | null;
  last_sync_at: string | null;
}

interface SyncResult {
  activities_count: number;
  wellness_count: number;
  session_data: Record<string, unknown>;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return apiError("Non authentifié", 401);

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creds, error: credsError } = await (admin as any)
    .from("garmin_credentials")
    .select("email_enc, password_enc, session_data, last_sync_at")
    .eq("user_id", user.id)
    .single() as { data: GarminCreds | null; error: { message: string } | null };

  if (credsError || !creds) {
    return apiError("Aucun compte Garmin connecté", 400);
  }

  try {
    const email = decryptCredential(creds.email_enc);
    const password = decryptCredential(creds.password_enc);

    const since = creds.last_sync_at
      ? new Date(creds.last_sync_at).toISOString().split("T")[0]
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const syncResult = await callGarminSync({ email, password, since, userId: user.id, sessionData: creds.session_data });

    // Upsert activities
    if (syncResult.activities.length > 0) {
      const activityRows = syncResult.activities.map(a => ({ ...a, user_id: user.id }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("garmin_activities")
        .upsert(activityRows, { onConflict: "user_id,garmin_activity_id", ignoreDuplicates: false });
    }

    // Upsert wellness
    if (syncResult.wellness.length > 0) {
      const wellnessRows = syncResult.wellness.map(w => ({ ...w, user_id: user.id }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("garmin_wellness")
        .upsert(wellnessRows, { onConflict: "user_id,date", ignoreDuplicates: false });
    }

    // Update credentials: persist session + last_sync timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("garmin_credentials")
      .update({ last_sync_at: new Date().toISOString(), session_data: syncResult.session_data })
      .eq("user_id", user.id);

    return apiSuccess({
      success: true,
      activities_synced: syncResult.activities_count,
      wellness_synced: syncResult.wellness_count,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur de synchronisation";
    return apiError(message);
  }
}

interface GarminActivity {
  garmin_activity_id: number;
  activity_type: string;
  started_at: string;
  duration_s: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_speed_ms: number | null;
  elevation_gain_m: number | null;
  training_effect: number | null;
  aerobic_te: number | null;
  anaerobic_te: number | null;
  raw_data: Record<string, unknown>;
}

interface GarminWellness {
  date: string;
  sleep_duration_s: number | null;
  sleep_score: number | null;
  hrv_rmssd: number | null;
  body_battery_start: number | null;
  body_battery_end: number | null;
  stress_avg: number | null;
  resting_hr: number | null;
  steps: number | null;
  total_calories: number | null;
}

async function callGarminSync(params: {
  email: string;
  password: string;
  since: string;
  userId: string;
  sessionData: unknown;
}): Promise<SyncResult & { activities: GarminActivity[]; wellness: GarminWellness[] }> {
  // Calls the Vercel Python serverless function at /api/garmin_sync
  // The function uses the garminconnect Python library
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const secret = process.env.INTERNAL_SECRET;
  if (!secret) throw new Error("INTERNAL_SECRET env var not set");

  const res = await fetch(`${baseUrl}/api/garmin_sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": secret,
    },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      since: params.since,
      session_data: params.sessionData ?? null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? "Garmin sync failed");
  }

  return res.json();
}
