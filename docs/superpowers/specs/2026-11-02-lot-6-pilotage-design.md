# Lot 6, partie A : pilotage (droits par rôle, journal, comptes, statistiques) — spec

Feuille de route : tâches 6.1 et 6.2. Cahier des charges :
- §46 : « permissions définies » ;
- §54 : « permissions granulaires », « journalisation des actions importantes » ;
- §56 : statistiques étudiants, formations, business ;
- §59 : l'administration du MVP.

Design :
- `NdAdmin` : vue d'ensemble ;
- `NdAdminUtilisateurs` et `NdAdminMenuUtilisateur` : menu ⋮ par compte.

## Les choix (validés le 2 novembre 2026)

| # | Question | Choix |
|---|---|---|
| Q1 | Comment régler les droits de l'équipe ? | **Rôles fixes.** Chaque rôle ouvre des domaines fixes ; pas de réglage par personne. |
| Q2 | Que voit un modérateur ? | **La communauté** : la modération et les signalements, l'annonce épinglée de la communauté, les avis des formations, les messages d'assistance et les sessions live. Il ne voit ni les formations, ni les utilisateurs, ni les paiements, ni les statistiques. |
| Q3 | Qui lit le journal ? | **Le super admin seul**, avec des filtres. Personne ne le modifie ni ne l'efface. |
| Q4 | Comment organiser les statistiques ? | **La vue d'ensemble du design**, plus une page « Statistiques » sur une période au choix (30 jours, 3 mois, 12 mois). |
| Q5 | Renommer et supprimer un compte ? | **Les deux.** Un admin renomme un compte ; le super admin seul le supprime. |
| Q6 | Où faire respecter les droits ? | **Dans la base et dans l'appli.** La base refuse ; l'appli cache le menu et les pages. |
| Q7 | Qui écrit le journal ? | **La base**, dans la même opération que l'action. |

## 1. Les domaines du back-office

| Domaine | Ce qu'il couvre | Modérateur | Admin | Super admin |
|---|---|---|---|---|
| `communaute` | modération et signalements, réglages de l'analyse, annonce épinglée, publications et commentaires des autres, sondages, avis, messages d'assistance, sessions live et replays | oui | oui | oui |
| `contenus` | parcours, fiches formateurs, formations, leçons, quiz, corrections, brouillons, versions, désactivation | — | oui | oui |
| `utilisateurs` | comptes (liste, fiche, renommer, suspendre), remarques, annonces à tous les comptes | — | oui | oui |
| `paiements` | paiements, abonnements, formules, codes promo | — | oui | oui |
| `statistiques` | vue d'ensemble chiffrée, page « Statistiques » | — | oui | oui |
| `roles` | changer le rôle d'un compte, supprimer un compte | — | — | oui |
| `journal` | lire le journal des actions | — | — | oui |

Un compte suspendu n'a plus aucun domaine.

### 1.1 Dans la base (migration 0060)

- **`equipe_communaute()`** est la nouvelle fonction de l'équipe : modérateur, admin ou super admin, compte actif. C'est l'ancien sens de `equipe_contenus()`.
- **`equipe_contenus()`** est redéfinie : admin ou super admin, compte actif. D'un coup, toutes les règles des contenus (24 règles des tables, espaces de fichiers, fonctions d'édition) et les lectures des paiements et des comptes se ferment aux modérateurs.
- **`exiger_equipe_moderation()`** passe par `equipe_communaute()`.
- **Les fonctions de la communauté** qui appelaient `equipe_contenus()` sont redéfinies, à l'identique, avec `equipe_communaute()`. Il y en a 27, et 2 règles d'espace de fichiers. Elles sont recopiées automatiquement depuis leur dernière définition ; la liste est dans le plan.
- **Les lectures des paiements** passaient par `exiger_equipe_moderation()` : elles passent par une vérification admin. Il s'agit de `codes_promo_equipe`, `paiements_equipe`, `paiement_equipe`, `resume_paiements` et `abonnements_compte`.
- **`acces_abonne` et `peut_lire_espace`** comptent l'équipe de la communauté comme abonnée : le modérateur lit tous les espaces, les replays et les sessions.
- **Le modérateur perd :**
  - l'accès sans abonnement aux leçons (`acces_lecon`) : il modère les discussions de leçons depuis la file de modération ;
  - la lecture des formations en brouillon.

### 1.2 Dans l'appli

