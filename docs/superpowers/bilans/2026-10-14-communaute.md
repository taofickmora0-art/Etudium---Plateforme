# Bilan : communauté (14 octobre 2026)

Troisième partie du lot 5, après les notifications et les sessions live. Écrite sans validation intermédiaire, à ta demande : les décisions prises pour toi sont listées plus bas.

## En bref

- **Les espaces :**
  - **Général**, ouvert à tout compte connecté ;
  - un espace par parcours actif (Académique, Digital, Business…). Il est ouvert à qui a commencé une formation du parcours (il en a ouvert une leçon), au formateur d'une formation du parcours et à l'équipe ;
  - c'est la règle provisoire d'avant les abonnements (lot 2).
- **La page Communauté** (design `NdCommunaute`) :
  - l'onglet **Général** montre le fil de tous les espaces ouverts au compte ; on y publie dans l'espace général. Un onglet de parcours montre son espace seul ;
  - un espace fermé garde son onglet, avec un cadenas : « Espace … verrouillé » et **Voir les formations du parcours** ;
  - **le champ de publication** : un titre facultatif (120 caractères), le texte (3 000), **Image** ou **Fichier** (une image JPEG, PNG ou WebP, ou un PDF, de 10 Mo au plus). Puis **Publier** et « Publication en ligne » ;
  - **une publication** : l'auteur, « Formateur », « Équipe Étudium » ou « Vous », « Espace Académique · il y a 2 h », le titre, le texte, l'image ou le PDF, **J’aime**, les réponses ;
  - **le menu ⋮** : **Copier le lien** (« Lien copié ») ; **Modifier** pour l'auteur (marquée « modifiée ») ; **Supprimer** pour l'auteur et l'équipe, avec la confirmation du design ;
  - **les réponses** : les deux dernières sous la publication, **Voir les N réponses** pour toutes, « Répondre… », et la corbeille pour son auteur et l'équipe ;
  - le fil par 20, puis **Voir plus** ;
  - **la colonne de droite** : la prochaine session live et les trois membres les plus actifs de la semaine.
- **La page d'une publication** (`/communaute/publications/…`) : toutes ses réponses, les mêmes actions. C'est l'adresse que copie « Copier le lien » et que donne la notification.
- **Notification** « Nouvelle réponse » à l'auteur d'une publication, dans la catégorie Communauté du profil ; jamais pour sa propre réponse.
- **Les fichiers joints :**
  - ils partent du navigateur vers un espace de stockage privé « communaute », dans le dossier du compte ;
  - la base vérifie qu'ils sont bien à lui avant de les attacher ;
  - seuls les lecteurs de l'espace les obtiennent, par des liens valables 1 h ;
  - supprimer une publication retire son fichier.
- **Confidentialité** : prénom et nom sur une publication, « Prénom N. » sur une réponse, jamais d'adresse e-mail.
- **Migration 0019**, rejouable. Avant elle, la page affiche un bandeau.
- **Vérifications :**
  - 1 192 tests, dont les droits d'accès aux espaces et aux fichiers sur une vraie base Postgres en mémoire ;
  - vérification des types et du code, compilation de production ;
  - rendu mesuré à 1440, 390 et 320 px avec un texte de 3 000 caractères sans espace, une grande image et un PDF au nom de 120 caractères : aucun débordement ;
  - la relecture finale par opus n'a trouvé aucun problème critique, et aucune fuite entre espaces.

## Corrigé après la relecture

- **Un fichier restait stocké quand l'équipe supprimait la publication d'un autre.** Le stockage refusait le retrait sans le dire. L'équipe peut désormais lire, donc retirer, les fichiers de la communauté.
- **Un auteur pouvait remplacer le fichier d'une publication déjà en ligne**, par un appel direct sans passer par l'application.
  - Tant que la publication existe, son fichier ne se retire plus, donc ne se remplace plus.
  - Un même fichier ne peut plus être joint à deux publications.
  - C'est aussi ce dont la future vérification automatique a besoin : le fichier vérifié sera celui qu'on sert.
- **Les réponses pouvaient se désynchroniser** quand on en supprimait deux coup sur coup, ou qu'on en supprimait une pendant l'envoi d'une autre : une réponse supprimée réapparaissait, ou une réponse envoyée disparaissait. La corbeille est aussi désactivée pendant la suppression.
- **Supprimer une publication depuis sa propre page** affichait probablement « page introuvable » un instant. On revient désormais directement à la Communauté.

