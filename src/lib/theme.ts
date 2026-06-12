/**
 * DA Coach Tri — palette partagée (blanc / noir / vert)
 *
 * Source de vérité pour les couleurs utilisées en style inline (fonds sombres
 * où les classes Tailwind sémantiques ne suffisent pas). Les tokens CSS
 * équivalents vivent dans `globals.css`.
 */

// ── Surfaces ───────────────────────────────────────────────
export const SLATE = "oklch(0.21 0.055 158)"; // vert-noir profond (fond)
export const SURFACE = "oklch(0.25 0.055 158)"; // panneau vert-sombre
export const SURFACE_DEEP = "oklch(0.17 0.05 158)"; // pied de carte
export const DIVIDER = "oklch(1 0 0 / 8%)"; // séparateur sur sombre

// ── Texte ──────────────────────────────────────────────────
export const TEXT = "oklch(0.95 0 0)"; // blanc
export const TEXT_MUTED = "oklch(0.72 0.02 158)"; // gris atténué

// ── Accents ────────────────────────────────────────────────
export const ACCENT = "oklch(0.843 0.165 157)"; // vert menthe — accent triathlon
export const ACCENT_FG = "oklch(0.17 0.05 158)"; // texte sur menthe (vert-noir)
export const GLACIER = "oklch(0.79 0.13 182)"; // teal froid (2nd)

/**
 * Système couleur + picto par discipline.
 * `icon` = emoji conservé comme repli ; `color` = teinte de la pastille/liseré.
 */
export const DISCIPLINE: Record<string, { label: string; color: string; icon: string }> = {
  swim:     { label: "Natation",      color: "oklch(0.74 0.13 233)", icon: "🏊" }, // bleu glacier
  bike:     { label: "Vélo",          color: "oklch(0.843 0.165 157)", icon: "🚴" }, // vert menthe (accent)
  run:      { label: "Course à pied", color: "oklch(0.82 0.15 78)",  icon: "🏃" }, // ambre
  brick:    { label: "Enchaînement",  color: "oklch(0.79 0.13 182)", icon: "⚡" }, // glacier
  strength: { label: "Renforcement",  color: "oklch(0.72 0.04 252)", icon: "💪" }, // acier
  rest:     { label: "Récupération",  color: "oklch(0.60 0.02 252)", icon: "😴" }, // muet
};

export function disciplineColor(d: string | null | undefined): string {
  return DISCIPLINE[d ?? ""]?.color ?? ACCENT;
}

/**
 * Applique une opacité à une couleur `oklch(L C H)` → `oklch(L C H / N%)`.
 * Indispensable pour les teintes/liserés (la concat hex ne marche pas en oklch).
 */
export function withAlpha(color: string, pct: number): string {
  return color.replace(/\)\s*$/, ` / ${pct}%)`);
}
