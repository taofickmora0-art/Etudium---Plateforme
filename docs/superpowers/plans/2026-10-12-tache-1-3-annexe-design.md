# Fiche de construction — Catalogue & fiche formation (public + connecté + mobile)

Source : `NdCataloguePublic.dc.html` (aperçu 1440×1827), `NdCatalogue.dc.html` (1440×1448), `NdMobCatalogue.dc.html` (390×844), `NdFormationPublic.dc.html` (1440×3038), `NdFormation.dc.html` (1440×1620). `NdLanding.dc.html` : footer et bande CTA finale **strictement identiques** (octet pour octet) à ceux de NdFormationPublic ; header Landing identique sauf « Formations » sans `aria-current` (fond transparent).
Valeurs copiées des styles inline. Aucune règle `@media` dans ces fichiers : tout le responsive passe par `flex-wrap` + `flex-basis`, `clamp()` et les grilles `auto-fill`.
Apostrophes typographiques `’` partout dans le texte (d’Excel, l’aperçu, L’intelligence, aujourd’hui, d’utilisation…).

---

## 0. Abréviations (valeurs exactes, réutilisées plus bas)

- `FOCUS` = style-focus-visible `outline: 2px solid #0B18C9; outline-offset: 2px`
- `FOCUS-W` = style-focus-visible `outline: 2px solid #FFFFFF; outline-offset: 2px` (sur fond bleu)
- `FONT` = `font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif` (Inter 400/500/600/700 via Google Fonts) ; `-webkit-font-smoothing: antialiased`
- CSS global (helmet) : `body{margin:0}` `a{color:#0B18C9}` `a:hover{color:#08149F}` `::placeholder{color:#757F94}`
- `BTN-PRIMARY` = inline-flex; align-items center; justify-content center; gap 8px; box-sizing border-box; height 48px; padding 0 18px; border-radius 14px; font-size 16px; background #0B18C9; color #FFFFFF; border 0; font-family inherit; font-weight 500; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #08149F` — FOCUS
- `BTN-SECONDARY` = inline-flex; center/center; gap 8px; box-sizing border-box; height 42px; padding 0 15px; border-radius 12px; font-size 14px; background #FFFFFF; color #232326; border 1px solid #E3E8F3; font-family inherit; font-weight 500; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #F2F6FD` — FOCUS
- `BTN-SECONDARY-SM` = idem BTN-SECONDARY mais height 34px; padding 0 12px; border-radius 10px; font-size 13px
- `BTN-OUTLINE-W` (sur bleu) = inline-flex; center/center; gap 8px; box-sizing border-box; padding 0 16px (ou 22px); border-radius 14px; border 1px solid rgba(255, 255, 255, 0.45); background transparent; color #FFFFFF; font-weight 600; line-height 1; white-space nowrap; text-decoration none — hover `background: rgba(255, 255, 255, 0.14)` — FOCUS-W
- `BADGE` = display inline-flex; align-items center; gap 5px; padding 3px 8px 4px; border-radius 4px; font-size 12px; line-height 17px; font-weight 500; white-space nowrap; + couleurs :
  - Académique / Réussite académique / Nouveau / Complémentaire / En cours / Vous êtes ici : bg #DDE1FF, color #0B18C9
  - Digital : bg #EDE9FE, color #6D28D9
  - Business : bg #FFEDD9, color #C2410C
  - Gratuit / Terminé : bg #DDF3E4, color #17663A
  - Populaire / À corriger : bg #FBEFD0, color #8A5A00
  - Neutre (compétences connectées, Verrouillé) : bg #E5EBF7, color #4A546B
- `CHIP-FILTRE` (bouton bascule) = height 42px; padding 0 15px 1px; border-radius 12px; font-family inherit; font-size 14px; font-weight 500; letter-spacing -0.1px; cursor pointer; white-space nowrap; border 1px solid {bd}; background {bg}; color {fg} — FOCUS — `aria-pressed`
  - actif : bg #EEF0FF, bd #C2C8FF, fg #0B18C9 ; inactif : bg #FFFFFF, bd #E3E8F3, fg #232326 (pas de style-hover)
- `CHAMP` (input/select) = box-sizing border-box; width 100%; height 48px; padding 0 14px; border 1px solid #D2D9E8; border-radius 12px; background #FFFFFF; font-family inherit; font-size 15px; color #232326; outline none — style-focus `border-color: #0B18C9; box-shadow: 0 0 0 3px rgba(11, 24, 201, 0.14)`
- `LABEL` = font-size 14px; line-height 20px; font-weight 500; color #1D1D1F
- `DOT` (séparateur méta) = span aria-hidden; width 3px; height 3px; border-radius 50%; background #667085
- `PROGRESS` = div role="progressbar" aria-valuenow/min 0/max 100 ; piste border-radius 999px; background #D6DDEC; overflow hidden ; remplissage div width N%; height 100%; border-radius 999px; background #0B18C9
- `MOTIF-POINTS` = background-image: radial-gradient(rgba(255, 255, 255, 0.13) 1.2px, transparent 1.2px); background-size: 22px 22px
- `AVATAR(n)` = flex none; display flex; center/center; width n; height n; border-radius 999px; initiales font-weight 600

---

## 1. Cadre des pages publiques (visiteur) — identique CataloguePublic / FormationPublic / Landing

