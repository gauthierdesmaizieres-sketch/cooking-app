-- RLS check: user B must never read or write user A's data. Runs in a transaction, rolled back.
--   docker exec -i supabase_db_Cooking_App psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/rls.sql
begin;
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.local');

-- as A: log a meal, a custom food, a recipe, a scan row (scan written by service role in real life)
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
insert into diary_entries (user_id, logged_on, meal, label, grams, kcal, method)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date, 'lunch', 'riz', 100, 130, 'search');
insert into foods (owner_id, source, name, kcal_100g) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'custom', 'Gâteau de mamie A', 400);
insert into recipes (owner_id, title) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Plat secret A');
do $$ begin assert (select count(*) from diary_entries) = 1, 'A sees own entry'; end $$;
do $$ begin assert (select count(*) from search_foods('mamie')) = 1, 'A finds own food'; end $$;
select set_config('test.a_recipe', (select id::text from recipes where title = 'Plat secret A'), true);
reset role;
insert into photo_scans (user_id, photo_path, model) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x/y.jpg', 'm');

-- as B: sees nothing of A, cannot change or impersonate A
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
do $$ begin assert (select count(*) from diary_entries) = 0, 'B reads A diary'; end $$;
do $$ begin assert (select count(*) from photo_scans) = 0, 'B reads A scans'; end $$;
do $$ begin assert (select count(*) from recipes where owner_id is not null) = 0, 'B reads A recipe'; end $$;
do $$ begin assert (select count(*) from search_foods('mamie')) = 0, 'B finds A food'; end $$;
do $$ begin assert (select count(*) from foods where owner_id is null) > 0, 'B reads public foods'; end $$;
with u as (update diary_entries set kcal = 0 returning 1) select count(*) as b_updated_a from u;
do $$ begin
  insert into diary_entries (user_id, logged_on, meal, label, grams, kcal, method)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date, 'lunch', 'fake', 1, 1, 'manual');
  raise exception 'B wrote into A diary';
exception when insufficient_privilege then null; -- RLS violation = expected
end $$;
do $$ begin
  insert into foods (owner_id, source, name, kcal_100g) values (null, 'custom', 'fake public', 1);
  raise exception 'B wrote a public food';
exception when insufficient_privilege then null;
end $$;
do $$ begin assert (select count(*) from storage.objects) = 0; end $$;
do $$ begin
  perform save_recipe(jsonb_build_object('id', current_setting('test.a_recipe'), 'title', 'pirate', 'servings', 1), '[]');
  raise exception 'B overwrote A recipe';
exception when no_data_found then null; -- 'recipe not found' (P0002)
end $$;
reset role;
do $$ begin assert (select kcal from diary_entries where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 130, 'A entry changed by B'; end $$;
select 'RLS OK' as result;
rollback;
