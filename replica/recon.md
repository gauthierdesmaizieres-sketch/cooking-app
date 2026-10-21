# Recon map: YAZIO (+ MyFitnessPal en complément) — mobile iOS/Android

Scope: le journal alimentaire (log par recherche, code-barres, **photo IA**), l'objectif calories/macros, et les **recettes** (catalogue + créer son propre plat + mode cuisine). Hors slice v1 : jeûne intermittent, sync montres, communauté, GLP-1.
For: à confirmer — hypothèse : usage perso d'abord, produit vendable ensuite.
Date: 2026-10-19

Méthode : sources publiques uniquement. Aucun compte utilisé, pas de screenshots enregistrés (le help center YAZIO renvoie 403 au fetch ; à lire à la main dans le navigateur). `replica/screens/` est vide : à remplir depuis les fiches stores ou ton propre compte.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing site YAZIO | https://www.yazio.com/en | features, objectifs, calculateurs, onboarding web |
| 2 | App Store YAZIO | https://apps.apple.com/us/app/yazio-calorie-counter-app/id946099227 | liste free/PRO, prix IAP, 4.7★ (51K) |
| 3 | base aliments YAZIO | https://www.yazio.com/en/foods | structure d'un aliment (portion, kcal, macros) |
| 4 | fiche aliment exemple | https://www.yazio.com/en/foods/banana.html?view=standard | label nutritionnel, camembert macros |
| 5 | help center YAZIO | https://help.yazio.com/ | 403 au fetch — à lire manuellement |
| 6 | onboarding web YAZIO | https://www.yazio.com/en/app/onboarding/welcome | questionnaire → plan perso (à parcourir à la main) |
| 7 | MFP Premium | https://www.myfitnesspal.com/premium | tableau free vs premium, 20 CHF/mois, 80 CHF/an |
| 8 | App Store MFP | https://apps.apple.com/us/app/myfitnesspal-calorie-counter/id341232718 | 20.5M aliments, meal scan, voice log, AI coach photo frigo |
| 9 | guide Meal Scan (tiers) | https://www.passio.ai/blog/essential-guide-to-myfitnesspal-meal-scan | flow scan → confirmer aliments+quantités → log |
| 10 | import recette (tiers) | https://nutriscan.app/blog/posts/best-app-recipe-import-2026-fb4fc6a4f6 | URL → ingrédients → écran de matching ✓/✗ |
| 11 | avis 2026 (tiers, concurrent) | https://nutrola.app/en/blog/yazio-review-2026 | plaintes : upsell agressif, animations, pop-up IA |
| 12 | OpenNutriTracker (open source) | https://github.com/simonoppowa/OpenNutriTracker | base possible / référence (Flutter, Open Food Facts) |
| 13 | Open Food Facts | https://github.com/openfoodfacts/openfoodfacts-server | base aliments + codes-barres ouverte |

Note : les sources 9–11 sont des blogs concurrents → indicatives seulement.

## Core loop