## Décisions que j'ai prises pour toi

- **L'onglet Général** montre tous les espaces ouverts au compte, comme le design ; on y publie dans l'espace général.
- **L'entrée dans un espace de parcours** : il suffit d'avoir ouvert une leçon d'une formation du parcours, même une leçon d'aperçu. Le formateur d'une formation du parcours et l'équipe y entrent aussi. Tout cela sera revu avec les abonnements.
- **Une seule pièce jointe** par publication. Elle ne se remplace pas : on supprime et on republie.
- **Les réponses sont sur un seul niveau.** Le cahier des charges parle de « réponses aux commentaires ». Je n'ai pas fait de second niveau, que le design ne montre pas. On ne modifie pas une réponse : on la supprime.
- **Une seule réaction, « J’aime »**, sur les publications seulement, sans notification.
- **« Signaler » et « Les publications sont vérifiées automatiquement » attendent la Modération**, pour ne rien promettre qui n'existe pas encore. Le champ dit à la place « Soyez bienveillant : l’équipe Étudium veille aux échanges. ».
- **Un espace fermé invite à commencer une formation du parcours.** La phrase du design (« pas inclus dans votre formule ») viendra avec les abonnements.
- **La colonne de droite** : ni « À la une » (mots-clés) ni « Challenge du mois », qui n'existent pas.
- **Le titre facultatif** apparaît dès qu'on clique dans le champ : au repos, le design ne montre que la zone de texte.
- **Les réponses sont dépliées** quand il y en a ; le bouton « N réponses » les masque, comme dans le design. Une réponse s'envoie avec Entrée ou l'icône d'envoi.
- **L'étiquette est « Formateur » pour tous.** Le design écrit « Formatrice » pour une femme, mais la plateforme ne connaît pas le genre.
- **Les textes** :
  - « Répondre… » dans le champ de réponse, comme le design, au lieu de « Écrire une réponse… » prévu par la spec ;
  - « · modifiée » à la suite de « Espace Académique · il y a 2 h » ;
  - « Réponse supprimée » après la corbeille ;
  - « Joignez une image (JPEG, PNG ou WebP) ou un PDF de 10 Mo au plus. » pour un fichier refusé.
- **Les tailles de fichier** se comptent comme l'explorateur de Windows : « 240 Ko » pour 245 760 octets.

## Points mineurs mis de côté

- Si on change d'onglet pendant l'envoi d'une publication, elle s'affiche en tête de l'onglet ouvert, même si ce n'est pas le sien. Recharger remet tout en ordre.
- Changer deux fois d'onglet très vite peut afficher « Aucune publication » un instant.
- Par un appel direct, on pourrait annoncer un faux type ou une fausse taille pour son fichier. Ce sera repris avec la Modération, qui lira les vraies valeurs du stockage.
- **Fichiers orphelins** : quelques cas laissent un fichier stocké sans publication :
  - session expirée juste après l'envoi ;
  - échec du retrait ;
  - suppression d'un compte ou d'un parcours.

  Un nettoyage reste à prévoir.
- Quelques détails sans effet pour l'utilisateur :
  - une vérification d'accès est refaite pour chaque publication au lieu d'une fois par lecture ;
  - le chemin d'un fichier, qui contient l'identifiant interne de son auteur, arrive au navigateur ;
  - une fonction interne est appelable par les comptes ; elle ne dit que leurs propres droits ;
  - une panne de « Membres actifs » ferait tomber la page ;
  - un test ne vérifie pas seul le refus des chemins avec « .. ».

## Ce qui te revient

1. Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0018_sessions_live.sql` si ce n'est pas déjà fait, puis `web/supabase/migrations/0019_communaute.sql`.
2. Suis la section 24 du guide `docs/guides/ce-qui-te-revient.md`. Elle demande le compte étudiant, le compte formateur et ton compte.
3. Sur téléphone, « Copier le lien » peut afficher « Le lien n’a pas pu être copié. » : le navigateur bloque le presse-papiers sur une adresse `http://` autre que `localhost`. En ligne, en `https://`, il fonctionnera.
