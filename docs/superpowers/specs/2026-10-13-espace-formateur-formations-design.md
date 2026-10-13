# Espace formateur : « Mes formations » — spec

- **Date :** 13 octobre 2026
- **Statut :** design validé en conversation le 13 octobre 2026 ; à relire avant le plan.
- **Origine :** étape 3 convenue avec l'utilisateur, partie **3b**. La partie 3a (page Utilisateurs, fiche formateur reliée à un compte) est faite. La partie suivante, **Apprenants**, aura sa propre spec.
- **Avance sur la feuille de route :** une partie des tâches 4.1 (« un formateur ne voit et ne modifie que ses formations ») et 4.3 (« un formateur crée une formation complète sans passer par l'admin ») du lot 4. L'éditeur riche (4.2) et l'historique des versions (4.4) restent au lot 4.

## 1. Ce qui est décidé

| Question | Décision |
|---|---|
| Ses formations | Celles de **sa fiche formateur** (reliée à son compte par le super admin, page Utilisateurs), y compris celles que l'équipe a créées pour lui |
| Ce qu'il remplit | Le **contenu** : titre, adresse, résumé, description, objectifs, compétences, niveau, parcours, image de couverture, programme (modules, leçons, vidéos, ressources) |
| Ce qui reste à l'équipe | Les **réglages commerciaux** : gratuite, prix, « Disponible seule », badge, seuil des vidéos, formateur attribué ; l'état (publier, archiver) |
| Mise en ligne | **Validation par un admin** : le formateur envoie en relecture, un admin publie ou renvoie avec une remarque |
| Pendant la relecture | Le formateur **peut continuer à modifier** ; l'admin voit toujours la dernière version |
| Après la mise en ligne | Corrections **en direct** ; l'équipe voit « Modifiée par le formateur le … » |
| Renvoi au formateur | Remarque **obligatoire** (1 000 caractères au plus) |
| Suppression | Le formateur supprime seulement un brouillon jamais publié |
| Back-office | Jamais pour le formateur |

## 2. États d'une formation

L'état enregistré (`statut` : brouillon, publiée, archivée) ne change pas ; la relecture s'y ajoute.

| État affiché | Ce que c'est |
|---|---|
| **Brouillon** | brouillon, pas encore envoyé |
| **En attente de validation** | brouillon envoyé en relecture par le formateur |
| **À corriger** | brouillon renvoyé par un admin, avec sa remarque |
| **Publiée** | en ligne |
| **Archivée** | retirée du catalogue (comme aujourd'hui) |

Passages d'un état à l'autre :
- **Envoyer en relecture** (le formateur) : de Brouillon ou À corriger vers En attente. Il faut au moins une leçon, comme pour publier.
- **Renvoyer au formateur** (l'équipe, remarque obligatoire) : d'En attente vers À corriger.
- **Publier** (l'équipe) : comme aujourd'hui, depuis tout brouillon, envoyé ou non. L'envoi et la remarque sont effacés.
- **Archiver, republier** (l'équipe) : comme aujourd'hui.

## 3. Espace formateur

**Mes formations** (`/formateur/formations`) :
- La liste de ses formations : titre, parcours, niveau, nombre de leçons, et l'étiquette de l'état. Les plus récemment modifiées viennent d'abord.
- **Nouvelle formation** (`/formateur/formations/nouvelle`) : un titre, puis la formation naît en brouillon, à son nom. Le bouton « Ajouter une formation » de l'en-tête de l'espace formateur mène ici.
- Sans formation : « Vous n'avez pas encore de formation. Créez-en une : elle reste un brouillon tant que vous ne l'envoyez pas en relecture. »
- Compte formateur sans fiche reliée (ou fiche détachée) : « Votre compte n'est pas encore relié à une fiche formateur. Contactez l'équipe Étudium. »

**L'éditeur** (`/formateur/formations/<id>`, puis `…/lecons/<id>`) : le même que celui du back-office, mêmes onglets, mêmes formulaires.
- **Informations** :
  - les champs du contenu, l'image de couverture ;
  - pas de choix du formateur ;
  - les réglages commerciaux en lecture seule, dans un bloc « Réglé par l'équipe Étudium » : gratuite ou non, prix, disponible seule, badge, seuil des vidéos.
- **Programme** : modules, leçons, vidéos, ressources ; page de leçon et ressources comme au back-office.
- **Publication**, selon l'état :
  - Brouillon : explication et **Envoyer en relecture** (confirmation) ; **Supprimer le brouillon** (confirmation) s'il n'a jamais été publié ;
  - En attente : « Envoyée en relecture le <date>. Un admin la relit ; vous pouvez continuer à la modifier. » ;
  - À corriger : la remarque de l'admin et sa date, puis **Envoyer en relecture** ;
  - Publiée : « En ligne depuis le <date>. Vos corrections sont visibles tout de suite. » ;
  - Archivée : « Archivée par l'équipe Étudium. »
- Fil d'Ariane : Espace formateur › Mes formations › titre de la formation (› leçon).
- Une formation qui n'est pas la sienne : page introuvable.

## 4. Back-office

- **Liste des formations :**
  - étiquettes « En attente de validation » et « À corriger » ;
  - un filtre **En attente** à côté de Brouillons, Publiées, Archivées.
- **Onglet Publication d'une formation envoyée :**
  - « Envoyée en relecture le <date> par <fiche formateur> » ;
  - **Publier** (inchangé) et **Renvoyer au formateur** : une fenêtre avec la remarque obligatoire.
- **Formation publiée modifiée par son formateur :**
  - « Modifiée par le formateur le <date> » dans l'onglet Publication ;
  - la même mention dans le sous-titre de la ligne de la liste.

## 5. Base de données (migration 0014)

**Colonnes de `formations`** : `envoyee_le`, `renvoyee_le`, `remarque_relecture` (1 000 caractères au plus), `modifiee_par_formateur_le`.

**Qui est le formateur d'une formation.**
- `ma_fiche_formateur()` : la fiche reliée au compte qui demande, s'il a le rôle formateur et n'est pas suspendu (`a_role` tient déjà compte de la suspension).
- `formateur_de(formation)` : la formation appartient-elle à cette fiche ?

**Lecture.**
- La règle de lecture des formations ajoute « ou c'est la sienne » à la règle actuelle (0009 : publiée, équipe, ou commencée). Il reste une seule règle de lecture par table.
- Les modules et leçons suivent.
- `acces_lecon` ajoute « ou c'est sa formation » : contenu des leçons, ressources et leurs fichiers. La vérification de suspension (0013) est gardée.

**Écriture.**
- Des règles « le formateur écrit dans ses formations » sur `formations`, `formations_parcours`, `modules`, `lecons`, `lecons_contenus`, `ressources` (ajout, modification, suppression).
- Pour une formation créée par le formateur : sa fiche doit être le formateur attribué.

**Garde-fous** (déclencheur sur `formations`, pour qui n'est pas de l'équipe) :
- **À la création :**
  - brouillon, attribuée à sa fiche (refus sans fiche) ;
  - réglages commerciaux par défaut (pas gratuite, pas disponible seule, sans prix ni badge, seuil par défaut) ;
  - pas d'envoi ni de remarque.
- **À la modification :** refus de changer l'état, le formateur attribué, les réglages commerciaux, l'envoi et la remarque. Le message : « Ce réglage revient à l’équipe Étudium. »
- **Date de modification :** après la mise en ligne, toute modification par le formateur note `modifiee_par_formateur_le`. Cela vaut pour la formation et pour son programme (modules, leçons, contenus, ressources, parcours).

**Fonctions.**
- `envoyer_en_relecture(formation)` : le formateur de la formation, sur un brouillon d'au moins une leçon.
- `renvoyer_au_formateur(formation, remarque)` : l'équipe, sur une formation en attente, remarque de 1 à 1 000 caractères (espaces retirés au début et à la fin).
- **À la publication** (passage à publiée), l'envoi, le renvoi et la remarque sont effacés.

**Stockage.**
- Couvertures et ressources : le formateur liste, dépose, remplace et supprime dans le dossier de ses formations.
- Le reste ne change pas pour l'équipe.

**Avant la 0014 :**
- l'espace formateur affiche « Appliquez la migration 0014 » sur Mes formations ;
- le back-office marche comme aujourd'hui (colonnes absentes : lecture sans elles, comme pour les couvertures).

Rejouable, comme les autres migrations.

## 6. Application

- **Un seul éditeur**, réglé par l'espace (`admin` ou `formateur`) :
  - adresses de base (`/admin/formations` ou `/formateur/formations`) ;
  - champs affichés ;
  - panneau de publication ;
  - racine du fil d'Ariane.
- **Les actions de contenu** existantes acceptent le formateur sur ses formations :
  - garde commune : l'équipe, ou le formateur de cette formation ;
  - pour un formateur, l'enregistrement des Informations n'écrit que les champs du contenu ;
  - nouvelles actions : envoyer en relecture (formateur), renvoyer au formateur (équipe).
- **La base revérifie tout** (§5) : une requête recopiée par un autre compte ne passe pas.

## 7. Tests

- **Base (PGlite) :**
  - le formateur voit et modifie ses formations, leur programme et leurs fichiers ; pas celles d'un autre formateur ni celles sans formateur ;
  - il ne change ni l'état, ni les réglages commerciaux, ni le formateur attribué, ni la relecture : à la création comme à la modification, et même en écrivant directement dans la table ;
  - passages d'état du §2, remarque obligatoire ;
  - la publication efface l'envoi ;
  - date de modification notée après la mise en ligne seulement ;
  - refus pour un formateur sans fiche, suspendu, ou pour un étudiant ;
  - l'équipe n'est pas gênée ;
  - migration rejouable.
- **Application :**
  - garde ;
  - actions en tant que formateur (champs commerciaux ignorés, adresses de l'espace formateur) ;
  - envoyer en relecture ;
  - renvoyer au formateur (remarque obligatoire).
- **Composants :**
  - éditeur en mode formateur (champs masqués, bloc en lecture seule, liens vers l'espace formateur) ;
  - panneau de publication du formateur (5 états) et de l'équipe (formation en attente) ;
  - liste Mes formations (vide, sans fiche, avec états).
- **Rendu** mesuré à 1440, 390 et 320 px : aucun débordement.

## 8. Hors de ce travail

- **Apprenants** : partie suivante, avec sa spec.
- **Tableau de bord du formateur**, **Corrections** (avec les exercices, lot 3), **Sessions live** et **Messages** (lot 5).
- **E-mails** à l'admin (formation envoyée) ou au formateur (formation renvoyée).
- **Droits ponctuels** sur les formations d'un autre formateur (CDC §45), **éditeur riche** (4.2), **historique des versions** (4.4).
