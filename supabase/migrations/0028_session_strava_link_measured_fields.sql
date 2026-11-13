-- Prévu vs réalisé : une séance peut être liée à une activité Strava (athlètes
-- sans Garmin), en plus de la liaison Garmin existante.
alter table public.sessions
  add column if not exists strava_activity_id uuid
    references public.strava_activities (id) on delete set null;

create index if not exists sessions_strava_activity_id
  on public.sessions (strava_activity_id);

-- Résultats de tests : liste des seuils MESURÉS par un test (et non dérivés des
-- records), pour qu'ils ne soient pas recalculés depuis les records ensuite.
alter table public.physiology
  add column if not exists measured_fields text[] not null default '{}';

-- La vue `physiology_current` (select *) doit être recréée pour exposer la colonne.
create or replace view public.physiology_current as
  select distinct on (user_id) *
  from public.physiology
  order by user_id, test_date desc;
