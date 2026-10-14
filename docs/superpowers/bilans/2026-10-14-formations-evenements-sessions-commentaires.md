# Bilan : onglet Formations, Événements, promotion des sessions, commentaires (14 octobre 2026, nuit)

Tes demandes du 14 octobre (13 h 28, 18 h 13, 18 h 41, 19 h 50), relues une par une. Écrit sans validation intermédiaire, à ta
demande ; chaque partie a eu sa relecture indépendante, et ses points importants sont corrigés.

## En bref

- **Communauté, étape 1** (éditeur) : bouton Lien, emojis, « Publication dans » (choix de l'espace), fil de 720 px centré.
  - Après relecture : une adresse collée reste du texte, les liens se voient dans l'éditeur, l'aperçu suit la vraie adresse
    d'un lien, et le message après une publication dans un autre espace dit où la trouver.
- **Menu** : Accueil, **Formations**, Communauté, Messages, Événements. Communauté partira du menu quand l'Accueil deviendra
  le fil de la communauté.
- **Page Formations** : « Mes formations » sur une ligne (6 petites cartes, « Voir plus »), puis « Toutes les formations »
  (4 à 5 par ligne). Sans formation commencée, pas de rangée ni d'espace vide.
- **Événements** :
  - « Ajouter à mon agenda » ouvre Google Agenda (lien « Autre agenda (.ics) » pour iPhone et Outlook, avec alerte 10 min) ;
  - rappels la veille, 1 h et **10 min** avant ;
  - au début du live, **tous les comptes** sont prévenus (équipe et non-inscrits compris) ;
  - la base envoie tout cela elle-même chaque minute (tâche planifiée), et la cloche se met à jour seule.
- **Sessions live, promotion** :
  - au formulaire, une affiche ou une vidéo de promotion, et à droite l'aperçu de la publication ;
  - programmer une session la publie dans la communauté, avec son bloc (date, **Google Meet** / **Zoom**, animateur,
    inscrits, « Voir la session ») ; le lien du live n'y est jamais ;
  - bouton « Sessions live programmées » dans la communauté et pastille rouge sur l'entrée Événements, remis à zéro en
    ouvrant la page Événements.
- **Commentaires** : sous chaque commentaire, J’aime, Répondre (un seul niveau, la personne citée), menu ⋮ (copier le lien,
  signaler, modifier, supprimer) et « Voir plus de commentaires ». L'auteur d'un commentaire est prévenu d'une réponse.
- **Vérifications** : 1 453 tests (dont les migrations sur une vraie base Postgres en mémoire), types, code, compilation de
  production ; rendus vérifiés au navigateur à 1440, 1280, 390 et 320 px.

## Corrigé après les relectures

- **Formations et Événements** :
  - le vide de la page Formations d'un nouveau compte ;
  - un envoi de rappels qui croisait le report d'une session (mauvaise heure) ;
  - la 0023 rejouée pendant un live supprimait son annonce ;
  - la cloche : une lecture en cours annulait « Tout marquer comme lu », et une panne faisait une erreur chaque minute.
- **Promotion des sessions** :
  - un formateur pouvait publier dans un espace qui ne lui est pas ouvert (il ne voyait plus sa publication) ;
  - « Voir la session » de l'aperçu quittait le formulaire en perdant la saisie ;
  - le lien d'un live pouvait être collé comme « vidéo » et paraître avant sa fenêtre de 10 min ;
  - une affiche refusée ou d'une publication supprimée restait dans le stockage.

- **Commentaires** :
  - après la suppression d'un commentaire dont les réponses n'étaient pas affichées, le compteur restait faux ;
  - supprimer un commentaire effaçait les réponses des autres sans confirmation : une fenêtre le demande maintenant ;
  - « modifié » s'affichait sans changement ; la ligne de réponse était trop étroite à 320 px.

## Décisions que j'ai prises pour toi

1. Libellé « Formations » (au pluriel) ; « Formations gratuites » reste un raccourci dans « Mon espace ».
2. Google Agenda par défaut ; il applique le rappel de ton agenda (son lien ne permet pas d'imposer « 10 min avant »).
3. L'annonce du début respecte les préférences : qui a coupé « Sessions live » ne la reçoit pas.
4. Visuel de promotion : une affiche **ou** une vidéo, pas les deux ; la publication d'une session n'est pas analysée par
   l'IA (seuls formateurs et équipe programment).
5. Modifier une session réécrit le texte de sa publication (la session fait foi).
6. Sur téléphone, la pastille rouge est dans le menu ≡ (pas sur la page Profil).
7. « Voir plus de commentaires » affiche d'un coup tous les commentaires restants.

## Points mineurs mis de côté

- Un message en bas de l'écran peut manquer en passant de Formations à une autre page au moment exact d'une annonce.
- Le titre d'onglet du navigateur de la page Formations reste « Toutes les formations ».
- L'aperçu du formulaire montre le nom du profil (pas celui de la fiche formateur) et, si l'équipe modifie, son propre nom.
- Une session programmée avant la 0024 n'a pas de publication ; la modifier n'en crée pas.
- L'ancienne affiche d'une session reste stockée si elle était dans le dossier d'un autre compte (équipe ↔ formateur).

## Ce qui te revient

Dans l'éditeur SQL de Supabase, dans cet ordre (guide `docs/guides/ce-qui-te-revient.md`, sections 25 à 30) :

1. la **0020 actuelle**, puis la **0021**, puis la **0022** ;
2. la **0023** (rappels et annonce ; si « pg_cron indisponible » s'affiche : Integrations → Cron → Enable, puis relance le
   dernier bloc) ;
3. la **0024** (promotion des sessions) ;
4. la **0025** (commentaires).
