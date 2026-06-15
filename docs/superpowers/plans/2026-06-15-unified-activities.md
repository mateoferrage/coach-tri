# Unified Garmin+Strava Activities — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher dans `/activities` une liste unifiée et dédoublonnée des activités Garmin et Strava, l'historique porté par Garmin étant enrichi des données exclusives Strava (puissance, suffer score) sur les séances présentes dans les deux sources.

**Architecture:** Fusion à la lecture dans le Server Component `/activities`. Toute la logique de dédoublonnage/normalisation vit dans un module pur `src/lib/activities/unify.ts`, testé unitairement. Les syncs restent inchangés, hors un ajustement d'horodatage Strava (stocker l'heure UTC). Aucune nouvelle table.

**Tech Stack:** Next.js 16 (App Router, Server Components), TypeScript, Supabase (PostgREST), Vitest (nouveau, pour les tests unitaires des fonctions pures).

**Spec de référence:** `docs/superpowers/specs/2026-06-15-unified-activities-design.md`

---

## File Structure

- **Create** `src/lib/activities/unify.ts` — types `UnifiedActivity`/`GarminRow`/`StravaRow`, fonctions pures `normalizeGarmin`, `normalizeStrava`, `mergeActivities`. Une seule responsabilité : transformer + dédoublonner. Zéro I/O.
- **Create** `src/lib/activities/unify.test.ts` — tests unitaires Vitest du module ci-dessus.
- **Create** `vitest.config.ts` — config Vitest (environnement node, include `src/**/*.test.ts`).
- **Modify** `package.json` — ajout `vitest` en devDependency + scripts `test`/`test:watch`.
- **Modify** `src/lib/strava/client.ts` — `StravaRawActivity` gagne `start_date`; `toRecord()` stocke `raw.start_date` (UTC) au lieu de `raw.start_date_local`.
- **Modify** `src/app/(app)/activities/page.tsx` — fetch `strava_activities`, appel `mergeActivities`, rendu (badge de source, stat puissance, état vide mis à jour).

---

## Task 1: Installer et configurer Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Installer vitest**

Run:
```bash
cd "/Users/mateoferrage/Desktop/Projets/coach tri/coach-tri" && npm install -D vitest
```
Expected: vitest ajouté à `devDependencies`, installation sans erreur.

- [ ] **Step 2: Ajouter les scripts de test à `package.json`**

Dans le bloc `"scripts"`, ajouter `test` et `test:watch` après `"typecheck"` :

```json
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Créer `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Vérifier que le runner démarre (aucun test encore)**

Run: `npm test`
Expected: Vitest s'exécute et signale « No test files found » (ou exit 0 sans erreur de config). C'est normal à ce stade.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2: Sync Strava stocke l'heure UTC

Garmin stocke `started_at` en UTC ; Strava stocke aujourd'hui l'heure locale (`start_date_local`). Pour que le dédoublonnage par proximité d'heure fonctionne, Strava doit aussi stocker l'UTC (`start_date`).

**Files:**
- Modify: `src/lib/strava/client.ts`

- [ ] **Step 1: Ajouter `start_date` au type brut Strava**

Dans `interface StravaRawActivity`, ajouter le champ `start_date` à côté de `start_date_local` :

```ts
interface StravaRawActivity {
  id:                    number
  name:                  string
  type:                  string
  start_date:            string
  start_date_local:      string
  elapsed_time:          number
  distance:              number
  average_heartrate?:    number
  max_heartrate?:        number
  average_speed?:        number
  average_watts?:        number
  total_elevation_gain?: number
  suffer_score?:         number
}
```

- [ ] **Step 2: Stocker l'UTC dans `toRecord()`**

Dans la fonction `toRecord`, remplacer la ligne `started_at` :

```ts
    started_at:         raw.start_date,
```

(les autres champs de `toRecord` restent inchangés — `toInt(...)` etc.)

> Ne pas toucher `projectActivity` : c'est l'affichage du contexte coach, l'heure locale y est acceptable.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (exit 0, aucune erreur).

- [ ] **Step 4: Commit**

