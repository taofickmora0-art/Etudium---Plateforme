# Tâche 1.5 — Annexe design : page leçon (NdLecon, NdMobLecon)

> Valeurs relevées dans les maquettes du design de référence. Le plan (`2026-10-12-tache-1-5-interface-de-cours.md`) dit ce qui est retenu au lot 1 ; en cas de conflit, le plan et la spec l’emportent.


Source : `NdLecon.dc.html` (aperçu 1440×1555, planche « Leçon (lecteur vidéo) ») et `NdMobLecon.dc.html` (390×844, planche « Téléphone · leçon »).
Valeurs copiées des styles inline. Aucune règle `@media`, aucun `position: sticky` : le responsive passe uniquement par `flex-wrap` + `flex-basis` ; sur téléphone, la barre d’action reste visible parce qu’elle est **hors** de la zone qui défile (structure flex), pas par sticky.
Apostrophes typographiques `’` partout (d’Excel, d’exercice, d’un questionnaire, c’est) — aucune apostrophe droite dans le texte. Autres caractères : `·` (U+00B7) séparateur, `×` (U+00D7) dans « 1× », `…` (U+2026) dans les placeholders, `—` (U+2014) dans « meilleur score : — ». Espaces avant `:` et `?` = espaces normales, sauf **une** insécable (`&nbsp;`) avant « ? » dans la question de Rodrigue sur téléphone.

---

## 0. Abréviations

### 0.1 Reprises de la fiche Catalogue (extraction-13 §0) — valeurs identiques, rappelées pour que cette fiche se suffise
- `FOCUS` = style-focus-visible `outline: 2px solid #0B18C9; outline-offset: 2px`
- `FONT` = `font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif` (Inter 400/500/600/700) ; `-webkit-font-smoothing: antialiased` — CSS global : `body{margin:0}` `a{color:#0B18C9}` `a:hover{color:#08149F}` `::placeholder{color:#757F94}`
- `BTN-SECONDARY` = inline-flex; align-items center; justify-content center; gap 8px; box-sizing border-box; height 42px; padding 0 15px; border-radius 12px; font-size 14px; background #FFFFFF; color #232326; border 1px solid #E3E8F3; font-family inherit; font-weight 500; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #F2F6FD` — FOCUS
- `BTN-SECONDARY-SM` = idem BTN-SECONDARY mais height 34px; padding 0 12px; border-radius 10px; font-size 13px
- `BADGE` = display inline-flex; align-items center; gap 5px; padding 3px 8px 4px; border-radius 4px; font-size 12px; line-height 17px; font-weight 500; white-space nowrap ; couleurs utilisées ici :
  - « En cours » : bg #DDE1FF, color #0B18C9
  - « À corriger » : bg #FBEFD0, color #8A5A00
  - « Verrouillé » (neutre) : bg #E5EBF7, color #4A546B
  - **nouveau** « Formatrice » : bg #EDE9FE, color #6D28D9 (mêmes couleurs que « Digital »)
- `CHAMP` = box-sizing border-box; width 100%; height 48px; padding 0 14px; border 1px solid #D2D9E8; border-radius 12px; background #FFFFFF; font-family inherit; font-size 15px; color #232326; outline none — style-focus `border-color: #0B18C9; box-shadow: 0 0 0 3px rgba(11, 24, 201, 0.14)`
- `LABEL` = font-size 14px; line-height 20px; font-weight 500; color #1D1D1F
- `DOT` = span aria-hidden; width 3px; height 3px; border-radius 50%; background #667085 — variante `DOT-535` : background #535E75 (panneau Programme)
- `PROGRESS` = div role="progressbar" aria-valuenow/min 0/max 100 ; piste border-radius 999px; background #D6DDEC; overflow hidden ; remplissage div width N%; height 100%; border-radius 999px; background #0B18C9
- `AVATAR(n)` = flex none; display flex; align-items center; justify-content center; width n; height n; border-radius 999px; initiales font-weight 600

### 0.2 Nouvelles abréviations
- `BTN-PRIMARY-MD` = inline-flex; align-items center; justify-content center; gap 8px; box-sizing border-box; height 42px; padding 0 15px; border-radius 12px; font-size 14px; background #0B18C9; color #FFFFFF; border 0; font-family inherit; font-weight 500; line-height 1; white-space nowrap; text-decoration none; cursor pointer — hover `background: #08149F` — FOCUS (= BTN-PRIMARY au gabarit 42px)
- `BTN-TONAL` = idem BTN-PRIMARY-MD mais background #E9EFFB; color #232326 — hover `background: #DEE6F6` — FOCUS
- `BTN-ICON-GHOST` (téléphone) = flex none; display inline-flex; align-items center; justify-content center; **width 44px; height 44px** (le style déclare 42×42 puis surcharge à 44×44 : retenir 44); padding 0; border 0; border-radius 12px; background transparent; color #232326; cursor pointer; text-decoration none — hover `background: #E9EFFB` — FOCUS
- `TEXTAREA` = CHAMP + height auto; padding 12px 14px; line-height 22px; resize vertical (focus identique à CHAMP) ; hauteur donnée par `rows` (rows 3 ≈ 92px, rows 7 ≈ 180px : rows × 22 + 24 + 2)
- `SEG-TABS` (onglets segmentés) = div role="tablist" : display inline-flex; align-self flex-start; flex-wrap wrap; gap 4px; padding 4px; border-radius 14px; background #E9EFFB
- `SEG-TAB` = button type="button" role="tab" aria-selected : height 40px; padding 0 16px; border 0; border-radius 10px; font-family inherit; font-size 14px; font-weight 500; cursor pointer; white-space nowrap — FOCUS — **pas de hover**
  - actif : background #FFFFFF; box-shadow 0 1px 2px rgba(20, 20, 30, 0.08); color #0B18C9
  - inactif : background transparent; box-shadow none; color #232326
- `NAV-ITEM` (ligne du panneau gauche — même style que les liens de la barre latérale du shell) = display flex; align-items center; gap 10px; height 48px; padding 0 12px; border-radius 14px; font-size 16px; font-weight 500; color #232326; text-decoration none — hover `background: rgba(255, 255, 255, 0.55)` — FOCUS
  - `NAV-ITEM actif` (aria-current="page") : + background #FFFFFF; box-shadow 0 1px 2px rgba(20, 20, 30, 0.08); color #0B18C9 ; pas de hover
