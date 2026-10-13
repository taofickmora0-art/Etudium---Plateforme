# Tâche 1.10 — Annexe design : tableau de bord `/accueil` (version de base)

> Valeurs relevées dans les maquettes du design de référence. La spec du lot 1 (§8) dit ce qui est retenu au lot 1 ; en cas de conflit, le plan de la tâche et la spec l’emportent. Cette annexe décrit **tout** le design et marque chaque bloc **[lot 1]** ou **[lot N]**.


Sources (dossier `project/`, tailles d’aperçu lues dans `canvas.json`) :
- `NdAccueil.dc.html` (1440×1841, planche « Accueil ») — bureau.
- `NdMobAccueil.dc.html` (390×844, planche « Téléphone · accueil ») — téléphone.
- `canvas.json` liste aussi `NdAccueilInscriptionLive.dc.html` (1440×1841, « Accueil · inscription à la session live ») et `NdAccueilRenouvellement.dc.html` (1440×1841, « Accueil · rappel de renouvellement ») : **ces deux fichiers ne sont pas dans la copie locale**. Les deux dialogues correspondants sont décrits d’après les `sc-if` de NdAccueil (§3.10), qui les contient.
- Aucune maquette d’état vide, ni sur bureau ni sur téléphone.

Valeurs copiées des styles inline. Aucune règle `@media`, aucun `position: sticky`, aucun `clamp()` dans ces deux fichiers : le responsive passe par les grilles `auto-fill`, les `flex-wrap` et deux bases de colonnes (`flex: 999 1 420px` / `flex: 1 1 360px`).
Texte : apostrophes typographiques `’` partout (Continuer l’apprentissage, Série d’apprentissage, l’accès, Je m’inscris, L’intelligence, l’IA) — aucune apostrophe droite dans le texte affiché. Aucun guillemet `« »`. Autres caractères : `·` (U+00B7) séparateur, `+` dans « +12 % ce mois » et « +128 inscrits », `/` entouré d’espaces dans « 3 / 5 jours ». Espaces avant `%` et `:` = espaces **normales** (« 72 % », « 68 % terminé », « Points gagnés cette semaine : 165 »). **Une seule insécable** : « 5&nbsp;jours » dans le bandeau du téléphone (U+00A0) ; le bureau a une espace normale.

---

## 0. Abréviations

### 0.1 Reprises de l’annexe 1.9 (§0.1 et §0.2) — valeurs identiques, rappelées pour que cette fiche se suffise
- `FOCUS` = style-focus-visible `outline: 2px solid #0B18C9; outline-offset: 2px`
- `FONT` = `font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif` (Inter 400/500/600/700) ; `-webkit-font-smoothing: antialiased` — CSS global : `body{margin:0}` `a{color:#0B18C9}` `a:hover{color:#08149F}` `::placeholder{color:#757F94}`
- `BTN-PRIMARY` = inline-flex; align-items center; justify-content center; gap 8px; box-sizing border-box; **height 48px; padding 0 18px; border-radius 14px; font-size 16px**; background #0B18C9; color #FFFFFF; border 0; font-family inherit; font-weight 500; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #08149F` — FOCUS (app : `Button variant="principal" size="lg"`) — utilisé seulement sur téléphone
- `BTN-PRIMARY-MD` = idem BTN-PRIMARY au gabarit **height 42px; padding 0 15px; border-radius 12px; font-size 14px** (app : `Button principal md`)
- `BTN-SECONDARY` = inline-flex; center/center; gap 8px; box-sizing border-box; height 42px; padding 0 15px; border-radius 12px; font-size 14px; background #FFFFFF; color #232326; border 1px solid #E3E8F3; font-family inherit; font-weight 500; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #F2F6FD` — FOCUS (app : `Button contour md`)
- `BTN-TONAL` = idem BTN-PRIMARY-MD mais background #E9EFFB; color #232326 — hover `background: #DEE6F6` — FOCUS (app : `Button gris md`)
- `BADGE` = display inline-flex; align-items center; gap 5px; padding 3px 8px 4px; border-radius 4px; font-size 12px; line-height 17px; font-weight 500; white-space nowrap ; couleurs utilisées ici :
  - neutre — « 3 éléments » (sans icône) : bg #E5EBF7, color #4A546B (app : `Tag tone="enAttente"`)
  - vert — « 3 / 5 jours » : bg #DDF3E4, color #17663A (app : `Tag valide` / `reussi`)
  - bleu — « Académique » (parcours de la formation), « Nouveau », « Dans 2 jours » (téléphone) : bg #DDE1FF, color #0B18C9 (app : `Tag academique` / `nouveau`)
  - ambre — « Populaire », « À corriger » : bg #FBEFD0, color #8A5A00 (app : `Tag populaire` / `aCorriger`)
- `DOT` = span aria-hidden; width 3px; height 3px; border-radius 50%; background #667085 (app : `MetaDot`)
- `PROGRESS` = div role="progressbar" aria-label aria-valuenow aria-valuemin="0" aria-valuemax="100" ; piste height 8px; border-radius 999px; background #D6DDEC; overflow hidden ; remplissage div width N%; height 100%; border-radius 999px; background #0B18C9 (app : `ProgressBar`)
- `TUILE(n, r)` = span flex none; display flex; align-items center; justify-content center; width n; height n; border-radius r ; + background / color (app : `IconTile` pour 40/12 et 44/13)
- `LIGNE-LISTE` = display flex; align-items center; gap 14px; padding 14px 4px; min-height 48px; color inherit; text-decoration none ; en lien : hover `background: #F2F6FD` + FOCUS. Hauteur rendue avec une TUILE 44 : **72px**.
- `TEXTES-LIGNE` = span flex 1; min-width 0; display flex; flex-direction column; gap 2px → titre span font-size 15px; line-height 22px; font-weight 500; color #1D1D1F + sous-titre span font-size 13px; line-height 20px; color #667085 (aucune ellipsis déclarée)
- `SÉPARATEUR` = div height 1px; background #EAEEF7
- `PILE-{BLEU|VIOLET|ORANGE}` = illustration maison 48×48 (3 losanges empilés) : Académique = bleu, Digital = violet, Business = orange — svg display block; flex-shrink 0; margin-left 4px (app : `CourseIllustration`)
- `TITRE-PAGE` = div display flex; flex-wrap wrap; align-items flex-end; justify-content space-between; gap 16px → div min-width 0; flex 1 1 320px →
  - h1 : margin 0; font-size 32px; line-height 40px; font-weight 500; letter-spacing -0.01em; color #262628; text-wrap balance
  - p : margin 10px 0 0; font-size 16px; line-height 24px; color #232326; text-wrap pretty
  - **ici, colonne droite non vide** : div display flex; flex-wrap wrap; gap 8px → un bouton (§3.1)
- `TRAIT-PAGE` = div height 1px; margin-top 20px; background #DBE0EB
- `ZONE-CONTENU` = div margin-top 32px (enveloppe de tout ce qui suit le trait)
- `GRILLE-3` = display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(232px, calc((100% - 40px) / 3))), 1fr)); gap 20px → 3 colonnes max (313px à 1440 : contenu du main 979px) ; 2 colonnes sous 736px de contenu ; 1 colonne sous 484px.
- `CARTE` (coque commune — app : `CardShell`) = a : color inherit; text-decoration none; box-sizing border-box; display flex; flex-direction column; padding 22px 19px 17px; border 1px solid #EAEEF7; border-radius 16px; background #FFFFFF; min-width 0 — hover `border-color: #D2D9E8` — FOCUS
  - div haut : display flex; align-items flex-start; justify-content space-between; gap 8px → PILE à gauche + BADGE à droite
  - titre h2 title="{titre complet}" : margin 21px 0 0; font-size 16px; line-height 24px; font-weight 600; color #1D1D1F; white-space nowrap; overflow hidden; text-overflow ellipsis
  - p description : margin 11px 0 0; font-size 12px; line-height 20px; height 40px; overflow hidden; color #667085
- `CARTE-CATALOGUE` (app : `CatalogCard` via `CarteFormation variante="connecte"`) = CARTE + div trait height 1px; margin-top 16px; background #EAEEF7 + div méta display flex; flex-wrap wrap; align-items center; gap 7px; font-size 12px; line-height 18px; color #667085; margin-top 12px → span (flex; center; gap 4px) ÉTOILE 16px (margin 0 -1px) + « note (avis) » · DOT · span (flex; center; gap 4px) HORLOGE 18px (margin 0 -1.5px) + durée · DOT · span niveau. Hauteur 232px.
- `EN-TÊTE-GROUPE` = div display flex; flex-wrap wrap; align-items center; justify-content space-between; gap 6px 12px
  - div gauche : display flex; flex-wrap wrap; align-items center; gap 10px → h2 : margin 0; font-size 20px; line-height 28px; font-weight 600; color #1D1D1F + [BADGE]
  - [option] LIEN-ACTION à droite
