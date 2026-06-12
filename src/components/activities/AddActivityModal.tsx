"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MINT = "oklch(0.843 0.165 157)";
const DARK = "oklch(0.25 0.055 158)";
const DIV  = "oklch(1 0 0 / 8%)";
const BG   = "oklch(0.25 0.055 158)";
const BG2  = "oklch(0.17 0.05 158)";

const DISCIPLINES = [
  { value: "run",      label: "Course",   icon: "🏃" },
  { value: "bike",     label: "Vélo",     icon: "🚴" },
  { value: "swim",     label: "Natation", icon: "🏊" },
  { value: "strength", label: "Muscu",    icon: "💪" },
  { value: "other",    label: "Autre",    icon: "⚡" },
];

const inputStyle = {
  backgroundColor: BG2,
  border: "1px solid oklch(1 0 0 / 10%)",
  color: "oklch(0.97 0 0)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "oklch(1 0 0 / 38%)" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

export function AddActivityModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [form, setForm] = useState({
    discipline: "run",
    name: "",
    date: today,
    time: nowTime,
    duration_min: "",
    distance: "",
    avg_hr: "",
    elevation_gain_m: "",
  });

  const isSwim     = form.discipline === "swim";
  const isStrength = form.discipline === "strength";
  const discInfo   = DISCIPLINES.find(d => d.value === form.discipline)!;

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setApiError(null);
  }

  function handleClose() {
    setOpen(false);
    setApiError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const duration_min = parseFloat(form.duration_min);
    if (!duration_min || duration_min <= 0) {
      setApiError("La durée est requise");
      return;
    }

    const rawDist = parseFloat(form.distance);
    const distance_m = form.distance
      ? isSwim ? rawDist : rawDist * 1000
      : undefined;

    const payload = {
      discipline: form.discipline,
      name: form.name || undefined,
      started_at: `${form.date}T${form.time}:00`,
      duration_min,
      ...(distance_m    ? { distance_m }                        : {}),
      ...(form.avg_hr   ? { avg_hr: parseInt(form.avg_hr) }     : {}),
      ...(form.elevation_gain_m ? { elevation_gain_m: parseFloat(form.elevation_gain_m) } : {}),
    };

    setLoading(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        setApiError(body.error ?? "Erreur lors de l'ajout");
        return;
      }
      handleClose();
      router.refresh();
    } catch {
      setApiError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold uppercase tracking-widest px-4 py-2.5 rounded-xl transition-opacity hover:opacity-80"
        style={{ backgroundColor: MINT, color: DARK }}
      >
        + Activité
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: "oklch(0 0 0 / 65%)" }}
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ backgroundColor: BG, border: `1px solid ${DIV}` }}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${DIV}`, backgroundColor: BG2 }}
            >
              <p className="font-semibold uppercase tracking-widest text-sm" style={{ color: MINT }}>
                Ajouter une activité
              </p>
              <button
                onClick={handleClose}
                className="text-base leading-none transition-opacity hover:opacity-60"
                style={{ color: "oklch(1 0 0 / 40%)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Discipline */}
              <Field label="Discipline">
                <div className="grid grid-cols-5 gap-1.5">
                  {DISCIPLINES.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => set("discipline", d.value)}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
                      style={{
                        backgroundColor: form.discipline === d.value ? `${MINT}20` : BG2,
                        border: `1px solid ${form.discipline === d.value ? MINT : "oklch(1 0 0 / 8%)"}`,
                        color: form.discipline === d.value ? MINT : "oklch(1 0 0 / 45%)",
                      }}
                    >
                      <span className="text-xl leading-none">{d.icon}</span>
                      <span className="text-[8px] font-bold uppercase tracking-widest">{d.label}</span>
                    </button>
                  ))}
                </div>
              </Field>

              {/* Titre */}
              <Field label={`Titre (optionnel)`}>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder={`${discInfo.icon} ${discInfo.label}`}
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none"
                  style={inputStyle}
                />
              </Field>

              {/* Date + Heure */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => set("date", e.target.value)}
                    required
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Heure">
                  <input
                    type="time"
                    value={form.time}
                    onChange={e => set("time", e.target.value)}
                    required
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none"
                    style={inputStyle}
                  />
                </Field>
              </div>

              {/* Durée + Distance */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Durée (min)">
                  <input
                    type="number"
                    value={form.duration_min}
                    onChange={e => set("duration_min", e.target.value)}
                    placeholder="60"
                    min={1}
                    required
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none"
                    style={inputStyle}
                  />
                </Field>
                {!isStrength && (
                  <Field label={`Distance (${isSwim ? "m" : "km"})`}>
                    <input
                      type="number"
                      value={form.distance}
                      onChange={e => set("distance", e.target.value)}
                      placeholder={isSwim ? "1500" : "10.5"}
                      step={isSwim ? "50" : "0.01"}
                      min={0}
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none"
                      style={inputStyle}
                    />
                  </Field>
                )}
              </div>

              {/* FC + Dénivelé */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="FC moy. (bpm)">
                  <input
                    type="number"
                    value={form.avg_hr}
                    onChange={e => set("avg_hr", e.target.value)}
                    placeholder="145"
                    min={40}
                    max={220}
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none"
                    style={inputStyle}
                  />
                </Field>
                {!isSwim && !isStrength && (
                  <Field label="Dénivelé+ (m)">
                    <input
                      type="number"
                      value={form.elevation_gain_m}
                      onChange={e => set("elevation_gain_m", e.target.value)}
                      placeholder="200"
                      min={0}
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none"
                      style={inputStyle}
                    />
                  </Field>
                )}
              </div>

              {apiError && (
                <p className="text-xs font-medium" style={{ color: "oklch(0.65 0.20 25)" }}>
                  {apiError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold uppercase tracking-widest text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: MINT, color: DARK }}
              >
                {loading ? "Enregistrement…" : "Enregistrer l'activité"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
