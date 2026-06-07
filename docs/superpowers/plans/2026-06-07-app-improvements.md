# App Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter 4 améliorations indépendantes : bouton "Nouvelle conversation" dans le coach IA, indicateurs du programme toujours frais, ordre des semaines (actuelle en premier), et suppression du RPE dans les cartes de séance.

**Architecture:** Soft reset de la conversation via colonne `archived_at` sur `chat_messages` (pas de suppression). Les données du programme sont forcées en rendu dynamique (`force-dynamic`). La réorganisation des semaines est purement côté rendu dans le Server Component.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + admin client), React, date-fns, TypeScript

---

## Fichiers impactés

| Fichier | Action |
|---|---|
| Migration Supabase SQL | Créer — `ALTER TABLE chat_messages ADD COLUMN archived_at` |
| `src/app/api/chat/route.ts` | Modifier — filtre `archived_at IS NULL` sur GET + historique POST + handler DELETE |
| `src/components/coach/CoachChat.tsx` | Modifier — bouton "Nouvelle conversation" |
| `src/app/(app)/program/page.tsx` | Modifier — `force-dynamic` + tri des semaines |
| `src/components/plan/SessionCard.tsx` | Modifier — retirer affichage RPE |

---

## Task 1 : Migration Supabase — colonne `archived_at`

**Files:**
- Aucun fichier de code — migration à exécuter dans le dashboard Supabase

- [ ] **Step 1 : Ouvrir le SQL Editor Supabase**

  Va dans ton projet Supabase → SQL Editor → New query.

- [ ] **Step 2 : Exécuter la migration**

  ```sql
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;
  ```

  Résultat attendu : `Success. No rows returned.`

