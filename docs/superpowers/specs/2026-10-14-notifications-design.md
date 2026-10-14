# Centre de notifications — spec

- **Date :** 14 octobre 2026
- **Statut :** design validé en conversation le 14 octobre 2026 ; à relire avant le plan.
- **Origine :** lot 5, première partie. Le lot est découpé en parties, chacune avec sa spec : Notifications, puis Événements et sessions live, Communauté, Modération, Messages, et enfin les notifications push, les e-mails et la désactivation d'une formation.
- **Feuille de route :** tâche 5.6, partie « centre de notifications et préférences par catégorie ». Le push PWA et les e-mails viendront plus tard.
- **Design de référence :**
  - `NdNotifications` (page) : Toutes et Non lues, « Tout marquer comme lu », « Préférences », un groupe par jour, « Vous êtes à jour » ;
  - `NdNotificationsOuvertes` (panneau de la cloche) : « Voir toutes les notifications ».
  - Le panneau et la cloche existent déjà : `components/ui/NotificationsPanel.tsx`. L'onglet Notifications du profil aussi : 8 catégories et 2 canaux, dans `profils.preferences_notifications`.
- **Règle provisoire avant le lot 2**, décidée pour tout le lot 5 : un étudiant « suit » un parcours ou une formation dès qu'il en a ouvert une leçon.

## 1. Ce qui est décidé

| Question | Décision |
|---|---|
| Ce qui envoie une notification | Toutes les actions de la plateforme qui le méritent aujourd'hui (§2) ; les parties suivantes ajouteront les leurs |
| Avis masqué | **Aucune notification** ; l'auteur ne doit pas savoir que son avis est masqué (§5) |
| Catégorie désactivée dans le profil | Plus aucune notification de cette catégorie |
| Notifications du compte et du travail (formateur, équipe) | Toujours envoyées (« service ») |
| « Notifications dans l’appli » désactivé | Plus rien ne s'affiche, service compris |
| Qui fait l'action | N'est jamais notifié de sa propre action |
| Compteur de la cloche | Mis à jour à chaque page ; pas de temps réel (il viendra avec les Messages) |
| Conservation | 6 mois |
| Annonces | Une rubrique du back-office ; l'annonce va à tous les comptes |

## 2. Ce qui envoie une notification

| Événement | Pour qui | Catégorie | Titre · texte · lien |
|---|---|---|---|
| Première publication d'une formation | Étudiants qui suivent l'un de ses parcours | Nouveaux contenus | « Nouvelle formation : <titre> » · « Dans le parcours <nom court>. » · la fiche |
| Le même événement | Le formateur de la formation (compte relié à sa fiche) | service | « Votre formation est en ligne » · « <titre> » · son éditeur, dans l'espace formateur |
| Une leçon ajoutée à une formation publiée | Étudiants qui suivent la formation | Nouveaux contenus | « Nouvelle leçon dans <formation> » · « <leçon> » · la leçon |
| Une formation archivée | Étudiants qui la suivent | service | « Formation archivée » · « <titre> n’est plus disponible. Votre progression est conservée. » · Mes formations |
| Une formation renvoyée au formateur | Son formateur | service | « Votre formation est à corriger » · le début de la remarque (120 caractères) · son onglet Publication |
| Une formation envoyée en relecture | L'équipe (admin, modérateur, super admin) | service | « Formation à valider » · « <titre>, par <fiche formateur> » · son onglet Publication au back-office |
| Un nouvel avis (pas une modification) | Le formateur de la formation | service | « Nouvel avis sur <titre> » · « <prénom N.> : 4/5 » · la fiche |
| Le rôle Formateur donné | Le compte | service | « Vous êtes formateur » · « Créez et suivez vos formations depuis l’espace formateur. » · `/formateur` |
| Un rôle d'équipe donné (modérateur, admin, super admin) | Le compte | service | « Vous faites partie de l’équipe » · « Le back-office vous est ouvert. » · `/admin` |
| Un compte réactivé | Le compte | service | « Votre compte est réactivé » · « Vous retrouvez tous vos accès. » · `/accueil` |
| Une annonce de l'équipe | Tous les comptes | Annonces | son titre · son texte · son lien (facultatif) |

Republier une formation archivée n'envoie pas de nouvelle annonce de formation.

## 3. La cloche et la page

