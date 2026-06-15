-- 0016 a été marquée appliquée avant de contenir ces colonnes (fichier édité
-- après application) : elles n'existent donc pas en distant. On les (ré)ajoute
-- ici de façon idempotente pour réaligner la prod sur le code (GoalSchema).
alter table public.goals
  add column if not exists swim_target_time_s int,
  add column if not exists t1_target_time_s   int,
  add column if not exists bike_target_time_s int,
  add column if not exists t2_target_time_s   int,
  add column if not exists run_target_time_s  int;
