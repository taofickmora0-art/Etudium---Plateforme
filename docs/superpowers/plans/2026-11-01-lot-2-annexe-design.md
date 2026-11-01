# Lot 2 — annexe design (écrans de paiement)

> **Source :** artefact « Étudium — Nouveau design » (https://claude.ai/artifact/9Ei2bCdhG75Nr3KnFZQxfg), version 1793437725-84d8, lue le 2026-11-01.
> **Rôle :** relevé fidèle des écrans de paiement du design, pour coder le lot 2 (spec : `docs/superpowers/specs/2026-11-01-lot-2-abonnements-paiement-design.md`).
> **Lecture :** les textes entre guillemets « … » sont **tels qu’affichés** dans le design. Les marques **[ANCIEN]** signalent ce qui relève de l’ancien modèle (formules mensuelles par parcours, « 1 parcours au choix », « 1 mois », choix des parcours, prorata, formations complémentaires) et doit être adapté au nouveau modèle : **Basique 3 mois, Standard 6 mois (recommandé), Premium 1 an, chacun ouvre tout, paiement direct MTN/Moov par le numéro, codes promo**.
> **Rappel téléphone :** le design téléphone est en 390 × 844 ; côté code, sur téléphone, garder des tailles plus compactes que le design (`max-sm`).

Les jetons du design restent des repères : `[PRIX]`, `[RÉDUCTION]`, `[PRESTATAIRE]`, `[NOMBRE]`, `[LIMITE]`.

---

## 0. Inventaire

Plusieurs artboards sont **le même fichier** ouvert dans un état différent (même HTML, seul l’état initial change).

| Artboard | Titre sur le canvas | Format | État initial |
|---|---|---|---|
| **NdTarifs** | Tarifs | page 1440, fluide | — |
| **NdAbonnement** | Mon abonnement | page 1440, fluide | étape « formule », Standard |
| NdAbonnementPaiement | Mon abonnement · paiement par Mobile Money | = NdAbonnement | étape « paiement » |
| NdChangementFormule | Mon abonnement · changement de formule | = NdAbonnement | dialogue « changer » ouvert |
| NdPaiementAttente | Paiement · en attente de confirmation | = NdAbonnement | étape paiement + dialogue « attente » |
| NdPaiementReussi | Paiement · confirmé | = NdAbonnement | étape « confirmation » + dialogue « réussi » |
| NdPaiementEchoue | Paiement · échoué | = NdAbonnement | étape paiement + dialogue « échoué » |
| **NdMobPaiement** | Téléphone · paiement Mobile Money | 390 × 844 | opérateur MTN |
| NdMobPaiementAttente | Téléphone · paiement en attente de confirmation | = NdMobPaiement | feuille « attente » ouverte |
| NdAccueil / NdAccueilRenouvellement | Accueil / Accueil · rappel de renouvellement | page 1440 | bandeau ; + dialogue « renouveler » |
| NdMobAccueil | Téléphone · accueil | 390 × 844 | bandeau « Renouveler » |
| NdLanding | Accueil public | page 1440 | section « Formules » + FAQ |
| NdFormationPublic | Fiche formation publique | page 1440 | carte d’accès |
| NdAdminPaiements / NdAdminRemboursement | Back-office · paiements / rembourser | page 1440 | filtre « Tous » ; + dialogue |
| NdCModales, NdCRetours, NdCFormulaires, NdCBoutons, NdCCartes | vitrine des composants | 1440 | — |

**Aucun écran** dans le design pour : le reçu (seulement des boutons « Télécharger le reçu »), « Mon abonnement » ou « Tarifs » en version téléphone, l’administration des prix et des codes promo, les états « Compte gratuit » / « Expiré » de « Mon abonnement ». Les mots « Facture » et « Renouvellement automatique » n’apparaissent nulle part.

---

## 1. Jetons communs (valables pour tous les écrans ci-dessous)

**Police :** Inter 400/500/600/700, lissage antialiased.

**Couleurs**
- Primaire `#0B18C9`, survol `#08149F` ; bleu nuit (pied de page) `#060F75`.
- Textes : courant `#232326`, titres `#1D1D1F`, grands titres `#262628`, secondaire `#667085`, tertiaire `#535E75`.
- Fonds : page `#F2F6FD`, coque/zone `#E9EFFB` (survol `#DEE6F6`), carte `#FFFFFF`, accent doux `#EEF0FF`, tuile d’icône `#DDE1FF`.
- Bordures : carte `#EAEEF7`, bouton/option `#E3E8F3`, champ `#D2D9E8`, séparateur `#DBE0EB`, radio vide `#BFC8DB`, champ en erreur `#D92D20`.
- Fond « points » des blocs bleus : `background-color:#0B18C9; background-image: radial-gradient(rgba(255,255,255,.13) 1.2px, transparent 1.2px); background-size: 22px 22px`.

**Badges** (padding `3px 8px 4px`, rayon `4px`, 12/17 px, 500)
| Sens | Fond | Texte | Exemples |
|---|---|---|---|
| Succès | `#DDF3E4` | `#17663A` | « Active », « Réussi » |
| Alerte | `#FBEFD0` | `#8A5A00` | « Expire dans 5 jours » |
| Erreur | `#FBE3E1` | `#B42318` | « Échoué » |
| Neutre | `#E5EBF7` | `#4A546B` | « Formule actuelle », « En attente » |
| Info | `#DDE1FF` | `#0B18C9` | « Remboursé », « Complémentaire » |
| Violet | `#EDE9FE` | `#6D28D9` | « Changement immédiat au prorata » |

Pastilles « pilule » (rayon 999) : « Recommandée » `4px 10px`, 12/18, 600 ; puces de formule `5px 12px`, 13/20, 600.

**Boutons** (Inter 500, `line-height:1`, `gap:8px`, focus `outline 2px #0B18C9, offset 2px`)
- Grand : hauteur 48, rayon 14, `0 18px`, 16 px.
- Moyen : hauteur 42, rayon 12, `0 15px`, 14 px.
- Petit : hauteur 34, rayon 10, `0 12px`, 13 px.
- Primaire `#0B18C9`/blanc (survol `#08149F`) ; secondaire blanc + bordure `1px #E3E8F3` (survol `#F2F6FD`) ; tertiaire `#E9EFFB` sans bordure (survol `#DEE6F6`) ; sur fond bleu : blanc/texte `#0B18C9` 600 (survol `#EEF0FF`) ou contour `1px rgba(255,255,255,.45)`.

**Carte-option (radio en carte)** : bouton `aria-pressed`, flex, `gap:14px`, `padding:14px 16px`, rayon 14, bordure `1px #E3E8F3`, fond blanc, survol `#F2F6FD`. Choisie : bordure `#0B18C9` + `box-shadow: inset 0 0 0 1px #0B18C9`. Contenu : titre 15/22 600 `#1D1D1F`, sous-titre 13/20 `#667085`. Radio à droite : rond 20 px, bordure `1.5px #BFC8DB` ; choisi : plein `#0B18C9` avec point blanc 8 px.

**Champ** : label 14/20 500 `#1D1D1F`, `gap:6px`, champ hauteur 48, `0 14px`, rayon 12, bordure `#D2D9E8`, 15 px ; focus bordure `#0B18C9` + `0 0 0 3px rgba(11,24,201,.14)` ; aide 12/18 `#667085` ; erreur : bordure `#D92D20` + message 12/18 `#B42318` avec icône 14 px. Placeholder `#757F94`.

**Dialogue (bureau)** : voile `rgba(29,29,31,.5)`, centré, `padding:20px`. Boîte 440 px (480 pour « Paiement confirmé »), `padding:28px`, rayon 24, ombre `0 16px 40px rgba(20,20,30,.14), 0 2px 6px rgba(20,20,30,.06)`. Croix « Fermer » 36 × 36 en haut à droite (16/16), rayon 10, `#667085`. Tuile d’icône 48 × 48, rayon 14, `margin-bottom:18px`. Titre 20/28 600 ; texte 14/22 `#667085`, `margin-top:8px` ; actions alignées à droite, `gap:8px`, `margin-top:24px`, boutons moyens.

**Toast** : en bas à droite (24/24), boîte 360 px, fond `#1D1D1F`, rayon 16, `padding:14px 14px 14px 16px` ; icône 20 px `#DDF3E4` ; titre 14/20 600 blanc ; texte 13/20 `#CED5E2` ; croix 32 × 32 « Fermer la notification ».

**Tableau** : cadre `1px #EAEEF7`, rayon 16, `overflow-x:auto` ; en-têtes `14px 16px`, fond `#F2F6FD`, 13 px 500 `#535E75` ; cellules hauteur 56, `8px 16px`, filet haut `#EAEEF7`, 14/20. Montants alignés à droite.

**Étapes** : `ol` flex wrap `gap:10px`. Rond 28 px, 13 px 600. Courante : `#0B18C9`/blanc, libellé 14/20 600 `#1D1D1F`, `aria-current="step"`. Faite : `#DDF3E4` avec coche 16 px `#17663A`, libellé 500 `#667085`. À venir : `#E9EFFB`/`#535E75`. Liaison : trait 28 × 1 `#DBE0EB`.

---

## 2. NdTarifs (page publique « Tarifs »)

**Coque** : fond `#F2F6FD`, `padding:0 20px 20px`. En-tête public (hauteur 49, rayon 14) : logo « Étudium » (`#E9EFFB`, 17 px 700 `#0B18C9`), liens « Parcours », « Formations », « Tarifs » (courant, fond `#E9EFFB`), « Communauté », « Vérifier un certificat » ; à droite « Se connecter » (tertiaire) et « Créer un compte gratuit » (primaire, 49 px). Puis une zone `#E9EFFB`, rayon 32, `padding:20px`, `gap:20px` qui empile les sections (rayon 28 chacune).

### 2.1 Bandeau d’en-tête (fond bleu à points, `padding: clamp(28px, 4.5vw, 56px)`)
- Pastille « Tarifs » (`rgba(255,255,255,.14)`, blanc, 13/18 600, `6px 13px`).
- H2 « Choisissez votre formule » : `clamp(28px, 3.5vw, 44px)`, 1.08, 500, `-0.028em`, blanc.
- Texte (17/27, `#DDE1FF`, max 640) : « Un abonnement mensuel, payé par Mobile Money. Pas de prélèvement automatique : vous renouvelez quand vous le décidez. » **[ANCIEN : « mensuel »]**
- À droite (décor, `aria-hidden`) : 3 tuiles blanches 84 × 84, rayon 24, ombre `0 10px 28px rgba(4,10,80,.22)`, inclinées (−7°, 4°…), chevauchées (`margin-left:-13px`), chacune avec le logo « pile » 52 px.

### 2.2 Les trois cartes (section transparente)
Grille `repeat(auto-fill, minmax(min(100%, max(270px, calc((100% - 40px)/3))), 1fr))`, `gap:20px` → 3 colonnes sur ordinateur, 1 colonne sur téléphone.

Carte : `padding:28px`, rayon 24, flex colonne. Ordre interne :
1. Titre h3 20/28 600 (+ pastille « Recommandée » à droite pour Standard, `min-height:28px`).
2. Accroche 14/22 `#667085`, `margin-top:6px`, `min-height:44px`.
3. Prix : `margin-top:18px`, « [PRIX] » 44/48 500 `-0.03em` + « FCFA / mois » 14/22 `#667085`. **[ANCIEN : « / mois »]**
4. Puce de formule (`margin-top:14px`, `#EEF0FF`/`#0B18C9`). **[ANCIEN : nombre de parcours]**
5. Filet `1px #EAEEF7`, `margin:24px 0`.
6. Liste à coches (icône coche 18 px `#0B18C9`, `margin-top:2px`), 14/22, `gap:10px`, bloc `flex:1`.
7. Bouton grand pleine largeur, `margin-top:28px`.

| | Basique | Standard (mise en avant) | Premium |
|---|---|---|---|
| Style | blanc, bordure `#EAEEF7` | fond bleu à points + ombre `0 24px 48px rgba(11,24,201,.26)`, textes blancs/`#DDE1FF`, coches blanches, filet `rgba(255,255,255,.22)` | blanc, bordure `#EAEEF7` |
| Pastille | — | « Recommandée » (blanc / `#0B18C9`) | — |
| Accroche | « Pour se concentrer sur un objectif. » | « Pour combiner deux compétences. » | « Pour tout apprendre, avec un suivi renforcé. » |
| Puce **[ANCIEN]** | « 1 parcours au choix » | « 2 parcours au choix » (`rgba(255,255,255,.16)`, blanc) | « Tous les parcours » |
| Liste | « Toutes les formations du parcours » **[ANCIEN]** · « Quiz, exercices et certificats » · « Communauté du parcours » **[ANCIEN]** · « Formations complémentaires limitées » **[ANCIEN]** | « Toutes les formations des 2 parcours » **[ANCIEN]** · « Exercices corrigés et sessions live » · « Communautés des 2 parcours » **[ANCIEN]** · « Plus de formations complémentaires » **[ANCIEN]** | « Tous les parcours, actuels et futurs » · « Accompagnement renforcé » · « Fonctionnalités Premium » · « Limite de formations complémentaires la plus haute » **[ANCIEN]** |
| Bouton (→ inscription) | « Choisir Basique » (secondaire) | « Choisir Standard » (blanc, texte `#0B18C9` 600, 15 px) | « Choisir Premium » (secondaire) |

Sous la grille, note centrée 13/20 `#535E75` : « Les prix, les avantages et les limites de chaque formule se règlent dans le back-office. » (note de conception, **à ne pas afficher** au public).

### 2.3 « Comparer les formules » (section blanche, `padding: clamp(24px, 4vw, 48px)`)
- H2 « Comparer les formules » (même style que 2.1, `#262628`).
- Tableau (`margin-top:28px`, `min-width:640px`, défilement horizontal sur téléphone). Colonnes « Ce qui est inclus » | « Basique » | « Standard » | « Premium » (16 % chacune, centrées).
- Lignes : « Parcours accessibles » 1 / 2 / Tous **[ANCIEN]** · « Formations des parcours, quiz et certificats » ✓✓✓ · « Communautés des parcours » ✓✓✓ **[ANCIEN]** · « Exercices corrigés par un formateur » « Limités » / ✓ / ✓ · « Sessions live » — / ✓ / ✓ · « Formations complémentaires (achat à l’unité) » [LIMITE] ×3 **[ANCIEN]** · « Accompagnement renforcé » — / — / ✓.
- « Inclus » : pastille ronde 28 px `#EEF0FF` + coche 16 px `#0B18C9` (`role="img" aria-label="Inclus"`) ; « Non inclus » : tiret « − » `#667085`.
- **Nouveau modèle :** tout est ouvert dans les trois formules ; ce tableau perd son sens tel quel (à remplacer par durée / prix / équivalent mensuel, ou à retirer).

### 2.4 FAQ « Questions sur les formules » (section transparente)
Deux colonnes qui passent l’une sous l’autre (`flex-wrap`, `gap:56px` ; gauche `1 1 380px`, droite `999 1 420px`).
- Gauche : pastille « Questions fréquentes » (blanc / `#0B18C9`) + H2 « Questions sur les formules ».
- Droite : carte blanche rayon 24, `padding: 6px clamp(18px,3vw,32px) 10px`. Accordéon : ligne `border-bottom #EAEEF7`, bouton `min-height:56px` 16/24 500 + chevron 20 px ; réponse 14/22 `#667085`, `padding:0 40px 18px 0`. La 1re est ouverte.
  1. « Puis-je passer à une formule supérieure en cours de mois ? » → « Oui. Le changement est immédiat : vous payez seulement la différence, calculée au prorata des jours restants. » **[ANCIEN]**
  2. « Et pour une formule inférieure ? » → « Le changement est programmé au prochain renouvellement. Vous gardez vos avantages actuels jusqu’à l’expiration. » **[ANCIEN]**
  3. « Qu’est-ce qu’une formation complémentaire ? » → « Une formation hors de vos parcours, achetée une seule fois. Elle reste liée à votre compte et reste accessible tant que votre abonnement est actif. » **[ANCIEN]**
  4. « Quels moyens de paiement ? » → « Le Mobile Money. Votre accès est activé automatiquement dès la confirmation du paiement, et vous recevez un reçu. » (à garder, préciser MTN et Moov)

### 2.5 Appel final + pied de page
- Section bleue à points (`padding: clamp(28px, 5vw, 64px)`) : H2 « Commencez gratuitement dès aujourd’hui » (`clamp(36px, 4.8vw, 62px)`), texte « Créez votre compte en une minute, suivez les formations gratuites, puis choisissez votre formule quand vous êtes prêt. » ; boutons 52 px rayon 14 : « Créer mon compte gratuit » (blanc + flèche 18 px) et « Découvrir les formations » (contour blanc) ; à droite 3 tuiles 104 × 104 rayon 29.
- Pied de page `#060F75` à points, texte `#C2C8FF` : colonnes « Plateforme » (Formations, Parcours, Tarifs), « Ressources » (Questions fréquentes, Vérifier un certificat, Communauté), « Légal » (Conditions d’utilisation, Confidentialité, Contact) ; « © 2026 Étudium. Tous droits réservés. »

---

## 3. NdAbonnement (« Mon abonnement », espace étudiant, bureau)

### 3.1 Coque
Coque de l’espace étudiant habituelle : barre du haut (logo, « Rechercher », « Ajouter une formation », compteurs, notifications, avatar), panneau `#E9EFFB` rayon 32 avec la navigation (lien courant « Mon abonnement » : fond blanc, ombre `0 1px 2px rgba(20,20,30,.08)`, texte `#0B18C9`). Contenu `main` : blanc, rayon 28, `padding:32px`, `margin:15px 20px 20px 0`.

### 3.2 En-tête
- H1 « Mon abonnement » 32/40 500 `-0.01em` `#262628`.
- Texte 16/24 `#232326`, `margin-top:10px` : « Un abonnement mensuel, payé par Mobile Money. Pas de prélèvement automatique : vous renouvelez quand vous le décidez. » **[ANCIEN : « mensuel »]**
- Filet `#DBE0EB`, `margin-top:20px` ; contenu `margin-top:32px`, colonne `gap:20px`.

### 3.3 Carte « formule actuelle »
Carte `padding:18px 19px`, bordure `#EAEEF7`, rayon 16 ; rangée wrap `gap:14px 16px` :
- Tuile 48 × 48 rayon 14 `#DDE1FF` / `#0B18C9`, icône carte bancaire 22 px.
- Bloc (`flex:1 1 300px`, `gap:4px`) : h3 « Formule Standard » 16/24 600 + badge alerte « Expire dans 5 jours » ; ligne méta 14/22 `#667085` séparée par des points de 3 px : « Expire le 14 octobre 2026 » · « Renouvellement manuel » · « Réussite académique, Compétences digitales » **[ANCIEN : liste des parcours]**.
- Bouton moyen secondaire avec icône flèches 18 px : « Passer à Premium » → ouvre le dialogue « changer » (3.10). **[ANCIEN]**
- Après paiement (étape confirmation), la carte devient : « Formule Standard » + badge succès « Active », « Expire le 14 novembre 2026 » · « Renouvellement manuel » · parcours ; sans bouton. Variantes Basique (« Réussite académique ») et Premium (« Réussite académique, Compétences digitales, Business & revenus en ligne »).

### 3.4 Bloc de souscription (carte `padding:22px 24px 24px`, bordure `#EAEEF7`, rayon 16)
En tête, les étapes « 1 Formule » · « 2 Parcours » **[ANCIEN]** · « 3 Paiement » · « 4 Confirmation », puis un filet `#EAEEF7` `margin:18px 0 22px`.

**Étape 1 — « 1. Choisissez votre formule »** (h2 20/28 600 ; colonne `gap:16px`)
- Trois cartes-options empilées (`gap:10px`), chacune : titre + badge éventuel, sous-titre, prix à droite « [PRIX] FCFA » 14/20 600 + « / mois » 400 `#667085`, radio.
  - « Basique » — « 1 parcours au choix, quiz, exercices et certificats. » **[ANCIEN]**
  - « Standard » + badge neutre « Formule actuelle » — « 2 parcours, sessions live et exercices corrigés. » **[ANCIEN]** (cochée)
  - « Premium » + badge violet « Changement immédiat au prorata » **[ANCIEN]** — « Tous les parcours et un accompagnement renforcé. »
  - « / mois » **[ANCIEN]** partout.
- Aide 14/22 `#667085` : « Passer à une formule supérieure est immédiat : vous ne payez que la différence au prorata. Une formule inférieure s’applique au prochain renouvellement. » **[ANCIEN]**
- Actions à droite : « Continuer » (primaire moyen + flèche 18 px).

**Étape 2 — « 2. Choisissez vos parcours »** **[ANCIEN, à supprimer]**
- Texte 14/22 : « Votre formule Standard donne accès à 2 parcours. Ils restent les mêmes jusqu’au prochain renouvellement. » (Basique : « … donne accès à 1 parcours. Il reste le même jusqu’au prochain renouvellement. » ; Premium : « Premium inclut tous les parcours disponibles. »)
- Cartes-options avec tuile 44 × 44 rayon 13 : « Réussite académique » — « Word, Excel, Zotero, mémoire, soutenance. » (`#DDE1FF`/`#0B18C9`) ; « Compétences digitales » — « Canva, IA, contenu, montage vidéo. » (`#EDE9FE`/`#6D28D9`) ; « Business & revenus en ligne » — « Freelance, e-commerce, clients. » (`#FBEFD0`/`#8A5A00`).
- Compteur 12/18 `#667085` : « 2 sur 2 parcours sélectionnés » (« 1 sur 1 parcours sélectionné », « 3 sur 3 parcours sélectionnés »).
- Actions : « Retour » (secondaire) + « Continuer » (primaire).

**Étape 3 — « 3. Paiement par Mobile Money »** (colonne `gap:18px`)
Deux colonnes qui se replient (`flex-wrap`, `gap:24px`) : formulaire `999 1 420px`, récapitulatif `1 1 280px`.
- Formulaire (colonne `gap:18px`) :
  - Libellé « Opérateur » (14/20 500), puis grille de 3 cartes-options (`minmax(… 150px …)`, `gap:10px`) : « MTN » / « Mobile Money », « Moov » / « Moov Money », « Celtiis » / « Celtiis Cash ». **Celtiis est hors périmètre (Payiz : MTN et Moov).**
  - Champ « Numéro Mobile Money » (`type="tel"`, valeur exemple « 01 97 00 00 00 », placeholder « 01 00 00 00 00 ») ; aide : « Vous recevrez une demande de confirmation sur ce téléphone. »
  - Champ « Code promo » + « (facultatif) » (400 `#667085`), placeholder « Saisissez votre code », `padding-right:48px` ; bouton petit tertiaire « Appliquer » (hauteur 36, collé à droite : `right:6px; top:6px`). Code accepté : ligne 12/18 `#17663A` avec coche 14 px : « Code appliqué : [RÉDUCTION] sur ce paiement. » (pas d’état d’erreur dessiné).
- Récapitulatif : bloc `#F2F6FD`, `padding:20px`, rayon 16, colonne `gap:14px` :
  - h3 « Récapitulatif » 16/24 600.
  - Ligne « Formule Standard » (14/20 500) / « 1 mois · renouvellement manuel » (13/20 `#535E75`) — à droite « [PRIX] » 14/20 500. **[ANCIEN : « 1 mois »]**
  - Ligne « Parcours » / « Réussite académique, Compétences digitales ». **[ANCIEN]**
  - Si code : ligne « Code promo » — « − [RÉDUCTION] ».
  - Filet `#DAE0EE` ; « Total » 15/22 600 — « [PRIX] FCFA » 18/26 600.
- Pied (wrap, `space-between`, `gap:12px 16px`) : à gauche, cadenas 16 px + 13/20 `#667085` « Paiement sécurisé par [PRESTATAIRE]. Étudium ne voit jamais votre code secret. » ([PRESTATAIRE] = Payiz) ; à droite « Retour » (secondaire) + « Payer [PRIX] FCFA » (primaire).

**Étape 4 — confirmation** (rangée wrap `gap:16px`)
- Tuile 48 × 48 `#DDF3E4`/`#17663A`, coche ronde 22 px.
- h2 « Paiement confirmé » ; texte 14/22 `#232326` : « Votre formule Standard est active jusqu’au 14 novembre 2026. Vos parcours : Réussite académique, Compétences digitales. Un reçu vous a été envoyé par e-mail. » **[ANCIEN : « Vos parcours… »]** (e-mail de reçu : lot 5 B).
- Boutons (`margin-top:12px`) : « Télécharger le reçu » (secondaire + icône 18 px) et « Aller à mon tableau de bord » (primaire, lien accueil).

### 3.5 « Historique des paiements » (`margin-top:12px`, colonne `gap:14px`)
- h2 « Historique des paiements » + 14/22 `#667085` « Reçus disponibles au format PDF ».
- Tableau (`min-width:640px`) : « Date » | « Objet » | « Moyen » | « Montant » (droite) | « Statut » | « Reçu » (droite).
  - « 14/09/2026 » · « Formule Standard · 1 mois » · « MTN Mobile Money » · « [PRIX] » · badge « Réussi » · bouton-icône 34 × 34 rayon 10 (`aria-label="Télécharger le reçu du 14/09/2026"`).
  - « 02/09/2026 » · « Formation complémentaire · Marketing digital » **[ANCIEN]** · « Moov Money » · « [PRIX] » · « Réussi » · reçu.
  - « 14/08/2026 » · « Formule Basique · 1 mois » · « MTN Mobile Money » · « [PRIX] » · badge « Échoué » · cellule reçu vide.
- **Nouveau modèle :** objet « Standard · 6 mois » etc. ; la spec dit « Voir le reçu » (page imprimable) plutôt que « Télécharger » un PDF.

### 3.6 Dialogues
| État | Tuile | Titre | Texte | Actions |
|---|---|---|---|---|
| `changer` **[ANCIEN]** | `#DDE1FF`/`#0B18C9`, flèches | « Passer à la formule Premium ? » | « Le changement est immédiat : vous ne payez que la différence au prorata, soit [PRIX] FCFA. Tous les parcours seront débloqués. » | « Annuler » · « Continuer vers le paiement » (→ étape paiement, Premium) |
| `attente` | aucune | « Confirmez sur votre téléphone » | « Une demande de [PRIX] FCFA a été envoyée au 01 97 00 00 00. Saisissez votre code secret Mobile Money pour valider. » + encadré (`margin-top:18px`, `#F2F6FD`, rayon 14, `14px 16px`) : anneau de chargement 22 px (piste `#D6DDEC`, arc `#0B18C9`, trait 3) + « En attente de votre confirmation… » 14/22 500 | « Annuler le paiement » (secondaire) · « Renvoyer la demande » (tertiaire) |
| `reussi` (boîte 480 px) | `#DDF3E4`/`#17663A`, coche | « Paiement confirmé » | « Votre formule Standard est active jusqu’au 14 novembre 2026. Un reçu vous a été envoyé par e-mail. » (idem Basique, Premium) | « Télécharger le reçu » (secondaire + icône) · « Aller à mon tableau de bord » (primaire) |
| `echoue` | `#FBE3E1`/`#B42318`, alerte ronde | « Le paiement n’a pas abouti » | « Aucun montant n’a été débité. Vérifiez votre solde Mobile Money ou essayez un autre opérateur. » | « Changer d’opérateur » (secondaire) · « Réessayer » (primaire) |

Comportement du prototype : « Payer » ouvre `attente`, puis passe seul à `reussi` (après 2,6 s) et à l’étape « confirmation ». Pas de compte à rebours dessiné (la spec en demande un : 3 min). Le texte d’échec unique est à décliner selon les motifs Payiz de la spec.

### 3.7 Téléphone (même page, fluide)
Pas d’artboard téléphone dédié : la page se replie (rangées `flex-wrap`, grilles `auto-fill` à 1 colonne, récapitulatif sous le formulaire, tableau en défilement horizontal). Le lien « Mon abonnement » du menu téléphone (NdMobMenu) pointe sur cette page bureau.

---

## 4. NdMobPaiement / NdMobPaiementAttente (téléphone)

**Cadre** 390 × 844, fond `#F2F6FD`, police Inter.

**En-tête** (`padding:12px 16px`, `gap:8px`) : bouton-icône « Retour » 48 × 48 rayon 14 `#E9EFFB` (flèche 20 px, → accueil) + titre « Paiement » 18/26 600 `#1D1D1F`. Pas de barre d’onglets en bas sur cet écran.

**Feuille de contenu** : blanc, `margin:0 8px`, rayon `28px 28px 0 0` ; zone défilante `padding:20px 16px` ; sections en colonne `gap:24px` ; titres de section h2 18/26 600.

1. **« Opérateur Mobile Money »** : 3 cartes-options **empilées** (`gap:10px`, `min-height:52px`), sans sous-titre : « MTN Mobile Money » (cochée), « Moov Money », « Celtiis Cash » (**à retirer**). Groupe `role="group" aria-label="Opérateur Mobile Money"`.
2. **Champ « Numéro Mobile Money »** (`type="tel"`, 48 px, valeur « 01 97 00 00 00 », lecture seule dans la maquette) ; aide 12/18 : « La demande de paiement sera envoyée à ce numéro. »
3. **« Récapitulatif »** : bloc `#F2F6FD`, `padding:16px`, rayon 16 : « Formule Standard · 1 mois » — « [PRIX] FCFA » (14/22) **[ANCIEN : « 1 mois »]** ; filet `#E3E8F3` `margin:12px 0` ; « Total à payer » — « [PRIX] FCFA » (16/24 600).
   - Pas de champ code promo ni de choix de formule sur cet écran (à ajouter pour le nouveau modèle).

**Pied fixe** (`padding:12px 16px`, filet haut `#EAEEF7`) : bouton grand primaire pleine largeur « Payer [PRIX] FCFA » → ouvre la feuille d’attente.

**Feuille d’attente (NdMobPaiementAttente)** — feuille du bas, pas un dialogue centré :
- Voile `rgba(29,29,31,.5)` ; feuille blanche `padding:12px 20px 24px`, rayon `28px 28px 0 0`, `role="dialog" aria-modal="true"`.
- Poignée 40 × 4 `#CED5E2` rayon 999, `margin:0 auto 18px`.
- h2 « Confirmez sur votre téléphone » 20/28 600 ; texte 14/22 `#667085` `margin-top:8px` : « Une demande de [PRIX] FCFA a été envoyée au 01 97 00 00 00. Saisissez votre code secret Mobile Money pour valider. »
- Encadré `margin-top:16px` : `#F2F6FD`, rayon 14, `14px 16px`, anneau 22 px + « En attente de votre confirmation… ».
- Boutons empilés pleine largeur (48 px, `gap:8px`, `margin-top:20px`) : **« Renvoyer la demande »** (tertiaire `#E9EFFB`) puis **« Annuler le paiement »** (secondaire). Ordre inverse du bureau.
- Pas d’état « réussi » ni « échoué » dessiné pour le téléphone : reprendre les textes du bureau (3.6) dans la même feuille.

---

## 5. Bandeau « Renouveler » et son dialogue

### 5.1 Bandeau (NdAccueil, en tête du contenu ; aussi vitrine NdCRetours)
- `role="status"`, rangée wrap `gap:12px`, `padding:14px 16px`, rayon 16, fond `#FBEFD0`.
- Icône triangle d’alerte 22 px `#8A5A00`.
- Texte 14/22 `#1D1D1F` (`flex:1 1 240px`) : **« Votre formule Standard expire dans 5 jours. »** (gras 600) + « Renouvelez pour garder l’accès à vos formations. Rien ne sera supprimé. »
- Bouton petit secondaire « Renouveler » (34 px, rayon 10, 13 px) → ouvre le dialogue.
- La spec l’affiche **sur un abonnement expiré** : texte à adapter (« Votre abonnement Standard a expiré le … » par exemple) ; la variante « expire dans N jours » relève des rappels (lot 5 B).

### 5.2 Dialogue « renouveler » (NdAccueilRenouvellement ; vitrine « Rappel de renouvellement »)
- Boîte 440 px ; tuile 48 × 48 `#FBEFD0`/`#8A5A00` (alerte).
- Titre : « Votre formule Standard expire dans 5 jours »
- Texte : « Renouvelez pour garder l’accès à vos formations. Rien ne sera supprimé si vous attendez. »
- Actions : « Plus tard » (secondaire, ferme) · « Renouveler » (primaire, lien vers « Mon abonnement »).

### 5.3 Téléphone (NdMobAccueil)
- Sous « Bonjour, Aïcha » (h1 28/36) : même bandeau, mais `flex-wrap:nowrap`, `gap:10px`, `padding:12px 12px 12px 14px`, texte seul « Votre formule Standard expire dans 5 jours. » (sans la 2e phrase).
- Bouton « Renouveler » secondaire hauteur **44**, `flex:none`, lien direct vers **NdMobPaiement** (pas de dialogue).

### 5.4 Notifications
- Liste déroulante (bureau) et NdMobNotifications : « Abonnement bientôt expiré » / « Votre formule Standard expire dans 5 jours. » / « Hier » ; tuile 44 × 44 rayon 13 `#FBEFD0`/`#8A5A00`, triangle d’alerte. Sur téléphone, l’élément mène à NdMobPaiement.
- NdProfil : interrupteur « Expiration et renouvellement » — « Rappels avant la fin de votre abonnement » (rappels : lot 5 B).

---

## 6. Accueil public (NdLanding)

### 6.1 Étapes « Comment ça marche »
« 02 » — « Choisissez votre formule » — « Basique, Standard ou Premium : 1, 2 ou tous les parcours. Paiement par Mobile Money. » **[ANCIEN : « 1, 2 ou tous les parcours »]**

### 6.2 Section « Formules » (transparente, centrée)
- Pastille « Formules » (blanc/`#0B18C9`), H2 « Un abonnement mensuel, sans prélèvement automatique » **[ANCIEN : « mensuel »]**, texte 17/27 `#535E75` « Vous renouvelez quand vous voulez. Vos formations et vos certificats restent sur votre compte. »
- Mêmes cartes que NdTarifs (`margin-top:40px`), listes réduites à 3 lignes, bouton « Voir le détail » (→ Tarifs) :
  - Basique : « 1 parcours au choix » **[ANCIEN]** · « Quiz, exercices et certificats » · « Communauté du parcours » **[ANCIEN]**
  - Standard (« Recommandée ») : « 2 parcours au choix » **[ANCIEN]** · « Sessions live et exercices corrigés » · « Plus de formations complémentaires » **[ANCIEN]**
  - Premium : « Tous les parcours » · « Accompagnement renforcé » · « Fonctionnalités Premium »
  - « [PRIX] » + « FCFA / mois » **[ANCIEN]**. Spec : prix du back-office, sinon « Prix annoncés au lancement ».

### 6.3 FAQ « Tout ce qu’il faut savoir avant de commencer »
- « Le compte gratuit est-il vraiment gratuit ? » → « Oui. Il donne accès aux formations gratuites, au catalogue, à votre progression, à vos certificats et à la communauté générale en lecture. Vous choisissez une formule payante seulement si vous le souhaitez. »
- « Comment payer mon abonnement ? » → « Par Mobile Money, depuis votre téléphone. Votre accès est activé automatiquement dès que le paiement est confirmé. »
- « Le renouvellement est-il automatique ? » → « Non. Vous recevez des rappels avant l’expiration et vous renouvelez quand vous le décidez. Aucun prélèvement automatique. »
- « Puis-je changer de parcours ? » → « Vos parcours restent les mêmes pendant la période d’abonnement. À chaque renouvellement, vous pouvez en choisir de nouveaux. » **[ANCIEN]**
- « Que se passe-t-il quand mon abonnement expire ? » → « Vos formations sont verrouillées mais rien n’est supprimé : votre progression, vos formations complémentaires et vos certificats restent sur votre compte. Tout redevient accessible dès que vous renouvelez. » (**[ANCIEN]** : « vos formations complémentaires »)
- Mêmes questions dans NdAide (catégorie « Paiement et abonnement », plus « Puis-je passer à une formule supérieure en cours de mois ? », « Et pour une formule inférieure ? », « Qu’est-ce qu’une formation complémentaire ? » **[ANCIEN]**). Le formulaire de contact de l’aide a le sujet « Paiement et abonnement ».

---

## 7. Fiche formation publique (NdFormationPublic) — carte d’accès

Carte blanche `padding:26px`, rayon 24, ombre `0 22px 56px rgba(4,10,80,.3)`, posée sur le bandeau bleu :
- « Incluse dans le parcours » (12/18 `#667085`) **[ANCIEN]**, h3 « Réussite académique » (18/26 600), « Avec les formules Basique, Standard et Premium. » (14/22, `margin-top:4px`).
- Bouton grand primaire pleine largeur « Créer mon compte gratuit » (`margin-top:18px`).
- Filet `margin:16px 0` ; « Disponible aussi seule, en formation complémentaire : [PRIX] FCFA, payée une fois. » (13/20) **[ANCIEN]** ; lien « Voir les formules » (14/22 500 `#0B18C9`, → Tarifs).
- Nouveau modèle : « Incluse dans tous les abonnements » + « Voir les abonnements ».

---

## 8. Back-office

### 8.1 NdAdminPaiements (« Paiements »)
- H1 « Paiements » ; texte « Paiements Mobile Money des formules et des formations complémentaires. » **[ANCIEN : « formations complémentaires »]**
- 4 cartes chiffres (grille `auto-fill` min 228 px, `gap:20px` ; carte `padding:18px 19px 16px`, rayon 16 ; tuile 40 × 40 rayon 12 ; libellé 14/20 `#667085` ; valeur 28/36 500, `margin-top:14px` ; sous-libellé 12/18) :
  - « Revenus du mois » `#FBEFD0`/`#8A5A00` — « [PRIX] » / « FCFA »
  - « Paiements réussis » `#DDF3E4`/`#17663A` — « [NOMBRE] » / « Ce mois »
  - « Paiements échoués » `#FBE3E1`/`#B42318` — « [NOMBRE] » / « Ce mois »
  - « Remboursements » `#DDE1FF`/`#0B18C9` — « [NOMBRE] » / « Ce mois »
- Filtres (`role="group" aria-label="Filtrer les paiements"`, boutons 42 px rayon 12, `0 15px 1px`) : « Tous », « Réussis », « Échoués », « Remboursés ». Choisi : fond `#EEF0FF`, bordure `#C2C8FF`, texte `#0B18C9` ; sinon blanc / `#E3E8F3` / `#232326`.
- Tableau (`min-width:900px`) : « Date » | « Étudiant » | « Objet » | « Opérateur » | « Montant » | « Statut » | « Actions ». Objet sur 2 lignes (« Formule Standard » + « 1 mois » 12/18 `#667085` **[ANCIEN]**). Statuts : « Réussi », « En attente » (neutre), « Échoué », « Remboursé » (info). Action : « Rembourser » (petit secondaire) sur les réussis. Exemples : « Aujourd’hui 09:42 » Aïcha Kpadé / Standard / MTN ; « Aujourd’hui 09:15 » Gildas Tossou / Premium / Moov / En attente ; « Hier 18:03 » Marcelline Zinsou / Basique / Celtiis / Échoué ; « 02/09/2026 » « Marketing digital » / « Formation complémentaire » **[ANCIEN]** ; « 21/08/2026 » Sènami Dossou / Basique / Remboursé.
- Pagination : « 7 sur [NOMBRE] paiements » + boutons 34 × 34 « Page précédente » / « 1 2 3 » / « Page suivante ».
- **Manque par rapport à la spec :** onglets « Abonnements » (prix, durée, recommandé, actif) et « Codes promo », recherche par compte ou numéro de reçu, détail d’un paiement, réglage « Paiements activés ».

### 8.2 NdAdminRemboursement (dialogue + toast)
- Tuile `#DDE1FF`/`#0B18C9` ; « Rembourser ce paiement ? » ; « [PRIX] FCFA seront renvoyés sur le compte MTN Mobile Money de l’étudiante. Son accès à la formule Standard sera retiré. » ; « Annuler » · « Rembourser » (primaire).
- Toast : « Remboursement envoyé » / « [PRIX] FCFA renvoyés sur le compte MTN Mobile Money de l’étudiante. »
- Le remboursement n’est pas dans la spec du lot 2.

### 8.3 Autres blocs admin
- NdAdmin (vue d’ensemble) : graphique « Abonnements actifs par mois » (« Nouveaux » / « Renouvellements », mai → oct.) ; « Formules les plus choisies » : Standard 52 %, Basique 31 %, Premium 17 % (barres `role="progressbar"`) ; « À traiter » : « Paiement échoué » (« Marcelline Zinsou · Basique · Celtiis Cash · hier 18:03 »), « Paiement en attente », « Abonnement bientôt expiré » (« Fifamè Agossou · Basique · expire dans 3 jours »). Navigation admin : « Paiements », « Formules ».
- NdAdminUtilisateurs : colonne « Formule » et action de menu « Changer de formule ».

---

## 9. Vitrine des composants (rappels utiles)

- **NdCModales**, groupe « Abonnement et paiement » : les cinq dialogues « Changement de formule », « Rappel de renouvellement », « Paiement en attente de confirmation », « Paiement réussi », « Paiement échoué » (textes identiques à 3.6 et 5.2), plus « Rembourser ce paiement ? ».
- **NdCRetours** : bandeaux `role="status"` (`14px 16px`, rayon 16) : alerte « Renouveler » (5.1) ; info `#DDE1FF` « Formations complémentaires : **1 sur 2** utilisées avec votre formule Standard. » + lien « Voir ma formule » **[ANCIEN]** ; erreur `#FBE3E1` « **Le paiement n’a pas abouti.** Aucun montant n’a été débité. Vérifiez votre solde Mobile Money. » + bouton petit « Réessayer ».
- **NdCFormulaires** : erreur sur le numéro (valeur « 01 97 00 ») : « Entrez un numéro à 10 chiffres. » ; radios natifs « MTN Mobile Money », « Moov Money », « Celtiis Cash » ; « Choix en cartes » sur 3 colonnes (`repeat(3, minmax(0,1fr))`, `gap:16px`) : « Basique » / « 1 parcours au choix », « Standard » / « 2 parcours au choix » (cochée), « Premium » / « Tous les parcours », chacun « [PRIX] FCFA » **[ANCIEN]**.
- **NdCBoutons** : bouton en chargement « Paiement en cours… » (primaire 42 px, anneau 18 px `aria-label="Chargement"`) ; « Télécharger le reçu ».
- **NdCCartes** : tableau d’historique (3.5) avec pagination « 3 paiements ».

---

## 10. Autres écrans touchés

- **NdParcours** : sous-titre « Formule Standard : 2 parcours actifs jusqu’au 14 octobre 2026. » + bouton « Changer de formule » ; onglet d’un parcours non inclus : « Non inclus dans la formule Standard », état vide (tuile 56 × 56 rayon 16 `#E9EFFB`, titre 18/26 600 « Ce parcours n’est pas inclus dans votre formule », texte « Passez à la formule Premium pour accéder à tous les parcours, ou choisissez-le à votre prochain renouvellement. », bouton primaire « Passer à Premium »). **[ANCIEN en entier]** ; la spec remplace par un verrou « Voir les abonnements » quand il n’y a pas d’abonnement actif.
- **NdMobMenu** : sous le nom « Étudiante · Standard » (spec : formule réelle).
- **Catalogue** : badge info « Complémentaire » sur certaines cartes ; NdCataloguePublic : filtre « Incluses dans un abonnement ».

---

## 11. Adaptation au nouveau modèle — synthèse

| Élément du design | Ancien modèle | À faire (nouveau modèle) |
|---|---|---|
| Sous-titres « Un abonnement mensuel… » (Tarifs, Mon abonnement, Landing) | mensuel | Durées 3 / 6 / 12 mois ; garder « Pas de prélèvement automatique : vous renouvelez quand vous le décidez. » |
| Prix « FCFA / mois », « / mois », « 1 mois » (cartes, options, récapitulatifs, historique, admin) | par mois | Prix de la durée : « FCFA · 3 mois », « 6 mois », « 1 an » ; objet « Standard · 6 mois » |
| Puces « 1 / 2 parcours au choix », « Tous les parcours » | accès par parcours | Puce de durée (« 3 mois », « 6 mois », « 1 an ») ; listes : « Toutes les formations », etc. |
| « Recommandée » sur Standard | idem | À garder (Standard recommandé) |
| Tableau « Comparer les formules » | différences d’accès | À remplacer (durée, prix, équivalent par mois) ou retirer |
| Étape 2 « Parcours » et sa pastille dans les étapes | choix de parcours | Supprimer : étapes « Abonnement » · « Paiement » · « Confirmation » |
| « Passer à Premium », dialogue prorata, badge « Changement immédiat au prorata », aides et FAQ sur supérieure/inférieure | changement au prorata | Retirer ; « S’abonner » / « Prolonger » (la durée s’ajoute à la fin de l’abonnement en cours) |
| « Formations complémentaires » (cartes, tableau, FAQ, historique, admin, NdCRetours, fiche publique) | achat à l’unité | Retirer |
| Opérateurs MTN / Moov / Celtiis | 3 opérateurs | MTN et Moov seulement, proposés d’après le numéro (Payiz) |
| Code promo (bureau seulement) | dessiné | À garder ; ajouter un état d’erreur (code expiré/invalide) et le champ sur téléphone |
| Récapitulatif « Formule Standard · 1 mois · renouvellement manuel », ligne « Parcours » | — | Abonnement, durée, dates de début et de fin calculées, prix, remise, total |
| Dialogue / feuille d’attente | renvoi, annulation | Garder ; numéro masqué, compte à rebours 3 min (spec) |
| « Le paiement n’a pas abouti » (texte unique) | — | Décliner selon les motifs Payiz (spec §6) ; « Réessayer » ; « Changer d’opérateur » → « Changer de numéro » |
| « Paiement confirmé… Vos parcours : … » | parcours | « Votre abonnement Standard est actif jusqu’au … » ; « Commencer » + « Voir le reçu » |
| « Télécharger le reçu » / « Reçus disponibles au format PDF » | PDF | Page de reçu imprimable (aucun écran dans le design) |
| Bandeau « Renouveler » | « expire dans 5 jours » | Affiché sur abonnement expiré (spec) ; rappels avant expiration : lot 5 B |
| NdTarifs : note « Les prix… se règlent dans le back-office. » | note de conception | Ne pas afficher au public |
| Back-office Paiements | sans réglages | Ajouter onglets « Abonnements » et « Codes promo », recherche, détail, « Paiements activés » |
