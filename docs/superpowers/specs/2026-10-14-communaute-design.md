# Communauté — spec

- **Date :** 14 octobre 2026
- **Statut :** écrite sans validation intermédiaire, à la demande de l'utilisateur (« continue avec tes recommandations, je te dirai s'il y a quelque chose à modifier »). Chaque décision prise pour lui est listée au §8.
- **Origine :** lot 5, troisième partie, après les notifications et les sessions live. Feuille de route, tâches 5.1 et 5.2 : espaces de communauté (le général et un par parcours) et leurs droits ; publications, commentaires, réactions, modification et suppression.
- **Cahier des charges :** §29 (communauté générale et espaces privés par parcours), §30 (publications), §31 (modération, partie suivante).
- **Design de référence :**
  - `NdCommunaute` : les onglets d'espaces, le champ de publication, les publications, les réponses, l'espace verrouillé, la colonne de droite ;
  - `NdCModales` : « Supprimer cette publication ? », « Publication en ligne », « Lien copié », « Publication supprimée ».
- **Règle provisoire avant le lot 2** (abonnements), décidée pour tout le lot 5 :
  - tout compte inscrit lit et publie dans l'espace général ;
  - un espace de parcours est ouvert à qui suit une formation de ce parcours (il en a ouvert une leçon).

## 1. Ce qui est décidé

| Question | Décision |
|---|---|
| Les espaces | « Général », puis un par parcours actif (Académique, Digital, Business…), dans l'ordre des parcours |
| L'onglet « Général » | Le fil de **tous** les espaces ouverts au compte, comme le design, qui y mêle des publications de l'espace Académique, de l'espace Digital et de l'espace général. Publier depuis cet onglet publie dans l'espace général |
| Un onglet de parcours | Le fil de cet espace seulement ; on y publie dans cet espace |
| Qui entre dans un espace de parcours | Qui suit une formation du parcours ; le formateur d'une formation du parcours ; l'équipe |
| Un espace fermé | L'onglet reste, avec un cadenas ; son contenu est « Espace <nom> verrouillé » et le moyen d'y entrer |
| Une publication | Un titre facultatif (120 caractères au plus), un texte (1 à 3 000), et une pièce jointe facultative : une image (JPEG, PNG ou WebP) ou un PDF, de 10 Mo au plus |
| Les réponses | Une liste de commentaires sous chaque publication (1 à 1 000 caractères), sur un seul niveau |
| Les réactions | « J’aime », une fois par compte et par publication ; un second clic la retire |
| Modifier | Son auteur modifie le titre et le texte de sa publication ; elle est marquée « modifiée ». Une pièce jointe ne se remplace pas : on supprime et on republie |
| Supprimer | Son auteur supprime sa publication (avec ses réponses) ou son commentaire ; **l'équipe** supprime n'importe quelle publication ou commentaire |
| Signaler | Pas encore : le menu « Signaler » arrive avec la partie Modération, avec la file de l'équipe et l'analyse automatique |
| Notification | « Nouvelle réponse » à l'auteur d'une publication quand quelqu'un d'autre y répond (catégorie Communauté du profil) |
| Les noms | Prénom et nom sur une publication, « Prénom N. » sur une réponse, comme le design ; jamais l'adresse e-mail |

## 2. Qui peut quoi

- **Lire et publier dans l'espace général :** tout compte connecté, non suspendu.
- **Lire et publier dans un espace de parcours :**
  - un compte qui a ouvert une leçon d'une formation de ce parcours ;
  - le formateur (compte relié à la fiche) d'une formation de ce parcours ;
  - l'équipe (modérateur, admin, super admin).
- **Commenter et aimer :** les mêmes droits que la lecture de l'espace de la publication.
- **Modifier :** l'auteur seulement.
- **Supprimer :** l'auteur, ou l'équipe.
- **Un compte suspendu :** rien, comme partout.
- **Un visiteur :** rien ; la page est dans l'espace connecté.

## 3. Les écrans

**La page Communauté** (`/communaute`, design `NdCommunaute`) :
- **En-tête :** « Communauté » et « Posez vos questions, partagez vos réussites, entraidez-vous. ».
- **Les onglets d'espaces :** « Général », puis les parcours. Un espace fermé porte un cadenas.
- **Le champ de publication** (en haut du fil d'un espace ouvert) :
  - l'avatar du compte ;
  - un titre facultatif et le texte ;
  - les boutons **Image** et **Fichier** ;
  - la mention « Soyez bienveillant : l’équipe Étudium veille aux échanges. ». Celle du design, « Les publications sont vérifiées automatiquement. », viendra avec l'analyse automatique ;
  - **Publier**, puis le message « Publication en ligne » · « Elle apparaît en haut du fil. ».
- **Une publication :**
  - l'avatar, le prénom et le nom, l'étiquette « Formateur » ou « Équipe Étudium », ou « Vous » sur les siennes ;
  - « Espace Académique · il y a 2 h » (« Espace général » pour le général) ;
  - le titre en gras, le texte ;
  - l'image, ou le PDF (« Plan-revue.pdf · 240 Ko », qui s'ouvre dans un nouvel onglet) ;
  - **J’aime** avec son nombre, et « 2 réponses » ;
  - « (modifiée) » si elle l'a été.
