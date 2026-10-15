# Fin du lot 5 : messagerie, notifications push, e-mails et désactivation d'une formation — spec

- **Origine :** lot 5 de la feuille de route. L'utilisateur a dit le 15 octobre : « Ok maintenant on fini avec le lot 5 ».
- **Ce qui reste du lot 5 :**
  - 5.4, la messagerie privée ;
  - 5.6, les notifications push et les e-mails importants. Le centre de notifications et les préférences existent déjà ;
  - 5.7, la désactivation d'une formation.
- **Sources :**
  - cahier des charges §32 (messagerie), §35 (notifications, canaux), §40 (désactivation), §43-44 (le formateur envoie des messages privés), §58 (PWA, push), règles 24 et 25 ;
  - design : NdMessages, NdAide, NdProfil (onglet Notifications, « Canaux ») et NdAdminFormations.
- **Découverte en préparant la spec :** le design a un écran Aide (NdAide), absent de la copie que j'avais quand j'ai fait la page Aide. Son formulaire « Contacter l'équipe » envoie un message dont « la réponse arrivera dans vos messages ». La page Aide est donc refaite avec la messagerie (étape A).
- **Règle provisoire avant le lot 2**, comme pour tout le lot 5 : un étudiant « suit » une formation dès qu'il en a ouvert une leçon. Le lot 2 restreindra selon la formule.

## Les choix (à valider)

| # | Question | Ma proposition |
|---|---|---|
| Q1 | Qui écrit à qui ? | **L'étudiant** écrit au formateur d'une formation qu'il suit, et à l'**Équipe Étudium** (assistance). **Le formateur** écrit à ses étudiants. **L'équipe** répond aux messages d'assistance. Pas de messages entre étudiants. |
| Q2 | Combien de conversations ? | Une par paire étudiant–formateur (toutes formations confondues ; l'en-tête cite la formation suivie). Une conversation « Équipe Étudium · Assistance » par étudiant, que tous les membres de l'équipe voient et où ils répondent au nom d'« Équipe Étudium ». |
| Q3 | Pièces jointes ? | Oui, comme le design : un fichier par message, 10 Mo au plus. PDF, Word, Excel, PowerPoint, images, ZIP. Dans un espace privé lisible par les deux personnes de la conversation. |
| Q4 | Temps réel ? | Presque : la conversation ouverte se met à jour toutes les 10 secondes, la pastille du menu chaque minute (comme la cloche). Pas d'indicateur « en train d'écrire ». |
| Q5 | Comment est-on prévenu ? | Une **pastille rouge** sur « Messages » avec le nombre de conversations non lues. Une **notification** « Nouveau message de … », dans une nouvelle catégorie **Messages** des préférences. Une seule notification par conversation tant qu'elle n'est pas lue. Le push suit (étape B). |
| Q6 | Modifier, supprimer, modérer ? | Pas au départ : un message envoyé reste tel quel, sans modération automatique (le cahier la prévoit pour les publications). La suppression du compte efface ses conversations et leurs fichiers. |
| Q7 | Page Aide | Refaite selon NdAide : les 7 questions fréquentes, les 4 « Questions sur les formules » et le formulaire « Contacter l'équipe » (sujet, message). Ce formulaire écrit dans la conversation d'assistance : « Message envoyé. La réponse arrivera dans vos messages. » |
| Q8 | Notifications push : comment ? | Le standard du web, le même pour Chrome, Firefox, Edge et Safari. On l'active **appareil par appareil**, avec l'interrupteur « Notifications push » du profil, qui demande l'autorisation du navigateur. |
| Q9 | Qu'est-ce qui part en push ? | Toute notification de l'appli dont la catégorie est activée, si le push est activé : nouveaux contenus, sessions, exercices, communauté, messages… |
| Q10 | E-mails : lesquels ? | Les « messages importants », toujours envoyés : formation **désactivée** ou **réactivée** (§40), compte **suspendu** ou **réactivé** (sécurité). Les e-mails de paiement, d'expiration et de renouvellement viendront avec le lot 2, par le même système. |
| Q11 | E-mails : par quel service ? | **Resend**, prévu dans la feuille de route. Sans domaine vérifié, il n'envoie qu'à ton adresse (assez pour tester) ; le domaine se vérifiera à la mise en ligne. Les modèles d'e-mail reprennent ceux de l'inscription. |
| Q12 | Désactiver ou archiver ? | Un nouvel état **« Désactivée »**, distinct d'« Archivée » : <br>• archivée : retirée du catalogue mais lisible par qui l'a commencée (choix du lot 1) ; <br>• désactivée : **plus aucun accès** pour les étudiants, tout de suite ; l'équipe et le formateur la voient encore en aperçu. Progression, certificats et avis sont gardés. |
| Q13 | Qui désactive, et quoi ensuite ? | **L'équipe**, depuis le back-office, après une confirmation qui annonce le nombre d'étudiants concernés. Ces étudiants reçoivent une notification dans l'appli, un push et un e-mail (§40). **Réactiver** remet la formation « Publiée », les accès reviennent, et les étudiants sont prévenus de la même façon. |

---

## Étape A : la messagerie (migration 0035)

### A.1 Données (lues et écrites par des fonctions, comme le reste)

- **`conversations`** : `etudiant_id` et `interlocuteur`. L'interlocuteur est soit `formateur_id` (un compte), soit le marqueur « équipe ».
  - Une seule conversation par paire, plus une seule « équipe » par étudiant.
  - Dates de création et du dernier message, pour le tri.
- **`messages`** :
  - la conversation, l'auteur (un compte ; un membre de l'équipe apparaît comme « Équipe Étudium ») ;
  - le texte, 4 000 caractères au plus ;
  - un fichier facultatif : chemin, nom, format, taille ;
  - la date.
