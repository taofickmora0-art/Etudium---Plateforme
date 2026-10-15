# Bilan : les quiz (lot 3, étape A, 15 octobre 2026)

Ton choix du 15 octobre : « Quiz et certificats », puis « Exercice aussi », et « C'est bon » sur la spec du lot 3.
La spec : `docs/superpowers/specs/2026-10-15-lot-3-quiz-exercices-certificats-design.md`. Le plan :
`docs/superpowers/plans/2026-10-15-lot-3-etape-a-quiz.md`. Une relecture indépendante à la fin.

## En bref

- **Créer un quiz (formateur, équipe).**
  - Dans l'onglet « Leçons », « Ajouter » propose **Leçon** ou **Quiz**.
  - L'éditeur du quiz remplace la vidéo et le texte par la liste des questions.
  - Quatre types : choix unique, réponses multiples, vrai ou faux, réponse courte.
  - De 2 à 6 réponses, la ou les bonnes, une explication facultative.
  - Ranger avec les flèches, supprimer avec la corbeille.
  - La ligne de l'onglet dit « Quiz · 4 questions ».
  - Un quiz naît en brouillon et ne se publie qu'avec au moins une question.
- **Le score minimal** se règle dans l'onglet « Informations » (70 % par défaut, de 0 à 100), par le formateur comme
  par l'équipe.
- **Passer un quiz (étudiant).**
  - Dans la page leçon, sous le titre : « 4 questions · meilleur score : — · score minimal : 70 % », puis
    **Commencer**.
  - Une question à la fois : « Question 2 sur 4 », la barre d'avancement, « Question précédente », « Passer cette
    question », « Valider ».
  - « Quitter » demande « Quitter le quiz ? » et n'enregistre rien.
  - Le résultat : « Quiz réussi » ou « Pas encore réussi », le score, puis le détail. Pour chaque erreur : la bonne
    réponse et l'explication.
  - Tentatives illimitées. Seul le meilleur score est gardé ; il s'affiche dans le programme (« Quiz · 75 % »).
- **La correction se fait dans la base**, jamais dans le navigateur. Les bonnes réponses ne quittent la base qu'avec le
  résultat. Une réponse courte ne tient compte ni des majuscules, ni des accents, ni des espaces en trop.
- **Les quiz ne comptent pas comme des leçons** :
  - ni dans le pourcentage de progression, ni dans « n leçons », ni dans le temps restant ;
  - ni pour l'avis à 50 %, ni dans le suivi du formateur, ni dans les statistiques ;
  - la fiche dit « 8 leçons · 1 quiz ».
  - Un quiz n'a pas de « Terminer la leçon » : seulement « Leçon suivante ».
- **Vérifications :**
  - 1 696 tests, dont la migration 0031 sur une vraie base Postgres en mémoire ;
  - les types, le code et la compilation de production ;
  - le rendu du quiz et de l'éditeur dans le navigateur, sur ordinateur et à 375 px.

## Corrigé après la relecture

- **Modifier un quiz pendant qu'un étudiant le passe :**
  - avant, chaque enregistrement changeait l'identifiant des questions, et la tentative en cours était notée 0 % ;
  - maintenant les questions gardent leur identifiant ;
  - si une question a été retirée entre-temps, l'envoi est refusé sans tentative comptée : « Ce quiz vient d'être
    modifié : rechargez la page pour le recommencer. »
- **Un quiz vide ne se publie pas.** Un quiz seul ne suffit pas non plus pour publier une formation.
- **Au clavier et au lecteur d'écran**, le focus suit le quiz : la question suivante, le résultat, le retour à l'accueil.
- **Avant la migration 0031**, l'onglet « Informations » n'affiche pas le champ du score. Sinon chaque enregistrement
  affichait l'erreur de la migration.

## Ce qui te revient

1. **Applique la migration `0031_quiz.sql`** (guide « Ce qui te revient », section 37), après la 0029 et la 0030 si
   elles ne le sont pas encore.
2. Suis la section 37 du guide pour essayer : créer un quiz, le publier, le passer avec un compte étudiant.

## Décisions que j'ai prises pour toi

- **Le quiz s'affiche dans la page leçon, sous le titre.** Le design le montre en page à part, mais la spec le met dans
  le programme, comme une leçon. Dis-moi si tu préfères la page plein écran.
- **En aperçu, l'équipe et le formateur passent le quiz pour de vrai.** La tentative est enregistrée à leur nom ; elle ne
  touche pas les étudiants.
- **Un quiz n'a pas de documents, de texte, de résumé ni d'onglet Notes.** Ses discussions restent possibles :
  ferme-les avec « Activer les commentaires » si elles risquent de dévoiler les réponses.
- **« Valider » reste grisé tant qu'aucune réponse n'est choisie.** Pour passer une question, l'étudiant clique sur
  « Passer cette question ».
- **Le meilleur score reste quand le formateur modifie le quiz.** Corriger une coquille ne doit pas effacer une
  réussite.
- **La correction détaillée montre les bonnes réponses dès la première tentative** (choix 6 de la spec). Un étudiant
  peut donc réussir à la deuxième tentative en recopiant. À reposer à l'étape C, pour le certificat.
- **30 envois de quiz en 10 minutes au plus**, contre les abus ; invisible en usage normal.

## Petits défauts laissés pour plus tard

- Le temps restant compte aussi les quiz. C'est sans effet : un quiz dure 0 minute.
- Un appel direct à la base (hors de l'appli) peut marquer un quiz « terminé » et fausser son propre pourcentage.
- Publier un quiz envoie la notification « Nouvelle leçon dans… » au lieu de « Nouveau quiz ».
- Deux envois au même instant, depuis deux onglets, peuvent avoir le même numéro de tentative.
- La base ne limite pas la longueur des réponses proposées (l'appli les limite à 300 caractères).
- Si la lecture des meilleurs scores échoue, la page affiche l'écran d'erreur au lieu de simplement cacher les scores.
- Un quiz coché « aperçu gratuit » compte dans « n leçons en aperçu », et l'infobulle « Visible sans compte » ne lui
  convient pas.
- Un module qui ne contient que des quiz affiche « 0 leçon · 1 quiz ».
- Dans l'éditeur, la touche Entrée dans une réponse enregistre tout le formulaire.

## La suite

L'étape B : **les exercices** (simples et avec rendu de fichier, page « Corrections » du formateur, page « Exercices »
de l'étudiant), avec la migration 0032.
