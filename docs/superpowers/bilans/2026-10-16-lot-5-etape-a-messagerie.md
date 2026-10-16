# Bilan : lot 5, étape A, la messagerie et la page Aide (16 octobre 2026)

Tu as dit « Ok maintenant on fini avec le lot 5 », puis « C'est bon » sur la spec
(`docs/superpowers/specs/2026-10-15-lot-5-fin-messagerie-push-desactivation-design.md`). Voici l'étape A, d'après le plan
`docs/superpowers/plans/2026-10-15-lot-5-etape-a-messagerie.md`. Une relecture indépendante a eu lieu à la fin, suivie
d'une passe de corrections.

## En bref

- **Une migration 0035** (à appliquer, guide section 42) :
  - les conversations et leurs messages, lus et écrits seulement par la base ;
  - l'espace de fichiers privé « messages » (10 Mo, les formats des rendus d'exercices) ;
  - la catégorie de notification « Messages ».
- **Qui écrit à qui** :
  - l'étudiant écrit au formateur d'une formation qu'il suit, et à l'« Équipe Étudium » (l'assistance) ;
  - le formateur écrit à ses étudiants ;
  - l'équipe répond à l'assistance au nom d'« Équipe Étudium ». Ses membres voient qui a répondu, l'étudiant non.
- **L'écran Messages** (NdMessages), le même dans les trois espaces :
  - la liste des conversations à gauche, la conversation à droite ;
  - au téléphone, l'une puis l'autre, avec un retour ;
  - pièces jointes à l'envoi et au téléchargement ;
  - « Messages précédents » ;
  - mise à jour toutes les 10 secondes.
- **Être prévenu** :
  - une pastille rouge sur « Messages », et au téléphone sur le bouton ≡ ;
  - la notification « Nouveau message d’Aïcha Kpadé », une seule par conversation tant qu'elle n'est pas lue ;
  - la catégorie « Messages » dans les préférences.
- **La page Aide refaite selon le design** (NdAide) :
  - une recherche qui ignore les accents ;
  - les questions fréquentes et les questions sur les formules ;
  - « Contacter l’équipe » : un sujet et un message, qui partent dans l'assistance.
- **Sur la fiche d'un étudiant** (espace formateur), « Envoyer un message ».
- **La suppression d'un compte** emporte ses conversations des deux côtés, leurs fichiers et leurs notifications.
- **Vérifications** :
  - 1 882 tests, dont la 0035 sur une vraie base Postgres en mémoire ;
  - types, lint et compilation de production ;
  - la messagerie et la page Aide mesurées dans le navigateur, sur ordinateur et à 375 px.

## Corrigé après la relecture

- **N'importe qui pouvait effacer une conversation des deux côtés, à tout moment, même avec un compte suspendu.**
  - Cela passait par la fonction prévue pour la suppression du compte, appelée seule.
  - Un harceleur pouvait donc effacer ses messages avant d'être signalé.
  - Maintenant, rien ne s'efface tant que le compte existe. Tout part dans la suppression du compte elle-même, qui refuse un compte suspendu.
- **Quand l'équipe relisait une demande d'assistance, la notification de l'étudiant passait à « lue »** : il ne voyait pas la réponse dans la cloche.
- **Les « Messages précédents » disparaissaient** à la mise à jour suivante (10 secondes plus tard).
- **Après la suppression d'un compte, l'autre personne gardait les notifications**, avec son nom et le début de ses messages.
- **L'auteur d'une pièce jointe pouvait l'effacer, ou la remplacer par un autre fichier**, après l'envoi.
- **Au téléphone, rien ne signalait un message non lu** sans ouvrir le menu ≡.
- **Trois défauts visibles à chaque message** :
  - les notifications de message s'affichaient comme des notifications « service » ;
  - les titres disaient « de Aïcha », « de Équipe Étudium » ;
  - au téléphone, Entrée envoyait le message au lieu d'aller à la ligne.

## Ce qui te revient

1. **Applique la 0035**, après les 0031 à 0034 si ce n'est pas fait (et les 0029 et 0030 si besoin). Guide, section 42.
2. **Valide la messagerie et la page Aide** (guide, section 42, 25 minutes) :
   - étudiant et formateur ;
   - l'assistance ;
   - la page Aide ;
   - les préférences ;
   - la suppression d'un compte de test. Vérifie ce point avec soin, car le comportement du vrai stockage Supabase n'a pas pu être testé ici.
3. **Pour l'étape B** (notifications push et e-mails), il te faudra :
   - des clés VAPID ;
   - un compte Resend et sa clé.
   Tu les saisiras toi-même dans `web/.env.local`, je te guiderai.

## Décisions que j'ai prises pour toi

- **L'écran Messages** :
  - sans conversation choisie, la colonne de droite invite à en choisir une. Ouvrir d'office la plus récente la marquerait lue sans que tu l'aies vue ;
  - la liste est faite de liens, pas de boutons : retour arrière et ouverture dans un onglet marchent ;
  - la zone de saisie s'agrandit sur plusieurs lignes (les demandes d'assistance en ont souvent), au lieu du champ d'une ligne du design ;
  - au téléphone, une pastille chiffrée sur le bouton ≡ : le design n'en montre pas, et la barre du bas n'a pas d'entrée Messages.
- **La page Aide** : si la recherche ne trouve rien, la phrase « Aucune question ne correspond. » (le design ne prévoit pas ce cas).
- **Les préférences** : « Messages » est placée après « Communauté ».
- **La suppression du compte** :
  - **le texte de la confirmation reste celui du design** : « Vos informations » couvre les messages ;
  - **les fichiers des messages sont effacés juste après la suppression du compte**, pas avant : avant, ils sont encore joints à des messages. Si cet effacement échoue, le compte est supprimé quand même et la base garde la liste des fichiers à effacer ;
  - **les fichiers de l'autre personne** : une petite table fermée les note, pour que seul le compte supprimé puisse les effacer.
- **Les refus**, comme « Votre compte est suspendu. » ou « Vous ne pouvez pas écrire à cette personne. », s'affichent tels que la base les donne.
- **Sur la fiche étudiant**, un refus de « Envoyer un message » s'affiche dans une notification passagère.

## Petits points reportés

- **Messagerie** :
  - un formateur qui perd son rôle reçoit encore des messages qu'il ne peut plus lire ;
  - un compte suspendu lit encore le texte de ses conversations ;
  - la demande d'assistance d'un admin, écrite depuis sa page Aide, s'ouvre du mauvais côté ;
  - « Conversation introuvable » n'a pas de retour au téléphone ;
  - un membre de l'équipe est bloqué à 30 messages en 10 minutes, toutes conversations confondues ;
  - les formats acceptés et la limite de 10 Mo ne s'affichent qu'au refus ;
  - un refus technique de la base s'afficherait en anglais.
- **Suppression du compte** : un fichier déposé mais jamais envoyé n'est pas effacé.
- **Technique** :
  - une coupure réseau pendant une mise à jour laisse une erreur dans la console ;
  - chaque mise à jour écrit en base, et la liste de l'équipe n'est pas paginée.
- **Accessibilité** :
  - le chargement des messages précédents est annoncé en entier ;
  - l'auteur d'une bulle n'est pas lu ;
  - les initiales sont lues dans le nom des conversations.
- **À vérifier pendant ta recette** : au téléphone, avec une pièce jointe en attente et le texte agrandi à 115 %, la zone de saisie doit rester au-dessus de la barre du bas.
