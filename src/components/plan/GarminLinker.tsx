"use client";

import { useState } from "react";

const MINT    = "oklch(0.843 0.165 157)";
const DARK    = "oklch(0.116 0.022 155)";
const DIV     = "oklch(1 0 0 / 8%)";
const MUTED   = "oklch(1 0 0 / 40%)";

const DISCIPLINE_EMOJI: Record<string, string> = {
  swim: "🏊", bike: "🚴", run: "🏃", triathlon: "🏁", strength: "💪", other: "⚡",
};
const DISCIPLINE_LABEL: Record<string, string> = {
  swim: "Natation", bike: "Vélo", run: "Course", triathlon: "Triathlon", strength: "Muscu", other: "Activité",
};

const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  excellent: { label: "Excellent", color: MINT,                   bg: "oklch(0.843 0.165 157 / 12%)" },
  good:      { label: "Bonne séance",  color: "oklch(0.78 0.14 157)", bg: "oklch(0.78 0.14 157 / 10%)" },
  average:   { label: "Correcte",  color: "oklch(0.78 0.16 75)",   bg: "oklch(0.78 0.16 75 / 10%)"  },
  poor:      { label: "À revoir",  color: "oklch(0.65 0.20 25)",   bg: "oklch(0.65 0.20 25 / 10%)"  },
};

interface GarminActivity {
  id: string;
  activity_type: string;
  name: string | null;
  started_at: string;
  duration_s: number | null;
  distance_m: number | null;
}

interface CoachReview {
  verdict: "excellent" | "good" | "average" | "poor";
  message: string;
}

interface Props {
  sessionId: string;
  linkedActivity: GarminActivity | null;
  candidates: GarminActivity[];
  initialReview?: CoachReview | null;
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

export function GarminLinker({ sessionId, linkedActivity, candidates, initialReview }: Props) {
  const [linked, setLinked]               = useState<GarminActivity | null>(linkedActivity);
  const [pending, setPending]             = useState(false);
  const [open, setOpen]                   = useState(false);
  const [review, setReview]               = useState<CoachReview | null>(initialReview ?? null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError]     = useState<string | null>(null);

  async function fetchReview() {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/coach-review`, { method: "POST" });
      const json = await res.json() as { data?: CoachReview; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      if (json.data) setReview(json.data);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Impossible d'obtenir le retour du coach");
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleLink(garminId: string | null) {
    setPending(true);
    try {
      await fetch(`/api/sessions/${sessionId}/link-garmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garmin_activity_id: garminId }),
      });
      const found = garminId ? (candidates.find(c => c.id === garminId) ?? null) : null;
      setLinked(found);
      setOpen(false);
      if (garminId) {
        setReview(null);
        fetchReview();
      } else {
        setReview(null);
      }
    } finally {
      setPending(false);
    }
  }

  const verdictCfg = review ? (VERDICT_CONFIG[review.verdict] ?? VERDICT_CONFIG.good) : null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
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
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                {formatDateTime(linked.started_at)} · {fmt(linked.duration_s, linked.distance_m, linked.activity_type)}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleLink(null)}
            disabled={pending}
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg transition-opacity hover:opacity-70 flex-shrink-0"
            style={{ color: MUTED, border: `1px solid ${DIV}` }}
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
                <p className="px-4 py-5 text-xs text-center" style={{ color: MUTED }}>
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
                          <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
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

      {/* ── Retour du coach ── */}
      {linked && (
        <div className="space-y-2">
          {reviewLoading && (
            <div
              className="rounded-xl px-4 py-4 flex items-center gap-3"
              style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
            >
              <span className="text-base animate-spin inline-block">⏳</span>
              <p className="text-xs" style={{ color: MUTED }}>
                Le coach analyse ta séance…
              </p>
            </div>
          )}

          {reviewError && !reviewLoading && (
            <div
              className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              style={{ backgroundColor: DARK, border: `1px solid oklch(0.65 0.20 25 / 30%)` }}
            >
              <p className="text-xs" style={{ color: "oklch(0.65 0.20 25)" }}>
                {reviewError}
              </p>
              <button
                onClick={fetchReview}
                className="text-[10px] font-bold uppercase tracking-widest flex-shrink-0"
                style={{ color: MINT }}
              >
                Réessayer
              </button>
            </div>
          )}

          {review && !reviewLoading && verdictCfg && (
            <div
              className="rounded-xl px-4 py-4 space-y-2"
              style={{ backgroundColor: verdictCfg.bg, border: `1px solid ${verdictCfg.color}30` }}
            >
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>
                  Retour du coach
                </p>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${verdictCfg.color}20`, color: verdictCfg.color }}
                >
                  {verdictCfg.label}
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "oklch(1 0 0 / 80%)" }}>
                {review.message}
              </p>
              <button
                onClick={fetchReview}
                className="text-[10px] font-bold uppercase tracking-widest mt-1"
                style={{ color: MUTED }}
              >
                Régénérer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
