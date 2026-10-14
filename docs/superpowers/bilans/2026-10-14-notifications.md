# Bilan : centre de notifications (14 octobre 2026)

Première partie du lot 5. Les parties suivantes (Événements et sessions live, Communauté, Modération, Messages, push et e-mails) ajouteront leurs propres notifications à ce centre.

## En bref

- **Ce qui envoie une notification :**
  - nouvelle formation publiée, aux étudiants de ses parcours (« Dans le parcours Académique. »), et « Votre formation est en ligne » à son formateur ;
  - nouvelle leçon dans une formation en ligne, à ses étudiants ;
  - formation archivée, à ses étudiants (« Votre progression est conservée. ») ;
  - formation envoyée en relecture, à l'équipe ; formation renvoyée, à son formateur, avec le début de la remarque ;
  - nouvel avis, au formateur (« Fifamè A. : 4/5 ») ;
  - rôle de formateur ou d'équipe donné ; compte réactivé ;
  - annonce de l'équipe, à tous les comptes.
- **Règles :**
  - personne n'est averti de sa propre action ;
  - une catégorie coupée dans le profil ne reçoit plus rien ; « Notifications dans l’appli » coupé coupe tout ;
  - les notifications du compte et du travail passent toujours, sauf si ce canal est coupé ;
  - effacées au bout de 6 mois.
- **La cloche :**
  - une pastille bleue quand il reste des non lues ; le nombre exact pour les lecteurs d'écran ;
  - les 8 dernières ; un clic marque lue et ouvre la page ; « Tout marquer comme lu » ;
  - rechargée à chaque changement de page ;
  - sur un téléphone, le panneau tient dans l'écran et défile.
- **La page Notifications** (design `NdNotifications`) :
  - filtres « Toutes » et « Non lues » ; groupes Aujourd’hui, Hier, puis la date ;
  - « Il y a 2 h » aujourd'hui, l'heure (« 14 h 05 ») les autres jours ;
  - « Voir plus » par 20 ; « Préférences » ouvre l'onglet Notifications du profil.
- **Annonces**, au back-office, dans le groupe Plateforme : titre, texte, lien facultatif vers une page du site, une confirmation, puis la liste des annonces envoyées (date, auteur, nombre de destinataires).
- **Avis masqués : l'auteur ne le sait plus.**
  - Il voit son avis comme avant, sans mention.
  - La note et le nombre d'avis de la fiche ne changent pas pour lui.
  - Il ne peut plus lire l'information dans la base.
  - Aucune notification n'est envoyée. Pour tous les autres, l'avis reste invisible et hors de la note.
- **Migration 0016**, rejouable. Avant elle, la cloche reste vide, et la page et la rubrique affichent un bandeau ; le reste marche comme avant.
- **Vérifications :**
  - 1 061 tests, dont les droits, les déclencheurs et les préférences sur une vraie base Postgres en mémoire ;
  - vérification des types et du code, compilation de production ;
  - rendu mesuré à 1440, 390 et 320 px : aucun débordement.
  - **Pas de vérification dans un navigateur avec de vraies données** : la 0016 n'est pas encore appliquée.

## Corrigé après la relecture finale

La relecture a jugé la base sûre : personne ne lit ni ne modifie les notifications d'un autre, les fonctions internes ne sont pas appelables, la table des annonces est fermée, et le rejeu des migrations ne casse rien. J'ai corrigé trois points :
- **Une annonce sans lien** ne pouvait pas être marquée lue d'un clic : la pastille restait jusqu'à « Tout marquer comme lu ».
- **L'auteur d'un avis masqué voyait la note baisser.** Sur une formation où son avis était le seul, « 5,0 (1 avis) » disparaissait. Désormais, pour lui seul, la fiche compte son avis ; la note publique de la formation l'exclut toujours.
- **L'heure relative** pouvait différer d'une minute entre le serveur et le navigateur : une erreur s'affichait en mode développement. Le premier affichage reprend l'heure du serveur ; ensuite, l'heure se rafraîchit toutes les 30 secondes.

## Décisions que j'ai prises pour toi

- **Une pastille bleue sur la cloche** quand il reste des non lues. Le design n'en dessine pas, mais sans elle rien ne signale une nouvelle notification.
- **Les lignes de la page** suivent le design de la page (grande pastille, heure à droite), celles du panneau le design du panneau.
- **Le formulaire d'annonce** vérifie titre, texte et lien avant de demander confirmation.
- **Une leçon est annoncée dès sa création**, même avant d'avoir sa vidéo : les leçons n'ont pas d'état brouillon.
- **L'équipe compte parmi les étudiants** d'une formation dont elle a ouvert une leçon (règle provisoire jusqu'aux abonnements) : elle peut recevoir « Nouvelle leçon ».
- **« Voir toutes les notifications »** mène à la page de l'espace étudiant, même depuis le back-office ou l'espace formateur (c'est là que le design la place).
- **Les annonces vont aussi aux comptes suspendus**, qui les liront s'ils sont réactivés.
- **Les notifications de plus de 6 mois** s'effacent au prochain envoi au même compte. Chaque annonce fait donc le ménage pour tout le monde.
- **La note sur les cartes du catalogue** reste la note publique : un auteur très attentif pourrait y voir que son avis masqué n'est pas compté.

## Points mineurs mis de côté

- Passer un compte d'admin à modérateur lui renvoie « Vous faites partie de l’équipe ».
- Le formateur qui a ouvert une leçon de sa propre formation reçoit « Nouvelle leçon » et « Formation archivée » pour elle.
- Rejouer la 0010 seule rend de nouveau l'information « masqué » à l'auteur, jusqu'à ce que la 0016 soit rejouée.
- La règle des liens de la table des notifications est moins stricte que celle des annonces ; à aligner avant que les parties suivantes écrivent leurs propres liens.

## Ce qui te revient

1. Appliquer dans l'éditeur SQL de Supabase, dans l'ordre, celles qui ne sont pas encore faites : 0011 à 0015, puis `web/supabase/migrations/0016_notifications.sql`.
2. Suivre la section 21 du guide `docs/guides/ce-qui-te-revient.md` (après les sections 16 à 20).
3. Si tu rejoues un jour une ancienne migration, rejoue ensuite toutes les suivantes, dans l'ordre.
