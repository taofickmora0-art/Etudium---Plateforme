# Plan : la Bibliothèque numérique d'Étudium

Date : 3 novembre 2026. Demande de l'utilisateur : « un espace pour héberger les livres numériques, pour que les gens trouvent des informations qui ne sont pas forcément dans les formations ».

**À savoir d'abord** : le cahier des charges V1 ne prévoit pas de bibliothèque. Il prévoit les « Ressources pédagogiques » rattachées à chaque formation (section 15 : téléchargeables ou non, lecteur PDF intégré), qui existent déjà. La Bibliothèque est donc une **nouveauté**, un **lot 7**, à faire maintenant que le site est en ligne. Elle réutilise ce qui existe : lecteur PDF, fichiers protégés, abonnements, favoris, recherche.

## 1. Ce que c'est

Un espace « **Bibliothèque** » où l'équipe dépose des livres numériques et des documents de référence (guides, manuels, modèles de mémoire, méthodes…), indépendants des formations.
- L'étudiant cherche, lit dans le site, reprend sa lecture où il l'a laissée, et télécharge si c'est permis.
- Une formation peut aussi recommander des livres (« Pour aller plus loin »).

## 2. Ce que voit l'étudiant

- **Le menu** : une entrée « **Bibliothèque** » (barre latérale sur ordinateur ; sur téléphone, dans le menu ≡).
- **La page Bibliothèque** :
  - une recherche (titre, auteur, mots-clés) et des filtres par parcours ou catégorie, et « Gratuits » ;
  - une rangée « Continuer la lecture » ;
  - des cartes au style du catalogue : couverture, titre, auteur, nombre de pages, étiquette « Gratuit » ou « Inclus dans l'abonnement », cœur favori.
- **La fiche d'un livre** :
  - la couverture, le titre, l'auteur, le résumé, la catégorie, la langue, le nombre de pages et l'année ;
  - le bouton « **Lire** » (ou « Continuer, page 42 ») ;
  - « **Télécharger** » si c'est permis ;
  - les formations liées.
- **Le lecteur** : plein écran, page par page, zoom, sommaire du PDF s'il en a un, reprise automatique à la dernière page lue, mode nuit. Sur téléphone, il fonctionne au doigt.
- **Les favoris** : l'onglet Favoris existant reçoit aussi les livres.
- **Un livre fermé** (abonnement nécessaire) : la fiche reste visible, avec « Lire » remplacé par « Voir les abonnements », comme pour les formations.

## 3. Ce que voit l'équipe (back-office)

- **La page « Bibliothèque »** : la liste des livres en cartes, avec leur état (brouillon, publié, archivé), le nombre de lectures et de téléchargements, et le menu ⋮ (modifier, publier, archiver, supprimer un brouillon).
- **« Ajouter un livre »** :
  - le dépôt du PDF ;
  - la couverture, à envoyer ou fabriquée automatiquement à partir de la première page ;
  - les informations : titre, auteur, résumé, catégorie ou parcours, langue, année, mots-clés ;
  - les réglages : accès (gratuit ou abonnés), téléchargement (oui ou non) ;
  - la case « **J'ai le droit de diffuser ce livre** », obligatoire (voir §5).
- **Les formations** : dans la fiche d'une formation, choisir des livres à recommander.
- **La vue d'ensemble** : les livres les plus lus.

## 4. Les règles

- **L'accès** suit les formations. Un livre « gratuit » est lisible par tout compte connecté ; un livre « inclus » demande un abonnement actif. Les visiteurs voient les fiches, mais lisent après connexion.
- **Livre non téléchargeable** : lecture dans le lecteur interne uniquement, avec des liens d'accès de courte durée, sans bouton de téléchargement. Comme pour les ressources, ce n'est **pas** une protection absolue contre la capture d'écran.
- **Option** : un filigrane léger (le nom et l'e-mail du lecteur) sur les pages, pour décourager le partage.
- **La lecture est suivie** : dernière page lue, et livre « terminé » quand la dernière page est atteinte. Ça alimente « Continuer la lecture » et les statistiques.
- **Formats** : le **PDF** d'abord, parce que le lecteur existe déjà ; l'**EPUB** plus tard, s'il y en a besoin, car il demande un autre lecteur.

## 5. Deux points à ne pas négliger

1. **Les droits d'auteur.** Ne déposer que des livres dont Étudium a le droit de diffuser le contenu :
   - ceux que tu écris, toi ou tes formateurs ;
   - ceux dont l'auteur a donné son accord écrit ;
   - les livres libres de droits ou sous licence libre.
   
   Un livre du commerce déposé sans accord expose la plateforme à des poursuites. D'où la case obligatoire, et une ligne à ajouter aux Conditions d'utilisation.
2. **L'espace de stockage.** L'offre gratuite de Supabase n'offre que **1 Go** de fichiers pour tout le site : vidéos d'exercices, images, ressources, et maintenant les livres. Quelques dizaines de PDF suffisent à le remplir. Avec la bibliothèque, le passage à **Supabase Pro** (100 Go) devient nécessaire. Taille maximale proposée par livre : 50 Mo.

## 6. Découpage proposé

| Étape | Contenu | Résultat visible |
|---|---|---|
| **A** | Base : livres, accès, espace de fichiers privé, migration 0074. Back-office : ajouter, modifier, publier, archiver | L'équipe dépose et publie des livres |
| **B** | Page Bibliothèque, fiche d'un livre, lecteur plein écran avec reprise | Les étudiants lisent |
| **C** | Favoris, « Continuer la lecture », livres recommandés dans les formations, statistiques, recherche générale | La bibliothèque est complète |
| **D** *(plus tard)* | EPUB, filigrane, formateurs qui proposent des livres (validés par l'équipe) | Options |

Chaque étape est testée et mise en ligne à part ; tu valides avant la suivante. Les étapes A, B et C n'ont besoin que de **la migration 0074**, à appliquer une fois.

## 7. Tes choix (mes recommandations en premier)

1. **Qui dépose les livres ?** **L'équipe seule au départ** (recommandé) ; ou aussi les formateurs, avec validation par l'équipe.
2. **Accès par défaut d'un nouveau livre ?** **« Inclus dans l'abonnement »** (recommandé), pour donner de la valeur aux abonnements ; ou « Gratuit ».
3. **Téléchargement par défaut ?** **Non** (recommandé), lecture dans le site ; ou Oui.
4. **Filigrane** sur les livres non téléchargeables ? **Plus tard** (recommandé) ; ou dès l'étape B.
5. **Classement** : par **parcours** (Réussite académique, Compétences digitales, Business), plus des **catégories libres** créées par l'équipe (recommandé) ; ou par parcours seulement.
6. **Dans le menu** : une entrée « **Bibliothèque** » à part entière (recommandé) ; ou un onglet dans « Formations ».