- **`lectures`** : par conversation et par compte, l'instant jusqu'où c'est lu. Le non-lu se calcule à partir de là.
- **Espace privé « messages »** : 10 Mo par fichier, formats ci-dessus (Q3). Un fichier n'est lisible que par les deux personnes de la conversation (l'équipe entière pour l'assistance). Il ne s'attache qu'à un message.
- **Droits, vérifiés par la base :**
  - écrire à un formateur demande une formation suivie dont il est le formateur ;
  - un formateur écrit seulement à un étudiant d'une de ses formations ;
  - l'équipe lit et écrit seulement dans les conversations d'assistance ;
  - un compte suspendu n'écrit plus ;
  - au plus 30 messages en 10 minutes.
- **Suppression d'un compte :** ses conversations, leurs messages et leurs fichiers partent avec lui, des deux côtés.
- **Notification « Nouveau message de … »** (catégorie `messages`) à l'autre personne, ou à toute l'équipe pour l'assistance. Elle n'est créée que s'il n'y en a pas déjà une non lue pour cette conversation ; sinon, son texte est mis à jour.

### A.2 Écrans (NdMessages)

- **Page « Messages »**, la même pour l'étudiant (`/messages`), le formateur (`/formateur/messages`) et l'équipe (`/admin/messages`) :
  - **à gauche, les conversations** : avatar, nom, heure, dernier message (« Vous : … »), point « Non lu », et le bouton « Nouveau message » ;
  - **à droite, la conversation** :
    - en-tête : nom, rôle (« Formatrice · Maîtriser Microsoft Excel » ou « Assistance »), « Voir la formation » ;
    - messages groupés par jour (« Aujourd’hui », « Hier », une date) ;
    - pièce jointe avec son nom et sa taille, à télécharger ;
    - « Vous · 14 h 05 » ;
    - zone de saisie « Écrivez votre message… », « Joindre un fichier », « Envoyer ».
  - **Au téléphone** (aucune maquette) : la liste, puis la conversation en plein écran avec un retour.
- **« Nouveau message »** propose :
  - à l'étudiant, ses formateurs et l'Équipe Étudium ;
  - au formateur, ses étudiants (avec une recherche).
- **« Envoyer un message »** sur la fiche d'un étudiant (espace formateur), comme le prévoit le §44.
- **Pastille** sur « Messages » dans la barre latérale et la barre du bas.
- **Page Aide** selon NdAide (Q7).

## Étape B : notifications push et e-mails (migration 0036)

### B.1 Le push

- **Le service worker** (`public/sw.js`), un petit programme que le navigateur garde même la page fermée :
  - il affiche la notification (titre, texte, icône Étudium) ;
  - au clic, il ouvre la bonne page de l'appli.
- **L'interrupteur « Notifications push »** du profil :
  - activé, il demande l'autorisation du navigateur et enregistre l'appareil ;
  - désactivé, il le retire.
  - Il explique les cas où ça ne marche pas : autorisation refusée, navigateur sans push, iPhone tant que l'appli n'est pas installée sur l'écran d'accueil.
- **Les appareils** sont enregistrés dans une table `appareils_push`. Un appareil que le service de push déclare disparu est retiré tout seul.
- **Où ça marche :**
  - sur l'ordinateur en local (Chrome, Edge, Firefox sur `localhost`) dès maintenant ;
  - sur le téléphone une fois le site en ligne (https obligatoire).

### B.2 Les e-mails

