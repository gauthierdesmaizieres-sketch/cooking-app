# Components

Tokens : `tokens.json` → `tokens.css` (`node replica/design/gen-css.mjs`). Pas de Tailwind : l'architecture garde du CSS simple comme fitness-app, les composants n'utilisent que `var(--c-*)`, jamais de hex.
Icônes : **Lucide** (`lucide-react`, ISC). Police : **Inter** (OFL), auto-hébergée. Aucune icône, illustration, photo ou texte de YAZIO/MFP.
Mobile first : largeur max 480 px, gouttière 16 px, zone tactile min 44 px. Toutes les animations respectent `prefers-reduced-motion`.
Primitives codées dans `src/ui.jsx` + `src/ui.css`, vitrine sur `/?design`.

```
Button
  variants  primary (accent), secondary (surface + border), ghost (texte accent), danger
  sizes     sm 36px, md 44px, lg 52px (CTA plein largeur en bas des écrans)
  states    default, hover, active (scale .98), focus-visible (2px ring accent, offset 2), disabled (opacity .5), loading (spinner, label conservé)
  tokens    bg accent, text on-accent, radius pill, font base/600
  a11y      vrai <button>, aria-busy pendant loading, jamais désactivé sans raison visible
  used on   S01–S04, S09, S11, S13, S15, S16

IconButton
  variants  plain, filled (accent), on-image (fond overlay 50 %)
  sizes     44px fixe
  states    default, active, focus-visible, disabled
  a11y      aria-label obligatoire (ex. « Scanner un code-barres »)
  used on   S05 (+ repas, date ←→), S06 (barcode, photo), S07/S08 (torche, fermer)

CalorieRing
  variants  lg 200px (journal), sm 40px (carte repas)
  states    sous objectif (accent), atteint (success), dépassé (danger, chiffre « +120 »), vide (piste seule)
  tokens    piste ring-track, arc accent/success/danger, chiffre display, sous-texte text-muted
  a11y      role="img" + aria-label « 1240 kcal restantes sur 2000 » ; l'état ne dépend pas que de la couleur (texte « dépassé »)
  used on   S03, S05

MacroBar
  variants  carbs, protein, fat (couleur de rôle), compact (sans label)
  states    0–100 %, dépassé (barre pleine + valeur en danger)
  tokens    piste surface-sunken, remplissage carbs/protein/fat, radius pill, hauteur 6px
  a11y      <progress> natif ou role="progressbar" aria-valuenow/max, label « Protéines 62 / 120 g »
  used on   S05, S10, S13

MealCard
  variants  breakfast, lunch, dinner, snack
  states    vide (CTA « Ajouter »), rempli (liste FoodRow + total kcal), repliée
  tokens    surface, shadow card, radius lg, padding sp-4
  a11y      <section> avec titre h2, bouton + explicite « Ajouter au déjeuner »
  used on   S05

FoodRow
  variants  aliment, recette, plat perso, résultat IA (badge confiance)
  states    default, pressed, swipe → supprimer (+ bouton supprimer accessible au clavier), confiance basse (badge warning)
  tokens    label base, détail sm text-muted, kcal à droite base/600
  a11y      la ligne est un <button> ; action supprimer aussi dans un menu, pas seulement en swipe
  used on   S05, S06, S09, S13, S15

SearchField
  states    vide (placeholder), saisie (bouton effacer), loading (spinner), erreur réseau
  tokens    surface-sunken, radius pill, hauteur 44px, icône search text-muted
  a11y      <input type="search">, label caché visuellement, résultats annoncés via aria-live="polite"
  used on   S06, S12

TextField / NumberField
  states    default, focus (bordure accent 2px), erreur (bordure danger + message), disabled
  tokens    border-input 1px, radius md, hauteur 48px, unité en suffixe text-muted
  a11y      <label> visible, aria-describedby vers le message d'erreur, inputmode="decimal" pour les nombres
  used on   S02, S11, S15, S16, S18

PortionPicker
  parts     NumberField quantité + Select unité (g, portion, pièce…)
  states    default, valeur invalide (≤ 0), recalcul kcal en direct
  a11y      les deux champs labellisés, total kcal annoncé aria-live
  used on   S09, S10, S15

Stepper (servings / quantité)
  states    min atteint (− désactivé), max
  a11y      boutons « Diminuer / Augmenter les portions », valeur dans un <output>
  used on   S13, S15

Chip (filtre)
  states    off (surface + border), on (accent-soft + texte accent + coche), focus-visible
  a11y      <button aria-pressed>
  used on   S12

SegmentedTabs
  variants  2–4 segments (Récents / Favoris / Mes plats)
  a11y      role="tablist" + flèches clavier
  used on   S06

NutritionLabel
  variants  compact (kcal + 3 macros), complet (fibres, sucres, sel)
  tokens    lignes séparées par border, valeurs alignées à droite
  a11y      <table> avec en-têtes
  used on   S10, S13

Card / RecipeCard
  variants  card simple, recette (photo 4:3, titre, kcal/portion, temps)
  states    loading (squelette surface-sunken), sans photo (placeholder neutre)
  a11y      un seul lien par carte, alt de la photo = titre du plat
  used on   S12, S13

CameraView
  variants  barcode (cadre rectangulaire), photo (plein cadre + bouton déclencheur 72px)
  states    live, capture, traitement, permission refusée (explication + bouton réglages + alternative « choisir une photo »)
  a11y      fallback <input type="file" accept="image/*" capture="environment"> toujours disponible
  used on   S07, S08

BottomSheet
  states    ouvert, fermé, glissement
  tokens    surface, radius lg en haut, shadow pop, overlay 40 %
  a11y      <dialog> modal, focus piégé, Échap ferme, retour au déclencheur
  used on   S09, S10, ajout poids/eau

Toast
  variants  succès, erreur, avec « Annuler »
  a11y      role="status", reste 5 s, Annuler joignable au clavier
  used on   après log, suppression, scan raté

TabBar
  items     Journal, Recettes, Progrès, Profil (icônes Lucide + label)
  states    actif (accent), inactif (text-muted)
  tokens    hauteur 64px + safe-area-inset-bottom, surface, border en haut
  a11y      <nav> avec aria-current="page"
  used on   global

DateSwitcher
  states    aujourd'hui (label « Aujourd'hui »), passé, futur désactivé
  a11y      boutons « Jour précédent / suivant », date complète en aria-label
  used on   S05

EmptyState
  parts     icône Lucide 32px text-muted, titre lg, texte sm, CTA optionnel
  used on   S05 (jour vide), S06 (aucun résultat), S12, S17, S18

ProgressSteps (onboarding)
  a11y      « Étape 3 sur 7 » en texte
  used on   S02

LineChart
  states    vide (EmptyState), 1 point, n points
  tokens    ligne accent 2px, grille border
  a11y      tableau des valeurs en alternative
  used on   S18

PlanCard (paywall, plus tard)
  states    sélectionné (bordure accent 2px), non sélectionné
  note      prix et durée toujours visibles, bouton fermer visible dès l'ouverture (fix vs l'original)
  used on   S04
```
