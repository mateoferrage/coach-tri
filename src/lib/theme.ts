/**
 * DA Coach Tri — « Élan » (Sky Blue, Cloudy White, Amber Red)
 *
 * Source de vérité pour les couleurs utilisées en style inline. Les tokens CSS
 * équivalents vivent dans `globals.css`. Toutes les valeurs sont en oklch :
 * `withAlpha()` en dépend.
 */

// ── Palette Élan ───────────────────────────────────────────
export const SKY = 'oklch(0.669 0.184 248.8)' // #0099FF — aplats, menu, données
export const SKY_INK = 'oklch(0.542 0.151 249.3)' // #0072C2 — petit texte bleu sur blanc (AA)
export const SKY_TINT = 'oklch(0.960 0.021 241.3)' // #E6F4FF — survol, sélection, panneau coach
export const CLOUD = 'oklch(0.994 0.001 286.4)' // #FDFDFE — fond
export const AMBER_RED = 'oklch(0.627 0.201 33.0)' // #E8492A — aujourd'hui, action principale, Z4-Z5
export const AMBER_RED_DEEP = 'oklch(0.555 0.188 32.7)' // #C9361A — survol, texte rouge sur blanc
export const INK = 'oklch(0.213 0.038 251.4)' // #0B1A2A — texte
export const INK_MUTED = 'oklch(0.520 0.035 250.0)' // #5A6B7D — texte secondaire
export const LINE = 'oklch(0.932 0.010 252.8)' // #E4E9EF — filets

// ── Alias historiques ─────────────────────────────────────
// Remappés sur la palette Élan pour ne rien casser pendant la transition.
// Supprimés à l'étape 3, quand chaque page aura été reprise.
export const SLATE = CLOUD
export const SURFACE = 'oklch(1 0 0)'
export const SURFACE_DEEP = SKY_TINT
export const DIVIDER = LINE
export const TEXT = INK
export const TEXT_MUTED = INK_MUTED
export const TEXT_FAINT = 'oklch(0.430 0.042 248.8)' // #3E5266 — AA sur blanc
export const ACCENT = SKY_INK // bleu lisible : ACCENT sert aussi de couleur de texte
export const ACCENT_FG = 'oklch(1 0 0)'
export const GLACIER = SKY

/**
 * Libellé + picto par discipline.
 * Plus de couleur par discipline (spec Élan) : toutes passent en bleu, le repos
 * en gris. `icon` (emoji) est conservé jusqu'à l'étape 3, où il est remplacé
 * par `DisciplineIcon` (lucide).
 */
export const DISCIPLINE: Record<string, { label: string; color: string; icon: string }> = {
  swim: { label: 'Natation', color: SKY_INK, icon: '🏊' },
  bike: { label: 'Vélo', color: SKY_INK, icon: '🚴' },
  run: { label: 'Course à pied', color: SKY_INK, icon: '🏃' },
  brick: { label: 'Enchaînement', color: SKY_INK, icon: '⚡' },
  strength: { label: 'Renforcement', color: SKY_INK, icon: '💪' },
  rest: { label: 'Récupération', color: INK_MUTED, icon: '😴' },
}

export function disciplineColor(d: string | null | undefined): string {
  return DISCIPLINE[d ?? '']?.color ?? ACCENT
}

// ── Échelle d'intensité ───────────────────────────────────
export type IntensitySurface = 'white' | 'blue'

const INTENSITY_ON_WHITE = [
  'oklch(0.930 0.021 241.4)', // Z1 #DCEAF5
  'oklch(0.885 0.064 238.5)', // Z2 #B3E0FF
  'oklch(0.782 0.124 240.0)', // Z3 #66C2FF
  AMBER_RED, // Z4
  AMBER_RED, // Z5
] as const

const INTENSITY_ON_BLUE = [
  'oklch(1 0 0 / 40%)',
  'oklch(1 0 0 / 40%)',
  'oklch(1 0 0 / 72%)',
  AMBER_RED,
  AMBER_RED,
] as const

/**
 * Couleur d'une zone d'intensité (1 à 5) selon la surface où elle est posée.
 * Les valeurs hors échelle sont arrondies puis bornées ; NaN vaut Z1.
 */
export function intensityColor(zone: number, surface: IntensitySurface = 'white'): string {
  const z = Number.isFinite(zone) ? Math.min(5, Math.max(1, Math.round(zone))) : 1
  return (surface === 'blue' ? INTENSITY_ON_BLUE : INTENSITY_ON_WHITE)[z - 1]
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