- **Les e-mails importants** de Q10, aux couleurs d'Étudium :
  - un titre, un texte court et un bouton vers la page concernée ;
  - en pied de page, la raison de l'envoi.
- **Toujours envoyés** : l'utilisateur ne peut pas les couper, comme le dit le profil (« Toujours actif »).

### B.3 La file d'envoi

- **Chaque notification à pousser ou à envoyer par e-mail entre dans une file** en base. Les préférences (catégorie, canal push) sont appliquées à ce moment-là.
- **Le serveur de l'appli vide la file :**
  - juste après l'action qui crée la notification (envoyer un message, désactiver une formation) ;
  - et à chaque rafraîchissement de la cloche d'un compte connecté. Les notifications créées par la base elle-même (rappels de session) partent ainsi en moins d'une minute.
- **Une fois en ligne**, la base appellera aussi l'appli chaque minute, comme pour les rappels de session.
- **Fiabilité :**
  - un envoi qui échoue est retenté 3 fois ;
  - deux serveurs ne prennent jamais le même envoi ;
  - un envoi de plus de 24 heures est abandonné.
- **Les clés restent sur le serveur** (`web/.env.local`, saisies par toi, jamais vues par moi) :
  - la clé privée du push ;
  - la clé Resend ;
  - un jeton qui autorise le serveur à lire la file, comme celui de la modération.
- **Sans ces clés**, l'appli marche comme aujourd'hui : notifications dans l'appli seulement. Le profil dit alors « Bientôt disponible » pour le push.

## Étape C : désactivation d'une formation (migration 0037)

- **Nouvel état `desactivee`** (Q12). Un seul déclencheur en base fait tout, d'où que vienne le changement : il notifie les étudiants qui suivent la formation et met les e-mails et les push dans la file.
  - **Désactivation :** « « Maîtriser Microsoft Excel » est momentanément indisponible. Votre progression et vos certificats sont conservés. »
  - **Réactivation :** « « Maîtriser Microsoft Excel » est de nouveau disponible. »
- **Accès :**
  - la règle d'accès aux leçons refuse une formation désactivée à tout étudiant ;
  - le catalogue, la recherche et l'Accueil ne la montrent plus ;
  - « Mes formations » la garde, avec l'étiquette « Indisponible » et une explication au lieu du lien ;
  - les quiz, les exercices et la page de validation sont fermés aussi ;
  - les certificats déjà délivrés restent valables et vérifiables.
- **Back-office :** « Désactiver » et « Réactiver » dans le menu d'une formation publiée, réservés à l'équipe. La fenêtre de confirmation dit : « N étudiants suivent cette formation. Leur accès sera suspendu tout de suite ; ils seront prévenus. Vous pourrez la réactiver. »
- **Espace formateur :** l'état « Désactivée » s'affiche. Le formateur ne peut pas réactiver lui-même.

## Ce qui te revient

1. **Appliquer les migrations** 0035, 0036 et 0037 dans l'ordre, après la 0034.
2. **Pour le push**, avant l'étape B :
   - générer la paire de clés avec une commande que je te donnerai ;
   - recopier la clé publique et la clé privée dans `web/.env.local`.
3. **Pour les e-mails :**
   - créer un compte Resend gratuit ;
   - copier la clé d'API dans `web/.env.local` ;
   - plus tard, vérifier le domaine à la mise en ligne.
4. **Recopier le jeton d'envoi** que la migration 0036 affichera, comme pour la modération.
5. **Tester :**
   - écrire entre un compte étudiant et un compte formateur ;
   - activer le push sur l'ordinateur ;
   - désactiver puis réactiver une formation de test.

## Découpage et ordre

1. **Étape A, la messagerie et la page Aide.** Elle se suffit à elle-même ; les notifications de message vont dans la cloche.
2. **Étape B, le push et les e-mails.** Les messages et toutes les notifications existantes partent en push.
3. **Étape C, la désactivation.** Elle s'appuie sur B pour le push et l'e-mail.

Chaque étape aura son plan, ses tests (dont la base Postgres en mémoire), une relecture indépendante, son bilan et sa section du guide.

## Hors du lot (plus tard)

- **Avec le lot 2 :** les e-mails de paiement, d'expiration et de renouvellement, et l'accès à la messagerie selon la formule.
- **Plus tard dans la messagerie :**
  - modifier ou supprimer un message, signaler une conversation ;
  - l'équipe qui écrit en premier à n'importe quel compte ;
  - l'indicateur « en train d'écrire ».
- **La page Aide de l'équipe** (toutes les demandes d'assistance par sujet) : la page Messages du back-office suffit au départ.
