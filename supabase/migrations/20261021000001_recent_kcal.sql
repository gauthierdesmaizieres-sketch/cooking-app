-- Recents show what was logged last time (kcal included), new column appended at the end.
create or replace view recent_foods with (security_invoker = true) as
  select distinct on (user_id, coalesce(food_id, recipe_id))
    user_id, food_id, recipe_id, label, grams, servings, meal, created_at, kcal
  from diary_entries
  where food_id is not null or recipe_id is not null
  order by user_id, coalesce(food_id, recipe_id), created_at desc;
