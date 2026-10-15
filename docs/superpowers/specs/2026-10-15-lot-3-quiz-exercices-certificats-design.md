# Lot 3 : quiz, exercices, validation et certificats

- **Origine :** feuille de route, lot 3 (tâches 3.0 à 3.7) ; choix de l'utilisateur le 15 octobre 2026 (« Quiz et
  certificats », puis « Exercice aussi »).
- **Sources :** cahier des charges §13, §16 à §21, §35, §43, §44, §61 à §63 (règles R16 à R23) ; design « Étudium —
  Nouveau design » : NdQuiz, NdQuizQuitter, NdQuizResultat, NdMobQuiz, NdExercices, NdExercice, NdExerciceEnvoi,
  NdExerciceEnvoye, NdCorrection, NdCorrectionDemande, NdCorrectionValidation, NdCertificats, NdCertificat,
  NdCertificatObtenu, NdCertificatPartage, NdVerification, NdVerificationValide, NdEditeur (carte « Certification »),
  NdFormation, NdLecon, NdFormateur.
- Les choix marqués ★ sont mes propositions, à valider (§9).

## 1. Où vivent les quiz et les exercices ★

Un **quiz** ou un **exercice** est un élément du programme, comme une leçon : il a sa place dans un module, son statut
(brouillon, publiée), son glisser-déposer dans l'onglet Leçons, et il s'ouvre dans la page leçon (programme à gauche,
barre du haut, « Leçon suivante »). Techniquement : une leçon a un **type** (`lecon`, `quiz`, `exercice`).

- Dans l'onglet Leçons, « Ajouter » propose : Leçon, Quiz, Exercice.
- Dans le programme et sur la fiche : icône et étiquette « Quiz » ou « Exercice », meilleur score ou statut.
- **Progression (R16, R17, décision Q2 du lot 1)** : le pourcentage ne compte que les leçons de contenu. Un quiz ou un
  exercice ne bloque jamais rien : on passe à la suite librement. « 24 leçons · 4 quiz · 3 exercices » sur la fiche.
- Le design annonce « le module suivant sera débloqué » après un exercice validé : ★ **non**, rien ne se débloque,
  rien n'est verrouillé (R17, principe 1 « ne pas bloquer l'apprentissage ») ; le texte est adapté.

## 2. Les quiz (étape A)

**Créer (formateur, équipe)** — l'éditeur d'un quiz liste ses questions (ajouter, modifier, ranger, supprimer) :
- quatre types (§18) : **choix unique**, **réponses multiples**, **vrai ou faux**, **réponse courte** ;
- pour chaque question : l'énoncé, les réponses (2 à 6) et la ou les bonnes, une **explication** facultative ;
- réponse courte ★ : une ou plusieurs réponses acceptées ; corrigée automatiquement, sans tenir compte des majuscules,
  des accents ni des espaces en trop.

**Passer (étudiant)** — comme NdQuiz : « Question 2 sur 4 », « Tentative n° 3 · tentatives illimitées », barre de
progression, l'étiquette du type, une question à la fois, « Question précédente », « Passer cette question »,
« Valider » (dernière question : envoie le quiz). « Quitter » demande « Quitter le quiz ? » : les réponses ne sont pas
enregistrées.

