# Tâche 1.12 — Annexe design : landing page publique `/` et FAQ

> Valeurs relevées dans la maquette `NdLanding` du design de référence. La spec du lot 1 (§1 Q10 et Q11, §2 « En-tête public », §9) dit ce qui est retenu au lot 1 ; en cas de conflit, le plan de la tâche et la spec l’emportent. Cette annexe décrit **tout** le design et marque chaque bloc et chaque élément : **[lot 1]**, **[masqué (Q11)]**, **[sans prix (Q10)]** ou **[lot N]** (arrive avec son lot).

Sources (dossier `project/`, taille d’aperçu lue dans `canvas.json` et dans `data-props` du script) :
- `NdLanding.dc.html` (1440×8875, planche « Accueil public », `is_interactive`, `<title>` « Étudium — Accueil public ») — **bureau seulement**.
- **Aucune version téléphone** (`canvas.json` n’a pas de `NdMobLanding`), aucun état vide.
- Cibles de liens **absentes de la copie locale** : `NdTarifs.dc.html` (1440×2985, « Tarifs », lot 2), `NdCommunaute.dc.html`, `NdVerification.dc.html`. Présentes : `NdInscription`, `NdConnexion`, `NdCataloguePublic`, `NdFormationPublic`.
- En-tête, bande d’appel à l’action finale et pied de page : déjà décrits dans l’annexe 1.3 (§1 et §5.5) ; relus ici ligne à ligne : **identiques**, sauf « Formations » sans `aria-current` dans l’en-tête (fond transparent, comme les autres liens).

Valeurs copiées des styles inline. **Aucune règle `@media`**, aucun `position: sticky` ni `fixed`, aucune transition ni animation : le responsive passe par `flex-wrap` + `flex-basis`, 19 `clamp()` différents (§0.2) et des grilles `auto-fill` (dont une « à seuil », §8).
Texte : apostrophes typographiques `’` partout (n’est, D’autres, l’inscription, c’est, s’entraide, n’apprenez, d’apprentissage, J’ai, qu’il, l’expiration, d’abonnement, n’importe, s’installe, aujourd’hui, Conditions d’utilisation, Témoignage d’un…) — **aucune apostrophe droite** dans le texte affiché. Aucun guillemet `« »`. **Aucune espace insécable** (ni U+00A0 ni U+202F) : espaces **normales** devant `?`, `:`, `!`, `%` et `/` (« Vous vous reconnaissez ? », « Merci à tous pour vos conseils ! », « 68 % terminé », « FCFA / mois »). `·` (U+00B7) comme séparateur ; `&` dans « Business & revenus en ligne » (écrit `&amp;`) ; un seul tiret cadratin `—`, dans le `<title>`. Les crochets signalent des textes de remplacement : `[PRIX]` ×3, `[NOMBRE]` ×4, `[Témoignage …]` ×3, `[Prénom N.]` ×3, `[Filière, université]`, `[Métier ou activité]`, `[Activité en ligne]`.

---

## 0. Abréviations

### 0.1 Reprises des annexes 1.3 (§0, §1, §2.3, §5) et 1.10 (§0) — valeurs identiques, rappelées pour que cette fiche se suffise
- `FOCUS` = style-focus-visible `outline: 2px solid #0B18C9; outline-offset: 2px` (app : `focus-etudium`)
- `FOCUS-W` = style-focus-visible `outline: 2px solid #FFFFFF; outline-offset: 2px` (app : `focus-blanc`)
- `FONT` = `font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif` (Inter 400/500/600/700, Google Fonts) ; `-webkit-font-smoothing: antialiased` — CSS global : `body{margin:0}` `a{color:#0B18C9}` `a:hover{color:#08149F}` `::placeholder{color:#757F94}`
- `BTN-PRIMARY` = inline-flex; align-items center; justify-content center; gap 8px; box-sizing border-box; height 48px; padding 0 18px; border-radius 14px; font-size 16px; background #0B18C9; color #FFFFFF; border 0; font-family inherit; font-weight 500; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #08149F` — FOCUS (app : `Button variant="principal" size="lg"`)
- `BTN-OUTLINE-W` (sur bleu) = inline-flex; center/center; gap 8px; box-sizing border-box; border-radius 14px; border 1px solid rgba(255, 255, 255, 0.45); background transparent; color #FFFFFF; font-family inherit; font-weight 600; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: rgba(255, 255, 255, 0.14)` — FOCUS-W (app : `LienContourBlanc`)
- `BADGE` = display inline-flex; align-items center; gap 5px; padding 3px 8px 4px; border-radius 4px; font-size 12px; line-height 17px; font-weight 500; white-space nowrap ; couleurs utilisées ici (app : `Tag`) :
  - Académique : bg #DDE1FF, color #0B18C9 (`academique`)
  - Digital : bg #EDE9FE, color #6D28D9 (`digital`)
  - Business : bg #FFEDD9, color #C2410C (`business`)
  - Gratuit / Réussi / Validé : bg #DDF3E4, color #17663A (`gratuit`, `reussi`, `valide`)
  - Populaire / À rendre : bg #FBEFD0, color #8A5A00 (`populaire`, `aCorriger`)
- `DOT` = span aria-hidden; width 3px; height 3px; border-radius 50%; background #667085 (app : `MetaDot`)
- `PROGRESS` = div role="progressbar" aria-label aria-valuenow aria-valuemin="0" aria-valuemax="100" ; piste height 8px; border-radius 999px; background #D6DDEC; overflow hidden ; remplissage width N%; height 100%; border-radius 999px; background #0B18C9 (app : `ProgressBar`)
- `MOTIF-POINTS` = background-image: radial-gradient(rgba(255, 255, 255, 0.13) 1.2px, transparent 1.2px); background-size: 22px 22px (app : `trame-points`)
- `TUILE(n, r)` = span flex none; display flex; align-items center; justify-content center; width n; height n; border-radius r ; + background / color (app : `IconTile`, tailles 40/12 et 44/13 seulement)
- `AVATAR(n)` = flex none; display flex; center/center; width n; height n; border-radius 999px; initiales font-weight 600 (app : `Avatar`)
- `PILE-AVATARS` = span display flex; align-items center → 3 × AVATAR(32px) font-size 12px; position relative; box-shadow 0 0 0 2px #FFFFFF ; z-index 3 / 2 / 1 ; margin-left -6px à partir du 2e — « RH » #EDE9FE/#6D28D9, « FA » #DDE1FF/#0B18C9, « SD » #FBEFD0/#8A5A00 (app : `AvatarGroup` + `Avatar size={32}` tons violet / bleu / ambre — identique)
- `LIGNE-LISTE` = div (ici jamais un lien) display flex; align-items center; gap 14px; padding 14px 4px; min-height 48px; color inherit; text-decoration none
- `TEXTES-LIGNE` = span flex 1; min-width 0; display flex; flex-direction column; gap 2px → titre span 15/22 500 #1D1D1F + sous-titre span 13/20 #667085
- `SÉPARATEUR` = div height 1px; background #EAEEF7
- `PILE-{BLEU|VIOLET|ORANGE}` = illustration maison (3 losanges, viewBox 48) : Académique = bleu, Digital = violet, Business = orange (app : `CourseIllustration`, palettes identiques)
- `LOGO` / `LOGO-BLANC` = hexagone plein 30×30 + « É » (annexe 1.3 §7) (app : `LogoMark` / `LogoMark inverse`)
- `H2-SECTION` = h2 : margin 0; font-size clamp(28px, 3.5vw, 44px); line-height 1.08; font-weight 500; letter-spacing -0.028em; color #262628; text-wrap balance (variante blanche : color #FFFFFF) (app : constante locale `TITRE_SECTION` de `FichePublique.tsx`)
- `LISTE-COCHÉE` = ul : margin 0; padding 0; list-style none; display grid; grid-template-columns minmax(0, 1fr); gap 10px 24px → li : display flex; align-items flex-start; gap 10px; font-size 14px; line-height 22px; color #232326 → COCHE 18px (flex-shrink 0; display block; margin-top 2px; color {couleur}) + span (app : `ListeCochee` de `BlocsFiche.tsx`)
- `CARTE-PUBLIQUE` (annexe 1.3 §2.3) = a : color inherit; text-decoration none; box-sizing border-box; display flex; flex-direction column; padding 22px 19px 17px; border 1px solid #EAEEF7; border-radius 16px; background #FFFFFF; min-width 0 — hover `border-color: #D2D9E8` — FOCUS
  - div haut : display flex; align-items flex-start; justify-content space-between; gap 8px → PILE 48px (display block; flex-shrink 0; margin-left 4px) + span groupe : display flex; flex-wrap wrap; justify-content flex-end; gap 6px → BADGE parcours puis BADGE statut
  - h2 title="{titre}" : margin 21px 0 0; font-size 16px; line-height 24px; font-weight 600; color #1D1D1F; white-space nowrap; overflow hidden; text-overflow ellipsis
  - p : margin 11px 0 0; font-size 12px; line-height 20px; height 40px; overflow hidden; color #667085
  - div trait : height 1px; margin-top 16px; background #EAEEF7
  - div méta : display flex; flex-wrap wrap; align-items center; gap 7px; font-size 12px; line-height 18px; color #667085; margin-top 12px → span (flex; center; gap 4px) ÉTOILE 16px (margin 0 -1px) + span note · DOT · span (flex; center; gap 4px) HORLOGE 18px (margin 0 -1.5px) + span durée · DOT · span niveau
  - (app : `CarteFormation variante="public"` → `CatalogCard` → `CardShell` — identique)
- `ACCORDÉON` (bouton du programme, annexe 1.3 §5.3) = button type="button" aria-expanded : display flex; align-items center; justify-content space-between; gap 16px; width 100%; min-height 56px; padding 8px 0; border 0; background transparent; text-align left; font-family inherit; font-size 16px; line-height 24px; font-weight 500; color #1D1D1F; cursor pointer — FOCUS — **pas de hover** → span texte + span chevron (flex none; display flex; transform rotate(180deg) ouvert / rotate(0deg) fermé) → CHEVRON-BAS 20px ; panneau p : margin 0; padding 0 40px 18px 0; font-size 14px; line-height 22px; color #667085; text-wrap pretty (app : `Accordion`)
- `BANDE-CTA` (annexe 1.3 §5.5) : voir §15 (app : `BandeAppelAction`)
- `CADRE-PUBLIC` (annexe 1.3 §1) : voir §1 (app : `CadrePublic`)