- Racine div : min-height 100vh; box-sizing border-box; padding 0 20px 20px; display flex; flex-direction column; background #F2F6FD; FONT; color #232326
  - header : display flex; flex-wrap wrap; align-items center; justify-content space-between; gap 12px; padding 20px 4px 20px 0
    - div gauche : display flex; flex-wrap wrap; align-items center; gap 12px
      - a logo href accueil (NdLanding) aria-label="Étudium, accueil" : display flex; align-items center; gap 10px; height 49px; padding 0 16px 0 9px; border-radius 14px; background #E9EFFB; font-size 17px; font-weight 700; letter-spacing -0.02em; color #0B18C9; text-decoration none — FOCUS
        - svg logo 30×30 (voir §7 LOGO) + span « Étudium »
      - a nav (×5) : display flex; align-items center; height 49px; padding 0 14px; border-radius 14px; background transparent; font-size 16px; font-weight 500; color #232326; text-decoration none — hover `background: #E9EFFB` — FOCUS
        - « Parcours » → NdLanding#parcours
        - « Formations » → NdCataloguePublic — **actif** : `aria-current="page"` + background #E9EFFB (actif sur CataloguePublic ET FormationPublic)
        - « Tarifs » → NdTarifs
        - « Communauté » → NdLanding#communaute
        - « Vérifier un certificat » → NdVerification
    - div droite : display flex; flex-wrap wrap; align-items center; gap 12px
      - a « Se connecter » → NdConnexion : display flex; align-items center; height 49px; border 0; border-radius 14px; background #E9EFFB; font-family inherit; font-size 16px; font-weight 500; color #232326; text-decoration none; cursor pointer; white-space nowrap; gap 8px; padding 0 16px — hover `background: #DEE6F6` — FOCUS (texte dans un span)
      - a « Créer un compte gratuit » → NdInscription : BTN-PRIMARY avec height surchargée à 49px (texte dans un span)
  - div conteneur principal : flex 1; display flex; flex-direction column; gap 20px; padding 20px; border-radius 32px; background #E9EFFB
    - …sections de la page… puis **le footer est le dernier enfant de ce conteneur** (dans le bloc #E9EFFB, séparé par le gap 20px)
    - footer : box-sizing border-box; display flex; flex-wrap wrap; gap 32px 48px; padding clamp(28px, 4.5vw, 56px); border-radius 28px; background-color #060F75; MOTIF-POINTS; color #C2C8FF
      - div marque : flex 1 1 280px; display flex; flex-direction column; gap 14px; max-width 360px
        - span : display flex; align-items center; gap 10px; font-size 22px; font-weight 700; letter-spacing -0.02em; color #FFFFFF → svg LOGO-BLANC 30×30 + « Étudium »
        - span : font-size 15px; line-height 24px → « Formation, compétences digitales et accompagnement pour les étudiants et les jeunes diplômés. »
      - div colonne (×3) : flex 0 1 180px; display flex; flex-direction column; gap 4px
        - span titre : margin-bottom 8px; font-size 13px; font-weight 600; letter-spacing 0.04em; text-transform uppercase; color #9DA6FF
        - a lien : display flex; align-items center; min-height 34px; font-size 15px; font-weight 500; color #FFFFFF; text-decoration none — hover `text-decoration: underline` (pas de focus-visible déclaré)
        - « Plateforme » : Formations → NdCataloguePublic ; Parcours → NdLanding ; Tarifs → NdTarifs
        - « Ressources » : Questions fréquentes → NdTarifs ; Vérifier un certificat → NdVerification ; Communauté → NdCommunaute
        - « Légal » : Conditions d’utilisation → # ; Confidentialité → # ; Contact → #
      - div copyright : flex 1 1 100%; padding-top 20px; border-top 1px solid rgba(255, 255, 255, 0.16); font-size 13px; line-height 20px → « © 2026 Étudium. Tous droits réservés. »

---

## 2. NdCataloguePublic (contenu du conteneur #E9EFFB)

Note : pas de h1 sur la page ; le titre du hero est un h2, les titres de cartes sont des h2.

### 2.1 Hero bleu
- section : box-sizing border-box; padding clamp(28px, 4.5vw, 56px); border-radius 28px; background-color #0B18C9; MOTIF-POINTS; color #FFFFFF
  - div : display flex; flex-wrap wrap; align-items center; justify-content space-between; gap 28px 48px
    - div texte : flex 1 1 420px; min-width 0
      - div : display flex; flex-direction column; gap 16px; max-width 800px
        - span badge : display inline-flex; align-items center; gap 8px; align-self flex-start; padding 6px 13px; border-radius 999px; background rgba(255, 255, 255, 0.14); color #FFFFFF; font-size 13px; line-height 18px; font-weight 600 → « Catalogue »
        - h2 : margin 0; font-size clamp(28px, 3.5vw, 44px); line-height 1.08; font-weight 500; letter-spacing -0.028em; color #FFFFFF; text-wrap balance → « Toutes les formations »
        - p : margin 0; max-width 640px; font-size 17px; line-height 27px; color #DDE1FF; text-wrap pretty → « Réussite académique, compétences digitales et business en ligne. Chaque fiche propose un aperçu gratuit. »
    - div illustration : flex none; padding 8px 12px
      - div aria-hidden : display flex; align-items center
        - 3 × span carré : display flex; center/center; width 84px; height 84px; border-radius 24px; background #FFFFFF; box-shadow 0 10px 28px rgba(4, 10, 80, 0.22)
          - 1er : margin-left 0px; transform rotate(-7deg) → svg PILE-BLEU 52×52
          - 2e : margin-left -13px; transform rotate(4deg) → svg PILE-VIOLET 52×52
          - 3e : margin-left -13px; transform rotate(-3deg) → svg PILE-ORANGE 52×52

### 2.2 Section blanche (filtres + résultats)
- section : box-sizing border-box; padding clamp(24px, 4vw, 40px); border-radius 28px; background #FFFFFF; flex 1
  - div filtres : display flex; flex-direction column; gap 16px; min-width 0
    - div ligne champs : display flex; flex-wrap wrap; align-items flex-end; gap 16px
      - div recherche : display flex; flex-direction column; gap 6px; min-width 0; flex 1 1 320px; max-width 560px
        - label for="f1" LABEL → « Rechercher »
        - span : position relative; display block
          - span icône : position absolute; left 14px; top 14px; color #667085; pointer-events none → LOUPE 20px
          - input id="f1" type="search" placeholder="Rechercher une formation…" : CHAMP + padding-left 44px
      - div niveau : display flex; flex-direction column; gap 6px; min-width 0; flex 0 1 220px
        - label for="s2" LABEL → « Niveau »
        - span : position relative; display block
          - select id="s2" : CHAMP + padding-right 40px; appearance none; cursor pointer
            - options : « Tous les niveaux » | « Débutant » | « Intermédiaire »
          - span chevron : position absolute; right 14px; top 15px; color #667085; pointer-events none → CHEVRON-BAS 18px
    - div ligne chips : display flex; flex-wrap wrap; align-items center; gap 14px
      - div role="group" aria-label="Filtrer par parcours" : display flex; flex-wrap wrap; gap 8px
        - CHIP-FILTRE × 4 : « Tous les parcours » (actif par défaut) | « Académique » | « Digital » | « Business »
      - span séparateur aria-hidden : width 1px; height 28px; background #DBE0EB
      - div role="group" aria-label="Filtrer par accès" : display flex; flex-wrap wrap; gap 8px
        - CHIP-FILTRE × 3 : « Tout » (actif par défaut) | « Gratuites » | « Incluses dans un abonnement »
  - div trait : height 1px; margin 28px 0 24px; background #EAEEF7
  - div résultats : display flex; flex-direction column; gap 16px; min-width 0
    - p compteur : margin 0; font-size 14px; line-height 22px; color #667085; text-wrap pretty → « 10 formations » (singulier « 1 formation »)
    - div grille : display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(250px, calc((100% - 60px) / 4))), 1fr)); gap 20px  (→ 4 colonnes max)
      - CARTE PUBLIQUE (§2.3) × n
  - rien d’autre après la grille : la section se termine, puis vient le footer (§1).

### 2.3 Carte formation — variante publique
- a href="NdFormationPublic" : color inherit; text-decoration none; box-sizing border-box; display flex; flex-direction column; padding 22px 19px 17px; border 1px solid #EAEEF7; border-radius 16px; background #FFFFFF; min-width 0 — hover `border-color: #D2D9E8` — FOCUS
  - div haut : display flex; align-items flex-start; justify-content space-between; gap 8px
    - svg PILE-{couleur du parcours} 48×48 : display block; flex-shrink 0; margin-left 4px
    - span groupe badges (à droite) : display flex; flex-wrap wrap; justify-content flex-end; gap 6px
      - BADGE parcours (toujours, en premier) : Académique | Digital | Business
      - BADGE statut (optionnel, en second) : Gratuit | Populaire | Nouveau | Complémentaire
  - h2 title="{titre complet}" : margin 21px 0 0; font-size 16px; line-height 24px; font-weight 600; color #1D1D1F; white-space nowrap; overflow hidden; text-overflow ellipsis
  - p description : margin 11px 0 0; font-size 12px; line-height 20px; height 40px; overflow hidden; color #667085 (2 lignes max, coupées)
  - div trait : height 1px; margin-top 16px; background #EAEEF7
  - div méta : display flex; flex-wrap wrap; align-items center; gap 7px; font-size 12px; line-height 18px; color #667085; margin-top 12px
    - span : display flex; align-items center; gap 4px → ÉTOILE 16px (margin 0 -1px) + span « 4,8 (126) »
    - DOT
    - span : display flex; align-items center; gap 4px → HORLOGE 18px (margin 0 -1.5px) + span « 6 h 20 »
    - DOT
    - span niveau « Intermédiaire »

