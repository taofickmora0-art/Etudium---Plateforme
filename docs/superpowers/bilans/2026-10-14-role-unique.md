# Bilan : un seul rôle par compte (14 octobre 2026)

Demande du 14 octobre : deux espaces au plus par compte. Validée en conversation (un seul rôle ; les comptes qui cumulaient perdent Formateur).

## En bref

- **La règle :**
  - chaque compte a l'espace étudiant ;
  - en plus, soit l'espace formateur (rôle Formateur), soit le back-office (Modérateur, Admin ou Super admin), jamais les deux ;
  - la base le garantit : un déclencheur donne un message clair, et un index unique tient même face à deux demandes simultanées.
- **L'espace formateur est réservé au rôle Formateur.** Le super admin n'y entre plus ; il gère toutes les formations depuis le back-office. Le message « Votre compte n'est pas encore relié à une fiche formateur » ne s'affiche donc plus sur ton compte.
- **Plus de fiche formateur à choisir.**
  - Donner le rôle Formateur crée sa fiche à son nom.
  - Un compte qui perd ce rôle est détaché de sa fiche, et ses formations y restent.
  - S'il redevient formateur, il retrouve sa fiche et ses formations.
- **Changer le rôle :** menu **⋮** de la liste des utilisateurs, ou page du compte. Une fenêtre propose un seul choix parmi Étudiant, Formateur, Modérateur, Admin et Super admin, chacun avec ses espaces. Le super admin seul peut le faire.
- **Notifications :**
  - « Vous êtes formateur » en devenant formateur ;
  - « Vous faites partie de l’équipe » seulement en entrant dans l'équipe, pas en passant d'Admin à Modérateur.
- **Migration 0017 :**
  - elle remet en ordre les comptes existants : qui cumulait Formateur et l'équipe perd Formateur ; qui avait plusieurs rôles d'équipe garde le plus élevé ; chaque formateur reçoit une fiche ;
  - elle est rejouable ;
  - elle remplace l'ancienne fonction de la 0013.
- **Tests sur téléphone :** le serveur de développement accepte les adresses du réseau local (`http://192.168.0.3:3000` aujourd'hui).
- **Vérifications :** 1 073 tests, vérification des types et du code. Une relecture par opus n'a trouvé aucun problème critique.

## Corrigé après la relecture

- Les guides décrivaient encore l'ancien fonctionnement : espace formateur du super admin, cases à cocher. Et la commande « Devenir super-administrateur » aurait été refusée sur un compte qui a déjà un rôle. Tout est corrigé.
- Un index unique garantit la règle même pour deux demandes simultanées.

## Points mineurs mis de côté

- Un formateur dont la fiche a été supprimée ne peut pas être réparé par « Formateur », puisque c'est déjà son rôle. Il faut passer par Étudiant, puis Formateur.
- Dans la fenêtre, après un refus de la base, le message rouge reste affiché si l'on choisit un autre rôle. Il disparaît à la fermeture.
- La description du rôle Modérateur ne dit pas qu'il gère aussi les formations.
- Quelques cas de la migration sont vérifiés par la relecture, mais pas encore par des tests permanents : rejeu de toute la chaîne, insertion de plusieurs lignes à la fois.
- L'utilisatrice du mode démonstration a encore deux rôles. C'est sans effet hors démonstration.

## Ce qui te revient

1. Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0017_role_unique.sql` (après la 0016).
2. Suis la section 22 du guide `docs/guides/ce-qui-te-revient.md`.
