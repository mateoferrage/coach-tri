# Equipment Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux athlètes de déclarer leur matériel (natation, vélo, course) dans leur profil et que Gemini en tienne compte lors de la génération des séances.

**Architecture:** Colonne `equipment JSONB DEFAULT '{}'` dans `profiles` (Option A). Le schéma Zod dans `ProfileSchema` type cette structure. Une fonction `buildEquipmentBlock()` formate l'équipement en texte pour les prompts Gemini. Le frontend expose une section "Matériel" dans `/profile` via un Client Component `EquipmentSection`.

**Tech Stack:** Next.js 16 App Router · Supabase (PostgreSQL + RLS) · Zod v4 · Google Gemini 2.5 Flash · Tailwind CSS v4 + shadcn/ui · TypeScript

---

## Fichiers touchés

| Fichier                                           | Action   | Couche   |
| ------------------------------------------------- | -------- | -------- |
| `supabase/migrations/0021_equipment.sql`          | Créer    | Data     |
| `src/lib/schemas/profile.ts`                      | Modifier | Backend  |
| `src/lib/gemini/prompts.ts`                       | Modifier | IA       |
| `src/app/api/plans/[id]/regenerate-week/route.ts` | Modifier | Backend  |
| `src/components/profile/EquipmentSection.tsx`     | Créer    | Frontend |
| `src/app/(app)/profile/page.tsx`                  | Modifier | Frontend |

---

## Task 1 — Migration SQL (dev-data)

**Files:**

- Create: `supabase/migrations/0021_equipment.sql`

- [ ] **Créer la migration**

```sql
-- supabase/migrations/0021_equipment.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '{}';
```

- [ ] **Appliquer la migration**

```bash
cd coach-tri
npx supabase db push
```

Expected : `Applied 1 migration` (ou message indiquant que la migration a été appliquée).

- [ ] **Committer**

```bash
git add supabase/migrations/0021_equipment.sql
git commit -m "feat(data): add equipment JSONB column to profiles"
```

---

## Task 2 — Prompts IA (dev-ia) — parallèle avec Task 1

**Files:**

- Modify: `src/lib/gemini/prompts.ts`

Ce fichier exporte déjà `buildMicroPrompt()` et `MicroContext`. On ajoute :

1. Le type `EquipmentData` (partagé avec le schema Zod)
2. La fonction `buildEquipmentBlock()`
3. Le champ `equipment_block?: string` dans `MicroContext`
4. L'injection du bloc dans `buildMicroPrompt()`

- [ ] **Ajouter le type EquipmentData et buildEquipmentBlock dans `src/lib/gemini/prompts.ts`**

Ajouter après les imports existants, avant `TRIATHLON_COACH_SYSTEM` :

```ts
// ─── Equipment ─────────────────────────────────────────────────────────────────

export interface EquipmentData {
  swim?: {
    paddles?: boolean
    fins?: boolean
    pull_buoy?: boolean
    kickboard?: boolean
    snorkel?: boolean
  }
  bike?: {
    aero_bars?: boolean
  }
  run?: {
    shoes?: Array<{
      name: string
      usage: 'footing' | 'dynamic' | 'competition'
      surface: 'road' | 'trail'
    }>
  }
}

export function buildEquipmentBlock(eq: EquipmentData): string {
  const lines: string[] = ['MATÉRIEL DISPONIBLE :']

  const swim = eq.swim
  if (swim) {
    const items = [
      `plaquettes mains ${swim.paddles ? '✓' : '✗'}`,
      `palmes ${swim.fins ? '✓' : '✗'}`,
      `pullbuoy ${swim.pull_buoy ? '✓' : '✗'}`,
      `planche ${swim.kickboard ? '✓' : '✗'}`,
      `tuba frontal ${swim.snorkel ? '✓' : '✗'}`,
    ]
    lines.push(`Natation : ${items.join(', ')}`)
  }

  const bike = eq.bike
  if (bike) {
    lines.push(`Vélo : prolongateurs ${bike.aero_bars ? '✓' : '✗'}`)
  }

  const shoes = eq.run?.shoes
  if (shoes?.length) {
    const USAGE_FR: Record<string, string> = {
      footing: 'footing',
      dynamic: 'dynamique',
      competition: 'compétition',
    }
    const SURFACE_FR: Record<string, string> = { road: 'route', trail: 'trail' }
    lines.push('Course :')
    for (const s of shoes) {
      lines.push(
        `  - ${s.name} (${USAGE_FR[s.usage] ?? s.usage} · ${SURFACE_FR[s.surface] ?? s.surface})`,
      )
    }
  }

  return lines.join('\n')
}
```

