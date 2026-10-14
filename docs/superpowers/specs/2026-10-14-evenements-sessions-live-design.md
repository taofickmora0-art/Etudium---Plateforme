# Événements et sessions live — spec

- **Date :** 14 octobre 2026
- **Statut :** design validé en conversation le 14 octobre 2026 ; à relire avant le plan.
- **Origine :** lot 5, deuxième partie (après les notifications). Feuille de route, tâche 5.5 : « Une session programmée apparaît dans le tableau de bord des étudiants concernés ». Cahier des charges, §34 : création et programmation, date, heure, parcours concerné, description, lien externe (Google Meet, Zoom), notification, accès depuis la plateforme ; pas de visioconférence intégrée dans le MVP.
- **Design de référence :**
  - `NdEvenements` : la page, ses onglets, ses cartes, la fenêtre d'inscription ;
  - `NdAccueil` : la carte « Prochaine session live » ;
  - `NdFormateur` : la carte « Prochaine session live » du formateur.
  - Aucun écran ne montre la création d'une session : elle se dessine avec les composants existants (formulaires de l'éditeur de formation, tableau du back-office).
- **Décisions de l'utilisateur :**
  - le formateur et l'équipe créent les sessions ; les étudiants jamais ;
  - chaque nouvelle session est notifiée à tous les comptes, sauf ceux qui ont coupé « Sessions live » ;
  - le lien est visible par tous **10 min avant** le début ;
  - rappels **la veille et 1 h avant** ;
  - l'équipe crée ses sessions au back-office et choisit l'animateur ;
  - le parcours est facultatif.
- **Rôles (migration 0017) :** l'équipe n'a pas l'espace formateur.

## 1. Ce qui est décidé

