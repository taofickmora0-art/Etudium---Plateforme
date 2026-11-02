# Étudium — Lot 2 : abonnements, paiement Payiz et codes promo

- **Date :** 1er novembre 2026
- **Remplace :** les tâches 2.0 à 2.10 de la feuille de route (`2026-10-09-feuille-de-route-design.md`), déjà réécrites par la restructuration (`2026-10-20-restructuration-design.md`, §5.1).
- **Décidé avec toi le 1er novembre :**
  - **Payiz (payiz.app) seul.** SasPay sort du projet : on n'a pas trouvé de service de ce nom au Bénin.
  - **Paiement direct dans Étudium :** l'étudiant saisit son numéro chez nous, puis valide sur son téléphone.
  - **Les codes promo dès cette livraison.**
- **Prochaine migration :** 0049.
- **Mise à jour du 3 novembre 2026 :** le paiement est ouvert à tous les pays et à tous les opérateurs de Payiz (Celtiis compris). Les pays et les opérateurs sont lus chez Payiz (`GET /v1/payment_methods`, gardés 5 minutes ; à défaut, le Bénin avec MTN et Moov), le pays et l'opérateur partent avec chaque paiement, et le pays et le nom de l'opérateur sont gardés (migration 0072, guide « Ce qui te revient », section 71). Ce qui suit parle encore de « MTN ou Moov » : c'est l'état du 1er novembre.

## 1. Ce que fait ce lot

Un compte gratuit choisit **Basique (3 mois), Standard (6 mois) ou Premium (1 an)**. Il paie par Mobile Money (MTN ou Moov) sans quitter Étudium, éventuellement avec un code promo. Son accès s'ouvre aussitôt le paiement confirmé.

Un abonnement pris avant la fin du précédent **ajoute sa durée** à la date de fin. À la fin, les formations payantes se verrouillent, mais rien n'est perdu : progression, certificats, publications.

L'étudiant retrouve son abonnement et ses paiements (avec leurs reçus) dans « Mon abonnement ». L'équipe règle les prix et les codes promo, et suit les paiements, au back-office.

**Tu valides quand :**
- tu fixes le prix de Standard au back-office, et la page d'accueil l'affiche ;
- avec un code promo de 20 %, le récapitulatif affiche le bon montant ; un code expiré est refusé ;
- un paiement de test réussi (simulateur Payiz) ouvre aussitôt une formation payante, et « Mon abonnement » affiche la date de fin et le reçu ;
- un paiement de test refusé (solde insuffisant) affiche un message clair, permet un nouvel essai et n'ouvre rien ;
- un second abonnement pris avant la fin ajoute bien sa durée à la date de fin ;
- un abonnement expiré (date simulée) reverrouille les formations payantes, avec « Renouveler » ;
- tu retrouves chaque paiement de test au back-office, et les tuiles du tableau de bord se remplissent.

## 2. Payiz : ce qu'on utilise

Documentation : https://docs.payiz.app (étudiée le 1er novembre 2026).