- [ ] **Ajouter `equipment_block?: string` dans l'interface `MicroContext`**

L'interface `MicroContext` dans `src/lib/gemini/prompts.ts` commence à la ligne ~193. Ajouter le champ à la fin de l'interface, avant la fermeture `}` :

```ts
  equipment_block?: string
```

Interface complète après modification (copier-coller le bloc `interface MicroContext`) :

```ts
interface MicroContext {
  week: {
    week_num: number
    phase: string
    is_recovery_week: boolean
    planned_volume_hours: number
    planned_tss: number
    distribution: Record<string, number>
    notes: string
  }
  profile: {
    level: string | null
    weekly_hours_avg: number | null
    available_disciplines: string[] | null
  }
  available_days: number[]
  week_start_date: string
  prior_weeks?: PriorWeek[]
  plan_overview?: PlanWeekOverview[]
  athlete_zones?: string
  recent_wellness_summary?: string
  schedule_constraints?: string
  strava_stats_block?: string
  equipment_block?: string
}
```

- [ ] **Injecter le bloc équipement dans `buildMicroPrompt()`**

Dans la fonction `buildMicroPrompt()`, le `return` commence par une template string. Localiser la ligne :

```ts
${ctx.schedule_constraints ? `\nEMPLOI DU TEMPS PERSONNEL (créneaux OCCUPÉS — ne jamais placer d'entraînement dessus) :\n${ctx.schedule_constraints}\n` : ''}
```

Ajouter juste après (avant `Génère TOUTES les séances...`) :

```ts
${ctx.equipment_block ? `\n${ctx.equipment_block}\n\nRÈGLES MATÉRIEL (STRICTES) :\n- Ne jamais prescrire un exercice nécessitant un accessoire marqué ✗\n- Si prolongateurs vélo ✓ : inclure du travail en position aéro dans au moins une séance vélo longue\n- Pour la course : recommander dans le coaching_note la chaussure adaptée (footing → chaussure footing, compétition → chaussure compétition, trail → chaussure trail)\n` : ''}
```

- [ ] **Committer**

```bash
git add src/lib/gemini/prompts.ts
git commit -m "feat(ia): add buildEquipmentBlock and inject equipment into micro prompt"
```

---

## Task 3 — Schema Zod + Backend (dev-backend) — après Task 1

**Files:**

- Modify: `src/lib/schemas/profile.ts`
- Modify: `src/app/api/plans/[id]/regenerate-week/route.ts`

> Note : `src/app/api/profile/route.ts` n'a pas besoin de modification.
>
> - GET utilise `select('*')` → inclut automatiquement la colonne `equipment`
> - POST upsert `parsed.data` depuis `ProfileSchema` → inclura `equipment` une fois le schema étendu
> - PATCH utilise `ProfileSchema.partial()` → idem

- [ ] **Étendre ProfileSchema dans `src/lib/schemas/profile.ts`**

Ajouter après les imports existants (`import { z } from 'zod'`) :

```ts
const ShoeSchema = z.object({
  name: z.string().min(1).max(100),
  usage: z.enum(['footing', 'dynamic', 'competition']),
  surface: z.enum(['road', 'trail']),
})

const EquipmentSchema = z
  .object({
    swim: z
      .object({
        paddles: z.boolean(),
        fins: z.boolean(),
        pull_buoy: z.boolean(),
        kickboard: z.boolean(),
        snorkel: z.boolean(),
      })
      .optional(),
    bike: z
      .object({
        aero_bars: z.boolean(),
      })
      .optional(),
    run: z
      .object({
        shoes: z.array(ShoeSchema),
      })
      .optional(),
  })
  .optional()

export type EquipmentProfile = z.infer<typeof EquipmentSchema>
```

Puis ajouter `equipment: EquipmentSchema` à la fin du `ProfileSchema.object({...})`, avant la fermeture `)` :

```ts
export const ProfileSchema = z.object({
  first_name: z.string().min(1, 'Prénom requis').max(100),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  sex: z.enum(['M', 'F', 'X']),
  weight_kg: z.number().min(30).max(200).optional(),
  height_cm: z.number().min(100).max(250).optional(),
  experience_years: z.number().min(0).max(50).int().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'elite']),
  weekly_hours_avg: z.number().min(1).max(40).optional(),
  available_disciplines: z
    .array(z.enum(['swim', 'bike', 'run']))
    .min(1, 'Sélectionner au moins une discipline'),
  notes: z.string().max(1000).optional(),
  equipment: EquipmentSchema,
})
```

- [ ] **Modifier `src/app/api/plans/[id]/regenerate-week/route.ts` pour charger et passer l'equipment**

Étape 1 — Ajouter l'import de `buildEquipmentBlock` et `EquipmentData` en haut du fichier, avec les autres imports de prompts :

```ts
import {
  TRIATHLON_COACH_SYSTEM,
  buildMicroPrompt,
  buildEquipmentBlock,
  buildStravaStatsBlock,
  type PriorWeek,
  type PlanWeekOverview,
  type EquipmentData,
} from '@/lib/gemini/prompts'
```

Étape 2 — Dans le `select` du profil (ligne ~62), ajouter `equipment` :

```ts
(supabase as any)
  .from('profiles')
  .select('level, weekly_hours_avg, available_disciplines, equipment')
  .eq('id', user.id)
  .single() as Promise<{ data: Record<string, unknown> | null }>,
