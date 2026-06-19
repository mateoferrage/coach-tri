/**
 * DA Coach Tri — palette partagée (Piste A « Lagune » — clair, teal Zendesk)
 *
 * Source de vérité pour les couleurs utilisées en style inline (surfaces claires
 * où les classes Tailwind sémantiques ne suffisent pas). Les tokens CSS
 * équivalents vivent dans `globals.css`.
 */

// ── Surfaces ───────────────────────────────────────────────
export const SLATE = 'oklch(0.94 0.004 220)' // fond page — gris clair quasi neutre (gris / blanc cassé)
export const SURFACE = 'oklch(1 0 0)' // panneau blanc
export const SURFACE_DEEP = 'oklch(0.9 0.028 195)' // bandeaux/inserts — brume lagune (teal clair, démarqué du blanc)
export const DIVIDER = 'oklch(0.287 0.047 217.9 / 14%)' // séparateur sombre sur clair

// ── Texte ──────────────────────────────────────────────────
export const TEXT = 'oklch(0.287 0.047 217.9)' // canard profond
export const TEXT_MUTED = 'oklch(0.504 0.038 203.1)' // teal atténué
export const TEXT_FAINT = 'oklch(0.287 0.047 217.9 / 70%)' // canard estompé (labels 2nd) — min 70% pour passer WCAG AA 4.5:1

// ── Accents ────────────────────────────────────────────────
export const ACCENT = 'oklch(0.306 0.051 209.3)' // canard profond — accent/boutons
export const ACCENT_FG = 'oklch(1 0 0)' // texte clair sur canard
export const GLACIER = 'oklch(0.546 0.094 183.4)' // teal-vert (2nd)

/**
 * Système couleur + picto par discipline.
 * `icon` = emoji conservé comme repli ; `color` = teinte de la pastille/liseré.
 */
export const DISCIPLINE: Record<string, { label: string; color: string; icon: string }> = {
  swim: { label: 'Natation', color: 'oklch(0.559 0.101 237.5)', icon: '🏊' }, // bleu glacier
  bike: { label: 'Vélo', color: 'oklch(0.546 0.094 183.4)', icon: '🚴' }, // teal-vert
  run: { label: 'Course à pied', color: 'oklch(0.624 0.121 64.7)', icon: '🏃' }, // ambre
  brick: { label: 'Enchaînement', color: 'oklch(0.520 0.075 215)', icon: '⚡' }, // cyan profond
  strength: { label: 'Renforcement', color: 'oklch(0.540 0.024 203.9)', icon: '💪' }, // acier
  rest: { label: 'Récupération', color: 'oklch(0.620 0.018 200)', icon: '😴' }, // muet
}

export function disciplineColor(d: string | null | undefined): string {
  return DISCIPLINE[d ?? '']?.color ?? ACCENT
}

/** Système couleur + label par type d'événement personnel (agenda). */
// Couleurs calées pour passer WCAG AA (≥ 4.5:1) en texte sur fond blanc ET sur
// leur propre teinte à 14 % (rendu des blocs du calendrier). Cf. scripts/a11y-contrast.mjs.
export const EVENT_TYPE: Record<string, { label: string; color: string }> = {
  cours: { label: 'Cours', color: 'oklch(0.47 0.16 300)' }, // violet
  stage: { label: 'Stage', color: 'oklch(0.50 0.13 64.7)' }, // ambre
  rdv: { label: 'RDV', color: 'oklch(0.46 0.09 183.4)' }, // teal-vert
  autre: { label: 'Autre', color: 'oklch(0.48 0.024 203.9)' }, // acier
}

export function eventTypeColor(t: string | null | undefined): string {
  return EVENT_TYPE[t ?? '']?.color ?? EVENT_TYPE.autre.color
}

export function eventTypeLabel(t: string | null | undefined): string {
  return EVENT_TYPE[t ?? '']?.label ?? EVENT_TYPE.autre.label
}

/**
 * Applique une opacité à une couleur `oklch(L C H)` → `oklch(L C H / N%)`.
 * Indispensable pour les teintes/liserés (la concat hex ne marche pas en oklch).
 */
export function withAlpha(color: string, pct: number): string {
  return color.replace(/\)\s*$/, ` / ${pct}%)`)
}
