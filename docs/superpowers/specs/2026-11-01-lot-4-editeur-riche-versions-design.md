# Lot 4, fin : éditeur riche, brouillons et historique des versions — spec

- **Origine :** tâches 4.2 (éditeur riche, sauvegarde automatique, indicateur « Enregistré ») et 4.4 (historique des versions et restauration) de la feuille de route. L'utilisateur a choisi « Éditeur riche et versions » le 1er novembre 2026.
- **Décisions de l'utilisateur (1er novembre 2026) :**
  - Q1, sauvegarde d'une leçon en ligne : **brouillon, puis « Publier les modifications »** ;
  - Q2, quand une version naît : **à chaque publication** ;
  - Q3, restauration : **dans le brouillon**, par l'équipe et par le formateur de la formation ;
  - partie 1 (éditeur et affichage) et partie 2 (brouillon, sauvegarde, publication) validées (« Vas y ») ;
  - partie 3 : « Vas y avec les recommandations et fais tout le travail ».
- **Sources :**
  - cahier des charges §11 (éditeur pédagogique : titres, sous-titres, texte enrichi, listes, images, tableaux, liens, blocs d'information, éléments multimédias ; sauvegarde automatique en temps réel ; indicateur d'état) et §12 (historique : version, date, auteur ; restauration par un utilisateur autorisé) ;
  - design NdEditeur : « Enregistrer le brouillon », « Publier », « Version 7 · aujourd'hui », message « Brouillon enregistré ». La barre d'outils de l'éditeur et l'écran d'historique n'y sont pas : ils se composent avec les planches NdCBoutons, NdCMenus, NdCModales et NdCRetours.
- **Prochaine migration :** 0055. Ce lot prend **0055, 0056 et 0057**.

## 1. Le contenu riche (étape A, migration 0055)

### 1.1 Le format

- **Le contenu d'une leçon devient un document structuré** (le format JSON de l'éditeur, une arborescence de blocs), gardé dans une nouvelle colonne `lecons_contenus.document` (jsonb).
- **Une liste fermée de blocs et de marques**, vérifiée par le serveur à chaque enregistrement (schéma zod récursif) ; un bloc inconnu est refusé :
  - blocs : paragraphe, titre (niveau 2 « Titre », niveau 3 « Sous-titre »), liste à puces, liste numérotée, élément de liste, citation, bloc d'information, image, tableau (ligne, cellule d'en-tête, cellule), vidéo, séparateur ;
  - marques : gras, italique, souligné, barré, lien (http et https seulement).
