import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Profil — Coach Tri" };

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
  elite: "Elite",
};

const DISCIPLINE_LABELS: Record<string, string> = {
  swim: "Natation",
  bike: "Vélo",
  run: "Course à pied",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single() as { data: { first_name: string | null; level: string | null; weight_kg: number | null; weekly_hours_avg: number | null; available_disciplines: string[] | null } | null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: garminCreds } = await (supabase as any)
    .from("garmin_credentials")
    .select("last_sync_at")
    .eq("user_id", user!.id)
    .single() as { data: { last_sync_at: string | null } | null };

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Profil</h1>

      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">Prénom</dt>
                <dd className="font-medium">{profile.first_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Niveau</dt>
                <dd className="font-medium">{profile.level ? LEVEL_LABELS[profile.level] : "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Poids</dt>
                <dd className="font-medium">{profile.weight_kg ? `${profile.weight_kg} kg` : "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Heures/semaine</dt>
                <dd className="font-medium">{profile.weekly_hours_avg ? `${profile.weekly_hours_avg}h` : "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-zinc-500 mb-2">Disciplines</dt>
                <dd className="flex gap-2 flex-wrap">
                  {(profile.available_disciplines ?? []).map((d: string) => (
                    <Badge key={d} variant="secondary">
                      {DISCIPLINE_LABELS[d] ?? d}
                    </Badge>
                  ))}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-zinc-500">Profil non configuré. <a href="/onboarding" className="underline">Configurer</a></p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Garmin Connect</CardTitle>
          <CardDescription>État de la synchronisation</CardDescription>
        </CardHeader>
        <CardContent>
          {garminCreds ? (
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm">
                Connecté — dernière sync:{" "}
                {garminCreds.last_sync_at
                  ? new Date(garminCreds.last_sync_at).toLocaleDateString("fr-FR")
                  : "jamais"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Aucun compte Garmin connecté.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