**Corriger** — sur le serveur, jamais dans le navigateur (les bonnes réponses ne sont envoyées qu'après le quiz) :
- score = bonnes réponses ÷ questions ; une question passée est fausse ; ★ réponses multiples : juste seulement si
  toutes les bonnes et aucune mauvaise ;
- **tentatives illimitées (R19), meilleur score conservé** (NdQuizResultat) ;
- **score minimal par formation (R20)**, appliqué à chaque quiz, ★ 70 % par défaut, réglable de 0 à 100 % ;
- résultat comme NdQuizResultat : « Quiz réussi » (ou ★ « Pas encore réussi », absent du design) avec le score, le
  détail des réponses (Correct / Incorrect, la bonne réponse et l'explication pour les erreurs), « Revoir la leçon »,
  « Recommencer », « Continuer ».

## 3. Les exercices (étape B)

**Créer** — consigne (texte mis en forme), ressources (fichiers fournis, comme une leçon), et le genre :
- **exercice simple** (§16.1) : l'étudiant lit, fait, puis « Marquer comme terminé » (compte comme validé) ;
- **exercice avec rendu** (§16.2) : dépôt d'un fichier, corrigé par le formateur.

**Rendre (étudiant)** — comme NdExercice : consigne, ressources, « Déposer votre travail » (★ PDF, Word, Excel,
PowerPoint, image ou ZIP · 20 Mo), message facultatif pour le formateur, confirmation « Envoyer votre travail ? »,
toast « Travail envoyé ». **Versions conservées** (§16.2) : version 1, 2… avec l'historique ; le fichier ne se modifie
plus tant qu'il n'est pas corrigé.

**Statuts** : **En attente** (déposé, pas encore corrigé) · **À corriger** (le formateur demande une reprise, avec une
remarque privée) · **Validé**. Aucune note chiffrée (§17).

**Corriger (formateur de la formation, ★ et l'équipe)** — page **Corrections** (aujourd'hui « Bientôt disponible ») :
la liste des rendus en attente (les plus anciens d'abord), puis la page NdCorrection : le travail (télécharger), le
message de l'étudiant, la consigne, l'historique ; « Demander une correction » (remarque obligatoire) ou « Valider
l'exercice » (commentaire facultatif). ★ Les cases « Points de la consigne » du design ne sont pas reprises (elles
doublent la remarque).

**Notifications** (catégorie « Exercices ») : le formateur reçoit « Nouveau travail à corriger » ; l'étudiant reçoit
« Exercice validé » ou « Une correction est demandée ».

**Pages étudiant** — **Exercices** (aujourd'hui « Bientôt disponible ») : tous ses exercices avec filtres Tous ·
À corriger · En attente · Validés (NdExercices).

## 4. La validation de la formation (étape C)

**Réglages de certification** de la formation (carte « Certification » de NdEditeur, formateur et équipe) : score
minimal aux quiz (★ 70 %), « Exercices obligatoires » (★ activé : tous les exercices doivent être validés), et le seuil
des vidéos déjà existant.

**Conditions du certificat (§20, R18)** : progression à **100 %** · **tous les quiz réussis** (meilleur score ≥ score
minimal) · **tous les exercices validés** si « Exercices obligatoires ». Seuls les éléments publiés comptent.

**Page « Validation de votre formation »** (NdCertificat) — ouverte depuis la fiche, le programme et la page
Certificats : chaque condition, remplie ou non (« Quiz du module 3 réussi · 75 % · minimum 70 % », « Exercice
« Tableau des ventes » validé »…), avec un lien vers ce qui manque ; à droite, le certificat s'il est délivré.

## 5. Le certificat (étape C)

- **Délivré automatiquement** ★ dès que la dernière condition est remplie (dernière leçon, quiz réussi, exercice
  validé), avec la fenêtre « Félicitations, Aïcha ! » à la prochaine visite et la notification « Votre certificat est
  prêt » (catégorie « Service », toujours envoyée).
- **Définitif (R21)** : il garde à vie le nom, la formation, le formateur et la date du jour de la délivrance, même si la
  formation change, est archivée ou désactivée, ou si l'abonnement expire (R22). Si le compte est supprimé, ★ le
  certificat reste vérifiable (décision du lot 0) ; le texte de la suppression de compte, qui dit le contraire, est
  corrigé.
- **Identifiant** ★ `ET-2026-K7Q2-M9XD` (l'année, puis 8 caractères tirés au hasard) : impossible à deviner, donc
  impossible de parcourir les certificats des autres.
- **Contenu (§20, NdCertificat)** : logo Étudium, « Certificat de réussite », « Décerné à », le nom, « pour avoir validé
  la formation », le titre, « Délivré le », la date, le formateur, le QR Code et l'adresse de vérification.
- **Formats** : image PNG et PDF (A4 paysage), générés par le serveur à la demande ; « Télécharger le PDF »,
  « Partager » (lien de vérification à copier, NdCertificatPartage).
- **Page Certificats** (NdCertificats) : « Certificats obtenus » et « En préparation » (avec ce qui manque).

## 6. La vérification publique (étape C)

- **`/verifier`** (lien « Vérifier un certificat » dans l'en-tête public) : saisir l'identifiant, « Vérifier ».
- **`/c/ET-2026-K7Q2-M9XD`** : l'adresse du QR Code, qui montre directement le résultat.
- Résultat (NdVerificationValide) : « Certificat authentique. » avec Titulaire, Formation, Date d'obtention,
  Identifiant, Parcours, Formateur ; sinon « Aucun certificat trouvé. ». Sans compte (R23).

## 7. Côté formateur et équipe

- Tableau de bord du formateur : « Exercices à corriger » et « Certificats délivrés » (aujourd'hui vides).
- Fiche d'un étudiant : ses meilleurs scores, ses exercices et son certificat (aujourd'hui « disponibles au lot 3 »).
- Le formateur ne peut pas modifier les scores ni les statuts autrement qu'en corrigeant (§44).

## 8. Découpage

1. **Étape A — Quiz** : types de leçon, éditeur de quiz, passage, correction, résultat, score minimal (migration 0031).
2. **Étape B — Exercices** : éditeur, rendu et versions, corrections, notifications, page Exercices (0032).
3. **Étape C — Validation et certificats** : réglages de certification, page de validation, délivrance, PDF et image,
   page Certificats, vérification publique, tableaux de bord (0033).

Hors champ : les abonnements (lot 2 : la recette 3.7 « abonné → certificat » attend ce lot), les « exercices corrigés »
réservés à certaines formules (§33, lot 2), les points et badges (lot 6).

## 9. Choix à valider

1. Quiz et exercices sont des **éléments du programme** (un type de leçon), hors du pourcentage de progression.
2. **Rien ne se débloque ni ne se verrouille** après un exercice ou un quiz (le design disait « module débloqué »).
3. Réponse courte **corrigée automatiquement** (sans majuscules, accents ni espaces en trop).
4. Réponses multiples : **juste seulement si tout est juste**.
5. Score minimal **par formation, appliqué à chaque quiz**, 70 % par défaut ; **meilleur score** conservé.
6. Après le quiz, **la correction détaillée** (bonnes réponses et explications) s'affiche, comme le design.
7. Fichiers de rendu : **PDF, Word, Excel, PowerPoint, image ou ZIP, 20 Mo**.
8. L'**équipe** peut aussi corriger (utile quand une formation n'a pas de formateur).
9. « Exercices obligatoires » **activé par défaut** ; tous les quiz publiés comptent toujours.
10. Certificat **délivré automatiquement**, figé à la délivrance, toujours vérifiable (même compte supprimé).
11. Identifiant **ET-2026-XXXX-XXXX** tiré au hasard (le design montrait ET-2026-EXC-4821, trop facile à deviner).
12. On commence par l'**étape A (quiz)**, puis B, puis C.