```

Étape 3 — Après la déclaration de `const profile = profileResult.data`, construire le bloc équipement :

```ts
const equipmentRaw = profile?.equipment as EquipmentData | null
const equipmentBlock =
  equipmentRaw && Object.keys(equipmentRaw).length > 0
    ? buildEquipmentBlock(equipmentRaw)
    : undefined
```

Étape 4 — Dans l'appel à `buildMicroPrompt({...})`, ajouter le champ (à la fin, juste avant `})`) :

```ts
equipment_block: equipmentBlock,
```

- [ ] **Committer**

```bash
git add src/lib/schemas/profile.ts src/app/api/plans/[id]/regenerate-week/route.ts
git commit -m "feat(backend): extend ProfileSchema with equipment and inject into week generation"
```

---

## Task 4 — Frontend (dev-frontend) — après Task 3

**Files:**

- Create: `src/components/profile/EquipmentSection.tsx`
- Modify: `src/app/(app)/profile/page.tsx`

### 4a — Créer `src/components/profile/EquipmentSection.tsx`

Ce composant Client gère l'affichage et l'édition de l'équipement. Il utilise PATCH `/api/profile` pour sauvegarder.

- [ ] **Créer `src/components/profile/EquipmentSection.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MINT = 'oklch(0.843 0.165 157)'
const DARK = 'oklch(0.116 0.022 155)'
const DARKER = 'oklch(0.09 0.018 155)'
const DIV = 'oklch(1 0 0 / 8%)'

interface Shoe {
  name: string
  usage: 'footing' | 'dynamic' | 'competition'
  surface: 'road' | 'trail'
}

interface EquipmentData {
  swim?: {
    paddles?: boolean
    fins?: boolean
    pull_buoy?: boolean
    kickboard?: boolean
    snorkel?: boolean
  }
  bike?: { aero_bars?: boolean }
  run?: { shoes?: Shoe[] }
}

interface Props {
  initial: EquipmentData
}

const SWIM_ITEMS: { key: keyof NonNullable<EquipmentData['swim']>; label: string }[] = [
  { key: 'paddles', label: 'Plaquettes mains' },
  { key: 'fins', label: 'Palmes' },
  { key: 'pull_buoy', label: 'Pullbuoy' },
  { key: 'kickboard', label: 'Planche' },
  { key: 'snorkel', label: 'Tuba frontal' },
]

const USAGE_LABELS: Record<Shoe['usage'], string> = {
  footing: 'Footing',
  dynamic: 'Dynamique',
  competition: 'Compétition',
}