```bash
git add src/lib/strava/client.ts
git commit -m "fix: store Strava activity start in UTC for dedup matching"
```

---

## Task 3: Module `unify.ts` — types et normaliseurs (TDD)

**Files:**
- Create: `src/lib/activities/unify.ts`
- Test: `src/lib/activities/unify.test.ts`

- [ ] **Step 1: Écrire les tests des normaliseurs (qui échouent)**

Créer `src/lib/activities/unify.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { normalizeGarmin, normalizeStrava, type GarminRow, type StravaRow } from './unify'

const garminRow: GarminRow = {
  id: 'g1',
  garmin_activity_id: 1001,
  activity_type: 'run',
  name: 'Footing matinal',
  started_at: '2026-06-10T06:00:00+00:00',
  duration_s: 3600,
  distance_m: 10000,
  avg_hr: 145,
  max_hr: 165,
  avg_speed_ms: 2.78,
  elevation_gain_m: 50,
  aerobic_te: 3.2,
}

const stravaRow: StravaRow = {
  id: 's1',
  strava_activity_id: 2001,
  activity_type: 'bike',
  name: 'Sortie longue',
  started_at: '2026-06-11T08:00:00+00:00',
  duration_s: 7200,
  distance_m: 60000,
  avg_hr: 138,
  max_hr: 160,
  avg_speed_ms: 8.3,
  elevation_gain_m: 600,
  avg_watts: 180,
  suffer_score: 90,
}

describe('normalizeGarmin', () => {
  it('mappe une activité Garmin avec ses sources et drapeaux', () => {
    const u = normalizeGarmin(garminRow)
    expect(u.id).toBe('g1')
    expect(u.sources).toEqual(['garmin'])
    expect(u.aerobic_te).toBe(3.2)
    expect(u.avg_watts).toBeNull()
    expect(u.suffer_score).toBeNull()
    expect(u.is_manual).toBe(false)
  })

  it('marque les activités manuelles (id < 0)', () => {
    const u = normalizeGarmin({ ...garminRow, garmin_activity_id: -5 })
    expect(u.is_manual).toBe(true)
  })
})

describe('normalizeStrava', () => {
  it('mappe une activité Strava avec watts/suffer et sans TE', () => {
    const u = normalizeStrava(stravaRow)
    expect(u.id).toBe('s1')
    expect(u.sources).toEqual(['strava'])
    expect(u.avg_watts).toBe(180)
    expect(u.suffer_score).toBe(90)
    expect(u.aerobic_te).toBeNull()
    expect(u.is_manual).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — `unify.ts` n'existe pas (impossible de résoudre `./unify`).

- [ ] **Step 3: Implémenter types + normaliseurs**

Créer `src/lib/activities/unify.ts` :

```ts
export type ActivitySource = 'garmin' | 'strava'

export type UnifiedActivity = {
  id: string
  activity_type: string
  name: string | null
  started_at: string
  duration_s: number | null
  distance_m: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_speed_ms: number | null
  elevation_gain_m: number | null
  aerobic_te: number | null      // Garmin uniquement
  avg_watts: number | null       // Strava uniquement
  suffer_score: number | null    // Strava uniquement
  is_manual: boolean
  sources: ActivitySource[]
}

export type GarminRow = {
  id: string
  garmin_activity_id: number
  activity_type: string
  name: string | null
  started_at: string
  duration_s: number | null
  distance_m: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_speed_ms: number | null
  elevation_gain_m: number | null
  aerobic_te: number | null
}

export type StravaRow = {
  id: string
  strava_activity_id: number
  activity_type: string
  name: string | null
  started_at: string
  duration_s: number | null
  distance_m: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_speed_ms: number | null
  elevation_gain_m: number | null
  avg_watts: number | null
  suffer_score: number | null
}

export function normalizeGarmin(row: GarminRow): UnifiedActivity {
  return {
    id: row.id,
    activity_type: row.activity_type,
    name: row.name,
    started_at: row.started_at,
    duration_s: row.duration_s,
    distance_m: row.distance_m,
    avg_hr: row.avg_hr,
    max_hr: row.max_hr,
    avg_speed_ms: row.avg_speed_ms,
    elevation_gain_m: row.elevation_gain_m,
    aerobic_te: row.aerobic_te,
    avg_watts: null,
    suffer_score: null,
    is_manual: row.garmin_activity_id < 0,
    sources: ['garmin'],
  }
}

