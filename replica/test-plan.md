# Test plan : Cooking App

Build : branche `build/vertical-slice` (résultats du 2026-10-22 : 47 e2e + 12 unit + 6 Deno + rls.sql, tout vert)  Date : 2026-10-20  Env : local (Vite :5174 + Supabase local), aliments seed
Périmètre : connexion, S05 journal, S06/S10 recherche + portion, S07 code-barres, S08/S09 scan photo, S11 aliment perso, S12–S15 plats, S19 profil. Onboarding inclus. Pas encore construits : F07 poids, S16 import d'URL, S17 courses.

Auto = Playwright (`e2e/`). L'IA est simulée dans les e2e (réponse fixe de `scan-photo`, ligne réelle en base) : l'appel Gemini réel est testé à la main (F01-H2).
Chaque spec échoue sur une erreur console, une réponse 5xx inattendue, et lance un scan d'accessibilité axe.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| A-H1 | connexion | happy | e-mail → lien reçu (mailpit) → ouvrir | journal du jour affiché | e2e | pass après fix BUG-004 |
| A-E1 | connexion | edge : e-mail invalide | taper « abc » | bouton désactivé | e2e | pass |
| A-E2 | connexion | edge : lien déjà utilisé | rouvrir le même lien après connexion + déconnexion | reste sur l'écran de connexion, pas de crash | e2e | pass |
| A-N1 | connexion | négatif : pas de session | ouvrir `#/diary` déconnecté | écran de connexion | e2e | pass |
| D-H1 | journal | happy : supprimer + annuler | ouvrir une entrée → supprimer → Annuler | entrée revient, total identique | e2e | pass |
| D-E1 | journal | edge : navigation jours | jour précédent, puis suivant | « Hier » puis « Aujourd'hui », suivant désactivé aujourd'hui | e2e | pass |
| D-E2 | journal | edge : 2e utilisateur | B ouvre son journal après que A a logué | B voit 0 entrée | e2e + `supabase/tests/rls.sql` | pass |
| D-E3 | journal | edge : 23:30 heure locale | jour calculé en local | même jour | unit (`lib.test.js`) | pass (unit) |
| F01-H1 | photo | happy | Photographier → image → Analyser → valider | 3 aliments au journal, toast, anneau mis à jour | e2e | pass |
| F01-H2 | photo | happy, IA réelle | vraie photo de plat avec Gemini | aliments plausibles en < 60 s | manuel | pass (manuel, Gemini, 15 s, 3 aliments) |
| F01-E1 | photo | edge : quantité vide | vider un champ grammes | message d'erreur, bouton désactivé | e2e | pass |
| F01-E2 | photo | edge : tout retirer | retirer chaque aliment | bouton désactivé, message | e2e | pass |
| F01-E3 | photo | edge : double clic sur Ajouter | 2 clics rapides | entrées créées une seule fois | e2e | pass |
| F01-E4 | photo | edge : retour arrière après ajout | history.back() | « déjà ajouté », pas de 2e ajout possible | e2e | pass |
| F01-E5 | photo | edge : rafraîchir sur la vérification | reload | mêmes aliments (relus en base) | e2e | pass |
| F01-E6 | photo | edge : libellé long + accents + emoji | IA renvoie 80 caractères avec « é » et 🍗 | pas de débordement, texte entier lisible | e2e | pass |
| F01-E7 | photo | edge : changer de repas | choisir Dîner avant d'ajouter | entrées sous Dîner | e2e | pass |
| F01-E8 | photo | edge : 2e utilisateur ouvre l'URL du scan de A | B ouvre `#/review/<id de A>` | « n'existe plus », rien d'affiché de A | e2e | pass |
| F01-N1 | photo | négatif : fichier non image | choisir un .txt | message « ne peut pas être lue » | e2e | pass |
| F01-N2 | photo | négatif : IA en échec | fonction renvoie 502 | message d'échec, bouton Analyser toujours là | e2e | pass |
| F01-N3 | photo | négatif : limite atteinte | fonction renvoie 429 `limit` | message de limite | e2e | pass |
| F01-N4 | photo | négatif : hors ligne à l'ajout | couper le réseau puis Ajouter | message d'erreur, corrections gardées | e2e | pass |
| F03-H1 | recherche | happy | « poulet » | « Poulet rôti » | e2e | pass |
| F03-E1 | recherche | edge : aucun résultat | « zzzz » | état vide | e2e | pass |
| F03-E2 | recherche | edge : sans accents | « pates » | « Pâtes cuites » trouvé | e2e | pass après fix BUG-003 |
| P-H1 | profil | happy : déconnexion | Se déconnecter | écran de connexion | e2e | pass |
| P-H2 | profil | happy : supprimer le compte | Supprimer → confirmer | écran de connexion ; plus d'utilisateur, d'entrées ni de photos | e2e | pass |
| X-1 | tous | clavier seul | parcours F01 au clavier | tout atteignable, focus visible | e2e | pass (e2e) |
| X-2 | tous | largeur 1440 px | journal et scan | colonne centrée, rien de cassé | manuel (fait au build) | pass (manuel au build) |
| F03-H2 | portion | happy | recherche « riz » → 180 g → ajouter | 234 kcal au journal | e2e | pass |
| F03-E3 | portion | edge : quantité 0 | saisir 0 | erreur, ajout désactivé | e2e | pass |
| F03-E4 | favoris/récents | happy | mettre en favori, ajouter, revenir | sections Favoris et Récents | e2e | pass |
| F04-H1 | aliment perso | happy | créer avec portion « 1 bol 50 g », loguer 2 bols | 100 g, 450 kcal | e2e | pass |
| F04-E1 | aliment perso | edge : macros > 100 g | 60+30+20 | refusé | e2e | pass |
| F02-H1 | code-barres | happy (saisie) | code connu | portion → journal (method barcode) | e2e | pass |
| F02-H2 | code-barres | happy, Open Food Facts réel | 3017620422003 | Nutella 539 kcal, mis en cache | manuel | pass |
| F02-E1 | code-barres | edge : inconnu | code absent | « Produit inconnu » → création préremplie | e2e | pass |
| F02-E2 | code-barres | edge : code mal formé | « 12ab » | refusé avant envoi | e2e | pass |
| F02-E3 | code-barres | caméra réelle sur téléphone | scanner un paquet | détection < 2 s | manuel | à faire (caméra bloquée dans l'aperçu) |
| F04-H2 | plat | happy | créer 3 portions riz+poulet, loguer 1,5 | 320 kcal/portion, 480 kcal au journal | e2e | pass |
| F04-E2 | plat | edge : vide | enregistrer sans rien | erreurs, rien en base | e2e | pass |
| F04-E3 | plat | edge : hors ligne à l'édition | couper le réseau, enregistrer | message, saisie gardée ; ensuite OK | e2e | pass |
| F04-E4 | plat | photo + suppression | ajouter photo, supprimer le plat | photo en stockage puis effacée | e2e | pass |
| F04-E5 | plat | edge : titre long + emoji | 70 caractères 🥔🧀 | pas de débordement | e2e | pass |
| F04-E6 | plat | edge : 2e utilisateur | ouvrir / éditer le plat de A | « n'existe plus » | e2e + rls.sql | pass |
| F05-H1 | cuisiner | happy | 6 portions → mode cuisine → étapes | quantités ×2, étapes au clavier | e2e | pass |
| F06-H1 | onboarding | happy | perdre, homme 35 ans 180 cm 80→75 kg, actif | ~2220 kcal, 40/30/30, date cible ; journal sur cet objectif ; poids du jour enregistré | e2e | pass |
| F06-H2 | objectifs | modifier depuis le profil | garder → prendre, cible 85 kg | champs préremplis ; ancien objectif clos, nouveau actif | e2e | pass |
| F06-E1 | onboarding | edge : étapes vides | Continuer sans rien | erreurs par étape, on reste sur l'étape | e2e | pass |
| F06-E2 | onboarding | edge : mineur | 15 ans + perdre du poids | refusé, message « 18 ans » | e2e | pass |
| F06-E3 | onboarding | edge : cible trop basse | 165 cm, cible 45 kg | refusé, minimum 51 kg indiqué | e2e | pass |
| F06-E4 | onboarding | edge : plancher | femme 150 cm 50 kg sédentaire | 1200 kcal + message | e2e | pass |
| F06-E5 | onboarding | clavier | Tab, Espace, flèches | choix au clavier | e2e | pass |
| F06-M1 | onboarding | calcul vérifié à la main | femme 34 ans 168 cm 64→60 kg, peu active | 1370 kcal, dépense 1869, décembre 2026 | manuel | pass |
