# Point du 2 novembre 2026 : inscription aux formations, catalogue, fiche et formateurs

Demande faite en ton absence, avec tes captures (catalogue en cartes, page d'un cours, carte du formateur au survol, trois blocs d'Étudium). Spec : `docs/superpowers/specs/2026-11-02-inscription-formateurs-design.md`.

## Ce qui est fait

1. **Inscription** (migration 0069) : « S'inscrire à ce cours » en haut de la fiche. Tant qu'on n'est pas inscrit, les leçons ont un cadenas (sauf les aperçus). Personne ne perd l'accès : qui avait déjà ouvert une leçon, fait un quiz, rendu un exercice ou obtenu un certificat est inscrit automatiquement. L'équipe a déjà tout ouvert et ne s'inscrit pas.
2. **Catalogue** : nouvelles cartes (couverture, titre sur deux lignes, « N modules • N leçons », « N apprenants », résumé, note · durée · niveau, puis « Voir le cours » ou « N % terminé »). Même nombre de colonnes qu'avant.
3. **Favoris dans le catalogue** : un cœur vide sur chaque carte, rouge et plein une fois en favori.
4. **Fiche d'une formation** : « Contenus du cours » (« Module 1 - Titre », « 3 leçons • 43 min », rond, coche ou cadenas, durée). À droite, « Formateur du cours » : photo, nom, « N formations », présentation, réseaux ; au survol du nom, « Voir le profil » et « Message ».
5. **Profil d'un formateur** (`/formateurs/…`, migration 0070) : son profil, ses réseaux, « Message », ses formations.
6. **Messagerie** : « Rechercher un formateur » ; seuls les formateurs des formations où l'étudiant est inscrit (et l'Équipe Étudium).
7. **Leçon ouverte** : pas de bloc formateur, la page reste comme avant. Une leçon fermée faute d'inscription propose « S'inscrire à ce cours ».
8. **Formations d'exemple** : script `web/supabase/exemples/retirer-lot-1.sql` (guide §70).
9. **Harmonisation** : « Explorer le catalogue » (tableau de bord vide) et « Voir plus » deviennent de simples liens comme « Voir les événements » ; « Prochaine session live » devient « Prochaine session » ; un seul format de module partout, « Module N - Titre ».

## Décisions que j'ai prises pour toi

1. « Le nombre qu'on avait défini » : j'ai compris le nombre de colonnes du catalogue, gardé tel quel.
2. La note, la durée et le niveau restent sur la carte.
3. Un inscrit voit son pourcentage sur la carte, même « 0 % terminé ».
4. Les leçons d'aperçu restent ouvertes sans inscription.
5. On ne s'inscrit qu'à une formation gratuite, ou à toutes avec un abonnement ; sinon « Voir les abonnements ».
6. « N apprenants » = les inscrits (sans l'équipe ni les formateurs), affiché même à 0.
7. Six réseaux : Instagram, YouTube, LinkedIn, Facebook, Telegram, TikTok. La photo du formateur est celle de son compte.
8. « Message » n'apparaît que si l'étudiant peut écrire (inscrit à une de ses formations, fiche reliée à un compte formateur).
9. La couverture n'est plus répétée sur la fiche.
10. « Harmoniser … comme sur la troisième image » : compris comme « même structure simple que le bloc Prochaine session » pour les trois blocs envoyés, plus un seul format de module.
11. Les trois parcours ne sont pas supprimés avec les formations d'exemple : ce sont les vrais.
12. « Mes formations » ne montre plus que les formations où l'on est inscrit.
13. La durée d'une leçon s'affiche au format « 12:30 » partout.
14. Un modérateur qui suivait une formation devra s'y réinscrire d'un clic (le rattrapage suit la règle des statistiques, qui exclut l'équipe).

## Vérifications

- Suite complète : 391 fichiers, 2 772 tests, tous verts ; types et lint sans erreur.
- Relecture indépendante : aucun défaut critique ; ses 2 points importants et 6 de ses points mineurs ont été corrigés (tableau de bord et recherche qui ignoraient l'inscription, bouton « S'inscrire » montré à l'équipe, rattrapage élargi aux quiz et exercices, notifications pour les inscrits, « Mes formations », nom du cœur pour les lecteurs d'écran, script de retrait, lien des événements).
- Vu dans le navigateur, en visiteur, sur ta base de test (sans les migrations 0069 et 0070) : le catalogue et la fiche, sur ordinateur et sur téléphone. Les pages qui demandent une connexion n'ont été vérifiées que par les tests.

## Ce qui te revient

Dans l'ordre (guide « Ce qui te revient ») :
1. la migration 0068 (section 67) ;
2. la migration 0069 (section 68) ;
3. la migration 0070 (section 69) ;
4. le script `retirer-lot-1.sql` (section 70) ;
5. les réseaux de tes formateurs, au back-office ;
6. la partie « 7 bis » de la liste de recette.

## Laissé pour plus tard (mineur)

- Un clic sur un cœur relit tout le catalogue ; la fiche lit toutes les formations du formateur pour n'en garder que le nombre. Sans effet visible, à alléger si les pages deviennent lentes.
- Avant la 0069, deux phrases parlent déjà d'inscription (messagerie, « Mes formations »).
- Un inscrit qui a commencé une formation payante, dont l'abonnement a pris fin et dont un aperçu n'est pas terminé, la voit encore « En cours ».
- La colonne `compte_id` des fiches formateur reste lisible par tous (déjà le cas avant ce travail) ; à fermer avec la mise en ligne.
- Un compte formateur qui ouvre le profil d'un formateur le voit dans le cadre de l'espace étudiant.
