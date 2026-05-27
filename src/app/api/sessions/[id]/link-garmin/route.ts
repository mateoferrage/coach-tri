import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/errors";
import { z } from "zod";

const Body = z.object({
  garmin_activity_id: z.string().uuid().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return apiError("Non authentifié", 401);

  const { id: session_id } = await params;
  const body = await request.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const { garmin_activity_id } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("sessions")
    .update({ garmin_activity_id })
    .eq("id", session_id)
    .eq("user_id", user.id);

  if (error) return apiError(error.message);

  return apiSuccess({ linked: garmin_activity_id !== null });
}
