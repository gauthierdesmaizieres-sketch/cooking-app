-- Onboarding / "change my goal" in one transaction: profile, close the active goal, open the new one,
-- log today's weight. Half-done would leave the user without an active goal. Runs as the caller (RLS).
create or replace function save_onboarding(p jsonb, g jsonb, weight numeric, today date) returns uuid
language plpgsql security invoker set search_path = public as $$
declare gid uuid;
begin
  insert into profiles (id, sex, birth_date, height_cm, activity_level, timezone)
  values (auth.uid(), p->>'sex', (p->>'birth_date')::date, (p->>'height_cm')::numeric, p->>'activity_level', coalesce(p->>'timezone', 'Europe/Berlin'))
  on conflict (id) do update set sex = excluded.sex, birth_date = excluded.birth_date, height_cm = excluded.height_cm,
    activity_level = excluded.activity_level, timezone = excluded.timezone;

  update goals set ends_on = today where user_id = auth.uid() and ends_on is null;
  insert into goals (user_id, type, start_weight_kg, target_weight_kg, kcal_per_day, carbs_pct, protein_pct, fat_pct, starts_on)
  values (auth.uid(), g->>'type', weight, nullif(g->>'target_weight_kg', '')::numeric, (g->>'kcal_per_day')::int,
          (g->>'carbs_pct')::int, (g->>'protein_pct')::int, (g->>'fat_pct')::int, today)
  returning id into gid;

  insert into weight_logs (user_id, logged_on, kg) values (auth.uid(), today, weight)
  on conflict (user_id, logged_on) do update set kg = excluded.kg;
  return gid;
end $$;
