# Le nouvel Accueil : le fil des dernières nouvelles — spec

- **Date :** 15 octobre 2026 (nuit du 14 au 15).
- **Statut :** décidé par moi, selon la consigne du 14 octobre (« continue avec tes recommandations sans me demander de
  confirmer ») ; l'utilisateur corrige après. Étape 4 de la communauté v3 (`2026-10-14-communaute-v3-design.md`, §4).
- **Demande :** « l'Accueil devient un fil des dernières informations (publications, nouvelles formations, sessions
  programmées) puis les formations disponibles ; le tableau de bord actuel disparaît » ; ensuite, Communauté quitte le
  menu, qui devient **Accueil, Formations, Messages, Événements**.
- **Sans migration.** Les formations ont déjà leur date de mise en ligne (`formations.publiee_le`, lue par le catalogue) ;
  une session live programmée paraît déjà dans la communauté comme publication (migration 0024).

## 1. La page `/accueil`

- **L'Accueil est la communauté**, avec un autre en-tête : « Bonjour, Koffi » et « Les dernières nouvelles d’Étudium :
  publications, nouvelles formations et sessions live. ».
- Tout le reste vient de la page Communauté actuelle, sans changement :
  - les onglets d'espaces (Actualités, Général, un par parcours, cadenas sur les espaces fermés) et « Sessions live
    programmées » ;
  - l'annonce épinglée, le champ de publication, « Publiées / Programmées », « Trier par », le fil et « Voir plus » ;
  - la colonne de droite (prochaine session, tendances, activités récentes).
- `?espace=` choisit l'onglet, comme aujourd'hui.

## 2. Les nouvelles formations dans le fil

- Dans **Actualités**, tri **« Les plus récentes »** seulement, les formations mises en ligne depuis **30 jours** se
  glissent entre les publications, **à leur date** (une carte « Nouvelle formation »).
- **Au plus 3** (les plus récentes) : au lancement, le catalogue ne noie pas la communauté (ajouté après la revue
  finale ; les autres restent dans « Formations disponibles »).
- Une formation plus ancienne que la dernière publication chargée attend « Voir plus » ; à la fin du fil, celles qui
  restent viennent à la suite.
- **La carte :**
  - l'étiquette « Nouvelle formation » et le moment (« il y a 2 jours ») ;
  - la couverture, le titre, le résumé (deux lignes) et le parcours ;
  - « Découvrir la formation » mène à sa fiche.
  - Pas de J’aime ni de commentaires : ce n'est pas une publication.
- Les autres onglets (Général, un parcours) et les autres tris gardent leur fil sans formations.

## 3. Les formations disponibles

- **Sous le fil** : « Formations disponibles », les **4 plus récentes** du catalogue, en cartes du catalogue (même
  grille que l'onglet Formations), et le lien « Voir toutes les formations » vers `/formations`.
- Aucune formation publiée : la section ne s'affiche pas.

## 4. Le menu et les adresses

- **Barre latérale :** Accueil, Formations, Messages, Événements (Communauté retirée).
- **Barre du bas du téléphone :** Accueil, Formations, Événements, Certificats, Profil (Événements remplace Communauté ;
  Messages n'est pas encore construit).
- **Le menu ≡ des espaces** (tiroir du téléphone, liste des espaces sous l'entrée) suit Accueil :
  `/accueil?espace=…`, marqué quand l'Accueil est ouvert.
- **`/communaute` redirige vers `/accueil`**, en gardant `?espace=` ; les liens déjà partagés continuent de marcher.
- **La page d'une publication reste à `/communaute/publications/…`** (liens des notifications et liens copiés) ; son
  retour mène à l'Accueil.

## 5. Ce qui disparaît

- Le **tableau de bord** de l'Accueil (tuiles, « Continuer l'apprentissage », « Recommandé pour vous »…) : ses
  composants et règles sont retirés s'ils ne servent plus ailleurs.
- « Continuer » reste possible depuis Formations (rangée « Mes formations »).

## 6. Décisions prises pour l'utilisateur

1. L'Accueil reprend toute la communauté (champ, espaces, colonne) plutôt qu'un fil en lecture seule : Communauté
   quittant le menu, c'est le seul endroit où publier.
2. Nouvelles formations = mises en ligne depuis 30 jours, dans Actualités et « Les plus récentes » seulement.
3. Formations disponibles = les 4 plus récentes, sous le fil.
4. Barre du bas : Événements remplace Communauté ; Certificats reste.
5. `/communaute` redirige ; les pages de publication gardent leur adresse.

## 7. Tests

- Règle pure : l'entrelacement des formations et des publications (dates, fin du fil, page suivante, 30 jours).
- Écrans : l'en-tête de l'Accueil, une carte « Nouvelle formation » à sa place, « Formations disponibles » et son lien,
  rien dans les autres onglets ou tris.
- Menu : les entrées de la barre latérale et du bas ; le menu ≡ vers `/accueil?espace=` ; la redirection de
  `/communaute`.
- Rendu à 1440, 390 et 320 px.
