# Onglet Formations et corrections des Événements — spec

- **Date :** 14 octobre 2026 (soir)
- **Statut :** écrite sans validation intermédiaire, à la demande de l'utilisateur. Décisions au §5.
- **Origine :** message du 14 octobre : un seul onglet « Formation » juste après Accueil, une page Formations à deux rangées,
  l'ordre Accueil, Formation, Messages, Événements ; « Ajouter à mon agenda » doit ouvrir Google Agenda ; le rappel
  10 min avant n'est pas parti ; au début du live, tout le monde doit être prévenu (même l'équipe, même les non-inscrits).

## 1. Navigation

- **Barre latérale de l'étudiant, groupe principal** : Accueil, **Formations**, Communauté, Messages, Événements.
  - « Formations » mène à `/formations` et reste marquée sur `/mes-formations` et sur la fiche d'une formation.
  - Communauté reste là tant que l'Accueil n'est pas devenu le fil de la communauté (communauté v3, étape 4) ; elle
    disparaîtra alors du menu, ce qui donnera exactement Accueil, Formations, Messages, Événements.
- **Groupe « Mon espace »** : « Mes formations » et « Toutes les formations » en sortent. Restent : Exercices, Mes
  parcours, Certificats, Formations gratuites, Favoris, Mon abonnement, Aide.
- **Téléphone** : l'onglet « Formations » de la barre du bas mène à `/formations` (marqué aussi sur `/mes-formations`) ;
  la page « Profil » ne liste plus « Toutes les formations ».

## 2. La page Formations (compte connecté, `/formations`)

- Titre **« Formations »** et le sous-titre actuel du catalogue.
- **Rangée « Mes formations »** (titre de section, bouton **« Voir plus »** vers `/mes-formations`) :
  - les 6 formations suivies les plus récemment ouvertes, **sur une seule ligne** (jamais à la ligne : sur un écran étroit,
    la rangée défile en largeur) ;
  - des cartes **plus petites** que celles du catalogue : couverture 16:9, titre sur 2 lignes, barre de progression et
    « 42 % » (ou « Terminée », « Accès fermé ») ; un clic reprend la formation (ou ouvre sa fiche) ;
  - jusqu'à 6 cartes côte à côte sur un grand écran ;
  - absente tant qu'aucune formation n'est commencée.
- **« Toutes les formations »** (titre de section) : la recherche, le tri, les puces de parcours et « Gratuites » actuels,
  puis toutes les formations publiées (gratuites, incluses, payantes), en cartes **plus grandes**, **4 à 5 par ligne** sur
  ordinateur (2 sur tablette, 1 sur téléphone).
- La page publique (visiteur) ne change pas ; « Formations gratuites » prend la même grille de 4 à 5 colonnes.
- `/mes-formations` reste la liste complète (puces En cours, Terminées, Verrouillées, Favoris).

## 3. Événements

### 3.1 « Ajouter à mon agenda »

- Le bouton **ouvre Google Agenda** dans un nouvel onglet, sur un événement pré-rempli : titre de la session, début et fin,
  description et lien de la page Événements. Aucune donnée personnelle dans l'adresse.
- Google applique **le rappel par défaut de l'agenda de la personne** (l'adresse de Google ne permet pas d'en imposer un).
- Dessous, un petit lien **« Autre agenda (.ics) »** garde le fichier pour Apple Calendar et Outlook ; il porte une
  alerte 10 min avant.
- Le bouton paraît dans « Inscription confirmée » **et** sur la carte d'une session à laquelle on est inscrit (avant son
  début).

### 3.2 Rappels et « le live commence » (migration 0023)

- **Rappels des inscrits** : la veille, 1 h avant, et **10 min avant** (nouveau : « Session live dans 10 minutes … Le lien
  est ouvert. »). Chacun une seule fois ; un rappel plus proche remplace ceux qui n'ont pas pu partir.
- **Au début du live, une notification à tous les comptes** (équipe et non-inscrits compris) : « C'est l'heure du live :
  {titre} », « La session vient de commencer avec {animateur}. Rejoignez-la depuis la page Événements. », lien
  `/evenements`. Une seule fois par session, tant qu'elle est en cours ; pas pour une session annulée. Les préférences de
  notification de chacun restent respectées.
- **Pourquoi le rappel n'est pas parti** : aujourd'hui, les rappels ne sont créés que quand l'inscrit lui-même charge une
  page, et seulement la veille et 1 h avant (le 10 min n'existait pas).
- **Désormais, l'envoi ne dépend plus de l'inscrit** : une fonction `traiter_sessions_live()` traite toutes les sessions
  et tous les inscrits d'un coup :
  - **toutes les minutes par la base** (tâche planifiée `pg_cron`, créée par la migration si l'extension est disponible) ;
  - **et à chaque chargement de la cloche par n'importe quel compte** (filet si la tâche planifiée manque).
  - Elle est sûre en cas d'appels simultanés : chaque envoi est d'abord « réservé » en base, puis envoyé une seule fois.
- **Une session dont l'heure change** : ses rappels et son annonce de début repartent de zéro.
- **La cloche se met à jour seule** : toutes les minutes tant que l'onglet est visible, et au retour sur l'onglet.
  - Quand une nouvelle notification de session live arrive pendant qu'on est sur une page, un message apparaît en bas de
    l'écran (« C'est l'heure du live : … », bouton « Voir »).
- Les textes « Un rappel vous sera envoyé la veille et 1 h avant » deviennent « la veille, 1 h avant et 10 min avant ».

## 4. Tests

- Menus : l'ordre exact du groupe principal, de « Mon espace », de la barre du bas ; l'entrée Formations marquée sur
  `/formations`, `/mes-formations` et `/formations/x`, pas sur `/formations-gratuites`.
- Page Formations : rangée de 6 cartes au plus, « Voir plus », absente sans formation suivie ; grille de 5 colonnes au plus.
- Agenda : l'adresse Google (dates UTC, titre et description encodés), le .ics avec son alerte 10 min.
- Base (0023, sur la base en mémoire) : rappel 10 min une seule fois ; annonce du début à tous les profils une seule fois,
  pas pour une session annulée ni terminée ; appel concurrent sans doublon ; remise à zéro quand l'heure change ;
  `rappels_sessions()` déclenche le traitement global ; la migration passe sans `pg_cron`.
- Cloche : rechargement toutes les minutes (onglet visible), message pour une nouvelle notification de session live.
- Rendu à 1440, 1280, 390 et 320 px.

## 5. Décisions prises pour l'utilisateur

1. « Formations » (au pluriel, comme les autres entrées) ; Communauté reste dans le menu jusqu'au nouvel Accueil.
2. « Formations gratuites » reste dans « Mon espace » (raccourci) ; seules les deux entrées fusionnées en sortent.
3. Rangée « Mes formations » : 6 cartes au plus, défilement en largeur sur petit écran, « Voir plus » vers la liste complète.
4. Grille du catalogue connecté : 5 colonnes au plus, cartes de 220 px au moins (4 colonnes vers 1280 px, 5 vers 1440 px).
5. Google Agenda par défaut ; le fichier .ics reste en lien discret (iPhone, Outlook) avec une alerte 10 min avant.
6. Annonce du début : tous les comptes, préférences respectées (qui a coupé les notifications de sessions live ne la
   reçoit pas).
7. Tâche planifiée `pg_cron` toutes les minutes, plus le filet de la cloche ; la cloche se recharge chaque minute.
8. Notifications dans l'application seulement : les notifications du téléphone (push) et les e-mails viendront au lot 5.
