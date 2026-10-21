-- Save a dish and its ingredient list in one transaction: an edit that fails half-way must not
-- leave the recipe with its old ingredients deleted. Runs as the caller, so RLS still applies.
create or replace function save_recipe(r jsonb, ingredients jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare rid uuid := nullif(r->>'id', '')::uuid;
begin
  if rid is null then
    insert into recipes (owner_id, title, photo_path, servings, prep_minutes, tags, steps)
    values (auth.uid(), r->>'title', r->>'photo_path', (r->>'servings')::int, (r->>'prep_minutes')::int,
            coalesce(array(select jsonb_array_elements_text(r->'tags')), '{}'), coalesce(r->'steps', '[]'))
    returning id into rid;
  else
    update recipes set title = r->>'title', photo_path = r->>'photo_path', servings = (r->>'servings')::int,
      prep_minutes = (r->>'prep_minutes')::int,
      tags = coalesce(array(select jsonb_array_elements_text(r->'tags')), '{}'), steps = coalesce(r->'steps', '[]')
    where id = rid and owner_id = auth.uid();
    if not found then raise exception 'recipe not found' using errcode = 'P0002'; end if;
    delete from recipe_ingredients where recipe_id = rid;
  end if;
  insert into recipe_ingredients (recipe_id, food_id, grams, position)
  select rid, (i->>'food_id')::uuid, (i->>'grams')::numeric, (ord - 1)::int
  from jsonb_array_elements(ingredients) with ordinality as t(i, ord);
  return rid;
end $$;
