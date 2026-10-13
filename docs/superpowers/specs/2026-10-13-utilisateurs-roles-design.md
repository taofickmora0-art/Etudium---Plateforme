# Page Utilisateurs du back-office : rôles, fiche formateur, activité, suspension — spec

- **Date :** 13 octobre 2026
- **Statut :** design validé en conversation le 13 octobre 2026 ; à relire avant le plan.
- **Origine :** étape 3 convenue avec l'utilisateur (création de formation par le formateur), découpée en deux :
  - **3a**, cette spec : un endroit du back-office pour gérer les comptes et décider qui devient formateur ou admin ;
  - **3b**, à suivre : l'espace formateur, déjà cadré en conversation (validation par un admin avant la mise en ligne ; le formateur remplit le contenu, l'équipe les réglages commerciaux ; corrections en direct après la mise en ligne).
- **Avance sur la feuille de route :** une partie du lot 6.1 (« Back-office complet : utilisateurs… »). Les permissions fines et le journal des actions restent au lot 6.

## 1. Ce qui est décidé

| Question | Décision |
|---|---|
| Où l'on donne un rôle | Back-office → **Utilisateurs** → la fiche d'un compte (et non la fiche formateur) |
| Fiche d'un compte | Identité, rôles, fiche formateur reliée, activité, suspension |
| Suspension | **A** : notée dans la base, appliquée par l'application **et** par la base, sans clé secrète (l'application refuse toute clé secrète côté serveur, `src/lib/env.ts`) |
| Qui voit | Toute l'équipe du back-office (modérateur, admin, super admin) |
| Qui change les rôles | Le super admin seul (comme la base le prévoit déjà, migration 0001) |
| Qui suspend | Un admin ou le super admin pour un étudiant ou un formateur ; le super admin seul pour un membre de l'équipe ; personne ne se suspend soi-même |

## 2. La liste des comptes (`/admin/utilisateurs`)

- Remplace la page « Bientôt disponible » ; l'entrée **Utilisateurs** du menu du back-office devient active.
- Pour chaque compte : nom (prénom et nom), adresse e-mail, rôles (pastilles), date d'inscription, dernière connexion, état **Actif** ou **Suspendu**. Le nom mène à la fiche.
- **Recherche** par nom ou adresse e-mail (sans tenir compte des majuscules ni des accents du nom), **filtre** par rôle (Tous, Étudiants, Formateurs, Équipe, Suspendus), **25 comptes par page**, les plus récents d'abord.
- **Jamais de donnée personnelle dans l'adresse de la page** : la recherche et le filtre ne sont pas mis dans l'URL (la recherche passe par une action du serveur). Seul le numéro de page peut y figurer.
- Compte sans prénom ni nom : « Sans nom » et l'adresse e-mail.
- Sans compte trouvé : « Aucun compte ne correspond à cette recherche. »

## 3. La fiche d'un compte (`/admin/utilisateurs/<identifiant>`)

**Identité.** Prénom et nom, adresse e-mail, inscription, dernière connexion (« Jamais » s'il ne s'est jamais connecté).

