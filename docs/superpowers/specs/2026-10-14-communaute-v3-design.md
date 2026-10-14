# Communauté v3 et nouvel Accueil — spec

- **Date :** 14 octobre 2026 (soir)
- **Statut :** écrite sans validation intermédiaire, à la demande de l'utilisateur. Décisions au §6.
- **Origine :** message vocal et captures « izimentor » du 14 octobre (commentaires, champ de publication, programmation, sondage).

## 1. Étape 1 — Le champ, l'éditeur, la largeur (sans migration)

- **Sur ordinateur, le fil a une largeur fixe** : 720 px au plus (comme le design), la colonne de droite 320 px. Les vidéos et les images ne grandissent plus avec l'écran.
- **« Publication dans : »** dans le champ ouvert : une liste des espaces ouverts au compte (Général, puis les parcours). Par défaut, l'espace de l'onglet (Général pour Actualités). La publication part dans l'espace choisi. Elle s'ajoute au fil affiché seulement si elle en fait partie.
- **Emojis** : un bouton « Emoji » dans la barre de l'éditeur ouvre une grille d'emojis courants (chacun nommé en français pour les lecteurs d'écran) ; un clic insère l'emoji à la place du curseur. Sert aussi pour Modifier.
- **Lien** dans la barre de l'éditeur : sur un texte sélectionné, « Lien » ouvre un petit champ « Adresse du lien » (`https://…`) ; **Valider** rend le texte cliquable, **Retirer le lien** l'enlève.
  - Format enregistré : `[texte](https://adresse)`. Seules les adresses `http` et `https` sont acceptées ; une autre forme reste du texte.
  - Affichage : le texte est un lien ouvert dans un nouvel onglet (`noopener nofollow ugc`).

## 2. Étape 2 — Les commentaires (migration 0025)

- Sous chaque commentaire : **Répondre** et **J’aime** (avec le nombre), et un menu **⋮** :
  - **Copier le lien** (l'adresse de la publication, ancrée sur le commentaire), **Signaler** (pas pour son auteur ni l'équipe) ;
  - **Modifier** et **Supprimer** pour son auteur et l'équipe.
- **Les réponses** à un commentaire s'affichent dessous, décalées, sur un seul niveau (répondre à une réponse répond au même commentaire, en citant son auteur).
- **« Voir plus de commentaires »** charge les commentaires suivants ; « Écrire un commentaire… » reste en bas.
- Base : `commentaires_publications.parent_id`, `modifie_le` ; `reactions_commentaires` ; `commenter(p_publication, p_texte, p_parent)`, `modifier_commentaire`, `basculer_reaction_commentaire` ; la carte d'un commentaire rend `parent_id`, `reactions`, `j_aime`, `modifie`, `peut_modifier`.
- Précisions (14 octobre, nuit) :
  - l'auteur d'un commentaire est prévenu d'une réponse (« Nouvelle réponse à votre commentaire », catégorie communauté) ;
  - dans le fil, la carte montre les 2 derniers commentaires de premier niveau ; « Voir plus de commentaires » charge tous
    les commentaires et leurs réponses ;
  - supprimer un commentaire supprime ses réponses ; un commentaire modifié porte « modifié » ;
  - « Copier le lien » : l'adresse de la publication suivie de `#commentaire-<id>` ; la page de la publication fait
    défiler jusqu'à lui.

## 3. Étape 3 — Programmer et sondages (migration 0026)

- **Programmer** (icône calendrier du champ) : une date et une heure à venir (heure du Bénin). Le bouton devient « Programmer ». La publication n'est visible que de son auteur (« Programmée pour le … ») et de l'équipe jusqu'à cette heure ; elle paraît alors en haut du fil. Analyse et limites comme une publication immédiate.
- **Sondage** (icône du champ) : une question (le texte de la publication), 2 à 10 options, « Les membres peuvent choisir plusieurs options », une date de fin facultative.
  - Dans la carte : les options à cocher, **Voter**, puis les résultats (pourcentages et nombre de votes) ; on peut changer son vote tant que le sondage est ouvert ; fermé, les résultats seuls.
  - Base : `sondages`, `options_sondage`, `votes_sondage` ; `voter(p_sondage, p_options)` ; le sondage rendu par la carte.

## 4. Étape 4 — L'Accueil

- **L'Accueil devient le fil des dernières nouvelles** : un mélange, du plus récent, des publications de la communauté (espaces ouverts au compte), des nouvelles formations publiées et des sessions live programmées ; chaque carte mène à sa page.
- **Dessous : les formations disponibles** (les plus récentes), avec « Voir toutes les formations ».
- Le tableau de bord actuel de l'accueil est retiré. Les onglets Formations et Communauté restent.

## 5. Tests

Chaque étape : ses règles pures, sa migration sur la base en mémoire, ses écrans ; rendu à 1440, 390 et 320 px.

## 6. Décisions prises pour l'utilisateur

1. Largeur du fil : 720 px au plus sur ordinateur.
2. Emojis : une grille d'environ 50 emojis courants, sans bibliothèque externe.
3. Liens : `[texte](https://…)`, nouvel onglet, `http`/`https` seulement.
4. Réponses aux commentaires sur un seul niveau.
5. La programmation se fait à l'heure du Bénin ; une publication programmée se modifie ou se supprime comme les autres.
6. Sondage : 2 à 10 options, vote modifiable tant qu'il est ouvert, résultats visibles après avoir voté (ou à la fermeture).
7. L'Accueil remplace le tableau de bord ; la progression des formations reste dans « Mes formations ».
