# Bilan : espace formateur, « Mes formations » (13 octobre 2026)

## En bref

- **Espace formateur → Mes formations** :
  - la liste des formations de sa fiche formateur, y compris celles que l'équipe a créées pour lui. Les plus récemment modifiées viennent d'abord ;
  - chaque formation a son état : Brouillon, En attente de validation, À corriger, Publiée ou Archivée ;
  - **Nouvelle formation** : un titre, puis l'éditeur. La formation naît en brouillon, à son nom ;
  - le bouton « Ajouter une formation » de l'en-tête de l'espace formateur mène à ce formulaire.
- **L'éditeur est celui du back-office**, avec les mêmes onglets, le programme, les leçons, les ressources et l'image de couverture.
  - Le formateur ne voit ni le choix du formateur, ni la gratuité, ni le prix, ni « Disponible seule », ni le badge, ni le seuil des vidéos.
  - À leur place, un bloc en lecture seule : « Réglé par l’équipe Étudium ».
- **La relecture** :
  - le formateur **envoie en relecture**, à condition d'avoir au moins une leçon ;
  - il peut continuer à modifier sa formation pendant la relecture ;
  - au back-office, l'équipe trouve la formation avec le filtre **En attente** et la mention « Envoyée en relecture le … par … » ;
  - l'équipe la **publie**, ou la **renvoie au formateur** avec une remarque obligatoire ;
  - le formateur voit alors « À corriger » et la remarque ; il corrige, puis renvoie.
- **Une fois en ligne**, le formateur corrige en direct. Au back-office, la formation affiche « Modifiée par le formateur le … », dans sa ligne et dans l'onglet Publication.
- **Ce que le formateur ne peut pas faire** :
  - publier ou archiver ;
  - supprimer autre chose qu'un brouillon jamais publié ;
  - toucher à la formation d'un autre : celle-ci donne « page introuvable », même si elle est publiée ;
  - accéder au back-office.
- **Migration 0014** :
  - les droits du formateur sur ses formations : contenu, programme, fichiers, couverture ;
  - les garde-fous : « Ce réglage revient à l’équipe Étudium. » pour l'état, le prix, la gratuité, le badge, le seuil, le formateur attribué et la note ;
  - la relecture.
  - La base vérifie tout, même si on contourne l'application.
- **Avant la 0014**, l'espace formateur affiche « Appliquez la migration 0014 », et le back-office marche comme avant.
- **Vérifications** :
  - 933 tests, dont toutes les règles de la base sur une vraie base Postgres en mémoire ;
  - vérification des types et du code, compilation de production ;
  - rendu mesuré à 1440, 390 et 320 px (titre de 120 caractères, remarque de 1 000 caractères) : aucun débordement.
  - **Pas de vérification dans un navigateur avec de vraies données** : la 0014 n'est pas encore appliquée.

## Corrigé après la relecture finale

La relecture n'a trouvé aucune faille d'écriture entre formateurs, et toutes les tentatives de contournement essayées ont été refusées par la base. J'ai corrigé trois points :
- **Un formateur pouvait noter sa propre formation payante.** Il en lit toutes les leçons, donc il pouvait atteindre les 50 % et se mettre 5 étoiles. C'est maintenant refusé.
- **Supprimer un brouillon, côté formateur, laissait ses fichiers dans le stockage.** Les fichiers et l'image de couverture sont maintenant retirés avant la formation. Pour l'image de couverture, c'est valable pour l'équipe aussi.
- **Un compte à la fois de l'équipe et formateur ne pouvait pas enregistrer les Informations depuis l'espace formateur**, et rien ne s'affichait. Depuis l'espace formateur, seul le contenu est enregistré, quel que soit le rôle.

## Décisions que j'ai prises pour toi

- **Le formateur peut cocher « Aperçu » sur ses leçons**, comme au back-office. Cela ouvre la leçon à tous, même dans une formation payante. **À toi de trancher** : veux-tu que l'aperçu reste un réglage de l'équipe ? Coût si faux : un formateur peut ouvrir des leçons payantes.
- **Sa propre progression** sur ses leçons compte dans les statistiques, et comptera dans « Apprenants ». Je le traiterai avec la partie Apprenants. Coût si faux : des chiffres un peu gonflés.
- **Suppression d'un brouillon** : les fichiers partent avant la formation. Coût si faux : si la suppression de la formation échouait malgré tout, des ressources sans fichier.
- **« Modifiée par le formateur » reste affiché** : l'équipe ne peut pas l'effacer. Coût si faux : une mention qui reste.
- **Un super admin sans fiche formateur** voit « Votre compte n’est pas encore relié à une fiche formateur » dans l'espace formateur. Coût si faux : un texte.
- **Pas d'e-mail** à l'admin quand une formation est envoyée, ni au formateur quand elle est renvoyée, comme prévu dans la spec. Il faut regarder le filtre « En attente ».
- **Le reste, ce sont des choix techniques sans coût** pour toi : où vivent les composants et les petites fonctions, l'étiquette des états, la suppression d'un fichier devenu inutile.

## Points mineurs mis de côté

- **L'ordre du catalogue.** Par une requête fabriquée, un formateur peut changer la place de sa formation dans un parcours et la remonter en tête du catalogue.
- **Le tri « plus récemment modifiées ».** Modifier le programme d'un brouillon (modules, leçons) ne le fait pas remonter ; seules les Informations le font.
- **Un « Modifications enregistrées » trompeur.** Il peut s'afficher si l'équipe a réattribué la formation pendant que l'éditeur était ouvert. La page devient ensuite introuvable.
- **Le message de liste vide du back-office** ne tient pas compte du filtre actif, et dit encore « visible seulement par l’équipe ».
- **Des fonctions accessibles aux visiteurs sans nécessité.** Quelques fonctions techniques de la 0014 leur sont ouvertes, ce qui ne sert à rien.

## Ce qui te revient

1. Appliquer dans l'éditeur SQL de Supabase, dans l'ordre, celles qui ne sont pas encore faites : 0011, 0012, 0013, puis `web/supabase/migrations/0014_espace_formateur.sql`.
2. Suivre les sections 16 à 19 du guide `docs/guides/ce-qui-te-revient.md`. La section 19 dure environ 20 minutes et utilise le compte de test de la section 18.
3. Si tu rejoues un jour une migration ancienne, rejoue ensuite toutes les suivantes, dans l'ordre, jusqu'à la 0014.
4. Me dire si l'« Aperçu » d'une leçon doit rester un réglage de l'équipe.
