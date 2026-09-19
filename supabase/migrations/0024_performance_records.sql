-- Performances de référence (records) saisies par l'athlète.
-- Les seuils (allure seuil, VMA, CSS) sont désormais dérivés de ces records
-- côté serveur (voir src/lib/utils/performance.ts) puis stockés dans les
-- colonnes physiology existantes pour que le calcul de zones reste inchangé.

alter table public.physiology
  add column if not exists run_5k_time_s     int check (run_5k_time_s   between 600  and 3600),
  add column if not exists run_10k_time_s    int check (run_10k_time_s  between 1200 and 7200),
  add column if not exists run_half_time_s   int check (run_half_time_s between 2700 and 18000),
  add column if not exists swim_100m_time_s  int check (swim_100m_time_s between 45  and 300),
  add column if not exists swim_200m_time_s  int check (swim_200m_time_s between 90  and 600),
  add column if not exists swim_400m_time_s  int check (swim_400m_time_s between 180 and 1200),
  add column if not exists swim_800m_time_s  int check (swim_800m_time_s between 360 and 2400);

-- Recrée la vue pour exposer les nouvelles colonnes (select *).
create or replace view public.physiology_current as
  select distinct on (user_id) *
  from public.physiology
  order by user_id, test_date desc;
