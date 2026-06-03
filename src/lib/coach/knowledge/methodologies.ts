export const METHODOLOGIES = `
# Méthodologies d'entraînement de triathlon

## Les grandes écoles

### Joe Friel — The Triathlete's Training Bible
Méthode périodisée classique (linéaire) autour de 6 phases :
1. Prep (2 sem.) — reprise, mobilité
2. Base 1-2-3 (12 sem.) — aérobie fondamentale + force de base
3. Build 1-2 (8 sem.) — spécifique course, intensités au seuil / VO2max
4. Peak (2 sem.) — volume ↓, intensité spécifique ↑, simulations de course
5. Race (1 sem.) — taper
6. Transition (1-4 sem.) — repos actif

### Jack Daniels — Running Formula (appliqué au run)
Intensités exprimées en % VO2max :
- E (Easy) : 59-74 % VO2max — base aérobie
- M (Marathon) : 75-84 %
- T (Threshold) : 86-88 % — seuil lactique
- I (Interval) : 95-100 % — VO2max
- R (Repetition) : > 100 % — économie / vitesse
Règle VDOT : un unique score qui prédit toutes les allures à partir d'une perf réelle.

### Stephen Seiler — Entraînement polarisé 80/20
- ≥ 80 % du volume total en zone basse (Z1-Z2, sous seuil ventilatoire 1)
- ≤ 20 % en zone haute (Z4-Z5, au-dessus seuil ventilatoire 2)
- Très peu en zone moyenne Z3 (zone "grise" / tempo)
Applique particulièrement bien à l'endurance pure (triathlon long, marathon).

### Matt Fitzgerald — 80/20 Triathlon
Distribution cible : ≈ 80 % Z1 / ≈ 20 % Z3, quasi-zéro Z2 "utile" volontairement.

## Concepts transversaux

### Progression de charge
- +10 % max /semaine sur 3 semaines → 1 semaine de récup (−30 %)
- ou 2 sem. charge / 1 sem. récup pour débutants

### TSS (Training Stress Score)
- 100 TSS = 1 h à FTP (vélo)
- CTL = moyenne exponentielle 42 j, ATL = 7 j, TSB = CTL − ATL (forme)

### Distribution d'intensité recommandée
| Méthodologie | Z1-Z2 | Z3 | Z4-Z5 |
|---|---|---|---|
| Polarisé (Seiler) | 80 % | 0-5 % | 15-20 % |
| Pyramidal | 70 % | 20 % | 10 % |
| Seuil | 50 % | 35 % | 15 % |
Polarisé = défaut pour triathlon longue distance et athlètes loisirs.

### Taper
- S-2 : volume −20 à −30 %, intensité maintenue, 1 séance clé par discipline
- S-1 : volume −40 à −50 %, 1-2 stimuli courts
- Jour-1 : activation courte (20-30 min avec quelques accélérations)

### Brick (enchaînement)
- En Base pour débutants : pas de brick (risque blessure)
- En Build : brick court (vélo 60-90 min + run 15-30 min en Z2)
- En Peak : brick long spécifique (vélo au RP + run long au RP)

### Règles d'espacement
- Jamais deux séances "dures" (Z4+) dans la même discipline sur deux jours consécutifs
- Une séance Z4+ toutes les 72 h idéalement
- Long run ≥ 24 h après long bike (surtout masters / débutants)
- Pas de Z4+ le lendemain d'une séance longue

## Mapping par format de course

### Sprint (750/20/5)
- Durée plan typique : 8-12 sem. — Focus : tolérance lactique, vitesse
- Long bike : 1 h 30 à 2 h ; Long run : 1 h à 1 h 15

### Olympique / M (1500/40/10)
- Durée plan : 12-16 sem. — Focus : seuil lactique, gestion nutrition, transitions
- Long bike : 2 h 30 à 3 h ; Long run : 1 h 15 à 1 h 45

### Half / 70.3 (1900/90/21,1)
- Durée plan : 16-24 sem. — Focus : endurance au seuil bas (sweet spot 88-94 % FTP), volume
- Brick long en Peak : 3-4 h vélo + 45-60 min run

### Full / Ironman (3800/180/42,2)
- Durée plan : 24-36 sem. — Focus : endurance pure, Z2 dominant, nutrition
- Distribution polarisée obligatoire (risque overtraining)

## Ajustements par profil

### Débutant (< 2 ans pratique)
- Volume hebdo : 5-8 h — Distribution : 85 % Z1-Z2 / 15 % Z3 (pas de Z4-Z5)
- Progression : +5 % / sem. max — Prioriser fréquence (3 séances courtes > 1 séance longue)

### Intermédiaire (2-5 ans)
- Volume hebdo : 8-14 h — Distribution : 80/20 — Progression : +10 % / sem.

### Avancé (> 5 ans, compétiteur)
- Volume hebdo : 14-22 h — Distribution : 80/20 pur — Test FTP/seuil tous les 6-8 semaines

### Masters (> 45 ans)
- Récup : 1 semaine récup toutes les 3 semaines (au lieu de 4)
- Long bike et long run jamais le même week-end
`.trim()
