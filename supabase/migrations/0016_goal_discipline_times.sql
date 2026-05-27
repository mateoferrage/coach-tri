alter table public.goals
  add column if not exists swim_target_time_s int,
  add column if not exists t1_target_time_s   int,
  add column if not exists bike_target_time_s int,
  add column if not exists t2_target_time_s   int,
  add column if not exists run_target_time_s  int;
