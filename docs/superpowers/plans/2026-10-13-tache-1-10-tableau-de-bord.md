# Tâche 1.10 — Tableau de bord, version de base : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** l'accueil de l'espace connecté (`/accueil`), aujourd'hui un paravent « arrive bientôt », devient le tableau de bord du lot 1 : en se connectant, l'étudiant reprend sa dernière leçon en un clic.

**Architecture :**
- **Aucune migration** : tout se déduit de la progression (0007, 0008), du catalogue et de `formationsSuivies` (1.9).
- **Règles pures** : `src/lib/accueil/regles.ts`, `tableauDeBord(suivies, cartes)` calcule indicateurs, reprise, « À faire », recommandations et formations gratuites.
- **Composants** : `src/components/accueil/` (corps du tableau de bord, carte de reprise, liste « À faire »). Ils réutilisent `StatCard`, `CourseIllustration`, `Tag`, `ProgressBar`, `ProgressMeta`, `Button`, `EmptyState`, `CarteFormation`.
- **Partagés** : `Groupe` (section titrée de la recherche) et la grille de cartes sortent dans `components/ui` ; `IconTile` gagne un ton bleu ; `CarteFormation` accepte un titre h3.
- **Page** : `(app)/accueil/page.tsx` garde l'en-tête (salutation dans son Suspense) et charge le reste dans un second Suspense.

**Tech Stack :** Next.js 16.4, React 19, Supabase, Vitest, Testing Library.

