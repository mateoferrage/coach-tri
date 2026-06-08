# Design — Gestion du matériel triathlète

**Date** : 2026-06-08  
**Statut** : Validé

---

## Contexte

Les athlètes ont du matériel spécifique par discipline. Gemini ne sait pas ce qu'ils possèdent, donc il peut suggérer des exercices avec des accessoires que l'athlète n'a pas (ex : séance plaquettes sans plaquettes) ou passer à côté d'opportunités (ex : travail en position TT si prolongateurs disponibles). L'objectif est de collecter ces données dans le profil et de les injecter dans les prompts de génération.

---

## Périmètre

4 catégories déclarées, 3 actives maintenant :

| Catégorie | Contenu |
|---|---|
| Natation | Plaquettes mains, palmes, pullbuoy, planche, tuba frontal (oui/non chacun) |
| Vélo | Prolongateurs (oui/non) |
| Course | Plusieurs paires de chaussures (nom, usage, surface) |
| Entrainement | Vide pour l'instant — prévu pour plus tard |

---

## Architecture

### Option retenue : JSONB dans `profiles`

L'équipement est stocké dans une colonne `equipment JSONB DEFAULT '{}'` dans la table `profiles` existante. Chargé automatiquement avec le profil, pas de join supplémentaire. Cohérent avec les champs `params` et `summary` de `plans`.

---

## Data — Migration SQL

**Fichier** : `supabase/migrations/0021_equipment.sql`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '{}';
```

---

## Backend — `/api/profile`

Le schéma Zod `ProfileSchema` (`src/lib/schemas/profile.ts`) est étendu avec le champ `equipment` optionnel :

```ts
equipment: z.object({
  swim: z.object({
    paddles:   z.boolean().optional(),
    fins:      z.boolean().optional(),
    pull_buoy: z.boolean().optional(),
    kickboard: z.boolean().optional(),
    snorkel:   z.boolean().optional(),
  }).optional(),
  bike: z.object({
    aero_bars: z.boolean().optional(),
  }).optional(),
  run: z.object({
    shoes: z.array(z.object({
      name:    z.string().min(1).max(100),
      usage:   z.enum(['footing', 'dynamic', 'competition']),
      surface: z.enum(['road', 'trail']),
    })).optional(),
  }).optional(),
}).optional(),
```

- **GET `/api/profile`** : ajouter `equipment` dans le `select()`
- **POST `/api/profile`** : validé par `ProfileSchema`, upsert dans `profiles`

Pas de nouvelle route.

---

## IA — Prompts Gemini

### `buildMicroPrompt()` (`src/lib/gemini/prompts.ts`)

Ajout d'un paramètre `equipment_block?: string` dans `MicroContext`. Une fonction `buildEquipmentBlock(equipment)` formate le JSONB en texte lisible à injecter dans le prompt :

```
MATÉRIEL DISPONIBLE :
Natation : plaquettes mains ✓, palmes ✗, pullbuoy ✓, planche ✓, tuba frontal ✗
Vélo : prolongateurs ✓
Course :
  - Nike Vaporfly (compétition · route)
  - Salomon Speedcross (footing · trail)
```

Ce bloc est injecté juste avant les contraintes strictes, avec la règle :

> Ne jamais prescrire d'exercice nécessitant un accessoire marqué ✗. Pour le vélo, si prolongateurs ✓, inclure du travail en position aéro. Pour la course, recommander la chaussure adaptée au type de séance dans le `coaching_note`.

### `POST /api/plans/[id]/regenerate-week`

Charger `equipment` depuis `profiles` et le passer à `buildMicroPrompt()`.

---

## Frontend — Page profil

**Fichier** : `src/app/(app)/profile/page.tsx` et nouveau composant `src/components/profile/EquipmentSection.tsx`

Nouvelle section "Matériel" dans la page `/profile`, entre "Informations personnelles" et "Données physiologiques".

`EquipmentSection` est un Client Component (interactions utilisateur) qui :
1. Affiche l'équipement actuel en lecture (chips/badges)
2. Propose un bouton "Modifier" qui ouvre un formulaire inline (pas de modal) avec :
   - **Natation** : 5 toggles (Switch shadcn/ui) labelisés
   - **Vélo** : 1 toggle pour les prolongateurs
   - **Course** : liste de chaussures avec bouton "Ajouter" → champs nom + select usage + select surface ; bouton supprimer par paire
3. Sauvegarde via `POST /api/profile` avec le profil complet mis à jour

---

## Flux de données complet

```
Athlète remplit le formulaire
       ↓
POST /api/profile  (ProfileSchema valide equipment)
       ↓
profiles.equipment = { swim: {...}, bike: {...}, run: { shoes: [...] } }
       ↓
POST /api/plans/[id]/regenerate-week
  → SELECT profiles.equipment
  → buildEquipmentBlock(equipment)
  → buildMicroPrompt({ ..., equipment_block })
       ↓
Gemini reçoit le bloc matériel dans le prompt
  → Adapte les séances (pas d'accessoires manquants, chaussures recommandées, TT si prolongateurs)
```

---

## Agents dispatched

| Ordre | Agent | Tâche |
|---|---|---|
| 1 (parallèle) | `dev-data` | Migration `0021_equipment.sql` |
| 1 (parallèle) | `dev-ia` | `buildEquipmentBlock()` + injection dans `buildMicroPrompt()` |
| 2 (séquentiel, attend dev-data) | `dev-backend` | Étendre `ProfileSchema` + GET/POST `/api/profile` + charger equipment dans `regenerate-week` |
| 3 (séquentiel, attend dev-backend) | `dev-frontend` | `EquipmentSection` composant + intégration page profil |
