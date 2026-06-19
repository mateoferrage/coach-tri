# Refonte « remise au carré » du calendrier — Design

**Date** : 2026-06-19
**Périmètre** : Remise au carré du module calendrier (vue semaine + `schedule_events`). On garde
l'architecture existante ; on la rend professionnelle, testée et conforme à la charte. **Aucune
nouvelle fonctionnalité** (pas de vue jour/mois, pas de DnD tactile, pas de récurrence avancée).

## Contexte & motivation

Le module calendrier compile (`tsc --noEmit` passe) mais présente plusieurs problèmes de fond
identifiés à l'audit :

1. **Hors charte graphique.** `WeekCalendar.tsx` est codé en hex sombres hardcodés (`#15261c`,
   `#1a2e22`, `rgba(255,255,255,…)`) hérités d'un ancien thème dark. L'app est passée au thème
   clair « Lagune ». `AGENTS.md` impose les tokens OKLCH inline et interdit les fonds sombres /
   blancs littéraux.
2. **Aucun test** sur la logique la plus piégeuse (`expandEvents` — récurrence, bornes de série,
   jour ISO, fuseaux). `AGENTS.md` exige `npm test` dans la chaîne de vérification.
3. **Dates fragiles** : manipulation par strings (`new Date(s + 'T00:00:00')`, slices) éparpillée.
4. **Chevauchements non gérés** : les créneaux simultanés se superposent visuellement (tous en
   `left:3 right:3`).
5. **Erreurs réseau silencieuses** : `if (res.ok) …` sans `else`, pas d'état vide.
6. **A11y** : grille non navigable au clavier, events = `div` cliquables sans rôle/focus.
7. **Dette** : `try/fallback session_time` dans `/api/sessions` (la colonne existe — migration
   `0015_session_time.sql`), maps de couleurs/labels dupliquées alors que `theme.ts` les fournit.

## Décisions cadrées avec l'utilisateur

- **Périmètre** : remise au carré (option 1), pas de nouvelles fonctionnalités.
- **Validation** : chaîne verte **et** vérification visuelle en navigateur.
- **Approche** : B — extraction de la logique pure testable + passage aux tokens.
- **Dates** : `date-fns` partout (déjà au projet), helpers minces autour. Pas de lib ajoutée.

## Architecture

### 1. Couche données pure — `src/lib/calendar/`

Trois modules purs (sans React), chacun avec un `*.test.ts` colocalisé (convention existante :
`src/lib/activities/unify.test.ts`). Tests exécutés par Vitest.

**`recurrence.ts`**

- Déplace `expandEvents(rows, weekStart)` depuis `src/app/api/schedule/route.ts` (la route
  l'importe désormais).
- Signature inchangée : `(rows: ScheduleEventRow[], weekStart: Date) => CalendarEvent[]`.
- Tests : événement one-off dans la fenêtre / hors fenêtre ; récurrent générant plusieurs
  occurrences ; respect de `recurrence_end_date` (borne incluse) ; jour antérieur à `event_date`
  exclu ; `recurrence_day` déduit de `event_date` quand absent ; `recurrence_day` explicite
  prioritaire.

**`time.ts`**

- `timeToFrac(t: string): number` — déplacé depuis `WeekCalendar.tsx`.
- `parseLocalDate(s: string): Date` — parse `yyyy-MM-dd` en date **locale** (remplace les
  `new Date(s + 'T00:00:00')` épars), implémenté via `date-fns` (`parse`/`parseISO` selon le cas).
- Tests : `timeToFrac` sur `00:00`, `06:30`, `22:00` ; `parseLocalDate` ne décale pas le jour en
  soirée (pas de bascule UTC).

**`layout.ts`**

- `topPx(h)`, `heightPx(start, end)` — déplacés depuis `WeekCalendar.tsx` (constantes
  `HOUR_PX`/`START_HOUR`/`END_HOUR` exportées ici ou dans un `constants.ts` du même dossier).
- `assignColumns<T>(items, getStart, getEnd): Array<{ item: T; col: number; cols: number }>` —
  **nouveau**. Répartit les créneaux qui se chevauchent en colonnes côte à côte (largeur =
  `1/cols`, décalage = `col/cols`). Résout le bug d'empilement.
- Tests : aucun chevauchement (1 colonne) ; deux qui se chevauchent (2 colonnes) ; trois
  simultanés (3 colonnes) ; deux adjacents non chevauchants (revient à 1 colonne).

### 2. Présentation — `WeekCalendar.tsx`

- Suppression des maps locales `DISC_COLORS`, `EV_COLORS`, `DISC_LABEL`. On consomme
  `DISCIPLINE` / `disciplineColor()` / `withAlpha()` de `src/lib/theme.ts`.
- **Ajout dans `theme.ts`** d'un record `EVENT_TYPE: Record<string, { label; color }>` (couleurs
  OKLCH) pour `cours | stage | rdv | autre`, même pattern que `DISCIPLINE`. `WeekCalendar` et
  `EventModal` le consomment.
