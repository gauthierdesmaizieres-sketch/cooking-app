# Architecture : app cuisine + calories (reconstruction des fonctions clés de YAZIO / MyFitnessPal)

Nom provisoire. Source : `replica/recon.md`, `replica/features.csv`.

## Stack

Choix guidé par ton projet `fitness-app` (React 19 + Vite + vite-plugin-pwa, JS, `node --test`) : même outillage, rien de nouveau à apprendre côté front.

| layer | choice | why |
| --- | --- | --- |
| app | **React + Vite + vite-plugin-pwa** (JS, comme fitness-app) | tu connais déjà ; la PWA s'installe sur le téléphone, accède à la caméra et marche hors ligne |
| mobile stores | Capacitor plus tard (même code) | seulement si tu veux l'App Store / Play ; pas besoin pour la v1 |
| styling | CSS simple + tokens de `/replica-design` | même approche que fitness-app |
| database | **Supabase Postgres** | une seule base, RLS = sécurité par utilisateur sans écrire de backend |
| auth | Supabase Auth (email magic link + Google/Apple) | inclus, gratuit au début |
| files | Supabase Storage, bucket privé `photos` | photos de plats et de scans, dossier par utilisateur |
| server code | **Supabase Edge Functions** (Deno) | 4 fonctions seulement : celles qui ont besoin d'une clé secrète ou d'un appel externe |
| IA photo | **Gemini (`gemini-3.8-flash`, offre gratuite pour tester) ou API Claude vision**, choisi par `AI_PROVIDER` ; avant : (`claude-sonnet-5-5` ; `claude-haiku-5-5` si le coût compte), appelée depuis l'edge function | renvoie un JSON aliments + grammes + kcal ; la clé ne quitte jamais le serveur |
| données aliments | **Open Food Facts** (API publique, code-barres, licence ODbL) + **CIQUAL** (ANSES, aliments bruts, import CSV unique) | remplace la base propriétaire ; mettre l'attribution ODbL dans l'app |
| payments | Stripe Checkout + Billing, **plus tard** | uniquement si tu vends un abonnement (feature "could") |
| email | Supabase Auth (emails de connexion) ; Resend si besoin plus tard | pas d'email produit en v1 |
| jobs | Supabase cron (pg_cron) | un seul job : nettoyer les scans abandonnés |
| hosting | Vercel ou Netlify (statique) | le front est un build Vite statique |

Pas de serveur Node à toi, pas de microservices. Le client parle à Supabase directement (RLS) ; tout le reste passe par 4 edge functions.

## Schema

Tables : 12 (+ 1 vue `recent_foods`). Access rules : **RLS Postgres**. Voir `supabase/migrations/20261019000000_init.sql` (première migration).

`profiles, goals, foods, servings, recipes, recipe_ingredients, photo_scans, diary_entries, weight_logs, water_logs, favorites, shopping_items`

Décisions clés :
- **Les entrées du journal figent `label`, `kcal` et les macros** au moment du log : modifier ou supprimer un aliment ou une recette ne réécrit jamais l'historique (`on delete set null` côté journal).
- `foods.owner_id null` = base publique (OFF/CIQUAL, écrite seulement par le service role) ; sinon aliment perso. Même schéma pour `recipes` (catalogue vs « mes plats »).
- Totaux d'une recette recalculés par trigger à chaque changement d'ingrédient ; kcal par portion = `kcal_total / servings`.
- Un seul objectif actif par utilisateur (index unique partiel `ends_on is null`) ; la somme des macros doit faire 100 %.
- `logged_on date` = le jour **local** de l'utilisateur, pas un timestamp (voir fuseaux horaires).
- Recherche : index trigram (`pg_trgm`) sur `foods.name` et `recipes.title`.
- `diary_entries.client_id` unique par utilisateur = idempotence de la sync hors ligne.

## API

CRUD = appels Supabase directs depuis le client, protégés par RLS. Les lignes `rpc`/`fn` sont des edge functions.

### F01 Logger un plat par photo
| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| storage PUT `photos/{uid}/{uuid}.jpg` | upload la photo (redimensionnée côté client à ~1024 px, JPEG) | user | fichier ≤ 2 Mo | path | F01 |
| POST `fn/scan-photo` | crée `photo_scans`, appelle Claude vision, matche chaque label sur `foods` (trigram), sauvegarde `detected` | user | `{photo_path}` | `{scan_id, items:[{label, grams, kcal, carbs, protein, fat, confidence, food_id?}]}` | F01 |
| insert `diary_entries` (batch) | log les items confirmés/corrigés, `method='photo'`, `photo_scan_id` | user | lignes | lignes | F01 |
| update `photo_scans.status` | `confirmed` / `discarded` | user | `{id, status}` | — | F01 |

### F02 Produit emballé
| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET `fn/barcode/{ean}` | cherche dans `foods` ; sinon appelle l'API Open Food Facts, insère en base publique (cache), renvoie | user | EAN | food + servings, ou 404 → S11 | F02 |
| insert `diary_entries` | log | user | food_id, grams, meal, logged_on | ligne | F02 |

### F03 Recherche
| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| rpc `search_foods(q, limit)` | trigram sur foods visibles (publics + perso), perso en premier | user | `q` | foods | F03 |
| select `recent_foods`, `favorites` | récents / favoris | user | — | lignes | F03 |
| select `servings` where food_id | portions | user | food_id | servings | F03 |
| insert/update/delete `diary_entries` | log, modifier, supprimer | user | — | — | F03 |
| insert `foods` (+ `servings`) | aliment perso (S11) | user | form | food | F02/F03 |

