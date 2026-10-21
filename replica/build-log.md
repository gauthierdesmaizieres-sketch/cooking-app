# Build log

| screen | date | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| shell | 2026-10-19 | done | routes S12–S19 sont des stubs ; pas encore PWA (vite-plugin-pwa) | — |
| S05 Journal | 2026-10-19 | done | modifier une entrée, copier un repas, eau | rien |
| S06 Ajouter | 2026-10-19 | partial | code-barres (S07), portion (S10), récents/favoris | — |
| S08 Scan photo | 2026-10-19 | partial | **l'analyse est simulée** (toujours riz/poulet/brocoli) ; vraie IA via fn/scan-photo dans /replica-backend ; redimensionnement de l'image avant upload | rien côté UI : l'input `capture` évite de gérer la caméra soi-même |
| S09 Correction | 2026-10-19 | partial | remplacer un aliment mal reconnu, ajouter un aliment oublié | — |

Vertical slice F01 (journal → photo → correction → log) : fonctionne de bout en bout sur données fictives (localStorage), testé à 390 px et 1440 px, sans erreur console.
Tests : `node --test src/lib.test.js` (6 tests : jours locaux, calcul kcal, totaux, macros, saisie grammes).
| backend | 2026-10-20 | partial | vraie analyse IA non testée (pas de clé ici) ; Google/Apple ; déploiement | téléchargement des images Docker de Supabase (erreurs TLS, relancé) |
| Login | 2026-10-20 | done | — | lien en PKCE pour ne pas casser les routes en #/ |
| S19 Profil | 2026-10-20 | partial | objectifs, unités, export | — |
| scan Gemini | 2026-10-20 | done | — | modèle par défaut saturé (503) → repli ; client_id n'était pas un uuid (la version fictive le cachait) ; erreur d'ajout au journal avalée → message ajouté |
| S10 Portion | 2026-10-21 | done | — | — |
| S11 Aliment perso | 2026-10-21 | done | photo de l'aliment | — |
| S07 Code-barres | 2026-10-21 | partial | scan caméra à valider sur un vrai téléphone (HTTPS requis hors localhost) ; wasm ZXing chargé depuis un CDN | index unique partiel incompatible avec l'upsert PostgREST (2e fois) |
| S06 Ajouter | 2026-10-21 | done | — | — |
| S12 Mes plats | 2026-10-21 | done | catalogue partagé (contenu à écrire) | — |
| S13 Détail plat | 2026-10-21 | done | — | barres de macros sans objectif trompeuses → texte |
| S14 Mode cuisine | 2026-10-21 | partial | minuteur par étape | — |
| S15 Éditer un plat | 2026-10-21 | done | créer un ingrédient manquant sans quitter l'éditeur | sauvegarde atomique via save_recipe pour ne pas perdre les ingrédients |
| S01–S03 Onboarding | 2026-10-22 | done | unités impériales ; recalcul auto quand le poids change (S18) | garde-fous santé (mineurs, IMC, plancher) ; tests e2e existants : comptes de test créés déjà « onboardés » |
| Journal : modifier une entrée | 2026-10-21 | done | — | — |
| S09 remplacer / ajouter | 2026-10-21 | done | — | — |
| Import Ciqual 2025 | 2026-10-21 | done | mise à jour annuelle manuelle | en-têtes Excel avec retours à la ligne ; recherche refaite par mots (3000 aliments) ; nettoyage e2e qui supprimait les comptes d'un autre worker |
