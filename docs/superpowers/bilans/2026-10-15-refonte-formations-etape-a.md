# Bilan : refonte des formations, étape A — la création (15 octobre 2026)

Ta demande du 14 octobre (captures d'izimentor), d'après la spec que tu as validée le 15 octobre (« C'est bon ») :
`docs/superpowers/specs/2026-10-15-refonte-formations-design.md`. Le plan : `docs/superpowers/plans/2026-10-15-refonte-formations-etape-a.md`.
Une relecture indépendante à la fin, et ses points importants sont corrigés.

## En bref

- **L'onglet « Leçons »** (ancien « Programme »), au back-office et dans l'espace formateur :
  - « 3 sections · 22 leçons », **Tout replier / Tout déplier**, **+ Ajouter une section** ;
  - chaque section : poignée ⠿, « Module 2 : titre », pastille « 4 leçons » (replie la section), **Ajouter** (une leçon,
    en fenêtre), menu ⋮ (Renommer, Monter, Descendre, Supprimer) ;
  - chaque leçon : poignée ⠿, titre, « 06:10 · Vidéo · Aperçu », **Publiée ▾ / Brouillon ▾**, menu ⋮ (Modifier, Voir
    comme un étudiant, Monter, Descendre, Déplacer vers…, Supprimer).
- **Le glisser-déposer** marche à la souris, au toucher et au clavier, y compris d'une section à l'autre.
  - L'écran change aussitôt.
  - Si la base refuse, il revient en arrière avec un message.
- **Le statut d'une leçon** :
  - Les étudiants ne voient que les leçons publiées : dans le programme, le nombre de leçons, la progression, l'avis à
    50 %, le suivi du formateur et les statistiques.
  - La notification « Nouvelle leçon » part à la publication, pas à la création.
  - Publier une formation demande au moins une leçon publiée.
- **L'éditeur de leçon**, en deux colonnes comme izimentor :
  - **en haut** : « Retour aux leçons », « Leçon 3 sur 4 · Module 2 : … », les flèches ‹ ›, le statut, **Enregistrer** et
    l'œil **Voir comme un étudiant**, qui ouvre un nouvel onglet ;
  - **à gauche, les Réglages** : le lien de la vidéo avec son aperçu, la durée en minutes et secondes, « Activer les
    commentaires », « Leçon d'aperçu gratuite » et les **Documents & fichiers** ;
  - **à droite** : le titre en grand, le **texte mis en forme** (le même éditeur que la communauté : titres, gras,
    listes, liens, emojis), puis « Dans cette leçon » à déplier ;
  - quitter avec des changements non enregistrés demande « Quitter sans enregistrer ? ».
- **Côté étudiant** :
  - Le texte des leçons s'affiche mis en forme.
  - L'équipe et le formateur ouvrent une formation non publiée ou une leçon en brouillon, avec le bandeau
    « Aperçu : pas encore visible des étudiants ». Rien n'y est enregistré.
  - Une leçon en brouillon porte l'étiquette « Brouillon » dans leur programme.
- **Vérifications** :
  - 1 545 tests, dont la migration sur une vraie base Postgres en mémoire.
  - Les types, le code et la compilation de production.
  - Les rendus au navigateur, à 1440, 768, 390 et 320 px.
  - Un glisser-déposer à la souris.

## Corrigé après la relecture

- **Durée** : « 12.40 » tapé dans les minutes était lu comme 12 h 04. La leçon ne pouvait alors plus se terminer.
  L'éditeur n'accepte plus que des nombres entiers.
- **Erreur cachée** : une erreur dans « Dans cette leçon » (par exemple trop de points clés) restait dans la section
  repliée, et « Enregistrer » semblait ne rien faire. La section se déplie maintenant.
- **Sortie sans confirmation** : quitter l'éditeur par le menu ou le logo ne demandait rien. Tout lien demande
  maintenant confirmation. Le bouton Précédent du navigateur, lui, ne la demande pas encore.
- **Téléphone et tablette** : la barre de l'éditeur passait sous l'en-tête de l'application. Elle se colle maintenant
  juste dessous.
- **Pendant la vérification** : correction d'un écart d'affichage entre le serveur et le navigateur, dû au
  glisser-déposer. Sur téléphone, le titre d'une section a désormais sa propre ligne, et un titre de leçon long passe à
  la ligne.

## Ce qui te revient

1. **Migrations 0026 et 0027** : si ce n'est pas fait, applique la **0026** (ou rejoue-la, section 31), puis la
   **0027** (`web/supabase/migrations/0027_lecons_statut.sql`). Tes leçons actuelles restent publiées.
2. **Guide** : suis la section 33 de « Ce qui te revient ».

## Décisions que j'ai prises pour toi

1. **À vérifier : une nouvelle leçon ne naît en brouillon que si sa formation est déjà publiée.** Dans une formation
   jamais publiée, elle naît publiée, sinon il faudrait publier chaque leçon en plus de la formation. Tu avais validé
   « brouillon par défaut » : dis-moi si tu préfères brouillon partout.
2. « Voir comme un étudiant » s'ouvre dans un **nouvel onglet** : l'éditeur reste ouvert, rien n'est perdu.
3. **Monter et Descendre** gardent une leçon dans sa section. Pour changer de section : glisser, ou « Déplacer vers… ».
4. Les pages de leçon n'ont plus de fil d'Ariane : la barre de l'éditeur ramène aux leçons, comme izimentor.
5. Remettre une leçon en brouillon, puis la republier, renvoie la notification « Nouvelle leçon ».

## Petits points notés pour plus tard

- Le bouton Précédent du navigateur quitte l'éditeur sans confirmation.
- Ce qu'on tape pendant un enregistrement compte comme enregistré.
- Un message d'erreur de l'éditeur ne s'affiche qu'en haut de la page.
- **Rangement** :
  - deux refus de suite laissent l'écran faux jusqu'au rechargement ;
  - le message de succès s'affiche même quand la base n'a rien changé ;
  - pas de verrou contre deux rangements simultanés.
- Une leçon déposée sur l'en-tête d'une section va à la fin de celle-ci.
- Le glisser-déposer au clavier n'a pas encore été essayé dans un vrai navigateur. Le menu ⋮ reste une solution au
  clavier.
- Sur téléphone, le statut d'une leçon reste sur la ligne de son titre.
- Pour une formation archivée, le bandeau d'aperçu dit « pas encore publiée ».
- « Documents & fichiers » dit « vus et téléchargés », alors que certains documents sont en consultation seule.
- **Côté technique** :
  - un formateur peut, par un appel fabriqué, déplacer une leçon vers une autre de ses formations ;
  - la règle de lecture des leçons gagnerait à être optimisée.