### F04 Créer mon plat / F05 Cuisiner
| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| insert/update/delete `recipes` | créer/éditer un plat (photo, portions, étapes) | owner | form | recipe | F04 |
| insert/update/delete `recipe_ingredients` | ingrédients (le trigger recalcule les totaux) | owner | food_id, grams | — | F04 |
| POST `fn/import-recipe` | fetch l'URL, lit le JSON-LD `schema.org/Recipe`, matche chaque ligne d'ingrédient sur `foods` | user | `{url}` | brouillon : titre, portions, étapes, ingrédients ✓/✗ | F04 (S16) |
| select `recipes` + ingrédients | catalogue + mes plats, filtres `tags` | user | q, tags | recettes | F05 |
| insert `diary_entries` (`recipe_id`, `servings`) | ajouter au journal | user | — | — | F04/F05 |
| insert `shopping_items` (batch) | ingrédients → liste de courses | user | recipe_id, servings | — | F05 |

### F06 Onboarding / F07 Poids
| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| Supabase Auth signUp / signInWithOtp / OAuth | compte | public | email | session | F06 |
| upsert `profiles`, insert `goals` | profil + objectif ; le calcul kcal (Mifflin-St Jeor + activité ± 500 kcal) est **côté client** dans `lib.js`, testé | user | form | goal | F06 |
| upsert `weight_logs` | poids du jour (unique par jour) | user | kg | — | F07 |
| POST `fn/delete-account` | supprime l'utilisateur auth (cascade) + ses fichiers storage | user | — | 204 | RGPD |

Webhooks in : aucun en v1 (Stripe `checkout.session.completed` / `customer.subscription.*` si abonnement plus tard).
Webhooks out : aucun.
Jobs : `cleanup-scans`, quotidien 03:00 UTC (pg_cron) : supprime les `photo_scans` `pending/failed/discarded` de plus de 7 jours et leurs photos.

Seules des API officielles et publiques avec tes propres clés : Claude API, Open Food Facts, import CIQUAL. Jamais les endpoints privés de YAZIO ou MFP.

## The parts that bite

- **Précision IA** : ±20–30 % sur les grammes au mieux. L'écran de correction (S09) est obligatoire ; demander à Claude un JSON strict (schema/tool), valider côté fonction (grammes 1–2000, kcal cohérentes avec les macros : 4/4/9), rejeter le reste.
- **Coût et abus IA** : limiter `scan-photo` par utilisateur (ex. 30/jour, compté sur `photo_scans`) ; réduire l'image côté client avant l'upload.
- **Fuseaux horaires** : « aujourd'hui » = jour local. Le client calcule `logged_on` avec `profiles.timezone` ; ne jamais dériver le jour d'un timestamp UTC (un snack à 23 h 30 tomberait le lendemain).
- **Idempotence / hors ligne** : file d'attente locale (IndexedDB) des logs faits hors ligne, rejouée avec `client_id` ; l'index unique empêche les doublons quand la requête part deux fois.
- **Qualité des données OFF** : valeurs manquantes ou fausses (kcal > 900/100 g, macros vides) → check constraints + fallback « compléter » via S11. Doublons recherche : dédoublonner par barcode, perso d'abord.
- **Race** : deux onglets créent le même aliment OFF → index unique `foods_public_barcode`, faire `insert ... on conflict do nothing` puis select.
- **Taille des fichiers** : photos ≤ 2 Mo après compression ; bucket privé, URLs signées courtes.
- **Recherche** : trigram suffit jusqu'à quelques millions de lignes ; n'importer que les produits OFF du pays visé (DE/FR), pas toute la base.
- **Import URL** : beaucoup de sites n'ont pas de JSON-LD → échec propre + saisie manuelle ; timeout 10 s, taille max 2 Mo, http(s) uniquement (anti-SSRF : refuser les IP privées).
- **RGPD** : données de santé (poids, alimentation) = catégorie sensible. Projet Supabase en région UE, suppression de compte complète (`fn/delete-account`), export CSV, pas d'analytics tiers dans la v1.
- **Attribution** : licence ODbL d'Open Food Facts → mention + lien dans l'app.

## Build order

1. **Vertical slice** (prouve la stack, moche) : login magic link → S05 journal du jour → S06 + S08 photo → S09 corriger → entrée dans le journal → ring kcal.
   Tables : `profiles, foods, photo_scans, diary_entries` (+ objectif kcal codé en dur). Routes : `fn/scan-photo`, insert/select `diary_entries`, storage upload.
2. **Must-haves** :
   - onboarding : S01–S03, `goals`, calcul kcal dans `lib.js` + test `node --test`.
   - journal : S05 complet (repas, macros, changer de jour, modifier/supprimer).
   - logging : import CIQUAL, `search_foods`, récents/favoris, S10 portions (`servings`), S07 code-barres (`fn/barcode`, lecture via `BarcodeDetector`, fallback ZXing), S11 aliment perso.
   - recettes : S15 créer mon plat, `recipes` + `recipe_ingredients` + trigger, S13 ajouter au journal.
3. **Should-haves** : S13 recalcul selon les portions, S14 mode cuisine (Wake Lock API + timer), S12 filtres, S16 `fn/import-recipe`, « photo → plat réutilisable », label nutritionnel complet, S18 poids, eau, copier un repas, rappels (notifications PWA), file hors ligne, export CSV, `fn/delete-account`.
4. **Could-haves** : liste de courses S17, catalogue de recettes maison, plans de repas, Health Connect / Apple Health (nécessite Capacitor), saisie vocale, photo du frigo → idées, jeûne, abonnement Stripe.
5. **Fixes de `/replica-entrepreneur`** : pas d'upsell agressif, pas d'animations bloquantes, IA désactivable, scan code-barres gratuit (payant chez MFP).
