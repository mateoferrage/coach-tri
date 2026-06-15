-- Le mode « maintien » crée un plan sans objectif (goal_id null), mais 0005 a
-- défini goal_id NOT NULL → l'insertion échouait en prod. On relâche la
-- contrainte pour autoriser les plans sans course cible, conformément au design.
alter table public.plans
  alter column goal_id drop not null;