- `GROUPE` = section : display flex; flex-direction column; gap 14px; min-width 0 → EN-TÊTE-GROUPE puis contenu (app : `Groupe`, local à `PageRecherche.tsx`)
- `LIEN-ACTION` = a : color #0B18C9; font-size 14px; line-height 22px; font-weight 500; text-decoration none — hover `text-decoration: underline` — **pas de focus-visible déclaré**
- `DIALOGUE` (app : `ConfirmDialog` / `Dialog`) =
  - voile : div position fixed; inset 0; z-index 50; display flex; align-items center; justify-content center; padding 20px; background rgba(29, 29, 31, 0.5); overflow-y auto
  - boîte : div role="dialog" aria-modal="true" aria-labelledby="{id du h2}" : position relative; box-sizing border-box; width 440px; max-width 100%; padding 28px; border-radius 24px; background #FFFFFF; box-shadow 0 16px 40px rgba(20, 20, 30, 0.14), 0 2px 6px rgba(20, 20, 30, 0.06)
    - button type="button" aria-label="Fermer" : position absolute; top 16px; right 16px; display flex; center/center; width 36px; height 36px; padding 0; border 0; border-radius 10px; background transparent; color #667085; cursor pointer — hover `background: #E9EFFB` — FOCUS → CROIX 18px
    - TUILE(48px, 14px) {bg/fg selon le dialogue}; margin-bottom 18px → icône 22px
    - h2 : margin 0; padding-right 0px; font-size 20px; line-height 28px; font-weight 600; color #1D1D1F; text-wrap balance
    - p : margin 8px 0 0; font-size 14px; line-height 22px; color #667085; text-wrap pretty
    - div actions : display flex; flex-wrap wrap; justify-content flex-end; gap 8px; margin-top 24px
- `ÉTAT-VIDE` (**absent de ces maquettes**, repris pour la proposition du §8) = div display flex; flex-direction column; align-items center; gap 6px; padding 48px 24px; text-align center → TUILE(56px, 16px) background #E9EFFB; color #232326 → icône 26px · span titre margin-top 10px; 18/26; 600; #1D1D1F · span texte max-width 420px; 14/22; #667085; text-wrap pretty · div actions margin-top 14px; flex; flex-wrap wrap; justify-content center; gap 8px (app : `EmptyState`, encadré par défaut, titre h3)
- **Non utilisés** dans ces maquettes : `CHIP-FILTRE`, `CHAMP`, `BTN-ICON-CONTOUR`, `BTN-ICON-SM`, `CARTE-PROGRESSION` (la carte « Continuer » est un autre gabarit, §3.4), `CARTE-TUILE`, `BANDEAU-INFO` (remplacé ici par BANDEAU-ALERTE), `SEG-TABS`, `NAV-ITEM`, `SURTITRE`, `TEXTAREA`, `RESSOURCE`.

### 0.2 Nouvelles abréviations
- `BTN-SM-CONTOUR` = inline-flex; align-items center; justify-content center; gap 8px; box-sizing border-box; **height 34px; padding 0 12px; border-radius 10px; font-size 13px**; background #FFFFFF; color #232326; border 1px solid #E3E8F3; font-family inherit; font-weight 500; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #F2F6FD` — FOCUS (app : `Button variant="contour" size="sm"` — identique)
- `BANDEAU-ALERTE` = div role="status" : display flex; flex-wrap wrap; align-items center; gap 12px; padding 14px 16px; border-radius 16px; background #FBEFD0 (pas de bordure)
  - span flex none; color #8A5A00 → ALERTE 22px
  - span texte : flex 1 1 240px; min-width 0; font-size 14px; line-height 22px; color #1D1D1F → strong font-weight 600 (première phrase) + suite en graisse normale
  - bouton à la fin de la ligne
  - (app : `Banner tone="attention" title=… action=…` — identique, y compris l’icône `Alert02Icon`)
- `GRILLE-4` = display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(228px, calc((100% - 60px) / 4))), 1fr)); gap 20px → 4 colonnes de 229,75px à 1440 (contenu 979px ; seuil 972px) ; 3 colonnes de 724 à 971px ; 2 de 476 à 723px ; 1 sous 476px. `auto-fill` : les pistes vides **restent** (2 tuiles = moitié de rangée vide, voir §10).
- `TUILE-STAT` (app : `StatCard`) = div (pas un lien, pas de hover) box-sizing border-box; display flex; flex-direction column; padding 18px 19px 16px; border 1px solid #EAEEF7; background #FFFFFF; border-radius 16px; min-width 0
  - div : display flex; align-items center; gap 12px → TUILE(40px, 12px) {bg/fg} → icône 18px + span libellé : font-size 14px; line-height 20px; color #667085
  - div valeur : margin-top 14px; font-size 28px; line-height 36px; font-weight 500; letter-spacing -0.01em; color #262628
  - div indice : margin-top 2px; font-size 12px; line-height 18px; color #667085
  - Hauteur rendue : 146px (126px sans indice).
- `DEUX-COLONNES` = div display flex; flex-wrap wrap; align-items flex-start; gap 24px →
  - colonne gauche : div flex 999 1 420px; min-width 0 → div display flex; flex-direction column; gap 32px; min-width 0
  - colonne droite : div flex 1 1 360px; min-width 0 → div display flex; flex-direction column; gap 32px; min-width 0
  - À 1440 (contenu 979px) : gauche ≈ 595px, droite ≈ 360px (l’espace libre va presque entièrement à gauche). Les colonnes passent l’une sous l’autre sous **804px** de contenu (420 + 24 + 360). `align-items: flex-start` : colonnes de hauteurs indépendantes.