### 0.2 Nouvelles abréviations
- `BTN-BLANC` = inline-flex; align-items center; justify-content center; gap 8px; box-sizing border-box; **height 52px; padding 0 22px; font-size 16px**; border-radius 14px; border 0; background #FFFFFF; color #0B18C9; font-family inherit; font-weight 600; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #EEF0FF` — FOCUS-W (c’est le bouton blanc de la bande CTA de l’annexe 1.3 §5.5 ; app : codé en dur dans `BandeAppelAction`, avec `min-h-[52px] py-3 leading-tight text-center` au lieu de `height 52px; line-height 1; nowrap`)
- `BTN-OUTLINE-W-52` = BTN-OUTLINE-W + height 52px; padding 0 22px; font-size 16px (app : `LienContourBlanc hauteur="min-h-[52px] px-[22px] py-3 text-base"`)
- `BTN-TONAL-LG` = gabarit BTN-PRIMARY (height 48px; padding 0 18px; border-radius 14px; font-size 16px; weight 500) avec background #E9EFFB; color #232326 — hover `background: #DEE6F6` — FOCUS (app : `Button variant="gris" size="lg"` — identique)
- `BTN-SECONDARY-LG` = gabarit BTN-PRIMARY avec background #FFFFFF; color #232326; border 1px solid #E3E8F3 — hover `background: #F2F6FD` — FOCUS (app : `Button variant="contour" size="lg"` — identique)
- `PASTILLE` (surtitre de section) = span display inline-flex; align-items center; gap 8px; align-self flex-start; padding 6px 13px; border-radius 999px; font-size 13px; line-height 18px; font-weight 600 ; trois tons :
  - `PASTILLE-W` (sur bleu) : background rgba(255, 255, 255, 0.14); color #FFFFFF (= pastille « Catalogue » de NdCataloguePublic)
  - `PASTILLE-BLEU` (sur blanc) : background #EEF0FF; color #0B18C9
  - `PASTILLE-BLANC` (sur la coque #E9EFFB ou sur #EEF0FF) : background #FFFFFF; color #0B18C9
  - (app : classes inline dans `HerosCatalogue`, `AuthAside`, `not-found` ; pas de composant)
- `LEAD-SECTION` = p : margin 0; max-width 640px; font-size 17px; line-height 27px; color #535E75; text-wrap pretty (sur bleu : color #DDE1FF, comme le chapeau de NdCataloguePublic)
- `EN-TÊTE-SECTION` = div display flex; flex-direction column; gap 16px; max-width 800px → PASTILLE + H2-SECTION [+ LEAD-SECTION]
  - `EN-TÊTE-SECTION-CENTRÉ` = idem + margin 0 auto; align-items center; text-align center ; la PASTILLE y déclare `align-self: flex-start` **puis** `align-self: center` (retenir center)
- `SECTION-BLANCHE` = section box-sizing border-box; padding clamp(28px, 5vw, 64px); border-radius 28px; background #FFFFFF
- `SECTION-NUE` = section box-sizing border-box; padding clamp(28px, 4.5vw, 56px) clamp(4px, 2.5vw, 36px); border-radius 28px; background transparent (le texte se pose directement sur la coque #E9EFFB)
- `OMBRE-FLOTTANTE` = box-shadow 0 22px 56px rgba(4, 10, 80, 0.3) (= carte offre de NdFormationPublic)
- `FLÈCHE` = ArrowRight02Icon (18px dans BTN-BLANC et les liens de parcours ; 20px dans BTN-TONAL-LG et BTN-PRIMARY)
- `NUMÉRO` = span aria-hidden="true" (pas de liste `ol`) ; deux gabarits : 38/40 #0B18C9 (§4) et 60/60 #9DA6FF (§7)
- `BOÎTE-ILLUSTRATION` (bas des cartes « La solution ») = div flex 1; display flex; align-items flex-end; margin-top 26px → div box-sizing border-box; width 100%; padding 14px; border-radius 20px; background {teinte} → contenu blanc
- `LIGNE-MINI` (lignes des illustrations « La solution ») = div display flex; align-items center; gap 12px; min-height 48px; font-size 14px; line-height 22px; color #232326 ; **à partir de la 2e** : border-top 1px solid #EAEEF7 → [icône 20px (flex-shrink 0; display block; color {c})] + span flex 1; min-width 0; white-space nowrap; overflow hidden; text-overflow ellipsis; font-weight 500 + élément de fin
- `clamp()` utilisés (valeur à 1440 / 390 / 320 px de large) :
  - clamp(38px, 4.9vw, 68px) → 68 / 38 / 38 (h1)
  - clamp(36px, 4.8vw, 62px) → 62 / 36 / 36 (h2 de la bande CTA)
  - clamp(28px, 3.5vw, 44px) → 44 / 28 / 28 (H2-SECTION ×10)
  - clamp(30px, 3.4vw, 44px) → 44 / 30 / 30 (chiffres)
  - clamp(28px, 5vw, 72px) → 72 / 28 / 28 (padding du hero, haut et côtés) ; clamp(24px, 3vw, 40px) → 40 / 24 / 24 (padding bas du hero)
  - clamp(28px, 5vw, 64px) → 64 / 28 / 28 (SECTION-BLANCHE, Comment ça marche, Communauté, bande CTA)
  - clamp(28px, 4.5vw, 56px) → 56 / 28 / 28 (SECTION-NUE en haut et en bas, pied de page) ; clamp(4px, 2.5vw, 36px) → 36 / 9,75 / 8 (côtés de SECTION-NUE)
  - clamp(32px, 4vw, 56px) → 56 / 32 / 32 (marge au-dessus de la bande des parcours du hero)
  - clamp(22px, 2.6vw, 32px) → 32 / 22 / 22 (padding des cartes Solution et Parcours)
  - clamp(16px, 2.4vw, 28px) → 28 / 16 / 16 (écart numéro / texte, §4)
  - clamp(18px, 3vw, 32px) → 32 / 18 / 18 (côtés de la boîte FAQ)
  - clamp(20px, 3vw, 32px) et clamp(8px, 1.5vw, 16px) → 32·16 / 20·8 / 20·8 (boîte des chiffres) ; clamp(12px, 2vw, 28px) → 28 / 12 / 12 (côtés d’un chiffre)
  - clamp(250px, calc((1060px - 100%) * 999), calc((100% - 20px) / 2)) (grille des formations, §8)

### 0.3 Correspondance avec les composants existants de l’app

| Bloc du design | Lot | Composant de l’app | Écart à traiter / ce qui manque |
|---|---|---|---|
| Cadre (fond, coque, `main`) | **1** | `CadrePublic` | identique (marges 20 px → 8 px sous 640 px : adaptation déjà en place) ; **pas de lien d’évitement** « Aller au contenu » (`AppShell` et `CadreLecon` en ont un) |
| Racine `/` | **1** | `app/page.tsx` (redirection) + `routeFor` (`lib/auth/routing.ts`, l. 35) | `/` envoie aujourd’hui le visiteur vers `/connexion` → visiteur : landing ; compte connecté : `/accueil` (spec §2). Utiliser `CadrePublic` directement (pas `CadreSelonVisiteur`). |
| En-tête public (§2) | **1** | `EnTetePublic` | `LIENS` ne contient que « Formations » → ajouter, dans l’ordre : Parcours `/#parcours`, Formations, Tarifs `/#formules`, Communauté `/#communaute` ; « Vérifier un certificat » au lot 3. Comportement téléphone à décider (§20, Q5). |
| Hero (§3) | **1** | — | **à créer**. Réutilise `MOTIF_BLEU`, `LienContourBlanc`, le lien blanc de `BandeAppelAction` (**à extraire** : `LienBlanc`), la pastille (**à extraire** : `Pastille`), `CourseCard href={null}` pour la carte illustrée, `IconTile size={44}` (tons `reussite`, `neutre`, `information` ✓), `Avatar size={32}` + `AvatarGroup` ✓ |
| PASTILLE (3 tons) | **1** | classes inline (`HerosCatalogue`…) | composant à extraire : tons « sur bleu » (`bg-white/14 text-white`), « bleu » (`bg-bleu-clair text-bleu`), « blanc » (`bg-panneau text-bleu`) |
| EN-TÊTE-SECTION, H2-SECTION, LEAD-SECTION | **1** | `TITRE_SECTION` (local à `FichePublique`) | à extraire et partager ; `Lead` (16/24 #232326) ≠ LEAD-SECTION (17/27 #535E75) |
| SECTION-BLANCHE / SECTION-NUE | **1** | `SECTION` (local à `FichePublique`) = padding clamp(24px, 4vw, 48px) | **valeurs différentes** : clamp(28px, 5vw, 64px) et clamp(28px, 4.5vw, 56px) clamp(4px, 2.5vw, 36px) → nouvelles constantes |
| « Vous vous reconnaissez ? » (§4) | **1** | — | à créer (liste numérotée, `ol` conseillé §21) |
| « La solution » (§5) | **1** | `IconTile`, `Tag`, `Avatar`, `AvatarGroup`, `CourseIllustration size={52}` | `IconTile` n’a **ni la taille 48/14 (icône 22)** ni les tons **business** (#FFEDD9 / #C2410C) et **digital** (#EDE9FE / #6D28D9) (le `Dialog` a sa propre pastille de 48) ; mini-illustrations à créer ; couleurs hors jetons : #FFF3E6, #F3F0FE, #EAF7EF, #15803D |
| Trois parcours (§6) | **1** | `ListeCochee`, `CourseIllustration size={62}` | carte à créer ; `ListeCochee` avec `taille="text-sm"`, `couleur` = `text-bleu` / `text-premium-texte` / `text-business-texte`, `colonnes="grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2.5"` ✓ ; lien « Voir les formations du parcours » à créer (aucun `Button` ne correspond) ; fonds #EEF0FF = `bleu-clair` ✓, #F3F0FE et #FFF3E6 hors jetons (`digital-fond` = #F5F3FF, `business-fond` = #FFF7ED) |
| Comment ça marche (§7) | **1** | — | à créer ; fond `bg-bleu-nuit trame-points` ✓ |
| Formations (§8) | **1** | `CarteFormation variante="public" titleAs="h3"` ; `Button asChild variant="gris" size="lg"` | grille à seuil absente de `grilles.ts` → nouvelle constante (corrigée, §8.3) ; avec `asChild`, `Button` n’ajoute pas l’icône : mettre `<Icon icon={ArrowRight02Icon} size={20} />` dans le `Link` |
| Formules (§9) | **1, sans prix (Q10)** | `ListeCochee`, `MOTIF_BLEU` | carte à créer ; `ListeCochee` impose `text-texte` aux `li` → option de couleur de texte pour la carte Standard (texte blanc) ; pastille « Recommandée » à créer ; « Voir le détail » **[lot 2]** |
| Accompagnement (§10) | **1** | `IconTile size={44}` | tons business et digital manquants (voir Solution) ; carte à créer |
| Communauté (§11) | **1** (bouton : lot 5) | `Button asChild variant="principal" size="lg"`, `Avatar size={44}`, `MetaDot` | carte « publication » à créer |
| Témoignages + chiffres (§12, §13) | **masqué (Q11)** | — | rien à construire au lot 1 |
| FAQ (§14) | **1** | `Accordion` (`defaultOpen={[0]}`) | **identique** aux valeurs ; boîte blanche autour à ajouter ; textes dans une constante partagée (Q31) |
| Appel à l’action final (§15) | **1** | `BandeAppelAction` | identique (adaptations téléphone déjà faites) |
| Pied de page (§16) | **1** | `PiedDePagePublic` | colonnes à compléter (Plateforme : Parcours, Tarifs ; Ressources : Questions fréquentes, Communauté ; Légal : Contact **masqué**) ; « Vérifier un certificat » au lot 3 |

---

## 1. Cadre et pile de la page

### 1.1 Cadre (CADRE-PUBLIC, identique à l’annexe 1.3 §1)
- Racine div : min-height 100vh; box-sizing border-box; padding 0 20px 20px; display flex; flex-direction column; background #F2F6FD; FONT; color #232326
  - header (§2)
  - div coque : flex 1; display flex; flex-direction column; gap 20px; padding 20px; border-radius 32px; background #E9EFFB → les 13 sections (§3 à §15) puis le footer (§16), dernier enfant de la coque.
- **Pas de `main`** dans la maquette (l’app en a un : `main#contenu` dans `CadrePublic`, footer en dehors).
- Largeurs à 1440 : coque 1400 → sections 1360 ; contenu d’une SECTION-BLANCHE **1232**, du hero **1216**, d’une SECTION-NUE **1288**, du footer **1248**.

### 1.2 Pile des sections et décision du lot 1

| # | Section | Fond | `id` | Lot 1 |
|---|---|---|---|---|
| 1 | Hero (§3) | bleu #0B18C9 + MOTIF-POINTS | — | **[lot 1]** (illustration décorative : §3.2, questions 12 et Q5) |
| 2 | « Vous vous reconnaissez ? » (§4) | blanc | — | **[lot 1]** |
| 3 | « La solution » (§5) | transparent | — | **[lot 1]** |
| 4 | Trois parcours (§6) | blanc | `parcours` | **[lot 1]** (données réelles) |
| 5 | « Comment ça marche » (§7) | bleu nuit #060F75 + MOTIF-POINTS | — | **[lot 1]** |
| 6 | Formations « Pour bien commencer » (§8) | blanc | — | **[lot 1]** (données réelles) |
| 7 | Formules (§9) | transparent | **à ajouter : `formules`** | **[lot 1, sans prix (Q10)]** ; « Voir le détail » [lot 2] |
| 8 | Accompagnement (§10) | blanc | — | **[lot 1]** |
| 9 | Communauté (§11) | #EEF0FF | `communaute` | **[lot 1]** ; « Voir la communauté » [lot 5] |
| 10 | Témoignages (§12) | blanc | — | **[masqué (Q11)]** |
| 10b | Chiffres (§13, dans la section Témoignages) | bleu | — | **[masqué (Q11)]** |
| 11 | FAQ (§14) | transparent | **à ajouter : `faq`** | **[lot 1]** |
| 12 | Appel à l’action final (§15) | bleu + MOTIF-POINTS | — | **[lot 1]** |
| 13 | Pied de page (§16) | bleu nuit + MOTIF-POINTS | — | **[lot 1]** ; « Vérifier un certificat » [lot 3] ; « Contact » masqué |

- Aucune `section` n’a d’`aria-labelledby`. Hauteur d’aperçu : 8875px.
- Spec §9 : textes du design **tels quels** ; bouton principal partout « Créer mon compte gratuit » (CDC §51).

---

## 2. En-tête public — [lot 1]

Identique à l’annexe 1.3 §1 (header : display flex; flex-wrap wrap; align-items center; justify-content space-between; gap 12px; padding 20px 4px 20px 0). Pas d’élément `nav` dans la maquette.
- div gauche (display flex; flex-wrap wrap; align-items center; gap 12px) :
  - a logo → NdLanding, aria-label="Étudium, accueil" : display flex; align-items center; gap 10px; height 49px; padding 0 16px 0 9px; border-radius 14px; background #E9EFFB; font-size 17px; font-weight 700; letter-spacing -0.02em; color #0B18C9; text-decoration none — FOCUS → LOGO 30px + span « Étudium »
  - 5 liens : display flex; align-items center; height 49px; padding 0 14px; border-radius 14px; background transparent; font-size 16px; font-weight 500; color #232326; text-decoration none — hover `background: #E9EFFB` — FOCUS — **aucun `aria-current` sur la landing**

| Lien | Maquette | Lot 1 (spec §2) |
|---|---|---|
| Parcours | NdLanding.dc.html#parcours | **[lot 1]** `/#parcours` |
| Formations | NdCataloguePublic | **[lot 1]** `/formations` (déjà en place) |
| Tarifs | NdTarifs (page du lot 2) | **[lot 1]** `/#formules` (ancre à créer) jusqu’au lot 2, puis `/tarifs` |
| Communauté | NdLanding.dc.html#communaute | **[lot 1]** `/#communaute` |
| Vérifier un certificat | NdVerification | **[lot 3]** (masqué au lot 1) |

- div droite (display flex; flex-wrap wrap; align-items center; gap 12px) :
  - a → NdConnexion : display flex; align-items center; height 49px; border 0; border-radius 14px; background #E9EFFB; font-family inherit; font-size 16px; font-weight 500; color #232326; text-decoration none; cursor pointer; white-space nowrap; gap 8px; padding 0 16px — hover `background: #DEE6F6` — FOCUS → span « Se connecter » — **[lot 1]** `/connexion`
  - a → NdInscription : BTN-PRIMARY avec height déclarée 48px **puis** 49px (retenir 49px) → span « Créer un compte gratuit » — **[lot 1]** `/inscription` ; libellé à confirmer face à la règle « Créer mon compte gratuit partout » (Q13)
- App : `EnTetePublic` a déjà ces valeurs (logo, liens, deux boutons) et entoure les liens d’un `nav aria-label="Site Étudium"`. Ajouter les trois ancres. Le même en-tête sert au catalogue et aux fiches : « Tarifs » y mènera aussi à `/#formules`.
- Responsive : deux groupes en `flex-wrap`. Sur téléphone, 4 liens + 2 boutons s’empilent sur 3 à 4 lignes (≈ 220 à 270px de haut) : aucune maquette (§20, Q5).

---

## 3. Hero — [lot 1]

### 3.1 Structure
- section : box-sizing border-box; padding **clamp(28px, 5vw, 72px) clamp(28px, 5vw, 72px) clamp(24px, 3vw, 40px)**; border-radius 28px; background-color #0B18C9; MOTIF-POINTS; color #FFFFFF
  - div : display flex; flex-wrap wrap; align-items center; **gap 56px**
    - div texte : **flex 999 1 420px**; min-width 0 → div display flex; flex-direction column; **gap 22px** :
      1. PASTILLE-W « Formation · Pratique · Accompagnement »
      2. **h1** : margin 0; max-width 760px; font-size clamp(38px, 4.9vw, 68px); line-height 1.04; font-weight 500; letter-spacing -0.035em; color #FFFFFF; text-wrap balance — « Les compétences qui comptent, pendant vos études et après. »
      3. p : margin 0; max-width 620px; font-size 18px; line-height 29px; color #DDE1FF; text-wrap pretty — « Étudium accompagne les étudiants et les jeunes diplômés : outils universitaires, compétences digitales et activités en ligne. Vous apprenez, vous pratiquez, un formateur vous accompagne, et vous obtenez un certificat vérifiable. »
      4. div : display flex; flex-wrap wrap; gap 12px; margin-top 6px →
         - a → NdInscription : BTN-BLANC → span « Créer mon compte gratuit » + FLÈCHE 18px — **[lot 1]** `/inscription`
         - a → NdCataloguePublic : BTN-OUTLINE-W-52 → span « Découvrir les formations » — **[lot 1]** `/formations`
      5. p : margin 0; font-size 14px; line-height 22px; color #C2C8FF — « Compte gratuit, sans engagement. Paiement par Mobile Money quand vous êtes prêt. »
    - div illustration : **flex 1 1 440px**; min-width 0 → div display flex; flex-direction column; width 100%; max-width 480px; margin 0 auto; padding 12px 0 8px → trois éléments (§3.2)
  - div bande des parcours (§3.3), sous la rangée, toujours dans la section.
- À 1440 : texte 719,7px, illustration 440,3px (carte 361px, liste 378,6px). Rangée repliée sous **1107px** de large (§20).

### 3.2 Illustration (trois cartes inclinées) — [lot 1, décorative ; montre des fonctions des lots 3 et 5]
a) **Carte de formation en cours** : div width 82%; border-radius 16px; OMBRE-FLOTTANTE; transform rotate(-3deg) → a → **NdFormationPublic** (coque de CARTE-PUBLIQUE, hover #D2D9E8, **FOCUS bleu sur fond bleu : invisible**, §21) :
  - div haut : flex; align-items flex-start; justify-content space-between; gap 8px → PILE-BLEU 48px (margin-left 4px) + BADGE Académique (posé seul, sans span de groupe)
  - **h2** title="Maîtriser Microsoft Excel" : styles du titre de CARTE-PUBLIQUE — « Maîtriser Microsoft Excel »
  - p : margin 11px 0 0; font-size 12px; line-height 20px; color #667085 (**sans height 40px ni overflow hidden**) — « Module 3 : les tableaux croisés dynamiques »
  - PROGRESS aria-label="Progression" aria-valuenow="68" : height 8px; **margin 17px 0 0 -1px**
  - div méta : display flex; align-items center; gap 7px; margin-top 8px; 12/18 #667085 (**pas de flex-wrap**) → span « 68 % terminé » · DOT · span (flex; center; gap 4px) HORLOGE 18px (margin 0 -1.5px) + span « 2 h restantes »
  - = CARTE-PROGRESSION de l’annexe 1.9 avec un BADGE de parcours (app : `CourseCard state="enCours" tag={{ tone: "academique", label: "Académique" }}`, qui met déjà `flex-nowrap` à la méta).
b) **Badge « Certificat obtenu »** [lot 3] : div display flex; align-items center; gap 12px; padding 10px 18px 10px 10px; border-radius 16px; background #FFFFFF; OMBRE-FLOTTANTE; position relative; align-self flex-end; **margin-top -14px** (chevauche le bas de la carte a) ; transform rotate(2deg) → TUILE(44px, 13px) #DDF3E4 / #17663A → CERTIFICAT 20px + span display flex; flex-direction column; min-width 0 → span 14/22 600 #1D1D1F « Certificat obtenu » + span 13/20 #667085 « Microsoft Word · vérifiable par QR Code »
c) **Liste « Exercice validé » / « Session live »** [lots 3 et 5] : div width 86%; align-self flex-end; box-sizing border-box; margin 18px 10px 0 0; padding 4px 16px; border-radius 16px; background #FFFFFF; OMBRE-FLOTTANTE; transform rotate(1.5deg) → div display flex; flex-direction column →
  - LIGNE-LISTE → TUILE(44px, 13px) #E9EFFB / #232326 → COCHE-CERCLE 20px + TEXTES-LIGNE « Exercice validé » / « Corrigé par votre formatrice »
  - SÉPARATEUR
  - LIGNE-LISTE → TUILE(44px, 13px) #DDE1FF / #0B18C9 → VIDÉO 20px + TEXTES-LIGNE « Session live » / sous-titre = span contenant deux span display block « Excel avancé : analyse de données » et « Samedi · 15 h 00 · en ligne » + PILE-AVATARS (RH, FA, SD)
- Aucune des lignes n’est un lien ; seule la carte a) l’est.
- Proposition lot 1 : tout ce bloc en **illustration** (`aria-hidden="true"`, aucun lien ni focus, `h2` remplacé par un `span`) : il montre des données inventées (68 %, Microsoft Word, RH/FA/SD) — Q12.

### 3.3 Bande « Trois parcours au lancement » — [lot 1]
- div : display flex; flex-wrap wrap; align-items center; gap 12px 16px; margin-top clamp(32px, 4vw, 56px); padding-top 24px; border-top 1px solid rgba(255, 255, 255, 0.2) →
  - span : margin-right 8px; font-size 14px; line-height 22px; color #C2C8FF — « Trois parcours au lancement »
  - 3 × a href="#parcours" (`PUCE-PARCOURS`) : display inline-flex; align-items center; gap 9px; **height 40px**; padding 0 16px 0 12px; border-radius 999px; background rgba(255, 255, 255, 0.12); font-size 14px; font-weight 500; color #FFFFFF; text-decoration none — hover `background: rgba(255, 255, 255, 0.2)` — **aucun focus-visible déclaré** (à ajouter : FOCUS-W) → span aria-hidden="true" width 10px; height 10px; border-radius 50%; background {couleur} + texte nu (pas de span)
    - #9DA6FF (`bleu-moyen`) « Réussite académique » · #C4B5FD (`digital-clair`) « Compétences digitales » · #FDBA74 (`business-clair`) « Business & revenus en ligne »
- Cible : `#parcours` (même page). Noms : ceux de la table `parcours` (identiques aux noms en base).

---

## 4. « Vous vous reconnaissez ? » — [lot 1]

- SECTION-BLANCHE (pas d’`id`) → div : display flex; flex-wrap wrap; align-items flex-start; **gap 64px** →
  - div gauche : **flex 1 1 420px**; min-width 0 → EN-TÊTE-SECTION : PASTILLE-BLEU « Vous vous reconnaissez ? » + H2-SECTION « Le diplôme ne suffit plus. Les outils et les compétences font la différence. » (pas de LEAD)
  - div droite : **flex 999 1 420px**; min-width 0 → div border-bottom 1px solid #DBE0EB → 4 × `ITEM-PROBLÈME` :
    - div : display flex; gap clamp(16px, 2.4vw, 28px); padding 26px 0; border-top 1px solid #DBE0EB →
      - NUMÉRO span aria-hidden="true" : flex none; width 58px; font-size 38px; line-height 40px; font-weight 500; letter-spacing -0.04em; color #0B18C9
      - div min-width 0 → **h3** : margin 4px 0 0; font-size 20px; line-height 28px; font-weight 600; letter-spacing -0.01em; color #1D1D1F + p : margin 8px 0 0; max-width 560px; font-size 15px; line-height 24px; color #667085; text-wrap pretty

| N° | h3 | p |
|---|---|---|
| 01 | Votre mémoire avance lentement | Faute de méthode pour chercher, citer et rédiger, chaque chapitre prend des semaines. |
| 02 | Word, Excel et PowerPoint vous font perdre du temps | Mises en page, tableaux, présentations de soutenance : vous bricolez au lieu de maîtriser. |
| 03 | Les employeurs attendent des compétences digitales | Canva, IA, réseaux sociaux, outils no-code : on vous les demande, personne ne vous les a appris. |
| 04 | Vous voulez créer vos propres revenus | Freelance, produits digitaux, vente en ligne : vous ne savez pas par où commencer. |

- À 1440 : gauche 420,3px, droite 747,7px ; repli sous 1094px de large. Texte fixe.
- App : rien d’existant.

---

## 5. « La solution » — [lot 1, texte fixe ; illustrations décoratives]

- SECTION-NUE →
  - EN-TÊTE-SECTION-CENTRÉ : PASTILLE-BLANC « La solution » + H2-SECTION « Un seul endroit pour apprendre, pratiquer et être accompagné » (sans point) + LEAD-SECTION « Étudium n’est pas une simple bibliothèque de vidéos. Chaque formation combine cours, exercices corrigés, accompagnement et certification. »
  - div grille : display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(320px, calc((100% - 20px) / 2))), 1fr)); gap 20px; margin-top 40px → **2 colonnes** au plus (634px à 1440) ; 1 colonne sous 660px de contenu (≈ 779px de large).
  - 4 × `CARTE-SOLUTION` : div box-sizing border-box; display flex; flex-direction column; padding clamp(22px, 2.6vw, 32px); border-radius 24px; background #FFFFFF; min-width 0 →
    - TUILE(48px, 14px) {bg / fg} → icône 22px
    - **h3** : margin 22px 0 0; font-size 22px; line-height 30px; font-weight 600; letter-spacing -0.015em; color #1D1D1F
    - p : margin 8px 0 0; max-width 480px; font-size 15px; line-height 24px; color #667085; text-wrap pretty
    - BOÎTE-ILLUSTRATION {teinte} (le `flex: 1` + `align-items: flex-end` aligne les boîtes en bas quand les cartes d’une rangée ont des textes de longueur différente)