- **L'affichage ne fabrique que ces éléments** : aucun HTML n'est injecté, comme pour la communauté. Un bloc inconnu (document ancien ou abîmé) est ignoré.
- **Limites :** 20 000 caractères de texte (comme aujourd'hui) et 300 Ko de document ; 40 images et 10 tableaux par leçon au plus.
- **La colonne `texte` reste** : elle reçoit le texte brut du document (sans mise en forme), pour la limite de longueur et une future recherche.
- **Les leçons existantes** (Markdown restreint dans `texte`, `document` vide) s'affichent comme avant. À la première ouverture dans l'éditeur, leur texte est converti en document (les titres de niveau 1 deviennent des titres de niveau 2) ; il est gardé au premier enregistrement.

### 1.2 L'éditeur

- **Une barre d'outils** au-dessus du texte, qui reste visible quand on écrit et qui défile à l'horizontale sur téléphone :
  - style du paragraphe : Texte, Titre, Sous-titre ;
  - gras, italique, souligné, barré, lien ;
  - liste à puces, liste numérotée, citation ;
  - bloc d'information, image, tableau, vidéo, séparateur ;
  - annuler, rétablir.
- **Bloc d'information :** quatre tons de la charte, que l'on change par un menu sur le bloc : Information (bleu), Astuce (vert), Attention (orange), À retenir (violet, ton premium). Il contient des paragraphes et des listes.
- **Image :**
  - envoyée depuis l'appareil (bouton de la barre, ou glisser-déposer, ou coller) : JPEG, PNG ou WebP, **5 Mo** au plus ;
  - texte alternatif facultatif (pour les lecteurs d'écran) et légende facultative ;
  - rangée dans un **espace privé `images_lecons`**, dossier de la formation (`{formation}/{uuid}.{ext}`). L'équipe et le formateur de la formation y déposent ; la lecture passe par des liens signés d'une heure, créés pour qui a accès à au moins une leçon de la formation ;
  - une image n'est jamais effacée automatiquement : une version de l'historique peut encore s'en servir.
- **Tableau :** inséré en 3 × 3 avec une ligne d'en-tête ; un menu sur le tableau ajoute ou retire une ligne ou une colonne, et supprime le tableau. Les cellules contiennent du texte avec marques (pas d'image ni de tableau dans un tableau).
- **Vidéo intégrée :** on colle un lien des plateformes déjà acceptées (YouTube, Vimeo, TikTok, Tella, Loom, ScreenPal, Google Drive) ; elle s'affiche avec le lecteur officiel. Elle ne compte pas dans la progression (seule la vidéo principale de la leçon compte).
- **Où :** le contenu des leçons et la consigne des exercices. La communauté garde son éditeur ; la description d'une formation reste un texte simple.

### 1.3 L'affichage côté étudiant

- **Page leçon et consigne d'exercice :** les blocs avec la charte.
  - Titres en `h2` et `h3` de la page (taille de section et de sous-section de NdCFondations).
  - Blocs d'information : fond et texte de l'état correspondant (info, réussite, attention, premium), icône Hugeicons.
  - Images à pleine largeur de la colonne de texte, arrondi de carte, légende en texte discret.
  - Tableaux : bordures fines, en-tête sur fond pâle ; défilement horizontal sur téléphone, sans élargir la page.
- **Mode lecture** (page leçon) : mêmes blocs.
- **La fonction `exercice_etudiant`** renvoie aussi le document de la consigne.

## 2. Brouillons et sauvegarde automatique (étape B, migration 0056)

### 2.1 La sauvegarde automatique

- **Plus de bouton « Enregistrer »** pour le contenu : l'éditeur enregistre **1,5 seconde après la dernière modification**, quand un champ perd le focus, et en quittant la page.
- **Un indicateur** dans la barre du haut de l'éditeur, annoncé aux lecteurs d'écran (`role="status"`) :
  - « Modifications non enregistrées » ;
  - « Enregistrement… » ;
  - « Brouillon enregistré à 14 h 32 » (brouillon) ou « Enregistré à 14 h 32 » (leçon pas encore en ligne) ;
  - « Hors ligne : vos modifications sont gardées sur cet appareil » ;
  - « Échec de l'enregistrement. Nouvel essai… » (l'éditeur réessaie après 2, 5, puis 15 secondes).
- **Copie de secours sur l'appareil** (stockage du navigateur) jusqu'à ce que le serveur confirme. À la réouverture, si la copie de l'appareil est plus récente que ce qui est enregistré : bandeau « Des modifications de cet appareil n'ont pas été enregistrées. Récupérer / Ignorer ».
- **Quitter la page** : si une sauvegarde est en cours ou en échec, le navigateur demande confirmation ; sinon on part librement (fini « Quitter sans enregistrer ? »).
- **Deux personnes sur la même leçon** : chaque sauvegarde donne la révision qu'elle a vue. Si quelqu'un a enregistré entre-temps, la sauvegarde est refusée, sans rien écraser : bandeau « Cette leçon vient d'être modifiée par Aïcha Kpadé. Rechargez pour voir sa version. » (la copie de l'appareil garde le travail en cours).

### 2.2 Ce qui passe par le brouillon

- **Une leçon** passe par le brouillon quand elle est visible des étudiants (formation publiée et leçon publiée), ou quand elle a déjà un brouillon. Sinon, elle s'enregistre directement.
  - Champs du brouillon : titre, titre court, résumé, points clés, vidéo (fournisseur et identifiant), durée, document.
