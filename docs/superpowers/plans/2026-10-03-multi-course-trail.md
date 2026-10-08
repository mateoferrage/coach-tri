# Multi-courses, support trail & replanification — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre des courses course-à-pied/trail en plus du triathlon, plusieurs courses dans un plan intégré, et la replanification du reste du programme quand une course est ajoutée en cours de route.

**Architecture:** On généralise `goals` avec un discriminant `sport` + champs trail, on introduit une table `plan_goals` (N-N), on extrait le cœur de génération (macro/micro) dans `src/lib/plan/*` pour le réutiliser depuis un nouvel endpoint `replan`, et on enrichit le coach IA d'un module de connaissances trail injecté conditionnellement.

**Tech Stack:** Next.js 16 (App Router, route handlers), Supabase (Postgres + migrations SQL), Zod v4, react-hook-form, Google Gemini (`@google/genai`), Vitest, date-fns.

**Conventions du repo (à respecter) :**
- Tests = **unitaires purs** avec Vitest, fichier `*.test.ts` à côté du module. Il n'existe **pas** de harness d'intégration pour les route handlers ni la DB — les routes sont vérifiées par `npm run typecheck`, `npm run build`, `npm run test` et smoke manuel.
- Migrations SQL idempotentes (`add column if not exists`) dans `supabase/migrations/NNNN_*.sql`.
- `src/types/db.ts` est généré par `npm run db:types` (nécessite `$SUPABASE_PROJECT_ID` + Supabase en ligne). Si indisponible, éditer le fichier à la main (ce plan fournit les éditions exactes).

**Commandes de vérification (utilisées partout) :**
- `npm run test` — lance Vitest (run unique).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — build Next.
- `npm run lint` — ESLint.

---

## Task 1 : Migration `goals` — sport + champs trail

**Files:**
- Create: `supabase/migrations/0025_goal_sport_trail.sql`

- [ ] **Step 1 : Écrire la migration**

Create `supabase/migrations/0025_goal_sport_trail.sql` :

```sql
-- Généralisation des courses : au triathlon s'ajoute la course à pied (route/trail/ultra).
-- `sport` discrimine le type de course ; les colonnes trail ne concernent que le running.
-- Les lignes existantes prennent sport='triathlon' (défaut) → rétro-compatibles.
alter table public.goals
  add column if not exists sport                   text not null default 'triathlon',
  add column if not exists elevation_loss_m        int,
  add column if not exists surface                 text,
  add column if not exists max_altitude_m          int,
  add column if not exists cutoff_time_s           int,
  add column if not exists estimated_finish_time_s int;

-- Cohérence sport / race_type :
--   triathlon → sprint|olympic|half|full|xterra|custom
--   running   → road|trail|ultra
alter table public.goals drop constraint if exists goals_sport_race_type_check;
alter table public.goals
  add constraint goals_sport_race_type_check check (
    (sport = 'triathlon' and race_type in ('sprint','olympic','half','full','xterra','custom'))
    or
    (sport = 'running' and race_type in ('road','trail','ultra'))
  );

-- surface (technicité) : valeurs contrôlées, null autorisé (triathlon ou non renseigné)
alter table public.goals drop constraint if exists goals_surface_check;
alter table public.goals
  add constraint goals_surface_check check (
    surface is null or surface in ('road','gravel','technical','mountain')
  );
```

- [ ] **Step 2 : Appliquer la migration**

Run : `npm run db:push`
Expected : la migration s'applique sans erreur (ou appliquer manuellement via le dashboard Supabase si `db:push` n'est pas configuré localement).

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0025_goal_sport_trail.sql
git commit -m "feat(db): add sport + trail columns to goals"
```

---

## Task 2 : Migration `plan_goals` (relation N-N plan ↔ courses)

**Files:**
- Create: `supabase/migrations/0026_plan_goals.sql`

- [ ] **Step 1 : Écrire la migration**

Create `supabase/migrations/0026_plan_goals.sql` :

```sql
-- Un plan peut désormais cibler plusieurs courses (course A principale + B/C secondaires).
-- plans.goal_id est conservé et pointe sur la course principale (rétro-compat).
create table if not exists public.plan_goals (
  plan_id uuid not null references public.plans(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, goal_id)
);

alter table public.plan_goals enable row level security;

-- RLS : l'utilisateur accède aux liens de ses propres plans.
drop policy if exists "plan_goals owner access" on public.plan_goals;
create policy "plan_goals owner access" on public.plan_goals
  using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()));

-- Backfill : rattacher les plans existants à leur goal_id courant.
insert into public.plan_goals (plan_id, goal_id)
select id, goal_id from public.plans where goal_id is not null
on conflict do nothing;
```

> Vérifier dans un fichier de migration `plans`/RLS existant que les tables activent bien RLS avec `auth.uid()` ; si le projet n'utilise pas RLS sur ces tables, **retirer** le bloc `enable row level security` + policy pour rester cohérent avec l'existant. (Grep : `rg "enable row level security" supabase/migrations`.)

- [ ] **Step 2 : Appliquer la migration**

Run : `npm run db:push`
Expected : table `plan_goals` créée, backfill effectué sans erreur.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0026_plan_goals.sql
git commit -m "feat(db): add plan_goals join table with backfill"
```

---

## Task 3 : Régénérer / mettre à jour `src/types/db.ts`

**Files:**
- Modify: `src/types/db.ts` (table `goals` Row/Insert/Update ; nouvelle table `plan_goals`)

- [ ] **Step 1 : Tenter la génération automatique**

Run : `npm run db:types`
Expected : `src/types/db.ts` régénéré. Si la commande échoue (pas de `$SUPABASE_PROJECT_ID` / hors ligne), passer au Step 2 (édition manuelle).

- [ ] **Step 2 : Édition manuelle (fallback) — ajouter les colonnes `goals`**

Dans `src/types/db.ts`, table `goals`, ajouter ces clés dans **`Row`**, **`Insert`** et **`Update`** (dans `Row` elles sont requises/nullable, dans `Insert`/`Update` elles sont optionnelles — suivre le style déjà présent) :

```ts
          // Row:
          sport: string
          elevation_loss_m: number | null
          surface: string | null
          max_altitude_m: number | null
          cutoff_time_s: number | null
          estimated_finish_time_s: number | null
          // Insert / Update (optionnelles) :
          sport?: string
          elevation_loss_m?: number | null
          surface?: string | null
          max_altitude_m?: number | null
          cutoff_time_s?: number | null
          estimated_finish_time_s?: number | null
```

- [ ] **Step 3 : Édition manuelle (fallback) — ajouter la table `plan_goals`**

Dans `src/types/db.ts`, à côté des autres tables de `public.Tables`, ajouter :

```ts
      plan_goals: {
        Row: {
          plan_id: string
          goal_id: string
          created_at: string
        }
        Insert: {
          plan_id: string
          goal_id: string
          created_at?: string
        }
        Update: {
          plan_id?: string
          goal_id?: string
          created_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 4 : Vérifier la compilation**

Run : `npm run typecheck`
Expected : PASS (aucune erreur de type).

- [ ] **Step 5 : Commit**

```bash
git add src/types/db.ts
git commit -m "chore(db): regenerate types for goals sport/trail + plan_goals"
```

---

## Task 4 : `GoalSchema` — sport, types running, champs trail, validation croisée

**Files:**
- Modify: `src/lib/schemas/goal.ts`
- Test: `src/lib/schemas/goal.test.ts` (create)

- [ ] **Step 1 : Écrire le test (échec attendu)**

Create `src/lib/schemas/goal.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { GoalSchema } from './goal'

const triathlon = {
  sport: 'triathlon',
  race_name: 'Ironman Nice',
  race_date: '2026-06-28',
  race_type: 'full',
}

const trail = {
  sport: 'running',
  race_name: 'UTMB',
  race_date: '2026-08-28',
  race_type: 'ultra',
  run_distance_m: 171000,
  run_elevation_m: 10000,
  elevation_loss_m: 10000,
  surface: 'mountain',
  terrain: 'mountainous',
  max_altitude_m: 2537,
  cutoff_time_s: 165600,
  estimated_finish_time_s: 140400,
}

