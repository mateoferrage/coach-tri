"use client";

import { useState } from "react";

const MINT  = "oklch(0.843 0.165 157)";
const DARK  = "oklch(0.116 0.022 155)";
const DIV   = "oklch(1 0 0 / 8%)";

const DISCIPLINE_EMOJI: Record<string, string> = {
  swim: "🏊", bike: "🚴", run: "🏃", triathlon: "🏁", strength: "💪", other: "⚡",
};
const DISCIPLINE_LABEL: Record<string, string> = {
  swim: "Natation", bike: "Vélo", run: "Course", triathlon: "Triathlon", strength: "Muscu", other: "Activité",
};

interface GarminActivity {
  id: string;
  activity_type: string;
  name: string | null;
  started_at: string;
  duration_s: number | null;
  distance_m: number | null;
}

interface Props {
  sessionId: string;
  linkedActivity: GarminActivity | null;
  candidates: GarminActivity[];
}

function fmt(duration_s: number | null, distance_m: number | null, activityType: string): string {
  const parts: string[] = [];
  if (duration_s) {
    const h = Math.floor(duration_s / 3600);
    const m = Math.floor((duration_s % 3600) / 60);
    parts.push(h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`);
  }
  if (distance_m) {
    parts.push(activityType === "swim" ? `${Math.round(distance_m)} m` : `${(distance_m / 1000).toFixed(2)} km`);
  }
  return parts.join(" · ") || "—";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function GarminLinker({ sessionId, linkedActivity, candidates }: Props) {
  const [linked, setLinked] = useState<GarminActivity | null>(linkedActivity);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleLink(garminId: string | null) {
    setPending(true);
    try {
      await fetch(`/api/sessions/${sessionId}/link-garmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garmin_activity_id: garminId }),
      });
      setLinked(garminId ? (candidates.find(c => c.id === garminId) ?? null) : null);
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Activité Garmin liée
      </p>

      {linked ? (
        /* ── Activité liée ── */
        <div
          className="rounded-xl p-4 flex items-start justify-between gap-3"
          style={{ backgroundColor: DARK, border: `1px solid ${MINT}40` }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">{DISCIPLINE_EMOJI[linked.activity_type] ?? "⚡"}</span>
            <div>
              <p className="text-sm font-black" style={{ color: MINT }}>
                {linked.name ?? DISCIPLINE_LABEL[linked.activity_type] ?? "Activité"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "oklch(1 0 0 / 45%)" }}>
                {formatDateTime(linked.started_at)} · {fmt(linked.duration_s, linked.distance_m, linked.activity_type)}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleLink(null)}
            disabled={pending}
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg transition-opacity hover:opacity-70 flex-shrink-0"
            style={{ color: "oklch(1 0 0 / 40%)", border: `1px solid ${DIV}` }}
          >
            Délier
          </button>
        </div>
      ) : (
        /* ── Pas encore liée ── */
        <div>
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="w-full rounded-xl py-3 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-80"
              style={{ backgroundColor: DARK, border: `1px dashed ${MINT}40`, color: MINT }}
            >
              + Lier une activité Garmin
            </button>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
            >
              {candidates.length === 0 ? (
                <p className="px-4 py-5 text-xs text-center" style={{ color: "oklch(1 0 0 / 40%)" }}>
                  Aucune activité Garmin trouvée à ±3 jours de cette séance.
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: DIV }}>
                  {candidates.map(c => (
                    <li key={c.id}>
                      <button
                        onClick={() => handleLink(c.id)}
                        disabled={pending}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-white/5"
                      >
                        <span className="text-lg flex-shrink-0">{DISCIPLINE_EMOJI[c.activity_type] ?? "⚡"}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: "oklch(1 0 0 / 85%)" }}>
                            {c.name ?? DISCIPLINE_LABEL[c.activity_type] ?? "Activité"}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: "oklch(1 0 0 / 40%)" }}>
                            {formatDateTime(c.started_at)} · {fmt(c.duration_s, c.distance_m, c.activity_type)}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-4 py-2" style={{ borderTop: `1px solid ${DIV}` }}>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "oklch(1 0 0 / 30%)" }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