### 2.4 Données (ordre d’affichage, filtre Tous/Tout)
| # | Parcours (pile) | Badge | Titre | Description | Note | Durée | Niveau | Accès |
|---|---|---|---|---|---|---|---|---|
| 1 | Académique (bleu) | — | Maîtriser Microsoft Excel | Formules, tableaux croisés dynamiques et graphiques pour analyser vos données. | 4,8 (126) | 6 h 20 | Intermédiaire | abonnement |
| 2 | Académique | — | Microsoft Word pour vos travaux universitaires | Styles, sommaire automatique et mise en page du mémoire, étape par étape. | 4,7 (98) | 4 h 10 | Débutant | abonnement |
| 3 | Académique | Gratuit | Zotero : gérer ses références | Collectez vos sources et générez citations et bibliographie sans erreur. | 4,8 (74) | 2 h 20 | Débutant | gratuit |
| 4 | Académique | — | PowerPoint : réussir sa soutenance | Structurez vos diapositives et présentez avec assurance le jour de la soutenance. | 4,7 (61) | 3 h 15 | Débutant | abonnement |
| 5 | Académique | Populaire | Méthodologie du mémoire | De la problématique à la rédaction : la méthode pour avancer sans vous perdre. | 4,9 (143) | 7 h 45 | Intermédiaire | abonnement |
| 6 | Digital (violet) | Gratuit | Canva, de débutant à expert | Créez affiches, présentations et visuels soignés, même sans base en design. | 4,9 (88) | 5 h 10 | Débutant | gratuit |
| 7 | Digital | Nouveau | L’intelligence artificielle au service de vos études | Utilisez l’IA pour réviser, résumer et rédiger, en gardant un regard critique. | 4,8 (37) | 3 h 30 | Débutant | abonnement |
| 8 | Digital | — | Montage vidéo sur smartphone | Tournez, montez et exportez des vidéos propres avec votre seul téléphone. | 4,6 (52) | 4 h 50 | Intermédiaire | abonnement |
| 9 | Business (orange) | Complémentaire | Marketing digital pour débutants | Les bases pour trouver vos premiers clients en ligne : réseaux, contenu, publicité. | 4,7 (104) | 8 h 30 | Débutant | abonnement |
| 10 | Business | Populaire | Lancer son activité de freelance | Offre, tarifs, premiers clients : les étapes pour démarrer une activité en ligne. | 4,8 (69) | 6 h 00 | Intermédiaire | abonnement |

Compteurs maquettés (parcours × accès) : Tous 10/2/8 ; Académique 5/1/4 ; Digital 3/1/2 ; Business 2/**vide**/2.

### 2.5 État vide (Business + Gratuites) — remplace le bloc résultats
- div : display flex; flex-direction column; align-items center; gap 6px; padding 48px 24px; text-align center
  - span tuile : flex none; display flex; center/center; width 56px; height 56px; border-radius 16px; background #E9EFFB; color #232326 → LOUPE 26px
  - span : margin-top 10px; font-size 18px; line-height 26px; font-weight 600; color #1D1D1F → « Aucune formation ne correspond »
  - span : max-width 420px; font-size 14px; line-height 22px; color #667085; text-wrap pretty → « Essayez un autre mot-clé ou retirez un filtre. »
  - div : margin-top 14px; display flex; flex-wrap wrap; justify-content center; gap 8px
    - button type="button" BTN-SECONDARY → span « Effacer les filtres » (remet parcours = tous, accès = tout)
- (pas de compteur affiché dans l’état vide)

---

## 3. NdCatalogue (connecté — contenu du `main` uniquement)

Contexte : `main` du shell = flex 999 1 560px; min-width 0; box-sizing border-box; margin 15px 20px 20px 0; padding 32px; border-radius 28px; background #FFFFFF. Lien de nav actif « Toutes les formations ».

- div en-tête : display flex; flex-wrap wrap; align-items flex-end; justify-content space-between; gap 16px
  - div : min-width 0; flex 1 1 320px
    - h1 : margin 0; font-size 32px; line-height 40px; font-weight 500; letter-spacing -0.01em; color #262628; text-wrap balance → « Toutes les formations »
    - p : margin 10px 0 0; font-size 16px; line-height 24px; color #232326; text-wrap pretty → « Réussite académique, compétences digitales et business en ligne. Chaque fiche propose un aperçu gratuit. »
- div : margin-top 21px
  - div : display flex; flex-direction column; gap 14px; min-width 0
    - div barre d’outils : display flex; flex-wrap wrap; align-items center; gap 12px
      - div : display flex; flex-direction column; gap 6px; min-width 0; flex 1 1 280px (pas de label visible)
        - span position relative; display block
          - span icône : position absolute; left 14px; top 14px; color #667085; pointer-events none → LOUPE 20px
          - input id="f1g" type="search" aria-label="Rechercher une formation" placeholder="Rechercher une formation…" : CHAMP + padding-left 44px
      - div : position relative; display inline-flex
        - button type="button" (ouvre menu tri) : BTN-SECONDARY avec height surchargée à 48px
          - TRI 18px + span « Trier : parcours » + CHEVRON-BAS 18px
        - [si menu ouvert] button aria-label="Fermer" (voile) : position fixed; inset 0; z-index 40; width 100%; height 100%; padding 0; border 0; background transparent; cursor default
        - [si menu ouvert] div : position absolute; z-index 41; top 54px; right 0
          - div role="menu" aria-label="Trier les formations" : box-sizing border-box; width 230px; max-width calc(100vw - 32px); padding 8px; border 1px solid #EAEEF7; border-radius 18px; background #FFFFFF; box-shadow 0 16px 40px rgba(20, 20, 30, 0.14), 0 2px 6px rgba(20, 20, 30, 0.06)
            - div titre : padding 8px 12px 4px; font-size 12px; line-height 18px; font-weight 500; letter-spacing 0.04em; text-transform uppercase; color #667085 → « Trier par »
            - button role="menuitem" (×4) : box-sizing border-box; display flex; align-items center; gap 12px; width 100%; min-height 44px; padding 6px 12px; border 0; border-radius 10px; background transparent; text-align left; font-family inherit; color #232326; cursor pointer — hover `background: #E9EFFB` — FOCUS
              - span : flex 1; min-width 0; display flex; flex-direction column → span font-size 15px; line-height 22px; font-weight 500
              - item coché : background #E9EFFB + COCHE 18px à droite (après le span)
              - items : « Parcours » (coché) | « Les plus récentes » | « Note des étudiants » | « Durée » ; clic = ferme le menu
    - div ligne chips : display flex; flex-wrap wrap; align-items center; justify-content space-between; gap 8px 16px
      - div role="group" aria-label="Filtrer par parcours" : display flex; flex-wrap wrap; gap 8px
        - CHIP-FILTRE × 5 : « Toutes » (actif défaut) | « Académique » | « Digital » | « Business » | « Gratuites »
      - span compteur (à droite) : font-size 14px; line-height 22px; color #667085 → « 10 formations » (Académique 5, Digital 3, Business 2, Gratuites 2)
- div trait : height 1px; margin-top 20px; background #DBE0EB
- div : margin-top 32px
  - div grille : display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(232px, calc((100% - 40px) / 3))), 1fr)); gap 20px  (→ 3 colonnes max)
    - CARTE CONNECTÉE × n, href="NdFormation"

### Carte connectée — différences vs publique
- Identique (paddings, tailles, h2, description, trait, méta) SAUF :
  - pas de badge parcours ; le parcours n’est signalé que par la couleur de la pile 48px
  - un seul BADGE statut optionnel, posé directement dans la ligne haute (pas de span groupe) : à droite via justify-content space-between
  - lien vers NdFormation (fiche connectée)
- Filtre « Gratuites » = cartes Zotero + Canva. Pas d’état vide maquetté côté connecté. Pas de filtre niveau ni de label « Rechercher ».

---

## 4. NdMobCatalogue (zone de contenu, hors shell mobile)

