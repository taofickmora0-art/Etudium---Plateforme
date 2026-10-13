# Bilan : images de couverture des formations (13 octobre 2026)

## En bref

- **Chaque formation peut avoir son image de couverture**, à la place des illustrations du design.
  - Elle s’envoie au back-office : **Formations** → une formation → onglet **Informations** → bloc **Image de couverture**.
  - Formats acceptés : JPG, PNG ou WebP, 5 Mo au plus. Conseil affiché : 1280 × 720 pixels.
  - Le vrai format du fichier est vérifié : un PDF renommé en `.jpg` est refusé.
  - L’image est cadrée automatiquement en 16:9, en gardant le centre.
  - **Remplacer** supprime l’ancien fichier. **Retirer** demande une confirmation.
- **Sans image**, une couverture par défaut aux couleurs du parcours (bleu, violet ou orange), avec l’illustration du design au centre. Publier sans image reste permis.
- **Où on la voit** :
  - en haut de chaque carte de formation, sur toute la largeur, avec le badge posé dessus. Cela vaut pour le catalogue, Mes formations, les Favoris, la Recherche et les recommandations ;
  - sur la fiche publique, dans le bandeau bleu à droite du texte, ou au-dessus du titre sur téléphone ;
  - sur la fiche connectée, en tête de la colonne de droite ;
  - sur la carte « Continuer » de l’Accueil et en haut du programme d’une leçon, en vignette ;
  - dans l’image de partage (WhatsApp…), cadrée en 1200 × 630.
- **Migration 0012** :
  - la colonne de la couverture ;
  - l’espace de stockage public **couvertures** ;
  - ses règles : seule l’équipe dépose, remplace et supprime, et seulement dans le dossier d’une formation existante.
- **Avant la 0012**, tout s’affiche normalement, avec les couvertures par défaut.
- **Vérifications** :
  - 789 tests, dont les règles de stockage testées sur une vraie base Postgres en mémoire ;
  - vérification des types et du code, compilation de production ;
  - rendu mesuré à 1440, 390 et 320 px : cartes avec et sans image (photo en largeur et en hauteur), fiche, carte « Continuer ». Aucun débordement, couvertures toujours en 16:9.
  - **Pas de vérification dans un navigateur avec de vraies données** : la 0012 n’est pas encore appliquée.

## Corrigé après la relecture finale

La relecture n’a trouvé aucune faille d’écriture : un étudiant ou un visiteur ne peut ni déposer ni supprimer une image. J’ai corrigé trois points, plus gênants qu’annoncés :
- **Image de partage** :
  - une photo prise au téléphone apparaissait couchée ; elle est maintenant redressée, comme sur le site ;
  - l’image partagée était un PNG trop lourd, que WhatsApp n’affiche pas en aperçu. C’est maintenant un JPEG léger, de moins de 300 Ko ;
  - une couverture WebP n’était pas utilisée ; elle l’est maintenant ;
  - une couverture lente à charger ne bloque plus l’aperçu : au-delà de 3 secondes, l’image bleue prend le relais.
- **Badges** : sur la couverture par défaut, un badge de la même couleur (par exemple « Gratuit » sur fond bleu) se confondait avec le fond. Il a maintenant un contour blanc.
- **Espace de stockage** : n’importe qui pouvait en lister le contenu, donc voir les images des formations pas encore publiées. Seule l’équipe peut le lister maintenant. Les images restent visibles par leur adresse, comme prévu.

## Décisions que j’ai prises pour toi

- **L’aperçu du back-office montre la couverture seule**, pas une carte entière comme le disait la spec : c’est la seule partie de la carte qui change. Coût si faux : un aperçu de carte à composer.
- **« Aperçu immédiat »** veut dire que l’image s’affiche dès qu’elle est enregistrée, en une à deux secondes, et non avant l’envoi. Coût si faux : un aperçu avant envoi à ajouter.
- **Une image retirée peut rester visible un temps dans les caches**, par exemple dans un aperçu WhatsApp déjà envoyé. Chaque envoi a une adresse nouvelle, donc une image remplacée n’est jamais confondue avec l’ancienne. Coût si faux : une image retirée pour une raison légale reste visible quelque temps.
- **Une image abîmée** (fichier corrompu) passe le contrôle du format. Le partage retombe alors sur l’image bleue, mais le site montre une image cassée. Coût si faux : renvoyer l’image.
- **Quotas d’hébergement** (stockage Supabase, optimisation des images) : à surveiller à la mise en ligne. Coût si faux : passer plus tôt à une offre payante.
- **Les formateurs** pourront envoyer la couverture de leurs propres formations à l’étape suivante, la création de formation par le formateur.

## Points mineurs mis de côté

- Après un format refusé, choisir de nouveau le même fichier ne fait rien : il faut en choisir un autre, ou recharger la page.
- Au back-office, la couverture par défaut prend la couleur du premier parcours de la formation, pas toujours celle de son parcours principal.
- Supprimer un brouillon laisse son image dans l’espace de stockage.
- Sur la fiche connectée, entre 1024 et 1280 px de large, l’image chargée est un peu plus petite que nécessaire.
- Un nom de fonction à renommer dans le code (même résultat).

## Ce qui te revient

1. Appliquer dans l’éditeur SQL de Supabase, dans cet ordre :
   1. `web/supabase/migrations/0011_statistiques.sql`, pour le tableau de bord du back-office ;
   2. `web/supabase/migrations/0012_couvertures.sql`.
2. Suivre les sections 16 et 17 du guide `docs/guides/ce-qui-te-revient.md` (15 minutes en tout).
