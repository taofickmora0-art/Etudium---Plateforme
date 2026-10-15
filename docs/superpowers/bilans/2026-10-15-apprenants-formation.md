# Bilan : refonte des formations, étape C — l'onglet « Apprenants » (15 octobre 2026)

Le choix 8 de la spec de la refonte (« étape C, après A et B »), puis ton message « La migration est appliquée, tu peux
continuer ». La spec : `docs/superpowers/specs/2026-10-15-apprenants-formation-design.md`. Le plan :
`docs/superpowers/plans/2026-10-15-apprenants-formation.md`. Une relecture indépendante à la fin.

## En bref

- **Un quatrième onglet, « Apprenants »**, dans l'éditeur d'une formation : au back-office (l'équipe, toutes les
  formations) et dans l'espace formateur (ses formations). Il s'ouvre aussi par `?onglet=apprenants`.
- **Quatre chiffres** sur toute la formation : apprenants, progression moyenne, « Formation terminée », « À risque ».
- **Filtres** Tous · À risque · Terminés, et la recherche par nom. Ils restent dans la page, jamais dans son adresse.
- **Le tableau**, 25 apprenants par page, les plus récemment actifs d'abord :
  - apprenant, dont le nom ouvre sa fiche (« Utilisateurs » pour l'équipe, « Étudiants » pour le formateur) ;
  - progression « 3 / 12 » avec sa barre ;
  - commencée le, dernière activité, état.
- **Les règles** sont celles de la page « Étudiants » :
  - un apprenant est un compte qui a ouvert une leçon publiée ;
  - ni le formateur de la formation ni l'équipe ne sont comptés ;
  - un apprenant est « À risque » après 10 jours sans activité.
- **Accès et données** : seuls l'équipe et le formateur de la formation lisent cet onglet, même par appel direct. Aucune
  adresse e-mail n'est affichée.
- **Sur téléphone** : les chiffres sont en 2 × 2, et le tableau défile dans son cadre.
- **Vérifications** :
  - 1 602 tests, dont la migration 0029 sur une vraie base Postgres en mémoire ;
  - les types, le code et la compilation de production ;
  - les rendus à 1440 et 320 px.

## Corrigé après la relecture

- Une erreur passagère de lecture des apprenants remplaçait tout l'éditeur par l'écran d'erreur. Tu perdais alors ce que
  tu avais saisi dans les autres onglets. L'erreur reste maintenant dans l'onglet, avec « Rechargez la page pour
  réessayer ».

## Ce qui te revient

1. **Migration 0029** : applique `web/supabase/migrations/0029_apprenants_formation.sql`, après la 0028. Avant elle,
   l'onglet affiche simplement le nom de la migration à appliquer.
2. **Guide** : suis la section 35 de « Ce qui te revient ».

## Décisions que j'ai prises pour toi

1. **Les filtres** reprennent ceux de la page « Étudiants » tels quels (« Tous », « À risque », « Terminés »). Le
   chiffre de l'en-tête dit « Formation terminée ».
2. **Les quatre chiffres** sont de petites cartes compactes, et non les grandes tuiles du tableau de bord. Ces tuiles
   prendraient chacune une ligne entière sur un téléphone.
3. **Le modérateur voit aussi les apprenants**, comme le reste de l'équipe. Il voit déjà les fiches « Utilisateurs ».

## Petits points notés pour plus tard

- Un ancien formateur, dont tu as retiré le rôle, apparaît comme apprenant de sa formation avec l'état « Terminée ».
  C'est aussi le cas du formateur précédent quand la formation change de formateur. Cette règle vient de la page
  « Étudiants », qui fait pareil.
- Après une action faite dans un autre onglet (publier des leçons, par exemple), la liste ne se met à jour qu'au
  rechargement de la page ou au prochain filtre.
- Le refus d'un compte suspendu et le cas du modérateur fonctionnent (vérifiés par le relecteur), mais aucun test ne les
  couvre encore.
- Si le chargement d'une page de la liste échoue, le numéro de page avance quand même. C'est le même défaut que sur la
  page « Étudiants ».

## Et après

La refonte des formations (étapes A, B et C) est terminée. Il reste à appliquer les migrations 0026 (ou la rejouer), 0027 et 0029 si ce n'est pas fait,
et ta réponse sur « une nouvelle leçon naît publiée si la formation n'a jamais été publiée ».
