# Le nouvel Accueil (fil des dernières nouvelles) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** `/accueil` devient la communauté (en-tête « Bonjour, … »), avec les nouvelles formations glissées dans
Actualités et « Formations disponibles » sous le fil ; Communauté quitte le menu ; le tableau de bord disparaît.

**Architecture :** sans migration. Une règle pure (`lib/accueil/fil.ts`) choisit les nouvelles formations du catalogue et
les entrelace avec les publications chargées ; `PageCommunaute` l'applique dans Actualités / « Les plus récentes » et
affiche « Formations disponibles ». La page `/accueil` rend `ContenuCommunaute` ; `/communaute` redirige (next.config).

**Tech Stack :** Next.js 16.4 (cacheComponents), React 19, Vitest + Testing Library.

**Spec :** `docs/superpowers/specs/2026-10-15-accueil-fil-design.md`

## Global Constraints

- Textes en français ; en-tête « Bonjour, {prénom} » (« Bonjour » sans prénom) et « Les dernières nouvelles d’Étudium :
  publications, nouvelles formations et sessions live. ».
- Nouvelles formations : mises en ligne depuis **30 jours** ; Actualités + « Les plus récentes » seulement.
- « Formations disponibles » : les **4** plus récentes ; lien « Voir toutes les formations » → `/formations`.
- Barre latérale : Accueil, Formations, Messages, Événements. Barre du bas : Accueil, Formations, Événements,
  Certificats, Profil.
- `/communaute` → `/accueil` en gardant la requête ; `/communaute/publications/[id]` ne bouge pas.
- Téléphone compact (tailles `max-sm` plus petites) ; aucune donnée personnelle dans les adresses.

## Review Focus

1. Aucune publication mais des nouvelles formations : les formations s'affichent, pas l'état vide.
2. « Voir plus » : une formation n'est ni perdue ni doublée d'une page à l'autre.
3. Une publication que l'on vient de publier (en tête du fil) : les formations restent à leur date.
4. Le catalogue illisible (erreur, avant ses migrations) : l'Accueil affiche quand même le fil, sans formations.
5. `/communaute?espace=<parcours>` arrive sur l'onglet de ce parcours ; une page de publication garde Accueil actif.

---

### Task 1 : la règle du fil et la carte « Nouvelle formation »

**Files :**
- Create : `web/src/lib/accueil/fil.ts`, `web/src/components/accueil/CarteNouvelleFormation.tsx`
- Test : `web/tests/accueil/fil.test.ts`, `web/tests/accueil/carte-nouvelle-formation.test.tsx`

**Interfaces :**
- Produces :
  - `NOUVELLES_JOURS = 30` ; `FORMATIONS_DISPONIBLES = 4`.
  - `nouvellesFormations(cartes: CarteCatalogue[], maintenant: Date): CarteCatalogue[]` — mises en ligne depuis 30 jours
    (et pas dans le futur), de la plus récente à la plus ancienne.
  - `formationsDisponibles(cartes: CarteCatalogue[]): CarteCatalogue[]` — les 4 plus récentes.
  - `type ElementFil = { type: "publication"; publication: Publication } | { type: "formation"; formation: CarteCatalogue }`.
  - `entrelacer(publications: Publication[], formations: CarteCatalogue[], fin: boolean): ElementFil[]` — avant chaque
    publication, les formations strictement plus récentes qu'elle et pas encore placées ; si `fin`, les restantes à la
    suite ; sinon elles attendent.
  - `CarteNouvelleFormation({ formation, maintenant }: { formation: CarteCatalogue; maintenant: Date })`.

- [ ] **Step 1 : tests de la règle** — `fil.test.ts` :
  - « 30 jours, futures écartées, tri décroissant » ;
  - « entrelacer : à sa date, égalité après la publication » ;
  - « une formation plus ancienne que la dernière publication attend ; à la fin, elle vient » ;
  - « aucune publication : fin → les formations ; pas fin → rien » ;
  - « recalculer sur le lot complet après Voir plus : chaque formation une seule fois » ;
  - « formationsDisponibles : 4 plus récentes ».
- [ ] **Step 2 : tests de la carte** — `article` nommé « Nouvelle formation : {titre} » ; étiquette « Nouvelle formation » ;
  moment (« il y a 2 jours » via `moment`) ; titre, résumé, parcours ; lien « Découvrir la formation » →
  `/formations/{slug}` ; pas de bouton J’aime.
- [ ] **Step 3 : lancer** `npx vitest run tests/accueil/fil.test.ts tests/accueil/carte-nouvelle-formation.test.tsx` →
  ÉCHEC (modules absents).
- [ ] **Step 4 : implémenter** `fil.ts` et la carte (style des cartes du fil : `rounded-2xl border bg-panneau`,
  `Couverture` en tête, `Tag tone="nouveau"`).
- [ ] **Step 5 : lancer** les deux fichiers → SUCCÈS ; commit « feat(accueil): règle du fil et carte Nouvelle formation ».