| # | TUILE 48/14 (bg / fg) | Icône 22px | h3 | p | Teinte de la boîte |
|---|---|---|---|---|---|
| 1 | #DDE1FF / #0B18C9 | VIDÉO | Des formations courtes | Des vidéos découpées en leçons, des ressources à télécharger et une progression toujours visible. | #EEF0FF |
| 2 | #FFEDD9 / #C2410C | EXERCICE | De la pratique | Des quiz et des exercices corrigés par un formateur pour vérifier que vous savez faire. | #FFF3E6 |
| 3 | #EDE9FE / #6D28D9 | FORMATEUR | Un accompagnement | Des sessions live, une messagerie avec votre formateur et une communauté qui s’entraide. | #F3F0FE |
| 4 | #DDF3E4 / #17663A | CERTIFICAT | Des certificats vérifiables | Chaque certificat porte un QR Code : un recruteur peut vérifier son authenticité en un instant. | #EAF7EF |

- Contenu des boîtes (cartes 1 à 3 : div padding 4px 16px; border-radius 14px; background #FFFFFF → 3 LIGNE-MINI) :
  - Carte 1 : COCHE-CERCLE #0B18C9 « Trier et filtrer » + span (font-size 13px; color #667085) « 08:12 » | PLAY-CERCLE #0B18C9 « Les tableaux croisés dynamiques » « 12:40 » | PLAY-CERCLE #667085 « Les graphiques avancés » « 10:05 »
  - Carte 2 : QUIZ #C2410C « Quiz du module 3 » + BADGE vert « Réussi » | EXERCICE #C2410C « Exercice pratique » + BADGE vert « Validé » | EXERCICE #667085 « Exercice : nettoyer une enquête » + BADGE ambre « À rendre »
  - Carte 3 : AVATAR(32px) #DDE1FF / #0B18C9 font-size 12px « MA » + « Dr Mireille Adjovi » + span 13px #667085 « Votre formatrice » | VIDÉO #6D28D9 « Session live · samedi · 15 h 00 » + PILE-AVATARS | BULLE #6D28D9 « Espace Académique » + span 13px #667085 « 24 réponses »
  - Carte 4 : div display flex; align-items center; gap 16px; padding 18px; border-radius 14px; background #FFFFFF → PILE-BLEU **52px** + span flex 1; min-width 0; flex column → span 12/18; letter-spacing 0.04em; text-transform uppercase; color #667085 « Certificat de réussite » + span 16/24 600 #1D1D1F « Maîtriser Microsoft Excel » + span 13/20 #667085 « ET-2026-EXC-4821 » ; puis span flex none; display flex; center/center; width 60px; height 60px; border-radius 12px; background #EAF7EF; color **#15803D** → QR-CODE 36px
- Les éléments de fin des LIGNE-MINI (durées, « Votre formatrice », « 24 réponses ») n’ont ni `flex: none` ni `nowrap` : ils peuvent passer à la ligne si la place manque.
- Fonctions montrées : leçons [lot 1], quiz et exercices [lot 3], live, messagerie, communauté [lot 5], certificats [lot 3]. Proposition : boîtes en `aria-hidden="true"` (§21).

---

## 6. Trois parcours (`id="parcours"`) — [lot 1, données réelles]

- section **id="parcours"** SECTION-BLANCHE →
  - EN-TÊTE-SECTION : PASTILLE-BLEU « Trois parcours au lancement » + H2-SECTION « Choisissez la direction qui vous ressemble » + LEAD-SECTION « Chaque parcours regroupe des formations qui se complètent. D’autres parcours arriveront. »
  - div grille : display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(290px, calc((100% - 40px) / 3))), 1fr)); gap 20px; margin-top 40px → 3 colonnes (397,3px à 1440) ; 2 colonnes sous 910px de contenu (≈ 1100px de large ; le 3e parcours seul sur la 2e rangée, moitié vide) ; 1 colonne sous 600px (≈ 756px).
  - 3 × `CARTE-PARCOURS` : div box-sizing border-box; display flex; flex-direction column; padding clamp(22px, 2.6vw, 32px); border-radius 24px; background {fond}; min-width 0 →
    - span : display flex; align-items center; justify-content center; width 92px; height 92px; border-radius 28px; background #FFFFFF → PILE {couleur} **62px**
    - span : margin-top 26px; font-size 13px; line-height 20px; font-weight 600; letter-spacing 0.04em; text-transform uppercase; color {accent} — « Parcours »
    - **h3** : margin 4px 0 0; **min-height 64px**; font-size 26px; line-height 32px; font-weight 600; letter-spacing -0.02em; color #1D1D1F — nom du parcours
    - p : margin 12px 0 0; **min-height 96px**; font-size 15px; line-height 24px; color #232326; text-wrap pretty — description
    - div trait : height 1px; margin 22px 0 20px; background rgba(29, 29, 31, 0.1)
    - div flex 1 → LISTE-COCHÉE (COCHE color {accent}) — 6 points
    - a → **NdCataloguePublic** (`LIEN-PARCOURS`) : display flex; align-items center; justify-content space-between; gap 8px; box-sizing border-box; **height 48px**; margin-top 26px; padding 0 16px; border-radius 14px; background #FFFFFF; font-size 15px; font-weight 600; color #1D1D1F; text-decoration none — hover `color: {accent}` — **aucun focus-visible déclaré** (à ajouter : FOCUS) → span « Voir les formations du parcours » + FLÈCHE 18px

