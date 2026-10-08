# Conception — Multi-courses, support trail/course à pied, et replanification en cours de programme

**Date :** 2026-10-03
**Statut :** Validé (prêt pour le plan d'implémentation)

## Contexte

Aujourd'hui l'application est mono-course et mono-sport triathlon :

- Une course (`goals`) a un `race_type` spécifique triathlon (`sprint | olympic | half | full | xterra | custom`).
- Un plan (`plans`) pointe sur **un seul** `goal_id` (nullable pour le mode `maintenance`).
- La génération se fait en deux temps : **macro** (crée les `plan_weeks` : phases, volumes, distribution) puis **micro** (crée les `sessions` par semaine). `regenerate-week` régénère les séances d'**une** semaine en préservant les séances `done`/`skipped`.
- Le coach IA (`TRIATHLON_COACH_SYSTEM` + base de connaissances modulaire `src/lib/coach/knowledge/*.ts`) est purement triathlon ; aucun module trail n'existe.

## Objectifs

1. Permettre des courses **course à pied** (route / trail / ultra) en plus du triathlon, avec les paramètres spécifiques (distance, D+, D-, technicité, altitude, barrière horaire, temps estimé).
2. Permettre de préparer **une course trail seule**, ou **plusieurs courses** (ex. trail principal + triathlon secondaire) dans **un seul plan intégré** équilibré par l'IA.
3. Permettre d'**ajouter une course en cours de programme** : tout ce qui est passé est figé, et **tout le reste du plan est recalculé** vers le nouvel ensemble d'objectifs.
4. Rendre le coach IA **expert trail / course à pied** (gestion du D+ et surtout du D-/renfo excentrique, technique de descente, spécificité ultra, etc.).

## Non-objectifs (YAGNI)

- Pas de courses mono-sport vélo (cyclosportive) ni natation (eau libre) pour l'instant — seulement triathlon et course à pied.
- Pas de modèle « multisport générique à segments ».
- Pas de limite illimitée de courses : **1 principale + jusqu'à 2 secondaires** par plan.
- Pas de nouvelle discipline de séance (`hike`) : la rando-course reste un **type de séance** de la discipline `run`.

---

## 1. Modèle de données

### 1.1 Table `goals` — généralisation

Nouvelle colonne discriminante et nouveaux champs trail (migration `0025_goal_sport_trail.sql`) :

| Colonne | Type | Sens |
|---|---|---|
| `sport` | `text` (défaut `'triathlon'`) | `'triathlon' \| 'running'` |
| `elevation_loss_m` | `int null` | dénivelé négatif (D-) |
| `surface` | `text null` | technicité : `'road' \| 'gravel' \| 'technical' \| 'mountain'` |
| `max_altitude_m` | `int null` | altitude max |
| `cutoff_time_s` | `int null` | barrière horaire (ultra) |
| `estimated_finish_time_s` | `int null` | temps estimé de l'athlète |

Réutilisation de l'existant pour `sport = 'running'` :

- `run_distance_m` → distance de la course.
- `run_elevation_m` → dénivelé positif (D+).
- `terrain` (`flat | hilly | mountainous`) → profil de la course.
- `target_time_seconds` / `run_target_time_s` → objectif chronométrique (distinct du temps **estimé**).

`race_type` devient dépendant du `sport` :

- `sport = 'triathlon'` → `race_type ∈ {sprint, olympic, half, full, xterra, custom}` (inchangé).
- `sport = 'running'` → `race_type ∈ {road, trail, ultra}`.

**Contrainte DB :** un `CHECK` valide que `race_type` est cohérent avec `sport`. Les lignes existantes (sans `sport`) prennent le défaut `'triathlon'` → rétro-compatibles.

### 1.2 `GoalSchema` (Zod) — discrimination par sport

`src/lib/schemas/goal.ts` : passer d'un objet plat à une **union discriminée** sur `sport`, ou conserver un objet plat avec `superRefine` validant la cohérence `sport`/`race_type`/champs trail. Décision : **objet plat + `superRefine`** (moins invasif pour les consommateurs existants et pour react-hook-form). Ajouter :

```
sport: z.enum(['triathlon', 'running']).default('triathlon')
race_type: // union des deux ensembles, validée par superRefine selon sport
elevation_loss_m / surface / max_altitude_m / cutoff_time_s / estimated_finish_time_s // optionnels
```

`RACE_DISTANCES` : ajouter une table `RUNNING_RACE_TYPES` (labels route/trail/ultra) ; pour le running, pas de pré-remplissage de distances standard (la distance est saisie).

### 1.3 Relation plan ↔ courses

Nouvelle table **`plan_goals`** (migration `0026_plan_goals.sql`) :

| Colonne | Type |
|---|---|
| `plan_id` | `uuid` FK `plans(id)` on delete cascade |
| `goal_id` | `uuid` FK `goals(id)` on delete cascade |
| PK | `(plan_id, goal_id)` |

- `plans.goal_id` est **conservé** et pointe sur la **course principale (A)** — rétro-compat et simplicité des requêtes existantes.
- `plan_goals` contient **toutes** les courses rattachées (principale incluse).
- Le **rôle** (principal/secondaire) est dérivé de `goals.priority` : `A` = principal (pilote la périodisation), `B`/`C` = secondaires (objectifs intermédiaires).
- Invariant applicatif : exactement une course A par plan ; 0 à 2 courses B/C.

---

## 2. Génération de plan intégrée (multi-courses)

### 2.1 Entrée

`PlanGenerationSchema` (`src/lib/schemas/plan.ts`) passe de `goal_id?` à :

```
mode: 'race' | 'maintenance'
goal_ids: string[]        // requis si mode === 'race' ; 1 à 3 ids
primary_goal_id: string   // doit être dans goal_ids ; la course A
methodology, start_date   // inchangés
```

### 2.2 Logique (`/api/plans/generate`)

- Récupérer toutes les courses de `goal_ids` (vérif. propriété utilisateur).
- **Horizon** : `end_date` = date de la course **principale (A)**. Si une course secondaire est plus lointaine que l'actuelle A, c'est un cas d'usage à signaler à l'UI (l'A devrait être la plus lointaine) — on ne bloque pas, on périodise jusqu'à l'A.
- **Disciplines** = union des sports des courses (`running` → `run` + `strength` ; `triathlon` → `swim`/`bike`/`run` + `strength`), intersectée avec `profile.available_disciplines` si défini.
- Créer le `plan`, remplir `plans.goal_id = primary_goal_id` **et** insérer toutes les lignes `plan_goals`.

### 2.3 Prompt macro

`buildMacroPrompt` : le champ `goal?` devient `goals?: GoalContext[]` avec un `GoalContext` enrichi :

```
GoalContext = {
  role: 'primary' | 'secondary'   // dérivé de priority
  sport: 'triathlon' | 'running'
  race_name, race_type, race_date
  swim_distance_m?, bike_distance_m?, run_distance_m?
  elevation_gain_m?, elevation_loss_m?, surface?, terrain?
  max_altitude_m?, cutoff_time_s?, estimated_finish_time_s?
}
```

La section `OBJECTIF(S) DE COURSE` liste la course principale (pic de forme) puis les secondaires (objectifs intermédiaires → mini-affûtage / course « tune-up »). Pour une course running, afficher D+/D-/technicité/altitude/temps estimé.

---

## 3. Replanification en cours de programme

### 3.1 Déclencheur

Depuis la page programme : « Ajouter / retirer une course » → ouvre un flux qui modifie l'ensemble `plan_goals` puis appelle le nouvel endpoint de replanification.

### 3.2 Endpoint `POST /api/plans/[id]/replan`

Corps :

```
goal_ids: string[]        // nouvel ensemble complet des courses du plan
primary_goal_id: string
effective_from_week?: number   // défaut : semaine courante (basée sur la date du jour)
```

Algorithme :

1. **Césure** : déterminer `cutoff_week` = semaine courante (ou `effective_from_week`). Les `plan_weeks` dont `week_num < cutoff_week` **et toutes leurs `sessions`** (y compris `planned`) sont **conservées intactes**.
2. **Mise à jour des courses** : remplacer `plan_goals` par `goal_ids`, mettre `plans.goal_id = primary_goal_id`.
3. **Nouvel horizon** : recalculer `end_date` = date de la course A (peut étendre le plan → nouvelles semaines, ou le raccourcir).
4. **Re-génération macro de la queue** : appeler l'IA pour (re)générer les `plan_weeks` des semaines `≥ cutoff_week` vers le nouvel ensemble d'objectifs. Le prompt reçoit en contexte les **semaines déjà réalisées** (résumé de l'historique passé, comme le fait déjà `regenerate-week` via `prior_weeks`) pour ne pas « rejouer » le passé et enchaîner la périodisation de façon cohérente. Remplacer les `plan_weeks ≥ cutoff_week` (supprimer puis réinsérer), créer les semaines supplémentaires si l'horizon s'étend.
5. **Re-génération micro** des semaines `≥ cutoff_week` : pour chaque semaine concernée, régénérer les séances comme `regenerate-week` (supprimer les `planned`, recréer ; `done`/`skipped` n'existent pas dans le futur donc rien à préserver au-delà de la césure).
6. **Journalisation** : `plan_generations` avec `trigger: 'replan'`, `scope: { from_week, goal_ids }`.

### 3.3 Réutilisation / refactor

La logique macro de `/api/plans/generate` et la logique micro de `regenerate-week/route.ts` sont aujourd'hui dans les routes. Pour éviter la duplication, **extraire** :

- `src/lib/plan/generate-macro.ts` — construit le contexte + appelle Gemini + normalise/insère les `plan_weeks` (paramétrable par plage de semaines et contexte historique).
- `src/lib/plan/generate-micro.ts` — logique actuelle de `regenerate-week` (contexte semaine + Gemini + normalisation + insert `sessions`), extraite en fonction réutilisable.

`/api/plans/generate`, `regenerate-week` et `replan` deviennent de fines couches HTTP au-dessus de ces modules. Ce refactor est **inclus dans le périmètre** car il est nécessaire pour que `replan` reste maintenable.

---

## 4. UI

### 4.1 Création / édition de course

Formulaire de course (dans `ProgramForm` et/ou onboarding) :

1. **Sélecteur de sport** en premier (`triathlon` / `course à pied`).
2. Les `race_type` proposés et les champs affichés **dépendent du sport** :
   - Triathlon → distances nat/vélo/course + temps par discipline (inchangé).
   - Course à pied → `race_type` (route/trail/ultra), distance, D+, D-, technicité (`surface`), profil (`terrain`), altitude max, barrière horaire, temps estimé, objectif chrono.
3. Les champs trail n'apparaissent **que** pour `course à pied` (et altitude/cut-off surtout mis en avant pour `ultra`).

### 4.2 Rattachement multi-courses à un programme

- `ProgramForm` permet de sélectionner **1 course principale (A)** + **jusqu'à 2 secondaires**, parmi les courses actives (et d'en créer une à la volée).
- `program/new/page.tsx` charge déjà les `goals` actifs → adapter le passage au formulaire.

### 4.3 Ajout de course en cours de programme

- Sur la page du programme actif : bouton « Ajouter une course ». Après ajout, confirmation explicite : « Le reste du programme va être recalculé à partir de cette semaine. » → appelle `/api/plans/[id]/replan`.

---

## 5. Coach IA — expertise trail / course à pied

### 5.1 Base de connaissances

Nouveau module **`src/lib/coach/knowledge/trail.ts`** exportant `KNOWLEDGE_BASE_TRAIL`, couvrant :

- Spécificité du **D+** (travail en côte, puissance ascensionnelle, allure verticale/randonnée-course).
- Spécificité du **D-** : renforcement **excentrique**, préparation musculaire à la descente, technique de descente, prévention des dégâts musculaires.
- Gestion du **dénivelé cumulé hebdomadaire** comme charge à part entière.
- Spécificité **ultra** : gestion barrières horaires, nutrition/hydratation longue durée, marche active, gestion du sommeil/nuit.
- Surface/technicité : adaptation du travail de pied, proprioception, chaussures (lien avec l'`equipment.run.shoes.surface` existant).

Mettre à jour `src/lib/coach/knowledge/index.ts` pour exposer le nouveau bloc, et prévoir son injection **conditionnelle** (seulement si une course `running` est présente) afin de ne pas gonfler inutilement les prompts triathlon.

### 5.2 System prompt sport-aware

- Renommer/élargir `TRIATHLON_COACH_SYSTEM` en coach « triathlon **et** course à pied / trail » (ou garder le nom, élargir le contenu). Le coach se présente comme expert des deux domaines.
- Ajouter des **types de séance course à pied** dans l'énoncé des types par discipline : côtes, descente technique, sortie longue avec D+, rando-course, allure spécifique trail. Ces types restent portés par la discipline `run` et mappés vers les `session_type` existants (`easy/tempo/threshold/vo2/race_pace/technique/long/recovery/test`) — on n'ajoute pas de nouveaux `session_type` DB, on les décrit via `title` + `structure` + `coaching_note`.

### 5.3 Équilibre disciplinaire

- `buildMacroPrompt` adapte l'équilibre : pour une course à pied seule, plan centré `run` + `strength` (renfo excentrique mis en avant si D- important), avec vélo/natation éventuels seulement en cross-training si `available_disciplines` le permet.
- Pour un plan intégré trail + tri, les trois disciplines sont réparties en tenant compte des deux objectifs et de leurs dates.

---

## 6. Impact sur l'existant / rétro-compatibilité

- Les courses et plans existants prennent `sport = 'triathlon'` par défaut → aucun changement de comportement.
- `plans.goal_id` conservé ; `plan_goals` rempli pour les nouveaux plans. (Optionnel : backfill `plan_goals` depuis `plans.goal_id` existants dans la migration.)
- Le mode `maintenance` (sans course) reste inchangé.

## 7. Tests

- **Schémas** (`goal.ts`) : `superRefine` accepte triathlon/running valides, rejette combinaisons incohérentes (`sport=running` + `race_type=olympic`, champs trail sur un triathlon, etc.).
- **`generate-macro` / `generate-micro`** extraits : tests unitaires sur la construction du contexte (plage de semaines, union des disciplines, contexte historique à la césure).
- **`replan`** : la logique de césure préserve les semaines `< cutoff`, régénère `≥ cutoff`, étend/raccourcit l'horizon correctement (tests sur la logique pure, Gemini mocké).
- Suivre les conventions de test existantes (Vitest, fichiers `*.test.ts` à côté des modules).

## 8. Découpage d'implémentation (indicatif)

1. Migrations `0025` (goals) + `0026` (plan_goals) + régénération des types DB.
2. `GoalSchema` + tests.
3. Refactor extraction `generate-macro` / `generate-micro` (sans changement fonctionnel, couvert par tests).
4. Génération multi-courses (`plan.ts` schema, `/api/plans/generate`, `buildMacroPrompt`).
5. Endpoint `replan` + logique de césure.
6. Module de connaissances `trail.ts` + system prompt sport-aware + types de séance course.
7. UI : formulaire sport-aware, rattachement multi-courses, ajout en cours de programme.
