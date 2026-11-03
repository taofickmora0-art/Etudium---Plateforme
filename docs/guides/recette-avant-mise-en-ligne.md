# Recette d'Étudium avant la mise en ligne

Le but : parcourir toute l'appli comme le feront tes utilisateurs, et me signaler ce qui ne va pas. Je ne me connecte jamais : ce que tu vois à l'écran, connecté, personne d'autre ne l'a encore vu. Coche au fur et à mesure. Pour le détail d'un écran, le numéro renvoie à la section du guide « Ce qui te revient ».

**Pour me signaler un problème**, une ligne suffit :
- **l'écran** (ou son adresse) ;
- **ce que tu as fait** ;
- **ce que tu as vu** ;
- **ce que tu attendais**.

Une capture aide beaucoup. Note aussi l'appareil (ordinateur ou téléphone) quand c'est l'affichage qui pose problème.

## 0. Avant de commencer (15 minutes)

- [ ] Les migrations 0063 puis 0064 appliquées (sections 62 et 63).
- [ ] Les envois activés : la clé Resend ou les clés VAPID dans `web/.env.local`, le serveur de dev redémarré, puis back-office › Abonnements et paiements › « Activer les envois » (migration 0071, section 59).
- [ ] Des comptes de test, un par rôle (tu restes super admin) : un **admin**, un **modérateur**, un **formateur**, une **étudiante abonnée**, un **étudiant sans abonnement**. Les rôles se donnent dans back-office › Utilisateurs › ⋮ › « Changer le rôle ».
- [ ] Au moins deux formations publiées dans un même parcours, avec des leçons, un quiz et un exercice ; une formation gratuite.
- [ ] Un ordinateur **et** un téléphone (le téléphone en mode « appli installée » si possible, pour le push).

## 1. Visiteur (non connecté), 10 minutes

- [ ] La page d'accueil publique : textes, liens, formules d'abonnement (section 40).
- [ ] Le catalogue public et une fiche de formation ; une leçon d'aperçu s'ouvre sans compte (sections 7, 52).
- [ ] Vérifier un certificat par son identifiant (section 39).
- [ ] L'inscription par e-mail, puis la connexion ; la connexion Google (section 4).
- [ ] Mot de passe oublié : l'e-mail arrive, le lien fonctionne.

## 2. L'étudiant sans abonnement, 20 minutes

