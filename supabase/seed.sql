-- Generic foods (public base, owner_id null). Values per 100 g, public reference values rounded.
-- Production: replace with the full CIQUAL import (replica/architecture.md).
insert into foods (source, source_ref, name, kcal_100g, carbs_100g, protein_100g, fat_100g) values
  ('ciqual', 'seed-01', 'Riz blanc cuit', 130, 28.6, 2.7, 0.3),
  ('ciqual', 'seed-02', 'Pâtes cuites', 157, 31, 5.8, 0.9),
  ('ciqual', 'seed-03', 'Poulet rôti', 190, 0, 27, 9),
  ('ciqual', 'seed-04', 'Saumon cuit', 206, 0, 22, 13),
  ('ciqual', 'seed-05', 'Œuf dur', 155, 1.1, 13, 11),
  ('ciqual', 'seed-06', 'Brocoli cuit', 35, 7, 2.4, 0.4),
  ('ciqual', 'seed-07', 'Avocat', 160, 9, 2, 15),
  ('ciqual', 'seed-08', 'Pomme', 52, 14, 0.3, 0.2),
  ('ciqual', 'seed-09', 'Banane', 89, 23, 1.1, 0.3),
  ('ciqual', 'seed-10', 'Pain complet', 247, 41, 13, 3.4),
  ('ciqual', 'seed-11', 'Yaourt nature', 61, 4.7, 3.5, 3.3),
  ('ciqual', 'seed-12', 'Huile d''olive', 884, 0, 0, 100)
on conflict do nothing;
