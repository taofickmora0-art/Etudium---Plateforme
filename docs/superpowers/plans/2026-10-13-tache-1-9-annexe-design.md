# Tâche 1.9 — Annexe design : Mes formations, Favoris, Recherche

> Valeurs relevées dans les maquettes du design de référence. Le plan (`2026-10-13-tache-1-9-mes-formations-favoris-recherche.md`) dit ce qui est retenu au lot 1 ; en cas de conflit, le plan et la spec l’emportent.


Sources (dossier `project/`, tailles d’aperçu lues dans `canvas.json`) :
- `NdMesFormations.dc.html` (1440×1146, planche « Mes formations ») ; `NdMesFormationsMenu.dc.html` (1440×1146, « Mes formations · menu du profil ouvert ») ; `NdMobFormations.dc.html` (390×844, « Téléphone · mes formations »)
- `NdFavoris.dc.html` (1440×977, « Favoris ») ; `NdFavorisVide.dc.html` (1440×977, « Favoris · aucun favori »)
- `NdRecherche.dc.html` (1440×1119, « Recherche ») ; `NdRechercheVide.dc.html` (1440×996, « Recherche · aucun résultat »)
- Aucune maquette téléphone pour Favoris ni pour Recherche.

Valeurs copiées des styles inline. Aucune règle `@media`, aucun `position: sticky`, aucun `clamp()` dans ces sept fichiers : le responsive passe uniquement par les grilles `auto-fill` et `flex-wrap`.
Texte : apostrophes typographiques `’` partout (d’un cœur, d’une formation, d’Excel, L’intelligence, l’IA, l’orthographe, l’université) — aucune apostrophe droite dans le texte affiché. Guillemets `« »` avec des **espaces normales** (pas d’insécable) dans « excel », « zotéro » et « Maîtriser Microsoft Excel ». Autres caractères : `·` (U+00B7) séparateur, `…` (U+2026) dans le placeholder, `+` dans « +128 inscrits ». Espace avant `:` et `?` = espace normale.

---

## 0. Abréviations

### 0.1 Reprises des fiches Catalogue (extraction-13 §0) et Leçon (extraction-15 §0) — valeurs identiques, rappelées pour que cette fiche se suffise
- `FOCUS` = style-focus-visible `outline: 2px solid #0B18C9; outline-offset: 2px`
- `FONT` = `font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif` (Inter 400/500/600/700) ; `-webkit-font-smoothing: antialiased` — CSS global : `body{margin:0}` `a{color:#0B18C9}` `a:hover{color:#08149F}` `::placeholder{color:#757F94}`
- `BTN-PRIMARY` = inline-flex; align-items center; justify-content center; gap 8px; box-sizing border-box; **height 48px; padding 0 18px; border-radius 14px; font-size 16px**; background #0B18C9; color #FFFFFF; border 0; font-family inherit; font-weight 500; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #08149F` — FOCUS (app : `Button variant="principal" size="lg"`)
- `BTN-PRIMARY-MD` = idem BTN-PRIMARY au gabarit **height 42px; padding 0 15px; border-radius 12px; font-size 14px** (app : `Button principal md`)
- `BTN-SECONDARY` = inline-flex; center/center; gap 8px; box-sizing border-box; height 42px; padding 0 15px; border-radius 12px; font-size 14px; background #FFFFFF; color #232326; border 1px solid #E3E8F3; font-family inherit; font-weight 500; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #F2F6FD` — FOCUS (app : `Button contour md`)
- `BTN-TONAL` = idem BTN-PRIMARY-MD mais background #E9EFFB; color #232326 — hover `background: #DEE6F6` — FOCUS (app : `Button gris md`)
- `BADGE` = display inline-flex; align-items center; gap 5px; padding 3px 8px 4px; border-radius 4px; font-size 12px; line-height 17px; font-weight 500; white-space nowrap ; couleurs utilisées ici :
  - neutre — « Verrouillée » (avec CADENAS 13px) et **compteurs de groupe « 1 », « 4 »** (sans icône) : bg #E5EBF7, color #4A546B (app : `Tag tone="verrouillee"` pour « Verrouillée » — il ajoute seul le cadenas 13px — et `Tag tone="enAttente"` pour les compteurs, sinon le cadenas apparaîtrait)
  - vert — « Terminée », **nouveau libellé** « Actif » : bg #DDF3E4, color #17663A (app : `Tag valide` / `reussi` / `gratuit`)
  - bleu — « Académique », « Nouveau » : bg #DDE1FF, color #0B18C9 (app : `Tag academique` / `nouveau`)
  - ambre — « Populaire » : bg #FBEFD0, color #8A5A00 (app : `Tag populaire`)
- `CHIP-FILTRE` (bouton bascule `aria-pressed`) = height 42px; padding 0 15px 1px; border-radius 12px; font-family inherit; font-size 14px; font-weight 500; letter-spacing -0.1px; cursor pointer; white-space nowrap; border 1px solid {bd}; background {bg}; color {fg} — FOCUS — **pas de hover déclaré**
  - actif : bg #EEF0FF, bd #C2C8FF, fg #0B18C9 ; inactif : bg #FFFFFF, bd #E3E8F3, fg #232326 (valeurs du script de la maquette)
- `CHAMP` = box-sizing border-box; width 100%; height 48px; padding 0 14px; border 1px solid #D2D9E8; border-radius 12px; background #FFFFFF; font-family inherit; font-size 15px; color #232326; outline none — style-focus `border-color: #0B18C9; box-shadow: 0 0 0 3px rgba(11, 24, 201, 0.14)`
- `DOT` = span aria-hidden; width 3px; height 3px; border-radius 50%; background #667085
- `PROGRESS` = div role="progressbar" aria-label aria-valuenow aria-valuemin="0" aria-valuemax="100" ; piste height 8px; border-radius 999px; background #D6DDEC; overflow hidden ; remplissage div width N%; height 100%; border-radius 999px; background #0B18C9 (app : `ProgressBar`)
- `TUILE(n, r)` = span flex none; display flex; align-items center; justify-content center; width n; height n; border-radius r ; + background / color (app : `IconTile` pour 40/44)
- `LIGNE-LISTE` = display flex; align-items center; gap 14px; padding 14px 4px; min-height 48px; color inherit; text-decoration none ; en lien : hover `background: #F2F6FD` + FOCUS
- `TEXTES-LIGNE` = span flex 1; min-width 0; display flex; flex-direction column; gap 2px → titre span font-size 15px; line-height 22px; font-weight 500; color #1D1D1F + sous-titre span font-size 13px; line-height 20px; color #667085
- `SÉPARATEUR` = div height 1px; background #EAEEF7
- `PILE-{BLEU|VIOLET|ORANGE}` = illustration maison 48×48 (3 losanges empilés, voir extraction-13 §7) : Académique = bleu, Digital = violet, Business = orange — svg display block; flex-shrink 0; margin-left 4px (app : `CourseIllustration`)
- `SEG-TABS`, `NAV-ITEM`, `SURTITRE`, `TEXTAREA`, `RESSOURCE` : **non utilisés** dans ces maquettes.

### 0.2 Nouvelles abréviations
- `TITRE-PAGE` (en-tête de page connectée, identique à NdCatalogue) = div display flex; flex-wrap wrap; align-items flex-end; justify-content space-between; gap 16px → div min-width 0; flex 1 1 320px →
  - h1 : margin 0; font-size 32px; line-height 40px; font-weight 500; letter-spacing -0.01em; color #262628; text-wrap balance
  - p : margin 10px 0 0; font-size 16px; line-height 24px; color #232326; text-wrap pretty
  - (aucun bouton ni compteur dans la colonne droite de cet en-tête, sur les trois pages)
