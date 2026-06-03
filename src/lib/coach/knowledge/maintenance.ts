export const MAINTENANCE = `
# Mode Maintenance — Logique et structure

## Définition et objectifs

Le mode Maintenance s'adresse aux athlètes sans course A dans l'immédiat. Objectif : construire une base solide, corriger les déséquilibres entre disciplines, entretenir les qualités physiques sur le long terme.

Profils : post-course, débutant sans course objectif, reprise après blessure.

## Structure du programme

### Cycle de base : 4 semaines (3 charge + 1 récup)
- Semaine 1 : Charge N
- Semaine 2 : Charge N + 5-8 %
- Semaine 3 : Charge N + 10-15 %
- Semaine 4 : Décharge (−30 %)

Après chaque cycle : recalcul du programme tenant compte des données Garmin.

### Distribution d'intensité cible (maintenance) — approche pyramidale modérée
| Zone | % du volume total |
|---|---|
| Z1-Z2 (aérobie) | 75-80 % |
| Z3 (tempo/sweet spot) | 15-20 % |
| Z4-Z5 (seuil/VO2) | 5-10 % |

Le Z3 (sweet spot, tempo) est la zone la plus rentable en maintenance car il améliore la FTP et l'endurance sans la récupération longue qu'exige le Z4-Z5.

## Répartition du volume hebdomadaire

| Niveau | Natation | Vélo | Course |
|---|---|---|---|
| Tous niveaux | 25 % | 40 % | 35 % |

Le vélo reçoit plus de volume car c'est la discipline la plus longue en course et la moins traumatisante.

## Plafonds de volume selon niveau (maintenance)

| Niveau | Volume hebdo max | Recommandé |
|---|---|---|
| Débutant | 8 h | 5-7 h |
| Intermédiaire | 14 h | 9-12 h |
| Avancé | 20 h | 13-17 h |

## Adaptation dynamique hebdomadaire selon données Garmin

### Signaux de bonne récupération → maintenir la progression
- HRV dans la zone verte (≥ baseline)
- Body Battery matin > 70
- Taux de complétion = 100 %

### Signaux de fatigue modérée → remplacer la séance Z4 par Z2
- HRV légèrement sous baseline (−5 à −10 %)
- Body Battery matin 50-70
- FC repos +3-5 bpm vs normale

### Signaux de surcharge → déclencher une semaine de récup anticipée (volume −40 %)
- HRV < −10 % baseline sur 3 jours consécutifs
- Body Battery matin < 50 régulièrement
- 2+ séances sautées
- FC repos +5+ bpm vs normale
- TSB < −25

## Séances prioritaires à ne jamais supprimer

1. Long bike — pilier de l'endurance en triathlon
2. Nage technique — la natation régresse vite sans pratique régulière
3. Long run — mais jamais plus de 10 % du volume course dans une seule séance
4. 1 séance de qualité (Z3 minimum) — pour maintenir le stimulus d'adaptation

## Passage du mode Maintenance au mode Course

Proposer proactivement le switch quand :
- L'athlète a complété ≥ 8 semaines avec > 80 % de complétion
- Le niveau de forme a progressé de ≥ 5 %
- L'athlète approche d'une fenêtre de 16-24 semaines avant une saison compétitive

## Gestion des pauses et reprises

### Pause < 7 jours : reprendre au volume d'avant. Première semaine : supprimer Z4+.
### Pause 7-21 jours : reprendre à 70 % du volume. 2 semaines sans Z4+.
### Pause > 21 jours : reprendre à 50 % du dernier volume stable. 4 semaines sans Z4+.
`.trim()
