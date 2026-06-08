# Système d'agents orchestrés — Coach Tri

**Date** : 2026-06-08  
**Statut** : Approuvé  
**Contexte** : Mettre en place un système d'agents spécialisés pour faciliter les modifications et la maintenance du site Coach Tri, piloté par un agent orchestrateur (Chef de Projet).

---

## Problème résolu

Quand une modification touche plusieurs couches (UI, API, IA, DB), il est fastidieux de naviguer manuellement entre les contextes. Ce système permet d'exprimer une demande en langage naturel au Chef de Projet, qui la décompose et dispatche chaque partie au bon spécialiste.

---

## Architecture

### Fichiers créés

```
coach-tri/.claude/agents/
  chef-de-projet.md
  dev-frontend.md
  dev-backend.md
  dev-ia.md
  dev-data.md
```

Chaque fichier est le system prompt de l'agent correspondant. Le Chef de Projet est le seul agent invoqué directement par l'utilisateur.

---

## Agents

### Chef de Projet (orchestrateur)

**Invocation** : L'utilisateur décrit sa modification en langage naturel. Claude Code dispatche vers cet agent.

**Comportement** :
1. Si la demande est ambiguë, poser une seule question de clarification
2. Identifier explicitement les couches touchées parmi : frontend / backend / IA / data
3. Rédiger un mini-brief par spécialiste nécessaire
4. Résoudre les dépendances entre agents (voir règles ci-dessous)
5. Spawner les agents indépendants en parallèle, les dépendants en séquence
6. Faire une passe de cohérence finale entre les sorties (noms d'endpoints, types partagés, etc.)

**Contexte projet** : Connaît la structure complète du projet, toutes les routes, toutes les tables, le design system.

---

### Dev Frontend

**Périmètre** : Pages Next.js, composants React, design system Run Motion.

**Sait faire** :
- App Router Next.js 16, React 19, groupes de routes `(app)/`
- Tailwind v4 + shadcn/ui, couleurs OKLCH inline (jamais de classes Tailwind custom)
- Conventions UI : `rounded-2xl` cards, `rounded-xl` boutons, `font-black uppercase tracking-widest text-xs` étiquettes
- Couleurs : MINT `oklch(0.843 0.165 157)`, DARK `oklch(0.116 0.022 155)`
- AppNav (sticky desktop + bottom bar mobile 5 liens)
- Typo : Outfit (sans), JetBrains Mono (mono)

**Ne touche pas** : routes API, migrations SQL, prompts Gemini.

---

### Dev Backend

**Périmètre** : Route Handlers Next.js, logique métier, accès données Supabase.

**Sait faire** :
- Route Handlers App Router, `await params` (Next.js 16 — params est une Promise)
- `createClient()` server pour Server Components, `createAdminClient()` pour écriture dans Route Handlers
- Zod v4 : `safeParse()` systématique, `valueAsNumber: true` pour les nombres
- `apiSuccess(data, status?)` / `apiError(message, status?)` pour toutes les réponses
- Auth SSR Supabase, protection des routes, RLS bypass via admin client

**Ne touche pas** : composants UI, migrations SQL, prompts Gemini.

---

### Dev IA

**Périmètre** : Prompts Gemini, logique du coach chat, génération de programme.

**Sait faire** :
- `generateJSON<T>(systemPrompt, userPrompt, { temperature? })` dans `src/lib/gemini/client.ts`
- Modèle `gemini-2.5-flash`, `thinkingBudget: 0`, `responseMimeType: 'application/json'`
- `COACH_CHAT_SYSTEM`, `buildMacroPrompt()`, `buildMicroPrompt()`, `buildChatContext()`
- Les 4 actions coach : `cancel_session`, `move_session`, `adjust_session`, `regenerate_week`
- Format réponse chat : `{ message, proposedAction: null | { type, description, params } }`

**Ne touche pas** : composants UI, structure des routes API, schéma DB.

---

### Dev Data

**Périmètre** : Migrations Supabase, schéma DB, sync Garmin.

**Sait faire** :
- Conventions migrations : `coach-tri/supabase/migrations/000X_nom.sql`
- Toutes les tables existantes (profiles, physiology, goals, plans, plan_phases, plan_weeks, sessions, garmin_*, schedule_events, chat_messages, availability_blocks, plan_generations)
- Upsert sur conflit : `ON CONFLICT (user_id, garmin_activity_id) DO UPDATE`
- Architecture sync Garmin : délai 350ms intentionnel entre jours wellness (rate limit ~3 req/s)
- Chiffrement AES-256-CBC credentials : `encryptCredential()` / `decryptCredential()`

**Ne touche pas** : composants UI, routes API, prompts Gemini.

---

## Règles de dépendances

| Situation | Ordre d'exécution |
|---|---|
| Frontend + Backend sans lien entre eux | Parallèle |
| Frontend consomme un nouvel endpoint Backend | Backend → Frontend |
| Backend lit une nouvelle table ou colonne | Data → Backend |
| Prompt IA modifié + UI du chat modifiée | Parallèle |
| Nouveau champ DB + route qui le lit + UI qui l'affiche | Data → Backend → Frontend |
| Backend + IA sur des routes existantes indépendantes | Parallèle |

---

## Exemple de brief produit par le Chef de Projet

**Demande** : "Ajouter une page de statistiques de progression (volume par semaine, TSS, comparatif disciplines)"

**Analyse** :
- Data : nouvelle vue SQL agrégeant les sessions par semaine
- Backend : nouvelle route `GET /api/stats`  
- Frontend : nouvelle page `/stats` avec graphes
- IA : enrichir `buildChatContext()` avec les stats récentes

**Plan d'exécution** :
```
Étape 1 (parallèle) :
  - Dev Data  → migration vue stats_progression
  - Dev IA    → ajout stats dans buildChatContext()

Étape 2 (séquentiel, dépend de Data) :
  - Dev Backend → GET /api/stats

Étape 3 (séquentiel, dépend de Backend) :
  - Dev Frontend → page /stats
```

---

## Usage

Pour déclencher une modification, l'utilisateur dit simplement à Claude ce qu'il veut faire. Claude détecte l'agent `chef-de-projet` dans `.claude/agents/` et peut l'invoquer directement, ou l'utilisateur peut l'invoquer explicitement :

```
@chef-de-projet ajoute une page de statistiques de progression
```

Le Chef de Projet pose une question si nécessaire, puis dispatche vers les spécialistes. L'utilisateur ne parle qu'au Chef de Projet — jamais aux spécialistes directement (sauf correction ciblée).

---

## Ce qui n'est pas dans ce système

- **Tests automatisés** : pas d'agent QA dans ce périmètre
- **Déploiement** : géré séparément via le skill `vercel:deploy`
- **Revue de code** : géré séparément via le skill `code-review`
- **Nouveaux agents** : on peut en ajouter (ex: `dev-perf.md`) sans modifier l'architecture