- **Les informations générales d'une formation** passent par le brouillon quand la formation est publiée (ou qu'un brouillon existe) :
  - champs : titre, résumé, description, objectifs, compétences, niveau ;
  - l'onglet « Informations » se sépare en deux cartes : « Informations générales » (sauvegarde automatique, brouillon) et « Réglages » (adresse, formateur, badge, seuil vidéo, score des quiz, certification, parcours, monétisation, gratuite : bouton « Enregistrer », effet immédiat, comme aujourd'hui).
- **Restent comme aujourd'hui** (bouton dédié, effet immédiat) :
  - ajouter, supprimer, réordonner des modules et des leçons ; publier ou dépublier une leçon ;
  - les réglages d'une leçon : commentaires, aperçu gratuit, genre d'exercice (enregistrés automatiquement, sans brouillon) ;
  - les questions d'un quiz : bouton « Enregistrer les questions » ;
  - les fichiers à télécharger ; l'image de couverture.

### 2.3 Publier ou abandonner

- **« Publier les modifications »** : un seul bouton par formation, dans la barre de l'éditeur de leçon, dans l'onglet « Publication » et en haut de l'éditeur de formation, visible dès qu'un brouillon existe.
  - Une fenêtre liste ce qui part (« Informations générales », « Leçon 3 : Importer des données »), avec qui l'a modifié et quand.
  - Un clic applique tous les brouillons de la formation d'un coup, efface les brouillons et crée une version (§3).
  - Message : « Modifications publiées : version 8. »
- **« Abandonner les modifications »** : remet à l'identique de ce qui est en ligne. Dans l'éditeur de leçon, il ne concerne que cette leçon ; dans l'onglet « Publication », toute la formation. Fenêtre de confirmation (ton danger).
- **Repères :**
  - liste des leçons : étiquette « Modifiée, non publiée » ;
  - onglet « Informations » : « Modifications non publiées » ;
  - liste des formations du back-office et de l'espace formateur : « Modifications non publiées ».
- **L'aperçu** (page leçon, fiche de la formation) montre le brouillon à l'équipe et au formateur de la formation, avec l'étiquette « Brouillon » ; les étudiants voient ce qui est en ligne.
- **Qui publie :**
  - l'équipe, toujours ;
  - le formateur de la formation, sur une formation déjà en ligne ; l'équipe voit alors « Modifiée par le formateur le … » ;
  - avant la première mise en ligne, rien ne change : envoi en relecture, publication par l'équipe.

### 2.4 Côté base