- `SURTITRE` = font-size 13.5px; letter-spacing 0.04em; text-transform uppercase; color #535E75 (poids 400, line-height normal), suivi d’un trait `span flex 1; height 1px` (#DAE0EE dans le panneau Programme, #DBE0EB dans l’onglet Ressources)
- `BADGE-NAV` (pastille de barre latérale, comme « Nouveau » / « 1 à corriger » du shell) = flex none; padding 3px 7px 5px 9px; border-radius 4px; background #DDE1FF; font-size 12px; line-height 17px; font-weight 500; color #0B18C9; white-space nowrap
- `TUILE(n, r)` = span flex none; display flex; align-items center; justify-content center; width n; height n; border-radius r ; + background / color selon l’état
- `LIGNE-LISTE` = display flex; align-items center; gap 14px; padding 14px 4px; min-height 48px; color inherit; text-decoration none ; **si lien** : hover `background: #F2F6FD` + FOCUS ; **si div** : ni hover ni focus
- `TEXTES-LIGNE` = span flex 1; min-width 0; display flex; flex-direction column; gap 2px → titre span font-size 15px; line-height 22px; font-weight 500; color #1D1D1F + sous-titre span font-size 13px; line-height 20px; color #667085
- `RESSOURCE` = div display flex; align-items center; gap 12px; padding 12px 14px; border 1px solid #EAEEF7; border-radius 14px (non cliquable, pas de hover)
- `SÉPARATEUR` = div height 1px; background #EAEEF7

---

## 1. Cadre (shell) — ce que la page leçon change

### 1.1 Bureau
- **Header : identique octet pour octet** à NdParcours / NdFormation (logo, « Rechercher », « Ajouter une formation », série « 8 », points « 165 », cloche, menu profil) ; panneau notifications, menu profil et dialogue « Se déconnecter ? » identiques. Rien à refaire.
- Conteneur sous le header : identique au shell (div flex 1; display flex; flex-wrap wrap; align-items stretch; border-radius 32px; background #E9EFFB).
- **Seul changement : la barre latérale « Navigation principale » est remplacée par le panneau « Programme de la formation »** (§2.2), dans exactement la même boîte : `nav aria-label="Programme de la formation"` : flex 0 1 337px; box-sizing border-box; padding 20px 18px 20px 20px; display flex; flex-direction column; gap 12px. Le menu principal (Accueil, Événements, Communauté, Mes parcours…) disparaît entièrement ; seul subsiste un lien retour « Mes formations » en tête du panneau.
- `main` identique au shell : flex 999 1 560px; min-width 0; box-sizing border-box; margin 15px 20px 20px 0; padding 32px; border-radius 28px; background #FFFFFF.
- Pas de sticky : le panneau défile avec la page. C’est lui qui fixe la hauteur (≈ 1 460px avec ses 22 lignes de 48px) ; le main, plus court (≈ 1 280px), est étiré par `align-items: stretch` → espace blanc en bas du main.

### 1.2 Téléphone
- Racine identique au shell mobile : div position relative; width 390px; height 844px; box-sizing border-box; display flex; flex-direction column; background #F2F6FD; FONT; color #232326; overflow hidden.
- **Header variante « détail »** : header flex none; display flex; align-items center; justify-content space-between; gap 8px; padding 12px 16px (hauteur 72px)
  - div gauche : display flex; align-items center; gap 8px; min-width 0
    - a aria-label="Retour" → NdMobFormations (Mes formations) : flex none; display inline-flex; align-items center; justify-content center; width 48px; height 48px; padding 0; border 0; border-radius 14px; background #E9EFFB; color #232326; cursor pointer; text-decoration none — hover `background: #DEE6F6` — FOCUS → FLÈCHE-GAUCHE 20px (**remplace le logo 48×49** du shell)
    - span : font-size 18px; line-height 26px; font-weight 600; color #1D1D1F; overflow hidden; text-overflow ellipsis; white-space nowrap → « Maîtriser Microsoft Excel » (titre de la **formation**)
  - div droite : display flex; align-items center; gap 8px — **vide** (ni série, ni cloche)
- Panneau blanc : div flex 1; min-height 0; overflow hidden; display flex; flex-direction column; margin 0 8px; border-radius 28px 28px 0 0; background #FFFFFF — **descend jusqu’au bord bas de l’écran** : pas de barre d’onglets du bas (Accueil / Formations…), pas de marge basse 8px, coins bas carrés.
  - zone qui défile : div flex 1; min-height 0; overflow-y auto; padding 20px 16px 20px (largeur utile 342px ; hauteur visible 844 − 72 − 73 = 699px)
  - barre d’action (§3.8) : div flex none, sous la zone qui défile, toujours visible.

---

## 2. NdLecon — bureau

### 2.1 Mise en page générale
- Gauche : panneau Programme (§2.2) — pas de carte blanche, il est posé sur le fond #E9EFFB du conteneur.
- Droite : `main` blanc → div margin-top 0px (artefact, ignorer) → div display flex; flex-direction column; gap 24px; min-width 0, contenant dans l’ordre :
  1. bloc vidéo : div display flex; flex-direction column; gap 10px; min-width 0 → lecteur (§2.3) + ligne « temps regardé » (§2.4)
  2. en-tête de la leçon (§2.5)
  3. ligne de navigation (§2.6)
  4. trait : div height 1px; background #DBE0EB
  5. bloc deux colonnes (§2.7)
- Largeurs calculées à 1440 : conteneur 1400 ; panneau 337 (contenu utile 299) ; main 1043 (contenu 979) ; vidéo 979×551 ; colonne onglets ≈ 647 ; carte droite ≈ 300.
- Pas de fil d’Ariane dans le main : le contexte (retour + titre de la formation + progression) est en haut du panneau Programme.

### 2.2 Panneau « Programme de la formation »
Enfants de la nav, dans l’ordre (gap 12px entre **tous** les enfants, lignes comprises) :

**a) Retour** : a → NdMesFormations : NAV-ITEM → FLÈCHE-GAUCHE 20px + span « Mes formations »

**b) Bloc formation** : div display flex; flex-direction column; padding 6px 12px 10px
- a → NdFormation (fiche connectée) : font-size 16px; line-height 24px; font-weight 600; color #1D1D1F; text-decoration none — hover `text-decoration: underline` (pas de focus-visible déclaré) → « Maîtriser Microsoft Excel »
- PROGRESS aria-label="Progression de la formation" aria-valuenow="68" : height 8px; margin-top 12px; remplissage 68%
- div méta : display flex; flex-wrap wrap; align-items center; gap 7px; font-size 12px; line-height 18px; color #535E75; margin-top 8px
  - span « 68 % terminé » · DOT-535 · span display flex; align-items center; gap 4px → HORLOGE 18px (margin 0 -1.5px) + span « 2 h restantes »

**c) Modules** : pour chaque module, un en-tête puis ses lignes (tout est toujours déplié).
- En-tête : div display flex; align-items center; gap 10px; height 48px; padding 0 4px 0 12px
  - span SURTITRE + white-space nowrap → « 1 · Bases d’Excel » (saisi en casse normale, affiché en capitales par CSS)
  - span trait : flex 1; height 1px; background #DAE0EE
  - **ni compteur, ni durée, ni chevron, ni repli** : l’en-tête n’est pas cliquable.
- Ligne : a NAV-ITEM (ou span si verrouillée)
  - span icône : flex none; display flex → icône 20px
  - span titre title="{titre complet}" : flex 0 1 auto; min-width 0; overflow hidden; text-overflow ellipsis; white-space nowrap
  - [option] BADGE-NAV collé après le titre (gap 10px ; pas poussé à droite car le titre n’est pas `flex: 1`)
  - **aucune durée** affichée dans le panneau.
