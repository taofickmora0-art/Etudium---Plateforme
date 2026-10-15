# Tâche 1.12 (landing et FAQ) et page Aide — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Termine le lot 1. La racine `/` montre la landing publique NdLanding au visiteur et renvoie un compte connecté vers `/accueil`. La page « Aide » remplace son « Bientôt disponible » par les 7 questions fréquentes.

**Architecture:**
- Textes fixes et règle de choix des formations dans `src/lib/landing/` et `src/lib/site/faq.ts` (purs, testés).
- Sections en composants serveur synchrones dans `src/components/landing/`, qui reçoivent leurs données en propriétés.
- La page `src/app/page.tsx` lit parcours et formations sous `Suspense` (`cacheComponents` actif) dans `CadrePublic`.
- En-tête et pied de page publics complétés, avec un menu repliable au téléphone.

**Tech Stack:** Next.js 16.4 (App Router, `cacheComponents`), React 19, Tailwind v4, Radix (Accordion), Vitest + RTL (jsdom).

**Spec :**
- `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` (§1 Q10, Q11 ; §2 ; §9) ;
- valeurs du design : `docs/superpowers/plans/2026-10-13-tache-1-12-annexe-design.md` (l'« annexe »). Les § cités ci-dessous sont ceux de l'annexe.

## Global Constraints

- Textes du design **tels quels** (annexe §23), avec les apostrophes typographiques `’`. Aucun faux témoignage ni chiffre : Témoignages et Chiffres sont absents (Q11).
- Bouton principal « Créer mon compte gratuit » sur la landing, **y compris dans l'en-tête public** (spec §9, CDC §51).
- Formules sans prix : « Prix annoncés au lancement » dans chaque carte (Q10) ; « Voir le détail » absent (page Tarifs au lot 2).
- « Contact » absent du pied de page tant que l'adresse e-mail n'est pas donnée.
- Illustrations inventées (hero, boîtes de « La solution », publication de la communauté) : `aria-hidden="true"`, sans lien ni élément focalisable.
- Téléphone (mémoire « Téléphone compact ») : tailles `max-sm:` plus compactes. Libellés vérifiés à 360 px avec un texte grossi à 115 %. Aucun défilement horizontal à 320 px.
- Pas de données personnelles dans les adresses ; aucune nouvelle dépendance ; aucune migration.

## Décisions (questions ouvertes de l'annexe §22.6)

- **Q1, « Pour bien commencer » :**
  - jusqu'à 2 formations gratuites, puis les « Populaire », puis les autres, toutes les plus récentes d'abord, 4 au plus ;
  - chaque groupe est trié par ordre du parcours ;
  - aucune formation : la section disparaît.
- **Q2, liens sans page :**
  - « Voir le détail » est masqué ;
  - « Voir la communauté » mène à `/accueil` (l'Accueil est la communauté ; un visiteur passe par la connexion) ;
  - Contact est masqué ;
  - le pied de page pointe vers `/#parcours`, `/#formules`, `/#faq` et `/#communaute`.
- **Q3, parcours :**
  - nom, couleur et description viennent de la base ;
  - les 6 points sont du texte fixe, rangé par slug (un parcours inconnu n'a pas de liste) ;
  - « Trois parcours au lancement » reste fixe, comme les puces du hero.
- **Q4 :** « Prix annoncés au lancement » dans chaque carte, à la place du prix.
- **Q5, téléphone :**
  - sous 640 px, l'en-tête tient sur une ligne : logo, « Se connecter » et un bouton « Menu » qui déplie les liens et « Créer mon compte gratuit » ;
  - l'illustration du hero est masquée sous 640 px ;
  - les personnes inventées de la maquette sont gardées comme illustration.
- **Titre de la page :** « Étudium · Les compétences qui comptent, pendant vos études et après ». Description : la phrase du hero.

## Review Focus

1. **Un compte connecté qui ouvre `/`** doit arriver sur `/accueil`. Un visiteur, ou une session expirée, voit la landing sans redirection en boucle (Task 5).
2. **Moins de 4 formations publiées, ou aucune** (mode démonstration, base vide) : pas de grille cassée ni de titre orphelin (Tasks 1 et 4).
3. **Ancres depuis une autre page** : depuis le catalogue, « Tarifs » et « Questions fréquentes » doivent mener à `/#formules` et `/#faq`, et pas à `#formules` relatif (Task 2).
4. **Menu du téléphone :**
   - il se ferme après un clic sur une ancre de la même page ;
   - il annonce son état (`aria-expanded`) ;
   - il reste invisible au-dessus de 640 px (Task 2).
5. **Lecteurs d'écran :**
   - un seul `h1` ;
   - les h2 de section sont reliés à leur `section` ;
   - aucun texte inventé (« 68 % terminé », « Koffi D. ») n'est lu (Task 3).

---

### Task 1: Textes fixes, FAQ partagée et règle « Pour bien commencer »

**Files:**
- Create: `web/src/lib/site/faq.ts`, `web/src/lib/landing/textes.ts`, `web/src/lib/landing/selection.ts`
- Test: `web/tests/landing/selection.test.ts`, `web/tests/landing/textes.test.ts`

**Interfaces:**
- Produces:
  - `QUESTIONS_FREQUENTES: { question: string; reponse: string }[]` : les 7 de l'annexe §14.3, verbatim.
  - `PROBLEMES`, `ETAPES` : `{ titre: string; texte: string }[]`, 4 chacun (§4, §7).
  - `FORMULES: { nom: string; description: string; points: string[]; recommandee: boolean }[]` (§9).
  - `ATOUTS` : 4 `{ titre: string; texte: string }` (§10).
  - `POINTS_PARCOURS: Record<string, string[]>`, indexé par les slugs `reussite-academique`, `competences-digitales`, `business-revenus-en-ligne` (§6).
  - `formationsPourBienCommencer(cartes: CarteCatalogue[], max = 4): CarteCatalogue[]`.

- [ ] **Step 1: les tests**, dans `selection.test.ts`. Les cartes viennent d'une fabrique locale (`publieeLe` ISO, `parcours` avec `ordre`).
  - `reproduit la maquette` : les données d'exemple du §19 donnent `["zotero", "canva", "methodologie", "freelance"]`. Entrée :
    - gratuites : Zotero (académique, ordre 1), Canva (digitale, ordre 2) ;
    - populaires : Freelance (−15 j, business, ordre 3), Méthodologie (−40 j, ordre 1), Excel (−60 j, ordre 1).
  - `complète avec les plus récentes quand il manque des populaires` : 1 gratuite et 0 populaire parmi 5 cartes donnent 4 cartes, la gratuite en tête.
  - `jamais plus de 2 gratuites` : 5 gratuites et 2 populaires donnent 2 gratuites puis 2 populaires.
  - `liste vide → liste vide`, et `moins de 4 formations → toutes`.
- [ ] **Step 2: les tests** de `textes.test.ts` :
  - 7 questions ; la 1re est « Le compte gratuit est-il vraiment gratuit ? » ;
  - aucune apostrophe droite `'` dans les textes affichés ;
  - 3 formules, seule « Standard » est recommandée ;
  - 6 points pour chacun des 3 slugs.
- [ ] **Step 3:** lancer `npx vitest run tests/landing`. Attendu : ÉCHEC, modules absents.
- [ ] **Step 4:** écrire les trois modules. Textes copiés de l'annexe §4, §7, §9, §10, §6 et §14.3.
- [ ] **Step 5:** relancer `npx vitest run tests/landing`. Attendu : RÉUSSITE.
- [ ] **Step 6:** commit `feat(landing): textes fixes, questions fréquentes et choix des formations « Pour bien commencer »`.

### Task 2: En-tête et pied de page publics

**Files:**
- Modify: `web/src/components/site/EnTetePublic.tsx`, `web/src/components/site/PiedDePagePublic.tsx`
- Test: `web/tests/site/en-tete-public.test.tsx` (nouveau), `web/tests/catalogue/cadre.test.tsx`, `web/tests/certificats/pages.test.tsx` (libellés)

**Interfaces:**
- Produces:
  - `LIENS_PUBLICS`, dans l'ordre : Parcours `/#parcours`, Formations `/formations`, Tarifs `/#formules`, Communauté `/#communaute`, Vérifier un certificat `/verifier`.
  - Le pied de page :
    - Plateforme : Formations, Parcours, Tarifs ;
    - Ressources : Questions fréquentes `/#faq`, Vérifier un certificat, Communauté `/#communaute` ;
    - Légal : Conditions d'utilisation, Confidentialité.

- [ ] **Step 1: les tests** :
  - l'en-tête a les 5 liens, dans l'ordre, avec ces adresses absolues ;
  - « Créer mon compte gratuit » mène à `/inscription` ;
  - au téléphone, le bouton « Menu » porte `aria-expanded="false"`, puis `true` après un clic, et montre les liens ;
  - un clic sur « Tarifs » referme le menu ;
  - le pied de page a les colonnes « Plateforme », « Ressources » et « Légal », sans « Contact ».
- [ ] **Step 2:** lancer `npx vitest run tests/site tests/catalogue/cadre.test.tsx tests/certificats/pages.test.tsx`. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire le code.
  - Barre de bureau (`max-sm:hidden` sur le `nav` et le bouton d'inscription) : valeurs actuelles.
  - Téléphone (`sm:hidden`) :
    - une ligne : logo, « Se connecter » (h 40 px, 15 px) et l'`IconButton` Menu (`Menu01Icon`, ou `Cancel01Icon` quand le menu est ouvert, `aria-controls`) ;
    - le panneau `nav#menu-public` est une carte blanche arrondie, avec des liens de 48 px et le bouton principal sur toute la largeur.
  - Le menu se ferme au clic sur un lien et à la touche Échap.
- [ ] **Step 4:** relancer les mêmes tests. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `feat(site): en-tête et pied de page publics complets, menu du téléphone`.

### Task 3: Sections à texte fixe de la landing

**Files:**
- Create in `web/src/components/landing/` :
  - `BlocsLanding.tsx` (`Pastille`, `EnTeteSection`, `SECTION_BLANCHE`, `SECTION_NUE`) ;
  - `HeroLanding.tsx` ;
  - `SectionsPresentation.tsx` (Problèmes, Solution, Étapes, Accompagnement) ;
  - `SectionFormules.tsx`, `SectionCommunaute.tsx`, `SectionFaq.tsx`.
- Test: `web/tests/landing/sections.test.tsx`

**Interfaces:**
- Consumes: les constantes de la Task 1 ; `Accordion`, `IconTile`, `Avatar`, `AvatarGroup`, `CourseIllustration`, `ProgressBar`, `MetaDot`, `Tag`, `LienContourBlanc`, `MOTIF_BLEU`.
- Produces :
  - `Pastille({ ton: "surBleu" | "bleu" | "blanc", children })` ;
  - `EnTeteSection({ pastille, ton, titre, idTitre, chapeau?, centre?, blanc? })`, qui rend le `h2` avec `id={idTitre}` ;
  - des sections sans propriétés : `HeroLanding`, `SectionProblemes`, `SectionSolution`, `SectionEtapes`, `SectionFormules`, `SectionAccompagnement`, `SectionCommunaute`, `SectionFaq`.

- [ ] **Step 1: les tests** :
  - un seul `h1` (texte du §3.1) ;
  - chaque section porte `aria-labelledby`, qui pointe vers son h2 ;
  - les ids `formules`, `faq` et `communaute` existent ;
  - « Prix annoncés au lancement » apparaît 3 fois, mais ni « Voir le détail » ni « [PRIX] » ;
  - aucun texte « Témoignages » ni « [NOMBRE] » ;
  - FAQ : 7 boutons, seul le 1er est déplié ;
  - « 68 % terminé » et « Koffi D. » sont dans un ancêtre `aria-hidden="true"` ;
  - les boutons du hero mènent à `/inscription` et `/formations` ;
  - les 3 puces du hero mènent à `#parcours` ;
  - « Voir la communauté » mène à `/accueil`.
- [ ] **Step 2:** lancer `npx vitest run tests/landing/sections.test.tsx`. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire les sections avec les valeurs de l'annexe (§3, §4, §5, §7, §9.2, §10, §11, §14) et les jetons de couleur existants. Au téléphone :
  - illustration du hero masquée (`max-sm:hidden`) ;
  - boutons du hero : `min-h-[52px] py-3 leading-tight`, sans `nowrap` ;
  - puces : `min-h-10` ;
  - titres un cran plus petits ;
  - carte certificat de « La solution » : la pile est masquée sous 400 px (`max-[400px]:hidden`).
- [ ] **Step 4:** relancer `npx vitest run tests/landing/sections.test.tsx`. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `feat(landing): sections de présentation, formules, communauté et questions fréquentes`.

### Task 4: Sections avec données (parcours, formations)

**Files:**
- Create: `web/src/components/landing/SectionParcours.tsx`, `web/src/components/landing/SectionFormations.tsx`
- Modify: `web/src/components/ui/grilles.ts` (ajouter `GRILLE_QUATRE_OU_DEUX`)
- Test: `web/tests/landing/sections-donnees.test.tsx`

**Interfaces:**
- Consumes: `ParcoursCatalogue[]`, `CarteCatalogue[]`, `POINTS_PARCOURS`, `formationsPourBienCommencer`, `CarteFormation`.
- Produces:
  - `SectionParcours({ parcours: ParcoursCatalogue[] })`, avec l'id `parcours` (en-tête toujours là, cartes seulement si la liste n'est pas vide) ;
  - `SectionFormations({ cartes: CarteCatalogue[] })`, qui renvoie `null` si la sélection est vide.

- [ ] **Step 1: les tests** :
  - 3 cartes de parcours, avec un h3 = nom de la base et le paragraphe = description de la base ;
  - le lien « Voir les formations du parcours » (nom accessible complété par le nom du parcours) mène à `/formations?parcours=<slug>` ;
  - 6 points sous un slug connu, aucun sous un slug inconnu ;
  - formations : 4 cartes avec des titres `h3`, plus « Voir tout le catalogue » vers `/formations` ;
  - une liste vide ne rend rien (pas de « Pour bien commencer »).
- [ ] **Step 2:** lancer `npx vitest run tests/landing/sections-donnees.test.tsx`. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire le code. Couleurs par `couleur` du parcours :
  - fond : académique `bg-bleu-clair`, digitale `bg-[#F3F0FE]`, business `bg-[#FFF3E6]` ;
  - accent : `text-bleu`, `text-premium-texte`, `text-business-texte`.
  Grille des formations (§8.3, corrigée) :
  `grid-cols-[repeat(auto-fill,minmax(min(100%,max(250px,clamp(calc((100%-60px)/4),calc((1060px-100%)*999),calc((100%-20px)/2)))),1fr))] gap-5`.
- [ ] **Step 4:** relancer le test. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `feat(landing): les trois parcours et « Pour bien commencer » depuis la base`.

### Task 5: Page `/` et routage de la racine

**Files:**
- Modify: `web/src/app/page.tsx`, `web/src/lib/auth/routing.ts`
- Test: `web/tests/auth/session.test.ts` (« la racine oriente »), `web/tests/landing/page.test.tsx` (nouveau)

**Interfaces:**
- Consumes: toutes les sections ; `listParcoursCatalogue`, `listCatalogue` ; `CadrePublic` ; `BandeAppelAction`.

- [ ] **Step 1: les tests** :
  - `routeFor` sur `/` : un visiteur obtient `{}`, une session expirée aussi, un compte connecté `{ redirect: "/accueil" }` ;
  - la page assemblée (données simulées) montre, dans l'ordre, les h2 du §21.1 sans « Ils ont suivi Étudium » ;
  - une erreur de lecture des parcours ou des formations ne casse pas la page : les sections de données disparaissent.
- [ ] **Step 2:** lancer `npx vitest run tests/auth/session.test.ts tests/landing/page.test.tsx`. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire le code.
  - `routeFor` : `pathname === "/"` donne `/accueil` si connecté, sinon `{}`.
  - `page.tsx` :
    - `metadata` (titre absolu, description) ; on retire `instant = false` et la redirection ;
    - `CadrePublic` et les sections dans l'ordre de la spec §9 ;
    - parcours et formations lus dans deux composants asynchrones sous `Suspense`, avec repli `null` en cas d'erreur.
- [ ] **Step 4:** relancer les mêmes tests. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `feat(landing): la racine montre la landing au visiteur, l'accueil au compte connecté`.

### Task 6: Page Aide, guide et vérifications

**Files:**
- Modify: `web/src/app/(app)/(etudiant)/aide/page.tsx`, `web/src/lib/pages-a-venir.ts`, `docs/guides/ce-qui-te-revient.md` (section 40)
- Create: `web/src/components/aide/PageAide.tsx`
- Test: `web/tests/aide/page.test.tsx`

**Interfaces:**
- Consumes: `QUESTIONS_FREQUENTES`, `Accordion`, `Heading`, `Lead`.

- [ ] **Step 1: les tests** :
  - « Aide » en h1 et les 7 questions, la 1re dépliée ;
  - plus de « Bientôt disponible » ;
  - `PAGES_A_VENIR` n'a plus de clé `aide` ;
  - le lien « Vérifier un certificat » mène à `/verifier`.
- [ ] **Step 2:** lancer `npx vitest run tests/aide`. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire la page : titre, chapeau et la boîte FAQ, comme sur la landing. Ajouter une carte « Une autre question ? » qui mène à la communauté (`/accueil`) et à « Vérifier un certificat ». Garder `SessionGuard`, comme les autres pages connectées.
- [ ] **Step 4:** relancer `npx vitest run tests/aide`. Attendu : RÉUSSITE.
- [ ] **Step 5:** guide, section 40 : relire la landing sur ordinateur et sur téléphone, donner l'adresse e-mail de contact, corriger les textes. Puis lancer la suite complète, `npm run lint`, `npx tsc --noEmit` et `npm run build`.
- [ ] **Step 6:** vérifier dans le navigateur, sans compte :
  - `/` à 1440 px et à 375 px ;
  - le menu du téléphone ;
  - pas de défilement horizontal à 320 px.
- [ ] **Step 7:** commit `feat(aide): la page Aide reprend les questions fréquentes` puis `docs(guide): section 40, relire la landing`.
