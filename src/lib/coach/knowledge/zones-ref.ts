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

| Zone | Nom | % T-pace | RPE | Usage |
|---|---|---|---|---|
| Z1 | Récup | > 129 % (allure plus lente) | 1-2 | Décrassage |
| Z2 | Endurance | 114-129 % | 3-4 | Long run, base |
| Z3 | Tempo / Marathon | 106-113 % | 5-6 | Allure marathon, race pace half-IM |
| Z4 | Seuil | 99-105 % | 7-8 | Intervalles seuil, tempo run |
| Z5 | VO2max | 94-98 % | 9 | 3-6 min intervalles |

Exemple : allure seuil 4:30/km → Z2 = 5:08-5:48/km, Z4 = 4:27-4:43/km.

## Natation — à partir de CSS (Critical Swim Speed)

CSS = allure soutenable 30-40 min. Calcul : CSS (m/s) = (400-200) / (T400 - T200)

| Zone | Nom | Écart CSS |
|---|---|---|
| EN1 | Aérobie | CSS + 10-15 s/100 m |
| EN2 | Aérobie soutenu | CSS + 5-10 s/100 m |
| EN3 | Seuil | CSS ± 2 s/100 m |
| SP1 | VO2 | CSS − 3 à −5 s/100 m |
| SP2 | Vitesse | CSS − 7 s/100 m et + |

## Fréquence cardiaque — modèle % FC seuil (préféré pour triathlon)

| Zone | % FC seuil |
|---|---|
| Z1 | < 81 % |
| Z2 | 81-89 % |
| Z3 | 90-94 % |
| Z4 | 95-105 % |
| Z5 | > 105 % |

Modèle Karvonen (quand FC max + FC repos connus) :
Zone FC = FC repos + (FCmax - FC repos) × %
- Z1 : 50-60 %, Z2 : 60-70 %, Z3 : 70-80 %, Z4 : 80-90 %, Z5 : 90-100 %

## Choix recommandé dans Coach Tri
- Vélo : référence FTP (watts). FC en backup si pas de capteur.
- Course : référence allure seuil. FC en backup sur routes plates.
- Nage : référence CSS uniquement (FC peu fiable en nage).

## Valeurs par défaut (si athlète sans données)

| Niveau | FTP (W/kg) | Allure seuil run | CSS (/100 m) |
|---|---|---|---|
| Débutant | 2,0-2,5 | 5:30 | 2:00 |
| Intermédiaire | 3,0-3,5 | 4:30 | 1:45 |
| Avancé | 4,0-4,5 | 3:45 | 1:30 |
| Élite | > 5,0 | < 3:30 | < 1:20 |

## Protocoles de test à intégrer au plan (tous les 6-8 semaines)

1. Test FTP 20 min : 20 min all-out après 20 min d'échauffement + 3×1 min Z5. FTP = 0.95 × Puissance moyenne 20 min.
2. Test seuil course : 30 min all-out sur piste ou route plate. Allure + FC moyenne des 20 dernières min = allure et FC seuil.
3. Test CSS : 400 m + 200 m chronos, récup 10 min entre. CSS (m/s) = (400-200)/(T400-T200).
`.trim()
