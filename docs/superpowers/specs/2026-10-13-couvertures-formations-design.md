# Images de couverture des formations : spec

- **Date :** 13 octobre 2026
- **Statut :** design validé en conversation le 13 octobre 2026 ; à relire avant le plan.
- **Origine :** demande de l'utilisateur pendant ses tests. Chaque formation a son image de présentation, envoyée par l'équipe (puis par le formateur, étape suivante), à la place des illustrations « piles » du design.
- **Écart au design de référence :** les cartes du design n'ont pas d'image. C'est la décision de l'utilisateur ; la couverture par défaut reprend l'illustration du design.

## 1. Ce qui est décidé

| Question | Décision |
|---|---|
| Place sur les cartes | **En grand, en haut** : image 16:9 sur toute la largeur de la carte, badge (Populaire, Gratuit…) posé dessus |
| Sans image | **Couverture par défaut** aux couleurs du parcours (bleu, violet, orange) avec l'illustration actuelle au centre ; publier sans image reste permis |
| Ailleurs | Fiche (publique et connectée), image de partage (WhatsApp…), carte « Continuer » de l'Accueil, page de la leçon |
| Envoi | **Cadrage automatique** : JPG, PNG ou WebP, 5 Mo au plus ; le centre est gardé (16:9) ; aperçu immédiat ; conseil « 1280 × 720 pixels » |

## 2. Stockage (migration 0012)

- Colonne `formations.couverture text` : chemin du fichier dans l'espace `couvertures`, null sans image. Contrainte : le chemin commence par l'identifiant de la formation (`<formation_id>/<nom>.<jpg|png|webp>`).
- Espace de stockage `couvertures` **public** (visiteurs et WhatsApp lisent l'image sans compte) : `file_size_limit` 5 Mo, `allowed_mime_types` JPEG, PNG, WebP.
- Règles : lecture pour tous par l'adresse publique des images ; lister l'espace, déposer, remplacer et supprimer : l'équipe (`equipe_contenus()`). Lister l'espace révélerait les images des formations pas encore publiées (relecture finale). Les formateurs, pour leurs formations, à l'étape « création de formation par le formateur ».
- Rejouable, comme les autres migrations.

## 3. Envoi au back-office

- Onglet **Informations** d'une formation : bloc « Image de couverture ».
  - Aperçu de la carte avec l'image (ou la couverture par défaut).
  - **Choisir une image** (puis **Remplacer**) et **Retirer** (avec confirmation).
  - Conseil : « JPG, PNG ou WebP, 5 Mo au plus. Conseil : 1280 × 720 pixels. »
- Comme les ressources : le navigateur vérifie le vrai format du fichier (signature JPEG, PNG ou WebP) et la taille, dépose le fichier dans `couvertures/<formation_id>/<uuid>.<ext>`, puis une action serveur l'enregistre sur la formation. L'action revérifie le chemin (préfixe de la formation, extension) et supprime l'ancien fichier. Retirer efface le fichier et vide la colonne.
- Messages : format refusé, fichier trop lourd, échec de l'envoi (réessayer).

## 4. Affichage

- Composant `Couverture` : l'image (`next/image`, redimensionnée et compressée automatiquement, `object-fit: cover`, 16:9, `alt=""` car le titre suit) ou la couverture par défaut. `next.config` autorise l'adresse publique du stockage Supabase.
- **Cartes** (`CardShell` : catalogue, Mes formations, Favoris, Recherche, recommandations de l'Accueil et de la recherche) : la couverture en haut, sur toute la largeur, coins supérieurs arrondis ; badge posé en haut à droite de l'image ; puis titre, description et bas de carte inchangés.
- **Fiche publique** : la couverture dans le bandeau bleu, à droite du texte ; au-dessus du titre sur téléphone.
- **Fiche connectée** : la couverture en tête de la colonne de droite, au-dessus de la carte d'accès.
- **Image de partage** : avec une couverture, l'image générée (1200 × 630) est la couverture cadrée ; sans couverture, l'image bleue actuelle.
- **Carte « Continuer »** (Accueil) : une vignette 16:9 à la place de l'illustration de 48 px.
- **Page de la leçon** : une petite vignette 16:9 de la formation en haut du programme.
- **Avant la migration 0012** (colonne absente, erreur `42703`) : lecture sans la colonne, couverture par défaut partout, comme pour les notes des avis.

## 5. Tests

- Base (PGlite) : lecture publique de l'espace ; dépôt et suppression par l'équipe ; refus pour un étudiant et un visiteur ; contrainte du chemin ; migration rejouable.
- Envoi : signature WebP reconnue ; format refusé ; fichier de plus de 5 Mo ; chemin d'une autre formation refusé par l'action ; remplacement qui supprime l'ancien fichier ; retrait.
- Composants : carte avec image (badge dessus) et sans image (couverture par défaut du parcours) ; fiche ; carte « Continuer » ; programme de la leçon.
- Image de partage : la couverture quand elle existe, l'image bleue sinon.
- Lecture du catalogue sans la colonne (`42703`).
- Rendu mesuré à 1440, 390 et 320 px : aucun débordement.

## 6. Hors de ce travail

- Envoi par le formateur depuis son espace : étape suivante (création de formation par le formateur).
- Outil de recadrage manuel : non retenu (cadrage automatique).
