export const SESSIONS_LIB = `
# Bibliothèque de séances types — codes de référence

Séances codifiées, paramétrées en zones. Utiliser ces codes dans template_code.
Durées entre [X-Y min] = plage selon niveau/phase. RPE = 1-10.

## NATATION
TECH-01 — Technique fondamentale : 200 m Z1 + 6×50 m éducatifs (rattrapé, poing fermé) r 15 s + 4×100 m Z2 + 100 m Z1 | RPE 2-3 | Phase Prep, Base 1
TECH-02 — Rotation et équilibre : 200 m Z1 + 4×50 m catch-up r 15 s + 4×50 m nage 1 bras + 4×100 m Z2 + 100 m Z1 | RPE 2-3 | Base 1-2
TECH-03 — Prise d'eau (EVF) : 200 m Z1 + 6×25 m EVF R 20 s + 4×50 m palmes + 4×100 m Z2 + 100 m Z1 | RPE 2-3 | Base 1-2
TECH-04 — Respiration bilatérale : 200 m Z1 + 6×50 m respiration imposée r 15 s + 4×100 m Z2 bilatérale 3 temps | RPE 2-3 | Base 1-2
END-01 — Endurance aérobie courte : 300 m Z1 + 4×400 m EN1 (CSS+10s) r 20 s + 200 m Z1 | 2 100 m | RPE 3-4 | Base 1-2
END-02 — Endurance aérobie longue : 400 m Z1 + 6×500 m EN1-EN2 r 30 s + 200 m Z1 | 3 600 m | RPE 4-5 | Base 2-3
CSS-01 — Seuil CSS classique : 400 m Z1 + 8×100 m à CSS r 10 s + 200 m Z1 | RPE 6-7 | Build 1
CSS-02 — Seuil CSS 200 m : 400 m Z1 + 5×200 m à CSS r 20 s + 200 m Z1 | RPE 7 | Build 1-2
CSS-03 — Seuil long : 400 m Z1 + 2×400 m CSS r 45 s + 4×200 m CSS+2 r 20 s + 200 m Z1 | RPE 7 | Build 2
INT-01 — VO2max courts : 400 m Z1 + 10×50 m SP1 (CSS-4s) r 20 s + 200 m Z1 | RPE 8 | Build 2, Peak
INT-02 — VO2max longs : 400 m Z1 + 6×100 m SP1 r 30 s + 200 m Z1 | RPE 8-9 | Build 2, Peak
OW-01 — Eau libre orientation : 15 min navigation + 3×8 min Z3 avec sighting toutes 6 brasses + 5 min Z1 | RPE 5-6 | Peak
OW-02 — Départ en masse : 3×200 m départ Z4-Z5 sur 50 m puis Z3 | RPE 7 | Peak
RP-01 — Race pace natation : 400 m Z1 + 1×[distance objectif] à allure course + 200 m Z1 | RPE 7 | Peak

## VÉLO
END-02 — Endurance Z2 base : 15 min Z1 + [60-120 min] Z2 + 15 min Z1 | RPE 3-4 | Base, Build
LG-01 — Long bike court : 20 min Z1 + [90-150 min] Z2 (option 20 min Z3 milieu) + 15 min Z1 | RPE 4 | Base fin, Build
LG-02 — Long bike long > 3 h : 20 min Z1 + [180-360 min] Z2 (option 2×20 min Z3) + 20 min Z1 | RPE 4-5 | Build, Peak 70.3/IM | Nutrition obligatoire : 60-90 g CHO/h
SS-01 — Sweet spot court : 20 min Z2 + 3×12 min SS (88-93 % FTP) r 5 min + 10 min Z1 | RPE 6 | Base 3, Build 1
SS-02 — Sweet spot long : 20 min Z2 + 2×25 min SS r 8 min + 10 min Z1 | RPE 6-7 | Build 1
FTP-01 — Seuil long 2×20 : 20 min Z2 + 2×20 min Z4 r 10 min + 10 min Z1 | RPE 7-8 | Build 1
FTP-02 — Seuil fractionné 5×8 : 20 min Z2 + 5×8 min Z4 (100-105 %) r 4 min + 10 min Z1 | RPE 7-8 | Build 1-2
FTP-03 — Under/Over : 20 min Z2 + 4×(6 min : 3 min 95% / 3 min 105%) r 5 min + 10 min Z1 | RPE 8 | Build 2
VO2-01 — VO2max classique 5×4 : 20 min Z2 + 5×4 min Z5 (110-120 % FTP) r 4 min + 10 min Z1 | RPE 8-9 | Build 2, Peak Sprint/Olympique
VO2-02 — VO2max longs 3×6 : 20 min Z2 + 3×6 min Z5 r 6 min + 10 min Z1 | RPE 9 | Build 2
FORCE-01 — Force vélo montées : 20 min Z1 + 4×8 min montée à 50-60 RPM en Z3-bas r 5 min + 10 min Z1 | RPE 6-7 | Base 2-3
RP-02 — Race pace 70.3 : 20 min Z2 + 2×45 min IF 0,82-0,85 r 10 min + 20 min Z1 | RPE 7 | Peak 70.3
RP-03 — Race pace Ironman : 30 min Z2 + 2-3 h IF 0,70-0,75 + 30 min Z2 | RPE 5-6 | Peak IM
CADENCE-01 — Travail cadence haute : 15 min Z1 + 5×4 min 100-110 RPM Z2 r 3 min + 15 min Z1 | RPE 3-4 | Base, Prep
REC-01 — Récupération active : 30-45 min Z1 continu, cadence 90+ RPM | RPE 1-2 | Toutes

## COURSE À PIED
END-03 — Footing Z2 court : 5 min marche/trot + [25-45 min] Z2 + 5 min Z1 | RPE 3-4 | Toutes
LG-02 — Long run progressif : 10 min Z1 + [50-150 min] Z2 (derniers 20 min option Z3) + 5 min marche | RPE 4-5 | Base, Build
STRIDES-01 — Strides : 20 min Z2 + 6×20 s accélération progressive jusqu'à Z5 r 60 s + 10 min Z1 | RPE 5/pics 8 | Base fin, Build
TEMPO-01 — Tempo run continu : 15 min Z1-Z2 + [20-35 min] Z3 + 10 min Z1 | RPE 6 | Build 1
SEUIL-01 — Seuil fractionné 2×15 : 15 min Z1-Z2 + 2×15 min Z4 r 3 min marche + 10 min Z1 | RPE 7-8 | Build 1
SEUIL-02 — Cruise intervals 1000 m : 15 min Z1-Z2 + 5-6×1000 m Z4 r 60 s + 10 min Z1 | RPE 7 | Build 1-2
SEUIL-03 — Ladder seuil : 15 min Z1-Z2 + 400-600-800-1000-800-600-400 m Z4 r 90 s + 10 min Z1 | RPE 7 | Build 2
VO2-03 — VO2max 5×3 min : 15 min Z1-Z2 + 5×3 min Z5 r 3 min trot Z1 + 10 min Z1 | RPE 9 | Build 2, Peak Sprint/Olympique
VO2-04 — 400 m Daniels I : 15 min Z1-Z2 + 8-10×400 m Z5 r 200 m trot + 10 min Z1 | RPE 9 | Build 2
VO2-05 — 1000 m VO2 : 15 min Z1-Z2 + 4-5×1000 m Z5 r 3 min trot + 10 min Z1 | RPE 8-9 | Build 2
HILL-01 — Côtes courtes : 15 min Z1-Z2 + 8-10×60 s côte forte (8-10 %) Z5 r redescente + 10 min Z1 | RPE 8-9 | Base 3, Build 1
RP-04 — Race pace half/olympique run : 15 min Z2 + [20-45 min] RP run + 10 min Z1 | RPE 7 | Peak
RP-05 — Race pace Ironman run : 15 min Z2 + 30 min RP + 15 min Z3 + 10 min Z1 | RPE 6-7 | Peak IM
PROG-01 — Run progressif : 10 min Z1 + 15 min Z2 + 15 min Z3 + 10 min Z4 + 5 min Z1 | RPE 4→8 | Build 2

## BRICK
BRICK-01 — Brick court : Vélo [45-75 min] Z2 + transition + run 10-20 min Z2-Z3 | RPE 5-6 | Build 1
BRICK-02 — Brick seuil : Vélo 90 min dont 2×20 min Z4 + transition + run 20 min Z3-Z4 | RPE 7-8 | Build 2
BRICK-03 — Brick race pace 70.3 : Vélo 3 h dont 2×45 min IF 0,83 + transition + run 45 min RP 70.3 | RPE 7 | Peak 70.3
BRICK-04 — Brick race pace IM : Vélo [4-5 h] IF 0,72 + transition + run 1 h Z2-Z3 | RPE 5-6 | Peak IM
BRICK-05 — Brick léger récup : Vélo 40 min Z1-Z2 + run 10-15 min Z1 | RPE 2-3 | Semaines de récup

## RENFORCEMENT
STR-01 — Force lower body : Squat gobelet 3×12 + Fentes inversées 3×10/jambe + Hip thrust 3×15 + Gainage 3×45 s | 40-50 min | RPE 6 | Prep, Base 1-2
STR-02 — Gainage et stabilité : Planche frontale 3×45 s + Planche latérale 3×30 s + Dead bug 3×10 + Bird-dog 3×10 | 20-30 min | Toutes
STR-03 — Mobilité et étirements actifs : Hip flexor + Pigeon + Foam roller + Épaules | 20-25 min | RPE 1 | Toutes

## TESTS
TEST-FTP-20 : 20 min Z1 + 3×1 min all-out r 1 min + 5 min Z1 + 20 min all-out | FTP = 0,95 × puissance 20 min
TEST-RUN-30 : 15 min Z1-Z2 + 30 min all-out | Seuil = allure + FC moy. 20 dernières min
TEST-CSS : 200 m Z1 + 400 m all-out + récup 10 min + 200 m all-out | CSS (m/s) = (400-200)/(T400-T200)

Chaque séance référence son code dans template_code. Le moteur sélectionne selon phase + discipline + microcycle.
`.trim()
