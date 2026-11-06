-- La colonne race_type (0004) portait une contrainte inline triathlon-only,
-- auto-nommée `goals_race_type_check` par Postgres, que la 0025 n'a jamais
-- supprimée. Elle rejette les types course à pied (road/trail/ultra) et fait
-- échouer la création d'une course trail. On la retire : la validation
-- sport ↔ race_type vit désormais sur `goals_sport_race_type_check` (0025).
alter table public.goals drop constraint if exists goals_race_type_check;