| Parcours | Fond | Accent | PILE | Description (maquette) | 6 points |
|---|---|---|---|---|---|
| Réussite académique | #EEF0FF | #0B18C9 | BLEU | Les outils et méthodes pour réussir à l’université : bureautique, recherche documentaire, rédaction scientifique, mémoire et soutenance. | Microsoft Word, Excel et PowerPoint · Zotero et la recherche documentaire · Rédaction scientifique · Méthodologie du mémoire · Présentation et soutenance · Productivité académique |
| Compétences digitales | #F3F0FE | #6D28D9 | VIOLET | Les compétences numériques recherchées par les employeurs : design, intelligence artificielle, contenu et automatisation. | Canva · Intelligence artificielle · Création de contenu · Montage vidéo · Community management et marketing digital · Outils no-code et automatisation |
| Business & revenus en ligne | #FFF3E6 | #C2410C | ORANGE | Créer une activité et des revenus grâce au numérique : trouver des clients, vendre en ligne et lancer son business. | Freelancing · Produits digitaux · E-commerce et vente en ligne · Affiliation · YouTube · Acquisition de clients |

- Cible des trois liens : NdCataloguePublic **sans filtre** → app : `/formations?parcours={slug}` (`lireFiltres` accepte les slugs : `reussite-academique`, `competences-digitales`, `business-revenus-en-ligne`).
- Données : §19 (les descriptions en base **diffèrent** de celles-ci ; les 6 points n’existent pas en base — Q3).
- `min-height` 64 / 96 : alignent les traits des trois cartes (titre sur 2 lignes, description sur 4) ; sur une colonne, ils laissent un peu de vide sous les textes courts.

---

## 7. « Comment ça marche » — [lot 1, texte fixe]

- section (pas d’`id`) : box-sizing border-box; padding clamp(28px, 5vw, 64px); border-radius 28px; background-color **#060F75**; MOTIF-POINTS; color #FFFFFF →
  - EN-TÊTE-SECTION : PASTILLE-W « Comment ça marche » + H2-SECTION blanc « Quatre étapes, de l’inscription au certificat » (pas de LEAD)
  - div grille : display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(210px, calc((100% - 72px) / 4))), 1fr)); **gap 24px; margin-top 44px** → 4 colonnes (290px à 1440) ; 3 sous 912px de contenu (≈ 1103px de large, la 4e étape seule) ; 2 sous 678px (≈ 843px) ; 1 sous 444px (≈ 532px).
  - 4 × `ÉTAPE` : div display flex; flex-direction column; padding-top 24px; border-top 1px solid rgba(255, 255, 255, 0.24); min-width 0 →
    - NUMÉRO span aria-hidden="true" : font-size 60px; line-height 60px; font-weight 500; letter-spacing -0.05em; color #9DA6FF
    - **h3** : margin 24px 0 0; font-size 19px; line-height 27px; font-weight 600; color #FFFFFF
    - p : margin 8px 0 0; **padding-right 12px**; font-size 15px; line-height 24px; color #C2C8FF; text-wrap pretty

| N° | h3 | p | Fonction décrite |
|---|---|---|---|
| 01 | Créez votre compte gratuit | Accédez tout de suite aux formations gratuites et au catalogue complet. | lot 1 |
| 02 | Choisissez votre formule | Basique, Standard ou Premium : 1, 2 ou tous les parcours. Paiement par Mobile Money. | lot 2 |
| 03 | Apprenez et pratiquez | Vidéos, quiz, exercices corrigés et sessions live, à votre rythme, sur téléphone ou ordinateur. | lots 1, 3, 5 |
| 04 | Obtenez vos certificats | Une formation validée, c’est un certificat en PDF avec un QR Code de vérification. | lot 3 |

- App : rien d’existant ; `bg-bleu-nuit trame-points text-white`.

---

## 8. Formations « Pour bien commencer » — [lot 1, données réelles]

### 8.1 Structure
- SECTION-BLANCHE (pas d’`id`) →
  - div : display flex; flex-wrap wrap; align-items flex-end; justify-content space-between; gap 16px →
    - EN-TÊTE-SECTION : PASTILLE-BLEU « Formations » + H2-SECTION « Pour bien commencer » (pas de LEAD)
    - a → **NdCataloguePublic** : **BTN-TONAL-LG** → span « Voir tout le catalogue » + FLÈCHE **20px** — **[lot 1]** `/formations` (app : `Button asChild variant="gris" size="lg"` + icône dans le lien)
  - div grille : display grid; grid-template-columns **repeat(auto-fill, minmax(clamp(250px, calc((1060px - 100%) * 999), calc((100% - 20px) / 2)), 1fr))**; gap 20px; **margin-top 36px** → 4 × CARTE-PUBLIQUE → NdFormationPublic (titres **h2**, à passer en h3, §21)

### 8.2 Les 4 cartes de la maquette (app : `CarteFormation variante="public" titleAs="h3"`, href `/formations/{slug}`)

| # | PILE | BADGE parcours | BADGE statut | Titre (h2 + title) | Description | Note | Durée | Niveau |
|---|---|---|---|---|---|---|---|---|
| 1 | BLEU | Académique | Gratuit (vert) | Zotero : gérer ses références | Collectez vos sources et générez citations et bibliographie sans erreur. | 4,8 (74) | 2 h 20 | Débutant |
| 2 | VIOLET | Digital | Gratuit (vert) | Canva, de débutant à expert | Créez affiches, présentations et visuels soignés, même sans base en design. | 4,9 (88) | 5 h 10 | Débutant |
| 3 | BLEU | Académique | Populaire (ambre) | Méthodologie du mémoire | De la problématique à la rédaction : la méthode pour avancer sans vous perdre. | 4,9 (143) | 7 h 45 | Intermédiaire |
| 4 | ORANGE | Business | Populaire (ambre) | Lancer son activité de freelance | Offre, tarifs, premiers clients : les étapes pour démarrer une activité en ligne. | 4,8 (69) | 6 h 00 | Intermédiaire |

- Mêmes données que le catalogue public (annexe 1.3 §2.4). Note et durée réelles : la note n’apparaît qu’avec des avis (`CatalogCard` la masque sinon) ; la durée est calculée sur les leçons (seule Excel en a dans les données d’exemple) : sans leçons, la méta se réduit au niveau.
- Règle de choix des 4 formations : **non dite** par la maquette ni par la spec (§19, Q1).

### 8.3 La grille « à seuil »
- Contenu ≥ 1060px : `calc((1060px - 100%) * 999)` est négatif → piste minimale **250px** → `auto-fill` met autant de colonnes de 250px que possible : **4** à 1440 (293px chacune, contenu 1232px), mais **5 pistes dès 1330px de contenu (≈ 1538px de large) : 4 cartes et une colonne vide**.
- Contenu < 1060px (≈ 1267px de large) : valeur énorme → piste = (100% − 20px) / 2 → **2 colonnes** (2 × 2) ; jamais 3.
- Contenu < 520px (≈ 614px de large) : piste = 250px → 1 colonne.
- **Pas de `min(100%, …)`** : sous 250px de contenu (écran < 338px, donc à 320px : contenu 232px), la piste reste à 250px → **débordement horizontal de 18px**.
- Proposition (à vérifier en navigateur) : `minmax(min(100%, max(250px, clamp(calc((100% - 60px) / 4), calc((1060px - 100%) * 999), calc((100% - 20px) / 2)))), 1fr)` → 4 colonnes exactement au-delà de 1060px, 2 en dessous, 1 sous 520px, sans débordement.

---

## 9. Formules — [lot 1, sans prix (Q10)]

### 9.1 Structure
- SECTION-NUE (pas d’`id` : **ajouter `id="formules"`**, cible de « Tarifs » au lot 1) →
  - EN-TÊTE-SECTION-CENTRÉ : PASTILLE-BLANC « Formules » + H2-SECTION « Un abonnement mensuel, sans prélèvement automatique » + LEAD-SECTION « Vous renouvelez quand vous voulez. Vos formations et vos certificats restent sur votre compte. »
  - div grille : display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(270px, calc((100% - 40px) / 3))), 1fr)); gap 20px; margin-top 40px → 3 colonnes (416px à 1440) ; **2 colonnes entre ≈ 624 et 979px de large** (Premium seule sur la 2e rangée, moitié vide) ; 1 colonne en dessous.
