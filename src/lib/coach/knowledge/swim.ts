export const SWIM_TECHNIQUE = `
# Technique de natation — Guide pour triathlètes

La natation est la discipline où la technique a le plus d'impact. Un travail technique de 3 séances/semaine peut faire gagner 5-10 min sur 1900 m en quelques mois.

Indicateur clé SWOLF = coups de bras sur 50 m + temps en secondes. Objectifs : Débutant < 60, Intermédiaire < 50, Avancé < 42.

## Les 6 piliers techniques

### 1. Position du corps (hydrodynamisme)
Corps horizontal et aligné. Regard vers le fond (pas en avant). Bassin à la surface, fessiers légèrement contractés.
Erreurs : tête trop haute → fesses qui coulent → résistance ×2. Corps rigide → pas de rotation.
Drills : tuba frontal, push-up position drill.

### 2. Rotation du corps
45° de rotation de chaque côté à chaque cycle. Rotation vient des hanches, pas des épaules.
Débutant : 30-40°. Intermédiaire/Avancé : 45-55°.
Drills : nage 1 bras (force à ressentir la rotation), 6-kick-switch.

### 3. Prise d'eau (catch) — source principale de gains au niveau intermédiaire
Séquence : bras entre à 30-45° de l'axe → coude entre avant la main → extension maximale → coude à 90° avant-bras vertical (EVF = Early Vertical Forearm) → tirer avec main + avant-bras comme une pagaie.
Erreurs critiques : over-entry (croise la médiane), drop elbow (coude qui tombe = prise réduite de 40-60 %).
Drills : fingertip drag, catch-up drill, EVF avec palmes.

### 4. Phase de traction et poussée
Force sous le corps, pas sur les côtés. Extension complète derrière la hanche (souvent négligée = perte 20-30 % propulsion).
Drills : pull-buoy + paddles, fingertip exit drill.

### 5. Battement de jambes (rôle postural en triathlon)
- Sprint/Olympique : 2-4 temps. — 70.3/IM : 2 temps strict (économie d'énergie pour vélo + course).
Jambes tendues, pieds en extension, amplitude 30-40 cm max, origine mouvement : hanches.
Erreurs : pieds fléchis (dorsaux) → résistance. Battement excessif en 70.3/IM → crampes.
Drill : pull-buoy pour isoler les bras.

### 6. Respiration et rythme
Rotation de la tête = rotation du corps. Expiration continue sous l'eau. Inspiration courte à la rotation.
- Débutant : chaque bras (côté dominant). Intermédiaire : toutes les 3 brasses (bilatéral). IM : toutes les 2 brasses.
Erreurs : lever toute la tête → corps qui descend. Expiration en bloc → manque O2, anxiété.

## Curriculum technique par niveau

### Débutant (0-2 ans, > 1h30 sur 1500 m)
Priorités : 1) Position corps, 2) Respiration bilatérale, 3) Rotation basique, 4) Battement 2 temps.
Séances : 2 sur 2 doivent inclure éducatifs (TECH-01, TECH-02, TECH-04).

### Intermédiaire (2-5 ans, 30-60 min sur 1500 m)
Priorités : 1) Catch/EVF, 2) Extension complète, 3) Finition poussée, 4) Eau libre/sighting.
Séances : 1 sur 3 avec éducatifs ciblés (TECH-03, palmes + paddles).

### Avancé (> 5 ans, < 25 min sur 1500 m)
Priorités : 1) Optimisation catch, 2) Variabilité rythmique, 3) Spécificité eau libre, 4) Combinaison.

## Spécificités eau libre

Sighting : lever uniquement les yeux (pas la tête), 2 sightings consécutifs pour confirmer, toutes 6-10 brasses. Coût : chaque sighting = −2 % de vitesse.
Draft (aspiration) : sillage direct = +5-7 % d'énergie. À l'épaule = +3-5 %.
Combinaison : apport flottabilité → allure +5-10 %. S'entraîner 2-3 fois avec avant la course.
Eau froide (<18°C) : hyperventilation possible → expiration active forcée dès l'immersion.

## Signaux de problèmes techniques à détecter

| Signal | Problème probable |
|---|---|
| FC très élevée en nage Z2 | Position corps mauvaise |
| SWOLF qui augmente avec la fatigue | Technique fragile ou manque de force |
| Épaule douloureuse | Drop elbow, over-entry, manque de rotation |
| Vitesse qui stagne malgré volume | Catch inefficace — priorité EVF |

## Instructions pour la génération de séances nage

Quand tu génères une séance nage :
1. Préciser le drill à utiliser et pourquoi (en fonction du niveau et progression)
2. Donner 1 consigne technique prioritaire (une seule, pas cinq)
3. Calibrer la distance : séance technique jamais longue (800-1500 m débutant, 1500-2500 m intermédiaire)
4. Relier à la progression : "Cette semaine on continue le travail de prise d'eau de la semaine précédente"
`.trim()
