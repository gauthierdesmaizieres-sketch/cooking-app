# Déploiement : Cooking App (usage perso, sur téléphone)

Cible : PWA installable sur le téléphone, servie en HTTPS (obligatoire pour la caméra).
- **Front** : GitHub Pages, dépôt public `cooking-app` (comme fitness-app), déployé par `.github/workflows/deploy.yml` à chaque push sur `main`.
- **Back** : un projet Supabase **séparé** de la base locale, région UE (Francfort), offre gratuite.
- URL prévue : `https://gauthierdesmaizieres-sketch.github.io/cooking-app/`

## Pré-vérifications (2026-10-21)

| check | résultat |
| --- | --- |
| e2e Playwright | 49/49 ✅ |
| unit (`npm test`) + Deno (fonctions) | 13/13 + 6/6 ✅ |
| `supabase/tests/rls.sql` (2e utilisateur) | RLS OK ✅ |
| build de production | ✅ (bundle 144 Ko gzip, au-dessus du seuil indicatif de 500 Ko non compressé) |
| PWA : manifeste + service worker | ✅ actif dans Chromium (bloqué seulement dans l'aperçu de l'app Claude) |
| parité | 66,7/100, indispensables 14/16 : scan caméra à valider sur téléphone (c'est le but), Google/Apple non nécessaire en perso |
| balayage des noms/domaines de l'original | propre (`replica/brand.json`) ✅ |
| bugs S1/S2 ouverts | aucun ✅ |
| page confidentialité | `public/privacy.html`, liée depuis la connexion et le profil ✅ |
| suppression de compte | testée (P-H2) ✅ |
| `npm audit` | 0 vulnérabilité ✅ |
| nom / marque | « Cooking App » provisoire, palette neutre : `/replica-brand` pas encore lancé. OK pour un usage perso, à faire avant toute ouverture publique |

## Étapes

### Toi (comptes, mots de passe)
1. **Supabase** : https://supabase.com → se connecter (GitHub possible) → New project : nom `cooking-app`, région **Central EU (Frankfurt)**, un mot de passe de base fort (garde-le dans ton gestionnaire). Donne-moi l'identifiant du projet (la partie `xxxx` de `https://supabase.com/dashboard/project/xxxx`), il n'est pas secret.
2. Dans un terminal, dans le dossier du projet :
   ```
   npx supabase login
   npx supabase link --project-ref <identifiant>
   npx supabase db push
   ```
   (`link` et `db push` demandent le mot de passe de la base : tape-le toi-même.)
3. **Dashboard Supabase → Authentication → URL Configuration** : Site URL = l'URL prévue ci-dessus ; Redirect URLs : ajouter la même.
4. Après ta première connexion sur le téléphone : **Authentication → Sign In / Providers → Email : désactiver « Allow new users to sign up »**. Le site est public : sans ça, n'importe qui pourrait créer un compte et consommer ton quota Gemini.

### Moi (une fois tes étapes faites, et seulement avec ton accord)
5. `npx supabase functions deploy` (scan-photo, barcode, delete-account) et `npx supabase secrets set --env-file supabase/functions/.env` (ta clé Gemini passe du fichier au serveur, sans s'afficher).
6. Créer le dépôt GitHub public `cooking-app`, fusionner `build/vertical-slice` dans `main`, pousser, renseigner les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (clé publique), activer Pages (source : GitHub Actions).
7. Vérifier le site en ligne : connexion, journal, recherche, code-barres, photo.

### Toi, sur le téléphone
8. Ouvrir l'URL dans Chrome (Android) ou Safari (iPhone) → menu → « Ajouter à l'écran d'accueil ». Tester la caméra : photo d'un plat, scan d'un code-barres.

## À surveiller la première semaine
- Quotas de l'offre gratuite Gemini (temps de réponse 15–45 s, refus « saturé »).
- Supabase gratuit : envoi d'e-mails de connexion limité à quelques-uns par heure (suffisant pour une personne) ; un projet inactif 7 jours est mis en pause (il se réveille depuis le dashboard).
- Le scan caméra du code-barres sur ton téléphone (jamais testé ailleurs que par saisie manuelle).

## Pas fait (volontairement)
Nom de domaine, monitoring/alertes, analytics, stores (Play/App Store) : inutiles pour un usage perso sur un seul téléphone.
