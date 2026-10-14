# Communauté : texte mis en forme et vidéo jointe — spec

- **Date :** 14 octobre 2026
- **Statut :** écrite sans validation intermédiaire, à la demande de l'utilisateur (« continue avec tes recommandations, je te dirai s'il y a quelque chose à modifier »). Décisions au §6.
- **Demande :** « les textes doivent être personnalisables : gras, titre 1, titre 2, titre 3, italique, souligné, barré… Et en bas, à côté d'Image et Fichier, il faut aussi Vidéo : on colle le lien d'une vidéo YouTube, Vimeo ou d'une autre plateforme, et elle s'affiche. »

## 1. L'éditeur

- Le texte d'une publication s'écrit dans un **éditeur visuel** (Tiptap, MIT) : le gras s'affiche en gras pendant la saisie.
- **La barre d'outils**, au-dessus du texte, défile en largeur sur téléphone :
  - Titre 1, Titre 2, Titre 3 ;
  - Gras, Italique, Souligné, Barré ;
  - Liste à puces, Liste numérotée, Citation.
  - Chaque bouton a un nom (« Gras »…) et dit s'il est actif (`aria-pressed`). Raccourcis du clavier habituels (Ctrl+B, Ctrl+I, Ctrl+U…).
- Le même éditeur sert à **Modifier** une publication.
- Les **commentaires** restent du texte simple.

## 2. Le format enregistré

- Le texte reste dans `publications.texte`, en **Markdown restreint** :
  - `# `, `## `, `### ` (titres 1 à 3) ;
  - `**gras**`, `*italique*`, `++souligné++`, `~~barré~~` ;
  - `- ` (liste à puces), `1. ` (liste numérotée), `> ` (citation) ;
  - une ligne vide sépare les paragraphes ; un retour à la ligne simple reste un retour à la ligne ;
  - `\` protège un caractère qui serait lu comme une marque.
- **Pourquoi pas du HTML ni du JSON :** ce qui s'affiche est exactement ce que la base a vérifié et ce que l'IA de modération a jugé. L'affichage construit lui-même chaque élément à partir de cette liste fermée : aucun HTML venu d'un compte n'est jamais injecté.
- **Les anciennes publications** (texte simple) s'affichent comme avant ; une marque sans fermeture reste du texte.
- **Les extraits** (tendances, activités) et la recherche du premier lien utilisent le texte sans les marques.
- La limite reste 3 000 caractères, marques comprises.

## 3. La vidéo jointe

- Dans le champ ouvert : **Image**, **Vidéo**, **Fichier**. Dans le champ fermé (ordinateur) : « Ajouter une vidéo ».
- **Vidéo** ouvre un champ « Lien de la vidéo » et son aperçu en direct ; **Retirer la vidéo** l'enlève.
- **Les plateformes lues dans la publication** (lecteur intégré, chargé au clic) :
  - YouTube (y compris Shorts et live), Vimeo, Dailymotion, Loom, TikTok, Facebook, Instagram (Reels), Google Drive ;
  - un fichier vidéo en `https://…` terminé par `.mp4`, `.webm` ou `.ogg`, lu par le lecteur du navigateur.
- **Une autre plateforme :** une carte avec l'image et le titre de la page (lus par le serveur, comme les aperçus de liens), le domaine et « Regarder sur … » (nouvel onglet).
- **Format rangé** (`publications.video jsonb`) : `{ plateforme, id?, h?, url, titre?, image? }`. La base vérifie la plateforme, la forme de l'identifiant et les adresses (`https`, longueurs). Le lecteur est construit à partir de la plateforme et de l'identifiant, jamais d'une adresse fournie.
- Une publication peut avoir un fichier **et** une vidéo. La vidéo ne se change pas en modifiant la publication (on la supprime et on republie).
- **Modération :** l'IA reçoit l'adresse de la vidéo (et le titre de la page pour une autre plateforme).
- Si le premier lien du texte est la même vidéo, son aperçu n'est pas répété.

## 4. Base de données (migration 0022)

- `publications.video jsonb` ; `verifier_video(p_video jsonb)` (normalise ou refuse : « Cette vidéo n’est pas reconnue. ») ;
- `publier(p_parcours, p_titre, p_texte, p_piece, p_analyse, p_apercu, p_video default null)` (l'ancienne signature est retirée) ;
- `carte_publication` ajoute `video`.
- Rejouable ; rejouer la 0019, la 0020 ou la 0021 demande de rejouer la 0022 ensuite.

## 5. Tests

- Le format : aller-retour éditeur → Markdown → éditeur ; l'affichage de chaque marque ; les anciennes publications ; les marques sans fermeture ; l'échappement ; le texte sans marques.
- La vidéo : la reconnaissance de chaque plateforme et des adresses refusées ; la vérification par la base ; publier avec une vidéo ; l'affichage (lecteur au clic, carte d'une autre plateforme).
- Les écrans : la barre d'outils, le champ Vidéo et son aperçu, la carte.
- L'éditeur réel est vérifié dans un navigateur (l'environnement de test ne sait pas simuler sa sélection).

## 6. Décisions prises pour l'utilisateur

1. Éditeur Tiptap (libre, le plus répandu), en version 3.31.3.
2. Markdown restreint dans la colonne existante, pour que l'affichage, la base et la modération voient le même texte.
3. Les titres 1 à 3 restent sous le titre de la publication (niveaux de titre 4 à 6 pour les lecteurs d'écran).
4. Pas de couleurs, de tailles libres, d'images dans le texte ni de tableaux : la barre se limite à la demande, plus les listes et la citation.
5. Les commentaires restent en texte simple.
6. Huit plateformes intégrées, les fichiers vidéo directs, et une carte pour toutes les autres.
7. La vidéo ne se modifie pas après publication.