const SURFACE_LABELS: Record<Shoe['surface'], string> = {
  road: 'Route',
  trail: 'Trail',
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
      style={{
        backgroundColor: active ? MINT : 'oklch(1 0 0 / 6%)',
        color: active ? DARK : 'oklch(1 0 0 / 45%)',
        border: `1px solid ${active ? MINT : 'oklch(1 0 0 / 12%)'}`,
      }}
    >
      {label}
    </button>
  )
}

export function EquipmentSection({ initial }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<EquipmentData>(initial ?? {})

  function toggleSwim(key: keyof NonNullable<EquipmentData['swim']>) {
    setData((prev) => ({
      ...prev,
      swim: { ...prev.swim, [key]: !prev.swim?.[key] },
    }))
  }

  function toggleAeroBars() {
    setData((prev) => ({
      ...prev,
      bike: { aero_bars: !prev.bike?.aero_bars },
    }))
  }

  function addShoe() {
    setData((prev) => ({
      ...prev,
      run: { shoes: [...(prev.run?.shoes ?? []), { name: '', usage: 'footing', surface: 'road' }] },
    }))
  }

  function removeShoe(i: number) {
    setData((prev) => ({
      ...prev,
      run: { shoes: (prev.run?.shoes ?? []).filter((_, idx) => idx !== i) },
    }))
  }

  function updateShoe(i: number, field: keyof Shoe, value: string) {
    setData((prev) => {
      const shoes = [...(prev.run?.shoes ?? [])]
      shoes[i] = { ...shoes[i], [field]: value }
      return { ...prev, run: { shoes } }
    })
  }

  async function save() {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipment: data }),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    const hasAny =
      Object.values(data.swim ?? {}).some(Boolean) ||
      data.bike?.aero_bars ||
      (data.run?.shoes?.length ?? 0) > 0

    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: DARKER, borderBottom: `1px solid ${DIV}` }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: 'oklch(1 0 0 / 40%)' }}
          >
            Matériel
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors hover:opacity-70"
            style={{ color: MINT, borderColor: `${MINT}40` }}
          >
            <Pencil size={11} />
            Modifier
          </button>
        </div>

        {!hasAny ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm" style={{ color: 'oklch(1 0 0 / 35%)' }}>
              Aucun matériel renseigné — le coach utilisera des séances standard
            </p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {Object.values(data.swim ?? {}).some(Boolean) && (
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'oklch(1 0 0 / 38%)' }}
                >
                  Natation
                </p>
                <div className="flex flex-wrap gap-2">
                  {SWIM_ITEMS.filter((item) => data.swim?.[item.key]).map((item) => (
                    <span
                      key={item.key}
                      className="px-3 py-1 rounded-lg text-xs font-bold"
                      style={{
                        backgroundColor: `${MINT}18`,
                        color: MINT,
                        border: `1px solid ${MINT}30`,
                      }}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.bike?.aero_bars && (
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'oklch(1 0 0 / 38%)' }}
                >
                  Vélo
                </p>
                <span
                  className="px-3 py-1 rounded-lg text-xs font-bold"
                  style={{
                    backgroundColor: `${MINT}18`,
                    color: MINT,
                    border: `1px solid ${MINT}30`,
                  }}
                >
                  Prolongateurs
                </span>
              </div>
            )}

            {(data.run?.shoes?.length ?? 0) > 0 && (
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'oklch(1 0 0 / 38%)' }}
                >
                  Course
                </p>
                <div className="space-y-1.5">
                  {data.run!.shoes!.map((shoe, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-bold">{shoe.name}</span>
                      <span className="text-xs" style={{ color: 'oklch(1 0 0 / 40%)' }}>
                        {USAGE_LABELS[shoe.usage]} · {SURFACE_LABELS[shoe.surface]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: DARK, border: `1px solid ${DIV}` }}
    >
      <div
        className="px-5 py-4"
        style={{ backgroundColor: DARKER, borderBottom: `1px solid ${DIV}` }}
      >
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: 'oklch(1 0 0 / 40%)' }}
        >
          Modifier le matériel
        </p>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* ── Natation ── */}
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'oklch(1 0 0 / 38%)' }}
          >
            Natation
          </p>
          <div className="flex flex-wrap gap-2">
            {SWIM_ITEMS.map((item) => (
              <ToggleChip
                key={item.key}
                label={item.label}
                active={!!data.swim?.[item.key]}
                onClick={() => toggleSwim(item.key)}
              />
            ))}
          </div>
        </div>

        {/* ── Vélo ── */}
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'oklch(1 0 0 / 38%)' }}
          >
            Vélo
          </p>
          <ToggleChip
            label="Prolongateurs"
            active={!!data.bike?.aero_bars}
            onClick={toggleAeroBars}
          />
        </div>

        {/* ── Course ── */}
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'oklch(1 0 0 / 38%)' }}
          >
            Course
          </p>
          <div className="space-y-3">
            {(data.run?.shoes ?? []).map((shoe, i) => (
              <div
                key={i}
                className="rounded-xl p-3 space-y-2"
                style={{ backgroundColor: 'oklch(1 0 0 / 4%)', border: `1px solid ${DIV}` }}
              >
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nom de la chaussure"
                    value={shoe.name}
                    onChange={(e) => updateShoe(i, 'name', e.target.value)}
                    className="flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeShoe(i)}
                    className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: 'oklch(0.65 0.20 25)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Select value={shoe.usage} onValueChange={(v) => updateShoe(i, 'usage', v)}>
                    <SelectTrigger className="flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="footing">Footing</SelectItem>
                      <SelectItem value="dynamic">Dynamique</SelectItem>
                      <SelectItem value="competition">Compétition</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={shoe.surface} onValueChange={(v) => updateShoe(i, 'surface', v)}>
                    <SelectTrigger className="flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="road">Route</SelectItem>
                      <SelectItem value="trail">Trail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addShoe}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-xl border transition-opacity hover:opacity-70 w-full justify-center"
              style={{ color: MINT, borderColor: `${MINT}30`, backgroundColor: `${MINT}08` }}
            >
              <Plus size={13} />
              Ajouter une paire
            </button>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setData(initial ?? {})
              setEditing(false)
            }}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 font-bold"
            style={{ backgroundColor: MINT, color: DARK }}
          >
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### 4b — Modifier `src/app/(app)/profile/page.tsx`

