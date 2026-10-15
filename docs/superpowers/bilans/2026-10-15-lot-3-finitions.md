# Bilan : les finitions du lot 3 (15 octobre 2026)

Tu as dit « Ok on termine avec le lot 3 ». J'ai repris les 24 petits défauts notés dans les bilans des étapes A, B et C,
et j'ai préparé la recette (tâche 3.7) pour la partie faisable sans le lot 2. Le plan :
`docs/superpowers/plans/2026-10-15-lot-3-finitions.md`. Une relecture indépendante a eu lieu à la fin.

## En bref

- **Une migration 0034** (à appliquer, guide section 41) :
  - un quiz ou un exercice ne peut plus être marqué « terminé » comme une leçon, même par un appel direct ;
  - la notification de publication dit « Nouveau quiz » ou « Nouvel exercice » ;
  - l'« aperçu gratuit » ne concerne plus que les leçons : les anciens quiz ou exercices cochés sont décochés ;
  - deux garde-fous : réponses de quiz de 300 caractères au plus, un fichier pour un seul rendu.
- **Quiz :**
  - si les scores ne se lisent pas, la page s'affiche sans eux, au lieu d'un écran d'erreur ;
  - la case « Leçon d’aperçu gratuite » disparaît de l'éditeur d'un quiz et d'un exercice ;
  - plus de « 0 leçon » pour une section qui n'a que des quiz ;
  - la touche Entrée dans une réponse n'enregistre plus tout le quiz.
- **Exercices :**
  - l'envoi dit « Vous recevrez une notification dès la correction. », juste même sans formateur attribué ;
  - un exercice simple est « Terminé », pas « Déposé » ;
  - l'aide de la remarque dit qui la lit : l'étudiant et les correcteurs.
- **Certificats :**
  - « de Kossi », « d’Aïcha » dans le texte de l'image ;
  - le lien « Validation et certificat » apparaît aussi en bas du programme de la page leçon ;
  - l'image du certificat est gardée un jour par le navigateur ;
  - un nom de formateur très long passe à la ligne sans toucher « Vérifiable sur… » ;
  - une formation sans leçon publiée explique pourquoi elle reste à 0 %.
- **Vérifications :**
  - 1 833 tests, dont la 0034 sur une vraie base Postgres en mémoire (appliquée après des données « anciennes ») ;
  - types, lint et compilation de production ;
  - le certificat au nom de formateur long, rendu et relu.

## Corrigé après la relecture

- **Un ancien quiz ou exercice coché « aperçu » restait ouvert sans abonnement.**
  - Dans une formation payante, on pouvait passer ce quiz ou déposer un travail sans être abonné.
  - Je ne l'avais masqué que dans l'affichage. La 0034 les décoche maintenant, et la base refuse ce cas.

## Ce qui te revient

1. **Applique la 0034** (après 0031, 0032 et 0033 si ce n'est pas fait). Guide, section 41.
2. **La recette du lot 3**, partie faisable dès maintenant (guide, section 41) :
   - visiteur, puis compte gratuit ;
   - une formation gratuite de bout en bout : leçons, quiz, exercice corrigé ;
   - le certificat et sa vérification.
3. **Plus tard :**
   - l'étape « abonné » de la recette arrivera avec le lot 2 ;
   - le test complet sur téléphone se fera une fois le site en ligne. C'est à ce moment que tu donneras le feu vert du lancement.

## Décisions que j'ai prises pour toi

- **Laissés tels quels**, sans effet réel ou rattrapés seuls :
  - le temps restant compte les quiz (ils durent 0 minute) ;
  - deux tentatives envoyées au même instant peuvent porter le même numéro ;
  - des fichiers orphelins dans l'espace des rendus (nettoyage à la mise en ligne) ;
  - les dates « il y a… » calculées dans le navigateur ;
  - un exercice devenu inaccessible reste dans la page Exercices (le lien mène à la page verrouillée, qui l'explique) ;
  - deux événements simultanés retardent la délivrance du certificat jusqu'à la visite suivante.
- **Une formation composée seulement de quiz ne délivre pas de certificat** : la règle exige au moins une leçon.
- **Le back-office garde « 0 leçon »** dans ses listes : c'est utile au formateur.

## Petits défauts laissés pour plus tard

- Une question de quiz de plus de 300 caractères, possible seulement par un appel direct à la base, bloque
  l'enregistrement du quiz avec un message général.
- Une adresse `/c/…` contenant un « % » invalide affiche la page « 400 » de Next, pas « Aucun certificat trouvé ».
- L'index unique de la 0034 échouerait sur des doublons existants : quasi impossible, chaque dépôt a un nom neuf.
- Le lien « Validation et certificat » du programme de la page leçon s'affiche à tout compte connecté, même en aperçu.

## Le lot 3 est terminé

Il ne lui manque que la fin de la recette, qui attend le lot 2 et la mise en ligne.