Je mange → je logue en < 10 s (photo, code-barres ou recherche) → je vois combien il me reste de kcal/macros aujourd'hui.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Welcome / onboarding | 1er lancement | objectif (perdre, maintenir, muscle) | choix carte, CTA | — |
| S02 | Questionnaire profil | S01 → | sexe, âge, taille, poids, poids cible, activité | stepper, number picker, progress bar | validation erreur |
| S03 | Plan calculé | fin S02 | kcal/jour + répartition macros, date cible | loader "plan en cours", ring | loading, filled |
| S04 | Paywall | après S03, et sur features PRO | upsell trial | plan cards, toggle annuel/mensuel | — (ne pas copier l'agressivité) |
| S05 | Journal du jour (Diary) | onglet 1 | kcal restantes, macros, repas | ring kcal, barres macros, cartes repas (petit-déj/déj/dîner/snacks), date switcher, eau | empty (jour vide), filled, dépassement |
| S06 | Ajouter aliment | "+" sur un repas | chercher / récents / favoris / mes plats | search bar, tabs, list rows, boutons scan & photo | empty search, no results, offline |
| S07 | Scanner code-barres | S06 → icône barcode | lire EAN | caméra, cadre, torche | permission refusée, inconnu → créer |
| S08 | Scan photo IA | S06 → icône photo | photo du plat → aliments détectés | caméra/galerie, loader | loading, rien détecté, permission refusée |
| S09 | Résultat scan / confirmation | après S08 | corriger aliments + portions avant log | liste éditable, stepper grammes, swap aliment | low confidence, édition |
| S10 | Détail aliment / portion | tap sur un résultat | choisir portion + quantité, voir nutriments | unit picker (g, portion, pièce), label nutritionnel, camembert macros | filled |
| S11 | Créer aliment perso | S06 / S07 inconnu | nom, kcal, macros par 100 g ou portion | form | validation |
| S12 | Recettes (catalogue) | onglet 2 | parcourir/filtrer | search, filter chips (vegan, low carb, temps), cards photo | empty filter, loading |
| S13 | Détail recette | S12 → | ingrédients, kcal/portion, étapes | hero photo, servings stepper, liste ingrédients, "ajouter au journal", "liste de courses" | filled |
| S14 | Mode cuisine | S13 → "Cuisiner" | étapes plein écran, écran allumé | step pager, timer | — |
| S15 | Créer/éditer mon plat | S12 "+" ou S06 "Mes plats" | nouveau plat : photo, ingrédients, portions → kcal calculées | photo picker, ingredient rows (recherche S06), servings, steps | empty, calcul en direct |
| S16 | Import recette depuis URL (MFP) | S15 → "importer" | coller URL → ingrédients matchés | url input, matching list ✓/✗ | partiel, échec |
| S17 | Liste de courses | S13 / onglet | ingrédients agrégés | checklist | empty |
| S18 | Progrès | onglet 3 | courbe poids, kcal moyennes | line chart, add weight | empty |
| S19 | Profil / réglages | onglet 4 | objectifs, unités, rappels, compte, export | list settings | — |

## Flows

```
F01 Logger un plat par photo (feature phare)
    S05 -> S06 -> S08 (photo) -> S09 (corriger) -> S05
    happy path clicks: 4 (+, photo, déclencher, valider)
    edge: plusieurs aliments sur l'assiette, rien reconnu, portion mal estimée,
          permission caméra refusée, hors ligne, plat maison inconnu

F02 Logger un produit emballé
    S05 -> S06 -> S07 -> S10 -> S05
    happy path clicks: 4
    edge: code inconnu -> S11, valeurs par 100 g vs portion

F03 Logger par recherche
    S05 -> S06 (taper) -> S10 -> S05
    happy path clicks: 3 + saisie
    edge: aucun résultat, doublons de base, récents vides au 1er jour

F04 Ajouter un nouveau plat (ma recette)
    S12 -> S15 (photo, ingrédients via recherche, nb portions) -> S13 -> "ajouter au journal" -> S05
    happy path clicks: ~3 + 1 par ingrédient
    edge: ingrédient introuvable, portions changées après cuisson, poids total cuit

F05 Cuisiner une recette du catalogue
    S12 -> S13 -> S14
    edge: changer le nb de portions (recalcul quantités + kcal)

F06 Onboarding → objectif
    S01 -> S02 -> S03 -> (S04) -> S05
    happy path clicks: ~10
    edge: poids cible irréaliste, unités impériales

F07 Suivre son poids
    S18 -> ajouter poids -> courbe
```

Chiffre à battre : F01 en 4 taps, < 10 s.

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, pressed, disabled, loading | all |
| Calorie ring | grand (diary), petit (repas) | sous objectif, atteint, dépassé | S03, S05 |
| Macro bar | glucides, protéines, lipides | 0–100%, dépassé | S05, S10, S13 |
| Meal card | petit-déj, déj, dîner, snack | vide (+), rempli (liste items) | S05 |
| Food row | aliment, recette, plat perso | default, swipe delete | S05, S06, S09 |
| Search bar | — | vide, saisie, loading | S06, S12 |
| Camera view | barcode, photo | live, capturing, permission denied | S07, S08 |
| Portion picker | unité + quantité | — | S09, S10, S15 |
| Nutrition label | compact, complet | — | S10, S13 |
| Recipe card | grille, liste | — | S12 |
| Filter chip | — | on/off | S12 |
| Servings stepper | — | min 1 | S13, S15 |
| Bottom tab bar | 4 onglets | actif | global |
| Date switcher | jour ← → | aujourd'hui, passé | S05 |
| Toast / snackbar | succès, annuler | — | après log/suppression |
| Paywall sheet | — | — | S04 |
| Line chart | poids, kcal | empty | S18 |

## Inferred data model

```
User        id, email, sex, birth_date, height_cm, unit_system, created_at
            evidence: S02 questionnaire, source 1 onboarding
            confidence: high

Goal        id, user_id, type (lose|maintain|gain), target_weight_kg, kcal_per_day,
            carbs_pct, protein_pct, fat_pct, start_at
            evidence: S03, sources 2 & 7 (custom macro goals)
            confidence: high

Food        id, name, brand, barcode (nullable), source (off|custom|ai),
            kcal_100g, carbs_100g, protein_100g, fat_100g, fiber_100g, sugar_100g, salt_100g,
            created_by (nullable = base publique)
            evidence: sources 3 & 4 (per 100 g / per serving toggle), S11
            confidence: high

Serving     id, food_id, label ("whole, regular"), grams
            evidence: source 3 "whole, regular (150.0 g)"
            confidence: high

Recipe      id, owner_id (nullable = catalogue), title, photo_url, servings,
            prep_minutes, tags[] (vegan, low-carb...), steps (json[]), source_url (nullable)
            evidence: S13, S15, source 2 (filtres, cooking mode), source 10 (import URL)
            confidence: high (catalogue), medium (import)

RecipeIngredient  recipe_id, food_id, grams, raw_text (pour import)
            evidence: source 10 (matching ✓/✗)
            confidence: medium

DiaryEntry  id, user_id, date, meal (breakfast|lunch|dinner|snack),
            food_id | recipe_id, grams | servings, kcal (figé au log), macros (figés),
            photo_url (nullable), method (search|barcode|photo|manual)
            evidence: S05, S09
            confidence: high (champs figés = guess, mais nécessaire si la base change)

PhotoScan   id, user_id, photo_url, model, detected (json: [{label, grams, confidence}]),
            status (pending|confirmed|discarded), created_at
            evidence: source 9 (confirmer avant log)
            confidence: guess

WeightLog   id, user_id, date, kg      evidence: S18      confidence: high
WaterLog    id, user_id, date, ml      evidence: source 2  confidence: high
ShoppingItem id, user_id, food_id|text, grams, checked   evidence: source 2 "smart grocery list"  confidence: medium
Favorite    user_id, food_id|recipe_id                    confidence: guess
```

Relationships: User 1-n Goal, User 1-n DiaryEntry, DiaryEntry n-1 Food|Recipe, Food 1-n Serving, Recipe 1-n RecipeIngredient n-1 Food, User 1-n Recipe (plats perso), User 1-n PhotoScan 1-n DiaryEntry, User 1-n WeightLog.

## Feature matrix

See `features.csv`. Must: 16, should: 12, could: 8, skip: 5.

## Out of scope (cannot or should not be cloned)

- Base de 4M (YAZIO) / 20.5M (MFP) aliments : propriétaire → utiliser **Open Food Facts** (code-barres, ODbL) + CIQUAL/USDA pour les aliments bruts.
- Catalogue de 2 900 recettes YAZIO, photos, textes : contenu protégé → écrire/générer les tiens, ou démarrer sans catalogue (plats perso uniquement).
- Les 100M d'utilisateurs, avis, communauté.
- Partenariats (livraison de courses MFP, intégrations Garmin/Fitbit privées) → seulement Apple Health / Health Connect via API officielles.
- Marque, logo, couleurs, copy marketing, mascotte.
- Conseils médicaux / GLP-1 : zone réglementée, ne pas faire de promesse santé.

## Size

Screens 19, flows 7, entities 11. Hard parts :
1. **Estimation calories par photo** : identifier les aliments + estimer les grammes. Le plus simple et le plus fiable aujourd'hui = un LLM vision (ex. Claude) qui renvoie du JSON `[{label, grams, kcal}]`, puis l'utilisateur corrige (S09). Précision ±20–30 % au mieux : l'écran de correction est obligatoire, pas optionnel.
2. **Base aliments** : matcher le résultat IA et les ingrédients sur Open Food Facts/CIQUAL (qualité inégale, doublons, langues).
3. **Recettes → kcal** : calcul par portion, poids cuit vs cru, import URL (parsing schema.org/Recipe).
Autres : offline/sync du journal, caméra mobile, paiements in-app si vendu.

Size: **M** (quelques semaines) pour la slice journal + photo + plats perso. **L** si on ajoute catalogue de recettes, liste de courses, sync santé et abonnement.
