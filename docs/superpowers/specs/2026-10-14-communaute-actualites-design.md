# Communauté v2 : le fil « Actualités » — spec

- **Date :** 14 octobre 2026
- **Statut :** écrite sans validation intermédiaire, à la demande de l'utilisateur (« continue avec tes recommandations, je te dirai s'il y a quelque chose à modifier »). Chaque décision prise pour lui est listée au §8.
- **Origine :** captures de la communauté « izimentor » (FluentCommunity) envoyées par l'utilisateur le 14 octobre, sur ordinateur et sur téléphone :
  - une vidéo d'annonce épinglée en haut du fil, activable et ciblée ;
  - à droite, « Publications tendances » et « Activités récentes » ;
  - des aperçus de liens (Google Meet, Zoom…) et des vidéos YouTube dans les publications ;
  - les commentaires visibles sous chaque publication ;
  - sur téléphone, le menu ≡ (fait le 14 octobre) avec les espaces de la communauté.
- **Design de référence** (toile « Étudium — Nouveau design », version 6) : `NdCommunaute` (Communauté · Actualités), `NdMobCommunaute`, `NdMobCommunautePublications`, `NdMobMenuOuvert`, `NdAdminAnnonceCommunaute`.
- **Suite :** une seconde partie reliera les sessions live à la communauté : visuel de promotion, publication automatique, pastille des nouvelles sessions. Elle a sa propre spec.

## 1. Ce qui est décidé

| Question | Décision |
|---|---|
| Les onglets | **Actualités** (le fil de tous les espaces ouverts au compte ; on y publie dans l'espace général), **Général** (l'espace général seul), puis un par parcours, avec un cadenas s'il est fermé |
| L'annonce épinglée | Une seule, gérée par l'équipe au back-office : afficher ou non, un titre, un texte, une vidéo YouTube ou une affiche, et son public (tous les membres, ou ceux d'un parcours ; la formule d'abonnement viendra au lot 2). Elle s'affiche en haut du fil « Actualités » |
| Les liens | Une adresse écrite dans une publication devient un lien cliquable. La première adresse donne un aperçu : une vidéo YouTube se lit dans la publication ; un autre site montre sa carte (image, domaine, titre, description) |
| L'aperçu | Le serveur lit la page au moment de publier ou de modifier, jamais le navigateur du lecteur. Il refuse les adresses privées, limite le temps et la taille. Un site qui ne répond pas : pas d'aperçu, la publication part quand même |
| Le tri | « Les plus récentes » (par défaut), « Les plus populaires » (J’aime + 2 × commentaires, sur 30 jours), « Mes enregistrements » |
| Enregistrer | Le signet d'une publication la range dans « Mes enregistrements », visible du seul compte |
| Les commentaires | Le mot « réponse » devient « commentaire » partout dans les écrans, comme le design. Ils restent sur un seul niveau, sans J’aime |
| La colonne de droite | « Publications tendances » (les 5 publications les plus aimées et commentées des 7 derniers jours, dans les espaces ouverts au compte), « Activités récentes » (les 6 dernières publications ou commentaires), « Prochaine session ». « Membres actifs » disparaît |
| Le champ de publication | Fermé : « Quoi de neuf, <prénom> ? » avec Image et Fichier. Ouvert : le titre, le texte, le fichier, **Publier** |
| Le téléphone | Les onglets défilent en largeur. Le menu ≡ montre, sur les pages de la communauté, le groupe « Espaces de la communauté » (Actualités, Général, les parcours) |

## 2. L'annonce épinglée

- **Au back-office :** nouvelle page « Annonce de la communauté » (`/admin/communaute`, entrée « Communauté » du groupe Plateforme), design `NdAdminAnnonceCommunaute` :
  - « Afficher l’annonce » (interrupteur) ;
  - Titre (120 caractères), Texte (500) ;
  - Média : « Vidéo YouTube » (une adresse YouTube) ou « Affiche » (une image JPEG, PNG ou WebP de 10 Mo au plus) ;
  - « Qui la voit » : « Tous les membres », « Les membres d’un parcours » (un parcours), « Une formule d’abonnement » (grisée, « Avec les abonnements (lot 2). ») ;
  - à droite, l'aperçu dans le fil ;
  - **Enregistrer** (« Annonce enregistrée ») ; **Retirer l’annonce** (confirmée : « Retirer l’annonce ? » · « Elle disparaît du fil. Vous pourrez en écrire une autre. »).
- **Dans le fil « Actualités » :**
  - en haut, la carte : la vidéo (une image et le bouton Lecture ; la vidéo YouTube se charge au clic) ou l'affiche, l'étiquette « Annonce épinglée », le titre et le texte ;
  - pour l'équipe, un ⋮ « Gérer l’annonce » vers le back-office.
- **Qui la voit :** un compte connecté, non suspendu ; pour un parcours, qui en lit l'espace.

## 3. Les liens et les aperçus

