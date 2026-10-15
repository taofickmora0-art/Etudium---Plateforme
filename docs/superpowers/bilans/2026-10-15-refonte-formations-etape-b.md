# Bilan : refonte des formations, étape B — le suivi (15 octobre 2026)

Ta demande du 14 octobre (captures d'izimentor), d'après la spec que tu as validée le 15 octobre (« C'est bon ») :
`docs/superpowers/specs/2026-10-15-refonte-formations-design.md`. Le plan : `docs/superpowers/plans/2026-10-15-refonte-formations-etape-b.md`.
Une relecture indépendante à la fin, et ses points importants sont corrigés.

## En bref

- **La page d'une leçon** prend une barre du haut, sur ordinateur :
  - à gauche, « ‹ Titre de la formation » ramène à la page du cours ;
  - à droite, **Mode lecture** efface le programme ;
  - puis **Terminer la leçon ›**. Sans vidéo, il termine la leçon et ouvre la suivante. Avec une vidéo, il reste grisé
    jusqu'au seuil (« Regardez au moins 90 % de la vidéo »), puis devient **Leçon suivante ›**.
  - Sur la dernière leçon : « Dernière leçon terminée ! » et **Voir la formation**.
- **Au-dessus du titre** : « Leçon 6 sur 12 », les flèches ‹ › et, pour l'équipe et le formateur de la formation,
  **Modifier la leçon**.
- **Le programme**, à gauche :
  - les modules se replient, celui de la leçon ouverte est déplié ;
  - chaque leçon affiche sa durée ;
  - la progression (barre, %, temps restant) reste en bas.
- **Le défilement sur ordinateur, comme izimentor** :
  - l'en-tête reste en place ;
  - le programme et la leçon défilent chacun de leur côté ;
  - la barre du haut reste visible.
- **Sur téléphone** : le bouton **Leçons** en haut à droite ouvre le programme dans un tiroir, qui se referme au choix
  d'une leçon. L'onglet « Programme » disparaît.
- **Les discussions de la leçon**, sous le contenu :
  - commenter, Répondre (un niveau), J'aime, le menu ⋮ (copier le lien, signaler, modifier, supprimer) ;
  - « Voir plus de commentaires » ;
  - le formateur porte l'étiquette « Formateur ».
  - **Notifications** : le formateur est prévenu d'un nouveau commentaire, l'auteur d'une réponse. La notification
    ouvre la leçon et descend jusqu'au commentaire, même ancien.
  - **Modération** : un commentaire signalé arrive dans la file du back-office comme « Commentaire de leçon », avec
    Garder, Supprimer et « Ouvrir la leçon ».
  - **Qui les voit** : seuls les comptes qui ont accès à la leçon. Pas les visiteurs, pas l'aperçu (bandeau jaune), et
    pas quand « Activer les commentaires » est décoché dans l'éditeur.
- **La page du cours** :
  - **Poursuivre le cours** en haut à droite, ou **Commencer le cours** pour une formation gratuite pas encore commencée ;
  - la carte **Progression du cours** (« Terminé 3 sur 12 », %) ;
  - **Tout déplier / Tout replier** au-dessus du programme ;
  - **Modifier les leçons** pour l'équipe et le formateur.
- **Vérifications** :
  - 1 585 tests, dont la migration 0028 sur une vraie base Postgres en mémoire ;
  - les types, le code et la compilation de production ;
  - les rendus au navigateur, à 1440, 390 et 320 px.
- **Corrigé pendant la vérification** :
  - la barre du haut chevauchait le début de la leçon ;
  - sur téléphone, le bouton retour passe à la taille de « Leçons » ;
  - sur la page du cours à 320 px, « Vous êtes ici » recouvrait le titre de la leçon. Il passe dessous.

## Corrigé après la relecture

- **Liens vers un commentaire** : une notification de réponse ouvrait la leçon en haut. La réponse n'y était même pas
  si le fil avait plus de 10 commentaires plus récents. La leçon lit maintenant toute la discussion et descend jusqu'au
  commentaire.
- **Clavier, sur ordinateur** : comme la leçon défile seule, Espace et Page suivante ne faisaient rien avant un clic.
  Le panneau de la leçon reçoit maintenant le focus à l'arrivée, et le programme montre la leçon en cours.
- **Aperçu** : l'équipe ou le formateur pouvait commenter une leçon en brouillon. Le commentaire devenait visible des
  étudiants à la publication. Plus de discussions en aperçu.
- **Guide** : il parlait d'un bouton « Publier le commentaire », alors que c'est la flèche d'envoi.

## Ce qui te revient

1. **Migration 0028** : applique `web/supabase/migrations/0028_discussions_lecons.sql`, après la 0027. Avant elle, la
   page leçon fonctionne sans la section des discussions.
2. **Guide** : suis la section 34 de « Ce qui te revient ».
3. **Toujours en attente de l'étape A** : la 0026 (ou la rejouer, section 31), la 0027 (section 33), et ta réponse sur
   « une nouvelle leçon naît publiée si la formation n'a jamais été publiée ».

## Décisions que j'ai prises pour toi

1. **Dernière leçon** : « Dernière leçon terminée ! » et **Voir la formation**, plutôt que « Formation terminée ! ».
   La formation n'est finie que si toutes les autres leçons le sont, et c'est la page du cours qui le dit.
2. **Mode lecture** : il reste actif d'une leçon à l'autre, jusqu'au rechargement de la page. Il n'est pas mémorisé.
3. **« Terminer la leçon »** est à la fois dans la barre du haut et sous le texte (ordinateur).
4. **Défilement séparé** du programme et de la leçon sur ordinateur, comme izimentor. Sinon, la progression en bas du
   programme aurait été cachée au chargement.
5. **Le tiroir « Leçons »** glisse depuis la gauche, comme le menu ≡. Sur une leçon verrouillée, il remplace la liste
   « Programme » qu'on voyait sous le cadenas.
6. **Le bouton d'envoi d'un commentaire** reste une flèche, comme dans la communauté. Un bouton texte « Publier » ne
   tenait pas sur 320 px.
7. **Modération** : de nouvelles fonctions pour les commentaires de leçon ; celles de la communauté ne changent pas.
   Seul l'auteur modifie son commentaire. L'auteur, le formateur de la formation et l'équipe peuvent le supprimer.
8. **« Poursuivre le cours »** est à droite du titre. Il n'est pas collé en haut pendant le défilement.
9. **« Modifier les leçons »** mène à l'onglet Leçons de l'éditeur, au-dessus du programme.

## Petits points notés pour plus tard

- Sur ordinateur, les deux boutons « Terminer la leçon » ne partagent pas leur attente. Sur un réseau lent, on peut
  cliquer les deux, sans dégât. « Dernière leçon terminée ! » est alors lu deux fois par un lecteur d'écran.
- Imprimer une leçon sur ordinateur ne sort que la partie visible du panneau.
- **Réponses** : quand on répond à une réponse, seul l'auteur du premier commentaire est prévenu, comme dans la
  communauté.
- **File de modération**, pour un commentaire de leçon :
  - elle affiche « Espace <formation> » ;
  - la confirmation dit « Il disparaîtra de la communauté » ;
  - les réponses retirées avec lui ne sont pas comptées.
- La limite de 30 commentaires en 10 minutes peut être dépassée par des envois exactement simultanés, comme pour la
  communauté.
- « Voir plus de commentaires » charge toute la discussion d'un coup. C'est à revoir pour une leçon très commentée.
- Pas encore de sélecteur d'emojis dans le champ des discussions.
- Je n'ai pas pu vérifier au navigateur les écrans d'un compte connecté sur la vraie base (je ne me connecte pas
  moi-même). Je les ai vus sur une page d'essai temporaire, supprimée ensuite.

## Et après

L'**étape C** (facultative) : l'onglet « Apprenants » d'une formation (spec §6.8).