- **Le menu ⋮ d'une publication :**
  - **Copier le lien** (« Lien copié ») ;
  - **Modifier**, pour l'auteur ;
  - **Supprimer**, pour l'auteur et l'équipe. Il ouvre « Supprimer cette publication ? » · « Elle disparaîtra de l’espace <nom> avec toutes ses réponses. Cette action est définitive. », puis le message « Publication supprimée ».
- **Les réponses :**
  - les 2 dernières sous la publication ; « Voir les 5 réponses » les déplie toutes ;
  - chacune avec son avatar, « Prénom N. », le moment, le texte, et **Supprimer** pour son auteur et l'équipe ;
  - en bas, le champ « Écrire une réponse… » et **Répondre**.
- **Le fil :** 20 publications, des plus récentes aux plus anciennes, puis **Voir plus**.
- **Vide :** « Aucune publication pour l’instant » · « Lancez la conversation : posez une question ou partagez une réussite. ».
- **Un espace fermé :**
  - « Espace <nom> verrouillé » ;
  - « Commencez une formation du parcours <nom> pour rejoindre son espace. » ;
  - **Voir les formations du parcours**, vers `/parcours?parcours=<slug>`.
  - La phrase du design (« pas inclus dans votre formule ») viendra avec les abonnements (lot 2).
- **La colonne de droite** (dès 1 280 px ; sous le fil sur un écran plus petit) :
  - « Prochaine session » : la carte des sessions live, avec « Voir la session » ;
  - « Membres actifs » : les 3 comptes qui ont le plus publié et répondu cette semaine dans les espaces ouverts au compte, avec leur espace principal.
  - « À la une » (mots-clés) et « Challenge du mois » ne sont pas faits : il n'y a ni mots-clés ni challenges.

**La page d'une publication** (`/communaute/publications/<id>`) :
- la publication et toutes ses réponses, avec les mêmes actions ;
- l'adresse que copie « Copier le lien », et que donne la notification ;
- une publication introuvable, ou d'un espace fermé au compte : la page introuvable.

## 4. Pièces jointes

- **Une par publication :** image (JPEG, PNG, WebP) ou PDF, 10 Mo au plus ; le type est vérifié sur les premiers octets du fichier, comme pour les ressources des leçons.
- **L'envoi :**
  - le navigateur dépose le fichier dans un espace de stockage privé « communaute », dans le dossier du compte ;
  - la base vérifie ensuite qu'il est bien à lui avant de l'attacher ;
  - si la publication échoue, le fichier est retiré.
- **La lecture :**
  - seuls ceux qui lisent l'espace de la publication obtiennent le fichier, par des liens temporaires (1 h) ;
  - l'image s'affiche dans la publication ; le PDF s'ouvre dans un nouvel onglet.
- **Supprimer une publication** retire aussi son fichier.

## 5. Base de données (migration 0019)

- **Tables :**
  - `publications` : `id`, `auteur` → profils, `parcours_id` (nul : espace général), `titre`, `texte`, `piece_jointe` (jsonb : chemin, nom, type, taille ; nulle sinon), `cree_le`, `modifie_le`, `modifiee` ;
  - `commentaires_publications` : `id`, `publication_id` (en cascade), `auteur`, `texte`, `cree_le` ;
  - `reactions_publications` : `(publication_id, profil_id)`, `cree_le`.
  - Les trois sont fermées aux comptes : tout passe par les fonctions.
- **Droits :**
  - `peut_lire_espace(p_parcours uuid)` : la règle du §2. Interne, aussi utilisée par le stockage.
- **Fonctions des comptes** (connecté, non suspendu ; heure de la base, jamais du client) :
  - `espaces_communaute()` : `[{id, nom, nom_court, couleur, slug, ouvert}]`, le général d'abord (id nul) ;
  - `fil_communaute(p_espace text, p_avant timestamptz, p_avant_id uuid, p_nombre int)` :
    - `p_espace` vaut `tous` ou l'id d'un parcours ;
    - rend `{publications, suite}` ; un espace fermé rend une liste vide ;
  - `publication_communaute(p_id)` : une publication et toutes ses réponses ; null si fermée ou inconnue ;
  - `publier(p_parcours uuid, p_titre, p_texte, p_piece jsonb) returns uuid` ;
  - `modifier_publication(p_id, p_titre, p_texte)` ;
  - `supprimer_publication(p_id) returns text` (le chemin du fichier à retirer, ou null) ;
  - `commenter(p_publication, p_texte) returns uuid`, qui prévient l'auteur de la publication ;
  - `supprimer_commentaire(p_id)` ;
  - `basculer_reaction(p_publication) returns jsonb` (`{j_aime, reactions}`) ;
  - `membres_actifs()` : `[{prenom, nom, initiales, espace}]`, 3 au plus.
