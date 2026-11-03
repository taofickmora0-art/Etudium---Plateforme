# Les groupes de discussion d'Étudium

Date : 3 novembre 2026. Choix de l'utilisateur : **un groupe par parcours**, plus le Général, en **discussion en direct** (comme un groupe WhatsApp, dans le site). La messagerie privée ne change pas : un étudiant écrit à un formateur ou à l'équipe, jamais à un autre étudiant. Les groupes sont l'endroit où les étudiants échangent entre eux.

La Communauté (fil de publications avec commentaires) reste telle quelle : elle sert aux publications, aux annonces et aux sondages. Les Groupes servent à la conversation.

## 1. Les groupes et qui y entre
- **Quatre groupes** : « Général », « Réussite académique », « Compétences digitales », « Business & revenus en ligne ». Un groupe par parcours actif, créé et renommé avec lui.
- **Qui lit et écrit** (même règle que les espaces de la Communauté, mise à jour sur les inscriptions) :
  - Général : tout compte connecté non suspendu ;
  - groupe d'un parcours :
    - les abonnés (tous les groupes) ;
    - les inscrits d'une formation du parcours ;
    - le formateur d'une formation du parcours ;
    - l'équipe.
- Un compte suspendu ne lit ni n'écrit.

## 2. Ce que voit un membre
- **Menu** : une entrée « Groupes » (étudiant et formateur), avec une pastille du nombre de messages non lus.
- **Page `/groupes`** : la liste de **ses** groupes, chacun avec :
  - son dernier message (auteur, extrait, heure) ;
  - une pastille de non-lus.
- **Page d'un groupe** :
  - les messages en direct, les plus récents en bas, les anciens chargés en remontant ;
  - des séparateurs de jours (« Aujourd'hui », « Hier », « Lundi 3 novembre ») ;
  - des messages groupés par auteur ;
  - un badge « Formateur » ou « Équipe » ;
  - les liens cliquables.
- **Écrire** :
  - un champ en bas, qui grandit avec le texte (2 000 caractères au plus) ;
  - « Entrée » envoie sur ordinateur ;
  - un bouton image (5 Mo au plus) ;
  - des emojis.
  - Sur téléphone, le champ reste au-dessus du clavier.
- **Sur un message** :
  - **Répondre**, qui cite le message ;
  - **réagir** avec 6 emojis : 👍 ❤️ 😂 😮 😢 🙏 ;
  - copier ;
  - **signaler** ;
  - l'auteur peut **modifier** son message pendant 15 minutes et le **supprimer** (« Message supprimé » reste affiché) ;
  - le formateur et l'équipe peuvent supprimer n'importe quel message et en **épingler** un, affiché en haut du groupe.
- **En-tête du groupe** : son nom, le nombre de membres, le message épinglé, et « Couper les notifications ».

## 3. Notifications
- Pas de notification à chaque message : la pastille de non-lus suffit.
- Une notification (cloche, son, push) quand quelqu'un **répond à votre message**, sauf si vous avez coupé ce groupe.
- Les non-lus se comptent par groupe, à partir de votre dernière lecture.

## 4. Modération
- Un message paraît **tout de suite**.
- Si l'analyse automatique par l'IA est active, il est analysé juste après, comme les publications : un contenu bloqué est retiré, son auteur est prévenu, et il apparaît dans la file de modération du back-office.
- Les signalements arrivent dans cette même file, avec « Garder » et « Supprimer ».
- Limite : 20 messages par minute et par compte. Un compte suspendu ne peut plus écrire.

## 5. Technique
- **Migration 0075** (la 0074 est la Bibliothèque) :
  - tables : groupes, messages de groupe (avec réponse, modification et suppression), réactions, lectures (dernier message lu), groupes coupés, épinglé ;
  - espace de fichiers privé pour les images ;
  - fonctions d'accès ;
  - temps réel par la diffusion existante (0044) sur un sujet privé par groupe ;
  - notifications de réponse.
  
  Guide « Ce qui te revient », section 74.
- **Rien n'est mis en ligne avant que l'utilisateur ait appliqué la migration.**

## 6. Décisions prises pour l'utilisateur (à corriger s'il le souhaite)
1. Le groupe Général existe en plus des trois parcours.
2. Pas de notification par message ; une notification seulement quand on vous répond.
3. Six réactions, 15 minutes pour modifier son message, « Message supprimé » laissé visible.
4. Le formateur et l'équipe épinglent et suppriment ; les étudiants signalent.
5. Les messages paraissent tout de suite ; l'IA retire ensuite ce qu'elle bloque.
6. La Communauté (fil de publications) reste à côté des Groupes, sans changement.
