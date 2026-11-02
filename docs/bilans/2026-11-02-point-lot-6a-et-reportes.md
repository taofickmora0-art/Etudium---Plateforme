# Point du 2 novembre 2026 : lot 6 A, spec du lot 6 B, points reportés

Travail fait pendant ton repos, comme demandé : une liste, puis le travail, puis le point à ton réveil. Tout est commité sur `lot-0-fondations`.

## 1. Ce qui est fait

| Partie | Résultat |
|---|---|
| Test d'annulation d'abonnement | Stabilisé : il échouait parfois quand toute la suite tournait. |
| **Lot 6 A, pilotage** | Fini, relu par un relecteur indépendant, corrigé. Migrations 0060, 0061 et 0062, guide §61. |
| **Lot 6 B, engagement** | Spec écrite avec mes recommandations : **à valider avant tout code**. Fichier `docs/superpowers/specs/2026-11-02-lot-6-engagement-design.md`. |
| Points reportés du lot 5 | Push et liens, désactivation, envois : 10 points corrigés. |
| Points reportés du lot 4 | 3 points corrigés (version de départ, leçon supprimée, message de restauration). |

**Vérification finale** : types et lint propres ; suite complète verte, 355 fichiers et 2 461 tests.

### Le lot 6 A en bref

- **Les droits** : le modérateur ne gère que la communauté (modération, annonce épinglée, avis, messages d'assistance, sessions live). L'admin gère tout sauf les rôles, la suppression d'un compte et le journal ; le super admin gère tout. La base le vérifie aussi : appeler la base directement ne contourne rien. Le menu et les pages suivent le rôle.
- **Le journal** : chaque action importante de l'équipe s'écrit toute seule (rôles, suspensions, abonnements, prix, codes promo, formations, versions, avis, modération, annonces). Toi seul le lis (Pilotage › Journal), avec des filtres ; personne ne peut le modifier ni l'effacer.
- **Les comptes** :
  - un admin corrige le nom d'un compte ;
  - toi seul supprimes un compte, en donnant un motif ;
  - sa photo, ses travaux et ses pièces jointes sont effacés ;
  - ses paiements et ses certificats restent (un certificat reste vérifiable).
- **Les statistiques** :
  - le tableau de bord du back-office suit maintenant le design ;
  - la nouvelle page « Statistiques » couvre étudiants, formations et business, sur 30 jours, 3 mois ou 12 mois.

### La relecture indépendante du lot 6 A, et ce que j'ai corrigé

- **Critique** : le modérateur ne pouvait plus programmer une session live. C'est corrigé, avec un test.
- **Important** : supprimer un compte laissait sa photo publique en ligne. Désormais, la base ouvre au super admin les fichiers du compte, ceux-là seulement, le temps de la suppression ; si un fichier ne part pas, la suppression s'arrête.
- **Important** : des entrées vers les contenus restaient visibles au modérateur (« Ajouter une formation », lien vers la fiche d'un auteur, « Modifier les leçons », notification « Formation à valider »). Elles sont cachées ou réservées aux admins.
- **Remontés en importants** : l'achèvement d'une formation pouvait dépasser 100 % ; les paiements d'un compte supprimé s'affichaient sans nom (désormais « Compte supprimé »).

## 2. Ce qui te revient

1. **Les migrations**, dans l'éditeur SQL de Supabase, dans l'ordre : **0055 → 0062**.
   - Après la 0058, recopie le jeton affiché dans `web/.env.local` (`ENVOIS_JETON=…`).
   - Les guides §58 à §61 décrivent chaque étape et les essais à faire.
2. **Valider la spec du lot 6 B** (questions Q1 à Q9). Ma proposition :
   - le tableau de bord sur une page à part, l'Accueil restant la communauté ;
   - l'objectif de la semaine en jours d'apprentissage ;
   - un barème de points léger ;
   - un niveau tous les 200 points ;
   - 8 badges ;
   - des recommandations qui suivent le parcours ;
   - un rappel de série à 18 h.
3. **Payiz en réel** : refais un essai de paiement, pour que je lise l'erreur exacte enregistrée.

## 3. Décisions prises seul (lot 6 A)

1. `domaines_role` est une fonction pure. `equipe_communaute` est accordée aux visiteurs sans compte, comme `equipe_contenus` : les règles des tables les appellent aussi sans compte. Coût : nul.
2. Les fonctions des comptes et des annonces passaient déjà par `equipe_contenus` : elles sont passées aux admins sans réécriture. Coût : nul.
3. Seule la dernière signature des fonctions de sessions est recopiée (les anciennes ont été supprimées en 0024). Coût : nul.
4. Les anciens tests de la base restent tels quels (ils testent leur migration). Je les ai rejoués de force jusqu'à la 0062 : aucun nouvel échec en dehors des refus voulus au modérateur. Coût : nul.
5. Le menu reçoit les domaines du compte une fraction de seconde après l'affichage (la coque s'affiche avant la lecture du compte) ; avant cela, seul « Tableau de bord » s'affiche. Coût : un menu court un instant.
6. Les messages de refus : « Accès réservé à l’équipe. » hors de l'équipe, « Vous n’avez pas accès à cette partie du back-office. » pour un membre hors de son domaine. Coût : nul.
7. « Statistiques » et « Journal » sont entrés au menu en même temps que leurs pages. Coût : nul.
8. Des tests existants ont été mis à jour selon la spec : le programme d'une formation est désormais modifié par l'admin, plus par le modérateur. Coût : nul.
9. Un changement de rôle entre deux rôles de l'équipe donne une seule ligne au journal (« Rôle de X : Modérateur → Administrateur »). Coût : nul.
10. Le déclencheur des formations est nommé de sorte que le changement de statut s'écrive avant la version qu'il crée. Coût : l'ordre de deux lignes.
11. Les suppressions en cascade ne sont pas journalisées : leur cause l'est déjà. Coût : nul.
12. Le motif de suppression d'un compte est obligatoire. Coût : un champ à remplir.
13. *(Remplacée par la correction de la relecture)* La règle de stockage large du début est remplacée par une règle limitée aux fichiers listés pour la suppression en cours.
14. « Gérer le compte » est en bas de la fiche, et les deux actions sont aussi dans le menu ⋮ de la liste. Coût : nul.
15. Les abonnements par mois sont comptés à la date de souscription, pas à leur date de début. Coût : un mois de décalage pour un abonnement acheté d'avance.
16. Le taux de complétion est le nombre de certificats sur le nombre de formations commencées. La progression d'une formation est la moyenne des leçons publiées terminées. Coût : une définition à changer si tu en préfères une autre.
17. « Utilisateurs » compte tous les comptes. Les inscriptions, la conversion et les dernières inscriptions ne comptent que les étudiants. Coût : nul.
18. L'ancien tableau de bord est retiré (la fonction reste en base). Coût : nul.
19. Les graphiques sont renommés « Évolution des inscriptions » et « Évolution des revenus ». Coût : nul.
20. Je n'ai fait aucune vérification visuelle dans le navigateur : les pages demandent une connexion, et je ne me connecte pas à ta place. Coût : un défaut de mise en page à voir lors de ton essai.

## 4. Points mineurs encore reportés

### Lot 6 A

- Supprimer un parcours par l'API remplirait le journal de « Publication supprimée ».
- Résilier des abonnements écrit « annulé » au lieu de « résilié », une ligne par abonnement.
- La vue d'ensemble est à optimiser quand il y aura beaucoup de comptes.
- Les bandeaux « Appliquez la migration » s'affichent aussi pour une panne réseau.
- Les libellés des graphiques sont serrés sur téléphone (3 et 12 mois).
- Les onglets des statistiques n'ont ni `aria-controls` ni navigation aux flèches ; le tri est seulement décroissant.
- Modifier le commentaire d'un autre n'est pas journalisé ; un membre supprimé disparaît du filtre « Auteur ».
- `changerRole` vérifie le domaine « utilisateurs » au lieu de « rôles » (la base refuse quand même).

### Lot 5

- Un abonnement push renouvelé par le navigateur n'est pas repris : il faut rallumer l'interrupteur.
- L'interrupteur dit « Sur cet appareil », alors que l'éteindre coupe le push partout (le guide l'explique).
- Les tests manquants restants de l'étape C : le formateur qui réactive, et une formation archivée qu'on désactive.

### Lot 4

- Revenir à la valeur enregistrée laisse l'état d'échec affiché.
- Un interblocage rare est possible entre enregistrer et publier.
- La limite de 300 Ko est mesurée différemment côté appli et côté base.
- Chaque version garde un instantané complet.
- « En ligne » reste vrai si la formation repasse en brouillon.
- L'identifiant de vidéo est vérifié de façon lâche.
- Les lectures de brouillon se font pour chaque étudiant.
- Saisir dans un très gros document coûte plus cher.
- Pas de « Recharger » sur le conflit des informations générales.
- Publier pendant qu'un enregistrement échoue publie le brouillon précédent, sans le dire.
- Les liens d'images valent une heure sur une page restée ouverte.
- Un enregistrement suspendu bloque les suivants.

## 5. Ensuite

Le **lot 6 B**, dès que tu as validé sa spec. Après lui, la feuille de route est entièrement couverte : il restera la mise en ligne et ces points mineurs.
