import { createClient } from "@/lib/supabase/server";
import { GarminConnectCard } from "@/components/garmin/GarminConnectCard";

export const metadata = { title: "Profil — Coach Tri" };

const MINT  = "oklch(0.843 0.165 157)";
const DARK  = "oklch(0.116 0.022 155)";
const DIV   = "oklch(1 0 0 / 8%)";

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant", intermediate: "Intermédiaire",
  advanced: "Avancé", elite: "Élite",
};
const DISCIPLINE_LABELS: Record<string, string> = {
  swim: "Natation 🏊", bike: "Vélo 🚴", run: "Course 🏃",
};

/* ── Sub-components ───────────────────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </p>
  );
}

function StatBlock({ label, value, unit, sub }: {
  label: string; value: string | number | null; unit?: string; sub?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 space-y-1"
      style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "oklch(1 0 0 / 38%)" }}>
        {label}
      </p>
      {value != null ? (
        <p className="text-2xl font-black leading-tight" style={{ color: MINT }}>
          {value}
          {unit && <span className="text-sm font-medium ml-1" style={{ color: "oklch(1 0 0 / 45%)" }}>{unit}</span>}
        </p>
      ) : (
        <p className="text-2xl font-black" style={{ color: "oklch(1 0 0 / 20%)" }}>—</p>
      )}
      {sub && <p className="text-[10px]" style={{ color: "oklch(1 0 0 / 30%)" }}>{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: DIV }}>
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

/* ── PR helpers ───────────────────────────────────────────────────────────── */

function formatSecondsToTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Garmin PR type keys vary — match by distance (meters)
const PR_LABELS: { dist: number; label: string; swim?: boolean }[] = [
  { dist: 400,     label: "400m", swim: true },
  { dist: 1000,    label: "1 km" },
  { dist: 1609,    label: "1 mile" },
  { dist: 5000,    label: "5 km" },
  { dist: 10000,   label: "10 km" },
  { dist: 21097,   label: "Semi" },
  { dist: 42195,   label: "Marathon" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePRs(raw: any): { label: string; time: string; date: string | null }[] {
  if (!Array.isArray(raw)) return [];
  const results: { label: string; time: string; date: string | null }[] = [];

  for (const tpl of PR_LABELS) {
    // find a PR record matching distance (±5%)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = raw.find((pr: any) => {
      const d = pr.distance ?? pr.prDistance ?? 0;
      return Math.abs(d - tpl.dist) / tpl.dist < 0.05;
    });
    if (match) {
      const secs = match.duration ?? match.value ?? match.time ?? null;
      if (secs) {
        results.push({
          label: tpl.label,
          time: formatSecondsToTime(Number(secs)),
          date: match.prStartTimeGmtFormatted?.split(" ")[0] ??
                match.activityStartDateLocal?.split("T")[0] ?? null,
        });
      }
    }
  }
  return results;
}

/* ── Volume helpers ───────────────────────────────────────────────────────── */

type ActivityRow = {
  activity_type: string;
  distance_m: number | null;
  duration_s: number | null;
  aerobic_te: number | null;
};

function computeVolumes(activities: ActivityRow[]) {
  const vol: Record<string, { km: number; h: number; count: number; te: number[] }> = {};
  for (const a of activities) {
    const t = a.activity_type;
    if (!vol[t]) vol[t] = { km: 0, h: 0, count: 0, te: [] };
    vol[t].km    += (a.distance_m ?? 0) / 1000;
    vol[t].h     += (a.duration_s ?? 0) / 3600;
    vol[t].count += 1;
    if (a.aerobic_te) vol[t].te.push(a.aerobic_te);
  }
  return vol;
}

/* ── Wellness helpers ─────────────────────────────────────────────────────── */

type WellnessRow = {
  hrv_rmssd: number | null;
  body_battery_start: number | null;
  resting_hr: number | null;
  steps: number | null;
  sleep_duration_s: number | null;
};

