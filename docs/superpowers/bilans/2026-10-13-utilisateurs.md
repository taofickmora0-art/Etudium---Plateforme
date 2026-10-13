# Bilan : page Utilisateurs du back-office (13 octobre 2026)

## En bref

- **Back-office → Utilisateurs**, la liste des comptes :
  - pour chaque compte : nom, adresse e-mail, rôles, date d'inscription, dernière connexion, et l'état Actif ou Suspendu ;
  - recherche par nom (les accents et les majuscules ne comptent pas : « fifame » trouve « Fifamè ») ou par adresse e-mail ;
  - filtres Tous, Étudiants, Formateurs, Équipe, Suspendus ; 25 comptes par page, les plus récents d'abord ;
  - **la recherche n'apparaît jamais dans l'adresse de la page** (une adresse e-mail est une donnée personnelle).
- **La fiche d'un compte** : identité, rôles, activité (formations suivies avec « 6 / 12 leçons », avis laissés), suspension.
- **Les rôles** :
  - seul toi (super admin) les changes, avec une confirmation qui résume le changement (« Donner : Formateur. ») ;
  - Étudiant reste toujours coché ;
  - tu ne peux pas te retirer toi-même le rôle super admin ;
  - un compte suspendu ne reçoit pas de nouveau rôle.
- **Formateur** :
  - en donnant ce rôle, tu choisis une fiche formateur libre, ou tu en crées une au nom du compte ;
  - le compte voit alors l'Espace formateur ;
  - retirer le rôle détache la fiche, qui reste avec ses formations.
- **Suspension** :
  - un admin ou toi pour un étudiant ou un formateur ; toi seul pour un membre de l'équipe ;
  - personne ne se suspend soi-même, et un super admin ne se suspend pas (retirer d'abord son rôle) ;
  - motif facultatif, visible de l'équipe seulement ;
  - le compte suspendu est déconnecté à la page suivante, avec « Ce compte est suspendu. Pour en savoir plus, contactez l’équipe Étudium. » ;
  - une nouvelle connexion (mot de passe ou Google) est refusée avec le même message ;
  - **la base lui refuse tout**, même en contournant l'application : back-office, leçons (aperçus compris), progression, notes, favoris, avis, profil, fichiers ;
  - **Réactiver** rend tout, immédiatement ; ses données sont gardées.
- **Migration 0013** :
  - la table des suspensions ;
  - les fonctions de lecture des comptes, réservées à l'équipe ;
  - le changement de rôles avec la fiche formateur ;
  - la suspension et la réactivation.
  - Aucune clé secrète n'est utilisée.
- **Avant la 0013**, la page Utilisateurs affiche un bandeau « Appliquez la migration 0013 » ; le reste de l'application marche comme avant.
- **Vérifications** :
  - 868 tests, dont toutes les règles de la base sur une vraie base Postgres en mémoire ;
  - vérification des types et du code, compilation de production ;
  - rendu mesuré à 1440, 390 et 320 px (nom de 100 caractères, adresse de 60, motif de 500) : aucun débordement.
  - **Pas de vérification dans un navigateur avec de vraies données** : la 0013 n'est pas encore appliquée.

## Corrigé après la relecture finale

La relecture n'a trouvé aucun défaut grave. J'ai corrigé deux failles qu'elle a confirmées sur une base de test :
- **Un compte suspendu pouvait supprimer son propre compte.** La suspension disparaissait avec lui, et il pouvait se réinscrire avec la même adresse, « propre ». Il pouvait aussi continuer à déposer des photos. Désormais, la suppression lui est refusée, et tout le stockage aussi.
- **N'importe quel membre de l'équipe pouvait relier une fiche formateur à un compte** en contournant la page, donc sans toi. C'est ce lien qui donnera ses formations à un formateur à l'étape 3b. Il ne s'écrit plus que par le changement de rôles, donc par toi seul.

## Décisions que j'ai prises pour toi

- **Un compte suspendu ne peut pas supprimer son compte.** Une demande d'effacement passera par l'équipe (lot 6). Coût si faux : une demande à traiter à la main.
- **Couleurs des étiquettes** : Formateur en bleu, rôles d'équipe en violet, Suspendu en rouge. Coût si faux : des couleurs à changer.
- **Le refus de la base est affiché tel quel** dans la fenêtre de confirmation, qui reste ouverte pour réessayer. Exemple : « Vous ne pouvez pas vous retirer le rôle super admin. ». Coût si faux : nul.
- **Limite connue (option A, sans clé secrète)** : la session Supabase n'est pas coupée. Elle ne donne simplement plus accès à rien. Coût si faux : environ une heure pendant laquelle le compte suspendu garde son jeton, sans accès aux données.

## Points mineurs mis de côté

- En passant directement par la base, sans la page, le super admin peut encore se retirer son rôle ou donner un rôle à un compte suspendu.
- Un compte suspendu peut encore lire son propre avis masqué et voir ses formations archivées commencées.
- Si la déconnexion d'un compte suspendu échoue (coupure réseau), le navigateur peut tourner en rond entre deux pages.
- Un membre de l'équipe suspendu qui enregistre quelque chose au back-office voit « L’opération n’a pas abouti » au lieu d'être déconnecté ; il l'est à la page suivante.
- Liste des comptes :
  - après un échec de chargement, le numéro de page affiché peut être faux ;
  - les changements de la liste ne sont pas annoncés aux lecteurs d'écran.
- Sur un téléphone étroit (320 px), un compte qui a quatre ou cinq rôles n'affiche que l'initiale de son nom ; une très longue adresse cache les dates.
- Rejouer une ancienne migration (0001, 0002, 0004 ou 0010) retire la vérification de suspension de certaines règles : il faut alors rejouer la 0013 juste après.

## Ce qui te revient

1. Appliquer dans l'éditeur SQL de Supabase, dans cet ordre, celles que tu n'as pas encore appliquées :
   1. `web/supabase/migrations/0011_statistiques.sql` ;
   2. `web/supabase/migrations/0012_couvertures.sql` ;
   3. `web/supabase/migrations/0013_utilisateurs.sql`.
2. Suivre les sections 16, 17 et 18 du guide `docs/guides/ce-qui-te-revient.md` (environ 30 minutes). La section 18 demande un second compte de test.
3. Si tu rejoues un jour une ancienne migration (0001, 0002, 0004 ou 0010), rejoue la 0013 juste après.
