# Bilan : la landing, la FAQ et la page Aide (fin du lot 1, 15 octobre 2026)

Tu as dit « Ok terminons le lot 1 », puis « Fini et je corrige avec toi après » : c'est fait en une traite, avec mes
recommandations aux questions ouvertes.
- La spec : `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md`, §9.
- Les valeurs du design : `docs/superpowers/plans/2026-10-13-tache-1-12-annexe-design.md`.
- Le plan : `docs/superpowers/plans/2026-10-15-tache-1-12-landing-aide.md`.

Une relecture indépendante a eu lieu à la fin.

## En bref

- **La racine `/`** montre la landing à un visiteur ; un compte connecté y est envoyé sur l'Accueil.
- **La landing**, dans l'ordre du design :
  - hero, « Vous vous reconnaissez ? », « La solution », les trois parcours, « Comment ça marche » ;
  - « Pour bien commencer », Formules, Accompagnement, Communauté, questions fréquentes, appel final.
  - Les textes sont ceux du design, tels quels.
- **Ce qui manque exprès :**
  - les prix : « Prix annoncés au lancement » (lot 2) ;
  - « Voir le détail » des formules (page Tarifs, lot 2) ;
  - les témoignages et les chiffres (pas de faux) ;
  - « Contact » (il faut ton adresse e-mail).
- **L'en-tête public** (landing, catalogue, fiches, vérification) a maintenant Parcours, Formations, Tarifs, Communauté et Vérifier un certificat.
  - Il dit « Créer mon compte gratuit ».
  - **Au téléphone**, il tient sur une ligne : logo, « Se connecter » et un bouton « Menu ».
- **Le pied de page** a trois colonnes : Plateforme, Ressources et Légal.
- **La page Aide** (espace connecté) reprend les 7 questions fréquentes, puis « Une autre question ? » vers la communauté.
  - Elle n'est plus « Bientôt disponible ».
- **Vérifications :**
  - 1 809 tests ;
  - types, lint et compilation de production ;
  - la page servie relue (sections dans l'ordre, chacune reliée à son titre) ;
  - aucun débordement à 320 px, à 360 px avec un texte grossi de 115 %, ni à 375 px ;
  - l'en-tête et le menu vus au téléphone.

## Corrigé après la relecture

- **Le menu du téléphone restait ouvert** quand on passait d'une page du catalogue à une autre. Il se referme maintenant à chaque changement de page.
- **« Tarifs » ou « Questions fréquentes » depuis une autre page** risquaient d'arriver au mauvais endroit sur iPhone : des contenus chargés après coup s'inséraient au-dessus.
  - Les trois parcours sont maintenant du texte fixe.
  - La place des 4 formations est réservée pendant leur chargement.
- **Pendant la compilation**, une erreur était journalisée (lecture interrompue du pré-rendu, prise pour un échec). C'est corrigé.

## Ce qui te revient

1. **Relis la landing** sur ordinateur et sur ton téléphone, sans être connecté. Le guide « Ce qui te revient », section 40, te guide. Je n'ai pu voir le rendu à 1440 px qu'en partie.
2. **Donne-moi l'adresse e-mail de contact** : j'ajouterai « Contact » au pied de page.
3. **Dis-moi** si tu gardes les personnes inventées des illustrations : « Koffi D. », « Dr Mireille Adjovi ».
4. Toujours en attente : les migrations **0031, 0032 et 0033** du lot 3, et 0029, 0030 si ce n'est pas fait (sections 37 à 39 du guide).

## Décisions que j'ai prises pour toi

- **« Pour bien commencer » :**
  - jusqu'à 2 formations gratuites, puis les « Populaire », puis les autres ; à chaque fois les plus récentes d'abord, 4 au plus ;
  - avec les données d'exemple, ce sont exactement les 4 cartes du design ;
  - sans formation publiée, la section disparaît.
- **Les trois parcours** sont les textes du design (nom, description, 6 points), fixes comme « Trois parcours au lancement ».
  - Une description modifiée au back-office ne change pas la landing.
  - Un 4e parcours demandera de me le dire.
- **Les liens sans page** sont masqués : « Voir le détail » et « Contact ».
- **« Voir la communauté »** mène à l'Accueil (qui est la communauté). Un visiteur passe d'abord par la connexion.
- **Le pied de page et l'en-tête** mènent aux sections de la landing (`/#parcours`, `/#formules`, `/#faq`, `/#communaute`).
- **« Prix annoncés au lancement »** apparaît dans chaque carte, à la place du prix.
- **Au téléphone :**
  - l'en-tête se replie dans un menu ;
  - l'illustration du hero est masquée ;
  - les tailles sont un cran plus petites.
- **Les illustrations** (formation à 68 %, Koffi D., Dr Mireille Adjovi) restent comme dans le design, mais elles ne sont pas lues par les lecteurs d'écran.
- **Le titre de l'onglet** est « Étudium · Les compétences qui comptent, pendant vos études et après ».
- **La page Aide** n'a pas de maquette. Elle a un titre, les 7 questions dans la même boîte que la landing, puis « Une autre question ? » avec « Aller à la communauté » et « Vérifier un certificat ».

## Petits défauts laissés pour plus tard

- La bande « Commencez gratuitement dès aujourd'hui » n'est pas annoncée comme une région par les lecteurs d'écran.
- Les listes à coches (parcours, formules, fiches) ont un interligne de 20 px au lieu de 22 px. Le défaut existait déjà.
- Le menu du téléphone :
  - après un lien vers une section de la même page, la touche Tab repart du haut de la page ;
  - Échap dans un autre champ referme le menu.
- Les pages leçon d'un visiteur disent encore « Créer un compte gratuit », alors que l'en-tête dit « Créer mon compte gratuit ».
- Le cadre public n'a pas de lien « Aller au contenu ».
- Entre 640 et 1 200 px, l'en-tête passe sur 2 ou 3 lignes. C'est le comportement du design, qui n'a pas de maquette tablette.
- Un test du lecteur vidéo Tella échoue parfois quand la machine est chargée (16,251 au lieu de 16,25). Il existait avant, et il passe seul.

## Le lot 1 est terminé

Catalogue, fiches, leçons, progression, back-office, landing, FAQ et page Aide. Les lots 1 et 3 sont faits, le lot 5 l'est en
grande partie. Restent le lot 2 (abonnements et paiement), les Messages (lot 5) et la suite de la feuille de route.