- Titre de l’en-tête mobile (à côté du logo 48×49) : span font-size 18px; line-height 26px; font-weight 600; color #1D1D1F; overflow hidden; text-overflow ellipsis; white-space nowrap → « Formations » (onglet bas actif « Formations »)
- Zone scroll : div flex 1; min-height 0; overflow-y auto; padding 20px 16px 20px (dans le panneau blanc radius 28px 28px 0 0, margin 0 8px)
  - div : display flex; flex-direction column; gap 10px; min-width 0
    - recherche : div column gap 6px > span relative > icône (left 14px; top 14px; #667085) LOUPE 20px + input id="f8n" type="search" aria-label="Rechercher une formation" placeholder="Rechercher une formation…" CHAMP + padding-left 44px (pas de label visible)
    - div role="group" aria-label="Filtrer le catalogue" : display flex; gap 8px; flex-wrap nowrap; overflow-x auto; margin 0 -16px; padding 0 16px; scrollbar-width none (rangée défilante horizontale bord à bord)
      - CHIP-FILTRE avec flex none et **height 44px** (au lieu de 42) × 5 : « Toutes » | « Académique » | « Digital » | « Business » | « Gratuites »
    - div liste : display flex; flex-direction column; gap 10px; min-width 0 (une colonne)
      - CARTE CONNECTÉE identique au desktop (padding 22px 19px 17px, etc.), href NdFormation
- Absents sur mobile : H1/sous-titre, bouton Trier, compteur, trait séparateur.

---

## 5. NdFormationPublic (contenu du conteneur #E9EFFB, de haut en bas)

### 5.1 Hero bleu
- section : box-sizing border-box; padding clamp(24px, 4vw, 52px); border-radius 28px; background-color #0B18C9; MOTIF-POINTS; color #FFFFFF
  - nav aria-label="Fil d’Ariane" : display flex; flex-wrap wrap; align-items center; gap 8px; font-size 14px; line-height 22px; color #C2C8FF
    - a « Formations » → NdCataloguePublic : color #FFFFFF; text-decoration none — hover underline
    - CHEVRON-DROITE 16px (couleur héritée #C2C8FF)
    - a « Réussite académique » → NdCataloguePublic (même style)
    - CHEVRON-DROITE 16px
    - span aria-current="page" « Maîtriser Microsoft Excel » (couleur #C2C8FF héritée)
  - div : margin-top 28px
    - div 2 colonnes : display flex; flex-wrap wrap; align-items center; gap 56px
      - div gauche : flex 999 1 420px; min-width 0
        - div : display flex; flex-direction column; gap 20px; padding-bottom 8px
          - div chips : display flex; flex-wrap wrap; align-items center; gap 8px → BADGE « Réussite académique » (#DDE1FF/#0B18C9) + BADGE « Populaire » (#FBEFD0/#8A5A00)
          - h1 : margin 0; font-size clamp(34px, 4.4vw, 58px); line-height 1.06; font-weight 500; letter-spacing -0.03em; color #FFFFFF; text-wrap balance → « Maîtriser Microsoft Excel »
          - p : margin 0; max-width 680px; font-size 17px; line-height 28px; color #DDE1FF; text-wrap pretty → « Des formules aux tableaux croisés dynamiques, apprenez à analyser vos données de mémoire et à présenter des résultats clairs. Chaque module se termine par un exercice corrigé. »
          - div méta : display flex; flex-wrap wrap; align-items center; gap 10px 22px; font-size 15px; line-height 22px; color #FFFFFF
            - span inline-flex; align-items center; gap 8px (×4), icônes 18px color #C2C8FF :
              - ÉTOILE « 4,8 (126 avis) » | HORLOGE « 6 h 20 » | PLAY-CERCLE « 24 leçons · 4 quiz · 3 exercices » | GRAPHE-HAUSSE « Intermédiaire »
          - div formatrice + CTA : display flex; flex-wrap wrap; align-items center; justify-content space-between; gap 16px 24px; margin-top 10px; padding-top 24px; border-top 1px solid rgba(255, 255, 255, 0.2)
            - div : display flex; align-items center; gap 12px
              - AVATAR(48px) background #DDE1FF; font-size 17px; color #0B18C9 → « MA »
              - span : display flex; flex-direction column; min-width 0
                - span : font-size 15px; line-height 22px; font-weight 600; color #FFFFFF → « Dr Mireille Adjovi »
                - span : font-size 13px; line-height 20px; color #C2C8FF → « Enseignante en statistiques appliquées »
            - a → NdLecon : BTN-OUTLINE-W height 44px; padding 0 16px; font-size 14px; font-family inherit → PLAY-CERCLE 18px + span « Voir l’aperçu gratuit »
      - div droite : flex 1 1 360px; min-width 0
        - div carte offre : box-sizing border-box; display flex; flex-direction column; padding 26px; background #FFFFFF; min-width 0; border 0; border-radius 24px; box-shadow 0 22px 56px rgba(4, 10, 80, 0.3)
          - span : font-size 12px; line-height 18px; color #667085 → « Incluse dans le parcours »
          - h3 : margin 0; font-size 18px; line-height 26px; font-weight 600; color #1D1D1F → « Réussite académique »
          - p : margin 0; margin-top 4px; font-size 14px; line-height 22px; color #667085; text-wrap pretty → « Avec les formules Basique, Standard et Premium. »
          - a → NdInscription : BTN-PRIMARY + width 100%; margin-top 18px → span « Créer mon compte gratuit »
          - div trait : height 1px; margin 16px 0; background #EAEEF7
          - p : margin 0; font-size 13px; line-height 20px; color #667085; text-wrap pretty → « Disponible aussi seule, en formation complémentaire : [PRIX] FCFA, payée une fois. »
          - a → NdTarifs : color #0B18C9; font-size 14px; line-height 22px; font-weight 500; text-decoration none; margin-top 8px; align-self flex-start — hover underline → « Voir les formules »
          - div trait (idem)
          - h3 : margin 0 0 12px; font-size 15px; line-height 22px; font-weight 600; color #1D1D1F → « Inclus dans la formation »
          - ul : margin 0; padding 0; list-style none; display grid; grid-template-columns minmax(0, 1fr); gap 10px 24px
            - li : display flex; align-items flex-start; gap 10px; font-size 14px; line-height 22px; color #232326 → COCHE 18px (margin-top 2px; color #0B18C9) + span
              - « 24 leçons vidéo » | « Ressources et fichiers d’exercice » | « 4 quiz, tentatives illimitées » | « 3 exercices corrigés par la formatrice » | « Espace communauté du parcours » | « Certificat vérifiable par QR Code »

### 5.2 « Ce que vous allez apprendre » + « Compétences acquises »
- section : box-sizing border-box; padding clamp(24px, 4vw, 48px); border-radius 28px; background #FFFFFF
  - div : display flex; flex-wrap wrap; align-items center; gap 56px
    - div : flex 999 1 420px; min-width 0
      - div : display flex; flex-direction column; gap 16px; max-width 800px
        - h2 `H2-SECTION` : margin 0; font-size clamp(28px, 3.5vw, 44px); line-height 1.08; font-weight 500; letter-spacing -0.028em; color #262628; text-wrap balance → « Ce que vous allez apprendre »
      - ul : margin 0; margin-top 24px; padding 0; list-style none; display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap 14px 24px
        - li : display flex; align-items flex-start; gap 10px; font-size 15px; line-height 22px; color #232326 → COCHE 18px (margin-top 2px; color #0B18C9) + span
          - « Construire des formules fiables et lisibles » | « Nettoyer et organiser des données d’enquête » | « Créer des tableaux croisés dynamiques » | « Réaliser des graphiques pour votre mémoire » | « Automatiser les tâches répétitives » | « Présenter des résultats clairs à un jury »
    - div : flex 1 1 360px; min-width 0
      - div encadré : padding 24px; border-radius 24px; background #EEF0FF
        - h3 : margin 0; font-size 18px; line-height 26px; font-weight 600; color #1D1D1F → « Compétences acquises »
        - div : display flex; flex-wrap wrap; align-items center; gap 8px; margin-top 16px
          - span pilule : display inline-flex; align-items center; height 36px; padding 0 14px; border-radius 999px; background #FFFFFF; font-size 14px; font-weight 500; color #0B18C9
            - « Formules » | « Analyse de données » | « Tableaux croisés » | « Graphiques » | « Automatisation »

### 5.3 « Programme » + colonne droite
- section : box-sizing border-box; padding clamp(24px, 4vw, 48px); border-radius 28px; background #FFFFFF
  - div : display flex; flex-wrap wrap; align-items flex-start; gap 56px
    - div gauche : flex 999 1 420px; min-width 0
      - div : display flex; flex-wrap wrap; align-items flex-end; justify-content space-between; gap 8px 16px; margin-bottom 20px
        - div (column gap 16px max-width 800px) > h2 H2-SECTION « Programme »
        - p : margin 0; font-size 14px; line-height 22px; color #667085 → « 4 modules · 24 leçons · 6 h 20 »
      - div accordéon : border-top 1px solid #EAEEF7
        - div module : border-bottom 1px solid #EAEEF7
          - button type="button" aria-expanded : display flex; align-items center; justify-content space-between; gap 16px; width 100%; min-height 56px; padding 8px 0; border 0; background transparent; text-align left; font-family inherit; font-size 16px; line-height 24px; font-weight 500; color #1D1D1F; cursor pointer — FOCUS
            - span : texte titre + span méta (display block; font-size 13px; line-height 20px; font-weight 400; color #667085)
            - span chevron : flex none; display flex; transform rotate(180deg) si ouvert / rotate(0deg) sinon → CHEVRON-BAS 20px
          - [si ouvert] p panneau : margin 0; padding 0 40px 18px 0; font-size 14px; line-height 22px; color #667085; text-wrap pretty
            - span ligne leçon : display flex; align-items center; gap 12px; min-height 44px; color #232326 ; **toutes sauf la 1re** : + border-top 1px solid #EAEEF7
              - icône 18px color #667085 : PLAY-CERCLE (leçon) | QUIZ (quiz) | EXERCICE (exercice)
              - span titre : flex 1; min-width 0
              - [optionnel] a « Aperçu » → NdLecon : font-weight 500; color #0B18C9; text-decoration none — hover underline
              - span durée : min-width 44px; text-align right; font-size 13px; color #667085
        - Données :
          - Module 1 (ouvert par défaut) « Module 1 : bases d’Excel » / « 6 leçons · 1 h 20 »
            - Découvrir l’interface — Aperçu — 06:10 | Saisir et mettre en forme des données — Aperçu — 12:30 | Les formules essentielles — 14:05 | Références relatives et absolues — 10:40 | Quiz du module 1 — « Quiz »
          - Module 2 « Module 2 : formules et fonctions » / « 6 leçons · 1 h 35 »
            - SI, ET, OU — 13:20 | RECHERCHEX — 15:00 | Fonctions de texte et de date — 11:45 | Exercice : nettoyer une enquête — « Exercice »
          - Module 3 « Module 3 : analyse de données » / « 7 leçons · 2 h 05 »
            - Trier et filtrer — 08:12 | Les tableaux croisés dynamiques — 12:40 | Les graphiques avancés — 10:05 | Quiz du module 3 — « Quiz » | Exercice pratique — « Exercice »
          - Module 4 « Module 4 : automatisation » / « 5 leçons · 1 h 20 »
            - Mise en forme conditionnelle — 09:30 | Introduction aux macros — 16:10 | Quiz final — « Quiz »
    - div droite : flex 1 1 360px; min-width 0
      - div : display flex; flex-direction column; gap 16px; min-width 0
        - div carte « Votre formatrice » : box-sizing border-box; display flex; flex-direction column; padding 22px; background #F2F6FD; border-radius 16px; min-width 0 (pas de bordure)
          - h3 : margin 0; font-size 16px; line-height 24px; font-weight 600; color #1D1D1F → « Votre formatrice »
          - div : display flex; align-items center; gap 12px; margin-top 16px
            - AVATAR(52px) background #DDE1FF; font-size 19px; color #0B18C9 → « MA »
            - span column min-width 0 : span font-size 15px; line-height 22px; font-weight 600; color #1D1D1F « Dr Mireille Adjovi » + span font-size 13px; line-height 20px; color #535E75 « Statistiques appliquées · Analyse de données »
          - p : margin 0; margin-top 14px; font-size 14px; line-height 22px; color #535E75; text-wrap pretty → « Elle accompagne depuis plusieurs années des étudiants de master dans l’analyse des données de leur mémoire. »
        - div carte « Aperçu gratuit » : box-sizing border-box; display flex; flex-direction column; padding 20px 22px 22px; border 1px solid #EAEEF7; background #FFFFFF; border-radius 16px; min-width 0
          - div : display flex; align-items center; gap 12px
            - span tuile : flex none; display flex; center/center; width 44px; height 44px; border-radius 13px; background #DDE1FF; color #0B18C9 → PLAY-CERCLE 20px
            - span column min-width 0 : span 15px/22px 600 #1D1D1F « Aperçu gratuit » + span 13px/20px #667085 « 2 leçons »
          - a → NdLecon : BTN-SECONDARY + width 100%; margin-top 16px → span « Voir l’aperçu gratuit »

### 5.4 « Avis des étudiants »
- section : box-sizing border-box; padding clamp(24px, 4vw, 48px); border-radius 28px; background #FFFFFF
  - div (column gap 16px max-width 800px) > h2 H2-SECTION « Avis des étudiants »
  - div : margin-top 28px
    - div : display flex; flex-wrap wrap; align-items flex-start; gap 56px
      - div synthèse : flex 1 1 300px; min-width 0
        - div : display flex; flex-direction column; gap 8px
          - div : display flex; align-items baseline; gap 10px; margin-bottom 6px
            - span : font-size 56px; line-height 60px; font-weight 500; letter-spacing -0.04em; color #0B18C9 → « 4,8 »
            - span : font-size 14px; line-height 22px; color #667085 → « 126 avis »
          - div ligne (×5) : display flex; align-items center; gap 10px; font-size 13px; line-height 20px; color #667085
            - span : width 10px; text-align center; color #232326 → « 5 » … « 1 »
            - PROGRESS aria-label="5 étoiles" … : height 8px; flex 1
            - span : width 36px; text-align right → « 82 % »
            - valeurs : 5 → 82 % ; 4 → 13 % ; 3 → 4 % ; 2 → 1 % ; 1 → 0 % (aria-label « N étoiles », y compris « 1 étoiles »)
      - div avis : flex 999 1 420px; min-width 0
        - div grille : display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(260px, calc((100% - 16px) / 2))), 1fr)); gap 16px
          - div carte avis : box-sizing border-box; display flex; flex-direction column; padding 22px; background #F2F6FD; border-radius 20px; min-width 0
            - div : display flex; align-items center; gap 12px → AVATAR(40px) font-size 14px + span 15px/22px 600 #1D1D1F
            - p : margin 0; margin-top 12px; font-size 15px; line-height 24px; color #232326; text-wrap pretty
            - données : « FA » (#DDE1FF/#0B18C9) « Fifamè A. » — « Les tableaux croisés m’ont fait gagner un temps fou pour l’analyse de mes questionnaires. » | « RH » (#EDE9FE/#6D28D9) « Rodrigue H. » — « Très clair. L’exercice corrigé du module 3 m’a permis de comprendre mes erreurs. »
        - p (sous la grille, dans la colonne avis) : margin 0; margin-top 14px; font-size 13px; line-height 20px; color #667085; text-wrap pretty → « Vous pourrez laisser un avis à partir de 50 % de progression. »

### 5.5 Bande CTA bleue finale (identique Landing)
- section : box-sizing border-box; padding clamp(28px, 5vw, 64px); border-radius 28px; background-color #0B18C9; MOTIF-POINTS; color #FFFFFF
  - div : display flex; flex-wrap wrap; align-items center; justify-content space-between; gap 32px 56px
    - div : flex 1 1 460px; min-width 0; display flex; flex-direction column; gap 28px
      - div : display flex; flex-direction column; gap 16px; max-width 800px
        - h2 : margin 0; font-size clamp(36px, 4.8vw, 62px); line-height 1.08; font-weight 500; letter-spacing -0.028em; color #FFFFFF; text-wrap balance → « Commencez gratuitement dès aujourd’hui »
        - p : margin 0; max-width 640px; font-size 17px; line-height 27px; color #DDE1FF; text-wrap pretty → « Créez votre compte en une minute, suivez les formations gratuites, puis choisissez votre formule quand vous êtes prêt. »
      - div : display flex; flex-wrap wrap; gap 12px
        - a → NdInscription : inline-flex; center/center; gap 8px; box-sizing border-box; height 52px; padding 0 22px; font-size 16px; border-radius 14px; border 0; background #FFFFFF; color #0B18C9; font-family inherit; font-weight 600; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #EEF0FF` — FOCUS-W → span « Créer mon compte gratuit » + FLÈCHE-DROITE 18px
        - a → NdCataloguePublic : BTN-OUTLINE-W height 52px; padding 0 22px; font-size 16px → span « Découvrir les formations »
    - div illustration : flex none; padding 12px 20px
      - div aria-hidden display flex; align-items center
        - 3 × span : display flex; center/center; width 104px; height 104px; border-radius 29px; background #FFFFFF; box-shadow 0 10px 28px rgba(4, 10, 80, 0.22)
          - margin-left 0px; rotate(-7deg) → PILE-BLEU 64×64 | margin-left -17px; rotate(4deg) → PILE-VIOLET 64×64 | margin-left -17px; rotate(-3deg) → PILE-ORANGE 64×64
- puis footer (§1).

### 5.6 Responsive
- Hero : gauche flex 999 1 420px / droite flex 1 1 360px, gap 56px → la carte offre passe sous le texte quand la largeur < ~836px ; titre/paddings en clamp().
- Apprendre, Programme : mêmes bases (999 1 420px / 1 1 360px, gap 56px). Avis : synthèse 1 1 300px / avis 999 1 420px.
- CTA : texte 1 1 460px, illustration flex none (passe dessous), gap 32px 56px.

---

## 6. NdFormation (connecté — contenu du `main`, padding 32px, fond blanc radius 28px)

### 6.1 En-tête
- div : margin-bottom 14px
  - nav aria-label="Fil d’Ariane" : display flex; flex-wrap wrap; align-items center; gap 6px; font-size 14px; line-height 20px
    - a « Toutes les formations » → NdCatalogue : color #667085; text-decoration none — hover `color: #232326`
    - CHEVRON-DROITE 14px color #667085
    - a « Réussite académique » → NdParcours (même style)
    - CHEVRON-DROITE 14px color #667085
    - span aria-current="page" : font-weight 500; color #1D1D1F → « Maîtriser Microsoft Excel »
- div : display flex; flex-wrap wrap; align-items flex-end; justify-content space-between; gap 16px
  - div : min-width 0; flex 1 1 320px
    - h1 : margin 0; font-size 32px; line-height 40px; font-weight 500; letter-spacing -0.01em; color #262628; text-wrap balance → « Maîtriser Microsoft Excel »
    - p : margin 10px 0 0; font-size 16px; line-height 24px; color #232326; text-wrap pretty → « Des formules aux tableaux croisés dynamiques, apprenez à analyser vos données de mémoire et à présenter des résultats clairs. Chaque module se termine par un exercice corrigé. »
- div : margin-top 21px
  - div : display flex; flex-wrap wrap; align-items center; gap 12px
    - BADGE « Académique » (#DDE1FF/#0B18C9)
    - div méta : display flex; flex-wrap wrap; align-items center; gap 7px; font-size 14px; line-height 22px; color #667085
      - span flex center gap 4px : ÉTOILE 18px (margin 0 -1px) + « 4,8 (126 avis) »
      - DOT · span flex center gap 4px : HORLOGE 18px (margin 0 -1.5px) + « 6 h 20 »
      - DOT · « Intermédiaire » · DOT · « 24 leçons · 4 quiz · 3 exercices » · DOT · « Dr Mireille Adjovi »
- div trait : height 1px; margin-top 20px; background #DBE0EB

### 6.2 Mise en page 2 colonnes
- div : margin-top 32px
  - div : display flex; flex-wrap wrap-reverse; align-items flex-end; gap 32px
    - (wrap-reverse : quand ça passe à la ligne, la colonne droite remonte AU-DESSUS ; avec wrap-reverse, `flex-end` aligne en haut)
    - div gauche : flex 999 1 420px; min-width 0
    - div droite : flex 1 1 300px; min-width 0

### 6.3 Colonne gauche : div display flex; flex-direction column; gap 36px; min-width 0
- Motif « en-tête de section » : div display flex; flex-wrap wrap; align-items baseline; justify-content space-between; gap 4px 16px ; h2 margin 0; font-size 20px; line-height 28px; font-weight 600; color #1D1D1F ; bloc section = div column gap 16px; min-width 0

#### a) Ce que vous allez apprendre
- en-tête : h2 « Ce que vous allez apprendre »
- div : display flex; flex-direction column; gap 18px; min-width 0
  - div grille : display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(240px, calc((100% - 12px) / 2))), 1fr)); gap 12px
    - div : display flex; align-items flex-start; gap 10px
      - span : flex none; display flex; margin-top 2px; color #17663A → COCHE 18px (trait simple, vert)
      - span : font-size 14px; line-height 22px; color #232326
      - mêmes 6 textes que §5.2
  - div compétences : display flex; flex-wrap wrap; align-items center; gap 8px
    - span : font-size 13px; line-height 20px; font-weight 500; color #667085 → « Compétences acquises »
    - BADGE neutre (#E5EBF7/#4A546B) × 5 : Formules | Analyse de données | Tableaux croisés | Graphiques | Automatisation

#### b) Programme
- en-tête : h2 « Programme » + span font-size 13px; line-height 20px; color #667085 → « 4 modules · 24 leçons · 6 h 20 »
- div accordéon : border-top 1px solid #EAEEF7 ; module = div border-bottom 1px solid #EAEEF7
  - button aria-expanded : mêmes styles que §5.3 (min-height 56px; padding 8px 0; 16px/24px 500 #1D1D1F; FOCUS)
    - span > span display inline-flex; flex-direction column; gap 2px
      - span : display inline-flex; flex-wrap wrap; align-items center; gap 4px 10px → span titre + BADGE statut
      - span : font-size 13px; line-height 20px; font-weight 400; color #667085 → méta
    - span chevron : flex none; display flex; transform rotate(180deg)/rotate(0deg) → CHEVRON-BAS 20px
  - [si ouvert] p : margin 0; padding 0 40px 18px 0; font-size 14px; line-height 22px; color #667085
    - span : display flex; flex-direction column
      - ligne leçon (a cliquable) : display flex; align-items center; gap 12px; min-height 44px; padding 0 4px; border-top 1px solid #EAEEF7 (**toutes les lignes, y compris la 1re**); text-decoration none — hover `background: #F2F6FD` — FOCUS
        - span icône : flex none; display flex; color #232326 → icône 20px
        - span titre : flex 1; min-width 0; font-size 14px; line-height 20px; font-weight 400; color #1D1D1F
        - [optionnel] BADGE
        - span durée : flex none; min-width 56px; text-align right; font-size 13px; line-height 20px; color #667085
      - États de ligne :
        - terminée : CHECK-CERCLE 20px color #17663A
        - en cours (« Vous êtes ici ») : PLAY-CERCLE 20px (#232326) ; titre font-weight 600 ; BADGE « Vous êtes ici » (#DDE1FF/#0B18C9) avant la durée ; pas de fond spécifique
        - à venir (leçon) : PLAY-CERCLE 20px (#232326), titre 400
        - quiz à venir : QUIZ 20px (#232326) → href NdQuiz
        - exercice : EXERCICE 20px (#232326) + BADGE « À corriger » (#FBEFD0/#8A5A00) → href NdExercice
        - verrouillée : **span** (non lien, pas de hover) même layout ; span icône color #667085 → CADENAS 20px ; titre color #667085
  - Badges module (dans la ligne titre) : « Terminé » (#DDF3E4/#17663A) | « En cours » (#DDE1FF/#0B18C9) | « Verrouillé » (#E5EBF7/#4A546B) précédé de CADENAS 13px (gap 5px)
  - Données :
    - Module 1 — Terminé — ouvert par défaut — « 6 leçons · 1 h 20 » : Découvrir l’interface 06:10 | Saisir et mettre en forme des données 12:30 | Les formules essentielles 14:05 | Références relatives et absolues 10:40 | Quiz du module 1 « Quiz » (NdQuiz) — toutes CHECK-CERCLE vert
    - Module 2 — Terminé — « 6 leçons · 1 h 35 » : SI, ET, OU 13:20 | RECHERCHEX 15:00 | Fonctions de texte et de date 11:45 | Exercice : nettoyer une enquête « Exercice » (NdExercice) — toutes CHECK-CERCLE vert
    - Module 3 — En cours — « 7 leçons · 2 h 05 » : Trier et filtrer 08:12 (terminée) | Les tableaux croisés dynamiques 12:40 (en cours) | Les graphiques avancés 10:05 (à venir) | Quiz du module 3 « Quiz » (quiz) | Exercice pratique « À corriger » « Exercice » (exercice)
    - Module 4 — Verrouillé — « 5 leçons · 1 h 20 » : Mise en forme conditionnelle 09:30 | Introduction aux macros 16:10 | Quiz final « Quiz » — toutes verrouillées

#### c) Avis des étudiants
- en-tête : h2 « Avis des étudiants » + button type="button" BTN-SECONDARY-SM → ÉTOILE 16px + span « Laisser un avis » (aucun handler)
- div : display flex; flex-wrap wrap; align-items flex-start; gap 20px 32px
  - div synthèse : flex 1 1 220px; min-width 0; display flex; flex-direction column; gap 14px
    - div : display flex; align-items center; gap 14px
      - span : font-size 32px; line-height 40px; font-weight 500; letter-spacing -0.01em; color #262628 → « 4,8 »
      - span column gap 2px :
        - span : display flex; gap 2px; color #8A5A00 → 5 × ÉTOILE-PLEINE 16px
        - span : font-size 13px; line-height 20px; font-weight 400; color #667085 → « 126 avis »
    - div barres : display flex; flex-direction column; gap 6px
      - div ligne : display flex; align-items center; gap 10px
        - span : flex none; width 10px; font-size 13px; line-height 20px; font-weight 500; color #232326 → « 5 »…« 1 »
        - PROGRESS height 6px; flex 1 (aria-label « 5 étoiles »…)
        - span : flex none; width 38px; text-align right; font-size 12px; line-height 18px; color #667085 → « 82 % »
      - valeurs identiques au public : 82 / 13 / 4 / 1 / 0 %
  - div avis : flex 2 1 300px; min-width 0; display flex; flex-direction column; gap 12px
    - div carte : box-sizing border-box; display flex; flex-direction column; padding 16px 18px 18px; border 1px solid #EAEEF7; background #FFFFFF; border-radius 16px; min-width 0
      - div : display flex; align-items center; gap 10px → AVATAR(36px) font-size 13px + span font-size 14px; line-height 22px; font-weight 600; color #1D1D1F
      - p : margin 0; margin-top 12px; font-size 14px; line-height 22px; color #232326; text-wrap pretty
      - « FA » (#DDE1FF/#0B18C9) « Fifamè A. » + même texte qu’en public | « RH » (**#FBEFD0/#8A5A00** — différent du public) « Rodrigue H. » + même texte
- (pas de phrase « 50 % de progression » ici)

### 6.4 Colonne droite
- div grille : display grid; grid-template-columns repeat(auto-fill, minmax(min(100%, max(216px, calc((100% - 32px) / 3))), 1fr)); gap 16px (1 colonne quand étroite ; 3 cartes côte à côte quand la colonne passe pleine largeur au-dessus)
- Style carte commun : box-sizing border-box; display flex; flex-direction column; padding 20px; border 1px solid #EAEEF7; background #FFFFFF; border-radius 16px; min-width 0
- Carte progression :
  - div : display flex; align-items flex-end; justify-content space-between; gap 12px
    - span : font-size 14px; line-height 22px; font-weight 500; color #667085 → « Votre progression »
    - span : flex none; font-size 28px; line-height 32px; font-weight 500; letter-spacing -0.01em; white-space nowrap; color #262628 → « 68 % »
  - PROGRESS aria-label="Progression de la formation" aria-valuenow="68" : height 8px; margin-top 12px; remplissage 68%
  - div : display flex; flex-wrap wrap; align-items center; gap 7px; font-size 12px; line-height 18px; color #667085; margin-top 8px → span flex center gap 4px : HORLOGE 18px + « 2 h restantes »
  - div : display flex; flex-direction column; gap 2px; margin-top 18px; padding-top 16px; border-top 1px solid #EAEEF7
    - span : font-size 12px; line-height 18px; font-weight 400; color #667085 → « Prochaine leçon »
    - span : font-size 15px; line-height 22px; font-weight 500; color #1D1D1F → « Les tableaux croisés dynamiques »
    - span : font-size 13px; line-height 20px; font-weight 400; color #667085 → « Module 3 · 12:40 »
  - a → NdLecon : BTN-PRIMARY + width 100%; margin-top 18px → span « Continuer » + FLÈCHE-DROITE 20px
  - div : display flex; margin-top 8px
    - button type="button" BTN-SECONDARY + width 100% : CŒUR 18px + span « Dans vos favoris » (état favori, défaut) / « Ajouter aux favoris » (état non favori) — même icône contour dans les deux états
  - p : margin 0; margin-top 14px; font-size 12px; line-height 18px; color #667085; text-wrap pretty; text-align center → « Incluse dans votre parcours Réussite académique. »
- Carte formatrice :
  - h3 : margin 0; font-size 16px; line-height 24px; font-weight 600; color #1D1D1F → « Votre formatrice »
  - div : display flex; align-items center; gap 12px; margin-top 14px
    - AVATAR(44px) background #DDE1FF; font-size 16px; color #0B18C9 → « MA »
    - span column min-width 0 : span 15px/22px **500** #1D1D1F « Dr Mireille Adjovi » + span 13px/20px 400 #667085 « Enseignante en statistiques appliquées »
  - p : margin 0; margin-top 12px; font-size 14px; line-height 22px; color #232326; text-wrap pretty → « Elle accompagne depuis plusieurs années des étudiants de master dans l’analyse des données de leur mémoire. »
  - div espaceur : flex 1
  - a → NdMessages : BTN-SECONDARY + width 100%; margin-top 16px → BULLE 18px + span « Écrire à la formatrice »
- Carte « Inclus dans la formation » :
  - h3 (même style) → « Inclus dans la formation »
  - div : display flex; flex-direction column; gap 12px; margin-top 14px
    - div : display flex; align-items flex-start; gap 10px → span flex none; display flex; margin-top 2px; color #232326 (icône 18px) + span font-size 14px; line-height 22px; color #232326
      - VIDÉO « 24 leçons vidéo » | FICHIER « Ressources et fichiers d’exercice » | QUIZ « 4 quiz, tentatives illimitées » | EXERCICE « 3 exercices corrigés par la formatrice » | GROUPE « Espace communauté du parcours » | CERTIFICAT « Certificat vérifiable par QR Code »

---

## 7. Icônes (toutes en trait 1.5px, `fill:none; stroke:currentColor; stroke-linecap/linejoin:round`, viewBox 24 sauf mention ; les tracés sont ceux du jeu Hugeicons stroke-rounded)

| Clé | Glyphe | Taille / couleur (où) | Hugeicons probable |
|---|---|---|---|
| LOGO | hexagone arrondi plein #0B18C9 (polygon `15,4 24.5,9.5 24.5,20.5 15,26 5.5,20.5 5.5,9.5`, stroke-width 5, linejoin round) + « É » centré (x15 y20, Inter 14px 700, #FFFFFF), viewBox 30 | 30px (header) | — (logo) |
| LOGO-BLANC | même hexagone #FFFFFF + « É » #0B18C9 | 30px (footer) | — |
| PILE-{BLEU/VIOLET/ORANGE} | 3 losanges empilés (calques), viewBox 48 ; chaque calque = polygone contour (stroke-width 12.4) puis remplissage (stroke-width 10), fill=stroke, linejoin round. Points : bas `7.7,35 24,30.2 40.3,35 24,39.8` ; milieu `10.6,22.5 24.2,18.2 37.8,22.5 24.2,26.8` ; haut `13.2,12.5 24,8.7 34.8,12.5 24,16.3`. Couleurs contour/fond — BLEU : bas #08149F/#0B18C9, milieu #060F75/#9DA6FF, haut #060F75/#EEF0FF ; VIOLET : #5B21B6/#7C3AED, #4C1D95/#C4B5FD, #4C1D95/#F5F3FF ; ORANGE : #C2410C/#F97316, #7C2D12/#FDBA74, #7C2D12/#FFF7ED | 48px cartes (margin-left 4px) ; 52px hero catalogue ; 64px bande CTA | — (illustration maison, Académique=bleu, Digital=violet, Business=orange) |
| LOUPE | loupe (cercle r8 + manche bas-droite) | 20px #667085 (champs) ; 26px #232326 (état vide) | Search01 |
| CHEVRON-BAS | chevron vers le bas | 18px #667085 (select), 18px #232326 (bouton Trier), 20px #1D1D1F (accordéons) | ArrowDown01 |
| CHEVRON-DROITE | chevron vers la droite | 16px #C2C8FF (fil d’Ariane public) ; 14px #667085 (fil d’Ariane connecté) | ArrowRight01 |
| ÉTOILE | étoile 5 branches contour | 16px #667085 (cartes) ; 18px #C2C8FF (hero public) ; 18px #667085 (méta connectée) ; 16px #232326 (« Laisser un avis ») | StarIcon / Star |
| ÉTOILE-PLEINE | étoile pleine (fill currentColor, viewBox 256) | 16px #8A5A00 ×5 | Star (version pleine / fill currentColor) |
| HORLOGE | horloge (cercle r10 + aiguilles 12→8, 2→14) | 18px #667085 (cartes, méta, « 2 h restantes ») ; 18px #C2C8FF (hero) | Clock01 |
| PLAY-CERCLE | triangle play arrondi dans un cercle r10 | 18px #C2C8FF (méta hero) ; 18px #FFFFFF (bouton aperçu hero) ; 18px #667085 (leçons public) ; 20px #0B18C9 (tuile aperçu) ; 20px #232326 (leçons connectées) | PlayCircle |
| GRAPHE-HAUSSE | axes en L + courbe montante terminée par une flèche | 18px #C2C8FF (niveau, hero public) | ChartIncrease / AnalyticsUp |
| COCHE | coche simple (`m5 14l3.5 3.5L19 6.5`) | 18px #0B18C9 (listes publiques) ; 18px #17663A (apprendre, connecté) ; 18px #232326 (item coché menu Trier) | Tick02 |
| CHECK-CERCLE | coche dans un cercle | 20px #17663A (leçon terminée) | CheckmarkCircle02 |
| CADENAS | cadenas arrondi avec trou de serrure | 20px #667085 (leçon verrouillée) ; 13px #4A546B (badge Verrouillé) | SquareLock02 |
| QUIZ | rosette/badge festonné avec point d’interrogation | 18px #667085 (public) ; 20px #232326 (connecté) ; 18px #232326 (Inclus) | badge « help » (famille CheckmarkBadge avec « ? ») |
| EXERCICE | crayon vertical à gauche + feuille à droite avec coche en bas | 18px #667085 (public) ; 20px #232326 (connecté) ; 18px #232326 (Inclus) | TaskEdit / TaskDone (feuille + crayon) |
| TRI | barres horizontales décroissantes + flèche verticale vers le bas à gauche | 18px #232326 | SortByDown |
| FLÈCHE-DROITE | flèche → (trait + pointe chevron) | 18px #0B18C9 (CTA blanc) ; 20px #FFFFFF (« Continuer ») | ArrowRight02 |
| CŒUR | cœur contour | 18px #232326 | FavouriteIcon |
| BULLE | bulle de discussion ronde avec 3 points | 18px #232326 | BubbleChat / Comment |
| VIDÉO | caméra (rectangle arrondi + objectif triangulaire + petit cercle) | 18px #232326 | Video01 |
| FICHIER | feuille à coin corné avec 2 lignes | 18px #232326 | File02 / Note |
| GROUPE | personne centrale + 2 demi-têtes latérales | 18px #232326 | UserGroup |
| CERTIFICAT | feuille avec lignes + médaille/rosette en bas à droite | 18px #232326 | Certificate01 |

---

## 8. Comportements interactifs visibles dans le balisage

- Commun (pages publiques) : liens header/footer, hovers (`style-hover`) et focus (`style-focus-visible`) ; aucune logique JS hormis ci-dessous.
- NdCataloguePublic :
  - état `g_par` ∈ {tous, aca, dig, bus} (défaut tous) — 4 boutons `aria-pressed`, clic = sélection exclusive
  - état `g_prix` ∈ {tout, gratuit, payant} (défaut tout) — 3 boutons `aria-pressed`
  - `sc-if` imbriqués (parcours × accès) : affichent compteur + grille filtrés, ou l’état vide (bus × gratuit)
  - « Effacer les filtres » → `resetFiltres` = g_par tous + g_prix tout
  - recherche (input) et select Niveau : présents mais sans logique dans la maquette
- NdCatalogue :
  - état `g_parcours` ∈ {toutes, aca, dig, bus, gratuites} (défaut toutes) — 5 boutons `aria-pressed` ; `sc-if` pour compteur et grille
  - menu tri : `open.tri` (bouton bascule, pas d’`aria-expanded` déclaré) ; voile plein écran transparent `aria-label="Fermer"` → `close` ; chaque item de menu → `close` ; pas de changement d’ordre maquetté
  - (shell : menus notifications / profil / dialogue de déconnexion — hors périmètre)
- NdMobCatalogue : état `g_parcours` (5 valeurs) avec `aria-pressed` ; rangée de chips défilable horizontalement ; liste filtrée par `sc-if`.
- NdFormationPublic :
  - accordéon : drapeaux `mod0` (ouvert par défaut), `mod1`, `mod2`, `mod3` ; bouton `aria-expanded="{{f.modN}}"`, clic = bascule ; chevron rotate(180deg) quand ouvert ; panneau via `sc-if`
  - liens « Aperçu » (2 leçons du module 1) et boutons « Voir l’aperçu gratuit » → NdLecon
- NdFormation :
  - accordéon : drapeaux `m1` (ouvert par défaut), `m2`, `m3`, `m4` ; idem `aria-expanded` + rotation ; le module verrouillé s’ouvre aussi (lignes non cliquables)
  - favori : drapeau `fav` (défaut true) ; deux `sc-if` (`f.fav` / `nf.fav`) affichent « Dans vos favoris » / « Ajouter aux favoris », clic = bascule `t.fav`
  - « Laisser un avis » : bouton sans action ; « Continuer » → NdLecon ; « Écrire à la formatrice » → NdMessages ; lignes leçons → NdLecon / NdQuiz / NdExercice ; lignes verrouillées non interactives