- **Clés :** une clé secrète `sk_test_…` en mode test (simulateur, aucun argent ne bouge), puis `sk_live_…` en réel. Elle n'est utilisée que sur le serveur.
- **Créer et lancer le paiement en un appel :** `POST /v1/payments`.
  - Contenu : `amount` (en FCFA, minimum 1 000), `currency: "XOF"`, `reference` (l'identifiant du paiement chez nous), `metadata`, et `payer: { phone, operator }`.
  - En-tête `Idempotency-Key` (l'identifiant du paiement chez nous) : un double clic ne crée pas deux paiements.
  - Le numéro est au format international (`+229…`). L'opérateur est facultatif : Payiz le déduit du numéro, et répond `operator_required` s'il hésite.
- **Nouvel essai** sur le même paiement, avec le même numéro ou un autre : `POST /v1/payments/{id}/attempts`. Un seul essai peut être en cours à la fois.
- **États :**
  - d'un paiement : `requires_payment`, `processing`, `succeeded`, `expired`, `canceled` ;
  - d'un essai : `pending`, `succeeded`, `failed`, `expired`.
- **Motifs d'échec** (`failure_code`) : `insufficient_funds`, `payer_declined`, `timeout`, `invalid_phone`, `operator_limit`, `operator_unavailable`, `declined`, `unknown`.
- **Relire un paiement :** `GET /v1/payments/{id}`.
- **Notifications** vers une adresse d'Étudium : `payment.succeeded`, `payment.attempt_failed`, `payment.expired`, `payment.canceled`.
  - Elles sont signées dans l'en-tête `Payiz-Signature` (`t=…,v1=…`) : HMAC-SHA256 de `t + "." + corps brut`, avec un secret propre à l'adresse déclarée.
  - On refuse toute signature de plus de 5 minutes.
  - Elles peuvent arriver deux fois ou dans le désordre : on les dédoublonne par leur `id`.
- **Frais** à la charge d'Étudium (`fees_paid_by: "merchant"`) : l'étudiant paie exactement le prix affiché. Payiz prend environ 3,7 % sur MTN Bénin, et rien sur un paiement échoué.
- **Simulateur** (clés de test) : les deux derniers chiffres du numéro décident du résultat.
  - `…00` : réussi en 5 s ;
  - `…01` : solde insuffisant ;
  - `…02` : refusé par le payeur ;
  - `…03` : sans réponse, expiré en 90 s ;
  - `…04` : incertain, puis réussi en 2 min ;
  - `…05` : opérateur injoignable ;
  - `…06` : réussi sans notification (on le retrouve en relisant le paiement).
- **À vérifier au premier essai de test :** que `amount` se compte bien en francs CFA. La documentation parle d'« unité mineure », et le franc CFA n'en a pas.

## 3. Comment un paiement se confirme (sûr, et testable en local)

1. **Lancement.** L'étudiant valide son numéro. Le serveur d'Étudium :
   - enregistre le paiement en base (`en_attente`, montant, abonnement, code promo) ;
   - appelle Payiz avec la clé secrète ;
   - garde l'identifiant Payiz (`pay_…`).
   L'écran passe à « Validez la demande sur votre téléphone ».
2. **Attente.** L'écran redemande l'état toutes les 3 secondes, pendant au plus 3 minutes. À chaque fois, le serveur **relit le paiement chez Payiz** (`GET /v1/payments/{id}`) :
   - **réussi :** l'abonnement est activé, et l'écran affiche « Paiement réussi » ;
   - **essai échoué :** le motif s'affiche en clair, avec « Réessayer » (même numéro ou un autre) ;
   - **expiré :** « La demande a expiré », avec « Recommencer ».
3. **Notifications de Payiz** (`/api/paiements/payiz`). Elles font la même chose, même si l'étudiant a fermé la page.
   - Leur signature est vérifiée avant toute lecture.
   - En local, Payiz ne peut pas joindre l'ordinateur : l'étape 2 suffit.
4. **Activation unique.**
   - **Qui peut confirmer :** seulement le serveur. Il appelle une fonction de la base avec un **jeton serveur** (`PAIEMENT_JETON`), comme la modération (`MODERATION_JETON`). La base n'en garde que l'empreinte, posée par l'équipe quand elle active les paiements au back-office. Un étudiant ne peut donc jamais déclarer son propre paiement réussi.
   - **Ce qui est vérifié :** le montant et l'abonnement confirmés doivent correspondre au paiement enregistré.
   - **Une seule fois :** la relecture et la notification peuvent arriver toutes les deux, l'abonnement n'est créé qu'une fois.
5. **Durée qui s'ajoute.** Le nouvel abonnement commence à la fin du précédent s'il court encore, sinon tout de suite. Sa fin est le début plus 3, 6 ou 12 mois.

**Secrets** (saisis par toi dans `web/.env.local`, jamais montrés à Claude) :
- `PAYIZ_CLE_SECRETE` ;
- `PAYIZ_SECRET_WEBHOOK` ;
- `PAIEMENT_JETON`, une longue chaîne au hasard, que le guide t'apprendra à générer.

## 4. Les données (migration 0049)

- **`formules`** : les trois abonnements, créés par la migration.
  - Colonnes : `code` (basique, standard, premium), `nom`, `duree_mois` (3, 6, 12), `prix_fcfa` (vide tant qu'il n'est pas fixé ; sinon 1 000 au moins), `recommandee`, `active`, `ordre`.
  - Lisibles par tous ; modifiables par l'équipe.
- **`codes_promo`**.
  - Colonnes : `code` (en majuscules, unique), `type` (pourcentage ou montant), `valeur`, `debut`, `fin`, `limite` (nombre total d'utilisations, vide pour sans limite), `actif`, `cree_par`.
  - Lisibles et modifiables par l'équipe seulement. Un étudiant ne fait que les **essayer**, par une fonction qui renvoie le montant final ou le motif du refus.
- **`paiements`**.
  - Colonnes : identifiant (sert de référence chez Payiz), `profil_id`, `formule_id`, `code_promo_id`, `prix_initial`, `remise`, `montant`, `statut` (en_attente, reussi, echoue, expire, annule), `payiz_id`, `operateur`, `telephone_masque` (+229 •• •• •• 00), `motif_echec`, `cree_le`, `confirme_le`, `numero_recu` (ET-R-2026-000123, attribué à la réussite).
  - Chaque compte lit les siens ; l'équipe lit tout. Personne n'écrit directement : seules les fonctions de la base le font.
- **`abonnements`** : `profil_id`, `formule_id`, `paiement_id` (unique), `debut`, `fin`.
  - Lisibles par leur compte et l'équipe. Créés seulement par l'activation.
- **`evenements_payiz`** : les identifiants des notifications déjà traitées (dédoublonnage).
- **Fonctions :**
  - `abonne(profil)`, `fin_abonnement(profil)` ;
  - `essayer_code(code, formule)` ;
  - `preparer_paiement(formule, code)`, qui calcule le montant et enregistre le paiement ; si un paiement est déjà en cours pour ce compte, il le renvoie au lieu d'en créer un second (choix 3) ;
  - `confirmer_paiement(paiement, payiz, jeton)` et `noter_echec(paiement, motif, jeton)`.

## 5. Les droits d'accès

Un **abonnement actif** (aujourd'hui entre `debut` et `fin`) ouvre :
- **toutes les leçons** des formations payantes : `acces_lecon` gagne la condition « ou abonné » ;
- **tous les espaces de la communauté** : `peut_lire_espace` gagne « ou abonné » (restructuration, §5.4) ;
- **les lives et leurs replays** : voir le choix 1 ;
- **les certificats** des formations validées : rien ne change, une formation terminée reste terminée.

L'équipe et le formateur gardent leurs accès actuels. Le formateur n'a ni abonnement ni « Mon abonnement » (R1).

À l'expiration, aucun traitement n'est nécessaire : l'accès se calcule à la date du jour.

## 6. Les écrans

Les écrans reprennent ceux du design de référence : NdTarifs, NdAbonnement, NdMobPaiement, le bandeau « Renouveler », ainsi que les cartes de formules et le tableau des paiements de la vitrine.

**Page d'accueil et « Tarifs » :** les cartes affichent le prix fixé au back-office, ou « Prix annoncés au lancement » s'il manque. « Choisir » mène à la souscription : le visiteur crée d'abord son compte, puis il y revient.

**« Mon abonnement »** (`/abonnement`, à la place de « Bientôt disponible ») :
- l'état :
  - « Compte gratuit » ;
  - « Standard, actif jusqu'au 14 mars 2027 » ;
  - ou « Expiré le … » ;
- « S'abonner », ou « Prolonger » quand un abonnement court ;
- l'historique des paiements : date, abonnement, opérateur, montant, état, « Voir le reçu ».

**Souscription** (`/abonnement/souscrire`) :
1. les trois abonnements, Standard mis en avant ;
2. le récapitulatif : abonnement, durée, dates de début et de fin calculées, prix, champ « Code promo » (« Appliquer ») ;
3. le numéro de téléphone, avec choix de l'opérateur (MTN, Moov) proposé automatiquement d'après le numéro ;
4. « Payer 15 000 FCFA » ;
5. l'attente : « Validez la demande de paiement sur votre téléphone », avec le numéro masqué et un compte à rebours ;
6. le résultat :
   - réussi : « Votre abonnement Standard est actif jusqu'au … », avec « Commencer » et « Voir le reçu » ;
   - essai échoué : le motif et « Réessayer » ;
   - expiré : « Recommencer ».

**Messages d'échec** (motif Payiz → texte) :
- solde insuffisant : « Votre solde Mobile Money est insuffisant. Rechargez puis réessayez. » ;
- refus : « Vous avez refusé la demande sur votre téléphone. » ;
- sans réponse : « La demande n'a pas été validée à temps. » ;
- numéro inconnu : « Ce numéro n'est pas reconnu par l'opérateur. » ;
- plafond : « Votre plafond Mobile Money est atteint. » ;
- opérateur injoignable : « L'opérateur ne répond pas pour le moment. Réessayez dans quelques minutes. » ;
- autre motif : « Le paiement n'a pas abouti. ».

**Reçu** (`/abonnement/recus/[numero]`) : une page imprimable avec le numéro, la date, le nom du compte, l'abonnement et ses dates, le prix, la remise, le montant payé, l'opérateur et le numéro masqué. « Imprimer ou enregistrer en PDF » passe par le navigateur.

**Verrous :** « Voir les abonnements » (leçon, Parcours) mène à la souscription. Sur un abonnement expiré, le bandeau « Renouveler » du design apparaît en haut de l'espace étudiant.

**Profil du téléphone :** la ligne sous le nom affiche la formule réelle (« Étudiante · Standard ») au lieu de « Gratuite ».

**Back-office :**
- « Paiements » (`/admin/paiements`, à la place de « Bientôt disponible »), avec trois onglets :
  - **Abonnements :** prix, durée, recommandé, actif ;
  - **Codes promo :** créer, modifier, désactiver ; nombre d'utilisations ;
  - **Paiements :** liste filtrable par état, recherche par compte ou numéro de reçu, détail d'un paiement.
- Un réglage « Paiements activés », qui pose l'empreinte du jeton serveur. Tant que les paiements ne sont pas activés, « Payer » affiche « Les paiements ouvrent bientôt. ».
- Tableau de bord : les tuiles « Utilisateurs payants » (abonnements actifs), « Chiffre d'affaires » (mois en cours et total), « Taux de conversion » (abonnés sur inscrits) et « Revenus par formule » se remplissent.

## 7. Les codes promo

- **Une remise** en pourcentage (1 à 100) ou en montant fixe, valable sur les trois abonnements.
- **Validité :** dates de début et de fin facultatives, limite totale d'utilisations facultative, actif ou non.
- **Une seule utilisation par compte** et par code.
- **Seuls les paiements réussis comptent** dans les utilisations : un paiement échoué ne consomme pas le code.
- **Montant après remise :**
  - au moins 1 000 FCFA (le minimum de Payiz) : sinon le code est refusé, avec « Ce code ne s'applique pas à cet abonnement » ;
  - **sauf à 100 %** : l'abonnement s'active sans passer par Payiz (abonnement offert), avec un reçu à 0 FCFA.
- **Messages :** « Ce code n'existe pas », « Ce code a expiré », « Ce code n'est pas encore valable », « Ce code a atteint sa limite », « Vous avez déjà utilisé ce code ».

## 8. Les rappels

- **Notifications dans l'appli** (catégorie « Abonnement ») : 7 jours avant la fin, la veille, et le jour de l'expiration, chacune une seule fois. Elles partent par la tâche planifiée et à l'ouverture de la cloche, comme les rappels des lives.
- **Les e-mails de rappel** viendront avec le lot 5 B (envoi d'e-mails).

## 9. Les choix que je te propose (à valider)

1. **Lives et replays réservés aux abonnés**, comme le prévoit la restructuration (§5.1 « chacun ouvre tout », §6.2 « ensuite, seulement les abonnés »).
   - Un compte gratuit voit les événements et la liste des replays, avec un cadenas et « Avec un abonnement ».
   - Il ne peut ni s'inscrire, ni rejoindre, ni regarder.
   - *Autre possibilité :* les lives restent ouverts à tous comme vitrine, et seuls les replays deviennent réservés.
2. **La communauté du compte gratuit ne change pas :** il publie toujours dans Général, et entre dans un espace de parcours en commençant une formation gratuite de ce parcours. L'abonné entre dans tous les espaces.
3. **Un seul paiement en cours à la fois par compte.** Un second « Payer » reprend celui en cours.
4. **Pas de remboursement dans Étudium.** Un remboursement exceptionnel se fait depuis le tableau de bord Payiz ; l'équipe annule alors l'abonnement au back-office (« Annuler l'abonnement », avec un motif).
5. **Reçu imprimable en HTML** (et PDF par le navigateur), sans facture fiscale au lot 2.
6. **Frais Payiz à la charge d'Étudium :** le prix affiché est le prix payé.

## 10. Hors de ce lot

- SasPay, la carte bancaire, le prélèvement automatique.
- Les e-mails de rappel et de reçu (lot 5 B).
- Les remboursements depuis Étudium.
- Les factures fiscales.
- Les abonnements d'équipe ou d'école.

## 11. Ce que tu feras (guide « Ce qui te revient »)

1. Créer ton compte sur payiz.app (mode test, sans vérification), puis copier ta clé `sk_test_…` dans `PAYIZ_CLE_SECRETE`.
2. Générer `PAIEMENT_JETON` (le guide donne la commande) et le coller dans `web/.env.local`.
3. Appliquer la migration 0049, puis, au back-office, fixer les prix et activer les paiements.
4. Tester avec les numéros du simulateur (`+229 01 42 00 00 00` pour MTN, se terminant par `00` pour un succès, `01` pour un solde insuffisant…).
5. Une fois le site en ligne : déclarer l'adresse des notifications dans Payiz (Développeurs › Webhooks), coller son secret dans `PAYIZ_SECRET_WEBHOOK`, puis passer à la clé `sk_live_…` après la vérification de ton compte par Payiz.