**Rôles.**
- Étudiant : toujours coché, non modifiable (tout compte est étudiant).
- Formateur, Modérateur, Admin, Super admin : cases à cocher, puis **Enregistrer les rôles**, avec une confirmation qui résume le changement (« Donner : Formateur. Retirer : Admin. »).
- Visible par toute l'équipe ; modifiable par le super admin seul (pour les autres, les cases sont grisées avec « Seul le super admin change les rôles. »).
- Garde-fous, vérifiés par la base :
  - le super admin ne peut pas se retirer à lui-même le rôle super admin (il reste donc toujours au moins un super admin) ;
  - un compte suspendu ne reçoit pas de nouveau rôle (le réactiver d'abord).

**Fiche formateur.**
- Quand la case Formateur est cochée sur un compte qui n'a pas de fiche reliée, un choix apparaît : une fiche formateur existante **pas encore reliée à un compte**, ou **Créer une fiche à son nom** (nom = prénom et nom du compte ; « Formateur » si le compte n'a pas de nom). Le choix est obligatoire pour enregistrer.
- Une fois reliée : « Fiche formateur : <nom> », avec un lien vers la fiche au back-office. Ses formations (celles de cette fiche) seront celles de son espace formateur (3b).
- Retirer le rôle Formateur **détache** la fiche : la fiche et ses formations restent telles quelles (en ligne si elles l'étaient), sans compte relié.
- Une fiche n'est reliée qu'à un compte, un compte qu'à une fiche.

**Activité.**
- **Formations suivies** (au moins une leçon ouverte) : titre, progression (« 6 / 12 leçons », barre), dernière activité ; les plus récentes d'abord.
- **Avis laissés** : formation, note, début du commentaire, « Masqué par l'équipe » le cas échéant.
- Sans activité : « Aucune formation commencée. » et « Aucun avis. »

**Suspension.**
- **Suspendre le compte** : confirmation, motif facultatif (500 caractères au plus), visible seulement par l'équipe. Ensuite : pastille « Suspendu depuis le <date>, par <nom> », le motif, et **Réactiver le compte** (confirmation).
- Boutons absents pour qui n'a pas le droit (voir §1) et sur son propre compte.
- Un super admin ne se suspend pas : pour suspendre un compte super admin, retirer d'abord son rôle.

## 4. Ce que fait la suspension (A)

**Dans l'application.**
- À la page suivante (toute page connectée) ou à la prochaine action, le compte suspendu est déconnecté et arrive sur la connexion avec « Ce compte est suspendu. Pour en savoir plus, contactez l'équipe Étudium. »
- Une nouvelle connexion (mot de passe ou Google) est refusée avec le même message : la session ouverte est aussitôt refermée.
- Le message passe par `?erreur=suspendu` (comme `?erreur=google` aujourd'hui) : aucune donnée personnelle.

**Dans la base** (même en contournant l'application), pour un compte suspendu :
- plus aucun droit d'équipe (back-office, contenus, couvertures, ressources) ni de rôle ;
- plus de lecture des leçons (contenu et ressources), y compris les aperçus ;
- plus aucune écriture ni lecture de ses propres données : progression, visionnage, notes, favoris, avis, profil.
- Les données sont gardées ; **Réactiver** rend tout, immédiatement.

**Ce qui reste visible des autres.**
- Ses avis restent affichés sur les fiches ; l'équipe peut les masquer depuis la rubrique Avis, comme aujourd'hui.
- Les formations d'un formateur suspendu restent en ligne ; c'est l'équipe qui décide de les archiver.

**Limite connue :** la session Supabase elle-même n'est pas coupée (cela demanderait la clé secrète, option B écartée) ; elle ne donne simplement plus accès à rien.

## 5. Base de données (migration 0013)

- Table `suspensions` : le compte (clé), depuis, par qui, motif. Lisible par l'équipe seulement ; écrite seulement par les fonctions ci-dessous.
- Fonction `compte_suspendu()` : le compte qui demande est-il suspendu ? Utilisée par :
  - `a_role`, `equipe_contenus` et `acces_lecon` (redéfinies avec cette condition ; leur logique reste la même) ;
  - `peut_donner_avis` et `supprimer_avis` ;
  - des règles **restrictives** sur les données personnelles (progression, notes, favoris, avis, profil) : elles s'ajoutent aux règles existantes sans les réécrire.
- Lien unique entre une fiche formateur et un compte (`formateurs.compte_id`, déjà présent : une seule fiche par compte).
- Fonctions réservées à l'équipe (elles lisent l'adresse e-mail et la dernière connexion dans l'authentification de Supabase, que l'application ne lit pas directement) :
  - la liste (recherche, filtre, page, nombre total) ;
  - la fiche (identité, rôles, suspension, fiche formateur, activité) ;
  - le changement de rôles, d'un seul coup, avec la fiche formateur (reliée, créée ou détachée), réservé au super admin ;
  - suspendre et réactiver, avec les droits du §1.
- Rejouable, comme les autres migrations.
- **Avant la 0013** : la page Utilisateurs affiche « Appliquez la migration 0013 » (comme les autres pages du back-office avant leur migration), et le reste de l'application fonctionne comme aujourd'hui.

## 6. Tests

- **Base (PGlite)** :
  - liste et fiche : visibles par un modérateur, un admin, le super admin ; refusées à un étudiant, un formateur et un visiteur ; recherche par nom et par adresse e-mail ; filtre ; pages de 25 ;
  - rôles : changés par le super admin seul ; Étudiant gardé ; pas de retrait de son propre rôle super admin ; fiche formateur reliée, créée à son nom, détachée au retrait ; une fiche déjà reliée refusée ;
  - suspension : droits du §1 ; pas soi-même ; pas un super admin ; un compte suspendu perd les droits d'équipe, la lecture des leçons et toutes ses écritures ; la réactivation rend tout ;
  - migration rejouable.
- **Application** : déconnexion et message sur une page connectée ; connexion par mot de passe refusée ; retour de Google refusé ; recherche hors de l'adresse de la page.
- **Composants** : liste (vide, avec comptes, suspendu) ; fiche (droits de lecture seule, choix de la fiche formateur obligatoire, confirmations).
- **Rendu** mesuré à 1440, 390 et 320 px : aucun débordement (adresses e-mail longues comprises).

## 7. Hors de ce travail

- L'espace formateur et la création de formation par le formateur : **3b**.
- Modifier le nom d'un compte, supprimer un compte, permissions fines, journal des actions : lot 6.
- Prévenir par e-mail le compte suspendu : plus tard (pas d'envoi d'e-mails applicatifs au lot 1).
