# Design — Liste d'activités unifiée (Garmin + Strava, dédoublonnée)

**Date** : 2026-06-15
**Statut** : validé, prêt pour plan d'implémentation
**Périmètre** : page `/activities` uniquement

## Problème

`src/app/(app)/activities/page.tsx` ne lit que `garmin_activities`. Depuis l'ajout
de la synchronisation Strava, les activités Strava sont en base
(`strava_activities`) mais invisibles dans l'UI. Afficher naïvement les deux
sources créerait des doublons : une même séance est poussée par la montre vers
Garmin **et** vers Strava.

État des données (2026-06-15) :
- Garmin : 107 activités (dont 2 manuelles, `garmin_activity_id < 0`), historique
  depuis ~6,5 mois. Champ exclusif utile : `aerobic_te` (Training Effect).
- Strava : 10 activités, ~1 mois (le sync ne remonte que 30 jours). Champs
  exclusifs utiles : `avg_watts` (puissance), `suffer_score`.

## Objectif

Afficher dans `/activities` une liste **unifiée et dédoublonnée** : l'historique
complet (porté par Garmin), enrichi des données exclusives de Strava
(puissance, suffer score) quand une séance existe dans les deux sources, sans
jamais afficher de doublon.

## Approche retenue : fusion à la lecture

