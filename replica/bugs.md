# Bugs

Résumé au 2026-10-20 : 5 bugs reproduits (S1 : 1, S2 : 2, S3 : 1, S4 : 1), 5 corrigés, 0 ouvert.
Suite : 25 e2e Playwright + 6 unit + 3 Deno + `supabase/tests/rls.sql`, tout vert.

### BUG-001 : l'ajout au journal après un scan échoue toujours

- Severity: S1 (parcours principal bloqué)
- Flow / case: F01 / F01-H2
- Screen: S09
- Build: 666c01a  Browser / device: Chromium, 390 px

Steps
1. Se connecter, Photographier mon assiette, choisir une photo, Analyser.
2. Sur « Vérifie le résultat », cliquer Ajouter au journal.

Expected: retour au journal avec les aliments.
Actual: rien ne se passe. Console : `22P02 invalid input syntax for type uuid: "<scan>:<item>"`.
Evidence: requête `POST /rest/v1/diary_entries` → 400.
Suspected cause: `client_id` construit comme `scanId:key`, alors que la colonne est un uuid. La couche de données fictive acceptait n'importe quelle chaîne.
Status: fixed in 8596e20 (client_id = clé uuid de l'aliment, stable pour un scan). Couvert par F01-H1, F01-E3, F01-E4.

### BUG-002 : erreur d'ajout au journal invisible

- Severity: S2
- Flow / case: F01 / F01-N4
- Screen: S09
- Build: 666c01a

Steps
1. Arriver sur « Vérifie le résultat », couper le réseau.
2. Cliquer Ajouter au journal.

Expected: message d'erreur, corrections gardées, nouvel essai possible.
Actual: bouton bloqué en chargement, aucune explication, promesse rejetée non gérée.
Evidence: `Uncaught (in promise)` dans la console.
Status: fixed in 8596e20 (try/catch, message, état gardé). Test F01-N4.

### BUG-003 : la recherche ne trouve pas un aliment tapé sans accent

- Severity: S3 (contournable en tapant l'accent)
- Flow / case: F03 / F03-E2
- Screen: S06
- Build: 8596e20

Steps
1. Ajouter → rechercher « pates ».

Expected: « Pâtes cuites ».
Actual: « Aucun aliment trouvé ».
Status: fixed in e7b34c0 (migration `20261020000000_search_unaccent.sql`). Test F03-E2.

### BUG-004 : l'écran « Regarde tes e-mails » n'a pas de titre principal

- Severity: S4 (accessibilité : axe `page-has-heading-one`)
- Flow / case: A / A-H1
- Screen: connexion
- Build: 8596e20

Steps
1. Entrer un e-mail, Recevoir le lien.

Expected: un `h1` pour les lecteurs d'écran.
Actual: le seul titre est un `h3`.
Status: fixed in e7b34c0 (`EmptyState` accepte `heading="h1"`). Test A-H1.

### BUG-005 : le scan photo échoue (délai dépassé) avec le modèle Gemini par défaut

- Severity: S2
- Flow / case: F01 / F01-H2
- Screen: S08
- Build: 666c01a

Steps
1. Analyser une vraie photo avec `AI_PROVIDER=gemini`.

Expected: résultat en moins d'une minute.
Actual: « L'analyse a échoué ». Ligne du scan : `TimeoutError: Signal timed out`. Appel direct : `gemini-3.8-flash` → 503 « high demand ».
Status: fixed in 8596e20 (défaut `gemini-3.6-flash`, repli sur `gemini-3.5-flash-lite` en cas de 503/429/délai). Vérifié à la main : 15 s.

## À vérifier (pas reproduit)

- Photos HEIC d'iPhone dans un navigateur qui ne sait pas les décoder : `createImageBitmap` échouerait → message « ne peut pas être lue ». À tester sur un vrai iPhone hors Safari.
- Les photos des scans abandonnés restent dans le stockage tant que le nettoyage quotidien (pg_cron) n'est pas écrit.
- Offre gratuite Gemini : temps de réponse de 15 à 45 s et quotas journaliers. À surveiller dès qu'il y a plusieurs utilisateurs.
- Après la suppression du compte, supabase-js appelle encore `/logout`, qui répond 403. Sans effet pour l'utilisateur, autorisé dans P-H2.

### BUG-006 : la recherche classe mal avec la vraie base

- Severity: S3
- Flow / case: F03 / F03-H1 sur Ciqual
- Steps: rechercher « poulet roti » avec les 3158 aliments Ciqual chargés.
- Expected: les poulets rôtis. Actual: « Rillettes de poulet » en 2e, les « Poulet, …, rôtie » absents (le nom ne contient pas « poulet roti » d'un seul tenant).
- Status: fixed (migration `20261023000000_search_words.sql`) : tous les mots doivent apparaître, tri par début de nom puis longueur, repli flou pour les fautes de frappe (« brocolli » → Brocoli).
