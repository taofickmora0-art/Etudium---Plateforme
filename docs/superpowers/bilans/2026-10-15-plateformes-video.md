# Bilan : la durée exacte des vidéos, et les vidéos TikTok, Tella, Loom, ScreenPal et Google Drive (15 octobre 2026)

Tes messages du 15 octobre : « je n'arrive pas à cliquer sur Terminer la leçon… », puis « quand on met le lien, ça
mette le nombre de minutes exact », et ton choix des plateformes (Loom, ScreenPal, TikTok, Tella, Google Drive sans
mesure). La spec : `docs/superpowers/specs/2026-10-15-plateformes-video-design.md`. Le plan :
`docs/superpowers/plans/2026-10-15-plateformes-video.md`. Une relecture indépendante à la fin.

## En bref

- **Pourquoi « Terminer la leçon » restait grisé :**
  - Le seuil de 90 % se mesure sur la durée tapée dans l'éditeur, pas sur la vidéo.
  - Ta leçon « Comment écrire un titre viral » indiquait 10:00. Si la vidéo est plus courte, les 90 % sont impossibles.
- **La durée exacte, toute seule :**
  - Coller un lien YouTube, Vimeo, TikTok ou Tella inscrit la durée lue sur la vidéo.
  - Une leçon déjà enregistrée avec une durée fausse affiche « La vidéo dure 2:09 ; la durée saisie est 10:00 » et le
    bouton **Utiliser 2:09**.
  - Côté étudiant, un message explique pourquoi le seuil ne peut pas être atteint, au lieu d'un bouton grisé sans raison.
- **Les nouvelles plateformes :**

  | Plateforme | Durée automatique | Temps regardé et seuil | Fin de la leçon |
  |---|---|---|---|
  | YouTube, Vimeo | Oui | Oui | Au seuil |
  | TikTok (vertical), Tella | Oui (la vidéo se lance sans le son, en arrière-plan) | Oui | Au seuil ; d'un clic si leur lecteur ne répond pas |
  | Loom, ScreenPal, Google Drive | Non (facultative, à la main) | Non | D'un clic |

- **Les liens reconnus :**
  - un lien court TikTok (`vm.tiktok.com`) est expliqué ;
  - un faux domaine (`tiktok.com.evil.com`) n'est jamais accepté.
- **Vérifications :**
  - 1 641 tests, dont la migration 0030 sur une vraie base Postgres en mémoire ;
  - les types, le code et la compilation de production ;
  - la lecture réelle de la durée d'une vidéo YouTube dans le navigateur ;
  - le format vertical de TikTok à 1440 et 390 px.

## Corrigé après la relecture

- **Jamais d'impasse :** si le lecteur TikTok ou Tella ne répond pas, ou si la vidéo a été supprimée,
  « Terminer la leçon » se débloque.
- **La dernière seconde compte :** un seuil fixé à 100 % était impossible à atteindre.
- **La durée TikTok/Tella :** leur lecteur ne la donne qu'en lecture. L'éditeur lance donc la vidéo sans le son pour
  la lire. S'il n'y arrive pas, il affiche « Durée non lue sur la vidéo : saisissez-la à la main ».
- **Lien retouché :** retoucher le lien de la même vidéo (ajouter `?t=5`) bloquait l'éditeur sur « Lecture de la durée… ».
- **Positions espacées :** si TikTok n'envoie sa position que toutes les quelques secondes, le temps regardé avance
  maintenant quand même.

## Ce qui te revient

1. **Migration 0030** : applique `web/supabase/migrations/0030_plateformes_video.sql`, après la 0029.
2. **Guide** : suis la section 36 de « Ce qui te revient ».
3. **Tes leçons « Youtube Automation »** : ouvre-les dans l'éditeur ; si l'encadré jaune apparaît, clique
   **Utiliser …**, puis **Enregistrer**.
4. **Essaie un vrai lien TikTok et un vrai lien Tella.** Je n'ai pas pu lancer leurs lecteurs dans mon navigateur.
   Si tu vois « Le temps regardé ne peut pas être mesuré avec ce lecteur », dis-le-moi.

## Décisions que j'ai prises pour toi

1. **TikTok et Tella** mesurent le temps regardé, avec une sortie de secours. Si leur lecteur ne répond pas, la leçon
   se termine d'un clic. La base l'accepte donc aussi pour elles : un étudiant très technique pourrait terminer sans
   regarder. Une fois leurs lecteurs vérifiés avec tes liens, je peux rendre le seuil strict pour elles.
2. **Google Drive, Loom, ScreenPal** : le lecteur de la plateforme tel quel. La leçon se termine d'un clic, et la
   durée est facultative.
3. **La durée lue** est arrondie à la seconde inférieure, pour qu'un seuil de 100 % reste atteignable.
4. **Ouvrir une leçon** ne change jamais sa durée enregistrée sans que tu le voies : seul un nouveau lien la remplace.
5. **Les vidéos des publications de la communauté** ne changent pas : YouTube seulement, comme avant.

## Petits points notés pour plus tard

- Pour TikTok et Tella, le bouton de vitesse apparaît un instant avant que le lecteur soit prêt.
- Les liens Loom qui portent le titre avant l'identifiant, et les liens Drive `file/u/0/d/…`, ne sont pas reconnus.
- **Le lien source reste accessible.** Drive, Loom et ScreenPal affichent un bouton pour ouvrir la vidéo chez eux. Le
  lien est donc partageable, ce qui compte pour une formation payante.
- Un contrôle de type (`estFournisseur`) est à resserrer. Il n'a aucun effet aujourd'hui.