**La cloche** (en-tête de tous les espaces) :
- le nombre de non lues (« Notifications, 3 non lues » pour les lecteurs d'écran) et les 8 plus récentes ;
- « Tout marquer comme lu » et « Voir toutes les notifications » ;
- une notification cliquée est marquée lue et mène à son lien ;
- sans notification : « Vous êtes à jour ».

**La page Notifications** (`/notifications`, design `NdNotifications`) :
- en-tête « Notifications », avec « Corrections, sessions live, abonnement et communauté. » ;
- filtres « Toutes » et « Non lues » ; « Tout marquer comme lu » ; « Préférences » (onglet Notifications du profil) ;
- groupes « Aujourd’hui », « Hier », puis la date (« 12 oct. 2026 »), à l'heure du Bénin ;
- l'heure relative : « Il y a 5 min », « Il y a 2 h », puis l'heure du jour ;
- 20 notifications, puis « Voir plus » ;
- une notification non lue est marquée d'un point, comme dans le panneau ;
- sans notification : « Vous êtes à jour » et « Aucune notification non lue. Les prochaines apparaîtront ici. »
- Icône et couleur selon la catégorie : nouveaux contenus en bleu, annonces en violet, service en gris, comme le panneau du design.

**Au back-office, rubrique « Annonces »** (`/admin/annonces`, groupe Plateforme du menu) :
- un formulaire : titre (80 caractères au plus), texte (300 au plus), lien facultatif (une adresse du site, commençant par `/`) ;
- **Envoyer l’annonce**, avec une confirmation (« Envoyer cette annonce à tous les comptes ? ») ;
- puis la liste des annonces envoyées : date, auteur, titre, et le nombre de destinataires.

## 4. Base de données (migration 0016)

- **Table `notifications`** :
  - colonnes : destinataire, catégorie (une des 8 du profil, ou `service`), titre, texte, lien, date de création, date de lecture ;
  - chacun lit et marque lues les siennes, et rien d'autre ;
  - aucune écriture directe : seule la base crée les notifications ;
  - règle restrictive « compte suspendu : rien » (0013).
- **Fonction interne `notifier(destinataires, catégorie, titre, texte, lien)`** :
  - aucun droit d'exécution pour les comptes ; appelée par les déclencheurs et les fonctions ci-dessous ;
  - applique le §1 : préférences, canal « dans l'appli », pas l'auteur de l'action ;
  - efface au passage les notifications de plus de 6 mois de ces destinataires.
- **Déclencheurs et fonctions modifiés**, chacun appelle `notifier` pour son événement du §2 :
  - publication, archivage et nouvelle leçon : déclencheurs sur les formations et les leçons ;
  - relecture : `envoyer_en_relecture`, `renvoyer_au_formateur` ;
  - nouvel avis : déclencheur sur les avis ;
  - rôles et réactivation : `changer_roles`, `reactiver_compte`.
- **Fonctions des comptes** :
  - `mes_notifications(non_lues_seulement, avant, nombre)` ;
  - `nombre_non_lues()` ;
  - `marquer_lues(identifiants ou toutes)`.
- **Annonces** :
  - une table `annonces` : titre, texte, lien, auteur, date, nombre de destinataires ;
  - `publier_annonce(titre, texte, lien)`, réservée à l'équipe, qui crée l'annonce et la notifie à tous les comptes ;
  - la liste des annonces, lisible par l'équipe.
- **Rejouable**, comme les autres migrations ; à rejouer après toute ancienne migration rejouée.
- **Avant la 0016** :
  - la cloche reste vide (« Vous êtes à jour ») ;
  - la page Notifications et la rubrique Annonces affichent « Appliquez la migration 0016 » ;
  - le reste marche comme avant.

## 5. Avis masqués : l'auteur ne le sait plus

- Aujourd'hui, l'auteur voit son avis masqué avec la mention « Masqué par l’équipe ». Désormais, il le voit exactement comme un avis visible : même place, même aspect. Les autres ne le voient pas, et il ne compte pas dans la note, comme avant.
- Les fonctions de lecture des avis ne livrent plus l'information « masqué » à l'auteur. Les comptes ne peuvent plus lire cette colonne directement.
- L'équipe garde la mention et les boutons Masquer et Réafficher, au back-office et sur la fiche d'un compte.

## 6. Tests

- **Base (PGlite) :**
  - chaque événement du §2 : bons destinataires, catégorie, titre, lien ;
  - jamais l'auteur de l'action ;
  - préférences : catégorie désactivée, canal « dans l'appli » désactivé, service toujours envoyé (sauf canal désactivé) ;
  - chacun ne lit et ne marque que les siennes ; aucune écriture directe ; `notifier` n'est pas appelable ;
  - annonces : réservées à l'équipe, envoyées à tous ;
  - effacement après 6 mois ;
  - avis masqué : l'auteur ne le sait pas, ni par les fonctions ni par la table ; l'équipe, si ;
  - migration rejouable.
- **Application :** lectures et actions (marquer lu, tout marquer, annonce) ; temps relatif et groupes par jour.
- **Composants :**
  - cloche (compteur, 8 dernières, clic, tout marquer) ;
  - page (filtres, groupes, Voir plus, vide) ;
  - rubrique Annonces (confirmation, liste) ;
  - fiche d'une formation : l'avis masqué de l'auteur ne porte plus de mention.
- **Rendu** à 1440, 390 et 320 px : aucun débordement (texte d'annonce de 300 caractères).

## 7. Hors de ce travail

- Les notifications push et les e-mails : dernière partie du lot 5.
- Les notifications des sessions live (« nouvel événement » à tous les comptes, rappels) : partie Événements, juste après.
- Celles de la communauté, des messages, des exercices, des certificats et des abonnements : avec leurs parties ou leurs lots.
- Le compteur en temps réel : avec les Messages.