- `TRAIT-PAGE` = div height 1px; margin-top 20px; background #DBE0EB
- `ZONE-CONTENU` = div margin-top 32px (enveloppe de tout ce qui suit le trait)
- `GRILLE-3` = display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(232px, calc((100% - 40px) / 3))), 1fr)); gap 20px → 3 colonnes max (313px chacune à 1440 : contenu du main 979px) ; 2 colonnes sous 736px de contenu ; 1 colonne sous 484px.
- `CARTE` (coque commune — app : `CardShell`) = a : color inherit; text-decoration none; box-sizing border-box; display flex; flex-direction column; padding 22px 19px 17px; border 1px solid #EAEEF7; border-radius 16px; background #FFFFFF; min-width 0 — hover `border-color: #D2D9E8` — FOCUS
  - div haut : display flex; align-items flex-start; justify-content space-between; gap 8px → visuel 48px à gauche [+ BADGE à droite]
  - titre (h2 ou h3) title="{titre complet}" : margin 21px 0 0; font-size 16px; line-height 24px; font-weight 600; color #1D1D1F; white-space nowrap; overflow hidden; text-overflow ellipsis
  - p description : margin 11px 0 0; font-size 12px; line-height 20px; height 40px; overflow hidden; color #667085 (2 lignes, coupées)
  - puis le « bas » selon la variante ci-dessous.
- `CARTE-PROGRESSION` (formation suivie — app : `CourseCard`) = CARTE (visuel PILE, titre **h2**) + bas :
  - PROGRESS aria-label="Progression" avec **margin 17px 0 0 -1px**
  - div méta : display flex; align-items center; gap 7px; margin-top 8px; font-size 12px; line-height 18px; color #667085 (**pas de flex-wrap**) → span « N % terminé » · DOT · span display flex; align-items center; gap 4px → HORLOGE 18px (margin 0 -1.5px) + span {temps}
  - Hauteur rendue : 236px.
- `CARTE-CATALOGUE` (formation non suivie — app : `CatalogCard`, = « carte connectée » d’extraction-13 §3) = CARTE (visuel PILE + BADGE statut optionnel, titre **h2**) + bas : div trait height 1px; margin-top 16px; background #EAEEF7 + div méta display flex; flex-wrap wrap; align-items center; gap 7px; font-size 12px; line-height 18px; color #667085; margin-top 12px → span (flex; center; gap 4px) ÉTOILE 16px (margin 0 -1px) + « note (avis) » · DOT · span (flex; center; gap 4px) HORLOGE 18px (margin 0 -1.5px) + durée · DOT · span niveau. Hauteur 232px.
- `CARTE-TUILE` (résultat parcours / session live) = CARTE avec **flex 1** ajouté sur le a (s’étire à la hauteur de la cellule), visuel = TUILE(48px, 14px) + icône 22px au lieu de la PILE, titre **h3** (mêmes styles que le h2 de CARTE). Bas selon le type (§6.5).
- `EN-TÊTE-GROUPE` (titre d’un groupe de résultats) = div display flex; flex-wrap wrap; align-items center; justify-content space-between; gap 6px 12px
  - div gauche : display flex; flex-wrap wrap; align-items center; gap 10px → h2 : margin 0; font-size 20px; line-height 28px; font-weight 600; color #1D1D1F + [BADGE neutre = nombre de résultats]
  - [option] LIEN-ACTION à droite