- **Ce que rend une publication :**
  - `{id, auteur: {prenom, nom, role}, est_moi, espace: {id, nom}, titre, texte, piece_jointe, cree_le, modifiee, reactions, j_aime, reponses, dernieres_reponses: [2], peut_supprimer}` ;
  - `role` vaut `formateur`, `equipe` ou nul.
- **Stockage :**
  - l'espace « communaute », privé, 10 Mo, avec ses 4 types ;
  - déposer dans son propre dossier (compte actif) ;
  - lire si une publication lisible l'attache, ou si c'est son propre dossier ;
  - supprimer dans son dossier, ou pour l'équipe.
- **Messages de refus** (affichés tels quels) :
  - « Cet espace ne vous est pas ouvert. » ;
  - « Écrivez votre publication (3 000 caractères au plus). » ;
  - « Le titre dépasse 120 caractères. » ;
  - « Écrivez votre réponse (1 000 caractères au plus). » ;
  - « Cette publication n’est pas la vôtre. » ;
  - « Cette publication n’existe plus. » ;
  - « Ce fichier n’est pas le vôtre. ».
- **Rejouable.**
- **Avant la 0019 :** la page Communauté affiche « Appliquez la migration 0019 (guide « Ce qui te revient », section 24). ».

## 6. Tests

- **Base (PGlite) :**
  - droits par espace :
    - un compte sans formation ne lit que le général ;
    - un suiveur, un formateur du parcours et l'équipe entrent dans l'espace ;
    - un autre compte est refusé ;
    - un compte suspendu, et un visiteur, sont refusés ;
  - publier, modifier (l'auteur seulement, « modifiée »), supprimer (l'auteur et l'équipe, avec ses réponses et ses réactions, et le chemin du fichier rendu) ;
  - le fil « tous » mêle les espaces ouverts, jamais un espace fermé ;
  - curseur « Voir plus » sans saut ni doublon ;
  - réponses : les 2 dernières, leur nombre ; « Nouvelle réponse » à l'auteur, pas à soi ;
  - « J’aime » qui bascule ;
  - pièce jointe : refusée si elle n'est pas dans son dossier ; lisible par un compte de l'espace, pas par un autre ;
  - membres actifs ; aucune adresse e-mail livrée ; migration rejouable.
- **Application :** lectures (liens temporaires des fichiers), actions (refus, fichier retiré si la publication échoue), dates « il y a 2 h ».
- **Composants :**
  - onglets, espace verrouillé ;
  - champ de publication (pièce jointe, refus) ;
  - publication (menu, modifier, supprimer avec confirmation, J’aime, réponses dépliées, répondre) ;
  - Voir plus ; colonne de droite ; page d'une publication.
- **Rendu** à 1440, 390 et 320 px (texte de 3 000 caractères, image, PDF au long nom).

## 7. Hors de cette partie

- **Signaler une publication**, l'analyse automatique (autoriser, signaler, bloquer) et la file de modération de l'équipe : partie suivante, Modération.
- Mots-clés et « À la une », challenges, mentions, réactions sur les réponses, réponses imbriquées, modification d'une réponse.
- La lecture seule des comptes gratuits et des anciens abonnés : lot 2.
- Les photos de profil dans la communauté : les initiales suffisent pour l'instant.

## 8. Décisions prises pour l'utilisateur (à corriger s'il le souhaite)

1. L'onglet « Général » montre le fil de tous ses espaces ouverts, et on y publie dans l'espace général.
2. Les formateurs d'une formation du parcours et l'équipe entrent dans l'espace du parcours.
3. Une seule pièce jointe : image ou PDF, 10 Mo au plus.
4. Les réponses sont sur un seul niveau ; on ne modifie pas une réponse, on la supprime.
5. Une seule réaction, « J’aime », sur les publications seulement.
6. L'équipe peut supprimer n'importe quelle publication ou réponse dès maintenant ; le reste de la modération vient ensuite.
7. « Signaler » et « Les publications sont vérifiées automatiquement » attendent la partie Modération, pour ne pas promettre ce qui n'existe pas encore.
8. Un espace fermé invite à commencer une formation du parcours, en attendant les abonnements.
9. Pas de mots-clés ni de challenges dans la colonne de droite ; la prochaine session live et les membres actifs, oui.
10. Seul l'auteur d'une publication est prévenu d'une nouvelle réponse ; pas de notification pour un « J’aime ».