export function normalizeStrava(row: StravaRow): UnifiedActivity {
  return {
    id: row.id,
    activity_type: row.activity_type,
    name: row.name,
    started_at: row.started_at,
    duration_s: row.duration_s,
    distance_m: row.distance_m,
    avg_hr: row.avg_hr,
    max_hr: row.max_hr,
    avg_speed_ms: row.avg_speed_ms,
    elevation_gain_m: row.elevation_gain_m,
    aerobic_te: null,
    avg_watts: row.avg_watts,
    suffer_score: row.suffer_score,
    is_manual: false,
    sources: ['strava'],
  }
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npm test`
Expected: PASS (4 tests verts).

- [ ] **Step 5: Commit**

```bash
git add src/lib/activities/unify.ts src/lib/activities/unify.test.ts
git commit -m "feat: unify.ts normalizers for Garmin/Strava activities"
```

---

## Task 4: `mergeActivities` — dédoublonnage et enrichissement (TDD)

Règle (cf. spec) : deux activités sont la même séance si même discipline normalisée ∈ {run,bike,swim}, heures de début ≤ 10 min d'écart, et (si les deux durées sont connues) durées ≤ 25 % d'écart. Base = Garmin, enrichie de `avg_watts`/`suffer_score` Strava. Manuelles jamais appariées. Tri final par `started_at` desc.

**Files:**
- Modify: `src/lib/activities/unify.ts`
- Test: `src/lib/activities/unify.test.ts`

- [ ] **Step 1: Ajouter les tests de `mergeActivities` (qui échouent)**

Ajouter à la fin de `src/lib/activities/unify.test.ts` :

```ts
import { mergeActivities } from './unify'

function g(over: Partial<GarminRow>): GarminRow {
  return {
    id: 'g', garmin_activity_id: 1, activity_type: 'run', name: null,
    started_at: '2026-06-10T06:00:00+00:00', duration_s: 3600, distance_m: 10000,
    avg_hr: 140, max_hr: 160, avg_speed_ms: 2.78, elevation_gain_m: 0,
    aerobic_te: 3, ...over,
  }
}
function s(over: Partial<StravaRow>): StravaRow {
  return {
    id: 's', strava_activity_id: 2, activity_type: 'run', name: null,
    started_at: '2026-06-10T06:00:00+00:00', duration_s: 3600, distance_m: 10000,
    avg_hr: 140, max_hr: 160, avg_speed_ms: 2.78, elevation_gain_m: 0,
    avg_watts: 200, suffer_score: 80, ...over,
  }
}

describe('mergeActivities', () => {
  it('fusionne un doublon (≤10 min, même sport) : base Garmin + watts Strava', () => {
    const out = mergeActivities(
      [g({ id: 'g1', started_at: '2026-06-10T06:00:00+00:00' })],
      [s({ id: 's1', started_at: '2026-06-10T06:02:00+00:00', avg_watts: 210, suffer_score: 75 })],
    )
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('g1')
    expect(out[0].sources).toEqual(['garmin', 'strava'])
    expect(out[0].avg_watts).toBe(210)
    expect(out[0].suffer_score).toBe(75)
    expect(out[0].aerobic_te).toBe(3)
  })

  it('garde 2 cartes si écart horaire > 10 min', () => {
    const out = mergeActivities(
      [g({ id: 'g1', started_at: '2026-06-10T06:00:00+00:00' })],
      [s({ id: 's1', started_at: '2026-06-10T06:30:00+00:00' })],
    )
    expect(out).toHaveLength(2)
  })

  it('garde 2 cartes si disciplines différentes', () => {
    const out = mergeActivities(
      [g({ id: 'g1', activity_type: 'run' })],
      [s({ id: 's1', activity_type: 'bike' })],
    )
    expect(out).toHaveLength(2)
  })

  it('garde 2 cartes si durées trop différentes (>25%)', () => {
    const out = mergeActivities(
      [g({ id: 'g1', duration_s: 3600 })],
      [s({ id: 's1', duration_s: 7200 })],
    )
    expect(out).toHaveLength(2)
  })

  it('garde une activité Strava sans équivalent Garmin', () => {
    const out = mergeActivities([], [s({ id: 's1' })])
    expect(out).toHaveLength(1)
    expect(out[0].sources).toEqual(['strava'])
  })

  it("n'apparie jamais une activité manuelle Garmin", () => {
    const out = mergeActivities(
      [g({ id: 'g1', garmin_activity_id: -3 })],
      [s({ id: 's1' })],
    )
    expect(out).toHaveLength(2)
  })

  it("ne dédoublonne pas les disciplines hors run/bike/swim", () => {
    const out = mergeActivities(
      [g({ id: 'g1', activity_type: 'strength' })],
      [s({ id: 's1', activity_type: 'other' })],
    )
    expect(out).toHaveLength(2)
  })

  it('trie le résultat par started_at décroissant', () => {
    const out = mergeActivities(
      [
        g({ id: 'old', started_at: '2026-06-01T06:00:00+00:00' }),
        g({ id: 'new', started_at: '2026-06-12T06:00:00+00:00' }),
      ],
      [],
    )
    expect(out.map(a => a.id)).toEqual(['new', 'old'])
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — `mergeActivities` n'est pas exporté.

- [ ] **Step 3: Implémenter `mergeActivities`**

Ajouter à `src/lib/activities/unify.ts` :

```ts
const DEDUP_WINDOW_MS = 10 * 60 * 1000   // ±10 min
const DURATION_TOLERANCE = 0.25          // ±25 %
const DEDUP_DISCIPLINES = new Set(['run', 'bike', 'swim'])

function canDedup(a: UnifiedActivity): boolean {
  return !a.is_manual && DEDUP_DISCIPLINES.has(a.activity_type)
}

function durationsCompatible(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return true   // pas de garde-fou si durée inconnue
  if (a === 0 || b === 0) return a === b
  return Math.abs(a - b) / Math.max(a, b) <= DURATION_TOLERANCE
}

function isSameSession(garmin: UnifiedActivity, strava: UnifiedActivity): boolean {
  if (garmin.activity_type !== strava.activity_type) return false
  const diff = Math.abs(Date.parse(garmin.started_at) - Date.parse(strava.started_at))
  if (diff > DEDUP_WINDOW_MS) return false
  return durationsCompatible(garmin.duration_s, strava.duration_s)
}

export function mergeActivities(garmin: GarminRow[], strava: StravaRow[]): UnifiedActivity[] {
  const ug = garmin.map(normalizeGarmin)
  const us = strava.map(normalizeStrava)
  const usedStrava = new Set<number>()
  const result: UnifiedActivity[] = []

  for (const gActivity of ug) {
    let match: { idx: number; diff: number } | null = null
    if (canDedup(gActivity)) {
      us.forEach((sActivity, idx) => {
        if (usedStrava.has(idx) || !canDedup(sActivity)) return
        if (!isSameSession(gActivity, sActivity)) return
        const diff = Math.abs(Date.parse(gActivity.started_at) - Date.parse(sActivity.started_at))
        if (!match || diff < match.diff) match = { idx, diff }
      })
    }
    if (match) {
      const sActivity = us[match.idx]
      usedStrava.add(match.idx)
      result.push({
        ...gActivity,
        avg_watts: sActivity.avg_watts,
        suffer_score: sActivity.suffer_score,
        sources: ['garmin', 'strava'],
      })
    } else {
      result.push(gActivity)
    }
  }

  us.forEach((sActivity, idx) => {
    if (!usedStrava.has(idx)) result.push(sActivity)
  })

  result.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
  return result
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npm test`
Expected: PASS (tous les tests verts, normaliseurs + merge).

- [ ] **Step 5: Commit**

```bash
git add src/lib/activities/unify.ts src/lib/activities/unify.test.ts
git commit -m "feat: mergeActivities dedup + Strava enrichment"
```

---

## Task 5: Intégrer la fusion dans `/activities` + UI

**Files:**
- Modify: `src/app/(app)/activities/page.tsx`

- [ ] **Step 1: Remplacer le type local et les imports**

En haut de `page.tsx`, remplacer l'import de thème par un import incluant aussi `unify`, et supprimer le `type Activity` local au profit de `UnifiedActivity`.

Ajouter après les imports existants :

```ts
import { mergeActivities, type UnifiedActivity, type GarminRow, type StravaRow } from "@/lib/activities/unify";
```

Supprimer le bloc `type Activity = { ... }` (lignes 8-21) — on utilise `UnifiedActivity`.

- [ ] **Step 2: Adapter `ActivityCard` au nouveau type et ajouter le badge de source + la puissance**

Remplacer la signature et le corps pertinent de `ActivityCard` :

```tsx
function SourceChip({ source }: { source: "garmin" | "strava" }) {
  const color = source === "strava" ? "oklch(0.70 0.17 35)" : "oklch(0.72 0.12 230)";
  const label = source === "strava" ? "Strava" : "Garmin";
  return (
    <span
      className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
      style={{ color, border: `1px solid ${color}` }}
    >
      {label}
    </span>
  );
}

function ActivityCard({ activity }: { activity: UnifiedActivity }) {
  const sport = getSport(activity.activity_type);
  const isManual = activity.is_manual;

  const hero = (!sport.isStrength && activity.distance_m)
    ? heroDistance(activity.distance_m, sport.isSwim)
    : heroDuration(activity.duration_s);

  const showDuration = !!(!sport.isStrength && activity.distance_m && activity.duration_s);
  const pace         = formatPace(activity.avg_speed_ms, sport.isCycling, sport.isSwim);
  const avgHr        = activity.avg_hr ? `${activity.avg_hr} bpm` : null;
  const maxHr        = activity.max_hr ? `${activity.max_hr} bpm` : null;
  const watts        = activity.avg_watts ? `${activity.avg_watts} W` : null;
  const elevation    = (activity.elevation_gain_m ?? 0) > 0
    ? `${Math.round(activity.elevation_gain_m!)} m`
    : null;
  const distSecondary = sport.isStrength ? formatDistance(activity.distance_m, sport.isSwim) : null;

  const stats: { label: string; value: string }[] = [
    showDuration && { label: "Durée",     value: formatDuration(activity.duration_s)! },
    pace         && { label: sport.isCycling ? "Vitesse" : "Allure",  value: pace },
    watts        && { label: "Puissance", value: watts },
    avgHr        && { label: "FC moy.",   value: avgHr },
    elevation    && { label: "D+",        value: elevation },
    maxHr        && { label: "FC max",    value: maxHr },
    distSecondary && { label: "Distance", value: distSecondary },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: DARK, border: `1px solid ${DIVIDER}` }}
    >
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ backgroundColor: withAlpha(MINT, 9), border: `1px solid ${withAlpha(MINT, 19)}` }}
            >
              {sport.icon}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: MINT }}>
                {sport.label}
              </p>
              {activity.name && (
                <p className="text-[12px] font-semibold leading-tight mt-0.5" style={{ color: "oklch(1 0 0 / 70%)" }}>
                  {activity.name}
                </p>
              )}
              <p className="text-[11px]" style={{ color: "oklch(1 0 0 / 40%)" }}>
                {formatTime(activity.started_at)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-1.5">
              {activity.sources.map((src) => <SourceChip key={src} source={src} />)}
            </div>
            {isManual ? <ManualBadge /> : <TEBadge value={activity.aerobic_te} />}
          </div>
        </div>

        {hero ? (
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-semibold leading-none" style={{ color: "oklch(0.98 0 0)" }}>
              {hero.value}
            </span>
            {hero.unit && (
              <span className="text-lg font-bold" style={{ color: "oklch(1 0 0 / 45%)" }}>
                {hero.unit}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "oklch(1 0 0 / 30%)" }}>
            Pas de données
          </p>
        )}
      </div>

      {stats.length > 0 && (
        <div
          className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-2"
          style={{ borderTop: `1px solid ${DIVIDER}`, backgroundColor: DARKER }}
        >
          {stats.map(({ label, value }) => (
            <StatPill key={label} label={label} value={value} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Fetch des deux tables + fusion dans le composant page**

Dans `ActivitiesPage`, remplacer le bloc de fetch Garmin unique et la construction de `list` par :

```tsx
  const [garminRes, stravaRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("garmin_activities")
      .select("id, garmin_activity_id, activity_type, name, started_at, duration_s, distance_m, avg_hr, max_hr, avg_speed_ms, elevation_gain_m, aerobic_te")
      .eq("user_id", user!.id)
      .order("started_at", { ascending: false })
      .limit(100),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("strava_activities")
      .select("id, strava_activity_id, activity_type, name, started_at, duration_s, distance_m, avg_hr, max_hr, avg_speed_ms, elevation_gain_m, avg_watts, suffer_score")
      .eq("user_id", user!.id)
      .order("started_at", { ascending: false })
      .limit(100),
  ]);

  const garminRows = (garminRes.data ?? []) as GarminRow[];
  const stravaRows = (stravaRes.data ?? []) as StravaRow[];
  const list: UnifiedActivity[] = mergeActivities(garminRows, stravaRows).slice(0, 50);
```

- [ ] **Step 4: Adapter le groupement par jour au nouveau type**

Le bloc de groupement utilise `Activity` ; le remplacer par `UnifiedActivity` :

```tsx
  const groups: { dateKey: string; label: string; items: UnifiedActivity[] }[] = [];
  for (const activity of list) {
    const dateKey = activity.started_at.split("T")[0];
    const last = groups[groups.length - 1];
    if (last?.dateKey === dateKey) {
      last.items.push(activity);
    } else {
      groups.push({ dateKey, label: formatDateHeader(activity.started_at), items: [activity] });
    }
  }
```

- [ ] **Step 5: Mettre à jour le texte de l'état vide**

Dans le bloc `list.length === 0`, remplacer le paragraphe d'aide :

```tsx
          <p className="text-xs" style={{ color: "oklch(1 0 0 / 25%)" }}>
            Connecte ton compte Garmin ou Strava et lance une synchronisation.
          </p>
```

- [ ] **Step 6: Typecheck + lint + build**

Run:
```bash
npm run typecheck && npm run lint && npm run build
```
Expected: typecheck PASS, lint sans nouvelle erreur, build PASS (route `/activities` générée).

- [ ] **Step 7: Vérification manuelle**

Lancer `npm run dev`, se connecter, ouvrir `/activities`. Vérifier :
- Une séance présente sur Garmin **et** Strava apparaît **une seule fois**, avec les deux badges `Garmin`+`Strava`.
- Une séance vélo avec puissance affiche le stat **« Puissance »** (W).
- L'historique Garmin ancien (avant la connexion Strava) reste visible.
- Les activités manuelles restent présentes avec le badge `Manuel`.

- [ ] **Step 8: Commit**

```bash
git add src/app/(app)/activities/page.tsx
git commit -m "feat: unified Garmin+Strava activities list with source badges and power"
```

---

## Self-Review

- **Spec coverage** : fusion à la lecture (T5) ✓ ; module pur `unify.ts` (T3/T4) ✓ ; règle de dédoublonnage discipline+heure+durée (T4) ✓ ; base Garmin + enrichissement Strava (T4) ✓ ; horodatage UTC Strava (T2) ✓ ; badge source + stat puissance + état vide (T5) ✓ ; tests des 8 cas spec (T4) ✓ ; suffer score stocké non affiché (UnifiedActivity le porte, UI ne l'affiche pas) ✓ ; YAGNI (pas de filtre/table/backfill) respecté.
- **Placeholder scan** : aucun TBD/TODO ; tout le code est fourni.
- **Type consistency** : `UnifiedActivity`/`GarminRow`/`StravaRow` définis en T3 et réutilisés tels quels en T4/T5 ; `mergeActivities(garmin, strava)` signature stable ; `sources`, `is_manual`, `avg_watts`, `suffer_score` cohérents partout.