- **`src/lib/auth/domaines.ts`** décrit les domaines de chaque rôle et dit si un compte a un domaine. Un test vérifie que la table de la base et celle de l'appli donnent les mêmes domaines.
- **Le menu du back-office** n'affiche que les entrées des domaines du compte ; un groupe vide disparaît. Cela vaut pour la barre latérale, le tiroir et la barre du bas sur téléphone.
- **Chaque page du back-office** demande son domaine. Sans ce domaine, le compte revient à la vue d'ensemble.
- **Les actions du serveur** demandent aussi leur domaine ; la base reste le vrai garde.
- **La vue d'ensemble d'un modérateur** ne montre que ce qu'il a à traiter : signalements, contenus à examiner, messages d'assistance non lus, prochaines sessions live.

## 2. Le journal des actions (migration 0061)

### 2.1 La table

**`journal_actions`** a les colonnes suivantes :
- numéro et date ;
- auteur (le compte, et son nom figé au moment de l'action) ;
- catégorie : `comptes`, `paiements`, `contenus` ou `communaute` ;
- action (un code) ;
- cible : type, identifiant et libellé figé ;
- résumé lisible, en français ;
- détails (JSON).

Elle n'a aucun droit d'écriture, de modification ou d'effacement pour qui que ce soit. On lit ses lignes par une fonction réservée au super admin.

### 2.2 Ce qui est journalisé

Une action est journalisée quand son auteur est un membre de l'équipe (`equipe_communaute()`). Les actions des étudiants, des formateurs, des tâches planifiées et de Payiz n'y entrent pas.

| Catégorie | Actions |
|---|---|
| comptes | rôle ajouté ou retiré, compte suspendu (avec le motif) ou réactivé, compte renommé, compte supprimé, annonce envoyée à tous |
| paiements | abonnement attribué à la main, abonnement annulé ou résilié (avec le motif), prix d'une formule changé (ancien → nouveau), code promo créé, modifié ou supprimé, paiements activés ou désactivés |
| contenus | formation publiée, archivée, désactivée, réactivée ou supprimée, version notée (mise en ligne, modifications publiées, restauration publiée) |
| communaute | avis masqué ou réaffiché, publication bloquée ou rétablie, contenu d'un autre supprimé, annonce épinglée publiée, modifiée ou retirée, réglages de l'analyse changés |

Chaque action a son déclencheur sur la table qu'elle modifie, ce qui évite de recopier les fonctions existantes. Un changement de rôle donne deux lignes (rôle retiré, rôle ajouté).

### 2.3 La page « Journal » (super admin)

- **Sur la page** :
  - une ligne par action : date et heure (heure du Bénin), auteur, catégorie, résumé ;
  - des filtres : catégorie, auteur (les membres de l'équipe), période (7 jours, 30 jours, 12 mois, tout) ;
  - 50 lignes, puis « Voir plus ».
- **Écran** : il n'est pas dans le design. Il se compose avec le tableau et les filtres de `NdAdminUtilisateurs`.

## 3. Renommer et supprimer un compte (migration 0061)

### 3.1 Renommer

**`renommer_compte(compte, prénom, nom)`** :
- **Qui** : un admin (domaine `utilisateurs`) ; le compte d'un membre de l'équipe, le super admin seul.
- **Les valeurs** : 1 à 60 caractères chacune, espaces retirés.
- **Trace** : l'action est journalisée.
- **Où** : le menu ⋮ et la fiche du compte, sous « Modifier le nom ».

### 3.2 Supprimer

**`supprimer_compte(compte, motif)`** :
- **Qui** : le super admin seul. Jamais soi-même, jamais un autre super admin.
- **Avant la suppression** : l'action est journalisée avec le nom et l'adresse figés.
- **Ce qui part** : le compte, avec tout ce que la base efface en cascade.
- **Ce qui reste** :
  - les paiements, sans propriétaire ;
  - les certificats délivrés, qui restent vérifiables.
- **Où** : le menu ⋮ propose « Supprimer le compte ». La fenêtre de confirmation dit ce qui part et ce qui reste, et demande le motif.
- **Les fichiers du compte** (photo, rendus d'exercices, pièces jointes des messages) sont retirés par le serveur avant la suppression, comme pour « Supprimer mon compte ».

## 4. Les statistiques (migration 0062)

Les chiffres sont calculés à la demande. Les mois et les jours sont ceux du Bénin.

### 4.1 La vue d'ensemble (`NdAdmin`, domaine `statistiques`)

**`vue_ensemble_back_office()`** fournit ce que montre le design, dans son ordre :

1. **Six indicateurs** :
   - Utilisateurs (« +N ce mois ») ;
   - Abonnés actifs (évolution sur un mois) ;
   - Revenus du mois (FCFA) ;
   - Formations (« N en brouillon ») ;
   - Certificats (« Depuis le lancement ») ;
   - Taux de complétion (formations terminées sur formations commencées).
2. **Abonnements par mois**, sur 6 mois : les nouveaux (premier abonnement du compte) et les renouvellements (le compte en avait déjà un).
3. **Formules les plus choisies** : la part de chaque formule parmi les abonnements actifs.
4. **À traiter** :
   - les signalements et contenus à examiner ;
   - les paiements échoués des dernières 48 heures ;
   - les paiements en attente depuis plus de 15 minutes ;
   - les abonnements qui finissent dans 7 jours, sans suivant.
5. **Dernières inscriptions** : 4, avec la formule (ou « Gratuit »).
6. **Derniers paiements** : 5, avec l'objet, le moyen, le montant, le statut et la date.

L'ancien tableau de bord (`statistiques_back_office`) n'est plus affiché ; la fonction reste en base.

### 4.2 La page « Statistiques » (domaine `statistiques`)

**`statistiques_periode(jours)`** prend 30, 90 ou 365 jours. La page a trois onglets.

- **Étudiants** :
  - nouveaux inscrits (et leur courbe par semaine, ou par mois sur 12 mois) ;
  - étudiants actifs (une leçon ouverte sur la période) ;
  - leçons terminées, formations terminées (certificats délivrés) ;
  - quiz passés et part de réussite, exercices validés ;
  - temps de vidéo regardé (les leçons vues sur la période).
- **Formations**, une ligne par formation publiée ou désactivée :
  - étudiants qui la suivent, dont les nouveaux sur la période ;
  - progression moyenne et taux d'achèvement ;
  - temps de vidéo regardé ;
  - note moyenne et nombre d'avis ;
  - certificats délivrés sur la période.
  - Elle se trie par colonne.
- **Business** :
  - abonnés actifs aujourd'hui ;
  - nouveaux abonnements et renouvellements, revenus (et leur courbe) ;
  - conversion : inscrits de la période devenus abonnés ;
  - formules les plus choisies ;
  - codes promo utilisés et remise totale.

### 4.3 Ce qui est mesuré, et ce qui ne l'est pas

- **Le temps d'apprentissage** n'est mesuré que pour les vidéos suivies : YouTube, Vimeo, TikTok et Tella, en secondes réellement vues. Le texte, Loom, ScreenPal et Drive n'ont pas de mesure : la page l'écrit sous le chiffre.
- **Les « formations complémentaires »** du §56 n'existent plus depuis la restructuration (l'abonnement ouvre tout) : rien à compter.

## 5. Ce qui te revient

1. Appliquer les migrations 0060, 0061 et 0062.
2. Vérifier avec un compte modérateur :
   - son menu ne montre que la communauté ;
   - une adresse comme `/admin/formations` le ramène à la vue d'ensemble.
3. Changer le rôle d'un compte de test, le suspendre et le réactiver, puis lire le journal en super admin.
4. Comparer la vue d'ensemble et la page « Statistiques » aux données de test.

## 6. Tests

- **La base, avec un compte de chaque rôle** :
  - le modérateur modère, épingle une annonce, masque un avis, gère une session et répond à l'assistance ;
  - il ne modifie pas une formation, ne lit ni les paiements, ni les comptes, ni les statistiques, ni le journal ;
  - l'admin fait tout sauf les rôles, la suppression d'un compte et la lecture du journal ;
  - chaque action de la liste écrit sa ligne au journal, les actions d'un étudiant n'en écrivent pas, et personne ne modifie ni n'efface une ligne ;
  - les chiffres de la vue d'ensemble et de la page « Statistiques » sur des données de test connues.
- **L'appli** :
  - les domaines identiques dans la base et dans l'appli ;
  - le menu filtré et les pages gardées ;
  - la vue d'ensemble du modérateur ;
  - la page « Journal » avec ses filtres ;
  - renommer et supprimer depuis le menu ⋮ ;
  - les onglets de la page « Statistiques ».

## Hors de cette partie

- **Le lot 6 B** : le tableau de bord étudiant, la gamification et les recommandations.
- **Les droits ponctuels d'un formateur** sur une autre formation (§45).
- **Les exports CSV.**
