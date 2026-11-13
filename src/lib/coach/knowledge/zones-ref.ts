export const ZONES_REF = `
# Zones d'entraînement — référence détaillée

## Vélo — zones Coggan (% FTP)

| Zone | Nom | % FTP | RPE | Usage |
|---|---|---|---|---|
| Z1 | Active Recovery | < 55 | 1-2 | Récup, décrassage |
| Z2 | Endurance | 56-75 | 2-4 | Base aérobie, Long |
| Z3 | Tempo | 76-90 | 4-5 | Seuil bas, Sweet spot (88-94 %) |
| Z4 | Seuil lactique | 91-105 | 6-7 | Séances de seuil, CLM |
| Z5 | VO2max | 106-120 | 7-9 | Intervalles courts |
| Z6 | Anaérobie | 121-150 | 9-10 | Capacité anaérobie |

Sweet Spot : 88-94 % FTP — zone reine pour l'endurance demi-fond et longue distance.

## Course — % allure seuil (Threshold Pace = T-pace)

Allure seuil = allure tenable environ 1 h (≈ 87 % de la VMA chez l'amateur).

| Zone | Nom | % T-pace | RPE | Usage |
|---|---|---|---|---|
| Z1 | Récup | > 129 % (plus lent) | 1-2 | Décrassage |
| Z2 | Endurance | 114-129 % | 3-4 | Long run, base |
| Z3 | Tempo / Marathon | 106-113 % | 5-6 | Allure marathon, race pace half-IM |
| Z4 | Seuil | 99-105 % | 7-8 | Intervalles seuil, tempo run |
| Z5 | VO2max | < 99 % (plus rapide) | 9 | 3-6 min intervalles |

Exemple : allure seuil 4:30/km → Z2 = 5:08-5:48/km, Z4 = 4:27-4:46/km.
En trail et en côte, l'allure n'a pas de sens : FC et RPE uniquement.

## Natation — à partir de CSS (Critical Swim Speed)

CSS = allure soutenable 30-40 min. Calcul : CSS (m/s) = (400-200) / (T400 - T200)

| Zone | Nom | Écart CSS (/100 m) |
|---|---|---|
| Z1 | Récup | plus lent que CSS + 15 s |
| Z2 (EN1) | Endurance | CSS + 8 à + 15 s |
| Z3 (EN2) | Tempo | CSS + 3 à + 8 s |
| Z4 (EN3) | Seuil CSS | CSS − 2 à + 3 s |
| Z5 (SP) | VO2 / vitesse | plus rapide que CSS − 2 s |

En eau libre, compter 3-8 s/100 m plus lent qu'en piscine (orientation, houle, pas de virages).

## Fréquence cardiaque — modèle % FC seuil (Friel, préféré pour triathlon)

FC seuil (LTHR) = FC moyenne des 20 dernières minutes d'un test de 30 min à fond.
Sans test : LTHR ≈ 90 % de la FC max. La FC seuil vélo est souvent 5-10 bpm sous celle de course.

| Zone | Course (% LTHR) | Vélo (% LTHR) |
|---|---|---|
| Z1 | < 85 % | < 81 % |
| Z2 | 85-89 % | 81-89 % |
| Z3 | 90-94 % | 90-93 % |
| Z4 | 95-99 % | 94-99 % |
| Z5 | ≥ 100 % | ≥ 100 % |

Modèle Karvonen (quand FC max + FC repos connus) :
Zone FC = FC repos + (FCmax - FC repos) × %
- Z1 : 50-60 %, Z2 : 60-70 %, Z3 : 70-80 %, Z4 : 80-90 %, Z5 : 90-100 %

## Intensité vélo en course (IF = % FTP), amateurs : bas de fourchette
- Sprint : 0,88-0,95 | Olympique : 0,83-0,90 | Half (70.3) : 0,75-0,82 | Ironman : 0,68-0,76

## Choix recommandé dans Coach Tri
- Vélo : référence FTP (watts). FC en backup si pas de capteur.
- Course : référence allure seuil. FC en backup sur routes plates.
- Nage : référence CSS uniquement (FC peu fiable en nage).

## Athlète sans données
Ne jamais inventer d'allure, de watts ou de FC chiffrés : prescrire au ressenti (RPE) et au test de la parole
(Z2 = phrases complètes possibles, Z3 = phrases courtes, Z4 = quelques mots, Z5 = impossible de parler),
et placer un test (ci-dessous) dans les 2 premières semaines pour calibrer les zones.

## Protocoles de test à intégrer au plan (tous les 6-8 semaines)

1. Test FTP 20 min : 20 min all-out après 20 min d'échauffement + 3×1 min Z5. FTP = 0.95 × Puissance moyenne 20 min.
2. Test seuil course : 30 min all-out sur piste ou route plate. Allure + FC moyenne des 20 dernières min = allure et FC seuil.
3. Test CSS : 400 m + 200 m chronos, récup 10 min entre. CSS (m/s) = (400-200)/(T400-T200).
`.trim()
