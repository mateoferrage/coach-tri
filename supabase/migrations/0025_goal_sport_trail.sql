-- Généralisation des courses : au triathlon s'ajoute la course à pied (route/trail/ultra).
-- `sport` discrimine le type de course ; les colonnes trail ne concernent que le running.
-- Les lignes existantes prennent sport='triathlon' (défaut) → rétro-compatibles.
alter table public.goals
  add column if not exists sport                   text not null default 'triathlon',
  add column if not exists elevation_loss_m        int,
  add column if not exists surface                 text,
  add column if not exists max_altitude_m          int,
  add column if not exists cutoff_time_s           int,
  add column if not exists estimated_finish_time_s int;

-- Cohérence sport / race_type :
--   triathlon → sprint|olympic|half|full|xterra|custom
--   running   → road|trail|ultra
alter table public.goals drop constraint if exists goals_sport_race_type_check;
alter table public.goals
  add constraint goals_sport_race_type_check check (
    (sport = 'triathlon' and race_type in ('sprint','olympic','half','full','xterra','custom'))
    or
    (sport = 'running' and race_type in ('road','trail','ultra'))
  );

-- surface (technicité) : valeurs contrôlées, null autorisé (triathlon ou non renseigné)
alter table public.goals drop constraint if exists goals_surface_check;
alter table public.goals
  add constraint goals_surface_check check (
    surface is null or surface in ('road','gravel','technical','mountain')
  );
