-- "pates" must find "Pâtes cuites": compare without accents and case.
create extension if not exists unaccent with schema extensions;

create or replace function search_foods(q text, lim int default 30) returns setof foods
language sql stable set search_path = public, extensions as $$
  select * from foods
  where name % q
     or unaccent(lower(name)) like '%' || unaccent(lower(q)) || '%'
     or barcode = q
  order by (owner_id is not null) desc, similarity(unaccent(lower(name)), unaccent(lower(q))) desc
  limit least(lim, 100)
$$;
-- shortcut: the unaccent() filter can't use the trigram index (unaccent isn't immutable);
-- fine for CIQUAL-size tables, add an immutable wrapper + expression index once foods reaches ~100k rows.