Pas de nouvelle table ni de modification de la logique de synchronisation. La
fusion se fait dans le Server Component `/activities` au moment du rendu. Les
deux syncs (Garmin, Strava) restent indépendants et inchangés (hors le petit
ajustement d'horodatage Strava ci-dessous).

### Flux de données

1. Récupérer les activités récentes des deux tables pour l'utilisateur :
   - `garmin_activities` (déjà fait : 50 dernières, tri `started_at` desc)
   - `strava_activities` (nouveau : mêmes critères)
2. Normaliser chaque ligne vers une forme commune `UnifiedActivity`.
3. Dédoublonner (voir règle ci-dessous) : fusionner les paires
   Garmin↔Strava représentant la même séance.
4. Trier par `started_at` desc, regrouper par jour (logique existante), rendre.

### Forme commune `UnifiedActivity`

Superset des champs déjà affichés, plus les champs Strava et les drapeaux de
source :

```ts
type UnifiedActivity = {
  id: string;                 // id de la ligne source de base (Garmin si dispo, sinon Strava)
  activity_type: string;      // discipline normalisée (run/bike/swim/strength/triathlon/other)
  name: string | null;
  started_at: string;         // UTC
  duration_s: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_speed_ms: number | null;
  elevation_gain_m: number | null;
  aerobic_te: number | null;  // Garmin uniquement
  avg_watts: number | null;   // Strava uniquement
  suffer_score: number | null;// Strava uniquement
  is_manual: boolean;         // Garmin id < 0
  sources: ('garmin' | 'strava')[]; // 1 ou 2 sources
};
```

### Règle de dédoublonnage

Deux activités (une Garmin, une Strava) sont considérées comme la **même séance**
si **toutes** ces conditions sont vraies :

1. **Même discipline normalisée**, et cette discipline ∈ `{run, bike, swim}`.
   (On ne dédoublonne pas `strength`/`triathlon`/`other` : Strava normalise tout
   le reste en `other`, le risque de faux positif est trop élevé. Ces activités
   restent affichées telles quelles depuis leur source.)
2. **Heures de début proches** : |garmin.started_at − strava.started_at| ≤ 10 min.
3. **Durées proches** : garde-fou, écart ≤ 25 % (évite d'apparier deux séances du
   même sport rapprochées dans la journée).

Appariement : pour chaque activité Garmin éligible, on cherche l'activité Strava
non encore appariée qui minimise l'écart d'heure dans la fenêtre. Appariement
1-pour-1 (une Strava ne peut servir qu'une fois).

> **Prérequis horodatage.** Garmin stocke `started_at` en UTC, mais le sync
> Strava stocke aujourd'hui `start_date_local` (heure locale) → décalage qui
> casserait la règle d'heure. **Correction** : modifier `toRecord()` dans
> `src/lib/strava/client.ts` pour stocker `raw.start_date` (UTC) au lieu de
> `raw.start_date_local`. L'affichage reste correct car le formatage se fait en
> heure locale côté client (`toLocaleTimeString`/`toLocaleDateString`). Il faut
> aussi exposer `start_date` dans `StravaRawActivity`. Les 10 lignes Strava
> existantes seront corrigées au prochain sync (upsert sur
> `user_id,strava_activity_id`).

### Combinaison sur un doublon

- **Base = Garmin** (plus riche + historique). On part de la ligne Garmin.
- **Enrichissement Strava** : on ajoute `avg_watts` et `suffer_score` depuis la
  ligne Strava appariée. On ne remplace **aucun** champ Garmin.
- `sources = ['garmin', 'strava']`.
- Activité présente dans une seule source → `sources` à un élément, affichée
  telle quelle. Les activités manuelles (Garmin `id < 0`) ne sont jamais
  appariées (elles n'ont pas de jumelle Strava).

## Changements UI (`activities/page.tsx`)

1. **Badge de source** par carte : petite puce indiquant `Garmin`, `Strava`, ou
   les deux. Cohérent avec le style des badges existants (`TEBadge`,
   `ManualBadge` : `text-[10px] uppercase tracking-widest`, bordure fine).
2. **Stat « Puissance »** : nouveau `StatPill` affiché quand `avg_watts` est
   présent (valeur en `W`). S'insère dans la rangée de stats existante.
3. **Suffer score** : optionnel, non affiché en v1 (YAGNI — on le stocke dans
   `UnifiedActivity` pour usage futur mais on ne l'affiche pas, sauf si trivial).
4. **État vide** : remplacer « Connectez votre compte Garmin… » par un texte
   mentionnant Garmin **ou** Strava.
5. **Type `Activity`** : étendu en `UnifiedActivity` (ci-dessus).

## Découpage / unités

- `src/lib/activities/unify.ts` (nouveau) : fonctions pures, testables sans I/O.
  - `normalizeGarmin(row) → UnifiedActivity`
  - `normalizeStrava(row) → UnifiedActivity`
  - `mergeActivities(garmin: UnifiedActivity[], strava: UnifiedActivity[]) → UnifiedActivity[]`
    (dédoublonnage + enrichissement + tri).
- `activities/page.tsx` : se contente de fetch les deux tables et d'appeler
  `mergeActivities`, puis rend (groupement par jour inchangé).
- `src/lib/strava/client.ts` : `toRecord` utilise `start_date` (UTC).

Ce découpage isole toute la logique de fusion dans un module pur → tests unitaires
faciles, page mince.

## Tests (TDD sur `unify.ts`)

Cas couverts par les tests unitaires de `mergeActivities` :
- Doublon run Garmin+Strava à 2 min d'écart → 1 carte, base Garmin, watts Strava,
  `sources=['garmin','strava']`.
- Même sport, 3 h d'écart → 2 cartes distinctes (hors fenêtre).
- Même heure mais disciplines différentes → 2 cartes.
- Durées trop différentes (>25 %) → 2 cartes.
- Activité Strava sans équivalent Garmin → 1 carte Strava.
- Activité manuelle Garmin → jamais appariée.
- Disciplines hors {run,bike,swim} (strength/other) → jamais appariées.
- Tri final par `started_at` desc.

## Hors périmètre (YAGNI)

- Pas de filtre/onglet par source.
- Pas de table de fusion persistée.
- Pas de backfill de l'historique Strava au-delà de 30 jours.
- Pas de modification du dashboard ni de la page profil (Garmin y reste pour la
  physiologie / le bien-être).
- Coach IA ↔ Strava : déjà implémenté (chat + régénération de semaine), hors
  sujet ici.
