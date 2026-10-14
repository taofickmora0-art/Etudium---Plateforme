# Bilan : la communauté v2, le fil « Actualités » (14 octobre 2026)

Cinquième partie du lot 5, d'après tes captures « izimentor ». Écrite sans validation intermédiaire, à ta demande : les décisions prises pour toi sont listées plus bas. La seconde partie (les sessions live dans la communauté) viendra ensuite, avec sa propre spec.

## En bref

- **Les onglets** : **Actualités** (tous les espaces ouverts au compte ; on y publie dans le général), **Général**, puis un par parcours, avec un cadenas s'il est fermé. Sur téléphone, ils défilent du doigt.
- **L'annonce épinglée**, en haut des Actualités :
  - une vidéo YouTube (le lecteur sans cookies ne se charge qu'au clic) ou une affiche, l'étiquette « Annonce épinglée », un titre et un texte ;
  - réglée au back-office, nouvelle page **Communauté** (groupe Plateforme) : l'interrupteur, le titre, le texte, la vidéo ou l'affiche, le public (tous les membres, ou ceux d'un parcours ; la formule d'abonnement attend le lot 2), l'aperçu en direct à droite, **Enregistrer** et **Retirer l’annonce** ;
  - pour l'équipe, un **⋯** « Gérer l’annonce » sur la carte ramène à cette page.
- **Le champ de publication** : fermé, « Quoi de neuf, <prénom> ? » avec Image et Fichier (sur téléphone, comme le design, l'avatar et la phrase seuls) ; ouvert, le titre, le texte, le fichier, Annuler et Publier.
- **Les liens** :
  - chaque adresse d'une publication ou d'un commentaire devient un lien (nouvel onglet) ;
  - la première adresse donne un aperçu : une vidéo YouTube se lit dans la publication ; un autre site montre sa carte (image, domaine, titre, description) ; Google Meet, Zoom ou Teams sans image ont une caméra ;
  - la page est lue par le serveur au moment de publier ou de modifier, jamais par le navigateur des lecteurs : adresses privées refusées, 3 redirections, 4 secondes et 512 Ko au plus. Un site qui ne répond pas : la publication part sans carte ;
  - la base vérifie que l'adresse de la carte figure bien dans le texte, et le domaine affiché est tiré de l'adresse : une carte ne peut pas présenter un autre site que celui du lien.
- **La carte d'une publication** : « il y a 2 h · Publié dans Académique », le signet (Enregistrer), le texte et ses liens, le fichier, l'aperçu, le cœur J’aime et la bulle Commenter, les initiales des trois derniers qui aiment et « 12 J’aime · 4 commentaires ».
- **Les commentaires** (le mot « réponse » disparaît des écrans) : toujours visibles, les deux derniers en bulles, « Voir les N commentaires », le champ « Écrire un commentaire… », Signaler et Supprimer sous la bulle.
- **Trier par :** « Les plus récentes », « Les plus populaires » (J’aime + 2 × commentaires, sur 30 jours), « Mes enregistrements ».
- **La colonne de droite** : Publications tendances (les 5 plus aimées et commentées de la semaine), Activités récentes (« Koffi D. a publié « … » », « … a commenté « … » »), Prochaine session. Membres actifs disparaît.
- **Le menu ≡ du téléphone**, sur les pages de la communauté : le groupe « Espaces de la communauté » (Actualités, Général, les parcours, cadenas sur les fermés). L'adresse suit l'onglet (`?espace=…`) : un lien copié rouvre le bon onglet.
- **Migration 0021**, rejouable. Avant elle, la communauté marche comme avant (sans aperçus, signets, tendances ni annonce).
- **Vérifications :**
  - 1 310 tests, dont la migration sur une vraie base Postgres en mémoire et la lecture des pages simulée (aucun appel réel) ;
  - vérification des types et du code, compilation de production ;
  - rendu mesuré à 1440, 390 et 320 px (fil avec annonce, aperçus, vidéo, commentaires, colonne, menu ≡, page de l'annonce) : aucun débordement.

## Corrigé après la relecture

La relecture finale (opus) n'a trouvé aucun problème critique et quatre importants. Tous sont corrigés et couverts par des tests.

- **Le serveur pouvait lire des pages en boucle** pour le compte de quelqu'un : la lecture partait avant toute vérification. Elle attend maintenant la base : la publication doit être la sienne (pour modifier), l'espace ouvert et la limite des publications respectée (pour publier), et 20 lectures par compte en 10 minutes au plus. Une modification qui garde le même lien garde sa carte sans relire la page.
- **L'aperçu échappait à l'analyse automatique** : l'IA juge désormais aussi l'adresse, le titre et la description de la carte.
- **L'onglet affiché pouvait différer de l'adresse** (après un choix dans le menu ≡), et un commentaire ramenait au tri par défaut. La page suit maintenant l'adresse et garde l'onglet, le tri et le fil.
- **Un second membre de l'équipe ne pouvait plus modifier une annonce avec affiche** (l'affiche était rangée dans le dossier du premier). L'affiche déjà enregistrée se garde, quel que soit le membre qui enregistre.

## Décisions que j'ai prises pour toi

- **Actualités rassemble tous les espaces** ; Général devient un onglet à part. On publie dans le général depuis Actualités.
- **Une seule annonce épinglée** à la fois ; une annonce sans vidéo ni affiche reste possible (titre et texte seuls).
- **Le ciblage par formule d'abonnement attend le lot 2** ; en attendant : tous les membres, ou un parcours.
- **Seule la première adresse** d'une publication donne une carte.
- **Les vidéos YouTube se chargent au clic**, sans cookies ; l'image de la vidéo, elle, vient de YouTube dès l'affichage.
- **Les images des cartes viennent des sites eux-mêmes**, sans transmettre la page d'origine. Elles ne sont ni copiées ni analysées par l'IA : un site peut donc changer son image après coup. Si tu veux plus de sûreté, je peux les copier dans le stockage et les faire analyser (à décider avec toi).
- **« Les plus populaires »** : J’aime + 2 × commentaires, sur 30 jours ; les tendances : au moins un J’aime ou un commentaire dans la semaine.
- **Les commentaires restent sur un seul niveau, sans J’aime** (le design montrait Répondre et J’aime sous la bulle) ; Signaler et Supprimer y sont en petits boutons.
- **Les sujets (« #IA ») ne sont pas faits** : il faudrait une liste gérée par l'équipe.
- **Le champ fermé** : « Ajouter une image » et « Ajouter un fichier », pas de bouton vidéo (une vidéo se partage par son lien YouTube).
- **L'affiche de l'annonce** : JPEG, PNG ou WebP de 10 Mo au plus, déposée au moment d'enregistrer ; l'ancienne est retirée du stockage.

## Points mineurs mis de côté

- **La lecture des pages** : la résolution du nom n'est pas comptée dans les 4 secondes ; quelques formes rares d'adresses IPv6 locales passent la garde ; le nom pourrait changer d'adresse entre la vérification et la connexion ; la connexion n'est pas fermée tout de suite après une redirection ou une page non HTML ; l'image d'une carte peut viser une adresse locale (chargée par le navigateur du lecteur).
- **Avant la 0021** : le tri et le signet s'affichent mais n'ont pas d'effet.
- **Sa propre publication en attente** apparaît dans ses propres « populaires » et « enregistrées » (elle reste invisible des autres).
- **Accessibilité** : le signet change de libellé en plus d'être « pressé » ; le focus se perd après Lecture et après Publier.
- **Le mot « réponse »** reste dans les notifications (« Nouvelle réponse », « Réponse retirée »).
- **Le formulaire de l'annonce** garde le nom d'une affiche déjà retirée après un passage par YouTube (retirer et redéposer l'affiche suffit).
- Un long domaine est coupé par la fin dans la carte ; pas encore d'index pour trier les commentaires récents (sans effet aujourd'hui) ; la carte YouTube accepte tout identifiant présent dans le texte.

## Ce qui te revient

1. Dans l'éditeur SQL de Supabase, rejoue la **0020 actuelle** (`0020_moderation.sql`) : celle de ta base est une version précédente. Puis applique `0021_communaute_actualites.sql`.
2. Suis la section 26 du guide `docs/guides/ce-qui-te-revient.md` : l'annonce, les liens (Google Meet, YouTube, un site), les commentaires, le tri, les signets, la colonne et le menu ≡ sur téléphone.