- [ ] **Ajouter `equipment` au select du profil**

Localiser la ligne (environ ligne 162) :

```ts
.select("first_name, level, weight_kg, weekly_hours_avg, available_disciplines, birth_date")
```

Remplacer par :

```ts
.select("first_name, level, weight_kg, weekly_hours_avg, available_disciplines, birth_date, equipment")
```

- [ ] **Étendre le type `profile` avec `equipment`**

Localiser le cast de type du profil (environ ligne 191) :

```ts
const profile = profileRes.data as {
  first_name: string | null
  level: string | null
  weight_kg: number | null
  weekly_hours_avg: number | null
  available_disciplines: string[] | null
  birth_date: string | null
} | null
```

Remplacer par :

```ts
const profile = profileRes.data as {
  first_name: string | null
  level: string | null
  weight_kg: number | null
  weekly_hours_avg: number | null
  available_disciplines: string[] | null
  birth_date: string | null
  equipment: Record<string, unknown> | null
} | null
```

- [ ] **Importer EquipmentSection**

Ajouter en haut du fichier, avec les autres imports :

```ts
import { EquipmentSection } from '@/components/profile/EquipmentSection'
```

- [ ] **Insérer la section Matériel dans le JSX**

Localiser dans le JSX de la page la section `{/* ── Informations personnelles ── */}` (environ ligne 397). Insérer **avant** elle :

```tsx
{
  /* ── Matériel ── */
}
;<section>
  <SectionTitle>Matériel</SectionTitle>
  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
  <EquipmentSection initial={(profile?.equipment ?? {}) as any} />
</section>
```

- [ ] **Committer**

```bash
git add src/components/profile/EquipmentSection.tsx src/app/(app)/profile/page.tsx
git commit -m "feat(frontend): add EquipmentSection to profile page"
```

---

## Vérification finale

- [ ] Lancer l'app : `npm run dev`
- [ ] Aller sur `/profile` → section "Matériel" visible
- [ ] Cliquer "Modifier" → activer des items natation + prolongateurs + ajouter 2 paires de chaussures
- [ ] Sauvegarder → la page se rafraîchit, les données persistent
- [ ] Régénérer une semaine dans `/program` → vérifier dans les logs Gemini que le bloc matériel apparaît dans le prompt
