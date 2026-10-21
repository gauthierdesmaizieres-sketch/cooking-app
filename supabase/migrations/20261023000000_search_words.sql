-- Search for a 3000-food base: every typed word must appear in the name (accent- and case-insensitive),
-- e.g. "poulet roti" -> "Poulet, cuisse, viande et peau rôtie". Own foods first, then names starting with
-- the first word, then shorter (more generic) names. Nothing found -> trigram fuzzy match for typos.
create or replace function search_foods(q text, lim int default 30) returns setof foods
language plpgsql stable set search_path = public, extensions as $$
declare
  words text[] := array_remove(regexp_split_to_array(unaccent(lower(trim(q))), '[^a-z0-9]+'), '');
  n int := least(lim, 100);
begin
  return query
    select f.* from foods f
    where (cardinality(words) > 0
           and not exists (select 1 from unnest(words) w where unaccent(lower(f.name)) not like '%' || w || '%'))
       or f.barcode = trim(q)
    order by (f.owner_id is not null) desc, (unaccent(lower(f.name)) like words[1] || '%') desc, length(f.name), f.name
    limit n;
  if not found and length(trim(q)) >= 3 then
    return query
      select f.* from foods f
      where unaccent(lower(f.name)) % unaccent(lower(q))
      order by similarity(unaccent(lower(f.name)), unaccent(lower(q))) desc
      limit n;
  end if;
end $$;
-- shortcut: sequential scan (unaccent isn't immutable, so no index); fine up to ~100k foods, then add an
-- immutable unaccent wrapper + trigram expression index.