- États de ligne :

| État | Balise | Icône 20px (couleur) | Texte | Fond / interaction |
|---|---|---|---|---|
| terminé (leçon, quiz ou exercice) | a | CHECK-CERCLE #17663A (remplace l’icône de type, même pour quiz/exercice) | #232326 | hover blanc 55 % |
| en cours (« vous êtes ici ») | a aria-current="page" | PLAY-CERCLE, couleur héritée #0B18C9 | #0B18C9 | NAV-ITEM actif (blanc + ombre) ; **pas** de badge « Vous êtes ici » |
| leçon à venir | a | PLAY-CERCLE (#232326 hérité) | #232326 | hover |
| quiz à venir | a → NdQuiz | QUIZ (#232326) | #232326 | hover |
| exercice | a → NdExercice | EXERCICE (#232326) + BADGE-NAV « À corriger » | #232326 | hover |
| verrouillé | span aria-disabled="true" (non focusable) | CADENAS, couleur héritée #535E75 | color #535E75 | aucun hover |

- Pas d’état « aperçu » dans cette maquette.

**d) Données** (texte affiché → `title` complet si différent → cible → état) :
- « 1 · Bases d’Excel »
  - Découvrir l’interface → NdLecon → terminé
  - « Saisir et mettre en forme » (title « Saisir et mettre en forme des données ») → NdLecon → terminé
  - Les formules essentielles → NdLecon → terminé
  - « Références relatives » (title « Références relatives et absolues ») → NdLecon → terminé
  - Quiz du module 1 → NdQuiz → terminé
- « 2 · Formules et fonctions »
  - SI, ET, OU → terminé | RECHERCHEX → terminé | Fonctions de texte et de date → terminé (→ NdLecon)
  - « Nettoyer une enquête » (title « Exercice : nettoyer une enquête ») → NdExercice → terminé
- « 3 · Analyse de données »
  - Trier et filtrer → NdLecon → terminé
  - « Tableaux croisés dynamiques » (title « Les tableaux croisés dynamiques ») → NdLecon → **en cours**
  - Les graphiques avancés → NdLecon → à venir
  - Quiz du module 3 → NdQuiz → quiz à venir
  - Exercice pratique → NdExercice → exercice + BADGE-NAV « À corriger »
- « 4 · Automatisation » (tout verrouillé, span) : Mise en forme conditionnelle | Introduction aux macros | Quiz final (le quiz verrouillé prend aussi CADENAS)
- Les abréviations de titres sont faites à la main dans la maquette : en code, afficher le titre complet et laisser ellipsis + `title` gérer la coupe.

### 2.3 Lecteur vidéo (maquette statique)
- div : position relative; display flex; flex-direction column; justify-content flex-end; aspect-ratio 16 / 9; border-radius 16px; background #1D1D1F; overflow hidden
  - pas d’image d’aperçu (poster), pas de dégradé, pas de pastille de durée.
  - button type="button" aria-label="Lire la vidéo" : position absolute; left 50%; top 50%; transform translate(-50%, -50%); display flex; align-items center; justify-content center; width 72px; height 72px; padding 0; border 0; border-radius 50%; background #FFFFFF; color #1D1D1F; cursor pointer — **ni hover ni focus-visible déclarés** → LECTURE-PLEINE 28px
  - div barre du bas : display flex; flex-direction column; gap 10px; padding 16px 18px
    - span légende : font-size 14px; line-height 20px; font-weight 500; color #FFFFFF → « Module 3 · Les tableaux croisés dynamiques »
    - div piste : height 4px; border-radius 999px; background rgba(255, 255, 255, 0.28); overflow hidden → div width 33%; height 100%; background #FFFFFF (pas de radius propre)
    - div contrôles : display flex; align-items center; justify-content space-between; color #FFFFFF
      - div gauche : display flex; flex-wrap wrap; align-items center; gap 14px → LECTURE-PLEINE 18px #FFFFFF · VOLUME 18px #FFFFFF · span font-size 12px; line-height 18px → « 04:12 / 12:40 »
      - div droite : display flex; flex-wrap wrap; align-items center; gap 14px → span font-size 12px; line-height 18px; font-weight 500 → « 1× » · SOUS-TITRES 18px · PLEIN-ÉCRAN 18px
  - Les contrôles sont de simples svg aria-hidden (aucun bouton, aucun rôle) : repères visuels du futur lecteur.

### 2.4 Ligne « temps regardé » (10px sous la vidéo)
- div : display flex; flex-wrap wrap; align-items center; gap 7px; font-size 12px; line-height 18px; color #667085
  - « Temps réellement regardé : 33 % » · DOT · « Seuil de validation fixé par la formatrice : 90 % » · DOT · « Avancer dans la barre ne compte pas »
- Seule mention du seuil : il n’y a **pas** de texte « Regardez au moins 90 % de la vidéo », ni d’état désactivé du bouton de fin.

### 2.5 En-tête de la leçon
- div (sans style)
  - p : margin 0; font-size 14px; line-height 22px; color #667085; text-wrap pretty → « Module 3 · Analyse de données »
  - h1 : margin 0; margin-top 4px; font-size 32px; line-height 40px; font-weight 500; letter-spacing -0.01em; color #262628; text-wrap balance → « Les tableaux croisés dynamiques »
  - div méta : display flex; flex-wrap wrap; align-items center; gap 7px; font-size 14px; line-height 22px; color #667085; margin-top 10px
    - span display flex; align-items center; gap 4px → FORMATEUR 18px + span « Dr Mireille Adjovi »
    - DOT
    - span display flex; align-items center; gap 4px → HORLOGE 18px (margin 0 -1.5px) + span « 12 min 40 »
    - DOT
    - span « Leçon 2 sur 5 de ce module »

### 2.6 Navigation entre leçons + « Marquer comme terminée »
- div : display flex; flex-wrap wrap; align-items center; justify-content space-between; gap 8px
  - a → leçon précédente : BTN-SECONDARY → FLÈCHE-GAUCHE 18px + span « Leçon précédente »
  - div droite : display flex; flex-wrap wrap; gap 8px
    - état **non terminé** (défaut) : button type="button" BTN-PRIMARY-MD → COCHE 18px + span « Marquer comme terminée »
    - état **terminé** : button type="button" BTN-TONAL → CHECK-CERCLE 18px + span « Leçon terminée »
    - (clic sur l’un ou l’autre = bascule ; pas d’`aria-pressed`, pas d’état désactivé, pas de toast)
    - a → leçon suivante : BTN-SECONDARY → span « Leçon suivante » + FLÈCHE-DROITE 18px (icône **après** le texte)
- Aucun titre de la leçon voisine n’est affiché ; les deux liens pointent vers NdLecon (placeholder).

### 2.7 Bloc deux colonnes (sous le trait #DBE0EB)
- div : display flex; flex-wrap wrap; align-items flex-start; gap 32px
  - gauche : div flex 999 1 420px; min-width 0 → div display flex; flex-direction column; gap 20px; min-width 0 → SEG-TABS (§2.8) puis le panneau de l’onglet actif
  - droite : div flex 1 1 300px; min-width 0 → carte « Dans cette leçon » (§2.12)

### 2.8 Onglets
- SEG-TABS aria-label="Contenu de la leçon", 3 SEG-TAB dans cet ordre : « Ressources » (**actif par défaut**) | « Questions » | « Notes »
- Les panneaux sont de simples div affichés conditionnellement (pas de `role="tabpanel"`, pas d’`aria-controls`).

### 2.9 Onglet « Ressources » (défaut)
- div : display flex; flex-direction column; gap 24px; min-width 0
- **a) Fichiers** : div display flex; flex-direction column; gap 10px; min-width 0 → RESSOURCE × 2 :
  - TUILE(40px, 12px) background #E9EFFB; color #232326 → FICHIER-XLS 18px (même icône pour les deux fichiers, PDF compris)
  - span flex 1; min-width 0; display flex; flex-direction column
    - span nom : font-size 14px; line-height 20px; font-weight 500; color #1D1D1F; overflow hidden; text-overflow ellipsis; white-space nowrap
    - span méta : font-size 12px; line-height 18px; color #667085
  - button type="button" BTN-SECONDARY-SM → icône 16px + span (pas d’aria-label : le libellé visible ne nomme pas le fichier)
  - Données :
    1. « donnees-enquete.xlsx » — « Fichier d’exercice · 84 Ko · téléchargeable » — TÉLÉCHARGER 16px + « Télécharger »
    2. « Guide des tableaux croisés.pdf » — « 12 pages · consultation seule » — ŒIL 16px + « Consulter »
  - Libellés réels : « Télécharger » et « Consulter » (pas « Ouvrir »).
- **b) « À faire dans ce module »** : div display flex; flex-direction column; gap 4px; min-width 0
  - div en-tête : display flex; align-items center; gap 10px → span SURTITRE (sans nowrap) « À faire dans ce module » + span flex 1; height 1px; background #DBE0EB
  - div liste : display flex; flex-direction column
    - LIGNE-LISTE en **div** (non cliquable) :
      - TUILE(44px, 13px) background #E9EFFB; color #232326 → QUIZ 20px
      - TEXTES-LIGNE → « Quiz du module 3 » / « 4 questions · meilleur score : — »
      - a → NdQuiz : BTN-SECONDARY-SM → span « Commencer »
    - SÉPARATEUR
    - LIGNE-LISTE en **a** → NdExercice (hover #F2F6FD, FOCUS) :
      - TUILE(44px, 13px) background #FBEFD0; color #8A5A00 → EXERCICE 20px
      - TEXTES-LIGNE → « Exercice : tableau des ventes » / « Exercice avec rendu »
      - BADGE « À corriger » (#FBEFD0 / #8A5A00)
      - CHEVRON-DROITE 18px #667085
  - Bloc entier = lots Quiz / Exercices.

### 2.10 Onglet « Questions » (lot ultérieur : questions-réponses)
- div : display flex; flex-direction column; gap 20px; min-width 0
  - Saisie : div display flex; align-items flex-start; gap 12px
    - AVATAR(36px) background #DDE1FF; font-size 13px; color #0B18C9 → « AK » (utilisatrice connectée)
    - div : flex 1; min-width 0; display flex; flex-direction column; align-items flex-end; gap 10px
      - div align-self stretch → div display flex; flex-direction column; gap 6px; min-width 0 → label for LABEL « Votre question » + textarea rows="3" TEXTAREA placeholder « Posez une question sur cette leçon… »
      - button type="button" BTN-TONAL (aligné à droite) → ENVOYER 18px + span « Publier »
  - div trait : height 1px; background #EAEEF7 (déclaré #DBE0EB puis surchargé)
  - Message (× 2, séparés seulement par le gap 20px) : div display flex; align-items flex-start; gap 12px
    - AVATAR(36px) font-size 13px
    - div flex 1; min-width 0; display flex; flex-direction column; gap 4px
      - div : display flex; flex-wrap wrap; align-items center; gap 4px 8px → span nom font-size 14px; line-height 22px; font-weight 600; color #1D1D1F + [BADGE « Formatrice »] + span date font-size 12px; line-height 18px; font-weight 400; color #667085
      - p : margin 0; font-size 14px; line-height 22px; color #232326; text-wrap pretty
  - Données (ordre chronologique, la réponse au même niveau que la question, sans indentation) :
    1. « RH » (bg #FBEFD0 / #8A5A00) « Rodrigue H. » « il y a 3 h » — « Faut-il convertir les données en tableau avant de créer le TCD ? »
    2. « MA » (bg #EDE9FE / #6D28D9) « Dr Mireille Adjovi » + BADGE « Formatrice » « il y a 1 h » — « Oui, c’est conseillé : Ctrl + T, puis Insertion > Tableau croisé dynamique. Les nouvelles lignes seront prises en compte automatiquement. »
  - Absents : bouton « Répondre », état vide, compteur.

### 2.11 Onglet « Notes »
- div : display flex; flex-direction column; gap 14px; min-width 0
  - div : display flex; flex-direction column; gap 6px; min-width 0
    - label for LABEL → « Mes notes sur cette leçon »
    - textarea rows="7" TEXTAREA (≈ 180px de haut, redimensionnable verticalement) placeholder « Notez ce que vous voulez retenir : une formule, un raccourci, une idée pour votre mémoire… »
    - span aide : font-size 12px; line-height 18px; color #667085 → « Vos notes sont privées. Vous les retrouvez à chaque retour sur cette leçon. »
  - div : display flex; flex-wrap wrap; align-items center; gap 12px
    - button type="button" BTN-TONAL → NOTE 18px + span « Enregistrer la note »
- Absents : indicateur « Enregistré » / sauvegarde automatique, compteur de caractères, limite, message d’erreur. (La rangée flex gap 12px laisse la place pour un indicateur à droite du bouton.)

### 2.12 Carte « Dans cette leçon » (colonne droite)
- div : box-sizing border-box; display flex; flex-direction column; padding 20px; background #F2F6FD; border-radius 16px; min-width 0 (pas de bordure, pas d’ombre, pas sticky)
  - h3 : margin 0; font-size 16px; line-height 24px; font-weight 600; color #1D1D1F → « Dans cette leçon »
  - p : margin 0; margin-top 8px; font-size 14px; line-height 22px; color #535E75; text-wrap pretty → « Un tableau croisé dynamique résume en quelques clics des centaines de lignes : réponses d’un questionnaire, notes, ventes. Vous apprenez à le créer, à le modifier et à le présenter proprement dans votre mémoire. »
  - div liste : display flex; flex-direction column; gap 10px; margin-top 16px
    - div × 4 : display flex; align-items flex-start; gap 10px → span flex none; display flex; margin-top 2px; color #17663A (COCHE 18px) + span font-size 14px; line-height 22px; color #232326
    - « Créer un tableau croisé dynamique » | « Modifier la structure du tableau » | « Filtrer et trier les données » | « Mettre en forme le tableau pour un rapport »
  - Pas de sous-titre « Points clés » : la liste suit directement le résumé.

### 2.13 Responsive (bureau)
- Panneau 0 1 337px + main 999 1 560px (+ marge droite 20px) : le main passe **sous** le panneau quand le conteneur fait moins de 917px ; le panneau garde alors 337px de large (flex-grow 0) et ses 22 lignes restent au-dessus de la vidéo → en dessous du point de rupture du shell, utiliser la mise en page téléphone (§3).
- Deux colonnes : la carte « Dans cette leçon » passe sous les onglets quand la colonne utile < 752px (420 + 300 + 32).
- Ligne de navigation, ligne « temps regardé », méta : `flex-wrap` (les éléments passent à la ligne).

---

## 3. NdMobLecon — téléphone (contenu du panneau blanc)

### 3.1 Pile de la zone qui défile
- div : display flex; flex-direction column; gap 12px; min-width 0 → 1. lecteur (§3.2) · 2. bloc titre (§3.3) · 3. SEG-TABS (§3.4) · 4. div (sans style) contenant le panneau de l’onglet actif

### 3.2 Lecteur
- Identique au bureau (§2.3 : 16/9, radius 16px, #1D1D1F, bouton central 72px, piste 4px à 33 %, mêmes contrôles et valeurs) **sauf : pas de légende** « Module 3 · … » dans la barre du bas (piste + contrôles seulement). Taille rendue 342×192.
- Pas de ligne « temps regardé / seuil 90 % » sous la vidéo.

### 3.3 Bloc titre
- div (sans style)
  - **h2** (aucun h1 sur la page) : margin 0; font-size 20px; line-height 28px; font-weight 600; color #1D1D1F → « Les tableaux croisés dynamiques »
  - div méta : display flex; flex-wrap wrap; align-items center; gap 7px; font-size 14px; line-height 22px; color #667085; margin-top 4px → span « Module 3 · Analyse de données » · DOT · span « Dr Mireille Adjovi » (sans icônes, sans durée, sans « Leçon 2 sur 5 »)

### 3.4 Onglets pleine largeur
- SEG-TABS avec surcharges : display flex; align-self stretch; flex-wrap nowrap
- SEG-TAB × 3 avec surcharges : flex 1; min-width 0; height 44px; padding 0 6px (≈ 109px chacun) → « Programme » (**actif par défaut**) | « Ressources » | « Questions »
- **Pas d’onglet « Notes »**.

### 3.5 Onglet « Programme » (défaut) — module courant + module suivant seulement
- En-tête module courant : div display flex; align-items center; justify-content space-between; gap 12px; padding 6px 4px 2px
  - h3 : margin 0; font-size 16px; line-height 24px; font-weight 600; color #1D1D1F → « Module 3 : analyse de données »
  - span : font-size 12px; line-height 18px; color #667085 → « 1/5 » (éléments terminés / total du module)
- div liste : display flex; flex-direction column ; SÉPARATEUR entre deux lignes (pas avant la 1re ni après la dernière)
  - LIGNE-LISTE en **a** (hover #F2F6FD, FOCUS) → TUILE(40px, 12px) + icône 18px · TEXTES-LIGNE · [CHEVRON-DROITE 18px #667085 pour quiz et exercice]

| Titre | Sous-titre | Tuile bg / couleur | Icône 18px | Cible |
|---|---|---|---|---|
| Trier et filtrer | « 08:12 · terminée » | #DDF3E4 / #17663A | COCHE | NdMobLecon |
| Les tableaux croisés dynamiques | « 12:40 » + BADGE « En cours » (dans un span display inline-flex; align-items center; gap 8px) | #DDE1FF / #0B18C9 | PLAY | NdMobLecon |
| Les graphiques avancés | « 10:05 » | #E9EFFB / #232326 | VIDÉO | NdMobLecon |
| Quiz du module 3 | « 4 questions » | #E9EFFB / #232326 | QUIZ | NdMobQuiz + chevron |
| Exercice pratique | « Exercice avec rendu » | #E9EFFB / #232326 | EXERCICE | NdExercice + chevron |

  - La ligne en cours n’a ni `aria-current` ni fond particulier (seulement tuile bleue + badge).
- Trait entre modules : div height 1px; margin 6px 0 10px; background #EAEEF7 (déclaré #DBE0EB puis surchargé)
- En-tête module suivant : même div → h3 « Module 4 : automatisation » + BADGE neutre (#E5EBF7 / #4A546B) : CADENAS 13px + « Verrouillé »
- p : margin 0; font-size 14px; line-height 22px; color #667085; text-wrap pretty; padding 2px 4px 4px → « Ce module se débloque quand votre exercice pratique du module 3 est validé. »
- div liste : LIGNE-LISTE en **div** (pas de lien, pas de hover/focus, pas d’`aria-disabled`), séparées par SÉPARATEUR :
  - TUILE(40px, 12px) #E9EFFB / #232326 → CADENAS 18px
  - TEXTES-LIGNE, le titre étant enveloppé dans un span color #667085 (titre gris)
  - « Mise en forme conditionnelle » — « 09:30 » | « Introduction aux macros » — « 16:10 » | « Quiz final » — « Quiz »
- Non affichés sur téléphone : modules 1 et 2 (terminés), titre/progression de la formation (68 %, 2 h restantes).

### 3.6 Onglet « Ressources »
- div : display flex; flex-direction column; gap 10px; min-width 0 → RESSOURCE × 2 (tuile, nom, méta identiques au bureau) avec, à droite, un BTN-ICON-GHOST (icône 20px) au lieu du bouton texte :
  1. « donnees-enquete.xlsx » — « Fichier d’exercice · 84 Ko » — aria-label="Télécharger donnees-enquete.xlsx" → TÉLÉCHARGER 20px
  2. « Guide des tableaux croisés » — « PDF · 12 pages · consultation seule » — aria-label="Consulter le guide des tableaux croisés" → ŒIL 20px
- Pas de bloc « À faire dans ce module ».

### 3.7 Onglet « Questions » (lot ultérieur)
- div : display flex; flex-direction column; gap 6px; min-width 0 → label for LABEL « Votre question » + textarea rows="3" TEXTAREA placeholder « Posez une question sur cette leçon… » (pas d’avatar à gauche)
- div : display flex; justify-content flex-end; margin-top 10px → button type="button" BTN-TONAL + height 44px → ENVOYER 18px + span « Publier »
- div liste : display flex; flex-direction column; margin-top 8px ; SÉPARATEUR entre les messages
  - message : div display flex; align-items flex-start; gap 12px; padding 14px 0
    - AVATAR(40px) font-size 14px (couleurs comme au bureau)
    - div flex 1; min-width 0
      - div : display flex; flex-wrap wrap; align-items center; gap 2px 8px → span nom font-size 15px; line-height 22px; font-weight 600; color #1D1D1F + [BADGE « Formatrice »] + span date font-size 12px; line-height 18px; color #667085
      - p : margin 0; margin-top 4px; font-size 14px; line-height 22px; color #232326; text-wrap pretty
  - mêmes deux messages que le bureau (insécable avant « ? » dans le premier).

### 3.8 Barre d’action basse (toujours visible)
- div : flex none; padding 12px 16px; border-top 1px solid #EAEEF7 (hauteur 73px, dans le panneau blanc)
  - div : display flex; gap 8px
    - a → leçon précédente (NdMobLecon) : BTN-SECONDARY + flex none; height 48px; padding 0 10px → span « Leçon précédente » (**sans icône**)
    - div : flex 1; min-width 0
      - non terminée (défaut) : button type="button" BTN-PRIMARY-MD + width 100%; height 48px; padding 0 10px → span « Marquer comme terminée » (**sans icône**)
      - terminée : button type="button" BTN-TONAL + width 100%; height 48px; padding 0 10px → COCHE 18px + span « Leçon terminée »
- **Pas de « Leçon suivante »** sur téléphone.

---

## 4. Icônes

Hugeicons stroke-rounded (trait 1.5px, `fill: none; stroke: currentColor`, viewBox 24) sauf mention ; noms **vérifiés** par comparaison des tracés avec `@hugeicons/core-free-icons` installé dans `web/node_modules`. Correction de la fiche Catalogue : QUIZ = `Quiz01Icon`, EXERCICE = `AssignmentsIcon`.

| Clé | Nom exact | Glyphe | Tailles / couleurs (où) |
|---|---|---|---|
| FLÈCHE-GAUCHE | ArrowLeft02Icon | flèche ← | 20px #232326 (« Mes formations » bureau ; bouton Retour téléphone) ; 18px (« Leçon précédente » bureau) |
| FLÈCHE-DROITE | ArrowRight02Icon | flèche → | 18px (« Leçon suivante » bureau) |
| CHEVRON-DROITE | ArrowRight01Icon | chevron › | 18px #667085 (ligne exercice « À faire » ; lignes quiz/exercice téléphone) |
| CHECK-CERCLE | CheckmarkCircle02Icon | coche dans un cercle | 20px #17663A (lignes terminées du panneau) ; 18px #232326 (« Leçon terminée » bureau) |
| COCHE | Tick02Icon | coche simple | 18px #FFFFFF (« Marquer comme terminée » bureau) ; 18px #17663A (points clés ; tuile terminée téléphone) ; 18px #232326 (« Leçon terminée » téléphone) |
| PLAY-CERCLE | PlayCircleIcon | triangle arrondi dans un cercle | 20px #0B18C9 (ligne en cours) / #232326 (leçon à venir) — panneau bureau |
| PLAY | PlayIcon | triangle arrondi seul | 18px #0B18C9 (tuile leçon en cours, téléphone) |
| VIDÉO | Video01Icon | caméra | 18px #232326 (tuile leçon à venir, téléphone) |
| QUIZ | Quiz01Icon | rosette festonnée avec « ? » | 20px #232326 (panneau ; tuile « À faire ») ; 18px (tuile téléphone) |
| EXERCICE | AssignmentsIcon | crayon + feuille cochée | 20px #232326 (panneau) ; 20px #8A5A00 (tuile ambre « À faire ») ; 18px (tuile téléphone) |
| CADENAS | SquareLock02Icon | cadenas | 20px #535E75 (panneau) ; 18px #232326 (tuile téléphone) ; 13px #4A546B (BADGE « Verrouillé ») |
| HORLOGE | Clock01Icon | horloge | 18px, margin 0 -1.5px : #535E75 (« 2 h restantes ») ; #667085 (« 12 min 40 ») |
| FORMATEUR | TeachingIcon | personne devant un tableau | 18px #667085 (méta « Dr Mireille Adjovi ») |
| FICHIER-XLS | Xls01Icon | feuille cornée + lettres XLS | 18px #232326 (tuiles ressources, les deux fichiers) — pour un PDF, Pdf01Icon existe |
| TÉLÉCHARGER | Download04Icon | flèche épaisse ↓ + trait | 16px (bouton bureau) ; 20px (bouton icône téléphone) |
| ŒIL | ViewIcon | œil | 16px (bouton « Consulter ») ; 20px (téléphone) |
| ENVOYER | SentIcon | avion en papier | 18px (« Publier ») |
| NOTE | Note01Icon | bloc-notes à spirale | 18px (« Enregistrer la note ») |
| SOUS-TITRES | SubtitleIcon | carré arrondi + lignes en bas | 18px #FFFFFF (lecteur) |
| PLEIN-ÉCRAN | FullScreenIcon | 4 coins arrondis | 18px #FFFFFF (lecteur) |
| LECTURE-PLEINE | **Phosphor** `Play` (fill), viewBox 256, `fill: currentColor` | triangle plein | 28px #1D1D1F (bouton central) ; 18px #FFFFFF (barre) — équivalent Hugeicons : PlayIcon |
| VOLUME | **Phosphor** `SpeakerHigh` (fill), viewBox 256 | haut-parleur + 2 ondes | 18px #FFFFFF (barre) — équivalent Hugeicons : VolumeHighIcon |

Toutes les icônes sont `aria-hidden="true"`, `flex-shrink: 0; display: block`.

---

## 5. États interactifs et ARIA

### 5.1 Logique maquettée
- Bureau : état `g_onglet` ∈ {res, questions, notes} (défaut **res**) ; drapeau `f_fait` (défaut false) qui bascule « Marquer comme terminée » ⇄ « Leçon terminée » ; `ov` ∈ {menu, notif, logout} = shell.
- Téléphone : `g_onglet` ∈ {programme, ressources, questions} (défaut **programme**) ; drapeau `f_faite` (défaut false) ; aucun overlay.
- Rien d’autre n’est câblé : « Lire la vidéo », contrôles du lecteur, « Télécharger », « Consulter », « Publier », « Enregistrer la note » sans action ; liens précédente/suivante et lignes de leçon pointent vers la page elle-même.

### 5.2 États visuels déclarés
- **hover** : NAV-ITEM → rgba(255, 255, 255, 0.55) ; titre formation (panneau) → souligné ; BTN-SECONDARY(-SM) → #F2F6FD ; BTN-PRIMARY-MD → #08149F ; BTN-TONAL → #DEE6F6 ; LIGNE-LISTE lien → #F2F6FD ; BTN-ICON-GHOST → #E9EFFB ; bouton Retour téléphone → #DEE6F6. Aucun hover sur : SEG-TAB, ligne en cours, RESSOURCE, ligne quiz « À faire » (div), bouton lecture.
- **focus-visible** (FOCUS) : tous les liens et boutons ci-dessus + SEG-TAB. **Manquants** : bouton « Lire la vidéo », lien titre de formation du panneau.
- **focus** (champs) : TEXTAREA → bordure #0B18C9 + halo 3px rgba(11, 24, 201, 0.14).
- **aria-current="page"** : ligne de la leçon en cours (bureau uniquement).
- **aria-selected** : SEG-TAB (actif = blanc + ombre + texte bleu).
- **aria-disabled="true"** : 3 lignes verrouillées du panneau bureau (span). Téléphone : aucune marque ARIA sur les lignes verrouillées.
- **disabled**, **:active**, **aria-pressed** : aucun.

### 5.3 Attributs ARIA et rôles présents
- Bureau : `nav aria-label="Programme de la formation"` ; `role="progressbar" aria-label="Progression de la formation" aria-valuenow="68" aria-valuemin="0" aria-valuemax="100"` ; `aria-current="page"` ; `aria-disabled="true"` ×3 ; `aria-label="Lire la vidéo"` ; `role="tablist" aria-label="Contenu de la leçon"` + 3 `role="tab"` avec `aria-selected` ; `label for` sur les 2 textareas ; `title` sur chaque titre de ligne du panneau ; `aria-hidden` sur icônes et DOT.
- Téléphone : `aria-label="Retour"` ; `aria-label="Lire la vidéo"` ; tablist + 3 tabs `aria-selected` ; `aria-label="Télécharger donnees-enquete.xlsx"` et `aria-label="Consulter le guide des tableaux croisés"` ; `label for` sur le textarea.

### 5.4 À compléter en code (non maquetté, recommandé)
- `role="tabpanel"` + `aria-controls` / `aria-labelledby`, flèches clavier entre onglets.
- Bouton de fin : `aria-pressed` ou annonce de changement d’état ; FOCUS sur « Lire la vidéo » et sur le lien titre formation.
- Téléphone : `aria-current` sur la ligne en cours, `aria-disabled` sur les lignes verrouillées, un `h1` (le titre de leçon est un h2).
- Bureau : nommer le fichier dans les boutons « Télécharger » / « Consulter » (aria-label ou texte masqué).

---

## 6. Inventaire des textes (verbatim)

**Bureau — panneau** : Mes formations | Maîtriser Microsoft Excel | 68 % terminé | 2 h restantes | 1 · Bases d’Excel | Découvrir l’interface | Saisir et mettre en forme | Les formules essentielles | Références relatives | Quiz du module 1 | 2 · Formules et fonctions | SI, ET, OU | RECHERCHEX | Fonctions de texte et de date | Nettoyer une enquête | 3 · Analyse de données | Trier et filtrer | Tableaux croisés dynamiques | Les graphiques avancés | Quiz du module 3 | Exercice pratique | À corriger | 4 · Automatisation | Mise en forme conditionnelle | Introduction aux macros | Quiz final
(`title` complets : Saisir et mettre en forme des données | Références relatives et absolues | Exercice : nettoyer une enquête | Les tableaux croisés dynamiques)

**Bureau — main** : Module 3 · Les tableaux croisés dynamiques | 04:12 / 12:40 | 1× | Temps réellement regardé : 33 % | Seuil de validation fixé par la formatrice : 90 % | Avancer dans la barre ne compte pas | Module 3 · Analyse de données | Les tableaux croisés dynamiques | Dr Mireille Adjovi | 12 min 40 | Leçon 2 sur 5 de ce module | Leçon précédente | Marquer comme terminée | Leçon terminée | Leçon suivante | Ressources | Questions | Notes | donnees-enquete.xlsx | Fichier d’exercice · 84 Ko · téléchargeable | Télécharger | Guide des tableaux croisés.pdf | 12 pages · consultation seule | Consulter | À faire dans ce module | Quiz du module 3 | 4 questions · meilleur score : — | Commencer | Exercice : tableau des ventes | Exercice avec rendu | À corriger | AK | Votre question | Posez une question sur cette leçon… | Publier | RH | Rodrigue H. | il y a 3 h | Faut-il convertir les données en tableau avant de créer le TCD ? | MA | Formatrice | il y a 1 h | Oui, c’est conseillé : Ctrl + T, puis Insertion > Tableau croisé dynamique. Les nouvelles lignes seront prises en compte automatiquement. | Mes notes sur cette leçon | Notez ce que vous voulez retenir : une formule, un raccourci, une idée pour votre mémoire… | Vos notes sont privées. Vous les retrouvez à chaque retour sur cette leçon. | Enregistrer la note | Dans cette leçon | Un tableau croisé dynamique résume en quelques clics des centaines de lignes : réponses d’un questionnaire, notes, ventes. Vous apprenez à le créer, à le modifier et à le présenter proprement dans votre mémoire. | Créer un tableau croisé dynamique | Modifier la structure du tableau | Filtrer et trier les données | Mettre en forme le tableau pour un rapport
(aria : Programme de la formation | Progression de la formation | Lire la vidéo | Contenu de la leçon)

**Téléphone** : Maîtriser Microsoft Excel | 04:12 / 12:40 | 1× | Les tableaux croisés dynamiques | Module 3 · Analyse de données | Dr Mireille Adjovi | Programme | Ressources | Questions | Module 3 : analyse de données | 1/5 | Trier et filtrer | 08:12 · terminée | 12:40 | En cours | Les graphiques avancés | 10:05 | Quiz du module 3 | 4 questions | Exercice pratique | Exercice avec rendu | Module 4 : automatisation | Verrouillé | Ce module se débloque quand votre exercice pratique du module 3 est validé. | Mise en forme conditionnelle | 09:30 | Introduction aux macros | 16:10 | Quiz final | Quiz | donnees-enquete.xlsx | Fichier d’exercice · 84 Ko | Guide des tableaux croisés | PDF · 12 pages · consultation seule | Votre question | Posez une question sur cette leçon… | Publier | (messages identiques au bureau) | Leçon précédente | Marquer comme terminée | Leçon terminée
(aria : Retour | Lire la vidéo | Contenu de la leçon | Télécharger donnees-enquete.xlsx | Consulter le guide des tableaux croisés)

---

## 7. Écarts et questions

### 7.1 Écarts bureau ↔ téléphone
1. **Programme** : bureau = tous les modules dans le panneau gauche, sans durée ; téléphone = onglet, **module courant + module suivant seulement**, avec durées, sous-titres et explication de verrouillage.
2. **Leçon courante** : bureau = ligne blanche `aria-current`, sans badge ; téléphone = tuile bleue + BADGE « En cours » ; NdFormation = BADGE « Vous êtes ici ». Trois traitements différents.
3. **Icônes d’état** : terminé = CHECK-CERCLE vert (bureau) vs COCHE dans tuile verte (téléphone) ; en cours = PLAY-CERCLE vs PLAY ; à venir = PLAY-CERCLE vs VIDÉO.
4. **Onglets** : bureau Ressources | Questions | Notes (défaut Ressources) ; téléphone Programme | Ressources | Questions (défaut Programme). **Notes absent sur téléphone.**
5. **Titre** : h1 32px + méta complète (formatrice, durée, « Leçon 2 sur 5 ») au bureau ; h2 20px + module · formatrice au téléphone.
6. **Absents sur téléphone** : légende dans le lecteur, ligne « temps regardé / seuil 90 % », carte « Dans cette leçon » (résumé + points clés), progression de la formation (68 %, 2 h restantes), « Leçon suivante », bloc « À faire dans ce module ».
7. **Bouton de fin** : bureau avec COCHE (non terminé) / CHECK-CERCLE (terminé) ; téléphone sans icône (non terminé) / COCHE (terminé).
8. **Ressources** : bureau = boutons texte 34px « Télécharger » / « Consulter » ; téléphone = boutons icône 44px. Méta « · téléchargeable » au bureau seulement ; « PDF · » et nom sans « .pdf » au téléphone seulement.
9. **Questions** : avatar « AK » à gauche du champ et avatars 36px au bureau ; pas d’avatar de saisie, avatars 40px et séparateurs au téléphone.
10. **Retour** : bureau « Mes formations » (→ NdMesFormations) + titre formation cliquable (→ NdFormation) ; téléphone flèche seule (→ NdMobFormations), titre formation non cliquable.

### 7.2 Incohérences et placeholders
1. « Marquer comme terminée » est **actif** alors que le temps regardé (33 %) est sous le seuil (90 %) ; aucun état désactivé, aucun texte d’aide du type « Regardez au moins 90 % de la vidéo ».
2. Formats de durée : « 12 min 40 » (en-tête bureau) vs « 12:40 » (lecteur, téléphone) vs « 2 h restantes ».
3. Nom de module : « 3 · Analyse de données » (panneau, capitales CSS) / « Module 3 · Analyse de données » (en-têtes) / « Module 3 : analyse de données » (téléphone, comme NdFormation).
4. Comptages : « Leçon 2 sur 5 » et « 1/5 » comptent quiz et exercice comme des leçons ; NdFormation annonce « 7 leçons · 2 h 05 » pour le module 3 (5 éléments ici) et « 6 leçons » pour le module 1 (5 éléments ici).
5. Exercice du module 3 : « Exercice pratique » (panneau, téléphone) vs « Exercice : tableau des ventes » (« À faire ») ; badge « À corriger » bleu (BADGE-NAV) dans le panneau mais ambre (BADGE) dans « À faire », absent au téléphone ; « À corriger » est ambigu pour un exercice pas encore rendu.
6. Titres abrégés à la main dans le panneau (le `title` porte le vrai titre).
7. Icône XLS utilisée pour le PDF.
8. Toutes les cibles « leçon » pointent vers la page elle-même ; l’exercice téléphone pointe vers NdExercice (page bureau).
9. Lecteur : contrôles dessinés (svg non interactifs), icônes Phosphor pleines (viewBox 256) au milieu d’icônes Hugeicons ; pas de poster.
10. « meilleur score : — » = jamais tenté (placeholder).
11. Ligne quiz de « À faire » = div + bouton « Commencer », ligne exercice = lien sur toute la ligne : deux modes d’interaction différents.
12. Artefacts : `div margin-top: 0px` en tête du main ; traits déclarés #DBE0EB puis surchargés #EAEEF7 ; BTN-ICON-GHOST déclaré 42 puis surchargé 44.
13. Espace avant « ? » : normale au bureau, insécable au téléphone (choisir l’insécable, idéalement fine insécable U+202F, partout).

### 7.3 Données que la base (ou le calcul) doit fournir
- **Formation** : id/slug (liens), titre, formatrice (nom ; rôle « Formatrice »), progression % de l’utilisateur (68), temps restant (somme des durées non terminées : « 2 h »).
- **Module** : numéro d’ordre, titre, statut pour l’utilisateur (terminé / en cours / verrouillé), condition de déverrouillage (ex. « exercice pratique du module 3 validé ») pour générer la phrase d’explication, nombre d’éléments terminés / total (« 1/5 »).
- **Élément de module** : type (leçon / quiz / exercice), ordre, titre complet, durée mm:ss (leçons), statut utilisateur (terminé / en cours / à venir / verrouillé), lien ; quiz : nombre de questions, meilleur score (ou vide) ; exercice : mode (« Exercice avec rendu »), statut de correction (« À corriger »).
- **Leçon courante** : titre, module (numéro + titre), rang dans le module (2) et total (5), durée vidéo (12:40), formatrice, source vidéo (fichier / URL / identifiant hébergeur, sous-titres éventuels), résumé (« Dans cette leçon »), points clés (liste ordonnée, 4 ici), seuil de validation en % (90, « fixé par la formatrice »), leçons précédente et suivante (id + accessibilité).
- **Suivi utilisateur × leçon** : temps réellement regardé (% ou secondes, 33 %), dernière position de lecture (04:12), terminée (booléen + date). (« 1× » = préférence de lecteur, probablement locale.)
- **Ressources (par leçon)** : nom de fichier, catégorie (« Fichier d’exercice »), format (xlsx / PDF), taille (84 Ko), nombre de pages (12), mode d’accès (téléchargeable / consultation seule), emplacement de stockage (URL signée).
- **Notes** : texte par (utilisateur, leçon) ; date de mise à jour (non affichée).
- **Questions** (lot ultérieur) : auteur (nom, initiales, couleur d’avatar, rôle formatrice), date (affichée en relatif « il y a 3 h »), texte, lien question ↔ réponse.

### 7.4 Éléments qui relèvent de lots ultérieurs
- **Quiz** : lignes quiz (panneau, onglet Programme), « Quiz du module 3 » + « Commencer » + « 4 questions · meilleur score : — », cibles NdQuiz / NdMobQuiz.
- **Exercices avec rendu et correction** : lignes exercice, badges « À corriger », « Exercice avec rendu », NdExercice, et le déverrouillage d’un module par exercice validé.
- **Questions-réponses** : onglet « Questions » entier (saisie, « Publier », fil, badge « Formatrice »).
- Communauté, certificats, sessions live : absents du contenu de la page (seulement dans les notifications du shell).

### 7.5 Questions à trancher
1. Bouton de fin : désactivé tant que le seuil n’est pas atteint ? Avec quel texte (aucun dans la maquette) ? Peut-on revenir de « Leçon terminée » à « non terminée » (la maquette le permet) ?
2. Mesure du temps regardé (« Avancer dans la barre ne compte pas ») : dans ce lot ou plus tard ? Seuil défini par leçon ou par formation ?
3. Un seul traitement pour la leçon courante (ligne blanche, « En cours » ou « Vous êtes ici ») ?
4. Téléphone : onglet Programme limité au module courant + suivant, ou tous les modules (repliables) ? Notes, « Dans cette leçon » et « Leçon suivante » volontairement absents ?
5. « Consulter » ouvre quoi (visionneuse intégrée, nouvel onglet) ? « Consultation seule » interdit-elle tout téléchargement ? Une icône par format ?
6. Notes : enregistrement par bouton seul ou sauvegarde automatique + indicateur ? Limite de taille ?
7. Quiz et exercices comptent-ils comme « leçons » dans « Leçon 2 sur 5 » ? Format de durée unique (« 12:40 » ou « 12 min 40 ») ?
8. Comportement de « Leçon précédente / suivante » en début ou fin de formation, ou quand la suivante est un quiz, un exercice ou un module verrouillé ?