- `GROUPE` = section : display flex; flex-direction column; gap 14px; min-width 0 → EN-TÊTE-GROUPE puis contenu
- `LIEN-ACTION` = a : color #0B18C9; font-size 14px; line-height 22px; font-weight 500; text-decoration none — hover `text-decoration: underline` — **pas de focus-visible déclaré**
- `BTN-ICON-CONTOUR` (bouton cœur des favoris) = button type="button" : display flex; align-items center; justify-content center; width 42px; height 42px; padding 0; border 1px solid #E3E8F3; border-radius 12px; background #FFFFFF; cursor pointer — hover `background: #F2F6FD` — FOCUS (app : `IconButton variant="contour" size="md"` — identique)
- `BTN-ICON-SM` (effacer la recherche) = flex none; display inline-flex; align-items center; justify-content center; width 34px; height 34px; padding 0; border 0; border-radius 10px; background transparent; color #232326; cursor pointer; text-decoration none — hover `background: #E9EFFB` — FOCUS (app : `IconButton variant="discret" size="sm"`)
- `ÉTAT-VIDE` (= extraction-13 §2.5) = div display flex; flex-direction column; align-items center; gap 6px; padding 48px 24px; text-align center →
  - TUILE(56px, 16px) background #E9EFFB; color #232326 → icône 26px
  - span titre : margin-top 10px; font-size 18px; line-height 26px; font-weight 600; color #1D1D1F
  - span texte : max-width 420px; font-size 14px; line-height 22px; color #667085; text-wrap pretty
  - div actions : margin-top 14px; display flex; flex-wrap wrap; justify-content center; gap 8px
  - (app : `EmptyState` — mais le composant de l’app est **toujours encadré** (bordure #EAEEF7, rayon 16) et son titre est un h3 : voir §5 et §7 pour les deux variantes)
- `DIALOGUE` (même gabarit que « Se déconnecter ? » du shell — app : `ConfirmDialog` / `Dialog`) =
  - voile : div position fixed; inset 0; z-index 50; display flex; align-items center; justify-content center; padding 20px; background rgba(29, 29, 31, 0.5); overflow-y auto
  - boîte : div role="dialog" aria-modal="true" aria-labelledby="{id du h2}" : position relative; box-sizing border-box; width 440px; max-width 100%; padding 28px; border-radius 24px; background #FFFFFF; box-shadow 0 16px 40px rgba(20, 20, 30, 0.14), 0 2px 6px rgba(20, 20, 30, 0.06)
    - button type="button" aria-label="Fermer" : position absolute; top 16px; right 16px; display flex; center/center; width 36px; height 36px; padding 0; border 0; border-radius 10px; background transparent; color #667085; cursor pointer — hover `background: #E9EFFB` — FOCUS → CROIX 18px
    - TUILE(48px, 14px) background #E5EBF7; color #4A546B; margin-bottom 18px → icône 22px (app : `iconTone="neutre"`)
    - h2 : margin 0; padding-right 0px; font-size 20px; line-height 28px; font-weight 600; color #1D1D1F; text-wrap balance
    - p : margin 8px 0 0; font-size 14px; line-height 22px; color #667085; text-wrap pretty
    - div actions : display flex; flex-wrap wrap; justify-content flex-end; gap 8px; margin-top 24px → BTN-SECONDARY « Annuler » puis bouton de confirmation
- `BANDEAU-INFO` = div role="status" : display flex; flex-wrap wrap; align-items center; gap 12px; padding 14px 16px; border-radius 16px; background #DDE1FF (pas de bordure)
  - span flex none; color #0B18C9 → icône 22px
  - span texte : flex 1 1 240px; min-width 0; font-size 14px; line-height 22px; color #1D1D1F
  - LIEN-ACTION à la fin de la ligne

### 0.3 Correspondance avec les composants existants de l’app
| Élément maquette | Composant app | Écart à traiter |
|---|---|---|
| CARTE-PROGRESSION | `CourseCard` (`CardShell` + `ProgressBar` + `ProgressMeta`) | aucun (état `verrouillee` → BADGE « Verrouillée » automatique ; voir écart bureau §12.1) ; le titre doit sortir en **h2** (`titleAs="h2"` à ajouter à `CourseCard`, `CardShell` l’accepte déjà) |
| CARTE-CATALOGUE | `CatalogCard` | aucun (titre h2) |
| CARTE-TUILE (parcours, session) | — | **nouveau** : `CardShell` n’accepte qu’une PILE ; prévoir un visuel `IconTile` 48/14 (`IconTile` n’a que les tailles 40 et 44 et les tons neutre / blanc / reussite / attention : ajouter la taille 48 et un ton bleu #DDE1FF/#0B18C9) et `flex: 1` |
| BADGE | `Tag` | libellé « Actif » = ton vert existant (`valide`) ; compteur de groupe = ton **neutre sans icône** (`enAttente`), pas `compteur` (bleu) |
| CHIP-FILTRE ×5 | `FilterChips` | téléphone : rangée non repliée, défilante, chips 44px (comme le catalogue téléphone) |
| Recherche (champ) | `SearchInput` | maquette : bouton « Effacer » à droite dans le champ (padding-right 48px) ; aucun nom accessible dans la maquette (à ajouter) |
| ÉTAT-VIDE | `EmptyState` | Favoris vide = **sans cadre**, padding 72px 24px (variante à ajouter) ; Recherche vide = encadré (= composant actuel, titre h3 ; maquette : span) |
| DIALOGUE « Retirer des favoris ? » | `ConfirmDialog` (`tone="neutre"`, `icon={FavouriteIcon}`, `iconTone="neutre"`) | aucun ; bouton de confirmation bleu (pas rouge) |
| BTN-ICON-CONTOUR (cœur) | `IconButton variant="contour" size="md"` | l’icône est un **cœur plein** (Phosphor, viewBox 256) : `IconButton` ne prend qu’une icône Hugeicons → ajouter un cœur plein sur le modèle de `FilledIcon` (`TopBarIcons.tsx`) |
| Menu du profil (NdMesFormationsMenu) | `ProfileMenu` (shell, déjà construit) | rien à faire |
| `SegmentedTabs`, `SortMenu`, `SearchSuggestions` | — | **non utilisés** par ces maquettes (aucun onglet, aucun tri, aucune liste de suggestions) |

---

## 1. Cadre (shell) — ce que ces pages changent

### 1.1 Bureau
- Header, conteneur #E9EFFB, barre latérale et `main` : **identiques** aux autres pages connectées (main = flex 999 1 560px; min-width 0; box-sizing border-box; margin 15px 20px 20px 0; padding 32px; border-radius 28px; background #FFFFFF). Le bouton « Rechercher » du header reste un lien (vers NdRecherche) dans tous les cas, sans état actif.
- Seul changement : le lien actif de la barre latérale (`aria-current="page"` + background #FFFFFF; box-shadow 0 1px 2px rgba(20, 20, 30, 0.08); color #0B18C9 ; icône colorée #0B18C9 ; plus de hover) :
  - NdMesFormations / NdMesFormationsMenu → « Mes formations » (icône CourseIcon)
  - NdFavoris / NdFavorisVide → « Favoris » (icône FavouriteIcon)
  - NdRecherche / NdRechercheVide → **aucun** lien actif (ni dans la barre latérale, ni le bouton « Rechercher » du header)
- Largeurs à 1440 : conteneur 1400 ; barre latérale 337 ; main 1043 (contenu 979).

### 1.2 Téléphone (NdMobFormations)
- Racine, panneau blanc (margin 0 8px; border-radius 28px 28px 0 0) et barre du bas : identiques au shell mobile.
- **Header** : logo 48×49 (→ NdMobAccueil) + span titre font-size 18px; line-height 26px; font-weight 600; color #1D1D1F; ellipsis → « Mes formations » ; à droite (div flex; gap 8px) deux liens-icônes 48×48 (border-radius 14px; background #E9EFFB; color #232326; hover #DEE6F6; FOCUS) :
  - aria-label="Ajouter une formation" → NdMobCatalogue — icône PLUS 20px (trait 1.5)
  - aria-label="Notifications" → NdMobNotifications — icône CLOCHE 20px
  - (pas de pastille « série 8 » ici, contrairement à NdMobCatalogue ; pas de loupe). **Le shell construit** (`AppHeader`) affiche sur téléphone logo + loupe + série + cloche et **aucun titre de page** : écart à arbitrer (§12.6).
- Barre du bas : onglet « Formations » actif (`aria-current="page"`, href NdMobFormations).
- Zone qui défile : div flex 1; min-height 0; overflow-y auto; padding 20px 16px 20px (largeur utile 342px).

### 1.3 Variante NdMesFormationsMenu
- Seules différences avec NdMesFormations : titre du document et état initial `ov: "menu"` → le **menu du profil** du header est ouvert. Contenu de la page identique (filtre « Toutes »). Détail du menu en §8.

---

## 2. NdMesFormations — bureau (contenu du `main`)

### 2.1 Pile
1. TITRE-PAGE
2. div margin-top 21px → groupe de filtres (§2.3)
3. TRAIT-PAGE
4. ZONE-CONTENU → GRILLE-3 de CARTE-PROGRESSION (§2.4), une grille différente par filtre (`sc-if`)
- Absents : champ de recherche, bouton de tri, compteur (« 8 formations »), bouton « Continuer », sous-titres de section.

### 2.2 En-tête
- h1 « Mes formations »
- p « Formations de vos parcours et formations complémentaires achetées. »

### 2.3 Filtres
- div role="group" aria-label="Filtrer mes formations" : display flex; flex-wrap wrap; gap 8px
- CHIP-FILTRE × 5 (button type="button" aria-pressed, clic = sélection exclusive), **sans compteur dans le libellé** :
  « Toutes » (**actif par défaut**) | « En cours » | « Terminées » | « Verrouillées » | « Favoris »
- Pas de compteur à droite (contrairement au catalogue connecté).

### 2.4 Carte (CARTE-PROGRESSION) — anatomie et cible
- Lien = **la carte entière** (un seul `a`, aucun élément interactif à l’intérieur).
- Cible : NdLecon (reprendre là où on en est) pour toutes les cartes, **y compris** les terminées (100 %) et non commencées (0 %) ; la carte verrouillée (accès expiré) → **NdAbonnement**.
- Visuel : PILE du parcours seule ; **aucun BADGE** sur le bureau (ni parcours, ni « Verrouillée », ni « Terminé », ni « Nouveau »), aucun bouton cœur.
- Progression : PROGRESS (aria-label « Progression ») + méta « N % terminé » · HORLOGE + temps. Le temps prend trois formes : « X restantes » (en cours / non commencée), « X suivies » (terminée), « Accès expiré » (verrouillée — l’horloge reste affichée devant).

### 2.5 Données et appartenance aux filtres
| # | Titre (= `title` du h2) | Description | Pile | % | Temps | Cible | Toutes | En cours | Terminées | Verrouillées | Favoris |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Maîtriser Microsoft Excel | Formules, tableaux croisés dynamiques et graphiques pour analyser vos données. | bleu | 68 | 2 h restantes | NdLecon | ✓ | ✓ | | | ✓ |
| 2 | Microsoft Word pour vos travaux universitaires | Styles, sommaire automatique et mise en page du mémoire, étape par étape. | bleu | 100 | 4 h 10 suivies | NdLecon | ✓ | | ✓ | | |
| 3 | Zotero : gérer ses références | Collectez vos sources et générez citations et bibliographie sans erreur. | bleu | 100 | 2 h 20 suivies | NdLecon | ✓ | | ✓ | | |
| 4 | PowerPoint : réussir sa soutenance | Structurez vos diapositives et présentez avec assurance le jour de la soutenance. | bleu | 72 | 55 min restantes | NdLecon | ✓ | ✓ | | | |
| 5 | Méthodologie du mémoire | De la problématique à la rédaction : la méthode pour avancer sans vous perdre. | bleu | 0 | 7 h 45 restantes | NdLecon | ✓ | | | | |
| 6 | Canva, de débutant à expert | Créez affiches, présentations et visuels soignés, même sans base en design. | violet | 20 | 4 h 10 restantes | NdLecon | ✓ | ✓ | | | |
| 7 | L’intelligence artificielle au service de vos études | Utilisez l’IA pour réviser, résumer et rédiger, en gardant un regard critique. | violet | 0 | 3 h 30 restantes | NdLecon | ✓ | | | | |
| 8 | Marketing digital pour débutants | Les bases pour trouver vos premiers clients en ligne : réseaux, contenu, publicité. | orange | 35 | Accès expiré | **NdAbonnement** | ✓ | | | ✓ | |

- Ordre d’affichage = ordre du catalogue (parcours puis rang), pas l’activité récente.
- Les formations à 0 % n’apparaissent que dans « Toutes » (pas de filtre « À commencer »).
- Aucun état vide par filtre n’est maquetté (tous les filtres ont au moins une carte).

### 2.6 Responsive (bureau)
- GRILLE-3 : 3 colonnes (313px à 1440) → 2 → 1 selon §0.2. Méta des cartes sans retour à la ligne (`nowrap` implicite : pas de flex-wrap).
- Filtres : flex-wrap (les chips passent à la ligne).

---

## 3. NdMobFormations — téléphone (zone qui défile)

- div : display flex; flex-direction column; gap **14px**; min-width 0
  1. Filtres : div role="group" aria-label="Filtrer mes formations" : display flex; gap 8px; **flex-wrap nowrap** (déclaré wrap puis surchargé); overflow-x auto; margin 0 -16px; padding 0 16px; scrollbar-width none (rangée défilante bord à bord) → CHIP-FILTRE + flex none + **height 44px** × 5 : mêmes libellés et même défaut que le bureau.
  2. div (sans style) → une liste par filtre (`sc-if`) : div display flex; flex-direction column; gap 10px; min-width 0 → CARTE-PROGRESSION pleine largeur (342px), mêmes données et mêmes filtres que §2.5.
- Différences de carte avec le bureau :
  - cibles → **NdMobLecon** (au lieu de NdLecon) ; carte verrouillée → NdAbonnement (page bureau).
  - carte verrouillée : **BADGE neutre « Verrouillée »** dans la ligne haute, à droite (CADENAS 13px #4A546B + texte, gap 5px) — absent au bureau.
- Absents sur téléphone : h1, sous-titre, TRAIT-PAGE.

---

## 4. NdFavoris — bureau (contenu du `main`)

### 4.1 Pile
1. TITRE-PAGE : h1 « Favoris » + p « Les formations que vous avez marquées d’un cœur, pour les retrouver rapidement. »
2. TRAIT-PAGE (directement sous l’en-tête : pas de filtres, pas de compteur, pas de tri)
3. ZONE-CONTENU → div display flex; flex-direction column; gap 24px; min-width 0
   - GRILLE-3 de cartes favorites (§4.2) — une seule carte dans la maquette
   - BANDEAU-INFO (§4.3)

### 4.2 Carte favorite (carte + bouton cœur superposé)
- Cellule : div position relative; display flex; flex-direction column; min-width 0
  - a CARTE-PROGRESSION → NdLecon (identique à « Mes formations » : PILE bleue, h2 « Maîtriser Microsoft Excel », description, 68 %, « 2 h restantes » ; aucun badge)
  - button type="button" **frère** du lien (pas imbriqué) : BTN-ICON-CONTOUR + position absolute; top 16px; right 16px → CŒUR-PLEIN 20px color #232326
    - aria-label="Retirer Maîtriser Microsoft Excel des favoris" (modèle : « Retirer {titre} des favoris »)
    - **pas d’`aria-pressed`** ; un seul état maquetté (favori) ; clic → ouvre le dialogue §4.4.
    - Position : coin haut droit de la carte (x 255→297, y 16→58 dans une carte de 313px), là où se place le BADGE dans les autres cartes → collision si la carte porte un badge (§12.3).

### 4.3 Bandeau d’aide (sous la grille)
- BANDEAU-INFO role="status" → CŒUR 22px #0B18C9 · « Touchez le cœur d’une formation pour la retrouver ici. » · LIEN-ACTION « Parcourir le catalogue » → NdCatalogue
- Affiché alors que la liste n’est pas vide (aide permanente).

### 4.4 Dialogue « Retirer des favoris ? » (état `ov = "retirer"`)
- DIALOGUE, aria-labelledby → h2 :
  - TUILE neutre 48/14 → CŒUR 22px (contour, #4A546B)
  - h2 « Retirer des favoris ? »
  - p « « Maîtriser Microsoft Excel » ne figurera plus dans vos favoris. Votre progression ne change pas. » (modèle : « « {titre} » ne figurera plus dans vos favoris. Votre progression ne change pas. »)
  - actions : button BTN-SECONDARY → span « Annuler » ; button **BTN-PRIMARY-MD** (bleu, pas rouge) → span « Retirer »
- Dans la maquette, « Fermer », « Annuler » et « Retirer » ferment seulement le dialogue (aucun retrait simulé, pas de toast, pas d’annulation).

---

## 5. NdFavorisVide — bureau

- Identique à NdFavoris jusqu’à ZONE-CONTENU (h1, sous-titre, TRAIT-PAGE, lien « Favoris » actif).
- ZONE-CONTENU → ÉTAT-VIDE **sans cadre** (pas de bordure, pas de fond) avec padding surchargé **72px 24px** (déclaré 48px 24px puis 72px 24px : retenir 72) :
  - TUILE 56/16 #E9EFFB → CŒUR 26px #232326 (contour)
  - titre « Aucun favori pour le moment »
  - texte « Touchez le cœur d’une formation pour la retrouver ici. »
  - action : a → NdCatalogue : **BTN-PRIMARY-MD** → span « Parcourir le catalogue »
- Pas de BANDEAU-INFO dans cet état.

---

## 6. NdRecherche — bureau (contenu du `main`)

### 6.1 Pile
1. TITRE-PAGE : h1 « Recherche » + p « Formations, parcours, leçons et sessions live. »
2. div margin-top 21px → formulaire (§6.2)
3. TRAIT-PAGE
4. ZONE-CONTENU → div display flex; flex-direction column; gap **32px**; min-width 0 :
   - p compteur (§6.3)
   - GRILLE-3 contenant **trois GROUPE** côte à côte : « Formations », « Parcours », « Sessions live » (une carte chacun)
   - GROUPE « Leçons » pleine largeur, hors grille (§6.6)

### 6.2 Champ de recherche
- div role="search" : display flex; flex-wrap wrap; gap 8px; **max-width 720px**
  - div : display flex; flex-direction column; gap 6px; min-width 0; flex 1 1 280px (pas de label visible)
    - span position relative; display block
      - span icône : position absolute; left 14px; top 14px; color #667085; pointer-events none → LOUPE 20px
      - input id="f8" **type="text"** readonly (maquette statique) value « excel » placeholder « Une formation, un parcours, une ressource… » : CHAMP + padding-left 44px; **padding-right 48px** — **aucun label, aucun aria-label**
      - span : position absolute; right 6px; top 6px → a aria-label="Effacer la recherche" → NdRecherche : BTN-ICON-SM → CROIX 16px
  - button type="button" BTN-PRIMARY (48px) → span « Rechercher »
- Le champ du header n’existe pas : la recherche se saisit dans la page.

### 6.3 Compteur
- p : margin 0; **margin-top -8px** (le premier écart passe donc de 32 à 24px sous le trait); font-size 14px; line-height 22px; color #667085; text-wrap pretty → « 7 résultats pour « excel » » (= 1 + 1 + 1 + 4)

### 6.4 Groupes présents / absents
- Présents (dans cet ordre) : **Formations (1)**, **Parcours (1)**, **Sessions live (1)**, **Leçons (4)**. Chaque GROUPE = section (sans aria-labelledby) → EN-TÊTE-GROUPE avec h2 + BADGE neutre du nombre.
- Absents : publications de la communauté, formateurs, ressources/fichiers (pourtant annoncées par le placeholder), quiz, exercices, certificats.
- Aucun filtre par type (pas de chips, pas d’onglets), aucun tri, aucune pagination ni « Voir plus » (sauf « Voir le programme » des leçons).
- **Aucun surlignage** du terme trouvé : pas de `<mark>`, `<strong>` ni graisse ; les titres sont affichés tels quels.

### 6.5 Cartes de résultat (dans GRILLE-3)
**a) Formations** — EN-TÊTE-GROUPE « Formations » + BADGE « 1 »
- CARTE-PROGRESSION → NdLecon, **identique à Mes formations** (titre en h2 sous un h2 de groupe) : PILE bleue · h2 « Maîtriser Microsoft Excel » · description · 68 % · « 2 h restantes ». Sans `flex: 1`.

**b) Parcours** — EN-TÊTE-GROUPE « Parcours » + BADGE « 1 »
- CARTE-TUILE → NdParcours :
  - TUILE(48px, 14px) background #DDE1FF; color #0B18C9 → PARCOURS 22px
  - BADGE vert « Actif » (#DDF3E4 / #17663A) à droite
  - h3 title="Réussite académique" → « Réussite académique »
  - p « Bureautique, recherche, rédaction scientifique et soutenance : réussir à l’université. »
  - PROGRESS aria-label="Progression" aria-valuenow="57" (margin 17px 0 0 -1px)
  - div méta : display flex; **flex-wrap wrap**; align-items center; gap 7px; font-size 12px; line-height 18px; color #667085; margin-top 8px → « 57 % terminé » · DOT · « 6 formations » (sans icône)

**c) Sessions live** — EN-TÊTE-GROUPE « Sessions live » + BADGE « 1 »
- CARTE-TUILE → NdEvenements :
  - TUILE(48px, 14px) background #DDF3E4; color #17663A → VIDÉO 22px
  - BADGE bleu « Académique » (parcours de la session)
  - h3 title="Excel avancé : analyse de données" → « Excel avancé : analyse de données »
  - p « Samedi 24 octobre à 15 h 00, sur Google Meet, avec Dr Mireille Adjovi. »
  - div trait : height 1px; margin-top 16px; background #EAEEF7
  - div méta : display flex; flex-wrap wrap; align-items center; gap 7px; font-size 12px; line-height 18px; color #667085; margin-top 12px
    - span flex; center; gap 4px → CALENDRIER 16px (sans marge négative) + « 24 octobre »
    - DOT
    - span flex; center; gap 4px → GROUPE-PERSONNES 16px + « +128 inscrits »

### 6.6 Groupe « Leçons » (pleine largeur)
- EN-TÊTE-GROUPE : h2 « Leçons » + BADGE « 4 » ; à droite LIEN-ACTION « Voir le programme » → NdFormation
- Boîte : div box-sizing border-box; display flex; flex-direction column; padding 4px 15px; border 1px solid #EAEEF7; background #FFFFFF; border-radius 16px; min-width 0 → div display flex; flex-direction column → lignes séparées par SÉPARATEUR (pas avant la 1re ni après la dernière)
- Ligne = a LIGNE-LISTE → NdLecon (hover #F2F6FD, FOCUS), hauteur 72px :
  - TUILE(44px, 13px) background #E9EFFB; color #232326 → PLAY-CERCLE 20px
  - TEXTES-LIGNE → titre de la leçon / « {formation} · Module {n} : {titre du module} »
  - span durée : font-size 12px; line-height 18px; color #667085 (« 06:10 »)
  - BADGE vert « Terminée » (#DDF3E4 / #17663A)
  - CHEVRON-DROITE 18px #667085
- Données (toutes « Terminée », sous-titre identique « Maîtriser Microsoft Excel · Module 1 : bases d’Excel ») :
  1. Découvrir l’interface — 06:10
  2. Saisir et mettre en forme des données — 12:30
  3. Les formules essentielles — 14:05
  4. Références relatives et absolues — 10:40

### 6.7 Responsive
- Formulaire : le bouton passe sous le champ quand la largeur < 280 + 8 + largeur du bouton ; max 720px.
- Groupes Formations / Parcours / Sessions : suivent GRILLE-3 (3 → 2 → 1 colonnes) ; les CARTE-TUILE (flex 1) prennent la hauteur de leur cellule.
- Lignes de leçons : pas de wrap ; le titre et le sous-titre sont dans une colonne `min-width: 0` mais **sans ellipsis** déclarée (retour à la ligne naturel).

---

## 7. NdRechercheVide — bureau

- Identique à NdRecherche jusqu’au trait, sauf : input id="fa" value « zotéro » (même placeholder, même bouton Effacer, même bouton « Rechercher »).
- ZONE-CONTENU → div display flex; flex-direction column; gap 32px; min-width 0 :
  1. **Pas de compteur** (« 0 résultat » absent).
  2. Boîte : div box-sizing border-box; display flex; flex-direction column; **padding 0**; border 1px solid #EAEEF7; background #FFFFFF; border-radius 16px; min-width 0 → ÉTAT-VIDE (padding 48px 24px) :
     - TUILE 56/16 #E9EFFB → LOUPE 26px #232326
     - titre « Aucun résultat pour « zotéro » »
     - texte « Vérifiez l’orthographe ou essayez un mot plus général. »
     - actions : a → NdRecherche **BTN-SECONDARY** → span « Effacer la recherche » ; a → NdCatalogue **BTN-TONAL** → span « Parcourir le catalogue »
     - (= `EmptyState` actuel de l’app, encadré)
  3. GROUPE « Recommandé pour vous » :
     - EN-TÊTE-GROUPE : h2 « Recommandé pour vous » (**sans BADGE**) ; à droite LIEN-ACTION « Tout voir » → NdCatalogue
     - GRILLE-3 de CARTE-CATALOGUE → NdFormation (fiche connectée), titres h2 :

| Pile | Badge | Titre | Description | Note | Durée | Niveau |
|---|---|---|---|---|---|---|
| bleu | Populaire (ambre) | Méthodologie du mémoire | De la problématique à la rédaction : la méthode pour avancer sans vous perdre. | 4,9 (143) | 7 h 45 | Intermédiaire |
| violet | Nouveau (bleu) | L’intelligence artificielle au service de vos études | Utilisez l’IA pour réviser, résumer et rédiger, en gardant un regard critique. | 4,8 (37) | 3 h 30 | Débutant |
| orange | Populaire (ambre) | Lancer son activité de freelance | Offre, tarifs, premiers clients : les étapes pour démarrer une activité en ligne. | 4,8 (69) | 6 h 00 | Intermédiaire |

---

## 8. NdMesFormationsMenu — menu ouvert = menu du profil (shell)

- Ce n’est **ni un menu « … » de carte ni un menu de tri** : c’est le menu du rond de profil du header (`ProfileMenu`, déjà construit). Le bouton déclencheur (aria-label="Menu du profil") a `aria-expanded` vrai.
- Position : voile button aria-label="Fermer" (position fixed; inset 0; z-index 40; transparent; cursor default) + div position absolute; z-index 41; **top 60px; right 0** (sous le groupe droit du header, aligné à droite).
- div role="menu" aria-label="Menu du profil" : box-sizing border-box; width 280px; max-width calc(100vw - 32px); padding 8px; border 1px solid #EAEEF7; border-radius 18px; background #FFFFFF; box-shadow 0 16px 40px rgba(20, 20, 30, 0.14), 0 2px 6px rgba(20, 20, 30, 0.06)
  - En-tête : div display flex; align-items center; gap 12px; padding 8px 12px 12px → avatar 40×40 rond #DDE1FF / #0B18C9, 14px 600 « AK » + colonne : « Aïcha Kpadé » (15px/22px 600 #1D1D1F) / « aicha.k@exemple.com » (13px/20px #667085, ellipsis)
  - div role="separator" : height 1px; margin 6px 4px; background #EAEEF7
  - Items (role="menuitem") : box-sizing border-box; display flex; align-items center; gap 12px; width 100%; min-height 44px; padding 6px 12px; border 0; border-radius 10px; background transparent; text-align left; color #232326; libellé span 15px/22px 500 — hover `background: #E9EFFB` — FOCUS
    1. a « Mon profil » → NdProfil — icône UserIcon 20
    2. a « Mon abonnement » → NdAbonnement — CreditCardIcon 20
    3. a « Espace étudiant » → NdAccueil — Home03Icon 20 — **espace courant** : background #E9EFFB + COCHE 18px à droite
    4. a « Espace formateur » → NdFormateur — TeachingIcon 20
    5. a « Back-office » → NdAdmin — Shield01Icon 20
  - separator (idem)
  - button « Se déconnecter » (role="menuitem") : color **#B42318** — hover `background: #FBE3E1` — Logout03Icon 20 → ouvre le dialogue « Se déconnecter ? » du shell.
- `ProfileMenu` de l’app reproduit exactement cet ordre (espaces filtrés selon les rôles) : **rien à construire** pour cette variante.

---

## 9. Icônes

Hugeicons stroke-rounded (trait 1.5px, `fill: none; stroke: currentColor`, viewBox 24) sauf mention. Noms **vérifiés** : tracés comparés aux fichiers de `@hugeicons/core-free-icons` et existence contrôlée par `require('@hugeicons/core-free-icons')` dans `web/`. Seules les icônes du contenu de page sont listées (celles du shell sont déjà en place).

| Clé | Nom exact | Glyphe | Tailles / couleurs (où) |
|---|---|---|---|
| HORLOGE | Clock01Icon | horloge | 18px #667085, margin 0 -1.5px (méta des cartes) |
| CADENAS | SquareLock02Icon | cadenas | 13px #4A546B (BADGE « Verrouillée », téléphone) |
| CŒUR | FavouriteIcon (tracé identique à HeartIcon) | cœur contour | 22px #0B18C9 (bandeau Favoris) ; 22px #4A546B (tuile du dialogue) ; 26px #232326 (état vide Favoris) |
| CŒUR-PLEIN | **Phosphor** `Heart` (fill), viewBox 256, `fill: currentColor`, tracé `M240 102c0 70-103.79 126.66-108.21 129a8 8 0 0 1-7.58 0C119.79 228.66 16 172 16 102a62.07 62.07 0 0 1 62-62c20.65 0 38.73 8.88 50 23.89C139.27 48.88 157.35 40 178 40a62.07 62.07 0 0 1 62 62` | cœur plein | 20px #232326 (bouton « Retirer … des favoris ») — pas d’équivalent plein dans Hugeicons free : SVG maison comme `FilledIcon` |
| LOUPE | Search01Icon | loupe | 20px #667085 (champ) ; 26px #232326 (état vide recherche) |
| CROIX | Cancel01Icon | croix | 16px #232326 (effacer la recherche) ; 18px #667085 (fermer le dialogue) |
| PARCOURS | Route01Icon | deux ronds reliés par un S | 22px #0B18C9 (tuile résultat parcours) |
| VIDÉO | Video01Icon | caméra | 22px #17663A (tuile résultat session live) |
| CALENDRIER | Calendar03Icon | calendrier + points | 16px #667085 (« 24 octobre ») |
| GROUPE-PERSONNES | UserGroupIcon | trois personnes | 16px #667085 (« +128 inscrits ») |
| PLAY-CERCLE | PlayCircleIcon | triangle arrondi dans un cercle | 20px #232326 (tuiles des leçons) |
| CHEVRON-DROITE | ArrowRight01Icon | chevron › | 18px #667085 (lignes de leçons) |
| ÉTOILE | StarIcon | étoile contour | 16px #667085, margin 0 -1px (cartes recommandées) |
| COCHE | Tick02Icon | coche simple | 18px #232326 (espace courant du menu profil) |
| PLUS | PlusSignIcon (tracé identique à PlusIcon) | + | 20px #232326 (header téléphone « Ajouter une formation ») |
| CLOCHE | Notification02Icon | cloche | 20px #232326 (header téléphone) |
| PILE-* | illustration maison (`CourseIllustration`) | 3 losanges | 48px |

Toutes les icônes sont `aria-hidden="true"`, `flex-shrink: 0; display: block`.

---

## 10. États interactifs et ARIA

### 10.1 Logique maquettée
- NdMesFormations / Menu / NdMobFormations : état `g_filtre` ∈ {toutes, cours, terminees, verrou, favoris} (défaut **toutes**) ; une grille/liste par valeur (`sc-if`). Bureau : `ov` ∈ {menu, notif, logout} (shell) ; NdMesFormationsMenu démarre avec `ov = "menu"`.
- NdFavoris : `ov` ∈ {menu, notif, logout, **retirer**} ; le bouton cœur fait `go.retirer` ; Fermer / Annuler / Retirer font `close`.
- NdFavorisVide, NdRecherche, NdRechercheVide : aucun état propre (shell seulement). Le champ est `readonly`, le bouton « Rechercher » n’a pas d’action, « Effacer la recherche » est un lien vers NdRecherche.

### 10.2 États visuels déclarés
- **hover** : CARTE → bordure #D2D9E8 ; BTN-ICON-CONTOUR → #F2F6FD ; BTN-ICON-SM → #E9EFFB ; LIGNE-LISTE (leçons) → #F2F6FD ; LIEN-ACTION → souligné ; BTN-PRIMARY(-MD) → #08149F ; BTN-SECONDARY → #F2F6FD ; BTN-TONAL → #DEE6F6 ; croix du dialogue → #E9EFFB ; items du menu profil → #E9EFFB (« Se déconnecter » → #FBE3E1). **Pas de hover** sur CHIP-FILTRE.
- **focus-visible** (FOCUS) : cartes, chips, bouton cœur, Effacer, boutons, lignes de leçons, items de menu, croix. **Manquants** : LIEN-ACTION (« Parcourir le catalogue » du bandeau, « Voir le programme », « Tout voir »).
- **focus** (champ) : bordure #0B18C9 + halo 3px rgba(11, 24, 201, 0.14).
- **aria-pressed** : CHIP-FILTRE (5 sur bureau et téléphone). **Absent** sur le bouton cœur.
- **aria-current="page"** : lien de la barre latérale (Mes formations / Favoris), onglet « Formations » du téléphone.
- **aria-selected**, **disabled**, **aria-disabled** : aucun (la carte verrouillée reste un lien actif vers NdAbonnement).

### 10.3 Attributs ARIA et rôles présents
- Mes formations : `role="group" aria-label="Filtrer mes formations"` ; `role="progressbar" aria-label="Progression"` + valeurs ; `title` sur chaque h2 de carte.
- Favoris : `aria-label="Retirer {titre} des favoris"` ; `role="status"` (bandeau) ; dialogue `role="dialog" aria-modal="true" aria-labelledby` ; `aria-label="Fermer"`.
- Recherche : `role="search"` ; `aria-label="Effacer la recherche"` ; `section` par groupe ; `title` sur les titres de carte.

### 10.4 À compléter en code (non maquetté, recommandé)
- Nom accessible du champ de recherche (`aria-label` ou label masqué) ; `type="search"` ; vrai `form` avec soumission (Entrée) ; annonce du nombre de résultats (`aria-live`).
- Bouton cœur : `aria-pressed` ou libellé qui change (« Ajouter … aux favoris » / « Retirer … des favoris ») ; retour du focus après fermeture du dialogue.
- `aria-labelledby` des `section` vers leur h2 ; niveaux de titres (titre de carte h3 sous un h2 de groupe — voir §12.3).
- FOCUS sur les LIEN-ACTION.
- Libellé de progression plus précis (`Progression de {titre}`, déjà fait par `CourseCard`).

---

## 11. Inventaire des textes (verbatim, contenu de page uniquement)

**NdMesFormations / NdMesFormationsMenu (bureau)** : Mes formations | Formations de vos parcours et formations complémentaires achetées. | Toutes | En cours | Terminées | Verrouillées | Favoris | Maîtriser Microsoft Excel | Formules, tableaux croisés dynamiques et graphiques pour analyser vos données. | 68 % terminé | 2 h restantes | Microsoft Word pour vos travaux universitaires | Styles, sommaire automatique et mise en page du mémoire, étape par étape. | 100 % terminé | 4 h 10 suivies | Zotero : gérer ses références | Collectez vos sources et générez citations et bibliographie sans erreur. | 2 h 20 suivies | PowerPoint : réussir sa soutenance | Structurez vos diapositives et présentez avec assurance le jour de la soutenance. | 72 % terminé | 55 min restantes | Méthodologie du mémoire | De la problématique à la rédaction : la méthode pour avancer sans vous perdre. | 0 % terminé | 7 h 45 restantes | Canva, de débutant à expert | Créez affiches, présentations et visuels soignés, même sans base en design. | 20 % terminé | 4 h 10 restantes | L’intelligence artificielle au service de vos études | Utilisez l’IA pour réviser, résumer et rédiger, en gardant un regard critique. | 3 h 30 restantes | Marketing digital pour débutants | Les bases pour trouver vos premiers clients en ligne : réseaux, contenu, publicité. | 35 % terminé | Accès expiré
(aria : Filtrer mes formations | Progression)
**Menu du profil** : AK | Aïcha Kpadé | aicha.k@exemple.com | Mon profil | Mon abonnement | Espace étudiant | Espace formateur | Back-office | Se déconnecter (aria : Menu du profil | Fermer)

**NdMobFormations** : Mes formations (header) | mêmes chips et mêmes cartes que le bureau | Verrouillée
(aria : Ajouter une formation | Notifications | Filtrer mes formations | Progression)

**NdFavoris** : Favoris | Les formations que vous avez marquées d’un cœur, pour les retrouver rapidement. | Maîtriser Microsoft Excel | Formules, tableaux croisés dynamiques et graphiques pour analyser vos données. | 68 % terminé | 2 h restantes | Touchez le cœur d’une formation pour la retrouver ici. | Parcourir le catalogue | Retirer des favoris ? | « Maîtriser Microsoft Excel » ne figurera plus dans vos favoris. Votre progression ne change pas. | Annuler | Retirer
(aria : Retirer Maîtriser Microsoft Excel des favoris | Progression | Fermer)

**NdFavorisVide** : Favoris | Les formations que vous avez marquées d’un cœur, pour les retrouver rapidement. | Aucun favori pour le moment | Touchez le cœur d’une formation pour la retrouver ici. | Parcourir le catalogue

**NdRecherche** : Recherche | Formations, parcours, leçons et sessions live. | excel (valeur du champ) | Une formation, un parcours, une ressource… (placeholder) | Rechercher | 7 résultats pour « excel » | Formations | 1 | Maîtriser Microsoft Excel | Formules, tableaux croisés dynamiques et graphiques pour analyser vos données. | 68 % terminé | 2 h restantes | Parcours | Actif | Réussite académique | Bureautique, recherche, rédaction scientifique et soutenance : réussir à l’université. | 57 % terminé | 6 formations | Sessions live | Académique | Excel avancé : analyse de données | Samedi 24 octobre à 15 h 00, sur Google Meet, avec Dr Mireille Adjovi. | 24 octobre | +128 inscrits | Leçons | 4 | Voir le programme | Découvrir l’interface | Maîtriser Microsoft Excel · Module 1 : bases d’Excel | 06:10 | Terminée | Saisir et mettre en forme des données | 12:30 | Les formules essentielles | 14:05 | Références relatives et absolues | 10:40
(aria : Effacer la recherche | Progression)

**NdRechercheVide** : Recherche | Formations, parcours, leçons et sessions live. | zotéro (valeur) | Une formation, un parcours, une ressource… | Rechercher | Aucun résultat pour « zotéro » | Vérifiez l’orthographe ou essayez un mot plus général. | Effacer la recherche | Parcourir le catalogue | Recommandé pour vous | Tout voir | Populaire | Méthodologie du mémoire | De la problématique à la rédaction : la méthode pour avancer sans vous perdre. | 4,9 (143) | 7 h 45 | Intermédiaire | Nouveau | L’intelligence artificielle au service de vos études | Utilisez l’IA pour réviser, résumer et rédiger, en gardant un regard critique. | 4,8 (37) | 3 h 30 | Débutant | Lancer son activité de freelance | Offre, tarifs, premiers clients : les étapes pour démarrer une activité en ligne. | 4,8 (69) | 6 h 00
(aria : Effacer la recherche)

---

## 12. Écarts et questions

### 12.1 Écarts bureau ↔ téléphone (Mes formations)
1. Carte verrouillée : BADGE « Verrouillée » (cadenas) sur téléphone, **rien** au bureau (seul « Accès expiré » signale l’état). `CourseCard` affiche déjà le badge : le garder partout ?
2. Chips : 42px, repliables (bureau) ↔ 44px, rangée unique défilante bord à bord (téléphone).
3. Liste : GRILLE-3 gap 20px (bureau) ↔ une colonne gap 10px (téléphone) ; écart chips → liste : 32px + trait (bureau) ↔ 14px (téléphone).
4. En-tête : h1 + sous-titre dans le main (bureau) ↔ titre « Mes formations » dans le header, sans sous-titre (téléphone).
5. Cibles : NdLecon ↔ NdMobLecon (même leçon, gabarit différent) ; NdAbonnement dans les deux cas.
6. Header téléphone : bouton « + » (catalogue) + cloche, sans série ni loupe ↔ shell construit (logo, loupe, série, cloche, pas de titre).
7. Pas de maquette téléphone pour Favoris ni Recherche : réutiliser la pile téléphone de Mes formations (une colonne) et le dialogue en pleine largeur ?

### 12.2 Éléments attendus mais absents des maquettes
- Cartes de « Mes formations » : **aucun** tag de parcours (seule la couleur de la PILE), aucun badge « Terminé », « Nouveau » ou « En cours », aucun bouton cœur, aucun bouton/lien « Continuer » (toute la carte est le lien), aucun « … ».
- Aucun compteur (ni « 8 formations », ni nombre dans les chips), aucun tri, aucune recherche dans Mes formations ni dans Favoris.
- Recherche : pas de surlignage, pas de filtres par type, pas de groupes publications / formateurs / ressources, pas d’état initial (page sans requête), pas de suggestions pendant la frappe, pas de pagination.
- Aucun menu « … » de carte, aucun menu de tri : la variante « Menu » montre le menu du profil (shell).

### 12.3 Incohérences et placeholders
1. Le filtre « Favoris » de Mes formations duplique la page Favoris (même carte Excel).
2. Les formations à 0 % (Méthodologie, IA) ne sont dans aucun filtre sauf « Toutes » ; le libellé « En cours » exclut donc les formations commencées à 0 %.
3. Bouton cœur en position absolue (top 16, right 16) à l’endroit du BADGE : collision si une carte favorite est « Verrouillée » ou porte un badge.
4. Favoris : une formation non suivie (ajoutée depuis la fiche, avant inscription) n’a pas de progression → quelle carte (CARTE-CATALOGUE ?) — seule la variante progression est maquettée. Clic sur la carte → NdLecon même pour une formation jamais commencée ?
5. « Touchez le cœur d’une formation » sur bureau (verbe tactile) ; et le cœur n’existe que sur la fiche formation (« Ajouter aux favoris », NdFormation) et dans la page Favoris — pas sur les cartes du catalogue.
6. Dialogue de retrait : bouton bleu « Retirer » (pas de ton danger) ; aucun retrait effectif, toast ou « Annuler l’action » maquetté.
7. Recherche « zotéro » → « aucun résultat », alors que « Zotero : gérer ses références » existe (catalogue et Mes formations) : la recherche doit-elle ignorer les accents ? (probablement oui → choisir un autre exemple).
8. « Recommandé pour vous » propose « Méthodologie du mémoire » et « L’IA… », déjà dans Mes formations (0 %) : exclure les formations déjà suivies ?
9. Parcours « Réussite académique » : « 6 formations » alors que le catalogue en compte 5 ; « 57 % » ≠ moyenne des 5 formations (68 %) ni pondération par durée (≈ 55 %) : règle de calcul à fixer.
10. Résultats « Leçons » : seules les 4 leçons du module 1 (« bases d’Excel ») remontent, pas celles des modules 2–3 de la même formation ; règle de correspondance (titre de leçon ? de module ? de formation ?) à définir. Les 4 sont « Terminée » (badge au féminin, alors que le statut module est « Terminé »).
11. Hiérarchie de titres : titres de cartes en h2 sous un h2 de groupe (formations, recommandées) mais h3 pour parcours et sessions.
12. Session live : date répétée (description + méta) ; « Samedi 24 octobre à 15 h 00 » codé en dur dans la description.
13. Champ de recherche sans nom accessible, `type="text"` readonly ; bouton « Rechercher » sans action ; « Effacer » = lien.
14. Placeholder « … une ressource… » alors qu’aucun groupe « Ressources » n’existe ; sous-titre « Formations, parcours, leçons et sessions live. ».
15. Carte verrouillée (téléphone) → NdAbonnement, page bureau.
16. Artefacts : padding de l’état vide Favoris déclaré deux fois (48 puis 72) ; flex-wrap des chips téléphone déclaré deux fois (wrap puis nowrap) ; `padding-right: 0px` des h2 de dialogue.

### 12.4 Données nécessaires par écran
- **Mes formations** (par formation accessible à l’utilisateur) : id/slug ; titre ; description courte (2 lignes) ; parcours (académique / digital / business → couleur de PILE) ; progression % (entier) ; temps restant (somme des durées des leçons non terminées, formaté « 2 h », « 55 min », « 4 h 10 ») ; pour une formation terminée, temps suivi total (« 4 h 10 suivies ») ; état calculé (en cours / terminée / à commencer / verrouillée) ; origine de l’accès (parcours d’un abonnement actif ou achat complémentaire) et date d’expiration (« Accès expiré ») ; drapeau favori ; cible de reprise (dernière leçon ouverte ou prochaine leçon) ; rang d’affichage.
- **Favoris** : liste des formations favorites de l’utilisateur (+ mêmes champs que ci-dessus, ou champs catalogue si non suivie) ; date d’ajout (ordre d’affichage ?) ; action ajout / retrait.
- **Recherche** : requête ; nombre total ; puis par groupe :
  - formations : champs de carte (progression si suivie, sinon note, nombre d’avis, durée, niveau, badge) ;
  - parcours : titre, description, statut de l’abonnement de l’utilisateur (« Actif »), progression %, nombre de formations, lien ;
  - sessions live : titre, description, date et heure, plateforme (Google Meet), animateur, parcours (badge), nombre d’inscrits, lien ;
  - leçons : titre, formation (titre), module (numéro + titre), durée mm:ss, statut de l’utilisateur (« Terminée »), lien vers la leçon et vers le programme de la formation.
- **Recherche vide** : 3 formations recommandées (champs catalogue : PILE, badge Populaire/Nouveau, titre, description, note, avis, durée, niveau) + règle de recommandation.

### 12.5 Éléments qui relèvent de lots ultérieurs
- **Sessions live / Événements** : groupe « Sessions live » (date, Google Meet, « +128 inscrits »), cible NdEvenements.
- **Abonnements / formules** : statut « Actif » du parcours, « Accès expiré », carte verrouillée → NdAbonnement, distinction « formations de vos parcours / complémentaires achetées ».
- **Avis** : notes « 4,9 (143) » des cartes recommandées.
- **Recommandations** : bloc « Recommandé pour vous » (règle à définir ; à défaut, formations populaires/nouvelles non suivies).
- **Communauté (publications) et pages formateurs** : absents de la recherche dans ces maquettes ; à ajouter seulement s’ils sont maquettés plus tard.
- **Quiz, exercices, certificats, réalisations** : n’apparaissent pas sur ces écrans.
- Menu du profil (espaces formateur / back-office) : déjà construit.

### 12.6 Questions à trancher
1. Badge « Verrouillée » au bureau (comme le téléphone et `CourseCard`) ou seulement « Accès expiré » ?
2. Faut-il un filtre « À commencer », ou ranger les formations à 0 % dans « En cours » ? Le filtre « Favoris » de Mes formations reste-t-il, vu la page Favoris ?
3. Ordre des cartes : catalogue (maquette) ou dernière activité ?
4. Favoris : peut-on mettre en favori une formation non suivie ? Si oui, quelle carte et quelle cible ? Où place-t-on le cœur pour les ajouter (cartes du catalogue, fiche seulement) ? Que faire du badge sous le cœur ?
5. Retrait d’un favori : dialogue de confirmation systématique (maquette) ou retrait direct + toast « Annuler » ?
6. Recherche : état initial sans requête ? recherche insensible aux accents et à la casse ? recherche à la soumission (bouton) ou pendant la frappe (`SearchSuggestions`) ? quels types dans ce lot (formations, parcours, leçons) et lesquels plus tard (sessions live) ? limite par groupe et « Voir plus » ? surlignage du terme ?
7. Le bouton « Rechercher » du header devient-il actif (`aria-current`) sur la page Recherche ?
8. Téléphone : titre de page dans le header (maquette) ou header du shell actuel ? Maquettes téléphone de Favoris et Recherche à prévoir ?
9. Règles de calcul du parcours (progression %, nombre de formations) et formats de temps (« 2 h », « 55 min », « 4 h 10 », « 6 h 00 »).
