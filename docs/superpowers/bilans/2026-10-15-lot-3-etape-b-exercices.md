# Bilan : les exercices (lot 3, étape B, 15 octobre 2026)

Ta demande du 15 octobre : « Allons avec la partie exercice ». La spec :
`docs/superpowers/specs/2026-10-15-lot-3-quiz-exercices-certificats-design.md` (§3). Le plan :
`docs/superpowers/plans/2026-10-15-lot-3-etape-b-exercices.md`. Une relecture indépendante à la fin.

## En bref

- **Créer un exercice (formateur, équipe).**
  - Dans l'onglet « Leçons », « Ajouter » propose maintenant Leçon, Quiz ou **Exercice**.
  - L'éditeur d'un exercice : le **genre** (« Avec rendu » ou « Simple »), la **Consigne** (texte mis en forme), les
    fichiers fournis dans « Documents & fichiers ». Ni vidéo, ni durée.
  - Un exercice naît en brouillon ; la ligne de l'onglet dit « Exercice avec rendu » ou « Exercice simple ».
- **Faire un exercice (étudiant).** La page montre la consigne et les fichiers fournis, puis « Votre travail » :
  - **simple** : « Marquer comme terminé » ;
  - **avec rendu** : déposer un fichier (PDF, Word, Excel, PowerPoint, image ou ZIP, 20 Mo au plus), un message
    facultatif, « Envoyer votre travail ? », puis « Travail envoyé » ;
  - statuts **En attente**, **À corriger**, **Validé** ; pas de nouveau dépôt tant que la version attend sa correction ;
  - l'**historique des rendus** garde chaque version, son fichier, le message et la remarque du correcteur.
- **Corriger (formateur de la formation, et l'équipe).** La page **Corrections** (espace formateur, et maintenant aussi
  au back-office) liste les travaux en attente, les plus anciens d'abord. Chaque correction montre le travail
  (« Télécharger »), le message, la consigne et l'historique ; « Demander une correction » exige une remarque,
  « Valider l'exercice » accepte un commentaire ; « Exercice suivant » mène au travail d'après.
- **Notifications** (catégorie « Exercices ») : « Nouveau travail à corriger » au formateur, « Exercice validé » ou
  « Une correction est demandée » à l'étudiant.
- **La page « Exercices »** de l'étudiant ouvre enfin : ses exercices avec les filtres Tous · À corriger · En attente ·
  Validés, et la remarque du formateur.
- **Comme les quiz, les exercices ne comptent pas comme des leçons** : la fiche dit « 8 leçons · 2 exercices », le
  programme « Exercice · Validé » ; rien ne se débloque.
- **Sécurité :** la base vérifie tout (accès à la leçon, fichier bien déposé dans le dossier de l'étudiant, format,
  taille, statut, correcteur). Un étudiant ne lit jamais le travail d'un autre ; un formateur seulement ceux de ses
  formations.
- **Vérifications :** 1 741 tests, dont la migration 0032 sur une vraie base Postgres en mémoire ; types, code et
  compilation de production ; rendu sur ordinateur et à 375 px.

## Corrigé après la relecture

- **Un ZIP déposé depuis Windows était toujours refusé** (le navigateur l'annonce sous un autre type). Le fichier part
  maintenant avec le type vérifié.
- **Les fichiers rendus partent avec la leçon, le module ou le compte supprimés.** Avant, ils restaient stockés.
- **« 1 exercice pratique, à faire ou à rendre »** sur la fiche (au lieu d'une faute d'accord et d'une promesse fausse).
- **Au clavier et au lecteur d'écran**, le focus suit l'exercice (terminé, envoyé) et la correction.

## Ce qui te revient

1. **Applique la migration `0032_exercices.sql`** (guide, section 38), après la 0031. Elle crée aussi l'espace de
   stockage privé « rendus ».
2. Suis la section 38 du guide : crée un exercice, rends-le avec un compte étudiant, corrige-le avec le compte du
   formateur.

## Décisions que j'ai prises pour toi

- **Le choix du genre est au-dessus de la consigne**, dans la colonne de droite de l'éditeur.
- **Une seule zone « Remarque pour l’étudiant »** sur la page de correction, puis une simple confirmation. Le design
  répétait le champ dans la fenêtre.
- **« Corrections » ajoutée au menu du back-office** (choix 8 : l'équipe corrige aussi).
- **La page « Exercices » ne liste que les exercices commencés.** Les autres sont dans le programme de chaque formation.
- **Personne n'est prévenu d'un dépôt quand la formation n'a pas de formateur** : l'équipe le voit dans « Corrections ».
- **Le formateur et l'équipe peuvent rendre un exercice en aperçu** ; leurs essais apparaissent dans « Corrections »
  (comme les quiz).
- **Un exercice sans consigne peut être publié** (la consigne peut tenir dans un fichier fourni).
- **La phrase « Un exercice validé compte pour votre certificat »** attend l'étape C, où elle deviendra vraie.

## Petits défauts laissés pour plus tard

- « Votre formateur a été prévenu » s'affiche même quand la formation n'a pas de formateur.
- La page Exercices dit « Déposé il y a… » pour un exercice simple.
- « Seul l’étudiant la lit » : les autres correcteurs voient aussi la remarque.
- L'espace « rendus » accepte des dépôts hors exercice (fichiers orphelins possibles), comme l'espace « communauté ».
- Un même fichier pourrait être attaché à deux rendus par un appel direct.
- Les dates « il y a 2 min » sont calculées dans le navigateur (petit écart possible au chargement).
- La page Exercices garde un exercice devenu inaccessible (lien vers une page verrouillée).

## La suite

L'étape C : **la validation de la formation et les certificats** (réglages de certification, page « Validation de votre
formation », certificat PDF et image avec QR Code, page « Certificats », vérification publique), avec la migration 0033.
