export const ADAPTATION = `
# Adapter l'entraînement à l'état de forme

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

## Gestion des pauses et reprises

### Pause < 7 jours : reprendre au volume d'avant. Première semaine : supprimer Z4+.
### Pause 7-21 jours : reprendre à 70 % du volume. 2 semaines sans Z4+.
### Pause > 21 jours : reprendre à 50 % du dernier volume stable. 4 semaines sans Z4+.
`.trim()