function avg(arr: number[]): number | null {
  if (!arr.length) return null;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profileRes, garminCredsRes, garminStatsRes, wellnessRes, activitiesRes] = await Promise.all([
    (supabase as any).from("profiles")
      .select("first_name, level, weight_kg, weekly_hours_avg, available_disciplines, birth_date")
      .eq("id", user!.id).single(),

    (supabase as any).from("garmin_credentials")
      .select("last_sync_at").eq("user_id", user!.id).single(),

    (supabase as any).from("garmin_stats")
      .select("*").eq("user_id", user!.id).single(),

    (supabase as any).from("garmin_wellness")
      .select("hrv_rmssd, body_battery_start, resting_hr, steps, sleep_duration_s")
      .eq("user_id", user!.id)
      .gte("date", sevenDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: false }),

    (supabase as any).from("garmin_activities")
      .select("activity_type, distance_m, duration_s, aerobic_te")
      .eq("user_id", user!.id)
      .gte("started_at", thirtyDaysAgo.toISOString())
      .order("started_at", { ascending: false }),
  ]);

  const profile     = profileRes.data as {
    first_name: string | null; level: string | null; weight_kg: number | null;
    weekly_hours_avg: number | null; available_disciplines: string[] | null; birth_date: string | null;
  } | null;
  const garminCreds = garminCredsRes.data as { last_sync_at: string | null } | null;
  const gStats      = garminStatsRes.data as Record<string, unknown> | null;
  const wellness    = (wellnessRes.data ?? []) as WellnessRow[];
  const activities  = (activitiesRes.data ?? []) as ActivityRow[];

  // Volume 30j
  const volumes = computeVolumes(activities);
  const totalHours30 = Object.values(volumes).reduce((s, v) => s + v.h, 0);

  // Personal records
  const prs = parsePRs(gStats?.personal_records);

  // Training readiness color
  const readiness = gStats?.training_readiness as number | null;
  const readinessColor = !readiness ? "oklch(1 0 0 / 20%)"
    : readiness >= 70 ? MINT
    : readiness >= 40 ? "oklch(0.82 0.16 85)"
    : "oklch(0.65 0.20 25)";

  const disciplines = profile?.available_disciplines ?? [];

  return (
    <div className="space-y-10 max-w-2xl">

      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mon compte</p>
        <h1 className="text-3xl font-black uppercase tracking-tight">Profil</h1>
      </div>

      {/* ── Volume 30 jours ── */}
      {activities.length > 0 && (
        <section>
          <SectionTitle>Volume · 30 derniers jours</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBlock
              label="Total"
              value={totalHours30 > 0 ? totalHours30.toFixed(1) : null}
              unit="h"
              sub={`${activities.length} séances`}
            />
            {["swim", "bike", "run"].map(type => {
              const v = volumes[type];
              return (
                <StatBlock
                  key={type}
                  label={DISCIPLINE_LABELS[type] ?? type}
                  value={v ? (type === "swim" ? `${Math.round(v.km * 10) / 10} km` : `${v.km.toFixed(0)} km`) : null}
                  sub={v ? `${v.h.toFixed(1)}h · ${v.count} séances` : undefined}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Identité Garmin ── */}
      {!!(gStats?.display_name) && (
        <section>
          <SectionTitle>Compte Garmin</SectionTitle>
          <div
            className="rounded-2xl px-5 py-4 flex items-center gap-4"
            style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
          >
            {gStats.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gStats.profile_image_url as string}
                alt="Avatar Garmin"
                className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                style={{ border: `2px solid ${MINT}40` }}
              />
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: `${MINT}18`, border: `1px solid ${MINT}30` }}
              >
                🏃
              </div>
            )}
            <div>
              <p className="font-black text-lg" style={{ color: "oklch(0.97 0 0)" }}>
                {gStats.display_name as string}
              </p>
              {!!(gStats.garmin_username) && (
                <p className="text-xs mt-0.5" style={{ color: "oklch(1 0 0 / 40%)" }}>
                  @{gStats.garmin_username as string}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Forme physique ── */}
      {!gStats && garminCreds && (
        <section>
          <SectionTitle>Forme physique</SectionTitle>
          <div
            className="rounded-2xl px-5 py-6 text-center space-y-2"
            style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
          >
            <p className="text-2xl">📊</p>
            <p className="text-sm font-bold" style={{ color: "oklch(1 0 0 / 60%)" }}>
              Lance un sync Garmin pour voir tes métriques de forme
            </p>
            <p className="text-xs" style={{ color: "oklch(1 0 0 / 30%)" }}>
              VO2 Max course &amp; vélo, âge de forme…
            </p>
          </div>
        </section>
      )}
      {gStats && (
        <section>
          <SectionTitle>Forme physique</SectionTitle>
          {/* VO2 Max — always shown (may be — if not measured yet) */}
          <div className="grid grid-cols-2 gap-3">
            <StatBlock
              label="VO2 Max course"
              value={gStats.vo2max_run != null ? Math.round(gStats.vo2max_run as number) : null}
              unit="ml/kg/min"
              sub={(gStats.vo2max_run as number) >= 55 ? "Excellent" : (gStats.vo2max_run as number) >= 45 ? "Bon" : undefined}
            />
            <StatBlock
              label="VO2 Max vélo"
              value={gStats.vo2max_bike != null ? Math.round(gStats.vo2max_bike as number) : null}
              unit="ml/kg/min"
              sub={(gStats.vo2max_bike as number) >= 55 ? "Excellent" : (gStats.vo2max_bike as number) >= 45 ? "Bon" : undefined}
            />
          </div>

          {/* Training Readiness + Load — only shown if available */}
          {!!(gStats.training_readiness != null || gStats.training_load_7d != null || gStats.training_load_28d != null) && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {gStats.training_readiness != null && (
                <div
                  className="rounded-xl p-4 space-y-1"
                  style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "oklch(1 0 0 / 38%)" }}>
                    Readiness
                  </p>
                  <p className="text-2xl font-black leading-tight" style={{ color: readinessColor }}>
                    {readiness}
                    <span className="text-sm font-medium ml-1" style={{ color: "oklch(1 0 0 / 45%)" }}>/100</span>
                  </p>
                  <p className="text-[10px]" style={{ color: "oklch(1 0 0 / 30%)" }}>
                    {(readiness ?? 0) >= 70 ? "Prêt" : (readiness ?? 0) >= 40 ? "Modéré" : "Fatigué"}
                  </p>
                </div>
              )}
              {gStats.training_load_7d != null && (
                <StatBlock label="Charge 7j" value={Math.round(gStats.training_load_7d as number)} unit="TSS" />
              )}
              {gStats.training_load_28d != null && (
                <StatBlock label="Charge 28j" value={Math.round(gStats.training_load_28d as number)} unit="TSS" />
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Records personnels ── */}
      {prs.length > 0 && (
        <section>
          <SectionTitle>Records personnels</SectionTitle>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
          >
            {prs.map(pr => (
              <div
                key={pr.label}
                className="flex items-center justify-between px-5 py-3 border-b last:border-0"
                style={{ borderColor: DIV }}
              >
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {pr.label}
                </span>
                <div className="text-right">
                  <span className="font-black text-base" style={{ color: MINT }}>{pr.time}</span>
                  {pr.date && (
                    <span className="text-[10px] ml-2" style={{ color: "oklch(1 0 0 / 30%)" }}>
                      {new Date(pr.date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Informations personnelles ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Informations personnelles</SectionTitle>
          <a
            href="/onboarding"
            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors hover:opacity-70"
            style={{ color: MINT, borderColor: `${MINT}40` }}
          >
            Modifier
          </a>
        </div>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
        >
          <div className="px-5 divide-y" style={{ borderColor: DIV }}>
            <InfoRow label="Prénom"       value={profile?.first_name ?? "—"} />
            <InfoRow label="Niveau"       value={profile?.level ? LEVEL_LABELS[profile.level] : "—"} />
            <InfoRow label="Poids"        value={profile?.weight_kg ? `${profile.weight_kg} kg` : "—"} />
            <InfoRow label="Disponibilité" value={profile?.weekly_hours_avg ? `${profile.weekly_hours_avg}h / semaine` : "—"} />
            <InfoRow
              label="Disciplines"
              value={disciplines.length > 0
                ? disciplines.map(d => DISCIPLINE_LABELS[d]?.split(" ")[0] ?? d).join(" · ")
                : "—"}
            />
          </div>
        </div>
      </section>

      {/* ── Garmin Connect ── */}
      <section>
        <SectionTitle>Connexion Garmin</SectionTitle>
        <GarminConnectCard
          connected={garminCreds !== null}
          lastSyncAt={garminCreds?.last_sync_at ?? null}
        />
      </section>
    </div>
  );
}
