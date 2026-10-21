-- First migration. Supabase Postgres. Access rules = RLS (bottom of file).
-- Users live in auth.users (Supabase Auth); profiles is 1-1 with it.
-- Nutrients are stored per 100 g as numeric; a diary entry freezes its kcal/macros at log time
-- so editing a food or recipe later never rewrites history.

create extension if not exists pg_trgm with schema extensions;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- profiles ---------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  sex text check (sex in ('female','male','other')),
  birth_date date,
  height_cm numeric(5,1) check (height_cm between 50 and 260),
  activity_level text not null default 'light'
    check (activity_level in ('sedentary','light','moderate','active','very_active')),
  unit_system text not null default 'metric' check (unit_system in ('metric','imperial')),
  timezone text not null default 'Europe/Berlin',  -- IANA, decides what "today" is
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- goals: history kept, the active one has ends_on null ----------------------
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('lose','maintain','gain')),
  start_weight_kg numeric(5,1) not null check (start_weight_kg > 0),
  target_weight_kg numeric(5,1) check (target_weight_kg > 0),
  kcal_per_day int not null check (kcal_per_day between 800 and 6000),
  carbs_pct int not null default 50,
  protein_pct int not null default 20,
  fat_pct int not null default 30,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint macros_sum_100 check (carbs_pct + protein_pct + fat_pct = 100)
);
create unique index goals_one_active on goals (user_id) where ends_on is null;

-- foods: public (owner null, from Open Food Facts / CIQUAL) or custom (owner set)
create table foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,  -- null = public base
  source text not null check (source in ('off','ciqual','custom','ai')),
  source_ref text,                     -- OFF barcode or CIQUAL code, for re-import
  name text not null,
  brand text,
  barcode text,
  kcal_100g numeric(6,1) not null check (kcal_100g >= 0 and kcal_100g <= 900),
  carbs_100g numeric(5,1) not null default 0 check (carbs_100g >= 0),
  protein_100g numeric(5,1) not null default 0 check (protein_100g >= 0),
  fat_100g numeric(5,1) not null default 0 check (fat_100g >= 0),
  fiber_100g numeric(5,1),
  sugar_100g numeric(5,1),
  salt_100g numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index foods_public_barcode on foods (barcode) where owner_id is null and barcode is not null;
create unique index foods_source_ref on foods (source, source_ref) where source_ref is not null;
create index foods_owner on foods (owner_id);
create index foods_name_trgm on foods using gin (name extensions.gin_trgm_ops);

create table servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references foods(id) on delete cascade,
  label text not null,                 -- "1 pièce moyenne", "1 tasse"
  grams numeric(6,1) not null check (grams > 0),
  created_at timestamptz not null default now()
);
create index servings_food on servings (food_id);

-- recipes: catalogue (owner null) or "mes plats" -----------------------------
create table recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null,
  photo_path text,                     -- Supabase Storage key, bucket "photos"
  servings int not null default 1 check (servings between 1 and 100),
  cooked_weight_g numeric(7,1) check (cooked_weight_g > 0),  -- optional, for "per 100 g cooked"
  prep_minutes int check (prep_minutes >= 0),
  tags text[] not null default '{}',
  steps jsonb not null default '[]',   -- [{text, timer_seconds?}]
  source_url text,                     -- set when imported from a URL
  -- cached totals, recomputed by trigger below
  kcal_total numeric(8,1) not null default 0,
  carbs_total numeric(7,1) not null default 0,
  protein_total numeric(7,1) not null default 0,
  fat_total numeric(7,1) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_owner on recipes (owner_id, updated_at desc);
create index recipes_tags on recipes using gin (tags);
create index recipes_title_trgm on recipes using gin (title extensions.gin_trgm_ops);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  food_id uuid references foods(id) on delete restrict,  -- null while an imported line is unmatched
  grams numeric(7,1) check (grams > 0),
  raw_text text,                       -- original line from an import
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint matched_has_grams check (food_id is null or grams is not null)
);
create index recipe_ingredients_recipe on recipe_ingredients (recipe_id, position);
create index recipe_ingredients_food on recipe_ingredients (food_id);

create or replace function recompute_recipe_totals() returns trigger language plpgsql as $$
declare rid uuid := coalesce(new.recipe_id, old.recipe_id);
begin
  update recipes r set
    kcal_total    = coalesce(t.k,0), carbs_total = coalesce(t.c,0),
    protein_total = coalesce(t.p,0), fat_total   = coalesce(t.f,0)
  from (
    select sum(f.kcal_100g*i.grams/100) k, sum(f.carbs_100g*i.grams/100) c,
           sum(f.protein_100g*i.grams/100) p, sum(f.fat_100g*i.grams/100) f
    from recipe_ingredients i join foods f on f.id = i.food_id
    where i.recipe_id = rid
  ) t
  where r.id = rid;
  return null;
end $$;
create trigger recipe_totals after insert or update or delete on recipe_ingredients
  for each row execute function recompute_recipe_totals();

