import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Tableau de bord — Coach Tri" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("first_name, level")
    .eq("id", user!.id)
    .single() as { data: { first_name: string | null; level: string | null } | null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wellness } = await (supabase as any)
    .from("garmin_wellness")
    .select("hrv_rmssd, body_battery_start, resting_hr, date")
    .eq("user_id", user!.id)
    .order("date", { ascending: false })
    .limit(1)
    .single() as { data: { hrv_rmssd: number | null; body_battery_start: number | null; resting_hr: number | null; date: string } | null };

  const firstName = profile?.first_name ?? "Athlète";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Bonjour, {firstName}</h1>
        <p className="text-zinc-500 mt-1">Voici votre tableau de bord d&apos;entraînement</p>
      </div>

      {/* Métriques Garmin */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Métriques récentes</h2>
          <form action="/api/garmin/sync" method="POST">
            <Button type="submit" variant="outline" size="sm">
              Synchroniser Garmin
            </Button>
          </form>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>HRV (RMSSD)</CardDescription>
              <CardTitle className="text-3xl">
                {wellness?.hrv_rmssd ? `${Math.round(wellness.hrv_rmssd)} ms` : "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Body Battery</CardDescription>
              <CardTitle className="text-3xl">
                {wellness?.body_battery_start ?? "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>FC repos</CardDescription>
              <CardTitle className="text-3xl">
                {wellness?.resting_hr ? `${wellness.resting_hr} bpm` : "—"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Séance du jour */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Aujourd&apos;hui</h2>
        <Card>
          <CardContent className="py-12 text-center text-zinc-500">
            <p className="mb-4">Aucun programme actif.</p>
            <Link href="/program/new" className="inline-flex items-center justify-center rounded-lg border border-transparent bg-primary text-primary-foreground text-sm font-medium px-4 py-2 transition-all hover:bg-primary/80">
              Créer un programme
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
