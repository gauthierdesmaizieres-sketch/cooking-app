# Backend

Stack : Supabase (Postgres + RLS, Auth, Storage, Edge Functions) + un modèle vision pour la photo : Gemini (par défaut, offre gratuite) ou Claude. Pas de paiement ni d'e-mail produit en v1 (voir architecture.md).

## Lancer en local

```bash
npx supabase start          # Docker ; applique supabase/migrations + seed.sql
cp .env.example .env.local  # valeurs : npx supabase status
cp supabase/functions/.env.example supabase/functions/.env   # mettre GEMINI_API_KEY (ou AI_PROVIDER=claude + ANTHROPIC_API_KEY)
npx supabase functions serve # recharge les fonctions avec le .env
npm run dev
```

E-mails locaux (lien de connexion) : http://127.0.0.1:54324

## Ce qui existe

| partie | où | état |
| --- | --- | --- |
| Schéma, index, RLS, bucket `photos` privé | `supabase/migrations/20261019000000_init.sql` | appliqué en local |
| Aliments de test (12) | `supabase/seed.sql` | utilisés par les tests e2e |
| Ciqual 2025 (3158 aliments, ANSES, Licence Ouverte) | `supabase/ciqual.sql`, généré par `python -I scripts/import_ciqual.py <xlsx> supabase/ciqual.sql` | chargé en local par `db reset` ; en production : `psql "$DB_URL" -f supabase/ciqual.sql` (rejouable : upsert sur le code Ciqual) |
| Connexion par lien e-mail (inscription = 1re connexion) | `src/screens/Login.jsx`, flux PKCE | testé en local |
| `scan-photo` : auth, chemin de la photo contrôlé, 30 scans/24 h, Gemini ou Claude en JSON strict, validation | `supabase/functions/scan-photo/` | testé de bout en bout avec Gemini (vraie photo → 3 aliments en 15 s → corrigés → journal) ; validation : 3 tests Deno |
| `delete-account` : photos puis compte, cascade sur toutes les tables | `supabase/functions/delete-account/` | testé : 0 utilisateur, 0 scan, 0 photo après |
| Couche de données | `src/data.js` (mêmes signatures que la version fictive) | testée : journal, recherche, upload |

Modèle (`AI_PROVIDER`) :
- `gemini` (défaut) : `gemini-3.6-flash` via l'API Interactions, gratuit avec quotas ; si Google répond « saturé » (503/429) ou ne répond pas en 55 s, nouvel essai sur `gemini-3.5-flash-lite`. Le 20/10/2026, `gemini-3.8-flash` était saturé en continu et l'offre gratuite répondait en 15 à 45 s. **Offre gratuite = Google peut utiliser les photos pour améliorer ses produits** : OK pour tester, passer en payant (Gemini ou Claude) avant d'ouvrir à de vrais utilisateurs (données de santé, RGPD).
- `claude` : `claude-opus-5-5`, effort `low`, repli côté serveur (`fallbacks: "default"`) si une image est refusée.
- `AI_MODEL` remplace le modèle par défaut du fournisseur choisi.

## Ce qui reste

- Google / Apple : il faut tes propres apps développeur (Google Cloud, Apple Developer), puis les activer dans Supabase.
- Production : créer le projet Supabase **région UE**, `npx supabase link`, `npx supabase db push`, `npx supabase functions deploy`, `npx supabase secrets set ANTHROPIC_API_KEY=…`. Vérifier que les sauvegardes quotidiennes sont actives.
- SMTP de production (Resend ou Postmark depuis ton domaine) : l'e-mail intégré de Supabase est limité à quelques envois par heure.
- Nettoyage quotidien des scans abandonnés (pg_cron), prévu dans architecture.md.
- Paiements : pas avant de décider de vendre.

## Checklist sécurité

- [x] secrets seulement en variables d'env, `.env*` ignorés par git, clé Anthropic uniquement côté fonction (jamais `VITE_`)
- [x] entrées validées côté serveur : `photo_path` (regex + appartient à l'utilisateur), taille ≤ 5 Mo, sortie du modèle bornée et recalculée (`validate.ts`)
- [x] autorisation sur chaque lecture/écriture : RLS, testée avec un 2e utilisateur (`supabase/tests/rls.sql` → `RLS OK`)
- [x] limite sur l'appel coûteux : 30 scans / 24 h / utilisateur ; limites d'auth : réglages par défaut de Supabase (`[auth.rate_limit]`)
- [ ] webhooks : aucun pour l'instant
- [x] uploads : bucket privé séparé, 5 Mo, JPEG/PNG/WebP uniquement, un dossier par utilisateur
- [x] pas de données perso dans les URL (le lien de connexion porte un code à usage unique, effacé par le client)
- [x] `npm audit` : 0 vulnérabilité
- [ ] politique de confidentialité : à écrire avant le lancement, avec les sous-traitants (Supabase, Google ou Anthropic pour les photos, hébergeur)