- `CARTE-BLOC` = div **non cliquable** : box-sizing border-box; display flex; flex-direction column; padding 22px 19px 17px; border 1px solid #EAEEF7; background #FFFFFF; border-radius 16px; min-width 0 — même coque que CARTE, sans lien, sans hover, sans FOCUS (app : aucune ; `CardShell` sans `href` rend un div mais impose PILE + titre + description)
- `BOÎTE-LISTE` = div box-sizing border-box; display flex; flex-direction column; padding 4px 15px; border 1px solid #EAEEF7; background #FFFFFF; border-radius 16px; min-width 0 → div display flex; flex-direction column → lignes séparées par SÉPARATEUR (pas avant la 1re ni après la dernière). Même boîte que le groupe « Leçons » de NdRecherche (annexe 1.9 §6.6).
- `LIGNE-ACTION` (À faire) = a LIGNE-LISTE (hover #F2F6FD, FOCUS) → TUILE(44px, 13px) + icône 20px · TEXTES-LIGNE · [BADGE] · CHEVRON-DROITE 18px #667085
- `LIGNE-ACTIVITÉ` = **div** (pas un lien) avec les styles de LIGNE-LISTE (y compris color inherit; text-decoration none, sans effet) — aucun hover, aucun FOCUS → TUILE(44px, 13px) + icône 20px · TEXTES-LIGNE · span horodatage : font-size 12px; line-height 18px; color #667085; white-space nowrap
- `TUILE-DATE` = span aria-hidden="true" : flex none; display flex; flex-direction column; align-items center; justify-content center; width 56px; height 56px; border-radius 14px; background #E9EFFB → span mois : font-size 12px; line-height 16px; font-weight 500; letter-spacing 0.04em; color #535E75 + span jour : font-size 20px; line-height 24px; font-weight 600; color #1D1D1F
- `LIGNE-INFO` = span display flex; align-items center; gap 8px; font-size 14px; line-height 22px; color #232326 → span flex none; display flex; color #667085 → icône 18px + span min-width 0 → texte
- `PILE-AVATARS` = span display flex; align-items center → 3 × span : flex none; display flex; align-items center; justify-content center; width 32px; height 32px; border-radius 999px; font-size 12px; font-weight 600; position relative; box-shadow 0 0 0 2px #FFFFFF ; z-index 3 / 2 / 1 ; margin-left -6px à partir du 2e (app : `AvatarGroup` + `Avatar size={32}` — identique ; tons violet / bleu / ambre existants)
- `BTN-JOUR` = button type="button" aria-pressed aria-label : flex 1; min-width 0; height 44px; padding 0; border 1px solid {bd}; border-radius 12px; background {bg}; font-family inherit; font-size 14px; font-weight 600; color {fg}; cursor pointer — FOCUS — **pas de hover, pas d’action (onClick absent)**
  - atteint (aria-pressed="true") : bd #DDF3E4, bg #DDF3E4, fg #17663A
  - non atteint (aria-pressed="false") : bd #E3E8F3, bg #FFFFFF, fg #232326
- `CONFIRMATION-INLINE` = span (non interactif) : box-sizing border-box; display inline-flex; align-items center; justify-content center; gap 8px; height 42px; padding 0 15px; border-radius 12px; background #DDF3E4; font-size 14px; font-weight 500; color #17663A; white-space nowrap; width 100% → COCHE 18px + span texte
- `INTRO-GROUPE` = p : margin 0 puis **margin-top -8px** (déclaré deux fois : retenir -8px) ; font-size 14px; line-height 22px; color #667085; text-wrap pretty → se place à 6px sous l’en-tête du GROUPE (gap 14 − 8). Même gabarit que le compteur de NdRecherche.
- `TITRE-SECTION-MOB` (téléphone) = div display flex; align-items center; justify-content space-between; gap 12px → h2 : margin 0; font-size **18px**; line-height **26px** (déclarés 20/28 puis surchargés : retenir 18/26); font-weight 600; color #1D1D1F + [élément à droite]
- `BLOC-MOB` (téléphone) = **div** (pas de `section`) display flex; flex-direction column; gap {12px | 0px}; min-width 0 → TITRE-SECTION-MOB puis contenu

### 0.3 Correspondance avec les composants existants de l’app

| Bloc du design | Lot | Composant de l’app | Écart à traiter / ce qui manque |
|---|---|---|---|
| TITRE-PAGE « Bonjour, … » + « Explorer le catalogue » | **1** | `Heading level="page"` + `Lead className="mt-2.5"` + `Button asChild` (page actuelle) | la page actuelle met le bouton en **principal** : la maquette est **BTN-SECONDARY** → `variant="contour"` (md). La page actuelle n’a ni TRAIT-PAGE ni ZONE-CONTENU (elle empile en `gap-6`) : reprendre `mt-5 h-px bg-separateur` puis `mt-8` comme `PageRecherche`. Le h1 « Bonjour » sans prénom est déjà géré. |
| BANDEAU-ALERTE + dialogue « Renouveler » | 2 | `Banner tone="attention"` + `Button variant="contour" size="sm"` ; `ConfirmDialog iconTone="attention"` | aucun (à brancher au lot 2) |
| TUILE-STAT « Progression globale » | **1** | `StatCard icon={Target02Icon}` (ton neutre) | indice « +12 % ce mois » **retiré** au lot 1 (`hint` absent → tuile de 126px au lieu de 146px, voir §10) |
| TUILE-STAT « Formations en cours » | **1** | `StatCard icon={CourseIcon}` | **ton bleu manquant** : la tuile est #DDE1FF / #0B18C9 ; `IconTile` n’a que neutre / blanc / reussite / attention → ajouter un ton (`information`, comme `Dialog`, = `bg-bleu-pale text-bleu`) et l’ouvrir dans `StatCard` |
| TUILE-STAT « Certificats obtenus » | 3 | `StatCard tone="reussite" icon={Certificate01Icon}` | aucun |
| TUILE-STAT « Série d’apprentissage » | 6 | `StatCard tone="attention" icon={FireIcon}` | aucun |
| GRILLE-4 | **1** | — | classe à créer : `grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(228px,calc((100%-60px)/4))),1fr))] gap-5` (ou autre grille si seulement 2 tuiles : §10, Q1) |
| DEUX-COLONNES | **1** (si conservée) | — | classes : `flex flex-wrap items-start gap-6` ; `min-w-0 flex-[999_1_420px]` ; `min-w-0 flex-[1_1_360px]` ; piles `flex min-w-0 flex-col gap-8` |
| GROUPE / EN-TÊTE-GROUPE | **1** | `Groupe` de `PageRecherche.tsx` (titre, nombre, lien ; LIEN-ACTION avec `focus-etudium` déjà ajouté) | **à extraire** dans `components/ui` pour le réutiliser ; le badge porte ici un **texte** (« 3 éléments ») et non un nombre → prop `badge?: string` (ou formater `pluriel(n, "élément")`) |
| CARTE « Continuer l’apprentissage » (§3.4) | **1** | — (aucun composant ne correspond : ni `CourseCard`, qui est un lien entier sans boutons, ni `CardShell`) | **à créer** (`CarteReprise`) avec les valeurs du §3.4 ; réutilise `CourseIllustration`, `Tag` (ton du parcours), `ProgressBar`, `ProgressMeta` (flex-wrap par défaut = maquette), `Button principal md` + `Button gris md` ; téléphone : `Button lg` pleine largeur, sans badge ni « Voir le parcours » |
| BOÎTE-LISTE + LIGNE-ACTION (À faire) | **1** (« Leçon suivante ») / 3 (exercice, quiz) | `List` + `ListRow` + `IconTile size={44}` ; ou le modèle `LigneLecon` de `PageRecherche.tsx` | `ListRow` a **min-h 76px** (maquette : min-height 48px, rendu 72px) et **tronque** titre et sous-titre (maquette : pas d’ellipsis) → corriger `ListRow` ou suivre `LigneLecon` (`min-h-12`, pas de `truncate`). Boîte : classes de la boîte « Leçons » de `PageRecherche` (`rounded-carte border border-bordure-carte bg-panneau px-[15px] py-1`). |
| INTRO-GROUPE (« Vous avez terminé Zotero… ») | 1 ? (§10, Q8) | — | `p` `-mt-2 mb-0 text-sm leading-[22px] text-pretty text-discret` (= compteur de `PageRecherche`) |
| GRILLE-3 de CARTE-CATALOGUE (Recommandé) | **1** | `CarteFormation variante="connecte"` dans la constante `GRILLE` de `PageRecherche.tsx` | `GRILLE` est locale à la recherche → l’extraire ; `CarteFormation` force `titleAs="h2"` (titre h2 sous un h2 de section, §9) |
| CARTE-BLOC session live (§3.6) + dialogue « inscrite » | 5 | `Avatar` / `AvatarGroup` ; `ConfirmDialog iconTone="reussite"` | carte à créer au lot 5 (TUILE-DATE, LIGNE-INFO, CONFIRMATION-INLINE) |
| CARTE-BLOC objectif (§3.7) | 6 | `ProgressBar`, `MetaDot` | BTN-JOUR à créer au lot 6 |
| BOÎTE-LISTE + LIGNE-ACTIVITÉ (§3.8) | 3 / 6 | `List` + `ListRow` sans `href` + `trailing` | même écart de hauteur que ci-dessus |
| ÉTAT-VIDE (rien commencé, non maquetté) | **1** | `EmptyState` (encadré) | aucun composant à créer (§8) |
| Cadre bureau / téléphone | — | `AppShell`, `AppHeader`, `SidebarNav`, `MobileNav` | téléphone : l’app affiche une **loupe** que NdMobAccueil n’a pas (§4.1) |

---

## 1. Cadre (shell) — ce que cette page change

### 1.1 Bureau (NdAccueil)
- Header, conteneur #E9EFFB, barre latérale, panneau des notifications, menu du profil et dialogue « Se déconnecter ? » : **identiques** aux autres pages connectées (déjà construits). États `ov` « menu », « notif », « logout » = shell.
- `main` : flex 999 1 560px; min-width 0; box-sizing border-box; margin 15px 20px 20px 0; padding 32px; border-radius 28px; background #FFFFFF. Largeurs à 1440 : conteneur 1400 ; barre latérale 337 ; main 1043 (contenu **979**).
- Lien actif de la barre latérale : **« Accueil »** (href NdAccueil, `aria-current="page"`, background #FFFFFF; box-shadow 0 1px 2px rgba(20, 20, 30, 0.08); color #0B18C9 ; icône Home03Icon colorée #0B18C9 ; pas de hover).
- Rappels du header qui recoupent la page : pastille série `title="Série d’apprentissage : 8 jours"` (« 8 ») et pastille points `title="Points gagnés cette semaine : 165"` (« 165 ») ; badges de la barre latérale « Nouveau » (Événements) et « 1 à corriger » (Exercices). Ces éléments du shell relèvent du lot 6 (série, points) et des lots 3/5 (badges).

### 1.2 Téléphone (NdMobAccueil)
- Racine : position relative; width 390px; height 844px; box-sizing border-box; display flex; flex-direction column; background #F2F6FD; FONT; color #232326; overflow hidden.
- Header : flex none; display flex; align-items center; justify-content space-between; gap 8px; padding 12px 16px →
  - gauche : a aria-label="Étudium, accueil" → NdMobAccueil, logo 48×49 (border-radius 14px; background #E9EFFB ; FOCUS) — **pas de titre de page**.
  - droite (div flex; gap 8px) : pastille série div `title="Série d’apprentissage : 8 jours"` : display flex; align-items center; gap 7px; height 48px; padding 0 14px; border-radius 14px; background #E9EFFB; font-size 16px; font-weight 500 → éclair Phosphor 17px #F5C02C + « 8 » ; puis a aria-label="Notifications" → NdMobNotifications : 48×48; border-radius 14px; background #E9EFFB; color #232326; hover #DEE6F6; FOCUS → CLOCHE 20px.
  - **Pas de loupe** : l’`AppHeader` de l’app en affiche une (lien « Rechercher ») entre le logo et la série → écart (§10, Q12).
- Panneau blanc : flex 1; min-height 0; overflow hidden; display flex; flex-direction column; margin 0 8px; border-radius 28px 28px 0 0; background #FFFFFF → zone qui défile : flex 1; min-height 0; overflow-y auto; padding 20px 16px 20px (largeur utile **342px**).
- Barre du bas : nav aria-label="Navigation" : flex none; display flex; gap 4px; margin 0 8px 8px; padding 6px; border-radius 0 0 28px 28px; background #E9EFFB → 5 liens (flex 1; min-width 0; flex column; center; gap 2px; height 56px; border-radius 16px; 11px/14px 500) : **« Accueil » actif** (`aria-current="page"`, background #FFFFFF; box-shadow 0 1px 2px rgba(20, 20, 30, 0.08); color #0B18C9) → NdMobAccueil ; « Formations » → NdMobFormations ; « Communauté » → NdMobAccueil (lien de remplacement) ; « Certificats » → NdMobAccueil (remplacement) ; « Profil » → NdMobMenu. Pas de FOCUS déclaré sur ces liens. (Déjà construit : `MobileNav`.)

---

## 2. NdAccueil — bureau : pile du `main`

1. TITRE-PAGE (§3.1) — **[lot 1]**
2. TRAIT-PAGE
3. ZONE-CONTENU → div display flex; flex-direction column; **gap 32px**; min-width 0 :
   1. div display flex; flex-direction column; **gap 20px**; min-width 0 →
      - BANDEAU-ALERTE (§3.2) — **[lot 2]**
      - GRILLE-4 de 4 TUILE-STAT (§3.3) — **2 tuiles [lot 1]**, Certificats **[lot 3]**, Série **[lot 6]**
   2. DEUX-COLONNES :
      - gauche : GROUPE « Continuer l’apprentissage » (§3.4) **[lot 1]** puis GROUPE « À faire » (§3.5) **[lot 1, en partie]**
      - droite : GROUPE « Prochaine session live » (§3.6) **[lot 5]** puis GROUPE « Objectif de la semaine » (§3.7) **[lot 6]**
   3. GROUPE « Activité récente », pleine largeur (§3.8) — **[lot 3 / 6]**
   4. GROUPE « Recommandé pour vous », pleine largeur (§3.9) — **[lot 1, version simple]**
- Dialogues hors du `main` : « Vous êtes inscrite à la session » **[lot 5]**, « Votre formule Standard expire dans 5 jours » **[lot 2]** (§3.10).
- Hauteur d’aperçu : 1841px.

---

## 3. NdAccueil — détail des blocs (bureau)

### 3.1 En-tête — [lot 1]
- TITRE-PAGE :
  - h1 « Bonjour, Aïcha » (prénom de l’utilisateur)
  - p « Continuez votre apprentissage et atteignez vos objectifs. »
  - colonne droite : div display flex; flex-wrap wrap; gap 8px → a → NdCatalogue : **BTN-SECONDARY** → span « Explorer le catalogue »
- Responsive : le bouton passe sous le titre quand la largeur < 320 + 16 + largeur du bouton (flex-wrap du TITRE-PAGE).

### 3.2 Bandeau d’expiration — [lot 2]
- BANDEAU-ALERTE role="status" → ALERTE 22px #8A5A00 · texte : strong « Votre formule Standard expire dans 5 jours. » + « Renouvelez pour garder l’accès à vos formations. Rien ne sera supprimé. » · button type="button" **BTN-SM-CONTOUR** → span « Renouveler » (onClick → ouvre le dialogue « renouveler », §3.10).
- Le bouton ne mène pas directement à la page Abonnement sur bureau (dialogue intermédiaire) ; sur téléphone si (§4.2).

### 3.3 Tuiles indicateurs — GRILLE-4
| # | Lot | TUILE 40/12 (bg / fg) | Icône 18px | Libellé | Valeur | Indice |
|---|---|---|---|---|---|---|
| 1 | **1** | #E9EFFB / #232326 (neutre) | CIBLE (Target02Icon) | Progression globale | 72 % | +12 % ce mois (**retiré au lot 1**) |
| 2 | **1** | **#DDE1FF / #0B18C9 (bleu)** | COURS (CourseIcon) | Formations en cours | 4 | Sur 10 formations |
| 3 | 3 | #DDF3E4 / #17663A (vert) | CERTIFICAT (Certificate01Icon) | Certificats obtenus | 2 | Word et Zotero |
| 4 | 6 | #FBEFD0 / #8A5A00 (ambre) | FEU (FireIcon) | Série d’apprentissage | 8 jours | Continuez comme ça |
- Les tuiles ne sont **pas** des liens (aucun hover, aucun FOCUS).
- À 1440 : 4 colonnes de 229,75px, hauteur 146px.

### 3.4 « Continuer l’apprentissage » — [lot 1]
- GROUPE → EN-TÊTE-GROUPE : h2 « Continuer l’apprentissage » (sans BADGE) ; à droite LIEN-ACTION « Mes formations » → NdMesFormations.
- `CARTE-REPRISE` = CARTE-BLOC (div, **pas un lien** : seuls les deux boutons sont cliquables) :
  - div haut : display flex; **align-items flex-start; gap 16px** →
    - PILE-BLEU 48px (margin-left 4px)
    - div : flex 1; min-width 0; display flex; flex-direction column; gap 2px →
      - h3 : margin 0; font-size 16px; line-height 24px; font-weight 600; color #1D1D1F — « Maîtriser Microsoft Excel » (**pas d’ellipsis**, pas de `title` : le titre passe à la ligne)
      - p : margin 0; font-size 13px; line-height 20px; color #667085; text-wrap pretty — « Module 3 · Les tableaux croisés dynamiques · 12 min »
    - BADGE bleu « Académique » (parcours de la formation) à droite (nowrap : ne rétrécit pas)
  - PROGRESS aria-label="Progression" aria-valuenow="68" : **margin-top 20px** (pas de marge gauche négative)
  - div méta : display flex; **flex-wrap wrap**; align-items center; gap 7px; font-size 12px; line-height 18px; color #667085; margin-top 8px → span « 68 % terminé » · DOT · span display flex; align-items center; gap 4px → HORLOGE 18px (margin 0 -1.5px) + span « 2 h restantes »
  - div actions : display flex; flex-wrap wrap; align-items center; gap 8px; **margin-top 18px** →
    - a → NdLecon : **BTN-PRIMARY-MD** → span « Reprendre la leçon »
    - a → NdParcours : **BTN-TONAL** → span « Voir le parcours »
- Hauteur rendue ≈ 203px (22 + 48 + 20 + 8 + 8 + 18 + 18 + 42 + 17 + 2).
- Écarts avec CARTE-PROGRESSION (annexe 1.9) : div au lieu de a, h3 sans ellipsis, sous-titre 13/20 au lieu d’une description 12/20 sur 2 lignes, BADGE de parcours, progression à 20px (au lieu de 17px et -1px), méta en flex-wrap, deux boutons.

### 3.5 « À faire » — [lot 1 pour « Leçon suivante », lot 3 pour exercice et quiz]
- GROUPE → EN-TÊTE-GROUPE : h2 « À faire » + BADGE neutre « 3 éléments » ; pas de lien à droite.
- BOÎTE-LISTE de 3 LIGNE-ACTION (72px chacune ; boîte ≈ 228px) :

| # | Lot | Cible | TUILE 44/13 (bg / fg) | Icône 20px | Titre | Sous-titre | Badge |
|---|---|---|---|---|---|---|---|
| 1 | 3 | NdExercice | #FBEFD0 / #8A5A00 | EXERCICE (AssignmentsIcon) | Exercice à corriger | Excel · Tableau des ventes | ambre « À corriger » |
| 2 | 3 | NdQuiz | #E9EFFB / #232326 | QUIZ (Quiz01Icon) | Quiz du module 3 | Excel · 4 questions | — |
| 3 | **1** | NdLecon | #E9EFFB / #232326 | PLAY-CERCLE (PlayCircleIcon) | Leçon suivante | Canva · Créer une affiche | — |
- Chaque ligne se termine par CHEVRON-DROITE 18px #667085 (après le badge s’il y en a un). Aucune durée, aucun horodatage.
- Sous-titre = « {nom court de la formation} · {titre de l’élément} » : « Excel », « Canva » sont des **noms courts** (titres complets : « Maîtriser Microsoft Excel », « Canva, de débutant à expert »).
- Pas d’état vide maquetté pour cette liste.

### 3.6 « Prochaine session live » — [lot 5]
- GROUPE → EN-TÊTE-GROUPE : h2 « Prochaine session live » ; à droite LIEN-ACTION « Événements » → NdEvenements.
- CARTE-BLOC :
  - div : display flex; align-items flex-start; gap 14px → TUILE-DATE « OCT. » / « 24 » + div flex 1; min-width 0; display flex; flex-direction column; gap 2px → h3 (16/24 600 #1D1D1F, margin 0) « Excel avancé : analyse de données » + p (margin 0; 13/20 #667085; text-wrap pretty) « Samedi 24 octobre · 15 h 00 »
  - div : display flex; flex-direction column; gap 6px; margin-top 16px → LIGNE-INFO VIDÉO (Video01Icon) « Google Meet » ; LIGNE-INFO FORMATEUR (TeachingIcon) « Dr Mireille Adjovi »
  - div : display flex; flex-wrap wrap; align-items center; gap 10px; margin-top 16px → PILE-AVATARS « RH » (#EDE9FE / #6D28D9, z 3), « FA » (#DDE1FF / #0B18C9, z 2), « SD » (#FBEFD0 / #8A5A00, z 1) + span (12/18 #667085) « +128 inscrits »
  - div : width 100%; margin-top 18px → selon l’état `f_i1` :
    - non inscrite (défaut) : button type="button" **BTN-TONAL + width 100%** → span « Je m’inscris à la session » (onClick `ins1` : ouvre le dialogue « inscription » **et** passe à l’état inscrite)
    - inscrite : CONFIRMATION-INLINE → COCHE + « Vous êtes inscrite »
- La carte n’est pas un lien ; aucune cible vers la session elle-même (seul « Événements » mène ailleurs).

### 3.7 « Objectif de la semaine » — [lot 6]
- GROUPE → EN-TÊTE-GROUPE : h2 « Objectif de la semaine » + BADGE vert « 3 / 5 jours » ; pas de lien.
- CARTE-BLOC :
  - p : margin 0; font-size 14px; line-height 22px; color #232326; text-wrap pretty — « Apprendre au moins 20 minutes, 5 jours cette semaine. »
  - div role="group" aria-label="Jours de la semaine" : display flex; gap 6px; margin-top 16px → 7 BTN-JOUR :
    « L » (aria-label « Lundi, objectif atteint », atteint) · « M » (« Mardi, objectif atteint », atteint) · « M » (« Mercredi, objectif atteint », atteint) · « J » (« Jeudi ») · « V » (« Vendredi ») · « S » (« Samedi ») · « D » (« Dimanche »)
  - PROGRESS aria-label="Objectif de la semaine" aria-valuenow="60" : margin-top 18px
  - div méta : display flex; flex-wrap wrap; align-items center; gap 7px; font-size 12px; line-height 18px; color #667085; margin-top 8px → « Points gagnés cette semaine : 165 » · DOT · « Niveau 4 »

### 3.8 « Activité récente » — [lot 3 pour les types maquettés ; flux général lot 6]
- GROUPE → EN-TÊTE-GROUPE : h2 « Activité récente » seul (ni badge, ni lien).
- BOÎTE-LISTE de 3 LIGNE-ACTIVITÉ (div, **non cliquables**) :

| # | TUILE 44/13 (bg / fg) | Icône 20px | Titre | Sous-titre | Horodatage |
|---|---|---|---|---|---|
| 1 | #DDF3E4 / #17663A | COCHE-CERCLE (CheckmarkCircle02Icon) | Exercice validé | Word · Mise en page du mémoire | Il y a 2 h |
| 2 | #DDE1FF / #0B18C9 | CERTIFICAT (Certificate01Icon) | Nouveau certificat | Zotero : gérer ses références | Hier |
| 3 | #E9EFFB / #232326 | QUIZ (Quiz01Icon) | Quiz réussi · 90 % | Canva · Module 1 | Il y a 2 jours |

### 3.9 « Recommandé pour vous » — [lot 1, version simple]
- GROUPE → EN-TÊTE-GROUPE : h2 « Recommandé pour vous » (sans BADGE) ; à droite LIEN-ACTION « Tout voir » → NdCatalogue.
- INTRO-GROUPE « Vous avez terminé Zotero. Découvrez maintenant la méthodologie du mémoire. »
- GRILLE-3 de 3 CARTE-CATALOGUE → NdFormation (fiche connectée), titres **h2** avec `title` :

| Pile | Badge | Titre | Description | Note | Durée | Niveau |
|---|---|---|---|---|---|---|
| bleu | Populaire (ambre) | Méthodologie du mémoire | De la problématique à la rédaction : la méthode pour avancer sans vous perdre. | 4,9 (143) | 7 h 45 | Intermédiaire |
| violet | Nouveau (bleu) | L’intelligence artificielle au service de vos études | Utilisez l’IA pour réviser, résumer et rédiger, en gardant un regard critique. | 4,8 (37) | 3 h 30 | Débutant |
| orange | Populaire (ambre) | Lancer son activité de freelance | Offre, tarifs, premiers clients : les étapes pour démarrer une activité en ligne. | 4,8 (69) | 6 h 00 | Intermédiaire |
- Mêmes cartes et mêmes données que « Recommandé pour vous » de NdRechercheVide (annexe 1.9 §7). Les notes relèvent de la tâche 1.11 (avis) : `CatalogCard` masque déjà la note sans avis.

### 3.10 Dialogues
**a) « Vous êtes inscrite à la session » (`ov = "inscription"`) — [lot 5]**
- DIALOGUE aria-labelledby="dlgc" : TUILE 48/14 #DDF3E4 / #17663A → CALENDRIER 22px
- h2 « Vous êtes inscrite à la session »
- p « Excel avancé : analyse de données, samedi 24 octobre à 15 h 00, sur Google Meet. Un rappel vous sera envoyé la veille. »
- actions : button BTN-SECONDARY → CALENDRIER 18px + span « Ajouter à mon agenda » (onClick `close`) ; button BTN-PRIMARY-MD → span « Fermer » (onClick `close`)

**b) « Votre formule Standard expire dans 5 jours » (`ov = "renouveler"`) — [lot 2]**
- DIALOGUE aria-labelledby="dlgd" : TUILE 48/14 #FBEFD0 / #8A5A00 → ALERTE 22px
- h2 « Votre formule Standard expire dans 5 jours » (**sans point**, contrairement au bandeau)
- p « Renouvelez pour garder l’accès à vos formations. Rien ne sera supprimé si vous attendez. »
- actions : button BTN-SECONDARY → span « Plus tard » (`close`) ; a → NdAbonnement BTN-PRIMARY-MD → span « Renouveler »

### 3.11 Responsive (bureau)
- TITRE-PAGE : flex-wrap (bouton sous le titre).
- BANDEAU-ALERTE : flex-wrap (bouton « Renouveler » sous le texte quand le texte < 240px).
- GRILLE-4 : 4 → 3 → 2 → 1 colonnes (seuils §0.2).
- DEUX-COLONNES : côte à côte au-delà de 804px de contenu ; en dessous, la colonne droite (session, objectif) passe **sous** la colonne gauche (continuer, à faire), dans l’ordre du DOM.
- GRILLE-3 (recommandées) : 3 → 2 → 1 colonnes.
- Lignes de liste : pas de wrap ; textes sans ellipsis (retour à la ligne naturel).
- Méta des cartes : flex-wrap partout sur cette page.

---

## 4. NdMobAccueil — téléphone (zone qui défile)

### 4.1 Pile
- div display flex; flex-direction column; **gap 24px**; min-width 0 :
  1. h1 « Bonjour, Aïcha » : styles du h1 de TITRE-PAGE mais **font-size 28px; line-height 36px** (déclarés 32/40 puis surchargés) — **[lot 1]**
  2. Bandeau d’expiration (§4.2) — **[lot 2]**
  3. BLOC-MOB « Continuer l’apprentissage » (§4.3) — **[lot 1]**
  4. BLOC-MOB « Prochaine session live » (§4.4) — **[lot 5]**
  5. BLOC-MOB « À faire » (§4.5) — **[lot 1 / 3]**
- **Absents** du téléphone : sous-titre, « Explorer le catalogue », TRAIT-PAGE, tuiles indicateurs, « Objectif de la semaine », « Activité récente », « Recommandé pour vous », LIEN-ACTION des en-têtes (« Mes formations », « Événements »).
- **Ordre différent** du bureau : session live **avant** « À faire ».

### 4.2 Bandeau d’expiration — [lot 2]
- BANDEAU-ALERTE avec surcharges : **flex-wrap nowrap; gap 10px; padding 12px 12px 12px 14px**.
- Texte : « Votre formule Standard expire dans 5 jours. » (U+00A0 entre « 5 » et « jours », **pas de strong**, pas de seconde phrase).
- a → **NdMobPaiement** (pas de dialogue) : BTN-SECONDARY + flex none + **height 44px** (déclaré 42 puis 44) → span « Renouveler ».

### 4.3 « Continuer l’apprentissage » — [lot 1]
- BLOC-MOB gap **12px** → TITRE-SECTION-MOB h2 « Continuer l’apprentissage » (rien à droite).
- Carte : div box-sizing border-box; display flex; flex-direction column; **padding 18px 16px 16px**; border 1px solid #EAEEF7; background #FFFFFF; border-radius 16px; min-width 0 (largeur 342px) :
  - div : display flex; align-items flex-start; **gap 14px** → PILE-BLEU 48px (**sans margin-left**) + div flex 1; min-width 0 (pas de flex column) → h3 (16/24 600 #1D1D1F) « Maîtriser Microsoft Excel » + p **margin-top 2px; font-size 14px; line-height 22px**; color #667085; text-wrap pretty « Module 3 · Les tableaux croisés dynamiques · 12 min »
  - **pas de BADGE** de parcours
  - PROGRESS aria-label="Progression" aria-valuenow="68" : **margin-top 16px**
  - méta identique au bureau (flex-wrap ; « 68 % terminé » · HORLOGE « 2 h restantes »)
  - a → **NdMobLecon** : **BTN-PRIMARY** (48px) + width 100%; margin-top 16px → span « Reprendre la leçon »
  - **pas de « Voir le parcours »**

### 4.4 « Prochaine session live » — [lot 5]
- BLOC-MOB gap **0px** → TITRE-SECTION-MOB h2 « Prochaine session live » + BADGE bleu « Dans 2 jours » à droite.
- a LIGNE-LISTE → NdEvenements (page bureau ; hover #F2F6FD ; FOCUS), **sans boîte ni bordure** : TUILE 44/13 #DDE1FF / #0B18C9 → VIDÉO 20px · TEXTES-LIGNE « Excel avancé : analyse de données » / « Samedi 24 octobre · 15 h 00 » · **pas de chevron**.

### 4.5 « À faire » — [lot 1 / 3]
- BLOC-MOB gap **0px** → TITRE-SECTION-MOB h2 « À faire » + span (font-size 12px; line-height 18px; color #667085) « 3 éléments » — **texte simple, pas un BADGE**.
- div display flex; flex-direction column → 3 LIGNE-ACTION séparées par SÉPARATEUR, **sans BOÎTE-LISTE** (pas de bordure, pas de padding 4px 15px) :
  1. → NdExercice (page bureau) : TUILE ambre → EXERCICE · « Exercice à corriger » / « Excel · Tableau des ventes » · **pas de badge « À corriger »** · CHEVRON
  2. → **NdMobQuiz** : TUILE neutre → QUIZ · « Quiz du module 3 » / « Excel · 4 questions » · CHEVRON
  3. → **NdMobLecon** : TUILE neutre → PLAY-CERCLE · « Leçon suivante » / « Canva · Créer une affiche » · CHEVRON

### 4.6 Logique
- Aucun état (`OV`, `GROUPS`, `FLAGS` vides) : pas de dialogue, pas d’inscription à la session sur téléphone.

---

## 5. Icônes

Hugeicons stroke-rounded (trait 1.5px, `fill: none; stroke: currentColor`, viewBox 24) sauf mention. Noms **vérifiés** : points de départ des tracés comparés à ceux de `@hugeicons/core-free-icons` (installé dans `web/`), et sous-tracés fusionnés vérifiés à la main. Seules les icônes du contenu de page sont listées (celles du shell sont déjà en place).

| Clé | Nom exact | Glyphe | Tailles / couleurs (où) |
|---|---|---|---|
| ALERTE | Alert02Icon | triangle + « ! » | 22px #8A5A00 (bandeau, tuile du dialogue renouveler) |
| CIBLE | Target02Icon | cible + flèche | 18px #232326 (tuile « Progression globale ») |
| COURS | CourseIcon | toque sur livre | 18px #0B18C9 (tuile « Formations en cours ») |
| CERTIFICAT | Certificate01Icon | document + médaille | 18px #17663A (tuile Certificats) ; 20px #0B18C9 (activité « Nouveau certificat ») |
| FEU | FireIcon | flamme | 18px #8A5A00 (tuile Série) |
| HORLOGE | Clock01Icon | horloge | 18px #667085, margin 0 -1.5px (méta « Continuer » et cartes recommandées) |
| EXERCICE | AssignmentsIcon | cahier + coche | 20px #8A5A00 (« Exercice à corriger ») |
| QUIZ | Quiz01Icon (= QuizIcon) | badge dentelé + « ? » | 20px #232326 (« Quiz du module 3 », « Quiz réussi ») |
| PLAY-CERCLE | PlayCircleIcon | triangle arrondi dans un cercle | 20px #232326 (« Leçon suivante ») |
| CHEVRON-DROITE | ArrowRight01Icon | chevron › | 18px #667085 (lignes « À faire ») |
| VIDÉO | Video01Icon | caméra | 18px #667085 (« Google Meet », bureau) ; 20px #0B18C9 (tuile session, téléphone) |
| FORMATEUR | TeachingIcon | personne au tableau | 18px #667085 (« Dr Mireille Adjovi ») |
| COCHE | Tick02Icon | coche simple | 18px #17663A (« Vous êtes inscrite ») |
| COCHE-CERCLE | CheckmarkCircle02Icon | coche dans un cercle | 20px #17663A (activité « Exercice validé ») |
| ÉTOILE | StarIcon | étoile contour | 16px #667085, margin 0 -1px (cartes recommandées) |
| CALENDRIER | Calendar03Icon | calendrier + points | 22px #17663A (tuile du dialogue inscription) ; 18px #232326 (« Ajouter à mon agenda ») |
| CROIX | Cancel01Icon | croix | 18px #667085 (fermer les dialogues) |
| CLOCHE | Notification02Icon | cloche | 20px #232326 (header téléphone) |
| PILE-* | illustration maison (`CourseIllustration`) | 3 losanges | 48px |

Toutes les icônes sont `aria-hidden="true"`, `flex-shrink: 0; display: block`. Les icônes Phosphor (pleines, viewBox 256) n’apparaissent que dans le shell (éclair de la série, cadeau des points, cloche et avatar du header bureau).

---

## 6. États interactifs et ARIA

### 6.1 Logique maquettée
- NdAccueil : état `ov` ∈ {menu, notif, logout, **inscription**, **renouveler**} (défaut null) et drapeau `f_i1` (défaut false).
  - « Renouveler » (bandeau) → `go.renouveler` ; « Plus tard », « Fermer » → `close` ; « Renouveler » du dialogue = lien NdAbonnement.
  - « Je m’inscris à la session » → `ins1` = `{ ov: "inscription", f_i1: true }` : le dialogue s’ouvre et, derrière, le bouton est déjà remplacé par « Vous êtes inscrite » ; « Ajouter à mon agenda » et « Fermer » font seulement `close` (aucun fichier .ics).
  - Les BTN-JOUR n’ont **aucune action**.
- NdMobAccueil : aucun état.

### 6.2 États visuels déclarés
- **hover** : LIGNE-ACTION → #F2F6FD ; CARTE-CATALOGUE → bordure #D2D9E8 ; LIEN-ACTION → souligné ; BTN-PRIMARY(-MD) → #08149F ; BTN-SECONDARY et BTN-SM-CONTOUR → #F2F6FD ; BTN-TONAL → #DEE6F6 ; croix des dialogues → #E9EFFB. **Pas de hover** : TUILE-STAT, CARTE-BLOC, LIGNE-ACTIVITÉ, BTN-JOUR.
- **focus-visible** (FOCUS) : boutons, LIGNE-ACTION, CARTE-CATALOGUE, BTN-JOUR, croix. **Manquants** : LIEN-ACTION (« Mes formations », « Événements », « Tout voir ») ; liens de la barre du bas (téléphone).
- **aria-pressed** : BTN-JOUR (3 « true », 4 « false »).
- **aria-current="page"** : « Accueil » (barre latérale bureau, barre du bas téléphone).
- **disabled**, **aria-disabled**, **aria-selected**, **aria-live** : aucun.

### 6.3 Attributs ARIA et rôles présents (contenu de page)
- `role="status"` (bandeau) ; `role="progressbar" aria-label="Progression"` (carte Continuer) et `aria-label="Objectif de la semaine"` ; `role="group" aria-label="Jours de la semaine"` ; `aria-label` des 7 jours ; `aria-hidden="true"` sur la TUILE-DATE ; `section` par GROUPE (sans `aria-labelledby`) ; dialogues `role="dialog" aria-modal="true" aria-labelledby` ; `aria-label="Fermer"` ; `title` sur les h2 des cartes recommandées.

---

## 7. Version lot 1 : ce qui reste et comment la page se recompose (proposition)

### 7.1 Bureau — pile au lot 1
1. TITRE-PAGE (h1 « Bonjour, {prénom} », p, BTN-SECONDARY « Explorer le catalogue » → `/formations`)
2. TRAIT-PAGE
3. ZONE-CONTENU → div flex column gap 32px :
   1. Tuiles « Progression globale » et « Formations en cours » (le div gap 20px ne contient plus que la grille, le bandeau ayant disparu)
   2. « Continuer l’apprentissage » et « À faire » (disposition à trancher, §10 Q1)
   3. « Recommandé pour vous »
- Ce qui disparaît : bandeau (lot 2), tuiles Certificats (3) et Série (6), toute la colonne droite (session live : 5 ; objectif : 6), « Activité récente » (3/6), lignes exercice et quiz de « À faire » (3), dialogues.
- Conséquences de mise en page si l’on garde les conteneurs du design tels quels :
  - **GRILLE-4 avec 2 tuiles** : `auto-fill` garde 4 pistes → deux tuiles de 229,75px à gauche, **moitié droite vide**.
  - **DEUX-COLONNES sans colonne droite** : la colonne gauche (flex 999) prend toute la largeur (979px) ; la carte Continuer devient très large (boutons à gauche, grand vide à droite).
- Deux recompositions possibles (à choisir, §10 Q1) :
  - **A — garder deux colonnes** : gauche « Continuer l’apprentissage » (flex 999 1 420px), droite « À faire » (flex 1 1 360px) ; tuiles sur une grille de 2 colonnes : `repeat(auto-fill, minmax(min(100%, max(228px, calc((100% - 20px) / 2))), 1fr))` (479,5px chacune à 1440). Au lot 5/6, « À faire » redescend sous « Continuer » et la colonne droite retrouve session et objectif.
  - **B — une colonne** : tuiles dans GRILLE-4 inchangée (moitié vide), puis « Continuer », « À faire », « Recommandé » pleine largeur. Plus simple, mais la carte Continuer s’étire sur 979px.

### 7.2 Téléphone — pile au lot 1
- h1 → « Continuer l’apprentissage » → « À faire » (lignes « Leçon suivante » seulement, cibles = leçon dans l’interface de cours, une seule adresse qui s’adapte).
- Les tuiles et « Recommandé pour vous » n’existent pas dans NdMobAccueil : les ajouter sur téléphone (tuiles en 2 colonnes de 163px, cartes recommandées pleine largeur en colonne gap 10px comme NdMobFormations) ou les masquer sous 1024px (§10 Q11).

### 7.3 Données nécessaires au lot 1
- Prénom (déjà lu par `getShellUser`).
- Formations commencées du compte (`formationsSuivies`) : pourcentage, temps restant, état, `aReprendre`, dernière visite, parcours principal (couleur + `nomCourt` pour le BADGE).
- Carte Continuer : la formation de la **dernière leçon ouverte** (plus récente `vueLe`), sa leçon à reprendre (`aReprendre`) : numéro et titre de module, titre et durée de la leçon (format « 12 min »), lien `/formations/{slug}/lecons/{id}` ; lien « Voir le parcours » (`/parcours`).
- « À faire » : pour chaque autre formation en cours, sa leçon à reprendre (nom court de la formation + titre de la leçon) ; nombre d’éléments.
- Tuiles : moyenne des pourcentages des formations commencées (arrondie) ; nombre de formations en cours ; dénominateur de « Sur N formations » (§10 Q3).
- Recommandé : cartes catalogue (`CarteCatalogue`) des formations des mêmes parcours non commencées ; formation terminée la plus récente pour la phrase d’intro (si elle est gardée).

---

## 8. États non maquettés (proposition)

La maquette ne montre qu’un compte bien rempli. **Aucun état vide n’est maquetté.** Propositions, composées uniquement d’éléments existants :

### 8.1 Aucune formation commencée (exigé par la spec §8)
- TITRE-PAGE et TRAIT-PAGE inchangés (h1, p, « Explorer le catalogue »).
- ZONE-CONTENU → div flex column gap 32px :
  1. **ÉTAT-VIDE encadré** (= `EmptyState` actuel, gabarit de NdRechercheVide : boîte border 1px #EAEEF7, radius 16, padding 0 → ÉTAT-VIDE padding 48px 24px) :
     - TUILE 56/16 #E9EFFB / #232326 → icône 26px : `GiftIcon` (icône du menu « Formations gratuites ») ; ou, comme le paravent actuel de la page, `CourseIllustration` 64px.
     - titre (h3 dans l’app) — **texte proposé** : « Commencez votre première formation »
     - texte — **texte proposé** : « Les formations gratuites sont ouvertes à tous : choisissez-en une et suivez la première leçon. »
     - action : a → `/formations-gratuites` **BTN-PRIMARY-MD** → « Voir les formations gratuites » (une seule action : « Explorer le catalogue » est déjà dans l’en-tête).
  2. GROUPE « Formations gratuites » (**texte proposé**) : EN-TÊTE-GROUPE sans badge + LIEN-ACTION « Tout voir » → `/formations-gratuites` ; GRILLE-3 de 3 CARTE-CATALOGUE au plus (badge vert « Gratuit » de `badgeDeCarte`).
- Pas de tuiles (0 % et 0 n’apportent rien), pas de « Continuer », pas de « À faire », pas de « Recommandé » (remplacé par les gratuites).
- Téléphone : même pile en une colonne (largeur 342px ; texte de l’ÉTAT-VIDE sur 294px) ; cartes en colonne gap 10px.

### 8.2 Une seule formation commencée
- « Continuer » la montre ; « À faire » serait vide si la formation de « Continuer » en est exclue (§10 Q5) → masquer le groupe.
- Tuiles : « 1 » formation en cours ; progression globale = son pourcentage.

### 8.3 Toutes les formations commencées sont terminées
- `aReprendre` est null : rien à reprendre. Proposition : masquer « Continuer » et « À faire », garder les tuiles (100 %, 0 en cours) et « Recommandé » ; ou remplacer « Continuer » par un `Banner tone="reussite"` (« Bravo… ») — **non maquetté**, textes à écrire (§10 Q6).

### 8.4 Rien « À faire »
- Masquer le GROUPE (proposé), plutôt qu’un ÉTAT-VIDE dans la boîte (la maquette n’en a pas).

### 8.5 Formations verrouillées (archivées) commencées
- Les exclure de « Continuer » et de « À faire » (aucune leçon à reprendre) ; à trancher pour la moyenne et le compteur des tuiles (§10 Q3).

---

## 9. Accessibilité

### 9.1 Titres
- Bureau : h1 « Bonjour, Aïcha » → h2 par GROUPE (Continuer, À faire, Prochaine session live, Objectif, Activité récente, Recommandé pour vous) → h3 dans la carte Continuer (« Maîtriser Microsoft Excel ») et dans la carte session (« Excel avancé : analyse de données »).
- **Incohérence** : les titres des cartes recommandées sont des **h2** sous le h2 « Recommandé pour vous » (même défaut que la recherche, annexe 1.9 §12.3-11) → h3 conseillé (`CarteFormation` force `titleAs="h2"` : ajouter un paramètre).
- Les h2 des dialogues sont hors du `main` (corrects pour un dialogue modal).
- Téléphone : h1 → h2 (Continuer, session, À faire) → h3 (carte Continuer). Les blocs sont des `div`, pas des `section`.
- Les tuiles n’ont pas de titre : « Progression globale » etc. sont des `span` (correct, mais voir 9.3).

### 9.2 Repères (landmarks)
- `header`, `nav aria-label="Navigation principale"` (bureau) / `aria-label="Navigation"` (téléphone), `main` (bureau seulement : **NdMobAccueil n’a pas de `main`**, la zone qui défile est un div — l’`AppShell` de l’app en a un).
- `section` sans `aria-labelledby` : non annoncées comme régions → relier chaque `section` à son h2.

### 9.3 ARIA et sémantique manquantes
- Tuiles : valeur et libellé non reliés ; un lecteur d’écran lit « Progression globale 72 % +12 % ce mois » à plat. Proposer une liste de définitions (`dl` / `dt` / `dd`) ou un `aria-labelledby`.
- Barres de progression : `aria-label="Progression"` générique → « Progression de {titre} » (comme `CourseCard`).
- « Reprendre la leçon » et « Voir le parcours » : nom accessible sans la formation → `aria-describedby` vers le h3.
- « À faire » et « Activité récente » : pas de liste (`ul` / `li`) ; « Leçon suivante » répété dans plusieurs lignes au lot 1 → le sous-titre doit rester dans le nom du lien (c’est le cas, tout le texte est dans le `a`).
- BTN-JOUR : boutons bascules `aria-pressed` **sans action** → fausse affordance ; un simple affichage (liste de 7 éléments avec texte masqué « atteint / non atteint ») conviendrait mieux (lot 6).
- PILE-AVATARS : initiales lues « RH FA SD » sans contexte → `aria-hidden` ou `role="group"` + libellé (« Participantes inscrites ») — `AvatarGroup` accepte `label` (lot 5).
- « Vous êtes inscrite » : changement d’état non annoncé (pas d’`aria-live`) ; le dialogue le dit, mais le retour du focus après fermeture n’est pas maquetté.
- `role="status"` du bandeau présent dès le chargement : pas annoncé à l’arrivée (acceptable ; il n’a pas besoin de l’être).
- Pastille série du header téléphone : `div` avec `title` seulement, non focalisable → information inaccessible au clavier et au lecteur d’écran (shell, lot 6).

### 9.4 Focus manquants
- LIEN-ACTION « Mes formations », « Événements », « Tout voir » (bureau) : pas de focus-visible (déjà corrigé dans le `Groupe` de l’app par `focus-etudium`).
- Liens de la barre du bas (téléphone) : pas de focus-visible déclaré (à vérifier dans `MobileNav`).
- Cibles tactiles : toutes ≥ 44px sur téléphone (lignes 72px, bouton 48px, « Renouveler » 44px) ; BTN-SM-CONTOUR 34px (bureau seulement).

---

## 10. Incohérences et questions ouvertes

### 10.1 Écarts bureau ↔ téléphone
1. Ordre : bureau Continuer → À faire (gauche), Session → Objectif (droite) ; téléphone Continuer → **Session** → À faire.
2. Blocs absents du téléphone : sous-titre, « Explorer le catalogue », tuiles, objectif, activité, recommandées, liens « Mes formations » / « Événements ».
3. Carte Continuer : badge de parcours et « Voir le parcours » absents sur téléphone ; bouton 48px pleine largeur ; padding 18/16/16 ; sous-titre 14/22 au lieu de 13/20.
4. « À faire » : boîte bordée + badge « 3 éléments » + badge « À corriger » (bureau) ↔ lignes nues + texte « 3 éléments » + pas de badge « À corriger » (téléphone).
5. Session : carte complète (bureau) ↔ une ligne + badge « Dans 2 jours » (téléphone).
6. Bandeau : texte complet + dialogue (bureau) ↔ phrase courte + lien direct NdMobPaiement (téléphone).
7. Cibles : NdLecon / NdQuiz ↔ NdMobLecon / NdMobQuiz ; NdExercice et NdEvenements (pages bureau) depuis le téléphone.

### 10.2 Chiffres et textes de remplacement
8. **« 72 % »** ne correspond à aucun calcul sur les données de Mes formations (annexe 1.9 §2.5) : moyenne des 6 formations commencées au-delà de 0 % (68, 100, 100, 72, 20, 35) = 65,8 % ; des 8 formations listées = 49,4 % ; des 3 « En cours » = 53,3 %. Valeur de remplacement.
9. **« 4 » formations en cours « Sur 10 formations »** : Mes formations n’en compte que 3 « En cours » (Excel, PowerPoint, Canva) — 4 si l’on ajoute Marketing (verrouillée, 35 %) ; « 10 » = tout le catalogue, alors que Mes formations en liste 8.
10. « +12 % ce mois » : retiré au lot 1 (pas d’historique) → tuile sans indice, plus basse que sa voisine (126 vs 146px) si « Formations en cours » garde le sien.
11. « Module 3 · Les tableaux croisés dynamiques · 12 min » : « Les tableaux croisés dynamiques » est-il le titre du module ou de la leçon ? « 12 min » = durée de la leçon ou temps restant dans la leçon ? Le titre de la carte est celui de la **formation**, pas de la leçon à reprendre.
12. Noms courts « Excel », « Canva » dans « À faire » et « Activité » : aucun champ « nom court » pour les formations (seuls les parcours ont `nomCourt`).
13. « Vous avez terminé Zotero. Découvrez maintenant la méthodologie du mémoire. » : phrase écrite pour une seule carte (Méthodologie), alors que la grille en montre trois de trois parcours différents.
14. « Recommandé pour vous » contredit la règle de la spec (« même parcours, pas encore commencées ») : IA (Digital) et Freelance (Business) ne sont pas du parcours de Zotero ; Méthodologie et IA sont **déjà** dans Mes formations (0 %, donc commencées pour l’app). Avec la règle de la spec, Aïcha n’aurait qu’une recommandation (Méthodologie) — voire aucune.
15. Activité « Exercice validé · Word · Mise en page du mémoire · Il y a 2 h » ↔ notification du header « Exercice validé · Votre tableau croisé dynamique a été validé par Dr Adjovi · Il y a 2 h » (Excel) : deux exercices différents pour le même événement.
16. « Vous êtes inscrite » / « Vous êtes inscrite à la session » : accord au féminin codé en dur (le profil n’a pas de genre) → formulation neutre à prévoir (lot 5).
17. Dates cohérentes entre elles (24 octobre 2026 = samedi ; « Dans 2 jours » et objectif L-M-M atteints, J non atteint → maquette datée du jeudi 22 octobre) mais « Samedi 24 octobre · 15 h 00 » est répété dans la carte et dans la TUILE-DATE.
18. Dialogue renouveler : h2 sans point final, bandeau avec point ; « Rien ne sera supprimé. » (bandeau) ↔ « Rien ne sera supprimé si vous attendez. » (dialogue).
19. Artefacts de styles : marges et tailles déclarées deux fois (h1 et h2 téléphone, bandeau téléphone `flex-wrap`/`gap`/`padding`, « Renouveler » 42 puis 44px, INTRO-GROUPE `margin` 0 puis -8px, sous-titre téléphone `margin` 0 puis `margin-top` 2px) ; `gap: 0px` des BLOC-MOB ; `padding-right: 0px` des h2 de dialogue ; liens Communauté et Certificats de la barre du bas vers NdMobAccueil.

### 10.3 Cibles de liens
20. « Voir le parcours » → NdParcours : la page `/parcours` de l’app n’accepte pas de paramètre d’onglet → elle s’ouvre sur le premier parcours, pas forcément celui de la formation.
21. « Reprendre la leçon » → leçon à reprendre (`aReprendre`) : la spec dit « dernière leçon ouverte » ; si elle est terminée, l’app propose la suivante — c’est bien ce que veut « Reprendre » ?
22. Trois liens vers le catalogue (« Ajouter une formation » du header, « Explorer le catalogue », « Tout voir ») ; « Tout voir » pourrait plutôt ouvrir le catalogue filtré sur le parcours recommandé (`/formations?parcours=…`).
23. La carte session n’a pas de lien vers la session elle-même (seulement « Événements ») ; la ligne téléphone mène à la page bureau NdEvenements.

### 10.4 États non maquettés et recomposition
24. Aucune formation commencée : composition proposée au §8.1 (textes à valider).
25. Une seule formation : « À faire » vide si l’on exclut la formation de « Continuer » (§8.2).
26. Toutes terminées : que montre « Continuer » ? (§8.3)
27. Rien « À faire » : groupe masqué ou message ? (§8.4)
28. Plusieurs formations en cours : nombre maximal de lignes « Leçon suivante » (la maquette en montre une seule ; « 3 éléments » au total) ? ordre (dernière visite) ?
29. Moins de 3 recommandations (ou aucune) : grille incomplète, ou complétée par d’autres formations (gratuites, populaires), ou groupe masqué ?
30. Colonnes vides au lot 1 : voir §7.1 (tuiles moitié vides, colonne droite disparue).

### 10.5 Les 5 questions les plus importantes
- **Q1 — Mise en page bureau au lot 1** : deux colonnes « Continuer | À faire » (proposition A, §7.1) ou une seule colonne (B) ? Tuiles en grille de 2 (480px chacune) ou GRILLE-4 à moitié vide ?
- **Q2 — Recommandé pour vous** : règle exacte (même parcours que quoi ? la formation de « Continuer », tous les parcours commencés ?), complément si moins de 3, sort des formations commencées à 0 %, phrase d’introduction gardée (dynamique) ou supprimée ?
- **Q3 — Chiffres des tuiles** : « Formations en cours » compte-t-il les verrouillées et celles à 0 % ? « Sur N » = formations commencées, accessibles, ou tout le catalogue ? La moyenne « Progression globale » inclut-elle les terminées (100 %) et les verrouillées ? Quel indice sous « Progression globale » (aucun, ou un texte du type « Moyenne de vos N formations ») ?
- **Q4 — Continuer / À faire** : la formation de « Continuer » est-elle exclue de « À faire » (maquette : oui, Excel n’y est pas) ? Sous-titre de la carte = « Module {n} · {titre de la leçon} · {durée de la leçon} » ? Noms courts des formations (nouveau champ) ou titres complets tronqués ?
- **Q5 — États vides** : composition du §8.1 (ÉTAT-VIDE + formations gratuites) et ses textes ; comportement quand tout est terminé ; téléphone : ajoute-t-on tuiles et recommandées absentes de NdMobAccueil ?

### 10.6 Autres questions
- Q6 : textes de l’état « toutes terminées » (§8.3).
- Q7 : « Explorer le catalogue » en contour (maquette) au lieu de principal (page actuelle) : confirmer.
- Q8 : la phrase INTRO-GROUPE existe-t-elle sans formation terminée ?
- Q9 : titres h3 pour les cartes recommandées (au lieu de h2) — à appliquer aussi à la recherche ?
- Q10 : `ListRow` à 72px (maquette) au lieu de 76px — corriger le composant (touche aussi le back-office et le menu téléphone) ou suivre `LigneLecon` ?
- Q11 : téléphone — tuiles et recommandées : ajoutées ou masquées ?
- Q12 : téléphone — loupe du header (app) absente de NdMobAccueil : la garder (cohérent avec les autres pages) ?

---

## 11. Inventaire des textes (verbatim, contenu de page uniquement)

**NdAccueil (bureau)** : Bonjour, Aïcha | Continuez votre apprentissage et atteignez vos objectifs. | Explorer le catalogue | Votre formule Standard expire dans 5 jours. | Renouvelez pour garder l’accès à vos formations. Rien ne sera supprimé. | Renouveler | Progression globale | 72 % | +12 % ce mois | Formations en cours | 4 | Sur 10 formations | Certificats obtenus | 2 | Word et Zotero | Série d’apprentissage | 8 jours | Continuez comme ça | Continuer l’apprentissage | Mes formations | Maîtriser Microsoft Excel | Module 3 · Les tableaux croisés dynamiques · 12 min | Académique | 68 % terminé | 2 h restantes | Reprendre la leçon | Voir le parcours | À faire | 3 éléments | Exercice à corriger | Excel · Tableau des ventes | À corriger | Quiz du module 3 | Excel · 4 questions | Leçon suivante | Canva · Créer une affiche | Prochaine session live | Événements | OCT. | 24 | Excel avancé : analyse de données | Samedi 24 octobre · 15 h 00 | Google Meet | Dr Mireille Adjovi | RH | FA | SD | +128 inscrits | Je m’inscris à la session | Vous êtes inscrite | Objectif de la semaine | 3 / 5 jours | Apprendre au moins 20 minutes, 5 jours cette semaine. | L | M | M | J | V | S | D | Points gagnés cette semaine : 165 | Niveau 4 | Activité récente | Exercice validé | Word · Mise en page du mémoire | Il y a 2 h | Nouveau certificat | Zotero : gérer ses références | Hier | Quiz réussi · 90 % | Canva · Module 1 | Il y a 2 jours | Recommandé pour vous | Tout voir | Vous avez terminé Zotero. Découvrez maintenant la méthodologie du mémoire. | Populaire | Méthodologie du mémoire | De la problématique à la rédaction : la méthode pour avancer sans vous perdre. | 4,9 (143) | 7 h 45 | Intermédiaire | Nouveau | L’intelligence artificielle au service de vos études | Utilisez l’IA pour réviser, résumer et rédiger, en gardant un regard critique. | 4,8 (37) | 3 h 30 | Débutant | Lancer son activité de freelance | Offre, tarifs, premiers clients : les étapes pour démarrer une activité en ligne. | 4,8 (69) | 6 h 00
(aria : Progression | Jours de la semaine | Lundi, objectif atteint | Mardi, objectif atteint | Mercredi, objectif atteint | Jeudi | Vendredi | Samedi | Dimanche | Objectif de la semaine)
(title : Méthodologie du mémoire | L’intelligence artificielle au service de vos études | Lancer son activité de freelance)

**Dialogue inscription (NdAccueil, `ov = "inscription"`)** : Vous êtes inscrite à la session | Excel avancé : analyse de données, samedi 24 octobre à 15 h 00, sur Google Meet. Un rappel vous sera envoyé la veille. | Ajouter à mon agenda | Fermer (aria : Fermer)

**Dialogue renouvellement (NdAccueil, `ov = "renouveler"`)** : Votre formule Standard expire dans 5 jours | Renouvelez pour garder l’accès à vos formations. Rien ne sera supprimé si vous attendez. | Plus tard | Renouveler (aria : Fermer)

**Rappels du shell (bureau)** : 8 (title « Série d’apprentissage : 8 jours ») | 165 (title « Points gagnés cette semaine : 165 ») | Nouveau (Événements) | 1 à corriger (Exercices) — le panneau des notifications, le menu du profil et « Se déconnecter ? » sont ceux du shell (annexe 1.9 §8).

**NdMobAccueil (téléphone)** : 8 (série, title « Série d’apprentissage : 8 jours ») | Bonjour, Aïcha | Votre formule Standard expire dans 5 jours. (« 5 » + U+00A0 + « jours ») | Renouveler | Continuer l’apprentissage | Maîtriser Microsoft Excel | Module 3 · Les tableaux croisés dynamiques · 12 min | 68 % terminé | 2 h restantes | Reprendre la leçon | Prochaine session live | Dans 2 jours | Excel avancé : analyse de données | Samedi 24 octobre · 15 h 00 | À faire | 3 éléments | Exercice à corriger | Excel · Tableau des ventes | Quiz du module 3 | Excel · 4 questions | Leçon suivante | Canva · Créer une affiche | Accueil | Formations | Communauté | Certificats | Profil
(aria : Étudium, accueil | Notifications | Progression | Navigation)

**Textes proposés, absents des maquettes (état vide §8.1, à valider)** : Commencez votre première formation | Les formations gratuites sont ouvertes à tous : choisissez-en une et suivez la première leçon. | Voir les formations gratuites | Formations gratuites | Tout voir
