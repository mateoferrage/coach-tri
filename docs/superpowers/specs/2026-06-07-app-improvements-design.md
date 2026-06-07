# Design — Améliorations app Coach Tri

**Date** : 2026-06-07  
**Scope** : 4 fonctionnalités indépendantes sur Dashboard, Programme

---

## 1. Accueil — Bouton "Nouvelle conversation"

### Objectif
Permettre à l'utilisateur de démarrer une conversation vierge avec le coach IA sans perdre l'historique existant.

### Approche
Soft reset via colonne `archived_at` sur `chat_messages`.

### Migration DB
```sql
ALTER TABLE chat_messages ADD COLUMN archived_at timestamptz NULL;
```

### API
- `GET /api/chat?limit=20` : ajouter filtre `WHERE archived_at IS NULL`
- `DELETE /api/chat` (nouveau endpoint) : `UPDATE chat_messages SET archived_at = now() WHERE user_id = X AND archived_at IS NULL`

### UI
- Header de `CoachChat.tsx` : bouton discret "Nouvelle conversation" à droite du titre "Coach IA"
- Au clic → appel `DELETE /api/chat` → vider `messages` state localement

---

## 2. Programme — Indicateurs toujours à jour

### Problème
Les stats (semaine, phase, séances complétées, volume) peuvent être obsolètes après une action (ex. marquer une séance comme "done") à cause du router cache client de Next.js 16.

### Approche
- Ajouter `export const dynamic = 'force-dynamic'` dans `program/page.tsx`
- Appeler `revalidatePath('/program')` depuis `PATCH /api/sessions/[id]` après toute mise à jour de statut

---

## 3. Programme — Ordre des semaines

### Objectif
La semaine en cours apparaît en premier (ouverte), les semaines futures suivent (fermées), les semaines passées sont regroupées en bas sous un séparateur "Semaines passées" (toutes fermées).

### Logique dans `program/page.tsx`
```ts
const currentWeek = weeks.find(w => w.week_num === currentWeekNum)
const futureWeeks = weeks
  .filter(w => (w.week_num as number) > currentWeekNum)
  .sort((a, b) => (a.week_num as number) - (b.week_num as number))
const pastWeeks = weeks
  .filter(w => (w.week_num as number) < currentWeekNum)
  .sort((a, b) => (b.week_num as number) - (a.week_num as number)) // décroissant
```

### Rendu
```
currentWeek    (isCurrentWeek=true, ouvert par défaut dans WeekView)
futureWeeks[]  (isCurrentWeek=false, fermés)
-- "Semaines passées" (séparateur affiché seulement si pastWeeks.length > 0)
pastWeeks[]    (isCurrentWeek=false, fermés)
```

Aucune modification de `WeekView.tsx` nécessaire.

---

## 4. Programme — Supprimer l'affichage du RPE dans les séances

### Fichier concerné
`src/components/plan/SessionCard.tsx` ligne 50

### Changement
Retirer le fragment ` · RPE ${session.expected_rpe}` de la ligne de sous-titre.

Le champ `expected_rpe` reste en base et sur la page de détail de séance — seul l'affichage dans la liste est supprimé.

---

## Fichiers impactés

| Fichier | Modification |
|---|---|
| `src/app/(app)/program/page.tsx` | `force-dynamic` + tri des semaines |
| `src/components/plan/WeekView.tsx` | Aucune |
| `src/components/plan/SessionCard.tsx` | Retirer affichage RPE |
| `src/components/coach/CoachChat.tsx` | Bouton "Nouvelle conversation" |
| `src/app/api/chat/route.ts` | Filtre `archived_at IS NULL` sur GET + handler DELETE |
| `src/app/api/sessions/[id]/route.ts` | Appel `revalidatePath('/program')` |
| Migration Supabase | `ALTER TABLE chat_messages ADD COLUMN archived_at timestamptz NULL` |

---

## Hors scope (reporté)

- Intégration Apple Calendar (WebCal/ICS) — voir mémoire `coach-tri-apple-calendar`