- **Dans le texte :** chaque adresse `http(s)://…` devient un lien (nouvel onglet, `rel="noopener nofollow ugc"`).
- **La première adresse** donne l'aperçu, rangé avec la publication :
  - YouTube (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`) : `{ type: "youtube", id }`. La publication montre l'image de la vidéo et le bouton Lecture ; au clic, le lecteur YouTube sans cookies (`youtube-nocookie.com`) ;
  - un autre site : `{ type: "lien", url, titre, description, image }`. La carte montre l'image, le **domaine tiré de l'adresse** (jamais d'une donnée de la page), le titre et la description.
- **La lecture de la page** (serveur, au moment de publier ou de modifier) :
  - `http` ou `https`, ports 80 et 443 ;
  - aucune adresse privée, locale ou réservée, vérifiée sur chaque adresse IP du nom et à chaque redirection (3 au plus) ;
  - 4 secondes et 512 Ko au plus, une page HTML seulement ;
  - les balises `og:title`, `og:description`, `og:image` (à défaut `twitter:*` et `<title>`), coupées à 200, 300 et 1 000 caractères ;
  - un échec : pas d'aperçu.
- **La base vérifie** que l'adresse de l'aperçu figure dans le texte, et les longueurs. Un aperçu ne peut donc pas présenter une autre adresse que celle du lien.
- **L'image d'un aperçu** est celle du site, affichée sans transmettre la page d'origine (`referrerpolicy="no-referrer"`).
- **Modifier une publication** recalcule l'aperçu.

## 4. Le fil, le tri, les enregistrements

- **Le fil** reste paginé par 20, « Voir plus ».
  - « Les plus récentes » : le curseur `(cree_le, id)` ;
  - « Les plus populaires » et « Mes enregistrements » : par pages.
- **Le signet** (icône « Enregistrer la publication » / « Retirer des enregistrements ») bascule aussitôt.
- **Sous chaque publication :**
  - le cœur (J’aime) et la bulle (Commenter) ;
  - à droite, les initiales des 3 derniers qui ont aimé, « 12 J’aime · 4 commentaires » ;
  - les 2 derniers commentaires en bulles, « Voir les N commentaires », et le champ « Écrire un commentaire… ».

## 5. La colonne de droite

- **Publications tendances :** l'avatar, les trois premières lignes de la publication et son auteur, vers sa page.
- **Activités récentes :** « Koffi D. a publié « … » » ou « Koffi D. a commenté « … » » (l'extrait de la publication), et le moment en bleu, vers la publication. Seules les publications en ligne des espaces ouverts au compte comptent.
- **Prochaine session :** inchangée.
- **Sur téléphone et tablette :** sous le fil.

## 6. Base de données (migration 0021)

- `publications.apercu jsonb` (l'aperçu vérifié).
- `publications_enregistrees (profil_id, publication_id, cree_le)`, clé primaire double, fermée.
- `annonce_communaute` (une ligne) : `active`, `titre`, `texte`, `media` (`youtube` | `image` | null), `youtube_id`, `image_chemin`, `public` (`tous` | `parcours`), `parcours_id`, `modifiee_le`.
- **Fonctions :**
  - `publier` et `modifier_publication` reçoivent `p_apercu` ; `verifier_apercu(p_apercu, p_texte)` ;
  - `fil_communaute(p_espace, p_tri, p_avant, p_avant_id, p_page, p_nombre)` : `p_espace` vaut `tous`, `general` ou l'id d'un parcours ; `p_tri` vaut `recentes`, `populaires` ou `enregistrees` ;
  - la carte d'une publication ajoute `apercu`, `enregistree`, `aimee_par` (3 initiales) ;
  - `basculer_enregistrement(p_publication)` ;
  - `publications_tendances()`, `activites_recentes()` ;
  - `annonce_communaute()` (pour le compte qui lit, ou null), `annonce_equipe()`, `enregistrer_annonce(...)`, `retirer_annonce()` ;
  - l'affiche se lit si l'annonce est active et visible du compte (`fichier_communaute_lisible`).
- Rejouable ; rejouer la 0019 ou la 0020 demande de rejouer la 0021 ensuite.

## 7. Tests

- **Base :** l'aperçu vérifié (adresse absente du texte refusée), l'espace « general », les trois tris, les signets, les tendances et activités (espaces fermés exclus, publications en attente exclues), l'annonce (public, inactive, équipe seule), la lecture de l'affiche.
- **Serveur :** l'extraction de la première adresse, YouTube, la lecture d'une page (balises, adresses privées refusées, redirection vers une adresse privée refusée, délai, taille, page non HTML).
- **Écrans :** les onglets, l'annonce (vidéo au clic, ⋮ de l'équipe), les liens cliquables, l'aperçu et YouTube, le tri, le signet, les commentaires visibles, la colonne de droite, le champ fermé puis ouvert, le menu ≡ et ses espaces, la page de l'annonce au back-office.
- **Rendu** à 1440, 390 et 320 px.

## 8. Décisions prises pour l'utilisateur (à corriger s'il le souhaite)

1. « Actualités » rassemble tous les espaces ; « Général » devient un onglet à part.
2. Une seule annonce épinglée à la fois.
3. Le ciblage par formule d'abonnement attend le lot 2 ; en attendant : tous les membres, ou un parcours.
4. Seule la première adresse d'une publication donne un aperçu.
5. Les vidéos YouTube se chargent au clic, sans cookies.
6. « Les plus populaires » : J’aime + 2 × commentaires, sur 30 jours.
7. « Réponse » devient « commentaire » dans les écrans ; les commentaires restent sur un seul niveau, sans J’aime.
8. Les sujets (« #IA ») ne sont pas faits : il faudrait une liste gérée par l'équipe.
9. « Membres actifs » est remplacé par « Activités récentes ».