describe('GoalSchema', () => {
  it('accepte un triathlon valide', () => {
    expect(GoalSchema.safeParse(triathlon).success).toBe(true)
  })

  it('applique sport=triathlon par défaut', () => {
    const parsed = GoalSchema.parse(triathlon)
    expect(parsed.sport).toBe('triathlon')
  })

  it('accepte une course trail valide avec champs trail', () => {
    expect(GoalSchema.safeParse(trail).success).toBe(true)
  })

  it('rejette un race_type triathlon sur un sport running', () => {
    const bad = { ...trail, race_type: 'olympic' }
    expect(GoalSchema.safeParse(bad).success).toBe(false)
  })

  it('rejette un race_type running sur un sport triathlon', () => {
    const bad = { ...triathlon, race_type: 'trail' }
    expect(GoalSchema.safeParse(bad).success).toBe(false)
  })

  it('rejette les champs trail sur un triathlon', () => {
    const bad = { ...triathlon, elevation_loss_m: 500 }
    expect(GoalSchema.safeParse(bad).success).toBe(false)
  })

  it('rejette une surface hors énumération', () => {
    const bad = { ...trail, surface: 'sand' }
    expect(GoalSchema.safeParse(bad).success).toBe(false)
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `npm run test -- goal`
Expected : FAIL (champs `sport`/trail inexistants, pas de validation croisée).

- [ ] **Step 3 : Implémenter le schéma**

Replace le contenu de `src/lib/schemas/goal.ts` par :

```ts
import { z } from 'zod'

export const TRIATHLON_RACE_TYPES = ['sprint', 'olympic', 'half', 'full', 'xterra', 'custom'] as const
export const RUNNING_RACE_TYPES = ['road', 'trail', 'ultra'] as const
export const SURFACE_TYPES = ['road', 'gravel', 'technical', 'mountain'] as const

// Champs spécifiques à la course à pied / trail. Interdits sur un triathlon.
const TRAIL_ONLY_FIELDS = [
  'elevation_loss_m',
  'surface',
  'max_altitude_m',
  'cutoff_time_s',
  'estimated_finish_time_s',
] as const

export const GoalSchema = z
  .object({
    sport: z.enum(['triathlon', 'running']).default('triathlon'),
    race_name: z.string().min(1, 'Nom de la course requis'),
    race_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
    race_type: z.enum([...TRIATHLON_RACE_TYPES, ...RUNNING_RACE_TYPES]),
    swim_distance_m: z.number().int().positive().optional(),
    bike_distance_m: z.number().int().positive().optional(),
    run_distance_m: z.number().int().positive().optional(),
    bike_elevation_m: z.number().int().min(0).optional(),
    run_elevation_m: z.number().int().min(0).optional(),
    terrain: z.enum(['flat', 'hilly', 'mountainous']).optional(),
    priority: z.enum(['A', 'B', 'C']).default('A'),
    target_type: z.enum(['finish', 'time', 'podium']).default('finish'),
    target_time_seconds: z.number().int().positive().optional(),
    swim_target_time_s: z.number().int().positive().optional(),
    t1_target_time_s: z.number().int().positive().optional(),
    bike_target_time_s: z.number().int().positive().optional(),
    t2_target_time_s: z.number().int().positive().optional(),
    run_target_time_s: z.number().int().positive().optional(),
    // Trail / course à pied
    elevation_loss_m: z.number().int().min(0).optional(),
    surface: z.enum(SURFACE_TYPES).optional(),
    max_altitude_m: z.number().int().min(0).optional(),
    cutoff_time_s: z.number().int().positive().optional(),
    estimated_finish_time_s: z.number().int().positive().optional(),
  })
  .superRefine((g, ctx) => {
    const isTri = g.sport === 'triathlon'
    const allowed = isTri ? TRIATHLON_RACE_TYPES : RUNNING_RACE_TYPES
    if (!(allowed as readonly string[]).includes(g.race_type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['race_type'],
        message: `race_type invalide pour le sport ${g.sport}`,
      })
    }
    if (isTri) {
      for (const f of TRAIL_ONLY_FIELDS) {
        if (g[f] != null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [f],
            message: 'Champ réservé aux courses à pied',
          })
        }
      }
    }
  })

export type Goal = z.infer<typeof GoalSchema>

// Distances standard triathlon (mètres)
export const RACE_DISTANCES = {
  sprint: { swim: 750, bike: 20000, run: 5000 },
  olympic: { swim: 1500, bike: 40000, run: 10000 },
  half: { swim: 1900, bike: 90000, run: 21100 },
  full: { swim: 3800, bike: 180000, run: 42195 },
  xterra: { swim: 1500, bike: 30000, run: 10000 },
  custom: { swim: null, bike: null, run: null },
} as const
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run : `npm run test -- goal`
Expected : PASS (7 tests verts).

- [ ] **Step 5 : Vérifier la non-régression de `ProgramForm`**

Run : `npm run typecheck`
Expected : PASS. (Note : `ProgramForm` fait `GoalSchema.omit({ priority, target_type })` — l'`omit` reste valide sur un `ZodEffects`/`ZodObject` via `.innerType()` si nécessaire ; sinon la Task 11 corrige le formulaire. Si `typecheck` casse sur l'`omit`, ne pas le corriger ici, le noter pour la Task 11.)

- [ ] **Step 6 : Commit**

```bash
git add src/lib/schemas/goal.ts src/lib/schemas/goal.test.ts
git commit -m "feat(schema): sport-aware GoalSchema with trail fields + cross validation"
```

---

## Task 5 : Helper `disciplinesForGoals` (union des disciplines)

**Files:**
- Create: `src/lib/plan/disciplines.ts`
- Test: `src/lib/plan/disciplines.test.ts`

- [ ] **Step 1 : Écrire le test**

Create `src/lib/plan/disciplines.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { disciplinesForGoals } from './disciplines'

describe('disciplinesForGoals', () => {
  it('running seul → run + strength', () => {
    expect(disciplinesForGoals([{ sport: 'running' }])).toEqual(['run', 'strength'])
  })

  it('triathlon → swim, bike, run, strength', () => {
    expect(disciplinesForGoals([{ sport: 'triathlon' }])).toEqual([
      'swim',
      'bike',
      'run',
      'strength',
    ])
  })

  it('trail + triathlon → union dédupliquée, ordre stable', () => {
    expect(disciplinesForGoals([{ sport: 'running' }, { sport: 'triathlon' }])).toEqual([
      'swim',
      'bike',
      'run',
      'strength',
    ])
  })

  it('aucune course → disciplines triathlon par défaut', () => {
    expect(disciplinesForGoals([])).toEqual(['swim', 'bike', 'run', 'strength'])
  })
})
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `npm run test -- disciplines`
Expected : FAIL (module inexistant).

- [ ] **Step 3 : Implémenter**

Create `src/lib/plan/disciplines.ts` :

```ts
export type Sport = 'triathlon' | 'running'

const DISCIPLINE_ORDER = ['swim', 'bike', 'run', 'strength'] as const

const DISCIPLINES_BY_SPORT: Record<Sport, string[]> = {
  triathlon: ['swim', 'bike', 'run', 'strength'],
  running: ['run', 'strength'],
}

/**
 * Union ordonnée et dédupliquée des disciplines d'entraînement couvertes par
 * un ensemble de courses. Sans course, on retombe sur le triathlon complet.
 */
export function disciplinesForGoals(goals: { sport: Sport }[]): string[] {
  const set = new Set<string>()
  const list = goals.length ? goals : [{ sport: 'triathlon' as const }]
  for (const g of list) for (const d of DISCIPLINES_BY_SPORT[g.sport]) set.add(d)
  return DISCIPLINE_ORDER.filter((d) => set.has(d))
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run : `npm run test -- disciplines`
Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/plan/disciplines.ts src/lib/plan/disciplines.test.ts
git commit -m "feat(plan): disciplinesForGoals union helper"
```

---

## Task 6 : Logique pure de césure pour le replan

**Files:**
- Create: `src/lib/plan/replan.ts`
- Test: `src/lib/plan/replan.test.ts`

Décide, à partir des semaines existantes et du nouvel horizon, lesquelles sont **préservées**, **régénérées** (macro + micro) ou **créées** (extension).

- [ ] **Step 1 : Écrire le test**

Create `src/lib/plan/replan.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { computeReplanScope } from './replan'

// Plan de 12 semaines démarré le 2026-01-05 (lundi).
const existingWeeks = Array.from({ length: 12 }, (_, i) => ({
  week_num: i + 1,
  start_date: undefined as unknown as string, // non utilisé par la fonction
}))

describe('computeReplanScope', () => {
  it('préserve les semaines < cutoff, régénère le reste (même horizon)', () => {
    const r = computeReplanScope({
      existingWeekNums: existingWeeks.map((w) => w.week_num),
      cutoffWeek: 3,
      newTotalWeeks: 12,
    })
    expect(r.preservedWeeks).toEqual([1, 2])
    expect(r.regenerateWeeks).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(r.createWeeks).toEqual([])
  })

  it('étend l’horizon quand la nouvelle course est plus lointaine', () => {
    const r = computeReplanScope({
      existingWeekNums: existingWeeks.map((w) => w.week_num),
      cutoffWeek: 3,
      newTotalWeeks: 16,
    })
    expect(r.regenerateWeeks).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(r.createWeeks).toEqual([13, 14, 15, 16])
  })

  it('raccourcit l’horizon quand le nouveau pic est plus proche', () => {
    const r = computeReplanScope({
      existingWeekNums: existingWeeks.map((w) => w.week_num),
      cutoffWeek: 3,
      newTotalWeeks: 8,
    })
    expect(r.regenerateWeeks).toEqual([3, 4, 5, 6, 7, 8])
    expect(r.deleteWeeks).toEqual([9, 10, 11, 12])
    expect(r.createWeeks).toEqual([])
  })

  it('cutoff=1 régénère tout (aucune semaine préservée)', () => {
    const r = computeReplanScope({
      existingWeekNums: [1, 2, 3, 4],
      cutoffWeek: 1,
      newTotalWeeks: 4,
    })
    expect(r.preservedWeeks).toEqual([])
    expect(r.regenerateWeeks).toEqual([1, 2, 3, 4])
  })
})
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `npm run test -- replan`
Expected : FAIL (module inexistant).

- [ ] **Step 3 : Implémenter**

Create `src/lib/plan/replan.ts` :

```ts
export interface ReplanScopeInput {
  /** Numéros de semaines existantes du plan (1-based). */
  existingWeekNums: number[]
  /** Première semaine recalculée (incluse). Tout ce qui précède est figé. */
  cutoffWeek: number
  /** Nombre total de semaines du nouveau plan (nouvel horizon). */
  newTotalWeeks: number
}

export interface ReplanScope {
  /** Semaines conservées intactes (< cutoff). */
  preservedWeeks: number[]
  /** Semaines existantes à régénérer (>= cutoff, <= newTotalWeeks). */
  regenerateWeeks: number[]
  /** Semaines à créer (extension au-delà de l'horizon existant). */
  createWeeks: number[]
  /** Semaines existantes à supprimer (au-delà du nouvel horizon raccourci). */
  deleteWeeks: number[]
}

/**
 * Détermine le périmètre d'une replanification : fige le passé (< cutoff),
 * recalcule la queue, étend ou raccourcit l'horizon selon le nouveau pic.
 */
export function computeReplanScope(input: ReplanScopeInput): ReplanScope {
  const { existingWeekNums, cutoffWeek, newTotalWeeks } = input
  const existing = [...existingWeekNums].sort((a, b) => a - b)
  const maxExisting = existing.length ? existing[existing.length - 1] : 0

  const preservedWeeks = existing.filter((w) => w < cutoffWeek)
  const regenerateWeeks = existing.filter((w) => w >= cutoffWeek && w <= newTotalWeeks)
  const deleteWeeks = existing.filter((w) => w > newTotalWeeks)

  const createWeeks: number[] = []
  for (let w = Math.max(maxExisting, cutoffWeek - 1) + 1; w <= newTotalWeeks; w++) {
    createWeeks.push(w)
  }

  return { preservedWeeks, regenerateWeeks, createWeeks, deleteWeeks }
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run : `npm run test -- replan`
Expected : PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/plan/replan.ts src/lib/plan/replan.test.ts
git commit -m "feat(plan): computeReplanScope cutoff logic"
```

---

## Task 7 : `PlanGenerationSchema` → multi-courses

**Files:**
- Modify: `src/lib/schemas/plan.ts:3-10`
- Test: `src/lib/schemas/plan.test.ts` (create)

- [ ] **Step 1 : Écrire le test**

Create `src/lib/schemas/plan.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { PlanGenerationSchema } from './plan'

const base = { methodology: 'polarized', start_date: '2026-01-05' }
const g1 = '11111111-1111-1111-1111-111111111111'
const g2 = '22222222-2222-2222-2222-222222222222'

describe('PlanGenerationSchema', () => {
  it('mode race : accepte goal_ids + primary_goal_id valides', () => {
    const r = PlanGenerationSchema.safeParse({
      ...base,
      mode: 'race',
      goal_ids: [g1, g2],
      primary_goal_id: g1,
    })
    expect(r.success).toBe(true)
  })

  it('mode race : rejette primary_goal_id absent de goal_ids', () => {
    const r = PlanGenerationSchema.safeParse({
      ...base,
      mode: 'race',
      goal_ids: [g1],
      primary_goal_id: g2,
    })
    expect(r.success).toBe(false)
  })

  it('mode race : rejette goal_ids vide', () => {
    const r = PlanGenerationSchema.safeParse({
      ...base,
      mode: 'race',
      goal_ids: [],
      primary_goal_id: g1,
    })
    expect(r.success).toBe(false)
  })

  it('mode race : rejette plus de 3 courses', () => {
    const r = PlanGenerationSchema.safeParse({
      ...base,
      mode: 'race',
      goal_ids: [g1, g2, g1, g2],
      primary_goal_id: g1,
    })
    expect(r.success).toBe(false)
  })

  it('mode maintenance : goal_ids optionnel', () => {
    const r = PlanGenerationSchema.safeParse({ ...base, mode: 'maintenance' })
    expect(r.success).toBe(true)
  })
})
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `npm run test -- plan`
Expected : FAIL (schéma encore mono-`goal_id`).

- [ ] **Step 3 : Implémenter**

Replace `src/lib/schemas/plan.ts:3-10` (le bloc `PlanGenerationSchema` + type) par :

```ts
export const PlanGenerationSchema = z
  .object({
    mode: z.enum(['race', 'maintenance']),
    goal_ids: z.array(z.string().uuid()).min(1).max(3).optional(),
    primary_goal_id: z.string().uuid().optional(),
    methodology: z.enum(['polarized', 'pyramidal', 'threshold']).default('polarized'),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'race') {
      if (!v.goal_ids?.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['goal_ids'], message: 'Au moins une course requise en mode course' })
        return
      }
      if (!v.primary_goal_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['primary_goal_id'], message: 'Course principale requise' })
      } else if (!v.goal_ids.includes(v.primary_goal_id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['primary_goal_id'], message: 'La course principale doit faire partie des courses' })
      }
    }
  })

export type PlanGeneration = z.infer<typeof PlanGenerationSchema>
```

(Les interfaces `MacroPlan` et `MicroSessions` plus bas dans le fichier restent inchangées.)

- [ ] **Step 4 : Lancer, vérifier le succès**

Run : `npm run test -- plan`
Expected : PASS (5 tests). `npm run typecheck` signalera des erreurs dans `generate/route.ts` (ancien `goal_id`) — **attendu**, corrigé en Task 9.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/schemas/plan.ts src/lib/schemas/plan.test.ts
git commit -m "feat(schema): multi-goal PlanGenerationSchema"
```

---

## Task 8 : `buildMacroPrompt` multi-courses + contexte trail

**Files:**
- Modify: `src/lib/gemini/prompts.ts` (interface `MacroContext` + `buildMacroPrompt`, ~lignes 184-290)
- Test: `src/lib/gemini/prompts.test.ts` (create)

- [ ] **Step 1 : Écrire le test**

Create `src/lib/gemini/prompts.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { buildMacroPrompt, type GoalContext } from './prompts'

const profile = {
  first_name: 'Mateo',
  level: 'intermediate',
  weekly_hours_avg: 10,
  available_disciplines: null,
  birth_date: null,
  weight_kg: 70,
}

const trail: GoalContext = {
  role: 'primary',
  sport: 'running',
  race_name: 'UTMB',
  race_type: 'ultra',
  race_date: '2026-08-28',
  run_distance_m: 171000,
  elevation_gain_m: 10000,
  elevation_loss_m: 10000,
  surface: 'mountain',
  terrain: 'mountainous',
  max_altitude_m: 2537,
  cutoff_time_s: 165600,
  estimated_finish_time_s: 140400,
}

const tri: GoalContext = {
  role: 'secondary',
  sport: 'triathlon',
  race_name: 'Triathlon M',
  race_type: 'olympic',
  race_date: '2026-06-15',
  swim_distance_m: 1500,
  bike_distance_m: 40000,
  run_distance_m: 10000,
}

describe('buildMacroPrompt (multi-courses)', () => {
  it('liste la course principale et la secondaire', () => {
    const out = buildMacroPrompt({
      profile,
      mode: 'race',
      methodology: 'polarized',
      start_date: '2026-03-01',
      total_weeks: 25,
      goals: [trail, tri],
    })
    expect(out).toContain('UTMB')
    expect(out).toContain('Triathlon M')
    expect(out).toContain('principale')
    expect(out).toContain('secondaire')
  })

  it('affiche les champs trail (D+, D-, technicité)', () => {
    const out = buildMacroPrompt({
      profile,
      mode: 'race',
      methodology: 'polarized',
      start_date: '2026-03-01',
      total_weeks: 25,
      goals: [trail],
    })
    expect(out).toContain('D+')
    expect(out).toContain('D-')
    expect(out).toMatch(/technicit|mountain|montagne/i)
  })

  it('mode maintenance sans courses', () => {
    const out = buildMacroPrompt({
      profile,
      mode: 'maintenance',
      methodology: 'polarized',
      start_date: '2026-03-01',
      total_weeks: 12,
    })
    expect(out).toContain('Maintien')
  })
})
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `npm run test -- prompts`
Expected : FAIL (`GoalContext` non exporté, `goals` non géré).

- [ ] **Step 3 : Implémenter — remplacer le champ `goal` par `goals` dans `MacroContext`**

Dans `src/lib/gemini/prompts.ts`, remplacer, dans l'interface `MacroContext`, le bloc :

```ts
  goal?: {
    race_name: string
    race_type: string
    race_date: string
    swim_distance_m: number | null
    bike_distance_m: number | null
    run_distance_m: number | null
    terrain: string | null
  }
```

par :

```ts
  goals?: GoalContext[]
```

et ajouter, **au-dessus** de l'interface `MacroContext`, le type exporté :

```ts
export interface GoalContext {
  role: 'primary' | 'secondary'
  sport: 'triathlon' | 'running'
  race_name: string
  race_type: string
  race_date: string
  swim_distance_m?: number | null
  bike_distance_m?: number | null
  run_distance_m?: number | null
  elevation_gain_m?: number | null
  elevation_loss_m?: number | null
  surface?: string | null
  terrain?: string | null
  max_altitude_m?: number | null
  cutoff_time_s?: number | null
  estimated_finish_time_s?: number | null
}

function fmtHms(sec?: number | null): string {
  if (!sec) return '?'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

const SURFACE_FR: Record<string, string> = {
  road: 'route',
  gravel: 'chemin roulant',
  technical: 'sentier technique',
  mountain: 'montagne',
}

/** Décrit une course (tri ou running/trail) pour le prompt macro. */
function describeGoal(g: GoalContext): string {
  const roleFr = g.role === 'primary' ? 'OBJECTIF PRINCIPAL (pic de forme)' : 'Objectif secondaire (intermédiaire)'
  const lines = [`${roleFr} — ${g.race_name} (${g.race_type}, ${g.race_date})`]
  if (g.sport === 'running') {
    lines.push(
      `  Course à pied : ${g.run_distance_m ?? '?'}m, D+ ${g.elevation_gain_m ?? '?'}m, D- ${g.elevation_loss_m ?? '?'}m`,
    )
    const detail = [
      g.surface && `technicité ${SURFACE_FR[g.surface] ?? g.surface}`,
      g.terrain && `profil ${g.terrain}`,
      g.max_altitude_m && `altitude max ${g.max_altitude_m}m`,
      g.cutoff_time_s && `barrière horaire ${fmtHms(g.cutoff_time_s)}`,
      g.estimated_finish_time_s && `temps estimé ${fmtHms(g.estimated_finish_time_s)}`,
    ].filter(Boolean)
    if (detail.length) lines.push(`  ${detail.join(', ')}`)
  } else {
    lines.push(
      `  Triathlon : ${g.swim_distance_m ?? '?'}m nage / ${g.bike_distance_m ?? '?'}m vélo / ${g.run_distance_m ?? '?'}m course${g.terrain ? ` (terrain ${g.terrain})` : ''}`,
    )
  }
  return lines.join('\n')
}
```

- [ ] **Step 4 : Implémenter — nouvelle `goalSection` dans `buildMacroPrompt`**

Dans `buildMacroPrompt`, remplacer le bloc `const goalSection = ...` (actuellement basé sur `ctx.goal`) par :

```ts
  const goalSection =
    ctx.mode === 'race' && ctx.goals?.length
      ? `OBJECTIF(S) DE COURSE :\n${ctx.goals
          .slice()
          .sort((a, b) => (a.role === 'primary' ? -1 : 1) - (b.role === 'primary' ? -1 : 1))
          .map(describeGoal)
          .join('\n')}`
      : 'MODE : Maintien de forme (programme continu sans objectif de course)'
```

- [ ] **Step 5 : Lancer, vérifier le succès**

Run : `npm run test -- prompts`
Expected : PASS (3 tests).

- [ ] **Step 6 : Commit**

```bash
git add src/lib/gemini/prompts.ts src/lib/gemini/prompts.test.ts
git commit -m "feat(prompts): multi-goal macro prompt with trail context"
```

---

## Task 9 : Génération multi-courses dans `/api/plans/generate`

**Files:**
- Modify: `src/app/api/plans/generate/route.ts`

Adapter la route au nouveau schéma (`goal_ids` + `primary_goal_id`), construire `goals: GoalContext[]`, calculer l'horizon sur la course principale, et insérer les liens `plan_goals`.

- [ ] **Step 1 : Remplacer le parsing + la récupération des courses**

Dans `route.ts`, après `const parsed = PlanGenerationSchema.safeParse(body)`, remplacer le bloc qui déstructure `goal_id` et récupère une seule course par :

```ts
  const { mode, goal_ids, primary_goal_id, methodology, start_date } = parsed.data

  if (mode === 'race' && (!goal_ids?.length || !primary_goal_id))
    return apiError('Courses requises pour le mode course', 400)

  const admin = createAdminClient()

  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as { data: Record<string, unknown> | null }
  if (!profile) return apiError('Profil non configuré', 400)

  // Courses ciblées
  let goalRows: Array<Record<string, unknown>> = []
  let primaryGoal: Record<string, unknown> | null = null
  let end_date = format(addWeeks(parseISO(start_date), 16), 'yyyy-MM-dd')

  if (mode === 'race' && goal_ids?.length) {
    const { data } = (await supabase
      .from('goals')
      .select('*')
      .in('id', goal_ids)
      .eq('user_id', user.id)) as { data: Array<Record<string, unknown>> | null }
    goalRows = data ?? []
    if (goalRows.length !== goal_ids.length) return apiError('Course(s) introuvable(s)', 404)
    primaryGoal = goalRows.find((g) => g.id === primary_goal_id) ?? null
    if (!primaryGoal) return apiError('Course principale introuvable', 404)
    end_date = primaryGoal.race_date as string
  }
```

- [ ] **Step 2 : Construire les `GoalContext` et les disciplines**

Juste avant l'appel `buildMacroPrompt`, remplacer la construction de `goal` par :

```ts
  const goalContexts = goalRows.map((g) => ({
    role: g.id === primary_goal_id ? ('primary' as const) : ('secondary' as const),
    sport: (g.sport as 'triathlon' | 'running') ?? 'triathlon',
    race_name: g.race_name as string,
    race_type: g.race_type as string,
    race_date: g.race_date as string,
    swim_distance_m: g.swim_distance_m as number | null,
    bike_distance_m: g.bike_distance_m as number | null,
    run_distance_m: g.run_distance_m as number | null,
    elevation_gain_m: g.run_elevation_m as number | null,
    elevation_loss_m: g.elevation_loss_m as number | null,
    surface: g.surface as string | null,
    terrain: g.terrain as string | null,
    max_altitude_m: g.max_altitude_m as number | null,
    cutoff_time_s: g.cutoff_time_s as number | null,
    estimated_finish_time_s: g.estimated_finish_time_s as number | null,
  }))
```

Importer le type si besoin : `import { ..., type GoalContext } from '@/lib/gemini/prompts'` (déjà importé depuis ce module). Et dans l'appel `buildMacroPrompt({ ... })`, remplacer `goal: goal ? {...} : undefined` par `goals: goalContexts.length ? goalContexts : undefined`.

- [ ] **Step 3 : Nom du plan + insertion `plan_goals`**

Dans la création du plan (`admin.from('plans').insert({...})`), remplacer `goal_id: goal_id ?? null` par `goal_id: primary_goal_id ?? null` et `name: goal ? ... : ...` par :

```ts
      name: primaryGoal ? `Programme ${primaryGoal.race_name}` : `Programme Maintien — ${start_date}`,
```

Puis, **après** l'insertion réussie du plan (après le bloc `if (planError || !plan) ...`), ajouter :

```ts
  // Rattacher toutes les courses au plan
  if (goal_ids?.length) {
    await admin
      .from('plan_goals')
      .insert(goal_ids.map((gid) => ({ plan_id: plan.id, goal_id: gid })))
  }
```

- [ ] **Step 4 : Vérifier compilation + tests existants**

Run : `npm run typecheck && npm run test`
Expected : PASS (plus de référence à l'ancien `goal`/`goal_id` dans la route ; tous les tests verts).

- [ ] **Step 5 : Smoke manuel**

Run : `npm run dev`, puis créer un programme avec une course trail depuis l'UI existante (même partielle) OU via `curl` sur `/api/plans/generate` avec `{ mode:'race', goal_ids:[...], primary_goal_id:'...', methodology:'polarized', start_date:'...' }`.
Expected : plan créé (201), lignes `plan_goals` présentes en base.

- [ ] **Step 6 : Commit**

```bash
git add src/app/api/plans/generate/route.ts
git commit -m "feat(api): multi-goal plan generation + plan_goals linking"
```

---

## Task 10 : Extraire la génération micro réutilisable

**Files:**
- Create: `src/lib/plan/micro.ts`
- Modify: `src/app/api/plans/[id]/regenerate-week/route.ts`

Objectif : sortir du route handler la logique Gemini + normalisation + insertion des séances, pour que `regenerate-week` **et** `replan` (Task 12) l'utilisent.

- [ ] **Step 1 : Créer le module micro avec les helpers de normalisation**

Create `src/lib/plan/micro.ts` — déplacer **verbatim** depuis `regenerate-week/route.ts` les helpers de normalisation (`VALID_SESSION_TYPES`, `SESSION_TYPE_MAP`, `normalizeSessionType`, `VALID_DISCIPLINES`, `normalizeDiscipline`, `normalizeExpectedRpe`) et les exporter, puis ajouter une fonction d'insertion :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { asJson } from '@/lib/utils/json'
import type { MicroSessions } from '@/lib/schemas/plan'

const VALID_SESSION_TYPES = new Set([
  'easy', 'tempo', 'threshold', 'vo2', 'race_pace', 'technique', 'long', 'recovery', 'test',
])
const SESSION_TYPE_MAP: Record<string, string> = {
  endurance: 'easy', interval: 'vo2', intervals: 'vo2', ftp: 'threshold', sprint: 'vo2',
  speed: 'vo2', strength: 'easy', brick: 'easy', 'race pace': 'race_pace', moderate: 'tempo',
  z2: 'easy', base: 'easy',
}
export function normalizeSessionType(raw: string): string {
  const lower = (raw ?? '').toLowerCase().trim()
  if (VALID_SESSION_TYPES.has(lower)) return lower
  return SESSION_TYPE_MAP[lower] ?? 'easy'
}

const VALID_DISCIPLINES = new Set(['swim', 'bike', 'run', 'brick', 'strength', 'rest'])
export function normalizeDiscipline(raw: string): string {
  const lower = (raw ?? '').toLowerCase().trim()
  return VALID_DISCIPLINES.has(lower) ? lower : 'run'
}

export function normalizeExpectedRpe(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  const rounded = Math.round(raw)
  if (rounded < 1) return null
  return Math.min(rounded, 10)
}

/**
 * Remplace les séances `planned` d'une semaine par celles générées par l'IA
 * (les séances done/skipped sont conservées). Renvoie les séances insérées.
 */
export async function replaceWeekSessions(params: {
  admin: SupabaseClient
  plan_id: string
  plan_week_id: string
  user_id: string
  sessions: MicroSessions['sessions']
}): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> {
  const { admin, plan_id, plan_week_id, user_id, sessions } = params

  await admin.from('sessions').delete().eq('plan_week_id', plan_week_id).eq('status', 'planned')

  const rows = sessions.map((s) => {
    const jsDay = new Date(s.session_date + 'T00:00:00').getDay()
    const day_part = jsDay === 0 ? 'midday' : jsDay === 6 ? 'morning' : 'evening'
    return {
      plan_id,
      plan_week_id,
      user_id,
      ...s,
      discipline: normalizeDiscipline(s.discipline),
      session_type: normalizeSessionType(s.session_type),
      expected_rpe: normalizeExpectedRpe(s.expected_rpe),
      day_part,
      status: 'planned',
      structure: asJson(s.structure),
      target_values: asJson(s.target_values),
    }
  })

  return (await admin
    .from('sessions')
    .insert(rows)
    .select('id, title, session_date, discipline')) as {
    data: Array<Record<string, unknown>> | null
    error: { message: string } | null
  }
}
```

> Note type : `createAdminClient()` renvoie un client typé sur `Database` ; adapter le type `SupabaseClient` à l'import réel utilisé dans le repo (`import { createAdminClient } from '@/lib/supabase/admin'` → `ReturnType<typeof createAdminClient>`). Utiliser `type Admin = ReturnType<typeof createAdminClient>` si `SupabaseClient` générique pose problème au `typecheck`.

- [ ] **Step 2 : Réécrire `regenerate-week` pour utiliser le module**

Dans `regenerate-week/route.ts`, supprimer les définitions locales de `VALID_SESSION_TYPES`, `SESSION_TYPE_MAP`, `normalizeSessionType`, `VALID_DISCIPLINES`, `normalizeDiscipline`, `normalizeExpectedRpe`, le `delete` des séances `planned` et le `map`+`insert` final. Les remplacer par un import et un appel :

```ts
import { replaceWeekSessions } from '@/lib/plan/micro'

// ... après avoir obtenu microPlan.sessions :
const { data: insertedSessions, error: insertError } = await replaceWeekSessions({
  admin,
  plan_id,
  plan_week_id: week.id as string,
  user_id: user.id,
  sessions: microPlan.sessions,
})
if (insertError) return apiError(insertError.message)
```

- [ ] **Step 3 : Vérifier compilation + comportement inchangé**

Run : `npm run typecheck && npm run test`
Expected : PASS. Smoke : régénérer une semaine depuis l'UI → mêmes résultats qu'avant (séances done/skipped conservées).

- [ ] **Step 4 : Commit**

```bash
git add src/lib/plan/micro.ts "src/app/api/plans/[id]/regenerate-week/route.ts"
git commit -m "refactor(plan): extract reusable micro session generation"
```

---

## Task 11 : Coach IA — module de connaissances trail + system prompt sport-aware

**Files:**
- Create: `src/lib/coach/knowledge/trail.ts`
- Modify: `src/lib/coach/knowledge/index.ts`
- Modify: `src/lib/gemini/prompts.ts` (`TRIATHLON_COACH_SYSTEM`)

- [ ] **Step 1 : Créer le module de connaissances trail**

Create `src/lib/coach/knowledge/trail.ts` :

```ts
export const TRAIL_KNOWLEDGE = `
# Course à pied & trail — Spécialisation

## Spécificité du dénivelé positif (D+)
- La puissance ascensionnelle (vitesse verticale, m/h) est un déterminant majeur en trail/ultra.
- Travail en côte : répétitions en montée (force-endurance), montées longues en Z2-Z3, marche active rapide avec bâtons sur fortes pentes (> 15-20 %).
- Rando-course : alterner course et marche soutenue pour reproduire l'allure réelle d'un trail long/ultra.
- Le D+ cumulé hebdomadaire est une charge à part entière : le suivre et le faire progresser graduellement (≤ 10-15 %/semaine).

## Spécificité du dénivelé négatif (D-) — souvent sous-estimé
- La descente provoque des contractions excentriques → dégâts musculaires (DOMS) et fatigue durable.
- Renforcement excentrique prioritaire : squats/fentes en contrôle excentrique, descentes répétées en contrôle.
- Habituer progressivement aux descentes (volume de D- croissant), travailler la technique : fréquence de foulée élevée, regard anticipé, relâchement, placement du bassin.
- Prévoir la casse musculaire dans la périodisation : pics de D- loin de la course, récupération dédiée.

## Technicité / surface
- route : travail d'allure et d'économie de course classique.
- chemin roulant (gravel) : proche route, légère instabilité.
- sentier technique : proprioception, renforcement des chevilles, gainage, foulée adaptée.
- montagne : marche en pente raide, bâtons, gestion de l'altitude.

## Spécificité ultra
- Barrières horaires (cut-off) : caler l'allure cible et les points de ravitaillement sur les temps de passage.
- Nutrition/hydratation longue durée : entraîner l'intestin (apports glucidiques 60-90 g/h), tester la stratégie à l'entraînement sur sorties longues.
- Gestion de la marche active, de la nuit et du sommeil pour les formats > 100 km.
- Sorties longues spécifiques : reproduire D+/D-, terrain et matériel de course (sac, bâtons, chaussures).

## Types de séance course à pied (portés par la discipline run)
- Côtes courtes/longues, descente technique, sortie longue vallonnée, rando-course, allure spécifique trail/ultra, seuil/VMA sur plat pour la qualité.
`.trim()
```

- [ ] **Step 2 : Exposer le bloc dans l'index**

Dans `src/lib/coach/knowledge/index.ts` : importer et réexporter, et créer un bloc dédié injectable à la demande. Ajouter en haut :

```ts
import { TRAIL_KNOWLEDGE } from './trail'
```

puis, après les constantes existantes, ajouter :

```ts
/** Spécialisation course à pied / trail — injectée seulement si une course running est présente. */
export const KNOWLEDGE_BASE_TRAIL = TRAIL_KNOWLEDGE
```

et ajouter `TRAIL_KNOWLEDGE` à la liste des exports nommés en bas du fichier.

- [ ] **Step 3 : System prompt sport-aware**

Dans `src/lib/gemini/prompts.ts`, mettre à jour l'import depuis `@/lib/coach/knowledge` pour inclure `KNOWLEDGE_BASE_TRAIL`, et modifier la première phrase de `TRIATHLON_COACH_SYSTEM` :

Remplacer :
```
Tu es un coach triathlon expert certifié, spécialisé dans la préparation des athlètes de tous niveaux (débutant à élite).
```
par :
```
Tu es un coach expert certifié en triathlon ET en course à pied / trail / ultra, spécialisé dans la préparation des athlètes de tous niveaux (débutant à élite). Tu maîtrises aussi bien l'équilibre des trois disciplines du triathlon que la préparation spécifique au dénivelé (D+ et D-), à la technicité du terrain et aux formats ultra.
```

Et ajouter dans la section « Types de séances par discipline » une ligne :
```
- Course (trail/ultra) : côtes, descente technique, rando-course, sortie longue avec D+, allure spécifique trail
```

- [ ] **Step 4 : Injection conditionnelle du bloc trail dans le prompt macro**

Dans `buildMacroPrompt` (`prompts.ts`), après le calcul de `goalSection`, ajouter :

```ts
  const hasRunningGoal = ctx.goals?.some((g) => g.sport === 'running') ?? false
  const trailBlock = hasRunningGoal ? `\n\n---\n\nSPÉCIALISATION TRAIL :\n${KNOWLEDGE_BASE_TRAIL}` : ''
```

et insérer `${trailBlock}` dans le template retourné, juste après le bloc `BASE DE CONNAISSANCES` en tête du prompt.

- [ ] **Step 5 : Mettre à jour le test prompts (injection trail)**

Add à `src/lib/gemini/prompts.test.ts` :

```ts
it('injecte la spécialisation trail quand une course running est présente', () => {
  const out = buildMacroPrompt({
    profile,
    mode: 'race',
    methodology: 'polarized',
    start_date: '2026-03-01',
    total_weeks: 25,
    goals: [trail],
  })
  expect(out).toContain('SPÉCIALISATION TRAIL')
  expect(out).toContain('excentrique')
})

it("n'injecte pas la spécialisation trail pour un triathlon seul", () => {
  const out = buildMacroPrompt({
    profile,
    mode: 'race',
    methodology: 'polarized',
    start_date: '2026-03-01',
    total_weeks: 25,
    goals: [tri],
  })
  expect(out).not.toContain('SPÉCIALISATION TRAIL')
})
```

- [ ] **Step 6 : Lancer tests + compilation**

Run : `npm run test -- prompts && npm run typecheck`
Expected : PASS.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/coach/knowledge/trail.ts src/lib/coach/knowledge/index.ts src/lib/gemini/prompts.ts src/lib/gemini/prompts.test.ts
git commit -m "feat(coach): trail/running knowledge + sport-aware system prompt"
```

---

## Task 12 : Endpoint `replan` — recalcul du reste du programme

**Files:**
- Create: `src/app/api/plans/[id]/replan/route.ts`
- Create: `src/lib/plan/replan-weeknum.ts`
- Test: `src/lib/plan/replan-weeknum.test.ts`

La césure est la **semaine courante** : il faut convertir la date du jour en `week_num` relatif à `plan.start_date`. Logique pure testable d'abord.

- [ ] **Step 1 : Test du calcul de la semaine courante**

Create `src/lib/plan/replan-weeknum.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { currentWeekNum } from './replan-weeknum'

describe('currentWeekNum', () => {
  it('semaine 1 le jour du départ', () => {
    expect(currentWeekNum('2026-01-05', '2026-01-05')).toBe(1)
  })
  it('semaine 1 à J+6', () => {
    expect(currentWeekNum('2026-01-05', '2026-01-11')).toBe(1)
  })
  it('semaine 2 à J+7', () => {
    expect(currentWeekNum('2026-01-05', '2026-01-12')).toBe(2)
  })
  it('semaine 3 à J+16', () => {
    expect(currentWeekNum('2026-01-05', '2026-01-21')).toBe(3)
  })
  it('plancher à 1 si la date est avant le départ', () => {
    expect(currentWeekNum('2026-01-05', '2026-01-01')).toBe(1)
  })
})
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `npm run test -- replan-weeknum`
Expected : FAIL (module inexistant).

- [ ] **Step 3 : Implémenter**

Create `src/lib/plan/replan-weeknum.ts` :

```ts
import { differenceInCalendarDays, parseISO } from 'date-fns'

/**
 * Numéro de semaine (1-based) d'une date donnée relativement au départ du plan.
 * Plancher à 1 si la date précède le départ.
 */
export function currentWeekNum(startDate: string, onDate: string): number {
  const days = differenceInCalendarDays(parseISO(onDate), parseISO(startDate))
  if (days < 0) return 1
  return Math.floor(days / 7) + 1
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run : `npm run test -- replan-weeknum`
Expected : PASS (5 tests).

- [ ] **Step 5 : Écrire la route `replan`**

Create `src/app/api/plans/[id]/replan/route.ts`. La route : (a) valide le corps, (b) met à jour `plan_goals` + `plans.goal_id`, (c) calcule césure/horizon via `currentWeekNum` + `computeReplanScope`, (d) régénère la macro de la queue, (e) régénère la micro des semaines concernées via `replaceWeekSessions`, (f) journalise.

```ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/utils/errors'
import { PlanGenerationSchema } from '@/lib/schemas/plan'
import { currentWeekNum } from '@/lib/plan/replan-weeknum'
import { computeReplanScope } from '@/lib/plan/replan'
import { z } from 'zod'
import { format } from 'date-fns'

const BodySchema = z.object({
  goal_ids: z.array(z.string().uuid()).min(1).max(3),
  primary_goal_id: z.string().uuid(),
  effective_from_week: z.number().int().positive().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiError('Non authentifié', 401)

  const { id: plan_id } = await params
  const body = await request.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)
  const { goal_ids, primary_goal_id, effective_from_week } = parsed.data
  if (!goal_ids.includes(primary_goal_id))
    return apiError('La course principale doit faire partie des courses', 400)

  const admin = createAdminClient()

  // Plan + propriété
  const { data: plan } = (await supabase
    .from('plans')
    .select('id, start_date, methodology')
    .eq('id', plan_id)
    .eq('user_id', user.id)
    .single()) as { data: { id: string; start_date: string; methodology: string } | null }
  if (!plan) return apiError('Plan introuvable', 404)

  // Courses ciblées
  const { data: goalRows } = (await supabase
    .from('goals')
    .select('*')
    .in('id', goal_ids)
    .eq('user_id', user.id)) as { data: Array<Record<string, unknown>> | null }
  if (!goalRows || goalRows.length !== goal_ids.length)
    return apiError('Course(s) introuvable(s)', 404)
  const primaryGoal = goalRows.find((g) => g.id === primary_goal_id)!
  const newEndDate = primaryGoal.race_date as string

  // Semaines existantes
  const { data: existingWeeks } = (await admin
    .from('plan_weeks')
    .select('id, week_num')
    .eq('plan_id', plan_id)
    .order('week_num', { ascending: true })) as {
    data: Array<{ id: string; week_num: number }> | null
  }
  const weeks = existingWeeks ?? []

  // Césure + horizon
  const today = format(new Date(), 'yyyy-MM-dd')
  const cutoffWeek = effective_from_week ?? currentWeekNum(plan.start_date, today)
  const newTotalWeeks = Math.max(
    cutoffWeek,
    currentWeekNum(plan.start_date, newEndDate), // nb de semaines jusqu'à la course A
  )
  const scope = computeReplanScope({
    existingWeekNums: weeks.map((w) => w.week_num),
    cutoffWeek,
    newTotalWeeks,
  })

  // 1. Mettre à jour les courses rattachées
  await admin.from('plan_goals').delete().eq('plan_id', plan_id)
  await admin
    .from('plan_goals')
    .insert(goal_ids.map((gid) => ({ plan_id, goal_id: gid })))
  await admin.from('plans').update({ goal_id: primary_goal_id }).eq('id', plan_id)

  // 2. Supprimer les semaines hors horizon (cascade supprime leurs séances)
  if (scope.deleteWeeks.length) {
    const ids = weeks.filter((w) => scope.deleteWeeks.includes(w.week_num)).map((w) => w.id)
    await admin.from('plan_weeks').delete().in('id', ids)
  }

  // 3. Régénérer la MACRO de la queue (semaines >= cutoff) + créer l'extension.
  //    Réutiliser la logique de /api/plans/generate : construire le prompt macro
  //    avec les GoalContext (voir Task 8/9), en passant `total_weeks = newTotalWeeks`
  //    et un contexte "semaines déjà réalisées" (résumé des plan_weeks < cutoff),
  //    puis remplacer les plan_weeks >= cutoff (delete + insert) et créer les
  //    createWeeks. Normaliser les phases comme dans generate (normalizePhase).
  //    => Implémentation détaillée au Step 6.

  // 4. Régénérer la MICRO des semaines régénérées + créées :
  //    pour chaque week_num dans [...regenerateWeeks, ...createWeeks], appeler la
  //    même génération micro que regenerate-week et replaceWeekSessions(...).
  //    => Implémentation détaillée au Step 6.

  // 5. Journaliser
  await admin.from('plan_generations').insert({
    plan_id,
    trigger: 'replan',
    scope: { from_week: cutoffWeek, goal_ids, new_total_weeks: newTotalWeeks },
    model: 'gemini-2.5-flash',
    response_meta: {
      preserved: scope.preservedWeeks.length,
      regenerated: scope.regenerateWeeks.length,
      created: scope.createWeeks.length,
      deleted: scope.deleteWeeks.length,
    },
  })

  return apiSuccess({
    plan_id,
    cutoff_week: cutoffWeek,
    new_total_weeks: newTotalWeeks,
    ...scope,
  })
}
```

- [ ] **Step 6 : Câbler la régénération macro + micro**

Pour éviter la duplication, extraire au préalable deux helpers partagés (si pas déjà fait en Task 9) :

- `src/lib/plan/macro.ts` : `export async function generateMacroWeeks(input): Promise<{ phases, weeks }>` — enveloppe `buildMacroPrompt` + `generateJSON<MacroPlan>` + normalisation (`normalizePhase`). `generate/route.ts` et `replan` l'appellent.
- Un helper de contexte micro par semaine (profil, physiologie/zones, wellness, contraintes d'agenda, Strava, équipement) extrait depuis `regenerate-week/route.ts` vers `src/lib/plan/micro-context.ts` : `export async function buildMicroInputForWeek({ supabase, admin, user, plan_id, week }): Promise<Parameters<typeof buildMicroPrompt>[0]>`.

Dans `replan`, après le Step 5 (bloc 3/4) :

```ts
import { generateMacroWeeks } from '@/lib/plan/macro'
import { buildMicroInputForWeek } from '@/lib/plan/micro-context'
import { buildMicroPrompt } from '@/lib/gemini/prompts'
import { TRIATHLON_COACH_SYSTEM } from '@/lib/gemini/prompts'
import { generateJSON } from '@/lib/gemini/client'
import { replaceWeekSessions } from '@/lib/plan/micro'
import type { MicroSessions } from '@/lib/schemas/plan'
import { addWeeks, parseISO } from 'date-fns'

// (bloc 3) MACRO queue
const macro = await generateMacroWeeks({
  // profil + GoalContext construits comme en Task 9, mode 'race',
  // start_date = plan.start_date, total_weeks = newTotalWeeks,
  // + résumé des semaines réalisées (plan_weeks < cutoff) en contexte.
})
const tailWeeks = macro.weeks.filter((w) => w.week_num >= cutoffWeek)
// remplacer les plan_weeks >= cutoff : delete puis insert (avec start_date calculée
// comme dans generate: addWeeks(plan.start_date, week_num-1))
const regenIds = weeks.filter((w) => w.week_num >= cutoffWeek).map((w) => w.id)
if (regenIds.length) await admin.from('plan_weeks').delete().in('id', regenIds)
await admin.from('plan_weeks').insert(
  tailWeeks.map((w) => ({
    plan_id,
    ...w,
    start_date: format(addWeeks(parseISO(plan.start_date), w.week_num - 1), 'yyyy-MM-dd'),
  })),
)
// re-remplacer plan_phases du plan à partir des macro.phases (delete + insert),
// comme dans generate/route.ts.

// (bloc 4) MICRO par semaine régénérée/créée
const { data: freshWeeks } = (await admin
  .from('plan_weeks')
  .select('id, week_num, phase, is_recovery_week, planned_volume_hours, planned_tss, distribution, notes, start_date')
  .eq('plan_id', plan_id)
  .gte('week_num', cutoffWeek)
  .order('week_num', { ascending: true })) as { data: Array<Record<string, unknown>> | null }

for (const w of freshWeeks ?? []) {
  const microInput = await buildMicroInputForWeek({
    supabase,
    admin,
    user,
    plan_id,
    week: w,
  })
  const micro = await generateJSON<MicroSessions>(TRIATHLON_COACH_SYSTEM, buildMicroPrompt(microInput))
  if (micro.sessions?.length) {
    await replaceWeekSessions({
      admin,
      plan_id,
      plan_week_id: w.id as string,
      user_id: user.id,
      sessions: micro.sessions,
    })
  }
}
```

> Ce Step implique d'extraire `generateMacroWeeks` (depuis la logique Gemini+normalisation de `generate/route.ts`) et `buildMicroInputForWeek` (depuis la construction de contexte de `regenerate-week/route.ts`). Faire ces deux extractions d'abord (commits séparés « refactor »), **sans changement fonctionnel**, vérifiées par `npm run typecheck && npm run test` + smoke des deux routes existantes, PUIS câbler `replan`.

- [ ] **Step 7 : Vérifier compilation + tests**

Run : `npm run typecheck && npm run test && npm run build`
Expected : PASS.

- [ ] **Step 8 : Smoke manuel du scénario cible**

1. Créer un plan trail de ~16 semaines, générer 1-2 semaines de séances.
2. `curl -X POST /api/plans/<id>/replan` avec un `goal_ids` ajoutant un triathlon + `primary_goal_id` = trail.
Expected : semaines < césure intactes (séances préservées), semaines ≥ césure recalculées avec natation/vélo intégrés, horizon ajusté, ligne `plan_generations` `trigger='replan'`.

- [ ] **Step 9 : Commit**

```bash
git add src/lib/plan/replan-weeknum.ts src/lib/plan/replan-weeknum.test.ts src/lib/plan/macro.ts src/lib/plan/micro-context.ts "src/app/api/plans/[id]/replan/route.ts" src/app/api/plans/generate/route.ts "src/app/api/plans/[id]/regenerate-week/route.ts"
git commit -m "feat(api): replan endpoint recomputes plan tail on goal change"
```

---

## Task 13 : UI — formulaire de course sport-aware

**Files:**
- Modify: `src/components/forms/ProgramForm.tsx`

- [ ] **Step 1 : Adapter le schéma de formulaire au sport**

Dans `ProgramForm.tsx`, le `GoalFormSchema` fait aujourd'hui `GoalSchema.omit({ priority, target_type })`. Comme `GoalSchema` est désormais un `ZodEffects` (via `.superRefine`), `.omit` n'est plus disponible directement. Remplacer la dérivation par un schéma de formulaire explicite :

```ts
import { TRIATHLON_RACE_TYPES, RUNNING_RACE_TYPES, SURFACE_TYPES } from '@/lib/schemas/goal'

const GoalFormSchema = z
  .object({
    sport: z.enum(['triathlon', 'running']).default('triathlon'),
    race_name: z.string().min(1, 'Nom de la course requis'),
    race_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
    race_type: z.enum([...TRIATHLON_RACE_TYPES, ...RUNNING_RACE_TYPES]),
    swim_distance_m: z.number().int().positive().optional(),
    bike_distance_m: z.number().int().positive().optional(),
    run_distance_m: z.number().int().positive().optional(),
    bike_elevation_m: z.number().int().min(0).optional(),
    run_elevation_m: z.number().int().min(0).optional(),
    elevation_loss_m: z.number().int().min(0).optional(),
    surface: z.enum(SURFACE_TYPES).optional(),
    max_altitude_m: z.number().int().min(0).optional(),
    cutoff_time_s: z.number().int().positive().optional(),
    estimated_finish_time_s: z.number().int().positive().optional(),
    terrain: z.enum(['flat', 'hilly', 'mountainous']).optional(),
    priority: z.enum(['A', 'B', 'C']).optional(),
    target_type: z.enum(['finish', 'time', 'podium']).optional(),
    target_time_seconds: z.number().int().positive().optional(),
    swim_target_time_s: z.number().int().positive().optional(),
    t1_target_time_s: z.number().int().positive().optional(),
    bike_target_time_s: z.number().int().positive().optional(),
    t2_target_time_s: z.number().int().positive().optional(),
    run_target_time_s: z.number().int().positive().optional(),
  })
```

- [ ] **Step 2 : Sélecteur de sport + listes de race_type conditionnelles**

Ajouter un champ `sport` (Select `triathlon` / `course à pied`) en tête du formulaire de course. Remplacer la constante `RACE_TYPES` unique par deux listes et choisir selon le sport observé (`useWatch({ name: 'sport' })`) :

```ts
const RUNNING_RACE_TYPE_LABELS = [
  { value: 'road', label: 'Route (10 km, semi, marathon…)' },
  { value: 'trail', label: 'Trail' },
  { value: 'ultra', label: 'Ultra' },
]
// RACE_TYPES existant = triathlon ; l'afficher si sport==='triathlon', sinon RUNNING_RACE_TYPE_LABELS.
```

- [ ] **Step 3 : Champs trail conditionnels**

Quand `sport === 'running'`, masquer les champs natation/vélo/transitions et afficher : distance (`run_distance_m`), D+ (`run_elevation_m`), D- (`elevation_loss_m`), technicité (`surface`), profil (`terrain`), altitude max (`max_altitude_m`), barrière horaire (`cutoff_time_s`, via `TimeInput`), temps estimé (`estimated_finish_time_s`, via `TimeInput`). Mettre altitude/cut-off en avant pour `race_type === 'ultra'`.

- [ ] **Step 4 : Vérifier build + rendu**

Run : `npm run build`
Expected : PASS. Smoke : sélectionner « course à pied » → les champs trail apparaissent, « triathlon » → champs tri classiques.

- [ ] **Step 5 : Commit**

```bash
git add src/components/forms/ProgramForm.tsx
git commit -m "feat(ui): sport-aware race form with trail fields"
```

---

## Task 14 : UI — rattacher plusieurs courses à un programme

**Files:**
- Modify: `src/components/forms/ProgramForm.tsx`
- Modify: `src/app/(app)/program/new/page.tsx`

- [ ] **Step 1 : Sélection multi-courses**

Dans `ProgramForm`, permettre de sélectionner **1 course principale (A)** + **jusqu'à 2 secondaires** parmi les `goals` actifs passés en props (en plus de la création à la volée existante). État local :

```ts
const [primaryGoalId, setPrimaryGoalId] = useState<string | undefined>()
const [secondaryGoalIds, setSecondaryGoalIds] = useState<string[]>([]) // max 2
```

UI : un Select pour la principale + des cases/Select pour les secondaires (exclure la principale, limiter à 2).

- [ ] **Step 2 : Envoyer `goal_ids` + `primary_goal_id`**

À la soumission du programme (mode `race`), construire le corps de `/api/plans/generate` :

```ts
const goal_ids = [primaryGoalId, ...secondaryGoalIds].filter(Boolean) as string[]
// POST /api/plans/generate { mode:'race', goal_ids, primary_goal_id: primaryGoalId, methodology, start_date }
```

(Adapter l'appel existant qui envoyait `existing_goal_id` / `goal_id`.)

- [ ] **Step 3 : Page `program/new` — charger sport**

Dans `src/app/(app)/program/new/page.tsx`, ajouter `sport` au `select` des goals :

```ts
.select('id, race_name, race_date, race_type, sport, status')
```

et adapter le type passé à `ProgramForm` pour inclure `sport`.

- [ ] **Step 4 : Vérifier build**

Run : `npm run build && npm run typecheck`
Expected : PASS. Smoke : créer un programme avec une course A + une secondaire → plan généré, `plan_goals` à 2 lignes.

- [ ] **Step 5 : Commit**

```bash
git add src/components/forms/ProgramForm.tsx "src/app/(app)/program/new/page.tsx"
git commit -m "feat(ui): attach multiple races to a program"
```

---

## Task 15 : UI — ajouter une course en cours de programme (déclenche replan)

**Files:**
- Modify: `src/app/(app)/program/page.tsx` (page du programme actif)
- Create: `src/components/plan/AddRaceDialog.tsx`

> Vérifier d'abord le nom exact de la page programme (`rg "program" src/app/\(app\)/program`). Adapter si la page s'appelle différemment.

- [ ] **Step 1 : Composant dialog d'ajout de course**

Create `src/components/plan/AddRaceDialog.tsx` : un `Dialog` (shadcn, déjà présent) permettant de choisir une course existante à ajouter (ou d'en créer une), avec un **avertissement explicite** : « Le reste du programme sera recalculé à partir de cette semaine. » Au submit, POST vers `/api/plans/[id]/replan` avec le nouvel ensemble `goal_ids` (courses actuelles du plan + la nouvelle) et `primary_goal_id` inchangé par défaut.

```tsx
'use client'
// Dialog + Select + Button (shadcn). Props: planId, currentGoalIds, primaryGoalId, availableGoals.
// onConfirm => fetch(`/api/plans/${planId}/replan`, { method:'POST',
//   body: JSON.stringify({ goal_ids: [...currentGoalIds, newGoalId], primary_goal_id: primaryGoalId }) })
// puis toast + router.refresh()
```

- [ ] **Step 2 : Bouton sur la page programme**

Dans la page du programme actif, charger les `plan_goals` du plan + les goals actifs non rattachés, et afficher un bouton « Ajouter une course » qui ouvre `AddRaceDialog`.

- [ ] **Step 3 : Vérifier build + scénario**

Run : `npm run build`
Expected : PASS. Smoke : sur un plan trail en cours, « Ajouter une course » → choisir un triathlon → confirmer → le programme se recalcule (semaines passées intactes), toast de succès.

- [ ] **Step 4 : Commit**

```bash
git add src/components/plan/AddRaceDialog.tsx "src/app/(app)/program/page.tsx"
git commit -m "feat(ui): add race mid-program triggers replan"
```

---

## Task 16 : Vérification finale

- [ ] **Step 1 : Suite complète**

Run : `npm run lint && npm run typecheck && npm run test && npm run build`
Expected : tout PASS.

- [ ] **Step 2 : Revue des scénarios du spec**

Vérifier manuellement (dev server) :
1. Créer une **course trail seule** → programme généré, centré run + renfo, prompt contenant la spécialisation trail.
2. Créer **trail (A) + triathlon (B)** → plan intégré 4 disciplines.
3. **Ajouter un triathlon** sur un plan trail en cours → passé figé, reste recalculé, horizon ajusté.

- [ ] **Step 3 : Commit éventuel de corrections**

```bash
git add -A
git commit -m "chore: final fixes for multi-course trail feature"
```

---

## Auto-revue (couverture du spec)

- §1 Modèle de données (sport, champs trail, `plan_goals`) → Tasks 1, 2, 3, 4.
- §2 Génération intégrée multi-courses → Tasks 5, 7, 8, 9.
- §3 Replanification en cours de programme → Tasks 6, 10, 12.
- §4 UI → Tasks 13, 14, 15.
- §5 Coach IA trail → Task 11.
- §6 Rétro-compat (défaut `triathlon`, backfill `plan_goals`) → Tasks 1, 2.
- §7 Tests → tests unitaires Tasks 4, 5, 6, 7, 8, 11, 12.
- §8 Découpage → l'ordre des tasks suit le découpage du spec, avec l'extraction `micro`/`macro`/`micro-context` nécessaire à `replan` (Tasks 10, 12).