### Task 2 : l'Accueil devient la communauté

**Files :**
- Modify : `web/src/components/communaute/PageCommunaute.tsx` (props `titre`, `intro`, `nouvelles`, `disponibles` ;
  `replaceState` vers `/accueil`), `ContenuCommunaute.tsx` (lit le catalogue, passe l'en-tête et les formations),
  `DetailPublication.tsx` et `PagePublication.tsx` (retour vers l'Accueil), `web/src/app/(app)/(etudiant)/accueil/page.tsx`,
  `web/next.config.ts` (redirection).
- Delete : `web/src/app/(app)/(etudiant)/communaute/page.tsx`, `web/src/components/accueil/{TableauDeBord,CarteReprise,ListeAFaire}.tsx`,
  `web/src/lib/accueil/regles.ts`, `web/tests/accueil/{page.test.tsx,regles.test.ts}`.
- Test : `web/tests/accueil/accueil.test.tsx`, `web/tests/layout/redirection-communaute.test.ts`.

**Interfaces :**
- Consumes : Task 1 (`entrelacer`, `nouvellesFormations`, `formationsDisponibles`, `CarteNouvelleFormation`).
- Produces : `PageCommunaute` props `titre?: string` (défaut « Accueil »), `intro?: string`, `nouvelles?: CarteCatalogue[]`,
  `disponibles?: CarteCatalogue[]`.

- [ ] **Step 1 : tests** — `accueil.test.tsx` (PageCommunaute rendue avec `nouvelles`/`disponibles`) :
  - l'en-tête passé (« Bonjour, Koffi ») ;
  - une carte « Nouvelle formation » entre deux publications à sa date ;
  - aucune publication + une nouvelle formation : la carte, pas « Aucune publication pour l’instant » ;
  - onglet Général, tri « Les plus populaires », onglet « Programmées » : pas de formation ;
  - « Formations disponibles » (titre de section, 4 cartes, lien « Voir toutes les formations » → `/formations`) ; sans
    formations, pas de section ;
  - changer d'onglet écrit `/accueil?espace=general`.
  `redirection-communaute.test.ts` : `nextConfig.redirects()` contient `{ source: "/communaute", destination: "/accueil",
  permanent: false }`.
- [ ] **Step 2 : lancer** → ÉCHEC.
- [ ] **Step 3 : implémenter.** Le fil affiché : `entrelacer(lot.publications, nouvelles, !lot.suite)` si onglet
  Actualités et `ordre === "recentes"`, sinon les publications ; l'état vide teste la liste entrelacée.
  `ContenuCommunaute` lit `listCatalogue()` sans casser la page (erreur → `[]`), passe
  `titre = prénom ? "Bonjour, {prénom}" : "Bonjour"`. La page `/accueil` rend `ContenuCommunaute` (Suspense + `SessionGuard`),
  titre « Accueil · Étudium ». Retirer le tableau de bord et ses tests.
- [ ] **Step 4 : lancer** `npx vitest run tests/accueil tests/communaute tests/layout` → SUCCÈS (adapter les tests qui
  attendaient « Communauté » en titre ou `/communaute` dans l'adresse) ; `npx tsc --noEmit` propre.
- [ ] **Step 5 : commit** « feat(accueil): l'Accueil devient le fil des dernières nouvelles ».

### Task 3 : le menu

**Files :**
- Modify : `web/src/lib/navigation.ts`, `web/src/components/layout/EspacesCommunaute.tsx`, `web/src/components/layout/MenuTiroir.tsx`.
- Test : `web/tests/layout/menus-espaces.test.tsx`, `web/tests/layout/menu-tiroir.test.tsx`, `web/tests/layout/navigation.test.tsx`.

**Interfaces :** Accueil `{ href: "/accueil", aussi: ["/communaute"] }` (une page de publication garde Accueil actif).

- [ ] **Step 1 : tests** — barre latérale étudiante : `["Accueil", "Formations", "Messages", "Événements"]` ; barre du bas :
  `["Accueil", "Formations", "Événements", "Certificats", "Profil"]` ; sur `/communaute/publications/x`, Accueil actif ;
  le tiroir sur `/accueil` liste les espaces avec des liens `/accueil?espace=…`, l'espace courant marqué.
- [ ] **Step 2 : lancer** → ÉCHEC. **Step 3 : implémenter.** **Step 4 : lancer** `npx vitest run tests/layout` → SUCCÈS.
- [ ] **Step 5 : commit** « feat(navigation): Communauté quitte le menu, l'Accueil la remplace ».

### Task 4 : vérification, revue finale, bilan

- [ ] Suite complète, lint, `tsc`, build ; rendu 1440 / 390 / 320 px (page temporaire supprimée ensuite).
- [ ] Guide « Ce qui te revient » : section 32 (valider l'Accueil, sans migration).
- [ ] Revue finale (opus), une passe de corrections, bilan `docs/superpowers/bilans/2026-10-15-…`, mémoire.