- Remplacement de **tous** les `#15261c`, `#1a2e22`, `rgba(255,255,255,…)`, `rgba(0,0,0,…)` et
  des `oklch(...)` littéraux dispersés par les tokens (`SLATE`, `SURFACE`, `SURFACE_DEEP`,
  `DIVIDER`, `TEXT*`, `ACCENT`, `withAlpha`).
- Le rendu des events + séances utilise `assignColumns` pour le positionnement horizontal.
- Le composant n'embarque plus de maths de layout/temps : il appelle `layout.ts` / `time.ts`.

### 3. Robustesse & accessibilité

- **Erreurs réseau** : chaque `fetch` GET gère le cas `!res.ok` → `toast.error` + état d'erreur
  affiché. **État vide** explicite quand la semaine n'a ni séance ni événement.
- **A11y (WCAG 2.2 AA)** : chaque bloc event/séance devient un élément interactif accessible
  (`role="button"`, `tabIndex={0}`, `onKeyDown` Enter + Espace, `aria-label` = titre + plage
  horaire), focus visible. Les boutons icône-seule ont déjà des `aria-label` (conservés).
- Contraste des nouvelles teintes vérifié via `node scripts/a11y-contrast.mjs` avant intégration.
- **DnD inchangé** (HTML5 natif, desktop). Hors périmètre ; le fallback clic reste propre.

### 4. Nettoyage dette

- Retrait du `try/fallback session_time` dans `src/app/api/sessions/route.ts` (colonne confirmée
  par `0015_session_time.sql`). La requête garde directement `session_time` dans le `select`.
- Retrait des casts de lecture résiduels `as { data … } | null` rencontrés dans les fichiers
  touchés (`/api/schedule`), les factories Supabase étant déjà typées `<Database>`.

## Flux de données (inchangé sur le principe)

1. `WeekCalendar` (client) `fetch` en parallèle `/api/schedule?week_start=…` et
   `/api/sessions?start=…&end=…`.
2. `/api/schedule` lit `schedule_events` (RLS user), puis `expandEvents()` (← `recurrence.ts`)
   produit les occurrences de la semaine.
3. `/api/sessions` lit `sessions` (RLS user) sur la fenêtre, `session_time` inclus.
4. Le composant positionne via `layout.ts` (+ `assignColumns`) et rend dans la charte.
5. Création/édition d'event → `POST`/`PATCH`/`DELETE /api/schedule[/id]`, déplacement de séance →
   `PATCH /api/sessions/[id]` (optimiste, rollback sur échec — comportement existant conservé).

## Gestion d'erreurs

- API : conventions existantes conservées (`apiError` / `apiSuccess`).
- Client : tout `fetch` non-ok ou rejeté → `toast.error` +, pour les GET, un état d'erreur
  affichant un message et permettant de réessayer (re-fetch).

## Tests

- **Unitaires (Vitest)** : `recurrence.test.ts`, `time.test.ts`, `layout.test.ts` (cas détaillés
  ci-dessus).
- **Non couvert** : rendu React du calendrier (pas de lib de test composant au projet) — couvert
  par la vérification visuelle navigateur.

## Definition of done

1. `npm run typecheck && npm run lint && npm test && npm run format:check` — **tout vert**,
   nouveaux tests inclus.
2. Lancement de l'app + contrôle visuel : thème clair correct, clic-création, édition, suppression,
   DnD desktop, chevauchements côte à côte, état vide, message d'erreur réseau.

## Hors périmètre (non traité ici)

- Vue jour / mois.
- Drag & drop tactile / responsive mobile profond (la grille reste `minWidth: 640` + scroll
  horizontal sur mobile).
- Récurrence avancée (multi-jours, bi-hebdo, « cette occurrence seulement »).
- Création unifiée séances/événements.
- Rate-limiting et autres dettes listées dans `AGENTS.md` non liées au calendrier.
