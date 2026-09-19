# Performances de référence dans le profil — Design

**Date :** 2026-09-19
**Statut :** Validé, prêt pour plan d'implémentation

## Contexte & problème

Le profil possède une section « Données physiologiques » où l'athlète saisit
manuellement des valeurs de seuil (VMA, allure au seuil, FTP, CSS, FC seuil par
discipline). Ces valeurs sont abstraites et peu intuitives à renseigner.

De plus, ces données ne sont **pas envoyées au prompt macro** (génération de la
structure du plan) — elles ne servent qu'au calcul des zones dans le prompt
micro. L'IA ne connaît donc pas le niveau réel de vitesse de l'athlète au moment
de dimensionner le programme.

## Objectif

Permettre à l'athlète de saisir ses **performances de référence** (records) telles
qu'il les pense naturellement (temps sur 5 km, temps sur 400 m nage, FTP…), et
que l'IA se base dessus. Les seuils d'entraînement sont **dérivés
automatiquement** à partir de ces records.

## Modèle de saisie (source de vérité)

| Discipline | Saisi par l'athlète | Dérivé automatiquement (stocké) |
|---|---|---|
| Course | Temps **5 km / 10 km / semi** (au moins 1) | allure au seuil → puis VMA (dérivée par `zones.ts`) |
| Vélo | **FTP** (watts) | — |
| Natation | Temps **100 / 200 / 400 / 800 m** (au moins 1) | **CSS** |
| Cardio | **FC max** (globale) + **FC repos** | — |

Les saisies manuelles VMA / allure seuil / CSS / FC seuil par discipline sont
**retirées de l'UI**.

## Méthode de dérivation — modèle de Vitesse Critique (CV)

Régression linéaire du modèle distance-temps : `distance = CV · temps + D′`,
où `CV` (m/s) est la vitesse critique ≈ vitesse au seuil.

- **Course**
  - ≥ 2 records : régression linéaire sur les couples `(temps_s, distance_m)` →
    pente = `CV` → `run_threshold_pace_sec_per_km = 1000 / CV`.
  - 1 seul record : extrapolation de Riegel `t₂ = t₁ · (d₂/d₁)^1.06` pour prédire
    le temps sur une distance d'ancrage seuil, puis conversion en allure.
- **Natation** — c'est exactement le protocole CSS :
  - régression linéaire sur les records nage fournis (100/200/400/800) →
    `CV` → `css_pace_sec_per_100m = 100 / CV`.
  - 1 seul record : Riegel comme pour la course.
- La **VMA** dérivée est laissée à `zones.ts`, qui la calcule déjà depuis
  l'allure au seuil (`vma = 3600 / (threshPace × 0.9)`).
- Les valeurs dérivées (`run_threshold_pace_sec_per_km`, `css_pace_sec_per_100m`,
  et optionnellement `vma_kmh`) sont **stockées dans les colonnes physiology
  existantes** au moment de la sauvegarde → `zones.ts` reste inchangé côté calcul.

La logique de dérivation vit dans un nouveau module `src/lib/utils/performance.ts`,
développé en **TDD** (tests unitaires sur les formules CV / Riegel, cas 1 record
vs plusieurs, cohérence des unités).

## Base de données

Migration `0024_performance_records.sql` :

- Ajout de colonnes sur `public.physiology` (toutes `int`, `nullable`) :
  - `run_5k_time_s`, `run_10k_time_s`, `run_half_time_s`
  - `swim_100m_time_s`, `swim_200m_time_s`, `swim_400m_time_s`, `swim_800m_time_s`
- `hr_max` devient la **FC max globale**.
- Les colonnes `hr_max_run`, `hr_threshold_run`, `hr_threshold_bike` sont
  **conservées** (nullable) mais **non exposées** dans l'UI — pas de migration
  destructive, les données existantes restent lisibles.
- Régénérer les types : `npm run db:types` après la migration.

## Zones (`src/lib/utils/zones.ts`)

Ajustement minimal : le calcul des zones FC en course utilise
`p.hr_max_run ?? p.hr_max` afin de fonctionner avec la FC max globale. Le reste
du fichier est inchangé (il dérive déjà VMA depuis l'allure seuil, et FTP/CSS
alimentent les zones vélo/nage).

## API (`/api/physiology`)

- `PhysiologySchema` (Zod) accepte les nouveaux champs records + `ftp_watts`,
  `hr_max`, `resting_hr`. Les champs seuils manuels retirés de l'UI ne sont plus
  attendus dans le body.
- Le `POST` :
  1. valide le body (Zod),
  2. calcule les valeurs dérivées via `performance.ts`
     (`run_threshold_pace_sec_per_km`, `css_pace_sec_per_100m`, `vma_kmh`),
  3. insère records **et** dérivés dans une nouvelle ligne `physiology`
     (le modèle append-only + vue `physiology_current` est conservé).
- Validation des bornes (temps plausibles) dans le schéma Zod.

## IA (`src/lib/gemini/prompts.ts`)

- **Prompt macro** — ajout d'un bloc `PERFORMANCES DE RÉFÉRENCE` dans
  `MacroContext` / `buildMacroPrompt` : records bruts (temps course + nage), FTP,
  FC max / repos. C'est la première fois que le macro reçoit ces données.
- **Prompt micro** — inchangé : il continue de recevoir `athlete_zones`
  (désormais calculées à partir des seuils dérivés des records).

## UI (`src/components/profile/PhysiologySection.tsx`)

- Réorganisation des blocs Course / Vélo / Natation / Cardio :
  - Course : inputs temps `5 km`, `10 km`, `semi` (format `mm:ss` ou `h:mm:ss`).
  - Vélo : input `FTP` (watts).
  - Natation : inputs temps `100 / 200 / 400 / 800 m` (`mm:ss`).
  - Cardio : `FC max`, `FC repos`.
- Mode lecture : affiche les records saisis **et** les seuils dérivés (allure
  seuil, VMA, CSS) avec une mention « estimé ».
- Les `TestHint` (« Comment mesurer ? ») sont adaptés : on explique comment faire
  un record propre plutôt que comment calculer un seuil.
- Helpers de conversion temps ↔ secondes étendus pour gérer le format
  `h:mm:ss` (semi) en plus de `mm:ss`.

## Hors périmètre (YAGNI)

- Pas d'import automatique des PR depuis Garmin (`garmin_stats.personal_records`)
  dans cette itération.
- Pas de puissance vélo sur durées (5 min / 20 min) : la FTP saisie suffit pour
  les zones vélo. À reconsidérer plus tard si besoin.
- Pas de suppression physique des colonnes FC par discipline (dette assumée,
  non destructive).

## Critères de réussite

1. L'athlète saisit ses records et voit ses seuils estimés s'afficher.
2. Le calcul de zones (course/vélo/nage) fonctionne à partir des records.
3. Le prompt macro contient les performances de référence.
4. `npm run typecheck && npm run lint && npm test && npm run format:check` passent.
5. Les formules de dérivation sont couvertes par des tests unitaires.