-- photo scans: one AI call, confirmed or discarded by the user ---------------
create table photo_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_path text not null,
  model text not null,
  status text not null default 'pending' check (status in ('pending','done','failed','confirmed','discarded')),
  detected jsonb not null default '[]',  -- [{label, grams, kcal, carbs, protein, fat, confidence, food_id?}]
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index photo_scans_user on photo_scans (user_id, created_at desc);

-- diary ----------------------------------------------------------------------
create table diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null,             -- the user's local day, computed client-side from profiles.timezone
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  food_id uuid references foods(id) on delete set null,
  recipe_id uuid references recipes(id) on delete set null,
  photo_scan_id uuid references photo_scans(id) on delete set null,
  label text not null,                 -- frozen display name, survives a deleted food
  grams numeric(7,1) check (grams > 0),
  servings numeric(5,2) check (servings > 0),
  kcal numeric(7,1) not null check (kcal >= 0),
  carbs numeric(6,1) not null default 0,
  protein numeric(6,1) not null default 0,
  fat numeric(6,1) not null default 0,
  method text not null check (method in ('search','barcode','photo','manual','recipe','copy')),
  client_id uuid,                      -- idempotency key for offline sync
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amount_given check (grams is not null or servings is not null)
);
create index diary_user_day on diary_entries (user_id, logged_on);
create index diary_food on diary_entries (food_id);
create index diary_recipe on diary_entries (recipe_id);
create index diary_scan on diary_entries (photo_scan_id);
-- not partial: PostgREST upsert needs a plain unique index; NULL client_ids never collide
create unique index diary_client_id on diary_entries (user_id, client_id);

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null,
  kg numeric(5,1) not null check (kg between 20 and 400),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create table water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null,
  ml int not null check (ml > 0 and ml <= 5000),
  created_at timestamptz not null default now()
);
create index water_user_day on water_logs (user_id, logged_on);

create table favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid references foods(id) on delete cascade,
  recipe_id uuid references recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint one_target check ((food_id is null) <> (recipe_id is null))
);
create unique index favorites_food on favorites (user_id, food_id) where food_id is not null;
create unique index favorites_recipe on favorites (user_id, recipe_id) where recipe_id is not null;

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid references foods(id) on delete set null,
  text text not null,
  grams numeric(7,1),
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_user on shopping_items (user_id, checked);

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['profiles','goals','foods','recipes','photo_scans','diary_entries','shopping_items'] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- recents = a view, not a table
create view recent_foods with (security_invoker = true) as
  select distinct on (user_id, coalesce(food_id, recipe_id))
    user_id, food_id, recipe_id, label, grams, servings, meal, created_at
  from diary_entries
  where food_id is not null or recipe_id is not null
  order by user_id, coalesce(food_id, recipe_id), created_at desc;

-- search: custom foods first, then trigram similarity; RLS applies (security invoker)
create or replace function search_foods(q text, lim int default 30) returns setof foods
language sql stable set search_path = public, extensions as $$
  select * from foods
  where name % q or name ilike '%' || q || '%' or barcode = q
  order by (owner_id is not null) desc, similarity(name, q) desc
  limit least(lim, 100)
$$;

-- RLS ------------------------------------------------------------------------
alter table profiles enable row level security;
alter table goals enable row level security;
alter table foods enable row level security;
alter table servings enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table photo_scans enable row level security;
alter table diary_entries enable row level security;
alter table weight_logs enable row level security;
alter table water_logs enable row level security;
alter table favorites enable row level security;
alter table shopping_items enable row level security;

create policy own on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy own on goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on photo_scans for select using (user_id = auth.uid());  -- writes only via edge function (service role)
create policy own_discard on photo_scans for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on diary_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on weight_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on water_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on shopping_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- public rows readable by any signed-in user; only owners write their own (public rows written by service role imports)
create policy read on foods for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy write_own on foods for insert to authenticated with check (owner_id = auth.uid());
create policy update_own on foods for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy delete_own on foods for delete to authenticated using (owner_id = auth.uid());

create policy read on servings for select to authenticated
  using (exists (select 1 from foods f where f.id = food_id and (f.owner_id is null or f.owner_id = auth.uid())));
create policy write_own on servings for all to authenticated
  using (exists (select 1 from foods f where f.id = food_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from foods f where f.id = food_id and f.owner_id = auth.uid()));

create policy read on recipes for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy write_own on recipes for insert to authenticated with check (owner_id = auth.uid());
create policy update_own on recipes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy delete_own on recipes for delete to authenticated using (owner_id = auth.uid());

create policy read on recipe_ingredients for select to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id and (r.owner_id is null or r.owner_id = auth.uid())));
create policy write_own on recipe_ingredients for all to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_id and r.owner_id = auth.uid()));

-- the totals trigger updates recipes as the caller; make it bypass RLS safely
alter function recompute_recipe_totals() security definer set search_path = public;

-- Storage: private bucket "photos", one folder per user: photos/<uid>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy photos_own_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
