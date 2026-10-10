# Étudium — Feuille de route de la plateforme

- **Date :** 9 octobre 2026
- **Statut :** à valider
- **Sources :** `Projet Claude Code/doc/` (cahier des charges V1 et design system), maquette PNG à la racine du dossier

Ce document découpe la plateforme en **lots**, puis chaque lot en **tâches**. Chaque tâche indique ce que tu vérifies avant qu'on passe à la suivante. Il ne remplace pas le cahier des charges : c'est l'ordre dans lequel on va le construire.

---

## 1. Méthode de travail

1. Chaque lot commence par une **spec détaillée** (tâche X.0) : écrans, données, règles. Tu la relis et tu la valides avant que j'écrive du code.
2. Ensuite, je livre **une tâche à la fois**. Je te dis quoi vérifier (colonne « Tu valides quand… »).
3. Tu vérifies, tu me dis OK ou ce qui ne va pas. On ne passe à la tâche suivante qu'après ton OK.
4. Les tâches marquées **(toi)** demandent une manipulation de ta part dans un tableau de bord (création de compte, saisie d'une clé secrète…). Je te fournis à chaque fois un guide pas à pas.

Les tâches des lots 4 à 6 sont volontairement moins détaillées : elles seront précisées dans la spec de leur lot, quand on y arrivera.

---

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Stack | Next.js + TypeScript + Tailwind, hébergé sur Vercel |
| Données, comptes, fichiers | Supabase, dans un **projet séparé** de celui du calculateur |
| E-mails | Resend |
| Design de référence | L’artefact **« Étudium — Nouveau design »** (https://claude.ai/artifact/9Ei2bCdhG75Nr3KnFZQxfg) : tous les écrans, leurs états, les composants et la version téléphone. Il remplace le PDF pour tout ce qui est visuel. |
| Charte | Celle du nouveau design : fond `#F2F6FD`, coque `#E9EFFB`, panneaux blancs, bleu Étudium `#0B18C9` pour l’action, police Inter, grands arrondis (12 à 32 px), icônes **Hugeicons** (contour 1,5 px), mode clair au lancement |
| Connexion | **E-mail + mot de passe** avec vérification par e-mail, et **connexion Google** (présente dans le design). Pas de connexion par téléphone. |
| Vidéo | **YouTube** (non répertorié) pour les formations gratuites, **Vimeo** (offre payante, lecture limitée au domaine Étudium) pour les formations payantes |
| Modération | Une IA (Claude Haiku) classe chaque publication : autoriser, signaler ou bloquer |
| Paiement | **Payiz** et **SasPay**. Le module de paiement est indépendant du prestataire : chacun se branche dessus de la même façon. |
| Déploiement | Chaque envoi sur GitHub met à jour le site (Vercel) et applique automatiquement les changements de la base (Supabase). Tu saisis toi-même les clés secrètes une seule fois dans GitHub et Supabase ; je ne les vois jamais. |
| Lancement public | Après le lot 3 (apprendre, payer, être certifié). Les lots 4 à 6 s'ajoutent ensuite. |

---

## 3. Vue d'ensemble

| Lot | Résultat | Étape clé |
|---|---|---|
| 0. Fondations | On crée un compte et on navigue dans une appli vide, aux couleurs d'Étudium | |
| 1. Catalogue + apprentissage | On suit des formations gratuites de bout en bout | Ouverture possible en version gratuite |
| 2. Abonnements + paiement | On vend des abonnements et des formations complémentaires | Premiers revenus |
| 3. Quiz, exercices, certificats | On délivre des certificats vérifiables | **Lancement public** |
| 4. Espace formateur | Des formateurs externes créent et suivent leurs formations | |
| 5. Communauté + accompagnement | Communauté, messagerie, sessions live, notifications | |
| 6. Pilotage + engagement | Statistiques, gamification, recommandations | |

---

## 4. Lots et tâches

### Lot 0 — Fondations

| # | Tâche | Tu valides quand… |
|---|---|---|
| 0.0 | Spec détaillée du lot 0 | Tu as relu et approuvé la spec |
| 0.1 | Mise en place : dépôt GitHub, projet Next.js, projet Supabase dédié, déploiement Vercel automatique, mises à jour automatiques de la base. **(toi)** : créer le projet Supabase, le dépôt GitHub, relier Vercel, saisir les clés | Une page « Étudium » est en ligne, et une modification envoyée sur GitHub apparaît toute seule sur le site |
| 0.2 | Design system en code, repris des planches « Composants » du nouveau design : fondations, boutons et étiquettes, formulaires, cartes et tableaux, navigation, messages et états vides, menus, modales ; une page vitrine qui les montre tous | La page vitrine correspond aux planches « Composants » du design |
| 0.3 | Mise en page de l'appli : header (logo, recherche, notifications, profil), sidebar par sections, drawer sur tablette, menu bas sur mobile | Sur ton téléphone et sur ton ordinateur, tu navigues entre les pages (encore vides) sans problème d'affichage |
| 0.4 | Inscription et connexion par e-mail : vérification de l'adresse, mot de passe oublié, e-mails aux couleurs d'Étudium ; connexion Google si confirmée (question 1). **(toi)** : configurer le domaine d'envoi dans Resend | Tu crées un compte, tu reçois l'e-mail de vérification, tu te connectes, tu réinitialises ton mot de passe |
| 0.5 | Profil étudiant : photo, nom, prénom, pays, niveau d'études, établissement, filière, objectifs, préférences de notification | Tu modifies ton profil et les changements restent après rechargement de la page |
| 0.6 | Rôles et permissions : étudiant, formateur, administrateur/modérateur, super-administrateur ; pages protégées ; ton compte devient super-administrateur | Un compte étudiant ne peut pas ouvrir les pages réservées à l'administration |
| 0.7 | Appli installable (PWA) : icône, écran de lancement, installation | Tu installes Étudium sur ton téléphone depuis le navigateur et elle s'ouvre comme une appli |

### Lot 1 — Catalogue + apprentissage

| # | Tâche | Tu valides quand… |
|---|---|---|
| 1.0 | Spec détaillée du lot 1 | Tu as relu et approuvé la spec |
| 1.1 | Structure des contenus : parcours, formations (gratuite/payante, active/archivée, achat séparé oui/non), modules, leçons, ressources. Une formation peut appartenir à plusieurs parcours. | Des données d'exemple sont visibles dans Supabase |
| 1.2 | Back-office minimal de saisie : créer et modifier parcours, formations, modules, leçons et ressources (formulaires simples ; l'éditeur riche arrive au lot 4) | Tu crées toi-même une formation complète (2 modules, 4 leçons) |
| 1.3 | Catalogue public et fiche formation : filtres (parcours, niveau, gratuit/payant, note), fiche complète, aperçu gratuit, aperçu du lien quand on le partage | Tu partages une fiche sur WhatsApp et l'aperçu (titre + image) s'affiche |
| 1.4 | Page parcours : présentation, couleur du parcours, liste des formations avec leur progression | La page correspond au design system (section 24) |
| 1.5 | Interface de cours : programme à gauche, contenu à droite, onglets sous la vidéo, leçon précédente/suivante | Tu suis une leçon de bout en bout, sur téléphone et sur ordinateur |
| 1.6 | Lecteur vidéo YouTube et Vimeo : contrôles aux couleurs d'Étudium, reprise de lecture, calcul du temps réellement regardé, seuil de validation réglable. **(toi)** : ouvrir le compte Vimeo | Une vidéo sautée jusqu'à la fin n'est **pas** validée ; une vidéo regardée l'est |
| 1.7 | Progression : pourcentage par formation, leçons terminées, reprise de la dernière leçon | Après quelques leçons, le pourcentage affiché est juste |
| 1.8 | Ressources : téléchargeables ou non ; visualiseur intégré (PDF, images) pour celles qui ne le sont pas | Un PDF protégé s'affiche dans le visualiseur, sans bouton de téléchargement |
| 1.9 | Mes formations (avec filtres), favoris, recherche globale | Tu retrouves une formation par la recherche et via tes favoris |
| 1.10 | Tableau de bord étudiant, version de base : progression globale, formations en cours, « Continuer l'apprentissage » | En te connectant, tu reprends ta dernière leçon en un clic |
| 1.11 | Avis et notes : à partir de 50 % de progression, un avis par formation, modifiable ; note moyenne sur la fiche | Sous 50 %, tu ne peux pas noter ; au-dessus, ta note apparaît sur la fiche |
| 1.12 | Landing page publique (les 14 sections du cahier) et FAQ ; bouton principal vers la création d'un compte gratuit | Tu as relu les textes et la mise en page sur téléphone et ordinateur |

### Lot 2 — Abonnements + paiement

| # | Tâche | Tu valides quand… |
|---|---|---|
| 2.0 | Spec détaillée du lot 2, avec étude de Payiz et SasPay (API, confirmation de paiement, frais, opérateurs couverts) | Tu as validé le rôle de chaque prestataire et la spec |
| 2.1 | Formules réglables dans le back-office : prix, durée, nombre de parcours, limite de formations complémentaires, avantages, actif/inactif | Tu changes un prix dans l'admin et la page Tarifs se met à jour |
| 2.2 | Page Tarifs et souscription : choix de la formule, choix des parcours, récapitulatif | Tu vas jusqu'au récapitulatif avec chacune des trois formules |
| 2.3 | Module de paiement + Payiz : paiement, confirmation, activation automatique, gestion des échecs. **(toi)** : saisir les clés Payiz | Un paiement de test réussi donne l'accès immédiatement ; un paiement échoué affiche un message clair et ne donne aucun accès |
| 2.4 | Branchement de SasPay sur le même module. **(toi)** : saisir les clés SasPay | Mêmes vérifications qu'en 2.3, avec SasPay |
| 2.5 | Droits d'accès : un abonnement actif ouvre ses parcours ; à l'expiration, formations verrouillées mais visibles, avec un bouton « Renouveler » | Sur un abonnement expiré (simulé), les formations sont verrouillées et rien n'est perdu |
| 2.6 | Renouvellement : rappels par e-mail avant l'expiration, nouveau choix des parcours | Tu reçois le rappel et tu renouvelles avec d'autres parcours |
| 2.7 | Formations complémentaires : achat unique, limite selon la formule, tarif de dépassement, accès restauré au renouvellement | Une formation achetée reste sur ton compte après expiration puis renouvellement, sans repayer |
| 2.8 | Changement de formule : upgrade immédiat au prorata, downgrade au renouvellement suivant | Le montant au prorata est juste sur des exemples chiffrés |
| 2.9 | Promotions et codes promo : pourcentage ou montant fixe, dates, limite d'utilisation | Un code promo valide réduit le prix ; un code expiré est refusé |
| 2.10 | Espace Abonnement / Facturation (historique, reçus) et suivi des paiements dans le back-office | Tu retrouves chaque paiement de test, côté étudiant et côté admin |

### Lot 3 — Quiz, exercices, certificats

| # | Tâche | Tu valides quand… |
|---|---|---|
| 3.0 | Spec détaillée du lot 3 | Tu as relu et approuvé la spec |
| 3.1 | Quiz : QCM, réponses multiples, vrai/faux, réponse courte ; tentatives illimitées ; score minimal réglable par formation ; ne bloque jamais la progression | Tu crées un quiz et tu le passes plusieurs fois |
| 3.2 | Exercices simples : consigne, puis « marquer comme terminé » | L'exercice apparaît comme terminé dans la progression |
| 3.3 | Exercices avec rendu : dépôt de fichier, versions successives, statut « Validé » ou « À corriger » avec remarque privée ; écran de correction simple | Tu déposes un travail, il est mis « À corriger », tu redéposes, il est validé |
| 3.4 | Page « Validation de la formation » : récapitulatif des conditions remplies et manquantes | Le certificat reste verrouillé tant qu'une condition manque |
| 3.5 | Certificat PDF et image : nom, formation, date, identifiant unique, QR Code, design institutionnel | Le certificat téléchargé respecte la charte |
| 3.6 | Page publique de vérification, sans compte | En scannant le QR Code avec ton téléphone, tu tombes sur la page de vérification |
| 3.7 | Recette avant lancement : parcours complet visiteur → compte gratuit → abonné → certificat, sur téléphone | Tu donnes le feu vert du lancement |

### Lot 4 — Espace formateur

| # | Tâche | Tu valides quand… |
|---|---|---|
| 4.0 | Spec détaillée du lot 4 | Tu as relu et approuvé la spec |
| 4.1 | Attribution des formations aux formateurs, droits ponctuels sur d'autres formations | Un formateur ne voit et ne modifie que ses formations |
| 4.2 | Éditeur riche (titres, listes, images, tableaux, blocs d'info, médias) avec sauvegarde automatique et indicateur « Enregistré » | Tu fermes la page en pleine saisie et rien n'est perdu |
| 4.3 | Éditeur de formation en sections, de « Informations générales » à « Paramètres » | Un formateur crée une formation complète sans passer par l'admin |
| 4.4 | Historique des versions et restauration | Tu restaures une ancienne version d'une formation |
| 4.5 | Suivi des apprenants : progression détaillée, temps, quiz, exercices, certificat ; remarques privées | Le formateur voit la progression exacte d'un étudiant de test |
| 4.6 | Dashboard formateur : indicateurs, étudiants à risque, exercices à corriger | Les chiffres correspondent aux données de test |

### Lot 5 — Communauté + accompagnement

| # | Tâche | Tu valides quand… |
|---|---|---|
| 5.0 | Spec détaillée du lot 5 | Tu as relu et approuvé la spec |
| 5.1 | Espaces de communauté (général + un par parcours) et droits d'accès (lecture seule pour les comptes gratuits et les anciens abonnés) | Un compte gratuit lit l'espace général mais ne peut pas publier |
| 5.2 | Publications, commentaires, réponses, réactions, modification et suppression | Tu publies avec une image, quelqu'un commente et réagit |
| 5.3 | Modération automatique des publications par IA, signalements, file de modération dans l'admin | Une publication d'arnaque de test est bloquée ; une publication douteuse arrive dans la file |
| 5.4 | Messagerie privée entre étudiant et formateur | Un étudiant et un formateur échangent des messages |
| 5.5 | Sessions live : programmation, lien Meet ou Zoom, accès depuis la plateforme | Une session programmée apparaît dans le tableau de bord des étudiants concernés |
| 5.6 | Centre de notifications, préférences par catégorie, notifications push (PWA), e-mails importants | Tu désactives une catégorie et tu ne reçois plus ces notifications |
| 5.7 | Désactivation d'une formation : accès suspendus, notifications aux étudiants concernés | Les étudiants concernés reçoivent la notification, l'e-mail et le push |

### Lot 6 — Pilotage + engagement

| # | Tâche | Tu valides quand… |
|---|---|---|
| 6.0 | Spec détaillée du lot 6 | Tu as relu et approuvé la spec |
| 6.1 | Back-office complet : utilisateurs, formateurs, administrateurs avec permissions fines, journal des actions importantes | Un modérateur n'accède qu'à ce que tu lui as autorisé |
| 6.2 | Statistiques : étudiants, formations, business (abonnements, revenus, conversions) | Les chiffres correspondent aux données de test |
| 6.3 | Tableau de bord étudiant complet : objectifs, temps d'apprentissage, activité récente, prochaine session | Le tableau de bord répond aux 4 questions du design system (section 22) |
| 6.4 | Gamification : points, badges, niveaux, séries de jours | Une série de 3 jours d'apprentissage s'affiche correctement |
| 6.5 | Recommandations personnalisées | Après avoir terminé une formation, une suite logique t'est proposée |

---

## 5. Questions ouvertes

1. ~~Connexion Google~~ : réglé, le design l’inclut.
2. **Payiz et SasPay :** je n'ai pas trouvé leur documentation publique. Au lot 2, il me faudra leurs liens ou leur documentation API, et savoir pourquoi deux prestataires (opérateurs différents, ou l'un en secours de l'autre ?).
3. **Adresse du site :** le calculateur est sur `calculateur.etudium.online`. Hypothèse : la plateforme sur `etudium.online`. À confirmer avant la tâche 0.1.