- [ ] **Accueil** : le fil de la communauté, l'annonce épinglée (masquable), les nouvelles formations (sections 32, 46).
- [ ] **Tableau de bord** : bonjour, indicateurs, « Commencez votre première formation », recommandations (section 62).
- [ ] **Formations** : une formation gratuite se suit en entier ; une payante propose de s'abonner (sections 13, 56).
- [ ] **Abonnement** : les trois formules ; le pays (Bénin d'abord), l'indicatif devant le numéro et les opérateurs de ton compte Payiz, Celtiis compris (migration 0072) ; le paiement de test Payiz ; le reçu, avec l'opérateur et le pays ; un code promo limité aux abonnements cochés et l'alerte « Nouvel abonnement » de l'équipe (cloche et e-mail), migration 0073 (sections 53, 56, 71, 72).
- [ ] **Profil** : informations, photo, préférences de notification, mot de passe, objectif de la semaine, carte « Gamification » (sections 45, 62).

## 3. L'étudiante abonnée, 45 minutes

- [ ] **Une leçon vidéo** : le temps regardé, « Leçon terminée » au seuil, la reprise au bon endroit (sections 10, 11).
- [ ] **Une leçon texte** (contenu riche) : titres, listes, images, encadrés, tableaux ; une page restée ouverte plus d'une heure garde ses images.
- [ ] **Les notes et les discussions** d'une leçon (sections 9, 34).
- [ ] **Un quiz** : raté, puis réussi ; le meilleur score (section 37).
- [ ] **Un exercice** : rendre un fichier, puis voir la correction du formateur (section 38).
- [ ] **Le certificat** : délivré quand tout est fait, téléchargeable, vérifiable (section 39).
- [ ] **Le tableau de bord après une journée** :
  - la série passe à 1 jour ;
  - les points et le niveau changent ;
  - « Continuer l’apprentissage » mène à la bonne leçon ;
  - « À faire » montre l'exercice à corriger ;
  - l'activité récente se remplit ;
  - après une formation terminée, la suite du parcours est proposée (section 62).
- [ ] **L'en-tête** : la série et les points de la semaine, qui mènent au tableau de bord ; même chose sur le téléphone (onglet Profil).
- [ ] **Mes formations, Parcours, Favoris, Recherche, Certificats** (sections 8, 13).
- [ ] **Événements** : s'inscrire à une session live, l'ajouter à l'agenda, « Rejoindre » à l'heure ; le replay ensuite (sections 23, 28, 50, 51).
- [ ] **Communauté** : publier (texte, image, vidéo, sondage, programmée), commenter, répondre, aimer, signaler (sections 24 à 31).
- [ ] **Messages** : écrire à un formateur et à l'équipe (section 42).
- [ ] **Notifications** : la cloche en temps réel ; le push sur le téléphone ; l'e-mail d'un paiement (sections 21, 49, 59).
- [ ] **Avis** sur une formation (section 15).

## 4. Le formateur, 30 minutes

- [ ] Son espace seulement : pas d'espace étudiant, ni de série ni de points (section 43).
- [ ] **Tableau de bord** et **Étudiants** : le suivi, les remarques (section 20).
- [ ] **Mes formations** :
  - créer une formation et l'envoyer à valider ;
  - l'éditeur riche, la sauvegarde automatique ;
  - les brouillons d'une formation en ligne, « Publier », l'historique (sections 19, 33, 58).
- [ ] **Corrections** : valider un exercice, demander une correction (section 38).
- [ ] **Sessions live** : en programmer une, avec image de promotion ; elle paraît dans la communauté (sections 23, 29).
- [ ] **Messages** et **Communauté** (côté formateur).

## 5. Le modérateur, 15 minutes

- [ ] Son menu ne montre que la communauté : modération, annonce, avis, messages, sessions live (section 61).
- [ ] Une adresse du back-office hors de son domaine (`/admin/paiements`) le ramène au tableau de bord.
- [ ] **Modération** : garder, supprimer, rétablir une publication signalée (section 25).
- [ ] **Avis** : masquer un avis (son auteur ne le sait pas) (section 15).

## 6. L'admin et le super admin (toi), 45 minutes

- [ ] **Tableau de bord** : les 6 indicateurs, les graphiques, « À traiter » (section 61).
- [ ] **Formations** :
  - valider une formation envoyée par le formateur ;
  - régler gratuite et badge ;
  - désactiver puis réactiver une formation (les étudiants sont prévenus) ;
  - l'archiver (sections 6, 60).
- [ ] **Utilisateurs** :
  - suspendre et réactiver (e-mail) ;
  - changer un rôle ;
  - renommer ;
  - supprimer un compte de test (toi seul) (sections 18, 61).
- [ ] **Paiements et abonnements** :
  - attribuer un abonnement à la main ;
  - annuler un paiement, résilier (sections 57, 63) ;
  - les codes promo.
- [ ] **Annonces** : publier une annonce à tous ou à un parcours (section 21).
- [ ] **Statistiques** : 30 jours, 3 mois, 12 mois ; les trois onglets (section 61).
- [ ] **Journal** (toi seul) : chaque action ci-dessus y est, avec les filtres (section 61).

## 7. Sur le téléphone, 20 minutes

- [ ] La barre du bas, le menu ≡, la page Profil (série et points), la recherche.
- [ ] Une leçon vidéo en plein écran, une leçon texte, un quiz.
- [ ] Le tableau de bord : les blocs les uns sous les autres, rien qui déborde.
- [ ] Publier dans la communauté depuis le téléphone (photo).
- [ ] Le push : l'allumer, recevoir une notification, toucher la notification ouvre la bonne page.

## 7 bis. Inscription, catalogue et formateurs (ajouts du 2 novembre 2026), 20 minutes

À faire après avoir appliqué les migrations 0068, 0069 et 0070, puis lancé `retirer-lot-1.sql` (guide « Ce qui te revient », sections 67 à 70).

- [ ] Catalogue : chaque carte montre « N modules • N leçons », « N apprenants », le résumé, puis « Voir le cours » (ou « N % terminé » si tu es inscrit) ; le titre tient sur deux lignes.
- [ ] Cœur d'une carte : il devient rouge et plein ; la formation apparaît dans Favoris ; un second clic la retire.
- [ ] Fiche d'une formation : les leçons ont un cadenas (sauf les aperçus) ; « S'inscrire à ce cours », puis « Inscription confirmée. » : les cadenas tombent, le bouton devient « Commencer le cours », la formation apparaît dans « Mes formations » et dans « Continuer l'apprentissage ».
- [ ] Sans abonnement, sur une formation payante : le bouton dit « Voir les abonnements ».
- [ ] « Formateur du cours » : photo ou initiales, « N formations », présentation, réseaux ; au survol du nom : « Voir le profil » et « Message » (si tu es inscrit à une de ses formations).
- [ ] « Message » ouvre la conversation dans Messages ; dans « Nouveau message », « Rechercher un formateur » ne propose que les formateurs de tes formations.
- [ ] Page d'un formateur (`/formateurs/…`) : son profil et ses formations.
- [ ] Ouvrir une leçon : la page est comme avant, sans bloc formateur.
- [ ] Avec ton compte admin : pas de bouton « S'inscrire » (tout t'est ouvert).
- [ ] Les formations d'exemple ont disparu du catalogue ; les trois parcours sont toujours là.

## 8. Après la recette

Envoie-moi tes remarques au fil de l'eau ou d'un coup. Je les corrige une par une, et chaque correction te dit quoi revérifier. Ensuite : la mise en ligne.
