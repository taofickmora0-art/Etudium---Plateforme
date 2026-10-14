# Bilan : texte mis en forme et vidéo jointe (14 octobre 2026)

Demande du 14 octobre : « les textes doivent être personnalisables (gras, titre 1, 2, 3, italique, souligné, barré…) » et « à côté d'Image et Fichier, Vidéo : un lien YouTube, Vimeo ou d'une autre plateforme, et ça s'affiche ». Écrite sans validation intermédiaire, à ta demande.

## En bref

- **L'éditeur visuel** (Tiptap) : le gras s'affiche en gras pendant la saisie.
  - La barre « Mise en forme » : Titre 1, Titre 2, Titre 3, Gras, Italique, Souligné, Barré, Liste à puces, Liste numérotée, Citation. Un style actif est en bleu ; sur téléphone, la barre défile.
  - Les raccourcis habituels marchent (Ctrl+B, Ctrl+I, Ctrl+U).
  - Le même éditeur sert à **Modifier**. Il n'est chargé qu'à l'ouverture du champ : le fil reste léger.
- **Le format enregistré** : le texte reste dans la même colonne, en Markdown restreint (`# titre`, `**gras**`, `_italique_`, `++souligné++`, `~~barré~~`, listes, citation).
  - Ce qui s'affiche est exactement ce que la base a vérifié et ce que l'IA a jugé ; aucun HTML venu d'un compte n'est jamais injecté.
  - Les adresses restent entières, et l'aperçu du premier lien les retrouve.
- **La vidéo jointe** : **Vidéo** dans le champ (ou la caméra du champ fermé, sur ordinateur), le lien, l'aperçu en direct, **Retirer la vidéo**.
  - Lues dans la publication, au clic : YouTube, Vimeo, Dailymotion, Loom, TikTok, Facebook, Instagram (Reels), Google Drive, et un fichier `.mp4` en https.
  - Une autre plateforme : une carte avec l'image et le titre de la page, et « Regarder sur … ».
  - La base vérifie chaque vidéo ; le lecteur et le lien « Regarder sur … » sont construits depuis la plateforme et l'identifiant, jamais depuis une adresse fournie.
  - L'IA de modération reçoit l'adresse de la vidéo ; l'équipe voit la vidéo dans la file de modération.
- **Migration 0022**, rejouable. Avant elle, publier sans vidéo marche comme avant ; avec une vidéo, un message demande la migration.
- **Vérifications :**
  - 1 349 tests, dont la migration sur une vraie base Postgres en mémoire et l'éditeur réel ;
  - vérification des types et du code, compilation de production ;
  - essai au navigateur : gras, Titre 1, champ Vidéo et lecteur Vimeo ; 360 px sans débordement.

## Corrigé après la relecture

La relecture finale (opus) n'a trouvé aucun problème critique et cinq importants. Quatre sont corrigés et couverts par des tests ; le cinquième est une décision (plus bas).

- **L'aperçu d'un lien disparaissait** quand l'éditeur protégeait un caractère de l'adresse (`Python_(langage)`, `C++`, une vidéo YouTube terminée par `_`).
- **L'éditeur pouvait créer des sous-listes**, des listes dans une citation ou un saut dans un titre, que le format aplatissait. Il ne crée plus que ce que le format sait ranger.
- **Le lien « Regarder sur … » pouvait être falsifié** par un appel direct à la base.
- **La file de modération ne montrait pas la vidéo** : l'équipe pouvait garder une vidéo sans l'avoir vue.

## Décisions que j'ai prises pour toi

- **Tiptap**, l'éditeur libre le plus répandu, en version 3.31.3 (publiée il y a plus d'un mois).
- **Italique en `_texte_`** : une marque différente par style, aucune ambiguïté. Limite : un mot à moitié en italique s'affiche avec ses `_`.
- **Les titres 1 à 3** restent sous le titre de la publication (niveaux 4 à 6 pour les lecteurs d'écran).
- **Pas de couleurs, de tailles libres, d'images dans le texte ni de tableaux** ; les listes ont un seul niveau.
- **Les commentaires restent en texte simple.**
- **La vidéo ne se change pas** en modifiant la publication.
- **Les images des aperçus et des vidéos d'une autre plateforme** viennent des sites eux-mêmes, sans être analysées.
- **Les anciennes publications** contenant des paires comme `C++`, `__init__` ou `2**3` peuvent s'afficher différemment. Aucune vraie publication n'existe encore ; si besoin, je marquerai le format des anciennes.

## Points mineurs mis de côté

- Les extraits de la colonne de droite peuvent garder des marques quand la base les coupe au milieu.
- Quelques cas limites de l'aller-retour de l'éditeur (une liste numérotée qui commence à 0, une marque au milieu d'un mot).
- Pas de compteur de caractères pendant la saisie.
- Un fichier vidéo contacte son hôte dès l'affichage (à mettre « au clic »).
- La barre d'outils compte dix arrêts de tabulation.
- Quelques vérifications de défense en profondeur (adresse en `http` d'une plateforme connue, vidéo rendue avant normalisation).

## Ce qui te revient

1. Dans l'éditeur SQL de Supabase : rejoue la **0020 actuelle**, puis la **0021**, puis applique la **0022**. Ta base a la 0021, mais la vérification montre une 0020 encore ancienne : avec l'analyse automatique active, publier échouerait.
2. Suis la section 27 du guide `docs/guides/ce-qui-te-revient.md`.
