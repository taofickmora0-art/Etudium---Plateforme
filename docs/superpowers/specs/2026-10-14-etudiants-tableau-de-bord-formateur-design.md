# Espace formateur : « Étudiants » et tableau de bord — spec

- **Date :** 14 octobre 2026
- **Statut :** design validé en conversation le 14 octobre 2026 ; à relire avant le plan.
- **Origine :** suite de l'espace formateur (après « Mes formations », spec du 13 octobre). Cahier des charges §44 (suivi des apprenants), feuille de route 4.5 et 4.6.
- **Design de référence :**
  - `NdFormateur` est le tableau de bord du formateur, et son menu : Tableau de bord, Mes formations, Corrections, Sessions live, Étudiants, Messages.
  - La page Étudiants n'a pas d'écran dans le design : elle reprend le tableau de `NdAdminUtilisateurs` (en-tête bleu pâle, lignes de 56 px, cadre qui défile sur téléphone).

## 1. Ce qui est décidé

| Question | Décision |
|---|---|
| Périmètre | La page **Étudiants** (liste et fiche) et le **tableau de bord** du formateur |
| Ce que voit le formateur | **Prénom et nom**, jamais l'adresse e-mail |
| Remarques privées | Une par étudiant et par formateur ; lues par **le formateur et l'équipe**, jamais par l'étudiant |
| Modifier la progression | Jamais (cahier des charges §44) |
| Menu | « Étudiants » remplace « Apprenants » ; ordre du design |
| Lots 3 et 5 | Quiz, exercices, certificats, sessions live, messages, questions : « Disponible au lot N » |

## 2. Définitions

Il n'y a pas encore d'inscription : elle arrive au lot 2, avec les achats.
- **Étudiant d'une formation** : un compte qui en a ouvert au moins une leçon. Le compte relié à la fiche formateur de la formation, et les comptes de l'équipe (modérateur, admin, super admin), ne comptent jamais.
- **Progression** : leçons terminées sur leçons de la formation (« 6 / 12 », 50 %).
- **Temps passé** : la vidéo réellement regardée (secondes couvertes, migration 0007). Les leçons sans vidéo ne sont pas chronométrées.
- **Dernière activité** : la plus récente des dates de visite, de fin et d'envoi de visionnage sur la formation.
- **États** :
  - « Terminée » : toutes les leçons sont terminées ;
  - « À risque » : pas terminée, et aucune activité depuis plus de 10 jours ;
  - « En cours » : sinon.