- `CARTE-FORMULE` (Basique, Premium) : div box-sizing border-box; display flex; flex-direction column; padding 28px; border-radius 24px; border 1px solid #EAEEF7; background #FFFFFF; min-width 0 →
  - div : display flex; align-items center; justify-content space-between; gap 8px; min-height 28px → **h3** : margin 0; font-size 20px; line-height 28px; font-weight 600; color #1D1D1F
  - p : margin 6px 0 0; **min-height 44px**; font-size 14px; line-height 22px; color #667085
  - div prix : display flex; align-items baseline; gap 8px; margin-top 18px → span font-size 44px; line-height 48px; font-weight 500; letter-spacing -0.03em; color #262628 « [PRIX] » + span 14/22 #667085 « FCFA / mois » — **[remplacé au lot 1 (Q10)]**
  - (ligne vide dans la source : élément retiré)
  - div trait : height 1px; margin 24px 0; background #EAEEF7
  - div flex 1 → LISTE-COCHÉE (COCHE #0B18C9)
  - a → **NdTarifs** : **BTN-SECONDARY-LG** + width 100%; margin-top 28px → span « Voir le détail » — **[lot 2]**
- `CARTE-FORMULE-MISE-EN-AVANT` (Standard) : padding 28px; border-radius 24px; background-color #0B18C9; MOTIF-POINTS; box-shadow 0 24px 48px rgba(11, 24, 201, 0.26); **pas de bordure** →
  - h3 color #FFFFFF + span pastille : display inline-flex; align-items center; padding 4px 10px; border-radius 999px; background #FFFFFF; font-size 12px; line-height 18px; font-weight 600; color #0B18C9 — « Recommandée »
  - p color #DDE1FF ; prix color #FFFFFF + « FCFA / mois » color #DDE1FF ; trait background rgba(255, 255, 255, 0.22) ; `li` color #FFFFFF et COCHE #FFFFFF
  - a → NdTarifs : gabarit BTN-BLANC déclaré **height 44px puis 48px** et **font-size 14px puis 15px** (retenir 48px et 15px), padding 0 16px, weight 600, margin-top 28px, **sans width 100%** (l’étirement des éléments flex donne la même largeur) — hover `background: #EEF0FF` — FOCUS-W → « Voir le détail » — **[lot 2]**

| Formule | Description | 3 points |
|---|---|---|
| Basique | Pour se concentrer sur un objectif. | 1 parcours au choix · Quiz, exercices et certificats · Communauté du parcours |
| Standard (« Recommandée ») | Pour combiner deux compétences. | 2 parcours au choix · Sessions live et exercices corrigés · Plus de formations complémentaires |
| Premium | Pour tout apprendre, avec un suivi renforcé. | Tous les parcours · Accompagnement renforcé · Fonctionnalités Premium |

### 9.2 Version lot 1 (proposition)
- **Prix (Q10)** : à la place de la ligne prix, dans chaque carte, `div` margin-top 18px; min-height 48px; display flex; align-items center → span font-size 16px; line-height 24px; font-weight 500; color #262628 (Standard : #FFFFFF) « Prix annoncés au lancement ». La hauteur (48px) est celle de la ligne prix : les trois cartes restent alignées. Variante : une seule phrase sous la grille (centrée, 14/22 #535E75) et aucune ligne prix dans les cartes.
- **« Voir le détail »** : la page Tarifs arrive au lot 2 → **masqué au lot 1** (proposition, Q2) ; la liste garde `flex: 1`, les cartes restent de même hauteur.
- Texte fixe (pas de table des formules au lot 1) ; au lot 2, prix (et peut-être contenus) depuis le back-office.

---

## 10. Accompagnement — [lot 1, texte fixe]

- SECTION-BLANCHE (pas d’`id`) → div : display flex; flex-wrap wrap; **align-items center**; gap 64px →
  - div gauche : **flex 1 1 400px**; min-width 0 → EN-TÊTE-SECTION : PASTILLE-BLEU « Accompagnement » + H2-SECTION « Vous n’apprenez jamais seul » + LEAD-SECTION « Un formateur suit votre progression, corrige vos exercices et répond à vos questions. »
  - div droite : **flex 999 1 420px**; min-width 0 → div padding 14px; border-radius 28px; background #EEF0FF → div grille : display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(220px, calc((100% - 14px) / 2))), 1fr)); gap 14px → 4 × `CARTE-ATOUT` :
    - div box-sizing border-box; display flex; flex-direction column; padding 22px; **border-radius 18px**; background #FFFFFF; min-width 0 → TUILE(44px, 13px) {bg / fg} → icône 20px + **h3** : margin 18px 0 0; font-size 17px; line-height 24px; font-weight 600; color #1D1D1F + p : margin 6px 0 0; 14/22 #667085; text-wrap pretty

| # | TUILE 44/13 | Icône 20px | h3 | p | Lot de la fonction |
|---|---|---|---|---|---|
| 1 | #DDE1FF / #0B18C9 | VIDÉO | Sessions live | Avec Google Meet ou Zoom, programmées dans votre tableau de bord. | 5 |
| 2 | #FFEDD9 / #C2410C | EXERCICE | Exercices corrigés | Vous déposez votre travail, le formateur valide ou vous guide. | 3 |
| 3 | #EDE9FE / #6D28D9 | BULLE | Messagerie | Une question sur une leçon ? Écrivez directement à votre formateur. | 5 |
| 4 | #DDF3E4 / #17663A | CIBLE | Suivi de progression | Objectifs, séries d’apprentissage et rappels pour garder le rythme. | 1 (progression) / 6 (objectifs, séries) |

- À 1440 : gauche 400,4px, droite 767,7px (grille intérieure 739,7px → 2 colonnes de 362,8px). Repli sous ≈ 1072px de large ; grille intérieure en 1 colonne sous 454px.

---

## 11. Communauté (`id="communaute"`) — [lot 1 ; bouton : lot 5]

- section **id="communaute"** : box-sizing border-box; padding clamp(28px, 5vw, 64px); border-radius 28px; background **#EEF0FF** → div : display flex; flex-wrap wrap; align-items center; gap 56px →
  - div gauche : **flex 999 1 420px**; min-width 0 → div display flex; flex-direction column; **gap 26px**; min-width 0 →
    - EN-TÊTE-SECTION : PASTILLE-BLANC « Communauté » + H2-SECTION « Une communauté par parcours » + LEAD-SECTION « Posez vos questions, partagez vos réussites et entraidez-vous. Un espace général ouvert à tous, et un espace privé pour chaque parcours. »
    - a → **NdCommunaute** : BTN-PRIMARY + align-self flex-start → span « Voir la communauté » + FLÈCHE 20px — **[lot 5]** (Q2)
  - div droite : **flex 1 1 500px**; min-width 0 → div position relative; max-width 520px; margin 0 auto; padding 14px 18px 26px →
    - div aria-hidden="true" (carte fantôme) : position absolute; top 34px; right 4px; bottom 6px; left 34px; border-radius 16px; background #FFFFFF; opacity 0.6; transform rotate(3deg)
    - div `PUBLICATION` : box-sizing border-box; display flex; flex-direction column; padding 24px 24px 18px; border déclaré **1px solid #EAEEF7 puis 0** (retenir 0); background #FFFFFF; border-radius 16px; min-width 0; position relative; box-shadow 0 18px 44px rgba(11, 24, 201, 0.16); transform rotate(-1.5deg) →
      - div display flex; align-items center; gap 12px → AVATAR(44px) #DDE1FF / #0B18C9 font-size 16px « KD » + span flex column; min-width 0 → span 15/22 600 #1D1D1F « Koffi D. » + span 13/20 #667085 « Espace Académique · il y a 2 h »
      - p : margin 0; margin-top 16px; font-size 17px; line-height déclaré **22px puis 27px** (retenir 27px); color #232326; text-wrap pretty — « J’ai enfin terminé ma revue de littérature grâce à la méthode du module 2. Merci à tous pour vos conseils ! »
      - div trait : height 1px; margin-top 18px; background #EAEEF7
      - div : display flex; flex-wrap wrap; align-items center; gap déclaré **7px puis 14px** (retenir 14px); font-size 14px; line-height 22px; color #667085; margin-top 14px → span (flex; center; gap 4px) CŒUR 18px + « 24 » · DOT · span (flex; center; gap 4px) BULLE 18px + « 8 »
- À 1440 : gauche 675,7px, droite 500,3px ; repli sous ≈ 1174px de large.
- Lot 1 : section gardée (ancre de l’en-tête). Publication = illustration (données inventées, personne nommée : question 19) ; bouton vers une page du lot 5 réservée aux comptes (un visiteur serait renvoyé à `/connexion`) : Q2.

---

## 12. Témoignages — [masqué (Q11)]

- SECTION-BLANCHE (pas d’`id`) →
  - EN-TÊTE-SECTION : PASTILLE-BLEU « Témoignages » + H2-SECTION « Ils ont suivi Étudium » (pas de LEAD)
  - div grille : repeat(auto-fill, minmax(min(100%, max(270px, calc((100% - 40px) / 3))), 1fr)); gap 20px; margin-top 40px → 3 × `figure` : box-sizing border-box; display flex; flex-direction column; margin 0; padding 28px; border-radius 24px; background #F2F6FD; min-width 0 →
    - span aria-hidden="true" : display flex; center/center; width 48px; height 48px; border-radius 14px; background #0B18C9; color #FFFFFF → GUILLEMETS 26px (Phosphor, viewBox 256)
    - blockquote : flex 1; margin 22px 0 0; font-size 18px; line-height 28px; color #232326; text-wrap pretty
    - figcaption : display flex; align-items center; gap 12px; margin-top 26px → AVATAR(44px) background #E5EBF7; font-size 16px; color #4A546B « ? » + span flex column → span 15/22 600 #1D1D1F + span 13/20 #667085
  - puis la boîte des chiffres (§13), **dans la même section**.

| blockquote | Nom | Ligne 2 |
|---|---|---|
| [Témoignage d’un étudiant ou d’une étudiante] | [Prénom N.] | [Filière, université] |
| [Témoignage d’un jeune diplômé] | [Prénom N.] | [Métier ou activité] |
| [Témoignage d’un étudiant devenu freelance] | [Prénom N.] | [Activité en ligne] |

- Spec Q11 : **masqué** tant qu’il n’y a pas de vrais témoignages ; ajoutés plus tard depuis le back-office. Pas de faux témoignages. Au lot 1 : **toute la section disparaît** (titre compris).
- Plus tard : `Avatar` n’a pas de ton neutre (#E5EBF7 / #4A546B) ; GUILLEMETS à intégrer en SVG (pas de Phosphor dans l’app ; les icônes Phosphor existantes sont copiées en SVG, cf. `TopBarIcons`).

## 13. Chiffres — [masqué (Q11)]

- div (dans la section Témoignages) : margin-top 20px; padding clamp(20px, 3vw, 32px) clamp(8px, 1.5vw, 16px); border-radius 24px; background-color #0B18C9; MOTIF-POINTS → div grille : repeat(auto-fill, minmax(min(100%, max(190px, calc((100% - 48px) / 4))), 1fr)); gap 16px → 4 × div : display flex; flex-direction column; gap 4px; padding 6px clamp(12px, 2vw, 28px); min-width 0 →
  - span : font-size clamp(30px, 3.4vw, 44px); line-height 1.1; font-weight 500; letter-spacing -0.03em; color #FFFFFF — « [NOMBRE] »
  - span : font-size 15px; line-height 22px; color #DDE1FF — « étudiants inscrits » | « formations disponibles » | « certificats délivrés » | « formateurs »
- 4 colonnes à 1440 (288px) ; 3 sous 808px de contenu intérieur ; 2 sous 602px ; 1 sous 396px.
- Spec Q11 : **masqué** (« formations disponibles » et « formateurs » seraient calculables, mais la décision porte sur tout le bloc).

---

## 14. FAQ — [lot 1]

### 14.1 Structure
- SECTION-NUE (pas d’`id` : **ajouter `id="faq"`**, cible de « Questions fréquentes » du pied de page) → div : display flex; flex-wrap wrap; align-items flex-start; gap 56px →
  - div gauche : **flex 1 1 380px**; min-width 0 → EN-TÊTE-SECTION : PASTILLE-BLANC « Questions fréquentes » + H2-SECTION « Tout ce qu’il faut savoir avant de commencer » (pas de LEAD)
  - div droite : **flex 999 1 420px**; min-width 0 → div boîte : padding 6px clamp(18px, 3vw, 32px) 10px; border-radius 24px; background #FFFFFF → 7 × div : border-bottom 1px solid #EAEEF7 (le dernier aussi) →
    - ACCORDÉON : button type="button" aria-expanded="{{f.faqN}}" onClick="{{t.faqN}}" → span question + span chevron (transform `{{fx.faqN.rot}}`) → CHEVRON-BAS 20px
    - `sc-if value="{{f.faqN}}"` → p panneau (réponse) : margin 0; padding 0 40px 18px 0; 14/22 #667085; text-wrap pretty
- À 1440 : gauche 380,4px, droite 851,6px (boîte intérieure 787,6px). Repli sous ≈ 986px de large.

### 14.2 Comportement
- **Script, pas `details/summary`** : état `f_faq0` à `f_faq6` (drapeaux indépendants) ; clic = bascule du drapeau (`t.faqN`) ; chevron `rotate(180deg)` ouvert / `rotate(0deg)` fermé ; panneau retiré du DOM quand il est fermé.
- **Ouvert par défaut : la 1re question seulement** (`f_faq0: true`, les autres `false` ; `hint-placeholder-val="{{ true }}"` sur la 1re).
- **Plusieurs questions peuvent être ouvertes à la fois.**
- Pas d’`aria-controls`, pas d’`id` sur les panneaux, pas de titre autour des boutons, **pas de hover**, FOCUS sur les boutons.
- App : `Accordion` (Radix, `type="multiple"`, `defaultOpen={[0]}`) a **exactement** ces valeurs (bordure basse #EAEEF7, `min-h-14 py-2`, 16/24 500 `text-encre`, `gap-4`, chevron 20px tourné de 180°, réponse `pr-10 pb-[18px]` 14/22 `text-discret text-pretty`) et ajoute `aria-controls`, la région et un `h3` autour de chaque question. Boîte : `rounded-bloc bg-panneau px-[clamp(18px,3vw,32px)] pt-1.5 pb-2.5`.

### 14.3 Les 7 questions et réponses (verbatim)
1. **Le compte gratuit est-il vraiment gratuit ?** — Oui. Il donne accès aux formations gratuites, au catalogue, à votre progression, à vos certificats et à la communauté générale en lecture. Vous choisissez une formule payante seulement si vous le souhaitez. *(ouverte par défaut)*
2. **Comment payer mon abonnement ?** — Par Mobile Money, depuis votre téléphone. Votre accès est activé automatiquement dès que le paiement est confirmé.
3. **Le renouvellement est-il automatique ?** — Non. Vous recevez des rappels avant l’expiration et vous renouvelez quand vous le décidez. Aucun prélèvement automatique.
4. **Puis-je changer de parcours ?** — Vos parcours restent les mêmes pendant la période d’abonnement. À chaque renouvellement, vous pouvez en choisir de nouveaux.
5. **Que se passe-t-il quand mon abonnement expire ?** — Vos formations sont verrouillées mais rien n’est supprimé : votre progression, vos formations complémentaires et vos certificats restent sur votre compte. Tout redevient accessible dès que vous renouvelez.
6. **Comment un recruteur vérifie-t-il mon certificat ?** — Chaque certificat porte un identifiant unique et un QR Code. En le scannant, n’importe qui accède à une page publique de vérification, sans créer de compte.
7. **Puis-je suivre les formations sur mon téléphone ?** — Oui. Étudium s’installe sur votre téléphone comme une application, depuis le navigateur.

- Spec §9 : les 7 questions sont reprises telles quelles. Elles décrivent des fonctions des lots 2 (paiement, renouvellement, expiration), 3 (certificats, vérification) et 5 (communauté) : texte fixe, juste au lancement.

---

## 15. Appel à l’action final — [lot 1]

Identique à l’annexe 1.3 §5.5 (et à NdFormationPublic) :
- section : box-sizing border-box; padding clamp(28px, 5vw, 64px); border-radius 28px; background-color #0B18C9; MOTIF-POINTS; color #FFFFFF → div : display flex; flex-wrap wrap; align-items center; justify-content space-between; gap 32px 56px →
  - div : flex 1 1 460px; min-width 0; display flex; flex-direction column; gap 28px → div (flex column; gap 16px; max-width 800px) → h2 : margin 0; font-size clamp(36px, 4.8vw, 62px); line-height 1.08; font-weight 500; letter-spacing -0.028em; color #FFFFFF; text-wrap balance — « Commencez gratuitement dès aujourd’hui » + p : margin 0; max-width 640px; 17/27 #DDE1FF; text-wrap pretty — « Créez votre compte en une minute, suivez les formations gratuites, puis choisissez votre formule quand vous êtes prêt. » ; div (flex; flex-wrap wrap; gap 12px) → a → NdInscription BTN-BLANC « Créer mon compte gratuit » + FLÈCHE 18px ; a → NdCataloguePublic BTN-OUTLINE-W-52 « Découvrir les formations »
  - div illustration : flex none; padding 12px 20px → div aria-hidden="true" display flex; align-items center → 3 × span 104×104; border-radius 29px; background #FFFFFF; box-shadow 0 10px 28px rgba(4, 10, 80, 0.22) : margin-left 0 / rotate(-7deg) PILE-BLEU 64 ; margin-left -17px / rotate(4deg) PILE-VIOLET 64 ; margin-left -17px / rotate(-3deg) PILE-ORANGE 64
- App : `BandeAppelAction` (cibles `/inscription`, `/formations`) — identique ; déjà adaptée au téléphone (boutons `min-h-[52px] py-3 leading-tight`, illustrations `max-sm:hidden`). Texte de la colonne : 858px à 1440 ; illustration sous le texte sous ≈ 1016px de large.

---

## 16. Pied de page — [lot 1]

Identique à l’annexe 1.3 §1 : footer box-sizing border-box; display flex; flex-wrap wrap; gap 32px 48px; padding clamp(28px, 4.5vw, 56px); border-radius 28px; background-color #060F75; MOTIF-POINTS; color #C2C8FF →
- div marque : flex 1 1 280px; display flex; flex-direction column; gap 14px; max-width 360px → span (flex; center; gap 10px; 22px 700; letter-spacing -0.02em; #FFFFFF) LOGO-BLANC 30px + « Étudium » + span 15/24 « Formation, compétences digitales et accompagnement pour les étudiants et les jeunes diplômés. »
- 3 colonnes : div flex 0 1 180px; display flex; flex-direction column; gap 4px → span titre (margin-bottom 8px; 13px 600; letter-spacing 0.04em; uppercase; #9DA6FF) + liens (display flex; align-items center; min-height 34px; 15px 500 #FFFFFF; text-decoration none — hover underline — **pas de focus-visible**)
- div copyright : flex 1 1 100%; padding-top 20px; border-top 1px solid rgba(255, 255, 255, 0.16); 13/20 — « © 2026 Étudium. Tous droits réservés. »

| Colonne | Lien | Maquette | Lot 1 |
|---|---|---|---|
| Plateforme | Formations | NdCataloguePublic | **[lot 1]** `/formations` (en place) |
| | Parcours | NdLanding (**sans ancre**) | **[lot 1]** `/#parcours` |
| | Tarifs | NdTarifs | **[lot 1]** `/#formules` (lot 2 : `/tarifs`) |
| Ressources | Questions fréquentes | **NdTarifs** | **[lot 1]** `/#faq` |
| | Vérifier un certificat | NdVerification | **[lot 3]** |
| | Communauté | **NdCommunaute** (page connectée) | **[lot 1]** `/#communaute` |
| Légal | Conditions d’utilisation | `#` | **[lot 1]** `/conditions` (en place) |
| | Confidentialité | `#` | **[lot 1]** `/confidentialite` (en place) |
| | Contact | `#` | **masqué** tant que l’adresse e-mail de contact n’est pas donnée (spec §9) |

- App : `PiedDePagePublic` a les mêmes valeurs, met chaque colonne dans un `nav aria-label="{titre}"` et ajoute `focus-blanc` aux liens. Colonne « Ressources » à créer (elle n’existe pas encore), entre Plateforme et Légal.

---

## 17. Icônes

Hugeicons stroke-rounded (trait 1.5px, `fill: none; stroke: currentColor`, viewBox 24) sauf mention. Noms **vérifiés** : points de départ des sous-tracés comparés à `@hugeicons/core-free-icons` installé dans `web/` (même méthode que l’annexe 1.10). Toutes `aria-hidden="true"`, `flex-shrink: 0; display: block`.

| Clé | Nom exact | Glyphe | Tailles / couleurs (où) |
|---|---|---|---|
| FLÈCHE | ArrowRight02Icon | flèche → | 18px (BTN-BLANC du hero et de la CTA ; liens des parcours) ; 20px (« Voir tout le catalogue », « Voir la communauté ») — couleur héritée |
| HORLOGE | Clock01Icon | horloge | 18px #667085, margin 0 -1.5px (cartes) |
| ÉTOILE | StarIcon | étoile contour | 16px #667085, margin 0 -1px (cartes) |
| CERTIFICAT | Certificate01Icon | document + médaille | 20px #17663A (hero) ; 22px #17663A (Solution) |
| COCHE-CERCLE | CheckmarkCircle02Icon | coche dans un cercle | 20px #232326 (hero) ; 20px #0B18C9 (Solution, ligne 1) |
| VIDÉO | Video01Icon | caméra | 20px #0B18C9 (hero, Accompagnement) ; 22px #0B18C9 (Solution) ; 20px #6D28D9 (ligne « Session live ») |
| PLAY-CERCLE | PlayCircleIcon | triangle dans un cercle | 20px #0B18C9 / #667085 (Solution) |
| EXERCICE | AssignmentsIcon | cahier + coche | 22px #C2410C (Solution) ; 20px #C2410C / #667085 (lignes) ; 20px #C2410C (Accompagnement) |
| QUIZ | Quiz01Icon | badge dentelé + « ? » | 20px #C2410C (Solution) |
| FORMATEUR | TeachingIcon | personne au tableau | 22px #6D28D9 (Solution) |
| BULLE | BubbleChatIcon | bulle ronde + 3 points | 20px #6D28D9 (ligne « Espace Académique », Accompagnement) ; 18px #667085 (publication, « 8 ») |
| QR-CODE | QrCodeIcon | QR code | 36px #15803D (certificat de la Solution) |
| CIBLE | Target02Icon | cible + flèche | 20px #17663A (Accompagnement) |
| CŒUR | FavouriteIcon | cœur contour | 18px #667085 (publication, « 24 ») |
| COCHE | Tick02Icon | coche simple | 18px #0B18C9 / #6D28D9 / #C2410C (parcours) ; #0B18C9 / #FFFFFF (formules) |
| CHEVRON-BAS | ArrowDown01Icon | chevron ∨ | 20px, couleur héritée #1D1D1F (FAQ) |
| GUILLEMETS | **Phosphor « Quotes », version pleine** (viewBox 256, `fill: currentColor`) | deux guillemets | 26px #FFFFFF (Témoignages — masqué) |
| LOGO / LOGO-BLANC | `LogoMark` | hexagone + « É » | 30px |
| PILE-* | `CourseIllustration` | 3 losanges | 48 (cartes), 52 (certificat de la Solution), 62 (parcours), 64 (CTA) |

---

## 18. États interactifs et ARIA

### 18.1 Logique maquettée
- État : `ov` (inutilisé : `OV` vide), `f_faq0`…`f_faq6` (FAQ, §14.2). Aucun autre état ; aucun dialogue.

### 18.2 États visuels déclarés
- **hover** : liens de l’en-tête → #E9EFFB ; « Se connecter » → #DEE6F6 ; BTN-PRIMARY → #08149F ; BTN-BLANC → #EEF0FF ; BTN-OUTLINE-W → rgba(255, 255, 255, 0.14) ; puces du hero → rgba(255, 255, 255, 0.2) ; cartes (hero et formations) → bordure #D2D9E8 ; liens des parcours → texte {accent} ; BTN-TONAL-LG → #DEE6F6 ; BTN-SECONDARY-LG → #F2F6FD ; « Voir le détail » Standard → #EEF0FF ; liens du pied de page → soulignés. **Pas de hover** : boutons de la FAQ, cartes non cliquables.
- **focus-visible** : FOCUS sur logo, liens et boutons de l’en-tête, carte du hero (**invisible sur le bleu**), « Voir tout le catalogue », cartes des formations, « Voir le détail » (Basique, Premium), « Voir la communauté », boutons de la FAQ ; FOCUS-W sur BTN-BLANC, BTN-OUTLINE-W, « Voir le détail » Standard. **Manquants** : puces du hero, liens « Voir les formations du parcours », liens du pied de page (déjà corrigé dans l’app).
- **ARIA présents** : `aria-label="Étudium, accueil"` (logo) ; `role="progressbar" aria-label="Progression" aria-valuenow="68"` (carte du hero) ; `aria-expanded` (FAQ) ; `aria-hidden="true"` sur numéros, pastilles de couleur, piles, carte fantôme, icônes ; `title` sur les titres de carte. Aucun `aria-current`, `aria-controls`, `aria-labelledby`, `aria-live`.

---

## 19. Données

| Bloc | Source | Détail |
|---|---|---|
| En-tête, pied de page | texte fixe | liens du §2 et du §16 |
| Hero — textes, boutons | texte fixe | |
| Hero — puces | table `parcours` (ou texte fixe) | `nom` + `couleur` des 3 parcours actifs, par `ordre` ; « Trois » écrit en dur (Q15) |
| Hero — illustration | fixe, inventé | décorative (Q12) |
| Vous vous reconnaissez ?, Solution, Comment ça marche, Accompagnement, textes de Communauté, FAQ, CTA | texte fixe | verbatim §4–§15 |
| Trois parcours | `listParcoursCatalogue()` (`parcours` actifs, triés par `ordre`) | `nom` → h3 ; `couleur` → pile, fond, accent ; `slug` → `/formations?parcours={slug}` ; `description` → p (**mais** la base contient les textes de NdParcours, plus courts — ci-dessous) ; **6 points : aucun champ en base** → texte fixe par couleur, ou nouvelle colonne (Q3) |
| Formations | `listCatalogue()` (formations **publiées**, avec note et nombre d’avis) | **4 cartes** dans la maquette ; règle de choix à fixer (Q1) |
| Formules | texte fixe (pas de table avant le lot 2) | 3 formules : noms, description, 3 points, « Recommandée » sur Standard ; prix → « Prix annoncés au lancement » (Q10) |
| Témoignages, chiffres | — | masqués (Q11) ; plus tard depuis le back-office |

**Descriptions des parcours : maquette Landing ≠ base** (la base reprend NdParcours) :
- Réussite académique — base : « Les outils et méthodes pour réussir à l’université : bureautique, recherche, rédaction scientifique et soutenance. » ; landing : « …bureautique, recherche documentaire, rédaction scientifique, mémoire et soutenance. »
- Compétences digitales — base : « Design, intelligence artificielle, contenu et automatisation : les compétences numériques recherchées. » ; landing : « Les compétences numériques recherchées par les employeurs : design, intelligence artificielle, contenu et automatisation. »
- Business & revenus en ligne — base : « Freelance, produits digitaux et vente en ligne : créer une activité grâce au numérique. » ; landing : « Créer une activité et des revenus grâce au numérique : trouver des clients, vendre en ligne et lancer son business. »

**Formations « Pour bien commencer » — proposition de règle** (reproduit la maquette avec les données d’exemple) : jusqu’à 2 formations **gratuites**, puis les formations **« Populaire »** les plus récemment publiées jusqu’à 4 au total ; chaque groupe trié par ordre du parcours. Avec les données d’exemple : gratuites = Zotero (Académique), Canva (Digital) ; populaires = Freelance (−15 j), Méthodologie (−40 j), Excel (−60 j) → Méthodologie, Freelance → **exactement les 4 cartes de la maquette, dans l’ordre**. Moins de 4 formations : grille incomplète (2 colonnes à moitié remplies) ; aucune : section masquée (cas du mode démonstration, où `listCatalogue()` renvoie une liste vide).

---

## 20. Responsive

La maquette n’a **pas de version téléphone** : les replis ci-dessous découlent des styles. Largeurs d’écran calculées avec les marges de l’app (`CadrePublic` : 20px au-dessus de 640px, 8px en dessous).

### 20.1 Largeur de contenu selon l’écran
| Écran | SECTION-BLANCHE | Hero | SECTION-NUE | Pied de page |
|---|---|---|---|---|
| 1440 | 1232 | 1216 | 1288 | 1248 |
| 1280 | 1072 | 1072 | 1136 | 1088 |
| 1024 | 841,6 | 841,6 | 892,8 | 851,8 |
| 768 | 611,2 | 611,2 | 649,6 | 618,9 |
| 390 | 302 | 302 | 338,5 | 302 |
| 360 | 272 | 272 | 310 | 272 |
| 320 | 232 | 232 | 272 | 232 |

### 20.2 Replis par bloc (seuils en largeur d’écran)
| Bloc | Mécanisme | Replis |
|---|---|---|
| En-tête | flex-wrap (2 groupes) | logo + 4 liens et les 2 boutons passent à la ligne ; sur téléphone 3 à 4 rangées de 49px |
| Hero | flex 999 1 420px / 1 1 440px, gap 56 | illustration sous le texte < 1107 ; h1 clamp 68 → 38 ; padding clamp 72 → 28 |
| Vous vous reconnaissez ? | flex 1 1 420px / 999 1 420px, gap 64 | titre au-dessus de la liste < 1094 |
| Solution | grille max(320px, ½) | 2 → 1 colonne < 779 |
| Parcours | grille max(290px, ⅓) | 3 → 2 < 1100 (3e carte seule) → 1 < 756 |
| Comment ça marche | grille max(210px, ¼) | 4 → 3 < 1103 → 2 < 843 → 1 < 532 |
| Formations | grille à seuil (§8.3) | 5 pistes ≥ 1538 (une vide) ; 4 de 1267 à 1537 ; 2 de 614 à 1266 ; 1 en dessous ; **débordement < 338** |
| Formules | grille max(270px, ⅓) | 3 → 2 < 979 (Premium seule) → 1 < 624 |
| Accompagnement | flex 1 1 400px / 999 1 420px, gap 64 ; grille max(220px, ½) | texte au-dessus < 1072 ; 4 cartes en 1 colonne quand la boîte < 482px |
| Communauté | flex 999 1 420px / 1 1 500px, gap 56 | publication sous le texte < 1174 |
| Témoignages (masqué) | grille max(270px, ⅓) | 3 → 2 < 1034 → 1 < 712 |
| FAQ | flex 1 1 380px / 999 1 420px, gap 56 | titre au-dessus < 986 |
| CTA | flex 1 1 460px / illustration flex none | illustration dessous < 1016 ; masquée < 640 dans l’app |
| Pied de page | flex-wrap, colonnes 0 1 180px | colonnes à la ligne |

### 20.3 Ce qui risque de déborder ou de se tasser
**À 390px (contenu 302px)** :
- En-tête : 4 liens + 2 boutons ≈ 220–270px de haut avant le hero (aucune maquette) — Q5.
- Illustration du hero (si gardée) : carte à 248px ; dans la ligne « Session live », tuile 44 + avatars 84 + écarts laissent ≈ 64px au texte (« Session » / « live » sur deux lignes) ; badge certificat sur 2 lignes. Proposition : masquer l’illustration sous 640px (comme les piles de la CTA).
- Le reste tient (une colonne partout).

**À 320px (contenu 232px ; 272px pour les sections nues)** :
- Boutons du hero (BTN-BLANC ≈ 281px, BTN-OUTLINE-W-52 ≈ 257px, `nowrap`) : **débordent** (déjà vrai à 360px pour le premier) → reprendre l’adaptation de `BandeAppelAction` (`min-h-[52px] py-3 leading-tight text-center`, sans `nowrap`).
- « Voir tout le catalogue » (BTN-TONAL-LG ≈ 251px, `nowrap`) : **déborde** de ≈ 19px → autoriser le retour à la ligne ou réduire.
- Grille des formations : piste minimale 250px > 232px → **défilement horizontal** (§8.3).
- Carte du hero (si gardée) : méta « 68 % terminé · 2 h restantes » (≈ 181px, sans flex-wrap) dans 150px → **déborde**.
- Certificat de la Solution : pile 52 + tuile QR 60 + écarts laissent ≈ 20px au texte → illisible ; proposition : `flex-wrap: wrap` ou masquer la pile sous 400px.
- Ligne « Session live » de la Solution : titre réduit à ≈ 40px (ellipsis).
- h1 du hero (38px) et h2 de la CTA (36px) : « compétences » (≈ 220px) et « gratuitement » (≈ 230px) frôlent la largeur.
- Puces du hero : hauteur fixe 40px, « Business & revenus en ligne » passe sur 2 lignes dans la puce → `min-height` plutôt que `height`.
- Liens « Voir les formations du parcours » : texte sur 2 lignes dans 48px fixes (tient) → `min-height` conseillé.

---

## 21. Accessibilité

### 21.1 Titres
- **h1** unique : « Les compétences qui comptent, pendant vos études et après. »
- **h2** de section : Le diplôme ne suffit plus… · Un seul endroit… · Choisissez la direction… · Quatre étapes… · Pour bien commencer · Un abonnement mensuel… · Vous n’apprenez jamais seul · Une communauté par parcours · (Ils ont suivi Étudium — masqué) · Tout ce qu’il faut savoir… · Commencez gratuitement dès aujourd’hui.
- **h3** : items de « Vous vous reconnaissez ? », cartes Solution, Parcours, Étapes, Formules, Atouts.
- **Défauts** : la carte du hero porte un **h2** (« Maîtriser Microsoft Excel ») avant tout titre de section → `span` (illustration) ; les 4 cartes de formations ont des **h2** sous un h2 → `titleAs="h3"` (déjà prévu par `CarteFormation`) ; les questions de la FAQ ne sont pas des titres (Radix les met dans un `h3` : bien).

### 21.2 Repères et ancres
- Maquette : `header`, `section` ×13, `footer` ; ni `main` ni `nav`. App : `main#contenu` et `nav` (en-tête, colonnes du pied) déjà dans `CadrePublic`.
- **Lien d’évitement absent** de `CadrePublic` (présent dans `AppShell`).
- `section` sans `aria-labelledby` → relier chacune à son h2 (sinon non annoncées comme régions).
- Ancres : `parcours`, `communaute` existent ; **ajouter `formules` et `faq`**. En-tête non collant : pas besoin de `scroll-margin-top`.

### 21.3 Sémantique et ARIA
- Illustrations (hero, boîtes de la Solution, publication de la Communauté) : textes inventés (« 68 % terminé », « Koffi D. », « ET-2026-EXC-4821 ») lus par les lecteurs d’écran → `aria-hidden="true"`, sans lien ni élément focalisable.
- Listes numérotées 01–04 (§4, §7) : numéros `aria-hidden`, sans `ol` → `ol` conseillé (ou `ul`) pour annoncer « liste de 4 éléments ».
- Cartes Solution, Parcours, Formules, Atouts : pas de liste ; optionnel.
- Liens « Voir les formations du parcours » ×3 et « Voir le détail » ×3 : même nom pour des cibles différentes → `aria-describedby` vers le h3 de la carte, ou texte masqué (« … du parcours Réussite académique »).
- FAQ : pas d’`aria-controls` dans la maquette → fourni par Radix.
- Barre de progression du hero : `aria-label="Progression"` générique (sans objet si l’illustration est masquée aux lecteurs d’écran).

### 21.4 Focus et cibles
- Focus manquants : puces du hero (→ FOCUS-W), liens des parcours (→ FOCUS), liens du pied de page (déjà `focus-blanc` dans l’app).
- Focus **invisible** : carte du hero (contour bleu #0B18C9 sur le fond #0B18C9) → FOCUS-W, ou plus de focus si décorative.
- Cibles : puces 40px, liens du pied de page 34px (< 44px conseillés sur téléphone) ; le reste ≥ 48px.

### 21.5 Contrastes (calculés)
- #C2C8FF sur #0B18C9 : 7,0:1 ✓ ; #C2C8FF sur #060F75 : 10,5:1 ✓ ; #DDE1FF sur #0B18C9 ✓ ; #667085 sur #FFFFFF : 4,9:1 ✓ ; #535E75 sur #EEF0FF ✓ ; #232326 sur les fonds teintés ✓. Aucun problème relevé.

---

## 22. Incohérences et questions ouvertes

### 22.1 Textes de remplacement
1. `[PRIX]` ×3 + « FCFA / mois » → Q10 : « Prix annoncés au lancement » ; placement proposé §9.2 (dans chaque carte, à la place du prix).
2. `[NOMBRE]` ×4 (étudiants inscrits, formations disponibles, certificats délivrés, formateurs) → Q11 : masqués (toute la boîte).
3. Témoignages (`[Témoignage d’un étudiant ou d’une étudiante]`, `[Témoignage d’un jeune diplômé]`, `[Témoignage d’un étudiant devenu freelance]`, `[Prénom N.]` ×3, `[Filière, université]`, `[Métier ou activité]`, `[Activité en ligne]`, avatars « ? ») → Q11 : masqués (toute la section, titre compris).

### 22.2 Liens morts, ancres et cibles
4. « Tarifs » (en-tête et pied) → NdTarifs (lot 2) ; la spec veut l’ancre Formules, mais **la section n’a pas d’`id`** → ajouter `id="formules"`.
5. « Questions fréquentes » (pied) → **NdTarifs**, alors que la FAQ est sur la landing (et qu’elle n’a pas d’`id`) → `/#faq` + `id="faq"`.
6. « Parcours » (pied) → NdLanding **sans ancre**, alors que l’en-tête pointe `#parcours` → `/#parcours`.
7. « Communauté » (pied) → NdCommunaute (page connectée, lot 5), alors que l’en-tête pointe `#communaute` → `/#communaute`.
8. Légal : trois `#` ; Conditions et Confidentialité existent (`/conditions`, `/confidentialite`) ; **Contact masqué** jusqu’à l’adresse e-mail (spec §9).
9. « Voir le détail » ×3 → NdTarifs (lot 2) : masqués au lot 1 (proposition) ou dirigés ailleurs ?
10. « Voir la communauté » → NdCommunaute (lot 5, réservée aux comptes : un visiteur arrive sur `/connexion`) : masqué au lot 1, ou remplacé par « Créer mon compte gratuit » ?
11. « Voir les formations du parcours » ×3 → NdCataloguePublic **non filtré** → `/formations?parcours={slug}` (proposition).
12. Carte du hero → NdFormationPublic (Excel) avec une progression de 68 % montrée à un visiteur, un h2 et un focus invisible → illustration non cliquable (proposition).
13. Bouton d’en-tête « Créer **un** compte gratuit » alors que la spec §9 veut « Créer **mon** compte gratuit » partout : changer aussi l’en-tête (catalogue et fiches compris) ?
14. « Vérifier un certificat » (en-tête, pied) → lot 3 : masqué au lot 1.

### 22.3 Données et textes
15. « Trois parcours au lancement » (pastille et bande du hero) et « Trois parcours » écrits en dur : faux si un 4e parcours est activé (« D’autres parcours arriveront. ») → garder fixe ou compter les parcours actifs ?
16. Descriptions des parcours : base (NdParcours) ≠ landing (§19) → quelle source ? Les 6 points : texte fixe ou colonne en base ?
17. « Pour bien commencer » : règle de choix non dite (proposition §19) ; que faire avec moins de 4 formations ?
18. La page promet des fonctions des lots 2 à 6 (paiement Mobile Money, exercices corrigés, certificats et QR Code, sessions live, messagerie, communauté, séries et rappels) : textes « tels quels » (spec §9), justes si la mise en ligne publique suit ces lots — à confirmer.
19. Personnes et données inventées dans les illustrations : « Koffi D. » et sa publication (proche d’un témoignage, alors que Q11 refuse les faux témoignages), « Dr Mireille Adjovi », RH / FA / SD, « ET-2026-EXC-4821 », « 24 réponses » → garder comme illustration, anonymiser, ou retirer la publication ?
20. Accords : « Corrigé par votre formatrice », « Votre formatrice » (féminin) vs « votre formateur », « un formateur » (masculin) ailleurs ; « Vous n’apprenez jamais seul », « quand vous êtes prêt » ; l’app écrit déjà « Votre formateur·rice » sur la fiche.
21. Formats différents pour la même session : « Samedi · 15 h 00 · en ligne » (hero) / « Session live · samedi · 15 h 00 » (Solution) ; « Module 3 : les tableaux croisés dynamiques » (hero) / « Module 3 · Les tableaux croisés dynamiques · 12 min » (accueil connecté).
22. Pas d’espace insécable devant `?`, `!`, `:` et `%` (maquette) : une ponctuation peut se retrouver seule en début de ligne ; ajouter des insécables fines ?

### 22.4 Mise en page et styles
23. Grille des formations : 5 pistes au-delà de ≈ 1538px (une colonne vide) et débordement sous 338px (§8.3).
24. Formules en 2 colonnes entre ≈ 624 et 979px : Premium seule sur sa rangée ; Parcours idem entre 756 et 1100px ; Étapes (4e seule) entre 843 et 1103px.
25. Déclarations en double : bouton d’en-tête 48 puis 49px ; « Voir le détail » Standard 44 puis 48px et 14 puis 15px ; publication border 1px puis 0, interligne 22 puis 27px, gap 7 puis 14px ; pastilles centrées `align-self` flex-start puis center.
26. « Voir le détail » Standard : 15px / 600 / padding 16px, les deux autres 16px / 500 / padding 18px ; pas de `width: 100%` (même rendu).
27. Couleurs hors jetons : #FFF3E6, #F3F0FE, #EAF7EF, #15803D, rgba(29, 29, 31, 0.1) ; rayons 20px et 18px (boîtes et atouts).
28. Puces du hero (`height` 40px) et liens des parcours (`height` 48px) : hauteur fixe pour un texte qui peut passer sur 2 lignes.

### 22.5 Téléphone, routage, divers
29. Aucune maquette téléphone : en-tête public (4 liens + 2 boutons) et illustrations du hero à décider (§20.3).
30. `/` redirige aujourd’hui le visiteur vers `/connexion` (`routeFor`) : à changer (visiteur → landing ; connecté → `/accueil`).
31. La page « Aide » (connectée) est annoncée « au lot 1 » avec « Les réponses aux questions fréquentes s’afficheront ici » (`pages-a-venir.ts`) : y reprendre les 7 questions de la FAQ en 1.12 ?
32. Titre de la page : `<title>` de la maquette « Étudium — Accueil public » = nom de planche ; titre et description à fixer pour la page réelle (proposition : « Étudium » + la phrase du hero).

### 22.6 Les 5 questions les plus importantes
- **Q1 — Formations « Pour bien commencer »** : règle de choix (proposition : 2 gratuites puis les populaires les plus récentes, 4 au plus, chaque groupe trié par parcours — reproduit la maquette) ; comportement avec moins de 4 formations.
- **Q2 — Liens sans page au lot 1** : « Voir le détail » (Tarifs, lot 2), « Voir la communauté » (lot 5), « Contact » (adresse) : masqués (proposition) ou redirigés ? Et le pied de page corrigé vers les ancres (`/#parcours`, `/#formules`, `/#faq`, `/#communaute`).
- **Q3 — Parcours** : descriptions de la base (NdParcours) ou de la landing ; les 6 points en texte fixe ou en base ; « Trois parcours » écrit en dur.
- **Q4 — Formules sans prix** : « Prix annoncés au lancement » dans chaque carte à la place du prix (proposition §9.2) ou une seule phrase sous la grille.
- **Q5 — Téléphone et illustrations** : en-tête public sur petit écran ; illustrations du hero (et publication de la communauté) décoratives, masquées sous 640px ? personnes inventées gardées ? Bouton d’en-tête « Créer mon compte gratuit » ?

---

## 23. Inventaire des textes (verbatim)

**En-tête** : Étudium | Parcours | Formations | Tarifs | Communauté | Vérifier un certificat | Se connecter | Créer un compte gratuit
(aria : Étudium, accueil)

**Hero** : Formation · Pratique · Accompagnement | Les compétences qui comptent, pendant vos études et après. | Étudium accompagne les étudiants et les jeunes diplômés : outils universitaires, compétences digitales et activités en ligne. Vous apprenez, vous pratiquez, un formateur vous accompagne, et vous obtenez un certificat vérifiable. | Créer mon compte gratuit | Découvrir les formations | Compte gratuit, sans engagement. Paiement par Mobile Money quand vous êtes prêt. | Académique | Maîtriser Microsoft Excel | Module 3 : les tableaux croisés dynamiques | 68 % terminé | 2 h restantes | Certificat obtenu | Microsoft Word · vérifiable par QR Code | Exercice validé | Corrigé par votre formatrice | Session live | Excel avancé : analyse de données | Samedi · 15 h 00 · en ligne | RH | FA | SD | Trois parcours au lancement | Réussite académique | Compétences digitales | Business & revenus en ligne
(aria : Progression ; title : Maîtriser Microsoft Excel)

**Vous vous reconnaissez ?** : Vous vous reconnaissez ? | Le diplôme ne suffit plus. Les outils et les compétences font la différence. | 01 | Votre mémoire avance lentement | Faute de méthode pour chercher, citer et rédiger, chaque chapitre prend des semaines. | 02 | Word, Excel et PowerPoint vous font perdre du temps | Mises en page, tableaux, présentations de soutenance : vous bricolez au lieu de maîtriser. | 03 | Les employeurs attendent des compétences digitales | Canva, IA, réseaux sociaux, outils no-code : on vous les demande, personne ne vous les a appris. | 04 | Vous voulez créer vos propres revenus | Freelance, produits digitaux, vente en ligne : vous ne savez pas par où commencer.

**La solution** : La solution | Un seul endroit pour apprendre, pratiquer et être accompagné | Étudium n’est pas une simple bibliothèque de vidéos. Chaque formation combine cours, exercices corrigés, accompagnement et certification. | Des formations courtes | Des vidéos découpées en leçons, des ressources à télécharger et une progression toujours visible. | Trier et filtrer | 08:12 | Les tableaux croisés dynamiques | 12:40 | Les graphiques avancés | 10:05 | De la pratique | Des quiz et des exercices corrigés par un formateur pour vérifier que vous savez faire. | Quiz du module 3 | Réussi | Exercice pratique | Validé | Exercice : nettoyer une enquête | À rendre | Un accompagnement | Des sessions live, une messagerie avec votre formateur et une communauté qui s’entraide. | MA | Dr Mireille Adjovi | Votre formatrice | Session live · samedi · 15 h 00 | RH | FA | SD | Espace Académique | 24 réponses | Des certificats vérifiables | Chaque certificat porte un QR Code : un recruteur peut vérifier son authenticité en un instant. | Certificat de réussite | Maîtriser Microsoft Excel | ET-2026-EXC-4821

**Trois parcours** : Trois parcours au lancement | Choisissez la direction qui vous ressemble | Chaque parcours regroupe des formations qui se complètent. D’autres parcours arriveront. | Parcours | Réussite académique | Les outils et méthodes pour réussir à l’université : bureautique, recherche documentaire, rédaction scientifique, mémoire et soutenance. | Microsoft Word, Excel et PowerPoint | Zotero et la recherche documentaire | Rédaction scientifique | Méthodologie du mémoire | Présentation et soutenance | Productivité académique | Voir les formations du parcours | Parcours | Compétences digitales | Les compétences numériques recherchées par les employeurs : design, intelligence artificielle, contenu et automatisation. | Canva | Intelligence artificielle | Création de contenu | Montage vidéo | Community management et marketing digital | Outils no-code et automatisation | Voir les formations du parcours | Parcours | Business & revenus en ligne | Créer une activité et des revenus grâce au numérique : trouver des clients, vendre en ligne et lancer son business. | Freelancing | Produits digitaux | E-commerce et vente en ligne | Affiliation | YouTube | Acquisition de clients | Voir les formations du parcours

**Comment ça marche** : Comment ça marche | Quatre étapes, de l’inscription au certificat | 01 | Créez votre compte gratuit | Accédez tout de suite aux formations gratuites et au catalogue complet. | 02 | Choisissez votre formule | Basique, Standard ou Premium : 1, 2 ou tous les parcours. Paiement par Mobile Money. | 03 | Apprenez et pratiquez | Vidéos, quiz, exercices corrigés et sessions live, à votre rythme, sur téléphone ou ordinateur. | 04 | Obtenez vos certificats | Une formation validée, c’est un certificat en PDF avec un QR Code de vérification.

**Formations** : Formations | Pour bien commencer | Voir tout le catalogue | Académique | Gratuit | Zotero : gérer ses références | Collectez vos sources et générez citations et bibliographie sans erreur. | 4,8 (74) | 2 h 20 | Débutant | Digital | Gratuit | Canva, de débutant à expert | Créez affiches, présentations et visuels soignés, même sans base en design. | 4,9 (88) | 5 h 10 | Débutant | Académique | Populaire | Méthodologie du mémoire | De la problématique à la rédaction : la méthode pour avancer sans vous perdre. | 4,9 (143) | 7 h 45 | Intermédiaire | Business | Populaire | Lancer son activité de freelance | Offre, tarifs, premiers clients : les étapes pour démarrer une activité en ligne. | 4,8 (69) | 6 h 00 | Intermédiaire
(title : Zotero : gérer ses références | Canva, de débutant à expert | Méthodologie du mémoire | Lancer son activité de freelance)

**Formules** : Formules | Un abonnement mensuel, sans prélèvement automatique | Vous renouvelez quand vous voulez. Vos formations et vos certificats restent sur votre compte. | Basique | Pour se concentrer sur un objectif. | [PRIX] | FCFA / mois | 1 parcours au choix | Quiz, exercices et certificats | Communauté du parcours | Voir le détail | Standard | Recommandée | Pour combiner deux compétences. | [PRIX] | FCFA / mois | 2 parcours au choix | Sessions live et exercices corrigés | Plus de formations complémentaires | Voir le détail | Premium | Pour tout apprendre, avec un suivi renforcé. | [PRIX] | FCFA / mois | Tous les parcours | Accompagnement renforcé | Fonctionnalités Premium | Voir le détail

**Accompagnement** : Accompagnement | Vous n’apprenez jamais seul | Un formateur suit votre progression, corrige vos exercices et répond à vos questions. | Sessions live | Avec Google Meet ou Zoom, programmées dans votre tableau de bord. | Exercices corrigés | Vous déposez votre travail, le formateur valide ou vous guide. | Messagerie | Une question sur une leçon ? Écrivez directement à votre formateur. | Suivi de progression | Objectifs, séries d’apprentissage et rappels pour garder le rythme.

**Communauté** : Communauté | Une communauté par parcours | Posez vos questions, partagez vos réussites et entraidez-vous. Un espace général ouvert à tous, et un espace privé pour chaque parcours. | Voir la communauté | KD | Koffi D. | Espace Académique · il y a 2 h | J’ai enfin terminé ma revue de littérature grâce à la méthode du module 2. Merci à tous pour vos conseils ! | 24 | 8

**Témoignages (masqué, Q11)** : Témoignages | Ils ont suivi Étudium | [Témoignage d’un étudiant ou d’une étudiante] | ? | [Prénom N.] | [Filière, université] | [Témoignage d’un jeune diplômé] | ? | [Prénom N.] | [Métier ou activité] | [Témoignage d’un étudiant devenu freelance] | ? | [Prénom N.] | [Activité en ligne]

**Chiffres (masqué, Q11)** : [NOMBRE] | étudiants inscrits | [NOMBRE] | formations disponibles | [NOMBRE] | certificats délivrés | [NOMBRE] | formateurs

**FAQ** : Questions fréquentes | Tout ce qu’il faut savoir avant de commencer | (7 questions et réponses : §14.3)

**Appel à l’action final** : Commencez gratuitement dès aujourd’hui | Créez votre compte en une minute, suivez les formations gratuites, puis choisissez votre formule quand vous êtes prêt. | Créer mon compte gratuit | Découvrir les formations

**Pied de page** : Étudium | Formation, compétences digitales et accompagnement pour les étudiants et les jeunes diplômés. | Plateforme | Formations | Parcours | Tarifs | Ressources | Questions fréquentes | Vérifier un certificat | Communauté | Légal | Conditions d’utilisation | Confidentialité | Contact | © 2026 Étudium. Tous droits réservés.

**Textes proposés, absents de la maquette (à valider)** : Prix annoncés au lancement (Q10, texte de la spec)