**Spec :** `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` (§2 ligne `/accueil`, §8 « Tableau de bord, version de base », §12 ligne 1.10). **Annexe design :** `docs/superpowers/plans/2026-10-13-tache-1-10-annexe-design.md` (questions de l'annexe §10 tranchées ci-dessous).

## Global Constraints

- **Blocs du lot 1 (spec §8)** : salutation et « Explorer le catalogue » ; tuiles « Progression globale » et « Formations en cours » ; « Continuer l'apprentissage » ; « À faire » (« Leçon suivante » seulement) ; « Recommandé pour vous ». **Rien** du bandeau d'expiration, des certificats, de la série, de la session live, de l'objectif ni de l'activité récente (lots 2, 3, 5, 6) : pas de place vide réservée.
- **Décisions sur les questions ouvertes (annexe §10.5, §10.6)** :
  - **Q1, mise en page ordinateur** :
    - tuiles sur une grille de **deux colonnes**, `repeat(auto-fill, minmax(min(100%, max(228px, calc((100% - 20px) / 2))), 1fr))`, gap 20 ;
    - « Continuer » à gauche (`flex-[999_1_420px]`) et « À faire » à droite (`flex-[1_1_360px]`), `flex flex-wrap items-start gap-6` ;
    - sans « À faire », « Continuer » prend toute la largeur ;
    - puis « Recommandé pour vous » pleine largeur. Zone : `flex flex-col gap-8`.
  - **Q2, Recommandé pour vous** (3 cartes au plus) :
    - d'abord les formations publiées **non commencées** des parcours des formations commencées : parcours de la plus récemment visitée d'abord, puis ordre de la formation dans le parcours (`position`) ;
    - complétées par `recommandations(cartes, commencees, 3)` (1.9 : Populaire, Nouveau, gratuites), sans doublon ;
    - groupe masqué s'il n'y en a aucune. Pas de phrase d'introduction (elle ne s'écrit que pour un cas précis).
  - **Q3, tuiles** :
    - « Progression globale » = moyenne arrondie des pourcentages de **toutes** les formations commencées (terminées et verrouillées comprises, spec §8). Valeur « 54 % », indice « Moyenne de vos formations commencées » ;
    - « Formations en cours » = formations à l'état `enCours` de `formationsSuivies` (0 % compris, verrouillées exclues). Indice « Sur N formations commencées » (« Sur 1 formation commencée »).
  - **Q4, Continuer et À faire** :
    - **Continuer** = la plus récemment visitée des formations `enCours`, sur sa leçon à reprendre (`aReprendre`, 1.7 : la dernière ouverte si elle n'est pas terminée, sinon la suivante) ;
    - sous-titre « Module {n} · {titre de la leçon} · {dureeLisible(durée)} », la durée étant omise si elle est nulle ;
    - étiquette du parcours principal (`nomCourt`, ton du parcours), absente sans parcours ;
    - boutons « Reprendre la leçon » (principal md, vers la leçon) et « Voir le parcours » (gris md, vers `/parcours`, absent sans parcours). Les deux liens ont le titre de la formation pour description (`aria-describedby` vers le h3) ;
    - **À faire** = les **autres** formations `enCours`, par dernière visite, **5 au plus**. Chaque ligne : « Leçon suivante », puis « {titre de la formation} · {titre de la leçon} » (pas de nom court : le champ n'existe pas), vers la leçon. Le groupe porte « 1 élément » / « N éléments » et disparaît s'il est vide.
  - **Q5, états non maquettés** :
    - **rien commencé** (ou progression absente) : pas de tuiles, pas de Continuer ni de À faire. À la place, `EmptyState` encadré (icône `GiftIcon`) :
      - titre « Commencez votre première formation » ;
      - texte « Les formations gratuites sont ouvertes à tous : choisissez-en une et suivez la première leçon. » ;
      - bouton principal « Voir les formations gratuites » vers `/formations-gratuites` ;
      - puis le groupe « Formations gratuites » (« Tout voir » vers `/formations-gratuites`) : 3 formations gratuites au plus, choisies par `recommandations` ; masqué sans formation gratuite ;
    - **plus rien en cours** (tout terminé ou verrouillé) : tuiles et Recommandé seulement.
  - **Téléphone** (sous `sm`, d'après NdMobAccueil, annexe §4) :
    - masqués : sous-titre, « Explorer le catalogue », trait et tuiles. h1 en 28/36 ;
    - carte Continuer : padding 18/16/16, sans étiquette ni « Voir le parcours », bouton « Reprendre la leçon » lg pleine largeur ;
    - « À faire » sans boîte (lignes séparées par un filet) ;
    - « Recommandé pour vous » gardé en fin de page (spec §8).
  - **Q7** : « Explorer le catalogue » passe en `variant="contour"` (maquette). **Q9** : titres h3 pour les cartes recommandées et gratuites (`CarteFormation titleAs`), la recherche reste en h2. **Q10** : « À faire » suit `LigneLecon` de la recherche (min-h 48, sans troncature) ; `ListRow` ne change pas. **Q12** : la loupe de l'en-tête téléphone reste.
- **Valeurs du design** : annexe §0.2 (TUILE-STAT, CARTE-BLOC, BOÎTE-LISTE, LIGNE-ACTION), §3.1, §3.3–3.5, §3.9, §4.3, §4.5, §8.1. Sections reliées à leur h2 (`aria-labelledby`, annexe §9.2).
- **Textes** : français, vouvoiement, apostrophes typographiques (`l’apprentissage`). **Commits** : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Compte sans progression lisible** (migrations 0007-0008 absentes, mode démonstration, compte neuf) : état vide et formations gratuites, jamais d'erreur. → Task 1 (`tableauDeBord([], cartes)`), Task 3.
- **Formation verrouillée** (archivée, ou aperçus vus d'une formation payante) : comptée dans la moyenne, jamais proposée dans Continuer ni dans À faire. → Task 1.
- **Huit formations en cours** : Continuer = la plus récente, À faire = les 5 suivantes par dernière visite. → Task 1.
- **Formation commencée à 0 %** : jamais recommandée ; une formation recommandée n'apparaît qu'une fois, même si elle est à la fois du même parcours et « Populaire ». → Task 1.
- **Titres très longs** (formation de 100 caractères, leçon de 120) à 320 px : retour à la ligne, aucun débordement. → Task 4 (rendu).

---

### Task 1: Règles du tableau de bord

**Files :** Create `web/src/lib/accueil/regles.ts` ; Test `web/tests/accueil/regles.test.ts`

**Interfaces :**
- Consumes : `FormationSuivie` et `formationsSuivies` (`@/lib/mes-formations/regles`, triées par dernière visite, `href` non nul pour `enCours`) ; `recommandations(cartes, commencees, n)` (`@/lib/recherche/regles`) ; `dureeLisible` et `parcoursPrincipal` (`@/lib/catalogue/regles`) ; `CarteCatalogue` (`parcours: (ParcoursCatalogue & { position })[]`).
- Produces :
  - `type Reprise = { formationId: string; titre: string; parcours: CouleurParcours; etiquette: { tone: CouleurParcours; libelle: string } | null; sousTitre: string; pourcentage: number; temps: string; href: string }`
  - `type ElementAFaire = { id: string; titre: string; sousTitre: string; href: string }` (`id` = id de la formation, `titre` = « Leçon suivante »)
  - `type TableauDeBord = { commencees: number; enCours: number; progressionGlobale: number; reprise: Reprise | null; aFaire: ElementAFaire[]; recommandees: CarteCatalogue[]; gratuites: CarteCatalogue[] }`
  - `tableauDeBord(suivies: FormationSuivie[], cartes: CarteCatalogue[]): TableauDeBord`

- [ ] **Step 1 : tests** (fixtures : `EXCEL_OUVERTE`, `EXCEL`, `ZOTERO`, `id` de `tests/lecon/donnees.ts`, avec Zotero aux leçons ouvertes comme `ZOTERO_OUVERTE` de `tests/mes-formations/regles.test.ts` ; `CARTES_DESIGN` de `tests/catalogue/cartes-design.ts` ; `formationsSuivies` pour fabriquer les suivies) :
  - **rien commencé** : `tableauDeBord([], CARTES_DESIGN)` → `commencees: 0`, `reprise: null`, `aFaire: []`, `recommandees: []`, `gratuites` = 3 gratuites au plus, toutes `gratuite: true` ;
  - **reprise** : Excel (leçons 1 terminée, 2 ouverte) visitée après Zotero → `reprise` Excel, `href` vers la leçon 2, `sousTitre` « Module 1 · {titre de la leçon 2} · {dureeLisible} », `etiquette` `{ tone: "academique", libelle: "Académique" }`, `temps` = celui de la suivie ; Zotero dans `aFaire` (« Leçon suivante », « Zotero : gérer ses références · Installer Zotero ») ;
  - **leçon sans durée** : sous-titre sans « · » final ;
  - **indicateurs** : `progressionGlobale` = moyenne arrondie (une terminée à 100 % et une à 8 % → 54), `enCours` sans les verrouillées ni les terminées, `commencees` = toutes ;
  - **verrouillée** (archivée, et aperçus vus) : jamais dans `reprise` ni `aFaire` ; comptée dans la moyenne ;
  - **huit en cours** (copies d'Excel avec des ids distincts, visites décalées) : `reprise` = la plus récente, `aFaire` = les 5 suivantes dans l'ordre ;
  - **recommandées** : même parcours d'abord (une Académique non commencée avant une Populaire d'un autre parcours), complétées jusqu'à 3, aucune formation commencée (même à 0 %), aucun doublon ; `gratuites: []` dès qu'une formation est commencée.
- [ ] **Step 2 :** `npx vitest run tests/accueil/regles.test.ts` → FAIL (module absent).
- [ ] **Step 3 :** implémenter `tableauDeBord`.
- [ ] **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(accueil): règles du tableau de bord (indicateurs, reprise, à faire, recommandations)`

### Task 2: Éléments partagés

**Files :**
- Create : `web/src/components/ui/Groupe.tsx`, `web/src/components/ui/grilles.ts`
- Modify : `web/src/components/recherche/PageRecherche.tsx`, `web/src/components/favoris/PageFavoris.tsx`, `web/src/components/mes-formations/MesFormations.tsx` (importent `Groupe` et la grille), `web/src/components/ui/IconTile.tsx` (ton `information` = `bg-bleu-pale text-bleu`), `web/src/components/catalogue/CarteFormation.tsx` (`titleAs`)
- Test : `web/tests/ui/groupe.test.tsx`, `web/tests/catalogue/carte-formation.test.tsx` (créer s'il n'existe pas)

**Interfaces :**
- Produces :
  - `Groupe({ titre: string; etiquette?: string; lien?: { href: string; libelle: string }; children })` : `section` reliée à son h2 (`aria-labelledby`, `useId`), étiquette = `Tag tone="enAttente"`, lien avec `focus-etudium` ;
  - `GRILLE_CARTES` (la grille 3 → 2 → 1 de l'annexe 1.9 §0.2) et `GRILLE_DEUX` (Q1 ci-dessus), dans `grilles.ts` ;
  - `IconTileTone` gagne `"information"` (`StatCard` l'accepte par son type) ;
  - `CarteFormation({ carte, variante, sansEtiquette?, titleAs?: "h2" | "h3" })`, défaut `"h2"`.
- [ ] **Step 1 : tests** :
  - `Groupe` : `getByRole("region", { name: "Continuer l’apprentissage" })`, étiquette « 2 éléments », lien ;
  - `CarteFormation titleAs="h3"` → `getByRole("heading", { level: 3 })` ;
  - `IconTile tone="information"` → classes `bg-bleu-pale` et `text-bleu`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter ; la recherche passe `etiquette={String(n)}`, et les compteurs de groupe restent identiques. **Step 4 :** → PASS, puis `tests/recherche tests/favoris tests/mes-formations` toujours verts.
- [ ] **Step 5 : commit** `refactor(ui): Groupe et grilles partagés, ton bleu des pastilles, titre h3 des cartes`

### Task 3: Tableau de bord

**Files :**
- Create : `web/src/components/accueil/TableauDeBord.tsx` (zone sous le trait), `web/src/components/accueil/CarteReprise.tsx`, `web/src/components/accueil/ListeAFaire.tsx`
- Modify : `web/src/app/(app)/accueil/page.tsx`
- Test : `web/tests/accueil/page.test.tsx`

**Interfaces :**
- Consumes : `TableauDeBord`, `tableauDeBord` (Task 1) ; `Groupe`, `GRILLE_CARTES`, `GRILLE_DEUX`, `IconTile` `information`, `CarteFormation titleAs` (Task 2) ; `lireProgression`, `listFiches`, `listCatalogue`, `formationsSuivies`, `siTablesAbsentes`.
- Produces : `TableauDeBord({ donnees }: { donnees: TableauDeBord })` (composant serveur, sans état).

- [ ] **Step 1 : tests** (composant monté avec des données fabriquées par `tableauDeBord` ; fixture : Excel, leçon 1 terminée et leçon 2 ouverte (8 %), visitée après Zotero, dont la leçon 21 est ouverte (0 %)) :
  - **tuiles** :
    - « Progression globale », « 4 % », « Moyenne de vos formations commencées » ;
    - « Formations en cours », « 2 », « Sur 2 formations commencées » ;
  - **Continuer** :
    - région « Continuer l’apprentissage » ; lien « Mes formations » → `/mes-formations` ;
    - h3 du titre ; sous-titre ; étiquette « Académique » ;
    - barre « Progression de Maîtriser Microsoft Excel » ; « N % terminé » et le temps ;
    - « Reprendre la leçon » → la leçon, avec `toHaveAccessibleDescription("Maîtriser Microsoft Excel")` ;
    - « Voir le parcours » → `/parcours` ;
  - **À faire** : région, « 1 élément », lien dont le nom contient « Leçon suivante » et le sous-titre, vers la leçon ;
  - **Recommandé** : région, « Tout voir » → `/formations`, titres h3 ;
  - **rien commencé** :
    - « Commencez votre première formation » et « Voir les formations gratuites » → `/formations-gratuites` ;
    - région « Formations gratuites » ;
    - ni tuiles ni « Continuer l’apprentissage » ;
  - **plus rien en cours** : tuiles et Recommandé, ni Continuer ni À faire ;
  - **sans parcours** : ni étiquette ni « Voir le parcours ».
- [ ] **Step 2 :** → FAIL.
- [ ] **Step 3 :** implémenter les composants. Page :
  - en-tête : h1 et sous-titre ; « Explorer le catalogue » en contour (masqués sous `sm`, sauf le h1) ; trait `mt-5 h-px bg-separateur max-sm:hidden` ;
  - puis `Suspense` (squelette) → `Contenu` :
    - lire `lireProgression()` et `listCatalogue()` en parallèle, puis `listFiches` des formations des lignes ;
    - `tableauDeBord(formationsSuivies(fiches, lignes ?? [], new Set()), cartes)` ;
    - erreurs via `siTablesAbsentes` ;
  - retirer le paravent « Votre tableau de bord arrive bientôt ».
- [ ] **Step 4 :** → PASS ; suite complète, `tsc`, `eslint`.
- [ ] **Step 5 : commit** `feat(accueil): tableau de bord (indicateurs, reprise, à faire, recommandations)`

### Task 4: Guide et vérifications

- [ ] Guide, section 14 « Valider le tableau de bord (tâche 1.10) », sans migration :
  - compte neuf → état vide → « Voir les formations gratuites » ;
  - première leçon de Zotero puis retour à l'Accueil → tuiles, carte Continuer ; « Reprendre la leçon » ouvre la bonne leçon ;
  - une leçon d'une deuxième formation → elle passe dans Continuer, Zotero dans À faire ;
  - se déconnecter puis se reconnecter → reprise en un clic (critère de la spec) ;
  - sur téléphone : pas de tuiles, bouton pleine largeur.
- [ ] Suite, `tsc`, `eslint`, `npm run build`.
- [ ] Rendu de l'accueil (rempli, rien commencé, titres très longs) à 1440, 390 et 320, mesuré avec la feuille de styles du build : aucun débordement.
- [ ] Commit `docs: guide de validation du tableau de bord (tâche 1.10)`