- Tables fermées (lecture par l'équipe et le formateur de la formation, écriture par fonctions seulement) :
  - `brouillons_lecons` (leçon, données, révision, modifié par, modifié le) ;
  - `brouillons_formations` (formation, données, révision, modifié par, modifié le).
- Colonne `revision` (entier) sur `lecons` et `formations`, augmentée à chaque enregistrement direct et à chaque publication.
- Fonctions (security definer, droits vérifiés : `equipe_contenus()` ou `formateur_de(formation)`, compte non suspendu) :
  - `edition_lecon(lecon)` et `edition_formation(formation)` : ce que l'éditeur affiche (brouillon s'il existe, sinon l'en ligne), la révision, le mode ;
  - `enregistrer_lecon(lecon, donnees, revision)` et `enregistrer_infos_formation(formation, donnees, revision)` : brouillon ou direct selon §2.2 ; refus `conflit` si la révision ne correspond pas ;
  - `modifications_en_attente(formation)` ; `publier_modifications(formation)` ; `abandonner_modifications(formation, lecon)` (leçon facultative).
- Un formateur qui enregistre directement une formation déjà en ligne, ou qui publie, garde la date « Modifiée par le formateur le … ».

## 3. Historique des versions (étape C, migration 0057)

### 3.1 Quand une version naît

- **À la mise en ligne de la formation** (première publication, et republication après archivage) : « Mise en ligne ».
- **À chaque « Publier les modifications »** : « Informations générales et 2 leçons modifiées ».
- **Quand une leçon est publiée ou retirée** sur une formation en ligne : « Leçon « Importer des données » mise en ligne » / « retirée ».
- **Numérotées** à partir de 1 par formation. Le numéro courant s'affiche dans l'onglet « Publication » : « Version 8 · aujourd'hui » (comme NdEditeur).

### 3.2 Ce qu'une version garde

- **Un instantané de la formation** au moment de la publication :
  - informations générales ;
  - modules (titre, ordre) ;
  - leçons : titre, titre court, type, ordre, publiée ou non, résumé, points clés, vidéo, durée, document (ou texte ancien).
- **Ne sont pas versionnés :** les questions des quiz, les fichiers à télécharger, l'image de couverture, les réglages de l'équipe.
- **Auteur :** le compte qui a publié ; « Compte supprimé » si le compte n'existe plus. Toutes les versions sont gardées.

### 3.3 L'onglet « Historique »

- **Nouvel onglet** de l'éditeur de formation, au back-office et dans l'espace formateur, visible dès la première version.
- **Liste**, la plus récente en premier : « Version 8 », date et heure, auteur, résumé ; la version en ligne porte l'étiquette « En ligne ».
- **« Restaurer dans le brouillon »** sur chaque version ancienne, avec une fenêtre : « Le contenu de la version 5 revient dans le brouillon. Les étudiants ne verront rien changer avant « Publier les modifications ». »

### 3.4 La restauration

- **Fonction `restaurer_version(version)`**, mêmes droits que la modification :
  - informations générales : dans le brouillon de la formation (ou directement si elle n'est pas en ligne) ;
  - chaque leçon encore présente : son contenu de la version dans son brouillon (ou directement si elle n'est pas visible) ;
  - une leçon supprimée depuis : recréée **non publiée** dans son module (le module est recréé s'il n'existe plus), sans progression d'étudiant ; un quiz recréé revient sans ses questions ;
  - une leçon ajoutée depuis : inchangée ;
  - l'ordre des modules et des leçons n'est pas modifié.
- **Message :** « Version 5 restaurée dans le brouillon : 3 leçons modifiées, 1 leçon recréée (non publiée). Relisez, puis publiez. »

## 4. Hors champ

- Comparer deux versions côte à côte ; restaurer une seule leçon d'une version.
- Écriture à plusieurs en même temps (curseurs partagés) : le refus de conflit suffit.
- Effacement des images qui ne servent plus.
- Éditeur riche pour la description des formations ou pour la communauté.

## 5. Ce qui te revient

1. Appliquer les migrations **0055**, **0056** et **0057**, dans l'ordre.
2. Tester sur une formation de test :
   - écrire une leçon avec titres, liste, image, tableau, bloc d'information et vidéo ; fermer l'onglet en pleine saisie, rouvrir : rien n'est perdu ;
   - sur une formation en ligne : modifier une leçon, vérifier qu'un compte étudiant voit l'ancienne version, publier, vérifier qu'il voit la nouvelle ;
   - ouvrir l'onglet « Historique », restaurer une version, publier.

## 6. Tests

- **Base (banc PGlite) :**
  - droits (étudiant refusé, formateur d'une autre formation refusé, compte suspendu refusé) ;
  - brouillon ou direct selon la visibilité ; conflit de révision ;
  - publication (champs appliqués, brouillons effacés, version créée, date « Modifiée par le formateur ») ; abandon ;
  - versions à la mise en ligne et à la publication d'une leçon ;
  - restauration (brouillon, direct, leçon recréée non publiée, quiz sans questions) ;
  - lecture des images : un étudiant sans accès à la formation ne lit pas `images_lecons`.
- **Application :**
  - validation du document (blocs refusés, liens non http, limites) ;
  - conversion du Markdown ancien ; texte brut tiré du document ;
  - rendu de chaque bloc (et un bloc inconnu ignoré) ;
  - sauvegarde automatique : délai, file d'attente, nouvel essai, hors ligne, copie de l'appareil et récupération, conflit ;
  - fenêtres de publication et d'abandon ; onglet Historique et restauration.

## Découpage et ordre

1. **Étape A : le contenu riche** (0055). Format, éditeur, images, affichage. L'enregistrement reste au clic à la fin de l'étape.
2. **Étape B : brouillons et sauvegarde automatique** (0056). Elle remplace le clic par la sauvegarde automatique.
3. **Étape C : historique des versions** (0057).