- [ ] **Step 3 : Vérifier la colonne**

  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'chat_messages'
    AND column_name = 'archived_at';
  ```

  Résultat attendu : une ligne avec `archived_at | timestamp with time zone | YES`.

---

## Task 2 : Filtrer les messages archivés dans `/api/chat` (GET + historique POST)

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1 : Ouvrir le fichier**

  `src/app/api/chat/route.ts`

- [ ] **Step 2 : Ajouter `.is('archived_at', null)` dans le handler GET**

  Localiser (lignes 33–41) :
  ```ts
  const { data, error: fetchError } = await (supabase as any)
    .from('chat_messages')
    .select('id, role, content, proposed_action, action_status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  ```

  Remplacer par :
  ```ts
  const { data, error: fetchError } = await (supabase as any)
    .from('chat_messages')
    .select('id, role, content, proposed_action, action_status, created_at')
    .eq('user_id', user.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  ```

- [ ] **Step 3 : Ajouter `.is('archived_at', null)` dans la requête historique du handler POST**

  Localiser (vers la ligne 94–101, dans le `Promise.all`) la requête `chat_messages` pour l'historique :
  ```ts
  (supabase as any)
    .from('chat_messages')
    .select('role, content')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10),
  ```

  Remplacer par :
  ```ts
  (supabase as any)
    .from('chat_messages')
    .select('role, content')
    .eq('user_id', user.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(10),
  ```

- [ ] **Step 4 : Vérification manuelle**

  Démarre l'app (`npm run dev`), envoie un message au coach, vérifie qu'il s'affiche normalement. Aucun comportement visible ne change à ce stade (la colonne est NULL pour tous les messages existants).

- [ ] **Step 5 : Commit**

  ```bash
  git add src/app/api/chat/route.ts
  git commit -m "feat: filter archived chat messages from GET and POST history"
  ```

---

## Task 3 : Ajouter `DELETE /api/chat` — archiver les messages

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1 : Ajouter le handler DELETE à la fin du fichier**

  Ajouter après la fonction `POST`, à la fin de `src/app/api/chat/route.ts` :

  ```ts
  export async function DELETE(_request: Request) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return apiError('Non authentifié', 401)

    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (admin as any)
      .from('chat_messages')
      .update({ archived_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('archived_at', null)

    if (updateError) return apiError(updateError.message)
    return apiSuccess({ archived: true })
  }
  ```

  Note : `createAdminClient` est déjà importé en haut du fichier (`import { createAdminClient } from '@/lib/supabase/admin'`).

- [ ] **Step 2 : Vérification manuelle**

  Dans le terminal ou un client HTTP (ex. curl) :
  ```bash
  # Appel depuis le navigateur via DevTools console (sur l'app en dev) :
  # fetch('/api/chat', { method: 'DELETE' }).then(r => r.json()).then(console.log)
  ```
  Résultat attendu : `{ data: { archived: true }, success: true }`

  Vérifier dans Supabase que les lignes `chat_messages` ont bien un `archived_at` non NULL.

- [ ] **Step 3 : Commit**

  ```bash
  git add src/app/api/chat/route.ts
  git commit -m "feat: add DELETE /api/chat to archive conversation"
  ```

---

## Task 4 : Bouton "Nouvelle conversation" dans `CoachChat.tsx`

**Files:**
- Modify: `src/components/coach/CoachChat.tsx`

- [ ] **Step 1 : Ajouter la fonction `resetConversation`**

  Dans le corps du composant `CoachChat`, après la déclaration de `handleAction`, ajouter :

  ```ts
  const resetConversation = useCallback(async () => {
    await fetch('/api/chat', { method: 'DELETE' })
    setMessages([])
  }, [])
  ```

- [ ] **Step 2 : Ajouter le bouton dans le header**

  Localiser le header (autour de la ligne 127–152) :
  ```tsx
  <div
    className="px-5 py-3 flex items-center gap-2 flex-shrink-0"
    style={{ borderBottom: `1px solid ${DIV}`, backgroundColor: DARKER }}
  >
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
      style={{ backgroundColor: `${MINT}20`, border: `1px solid ${MINT}40` }}
    >
      🤖
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-widest" style={{ color: MINT }}>
        Coach IA
      </p>
    </div>
    {sending && (
      <div className="ml-auto flex gap-1">
        ...
      </div>
    )}
  </div>
  ```

  Remplacer par :
  ```tsx
  <div
    className="px-5 py-3 flex items-center gap-2 flex-shrink-0"
    style={{ borderBottom: `1px solid ${DIV}`, backgroundColor: DARKER }}
  >
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
      style={{ backgroundColor: `${MINT}20`, border: `1px solid ${MINT}40` }}
    >
      🤖
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-widest" style={{ color: MINT }}>
        Coach IA
      </p>
    </div>
    <div className="ml-auto flex items-center gap-3">
      {sending && (
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: MINT, animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      )}
      <button
        onClick={resetConversation}
        className="text-xs uppercase tracking-widest transition-opacity hover:opacity-70"
        style={{ color: MUTED }}
        title="Démarrer une nouvelle conversation"
      >
        Nouvelle conv.
      </button>
    </div>
  </div>
  ```

- [ ] **Step 3 : Vérification manuelle**

  - Le bouton "Nouvelle conv." apparaît à droite du header.
  - Au clic : la zone de messages se vide immédiatement.
  - Recharger la page : la conversation est toujours vide (les anciens messages ont `archived_at` non NULL, filtrés par le GET).
  - Envoyer un nouveau message : il apparaît normalement.

- [ ] **Step 4 : Commit**

  ```bash
  git add src/components/coach/CoachChat.tsx
  git commit -m "feat: add 'Nouvelle conversation' button to CoachChat"
  ```

---

## Task 5 : Programme — `force-dynamic` + données toujours fraîches

**Files:**
- Modify: `src/app/(app)/program/page.tsx`

- [ ] **Step 1 : Ajouter `export const dynamic = 'force-dynamic'`**

  Ouvrir `src/app/(app)/program/page.tsx`. Après les imports (ligne ~12, avant `export const metadata`), ajouter :

  ```ts
  export const dynamic = 'force-dynamic'
  ```

  Le fichier doit commencer ainsi :
  ```ts
  import { createClient } from '@/lib/supabase/server'
  import { redirect } from 'next/navigation'
  import Link from 'next/link'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent } from '@/components/ui/card'
  import { Badge } from '@/components/ui/badge'
  import { PhaseBar } from '@/components/plan/PhaseBar'
  import { WeekView } from '@/components/plan/WeekView'
  import { StopProgramButton } from '@/components/plan/StopProgramButton'
  import { differenceInWeeks, parseISO, format } from 'date-fns'
  import { fr } from 'date-fns/locale'

  export const dynamic = 'force-dynamic'
  export const metadata = { title: 'Programme — Coach Tri' }
  ```

- [ ] **Step 2 : Vérification manuelle**

  Marquer une séance comme "done" depuis `/session/[id]`, puis revenir sur `/program`. Les compteurs "Séances complétées" et "Volume accumulé" doivent refléter la mise à jour immédiatement.

- [ ] **Step 3 : Commit**

  ```bash
  git add src/app/(app)/program/page.tsx
  git commit -m "fix: force-dynamic on program page to prevent stale stats"
  ```

---

## Task 6 : Programme — Semaine actuelle en premier, passées en bas

**Files:**
- Modify: `src/app/(app)/program/page.tsx`

- [ ] **Step 1 : Remplacer la section "Weeks" dans la page**

  Localiser le bloc `{/* Weeks */}` (vers la ligne 127–138) :

  ```tsx
  {/* Weeks */}
  <div className="space-y-3">
    <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Semaines</h2>
    {weeks.map(week => (
      <WeekView
        key={week.id as string}
        week={week as unknown as Parameters<typeof WeekView>[0]['week']}
        planId={plan.id as string}
        isCurrentWeek={(week.week_num as number) === currentWeekNum}
      />
    ))}
  </div>
  ```

  Remplacer par :

  ```tsx
  {/* Weeks */}
  {(() => {
    const currentWeek = weeks.find(w => (w.week_num as number) === currentWeekNum) ?? null
    const futureWeeks = weeks
      .filter(w => (w.week_num as number) > currentWeekNum)
      .sort((a, b) => (a.week_num as number) - (b.week_num as number))
    const pastWeeks = weeks
      .filter(w => (w.week_num as number) < currentWeekNum)
      .sort((a, b) => (b.week_num as number) - (a.week_num as number))

    return (
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Semaines</h2>

        {currentWeek && (
          <WeekView
            key={currentWeek.id as string}
            week={currentWeek as unknown as Parameters<typeof WeekView>[0]['week']}
            planId={plan.id as string}
            isCurrentWeek={true}
          />
        )}

        {futureWeeks.map(week => (
          <WeekView
            key={week.id as string}
            week={week as unknown as Parameters<typeof WeekView>[0]['week']}
            planId={plan.id as string}
            isCurrentWeek={false}
          />
        ))}

        {pastWeeks.length > 0 && (
          <>
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide pt-2">
              Semaines passées
            </h3>
            {pastWeeks.map(week => (
              <WeekView
                key={week.id as string}
                week={week as unknown as Parameters<typeof WeekView>[0]['week']}
                planId={plan.id as string}
                isCurrentWeek={false}
              />
            ))}
          </>
        )}
      </div>
    )
  })()}
  ```

- [ ] **Step 2 : Vérification manuelle**

  Sur `/program` :
  - La semaine en cours apparaît en premier, ouverte.
  - Les semaines futures suivent, fermées.
  - Si des semaines passées existent : séparateur "Semaines passées" + semaines repliées (la plus récente en tête).
  - Si c'est la semaine 1 : pas de section "Semaines passées".

- [ ] **Step 3 : Commit**

  ```bash
  git add src/app/(app)/program/page.tsx
  git commit -m "feat: show current week first, past weeks grouped at bottom"
  ```

---

## Task 7 : Supprimer l'affichage du RPE dans `SessionCard`

**Files:**
- Modify: `src/components/plan/SessionCard.tsx`

- [ ] **Step 1 : Retirer le fragment RPE**

  Localiser la ligne ~50 dans `src/components/plan/SessionCard.tsx` :

  ```tsx
  <p className="text-xs text-zinc-500 mt-0.5">
    {format(date, 'EEEE d MMM', { locale: fr })} · {session.duration_min} min
    {session.expected_rpe ? ` · RPE ${session.expected_rpe}` : ''}
  </p>
  ```

  Remplacer par :

  ```tsx
  <p className="text-xs text-zinc-500 mt-0.5">
    {format(date, 'EEEE d MMM', { locale: fr })} · {session.duration_min} min
  </p>
  ```

- [ ] **Step 2 : Vérification manuelle**

  Sur `/program`, ouvrir la semaine en cours. Les cartes de séance n'affichent plus "RPE X".
  Sur `/session/[id]`, le RPE attendu est toujours visible (ce composant n'est pas touché).

- [ ] **Step 3 : Commit**

  ```bash
  git add src/components/plan/SessionCard.tsx
  git commit -m "feat: remove expected RPE display from SessionCard"
  ```

---

## Récapitulatif des commits attendus

1. `feat: filter archived chat messages from GET and POST history`
2. `feat: add DELETE /api/chat to archive conversation`
3. `feat: add 'Nouvelle conversation' button to CoachChat`
4. `fix: force-dynamic on program page to prevent stale stats`
5. `feat: show current week first, past weeks grouped at bottom`
6. `feat: remove expected RPE display from SessionCard`