| Question | Décision |
|---|---|
| Qui crée une session | Un formateur (il en est l'animateur), ou l'équipe (elle choisit l'animateur : une fiche formateur, ou « Équipe Étudium ») |
| Qui la modifie ou l'annule | Le formateur, les siennes ; l'équipe, toutes. Une session terminée ne se modifie plus |
| Annuler | La session reste, marquée annulée : elle quitte « À venir », ses inscrits sont prévenus |
| Qui voit les sessions | Tout compte connecté, inscrit ou non, abonné ou non (règle provisoire jusqu'au lot 2) |
| Le lien | Livré à tout compte connecté de **10 min avant le début jusqu'à la fin** ; avant, la base ne le livre pas. L'animateur et l'équipe le voient toujours |
| L'inscription | Ouverte à tout compte connecté jusqu'à la fin ; désinscription possible avant le début. Elle sert aux rappels, à « Mes inscriptions » et au nombre d'inscriptions ; elle n'est pas nécessaire pour rejoindre |
| Rappels | Aux inscrits, la veille (24 h avant) et 1 h avant, dans la cloche. Le push et l'e-mail suivront, avec la dernière partie du lot 5 |
| Parcours | Facultatif : un parcours (son étiquette s'affiche) ou « Tous les parcours » |
| Textes | Neutres : « Inscription confirmée » au lieu de « Vous êtes inscrite » ; « 128 inscriptions » au lieu de « +128 inscrits » |

## 2. Une session

- **Titre :** 1 à 120 caractères.
- **Description :** facultative, 1 000 caractères au plus.
- **Début :**
  - date et heure, à l'heure du Bénin ;
  - à la création, au moins 10 min dans le futur, au plus un an.
- **Durée :** de 30 min à 4 h, par pas de 15 min ; 1 h par défaut. La fin, c'est le début plus la durée.
- **Lien :** une adresse `https://` de 500 caractères au plus.
- **Plateforme :** déduite du lien par la base, puisque le lien peut être caché :
  - `meet.google.com` → « Google Meet » ;
  - `zoom.us` et ses sous-domaines → « Zoom » ;
  - sinon « En ligne ».
- **Parcours :** facultatif.
- **Animateur :**
  - une fiche formateur, dont la carte affiche le nom ;
  - ou aucune, et la carte affiche « Équipe Étudium ».
- **État :** programmée ou annulée. La date d'annulation est gardée.

## 3. Notifications (catégorie « Sessions live »)

| Événement | Pour qui | Titre · texte |
|---|---|---|
| Une session créée | Tous les comptes, sauf son auteur | « Nouvelle session live : <titre> » · « Samedi 24 octobre à 15 h 00, avec <animateur>. » |
| Date, heure, durée ou lien modifiés | Ses inscrits | « Session live modifiée » · « <titre> : samedi 31 octobre à 15 h 00. » |
| Une session annulée | Ses inscrits | « Session live annulée » · « <titre>, prévue samedi 24 octobre à 15 h 00. » |
| Rappel de la veille (dès 24 h avant) | L'inscrit | « Session live demain » (« Session live aujourd’hui » si c'est le jour même) · « <titre>, à 15 h 00. » |
| Rappel d'1 h avant | L'inscrit | « Session live dans moins d’une heure » · « <titre>, à 15 h 00. Le lien s’ouvre 10 min avant. » |

Toutes mènent à `/evenements`. Dates et heures sont écrites en français par la base, à l'heure du Bénin (« samedi 24 octobre à 15 h 00 »).

**Les rappels sont créés quand l'inscrit ouvre l'application.** La cloche, en se chargeant, demande à la base les rappels dus à ce compte : il n'y a aucune tâche planifiée à mettre en place. Dans ce cas, celui qui « agit » est aussi le destinataire. `notifier` reçoit donc une option pour ne pas l'écarter ; partout ailleurs, l'auteur reste écarté.

Les règles des rappels :
- chacun n'est envoyé qu'une fois ;
- celui de la veille n'est plus envoyé quand celui d'1 h l'a été ;
- une inscription faite moins de 24 h (ou moins d'1 h) avant le début ne déclenche pas aussitôt le rappel dont le moment est déjà passé ;
- si la date change, les rappels repartent de zéro.

## 4. Les écrans

**Événements** (`/evenements`, espace étudiant, design `NdEvenements`) :
- **En-tête :**
  - « Événements » ;
  - « Sessions live avec vos formateurs, sur Google Meet ou Zoom. Un rappel vous est envoyé la veille et 1 h avant. »
- **Onglets :**
  - **À venir** : les sessions programmées pas encore terminées, de la plus proche à la plus lointaine ;
  - **Mes inscriptions** : les siennes pas encore terminées, annulées comprises, marquées « Annulée » ;
  - **Passées** : les siennes terminées, de la plus récente à la plus ancienne.
- **La carte du design :**
  - le jour (« OCT. » / « 24 ») ;
  - l'étiquette du parcours, ou « Tous les parcours » ;
  - « Session live » ;
  - « 128 inscriptions » ;
  - le titre ;
  - « Samedi 24 octobre · 15 h 00 » ;
  - la plateforme ;
  - l'animateur ;
  - la description, repliée sur deux lignes.
- **Les boutons d'une carte :**
  - **Je m’inscris** ; une fois inscrit, l'étiquette « Inscription confirmée » et **Se désinscrire** (avant le début) ;
  - **Rejoindre** (le lien, dans un nouvel onglet), de 10 min avant le début jusqu'à la fin, pour tous ;
  - **En cours** pendant la session.
- **La fenêtre après « Je m’inscris » :**
  - « Inscription confirmée » ;
  - « <titre>, samedi 24 octobre à 15 h 00, sur Google Meet. Un rappel vous sera envoyé la veille et 1 h avant. » ;
  - **Ajouter à mon agenda** télécharge un fichier `.ics` (Google Agenda, Outlook, téléphone), avec le titre, l'heure, la durée, et `/evenements` comme adresse : le lien n'est pas encore connu ;
  - **Fermer**.
- **Vide :**
  - « Aucune session programmée » · « Les prochaines sessions live apparaîtront ici. » ;
  - « Aucune inscription pour le moment » · « Inscrivez-vous à une session live pour la retrouver ici. Un rappel vous sera envoyé la veille et 1 h avant. » · **Voir les sessions à venir** ;
  - « Aucune session passée » · « Les sessions de vos inscriptions apparaîtront ici une fois terminées. » · **Voir les sessions à venir**.

**Accueil de l'étudiant** (design `NdAccueil`) :
- la carte « Prochaine session live », avec un lien « Événements » ;
- elle montre la plus proche de ses inscriptions, sinon la prochaine session programmée ;
- sans session, la carte n'apparaît pas.

**Espace formateur → Sessions live** (`/formateur/sessions`, remplace la page à venir) :
- **La liste :** ses sessions à venir, puis les passées. Chaque ligne : date, titre, plateforme, nombre d'inscriptions, état. **Nouvelle session**.
- **Le formulaire** (`/formateur/sessions/nouvelle`) : titre, description, date, heure, durée, lien, parcours. **Programmer la session**.
- **La fiche d'une session** (`/formateur/sessions/<id>`) :
  - ses informations et le lien ;
  - la liste « Inscriptions » : prénom et nom, **jamais l'adresse e-mail** ;
  - **Modifier** (même formulaire, sauf si elle est terminée) ;
  - **Annuler la session**, avec la confirmation « Annuler cette session ? » · « Les <N> personnes inscrites seront prévenues. Elle ne pourra pas être reprogrammée. ».
- **Tableau de bord du formateur** (design `NdFormateur`) : la carte « Prochaine session live » remplace « Disponible au lot 5 ». Elle montre :
  - « Aujourd’hui », « Demain » ou « Dans 2 jours » ;
  - le titre, la date, la plateforme ;
  - les initiales des 5 premiers inscrits, puis « +N » ;
  - « Voir la session ».
  - Sans session à venir : « Aucune session programmée. » et **Nouvelle session**.

**Back-office → Sessions live** (`/admin/sessions`, groupe Contenus, après Avis) :
- la même liste, pour toutes les sessions, avec l'animateur ;
- le même formulaire, plus le choix de l'animateur (les fiches formateur, et « Équipe Étudium ») ;
- la même fiche, avec le lien, les inscrits, la modification et l'annulation ;
- le tableau de bord : la tuile « Sessions live à venir » affiche leur nombre.

## 5. Base de données (migration 0018)

- **Table `sessions_live`.** Aucun accès direct pour les comptes : tout passe par les fonctions.
  - Colonnes :
    - `id` ;
    - `titre`, `description` ;
    - `debut timestamptz`, `duree_minutes` ;
    - `lien` ;
    - `parcours_id` → parcours, `on delete set null` ;
    - `formateur_id` → fiche formateur, `on delete set null` (nul : Équipe Étudium) ;
    - `statut` (`programmee` ou `annulee`), `annulee_le` ;
    - `cree_par` → profils ;
    - `cree_le`, `modifie_le`.
  - Contraintes du §2.
- **Table `inscriptions_sessions`.** Aucun accès direct.
  - Colonnes : `session_id`, `profil_id`, `inscrit_le`, `rappel_veille_le`, `rappel_heure_le`.
  - Clé : `(session_id, profil_id)`, en cascade.
- **Fonctions des comptes connectés.** Un compte suspendu n'obtient rien et ne peut rien faire.
  - `sessions_live(p_vue, p_maintenant)`, où `p_vue` vaut `a_venir`, `inscriptions` ou `passees` :
    - rend les cartes du §4 : id, titre, description, début, durée, plateforme, parcours (nom court et couleur), animateur, nombre d'inscriptions, `inscrit`, `statut` ;
    - le `lien` seulement dans la fenêtre du §1, ou pour l'animateur et l'équipe.
  - `prochaine_session(p_maintenant)` : la carte de l'accueil.
  - `sinscrire_session(p_session)` : session programmée, pas terminée ; une seconde inscription ne change rien.
  - `se_desinscrire_session(p_session)` : avant le début.
  - `rappels_sessions(p_maintenant)` : crée les rappels dus au compte qui demande (§3) et rend leur nombre.
- **Fonctions de l'animateur et de l'équipe.** Un formateur n'agit que sur les sessions de sa fiche ; l'équipe sur toutes.
  - `creer_session(...)` : le formateur est toujours l'animateur, et la valeur reçue pour `formateur_id` est ignorée ; l'équipe la choisit.
  - `modifier_session(p_session, ...)` : refusé pour une session terminée ou annulée.
  - `annuler_session(p_session)`.
  - `sessions_animees(p_maintenant)` : celles du formateur.
  - `sessions_equipe(p_maintenant)` : toutes, pour l'équipe.
  - `session_detail(p_session)` : les informations, le lien et les inscrits (prénom et nom).
- **Notifications** du §3 par `notifier`. L'option « inclure le destinataire même s'il est l'auteur » sert aux rappels seulement.
- **Messages de refus** (affichés tels quels) :
  - « Cette session n’est pas la vôtre. » ;
  - « Une session terminée ne se modifie plus. » ;
  - « Choisissez une date au moins 10 minutes dans le futur. » ;
  - « Le lien doit commencer par https:// » ;
  - « Les inscriptions à cette session sont closes. ».
- **Rejouable**, comme les autres migrations.
- **Avant la 0018 :**
  - les pages Événements et Sessions live, et la rubrique du back-office, affichent « Appliquez la migration 0018 (guide « Ce qui te revient », section 23). » ;
  - les cartes « Prochaine session live » restent comme aujourd'hui ;
  - la cloche marche sans les rappels.

## 6. Tests

- **Base (PGlite) :**
  - création par un formateur (toujours sa fiche) et par l'équipe (animateur choisi) ;
  - refus pour un étudiant, un formateur sur la session d'un autre, une session terminée, une date passée, un lien non `https` ;
  - **le lien** : absent 11 min avant, présent 10 min avant et pendant, absent après la fin ; toujours présent pour l'animateur et l'équipe ;
  - inscription et désinscription, nombre d'inscriptions, onglets « À venir », « Mes inscriptions » et « Passées » ;
  - notifications : création à tous les comptes sauf l'auteur et sauf ceux qui ont coupé la catégorie ; modification et annulation aux inscrits seulement ;
  - **rappels** :
    - la veille puis 1 h avant, une seule fois chacun ;
    - pas de rappel déjà passé au moment de l'inscription ;
    - remise à zéro si la date change ;
    - « aujourd’hui » ou « demain » selon le jour au Bénin ;
  - jamais d'adresse e-mail dans ce qui est livré ; compte suspendu ; visiteur refusé ;
  - migration rejouable.
- **Application :**
  - lectures et actions (paramètres, refus, avant la 0018) ;
  - dates en français ;
  - fichier `.ics` (heure UTC correcte, texte échappé) ;
  - « Dans 2 jours ».
- **Composants :**
  - page Événements (onglets, cartes, inscription, fenêtre, Rejoindre à 10 min, vides) ;
  - carte de l'accueil ;
  - espace formateur (liste, formulaire, fiche avec inscrits, annulation) ;
  - carte du tableau de bord ;
  - rubrique du back-office (choix de l'animateur) ;
  - la cloche demande les rappels.
- **Rendu** à 1440, 390 et 320 px : aucun débordement (titre de 120 caractères, description de 1 000).

## 7. Hors de cette partie

- Le push et l'e-mail des notifications et des rappels : dernière partie du lot 5 (une tâche planifiée sera alors ajoutée).
- Le replay ou l'enregistrement d'une session ; une limite de places ; la liste d'attente.
- Les sessions réservées aux abonnés d'un parcours : lot 2.
- La visioconférence intégrée : exclue du MVP par le cahier des charges.
- Les autres types d'événements (atelier, salon…) : une session live est aujourd'hui le seul type.
