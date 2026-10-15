# Bilan : le nouvel Accueil, fil des dernières nouvelles (15 octobre 2026)

Ta demande : « l'Accueil devient un fil des dernières informations (publications, nouvelles formations, sessions
programmées) puis les formations disponibles ; le tableau de bord disparaît ; Communauté quitte le menu ».
Spec : `docs/superpowers/specs/2026-10-15-accueil-fil-design.md`. Écrit sans validation intermédiaire, à ta demande. Une
relecture indépendante à la fin, et ses points sont corrigés.

## En bref

- **L'Accueil est la communauté.**
  - En tête : « Bonjour, Koffi » et « Les dernières nouvelles d'Étudium ».
  - Dessous, tout ce qu'avait la page Communauté : les espaces, le champ de publication, « Publiées / Programmées »,
    « Trier par », le fil et la colonne de droite.
- **Les sessions live programmées** y paraissent déjà, comme publications (depuis la promotion des sessions).
- **Les nouvelles formations** arrivent dans le fil à leur date :
  - une carte « Nouvelle formation » : couverture, titre, résumé, parcours, « Découvrir la formation » ;
  - seulement dans Actualités et « Les plus récentes » ;
  - les formations mises en ligne depuis 30 jours, **3 au plus**.
- **Sous le fil, « Formations disponibles »** : les 4 plus récentes et « Voir toutes les formations ». Sur téléphone,
  elles défilent en largeur.
- **Le menu** :
  - à gauche : Accueil, Formations, Messages, Événements ;
  - sur téléphone, en bas : Accueil, Formations, Événements, Certificats, Profil ;
  - le menu ≡ garde les espaces de la communauté, sous l'Accueil.
- **Les anciens liens marchent toujours.**
  - `/communaute` mène à l'Accueil, en gardant l'espace choisi.
  - La page d'une publication garde son adresse ; son fil d'Ariane ramène à l'Accueil.
- **Le tableau de bord** et son code sont retirés.
- **Vérifications** : 1 506 tests, types, code, compilation de production, rendus vus au navigateur (1280, 390 et 320 px).

## Corrigé après la relecture

- Au lancement, le catalogue aurait rempli le fil de cartes « Nouvelle formation ». Il y en a désormais 3 au plus.
- Le titre « Bonjour, … » était plus grand que les autres titres sur téléphone. Il est revenu à la taille compacte.
- Du code du tableau de bord restait inutilisé. Il est supprimé.

## Ce qui te revient

- Aucune migration.
- Le guide « Ce qui te revient », section 32, liste les vérifications (5 points, 10 minutes).

## Décisions que j'ai prises pour toi

1. L'Accueil reprend toute la communauté (champ, espaces, colonne), plutôt qu'un fil en lecture seule. C'est le seul
   endroit où publier, puisque Communauté quitte le menu.
2. Les nouvelles formations restent dans Actualités, tri « Les plus récentes » : 30 jours, 3 au plus.
3. « Formations disponibles » : les 4 plus récentes, sous le fil.
4. Dans la barre du bas, Événements remplace Communauté et Certificats reste. Messages n'est pas encore construit.

## Petits points notés pour plus tard

- L'Accueil relit tout le catalogue pour n'en garder que quelques formations. C'est négligeable aujourd'hui ; à alléger
  quand le catalogue grandira.
- Sur téléphone, la rangée « Formations disponibles » dépasse de 2 px sur les côtés. C'est le même cas sur la page
  Formations.
- Les liens « Découvrir la formation » ont tous le même nom pour un lecteur d'écran.
- Il manque un test d'écran pour « Voir plus » quand une formation attend la page suivante.
