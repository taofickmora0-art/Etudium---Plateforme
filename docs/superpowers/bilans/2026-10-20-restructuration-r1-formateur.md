# Bilan : restructuration R1, le formateur n'est plus étudiant (20 octobre 2026)

Tu as validé la restructuration le 20 octobre (« C'est bon mon gars »). Spec : `docs/superpowers/specs/2026-10-20-restructuration-design.md`, §4. Plan : `docs/superpowers/plans/2026-10-20-restructuration-r1-formateur.md`. Une relecture indépendante a eu lieu à la fin, suivie d'une passe de corrections.

## En bref

- **Un formateur n'a plus que son espace.** À la connexion, il arrive sur son tableau de bord. Une adresse étudiante tapée à la main, ou le lien d'une notification, le renvoie :
  - vers l'équivalent dans son espace (profil, notifications, menu, messages, publication de la communauté) ;
  - sinon, vers son tableau de bord.
- **Il ne voit plus aucune formation des autres :**
  - le catalogue le renvoie à son tableau de bord ;
  - la fiche de sa propre formation mène à son éditeur ;
  - sur une leçon d'une de ses formations, il a un aperçu : « Aperçu de votre leçon, telle que la voit un étudiant… ». Rien n'est enregistré, mais les discussions restent, pour qu'il réponde à ses étudiants.
- **Son espace gagne :**
  - **Communauté** : le fil et ses espaces, sans les formations ;
  - **Mon profil** et **Notifications** ;
  - au téléphone, sa propre page **Profil**.
  - L'en-tête n'a ni série ni points ni loupe, et le logo mène à son tableau de bord.
- **En base (migration 0036) :**
  - un formateur n'ouvre que le contenu de ses formations ;
  - toute action d'étudiant de sa part est refusée : progression, favoris, avis, inscriptions aux sessions, quiz, rendus, messages écrits comme étudiant ;
  - il ne reçoit plus les notifications d'apprentissage ;
  - l'animateur reçoit ses propres notifications de session dans son espace (« Session live programmée », « C'est l'heure de votre live »).
- **L'équipe et les étudiants ne changent pas.** L'équipe garde « Espace étudiant » et le back-office.
- **Vérifications :**
  - 1 917 tests, dont la 0036 sur une vraie base Postgres en mémoire ;
  - types, lint et compilation de production ;
  - menus et page « Profil » mesurés dans le navigateur, sur ordinateur et à 375 px.

## Corrigé après la relecture

- **Le plus grave (la 0036, avant correction) :** dès qu'un étudiant devenait formateur, la base refusait toute mise à jour de ses anciennes lignes, même faite par quelqu'un d'autre. Les rappels de sessions s'arrêtaient pour tout le monde. Une correction ou la suppression d'un compte de correcteur échouaient aussi. Maintenant, seule une mise à jour faite par le formateur lui-même est refusée.
- **L'animateur ne recevait plus aucune notification de ses propres sessions.** Il les reçoit maintenant dans son espace.
- **Sur ses propres leçons, le formateur ne voyait plus les discussions.** Elles sont revenues.
- **Un espace fermé de la communauté invitait le formateur à « commencer une formation ».** Il lit maintenant que l'espace est réservé aux étudiants du parcours et à ses formateurs.

## Ce qui te revient

1. **Applique la 0036**, après la 0035 (et les 0031 à 0034 si ce n'est pas fait). Guide, section 43.
2. **Valide avec ton compte formateur de test** (guide, section 43, 15 minutes) :
   - l'arrivée à la connexion ;
   - les adresses tapées à la main ;
   - Communauté ;
   - « Voir comme un étudiant » ;
   - les notifications d'une session programmée pour lui ;
   - le téléphone.
3. **Avec ton compte admin**, vérifie que rien n'a changé.

## Décisions que j'ai prises pour toi

- **`/accueil` mène le formateur à son tableau de bord**, pas à sa communauté. C'est l'accueil de l'étudiant, et c'est aussi l'adresse par défaut de la connexion. Si c'est faux, il lui faut un clic de plus vers « Communauté » (par exemple après « Publication retirée »).
- **Sa page Communauté** a pour sous-titre « Échangez avec les étudiants : publications, questions et sessions live. » (le design n'a pas cet écran).
- **Le compte de démonstration** (affiché sans base) est maintenant étudiante plus équipe. Trois rôles à la fois contredisaient déjà la 0017. Il ne montre plus l'espace formateur.
- **Choix techniques :**
  - pour savoir s'il est formateur à la connexion, l'appli interroge la base (`a_role`) ;
  - les pages du catalogue et de la leçon appliquent la règle par deux petites fonctions testées ;
  - les composants de la communauté reçoivent leur espace du serveur.
- **Laissé tel quel :**
  - par appel direct, un formateur peut encore lire ses propres anciennes données d'étudiant (conversations, certificats) ; il n'y a aucune fuite, ce sont les siennes ;
  - il n'a plus l'assistance (« Contacter l'équipe »), conformément à la spec.

## Petits points reportés

- **Au renvoi d'un formateur :**
  - la page étudiante peut s'afficher un instant avant la redirection ;
  - l'ancre d'un commentaire se perd vers sa publication ;
  - à la connexion, la demande d'une de ses leçons le mène à son tableau de bord.
- **Notifications :**
  - « Préférences », depuis sa page Notifications, ouvre l'onglet Informations de son profil, pas Notifications ;
  - ses préférences proposent encore les catégories d'apprentissage.
- **En aperçu sur sa propre leçon,** il peut envoyer un quiz ou un exercice : la base refuse, et le fichier de l'exercice reste orphelin.
- **Un ancien étudiant devenu formateur** reste « étudiant » de son ancien formateur dans la messagerie, qui ne peut alors plus lui écrire.
- **Un lien de la communauté du formateur, envoyé à un étudiant,** le mène à l'Accueil plutôt qu'à la publication.
- **Un commentaire de code à aligner** (`ACCES.etudiant`).