- **Nouveaux ce mois** : les étudiants dont la première leçon ouverte (dans l'une de ses formations) date du mois en cours, à l'heure du Bénin.
- **Taux de complétion** d'une formation : la part de ses étudiants qui l'ont terminée.
- **Progression moyenne** : la moyenne des progressions, pour toutes les paires étudiant–formation.

## 3. Page Étudiants (`/formateur/etudiants`)

- En-tête : « Étudiants », avec « La progression des étudiants de vos formations. »
- **Filtres** : Tous, À risque, Terminés. Un choix de formation (Toutes les formations, puis chacune des siennes). Une recherche par nom. Comme sur la page Utilisateurs, rien de cela ne passe dans l'adresse de la page.
- **Le tableau** a une ligne par étudiant et par formation. Les plus récemment actifs d'abord, 25 lignes par page.
  - Colonnes : Étudiant (initiales et nom), Formation, Progression (barre et « 6 / 12 »), Dernière activité (« 13 oct. 2026 »), État.
  - Le nom mène à la fiche de l'étudiant.
- Pagination : « 25 sur 120 lignes ».
- Sans étudiant : « Aucun étudiant ne suit encore vos formations. »
- Sans résultat après un filtre ou une recherche : « Aucun étudiant ne correspond à cette recherche. »
- Sans fiche formateur, ou avant la migration : les messages de « Mes formations ».

**Fiche d'un étudiant** (`/formateur/etudiants/<identifiant>`) :
- Titre : son prénom et son nom.
- **Pour chacune des formations du formateur qu'il suit** :
  - progression (barre, « 6 / 12 leçons »), temps passé (« 1 h 25 de vidéo »), dernière activité, état ;
  - les leçons, module par module : « Terminée le 12 oct. 2026 », « Ouverte », ou « Pas encore ouverte », avec le temps de vidéo de chacune ;
  - « Quiz, exercices et certificat : disponibles au lot 3 ».
- **Remarque privée** :
  - un champ de texte (2 000 caractères au plus) et un bouton **Enregistrer** ;
  - la mention « Visible par vous et l’équipe Étudium. Jamais par l’étudiant. » ;
  - la date de la dernière modification ;
  - vider le champ, puis enregistrer, supprime la remarque.
- Un compte qui ne suit aucune de ses formations : page introuvable.

**Au back-office**, la fiche d'un compte (page Utilisateurs) reçoit une section « Remarques des formateurs », en lecture seule. Pour chaque remarque : la fiche formateur, la date, le texte.

## 4. Tableau de bord du formateur (`/formateur`, design `NdFormateur`)

- « Bonjour <prénom>. Voici ce qui demande votre attention aujourd’hui. »
- **Les chiffres :**
  - **Formations** : le total, et « N en brouillon » ;
  - **Étudiants** : le total (étudiants distincts), et « +N ce mois » ;
  - **Progression moyenne** : « 67 % », « Toutes formations » ;
  - **Certificats délivrés** : « Disponible au lot 3 ».
- **Étudiants à risque** : « Inactifs depuis plus de 10 jours. »
  - Les 5 plus inactifs, avec la ligne « Inactive depuis 14 jours · Maîtriser Microsoft Excel 22 % ».
  - Chacun a un lien « Voir le suivi » vers sa fiche.
  - Sans étudiant à risque : « Aucun étudiant à risque. »
- **Mes formations**, en tableau (ordre : les plus récemment modifiées) :
  - colonnes : Formation, Inscrits, Progression moyenne, Taux de complétion, Note (« 4,8 », ou « — »), Statut (l'état de relecture : Brouillon, En attente de validation…), et un lien **Modifier** vers son éditeur ;
  - une formation sans étudiant affiche « — » dans les colonnes chiffrées.
- **Exercices à corriger**, **Prochaine session live**, **Question récente** : « Disponible au lot 3 » ou « Disponible au lot 5 », comme au tableau de bord du back-office.
- Sans fiche formateur, ou avant la migration : les messages de « Mes formations ».

## 5. Base de données (migration 0015)

- **Table `remarques_formateur`** :
  - colonnes : le compte du formateur, le compte de l'étudiant, le texte (2 000 caractères au plus), la date de modification ;
  - une ligne par paire ;
  - lecture directe par son auteur et par l'équipe ; écriture seulement par la fonction ci-dessous.
- **Fonctions réservées au formateur** (`security definer`, par `ma_fiche_formateur()`) :
  - **la liste** : recherche, formation, état, page, nombre total ;
  - **la fiche d'un étudiant** : null s'il ne suit aucune de ses formations ;
  - **le tableau de bord** ;
  - **`enregistrer_remarque(étudiant, texte)`** : refusée si l'étudiant ne suit aucune de ses formations ; un texte vide supprime la remarque.
- **Fonction de l'équipe** : les remarques sur un compte, avec le nom de la fiche formateur de chaque auteur.
- **Ce qui n'est jamais livré au formateur** : l'adresse e-mail, et la progression d'un étudiant sur les formations d'autres formateurs.
- **Rejouable.**
- **Avant la 0015** : bandeau « Appliquez la migration 0015 » sur ces pages ; le reste de l'application marche comme avant.

## 6. Menu et pages

- Menu du formateur, dans l'ordre du design : Tableau de bord, Mes formations, Corrections, Sessions live, **Étudiants** (`/formateur/etudiants`), Messages.
- La barre du bas sur téléphone change de la même façon.
- Les pages « Bientôt disponible » « Espace formateur » (tableau de bord) et « Apprenants » disparaissent. L'ancienne adresse `/formateur/apprenants` renvoie vers `/formateur/etudiants`.

## 7. Tests

- **Base (PGlite) :**
  - définitions du §2 : exclusion du formateur et de l'équipe, états, à risque à 10 jours, nouveaux du mois, taux de complétion, temps passé ;
  - un formateur ne voit que les étudiants de ses formations, jamais l'adresse e-mail ;
  - remarques : écrites par leur auteur pour ses seuls étudiants ; lues par l'auteur et l'équipe, pas par l'étudiant ni un autre formateur ; un texte vide supprime ;
  - refus pour un étudiant, un visiteur, un formateur sans fiche ou suspendu ;
  - migration rejouable.
- **Application :** lectures et action de remarque (migration absente, refus).
- **Composants :**
  - tableau des étudiants (vide, filtres hors de l'adresse, états) ;
  - fiche (leçons, remarque) ;
  - tableau de bord (chiffres, à risque, tableau des formations) ;
  - section des remarques au back-office ;
  - menu renommé.
- **Rendu** à 1440, 390 et 320 px : aucun débordement de la page ; les tableaux défilent dans leur cadre.

## 8. Hors de ce travail

- Quiz, exercices, corrections et certificats : lot 3.
- Messagerie, sessions live et questions : lot 5. « Envoyer un message » du design remplacera alors « Voir le suivi ».
- « En retard sur le parcours » (design) : il n'y a pas encore de calendrier de parcours.
