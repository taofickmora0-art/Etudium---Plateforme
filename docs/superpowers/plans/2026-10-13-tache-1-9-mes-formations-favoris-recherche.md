# Tâche 1.9 — Mes formations, Favoris, Recherche : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** trois pages du menu, aujourd'hui « Bientôt disponible », prennent vie :
- **Mes formations** : les formations commencées, filtrables ;
- **Favoris** : les formations mises de côté avec le cœur de la fiche ;
- **Recherche** : formations, parcours et leçons, sans tenir compte des accents ni des majuscules.

**Architecture :**
- **Base (migration 0009)** :
  - table `favoris` ;
  - une formation **archivée** reste visible (en lecture) pour qui l'a commencée, grâce à la fonction `formation_commencee` (sans récursion des règles d'accès). Ses leçons restent fermées (`acces_lecon` exige `publiee`, R24) ;
  - correction de `ouverte_le` pour les lignes antérieures à la 0008 (relevé de la 1.7).
- **Données** :
  - `listFiches(ids)` : fiches de plusieurs formations, sans filtre de statut (les règles de la base décident) ;
  - lecture des favoris, actions `ajouterFavori` / `retirerFavori` ;
  - `listLeconsPubliees()` pour la recherche.
- **Règles pures** :
  - `src/lib/mes-formations/regles.ts` : état d'une formation suivie, filtres, libellé de temps, cible de la carte ;
  - `src/lib/recherche/regles.ts` : normalisation, correspondances, recommandations.
- **Pages** : `/mes-formations`, `/favoris`, `/recherche` dans `(app)`. Le cœur « Ajouter aux favoris » est sur la fiche connectée.

**Tech Stack :** Next.js 16.4, React 19, Supabase, PGlite, Vitest.

**Spec :** `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` (§2 lignes `/mes-formations`, `/favoris`, `/recherche` ; §3 « formation archivée » ; §8). **Annexe design :** `docs/superpowers/plans/2026-10-13-tache-1-9-annexe-design.md` (questions tranchées ci-dessous).

## Global Constraints

- **Décisions sur les questions ouvertes du design (annexe §12.6)** :
  - **Mes formations** :
    - les formations **commencées** (au moins une leçon ouverte, spec §8), de la plus récemment ouverte à la plus ancienne ;
    - filtres « Toutes » | « En cours » (commencée, non terminée, **0 % compris**) | « Terminées » | « Verrouillées » (archivée, ou leçons devenues fermées) | « Favoris » (favoris parmi les formations suivies).
  - **Carte de formation suivie** (`CourseCard`, titre h2) :
    - **Lien** : vers la leçon où reprendre (1.7) ; sinon la fiche ; pour une formation verrouillée, la carte n'est **pas un lien** (la fiche d'une formation archivée est introuvable).
    - **Badge** « Verrouillée » sur ordinateur comme sur téléphone (cohérence, `CourseCard`).
    - **Temps** : « 2 h restantes » ; « 4 h 10 suivies » une fois terminée ; « Accès fermé » si verrouillée.
  - **Favoris** :
    - toute formation **publiée** peut être mise en favori, depuis la fiche connectée (bouton secondaire pleine largeur « Ajouter aux favoris » / « Dans vos favoris », cœur 18, `aria-pressed`, sous « Continuer » ou « Commencer », annexe 1.3 §6.4) ;
    - page Favoris : formation suivie → `CourseCard`, sinon `CatalogCard` (vers la fiche), dernier ajout en premier ;
    - bouton cœur plein 42 px (contour) en haut à droite de la carte, nommé « Retirer {titre} des favoris » ; le badge de la carte passe sous le cœur (il n'y en a pas d'autre que « Verrouillée ») ;
    - retrait après le dialogue « Retirer des favoris ? » (bouton bleu « Retirer ») ;
    - bandeau d'aide sous la grille : « Ajoutez une formation à vos favoris depuis sa fiche, pour la retrouver ici. » + « Parcourir le catalogue ». Le design dit « Touchez le cœur… », mais le cœur n'est pas sur les cartes du catalogue.
  - **Recherche** :
    - formulaire `GET /recherche?q=` (champ `type="search"` nommé « Rechercher une formation, un parcours ou une leçon », bouton « Rechercher », bouton « Effacer la recherche ») ;
    - **sans accents ni majuscules** (spec), sur les titres et résumés des formations, les noms et descriptions des parcours, et les titres des leçons ;
    - groupes : Formations, Parcours, Leçons (20 au plus, avec « N autres leçons » sinon) ; « Sessions live » au lot 5 ;
    - compteur « 7 résultats pour « excel » » (`aria-live`) ;
    - sans requête : le formulaire, puis « Recommandé pour vous » ; sans résultat : l'état vide encadré, puis « Recommandé pour vous ».
  - **Recommandé pour vous** : 3 formations publiées non commencées, badge « Populaire » puis « Nouveau » d'abord, puis gratuites, puis par ordre du catalogue.
  - **Téléphone** : l'en-tête de la coque reste celui des autres pages (pas de titre de page dans l'en-tête) ; grilles en une colonne ; filtres en rangée défilante (comme le catalogue téléphone).
- **Valeurs du design** : annexe §0.2 (TITRE-PAGE, TRAIT-PAGE, GRILLE-3, CARTE-TUILE, BANDEAU-INFO, état vide sans cadre de Favoris en 72 px), §2–§7.
- **Parcours dans la recherche** (CARTE-TUILE) :
  - tuile 48/14 aux couleurs du parcours, icône `Route01Icon` 22 ;
  - nom (h3) et description, puis la méta « N formations » ;
  - vers `/parcours` ;
  - sans badge « Actif » ni pourcentage, qui viennent avec les abonnements (lot 2).
- **Leçon dans la recherche** (LIGNE-LISTE de l'annexe §6.6) :
  - tuile `PlayCircleIcon`, titre, puis « {formation} · Module {n} : {titre du module} », durée « 06:10 », badge « Terminée » si terminée, chevron ;
  - vers la leçon si elle est ouverte, sinon vers la fiche ;
  - le lien du groupe « Voir le programme » est retiré (plusieurs formations possibles).
- **Textes** : français, vouvoiement, apostrophes typographiques. **Commits** : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Formation archivée commencée** : visible dans Mes formations (verrouillée, progression intacte), jamais au catalogue ni dans la recherche, et ses leçons restent fermées. → Tasks 1, 2.
- **Favori d'une formation archivée ensuite** : il reste dans la base, et la page l'affiche verrouillé si la formation a été commencée, sinon ne l'affiche pas. → Tasks 1, 3.
- **Recherche « zotéro », « EXCEL », « tableaux croises »** : trouvent leurs formations et leçons ; une recherche vide ou faite d'espaces ne cherche rien. → Task 2.
- **Requête très longue ou avec des caractères spéciaux** (`%`, `_`, `<script>`) : sans effet de bord (la recherche se fait en mémoire, l'affichage est échappé par React). → Task 4.
- **Cœur cliqué deux fois vite** sur la fiche : un seul favori (clé primaire, `on conflict do nothing`). → Tasks 1, 3.

---

### Task 1: Base (migration 0009)

**Files :** Create `web/supabase/migrations/0009_favoris.sql` ; Test `web/tests/db/favoris.test.ts`

**Interfaces :**
- Produces :
  - table `public.favoris` (`profil_id` défaut `auth.uid()` → `profils`, cascade ; `formation_id` → `formations`, cascade ; `ajoute_le timestamptz default now()` ; clé `(profil_id, formation_id)`) ;
    - RLS : select, insert et delete des siens ; insert seulement sur une formation publiée ;
    - pas d'update ; anon révoqué ;
  - `public.formation_commencee(p_formation uuid) returns boolean` (security definer, le compte courant) ;
  - politique de lecture des formations : `statut = 'publiee' or équipe or formation_commencee(id)` ;
  - mise à jour : `ouverte_le = least(ouverte_le, vue_le)`.

- [ ] **Step 1 : tests** :
  - **favoris** : ajout, doublon sans erreur (`on conflict do nothing`), lecture, retrait ; un autre compte ne voit rien ; visiteur refusé ; formation brouillon refusée ;
  - **formation commencée puis archivée** : visible par celui qui l'a commencée (formation, modules, leçons), invisible pour un autre étudiant, `acces_lecon` faux ;
  - `ouverte_le` corrigée ;
  - la migration se rejoue.
- [ ] **Step 2 :** → FAIL. **Step 3 :** écrire la 0009. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(favoris): favoris et formations archivées commencées (migration 0009)`

### Task 2: Données et règles

**Files :**
- Modify : `web/src/lib/catalogue/data.ts` (`listFiches`), `web/src/lib/catalogue/filtres.ts` (exporter `sansAccents`)
- Create : `web/src/lib/favoris/data.ts`, `web/src/lib/favoris/actions.ts`, `web/src/lib/mes-formations/regles.ts`, `web/src/lib/recherche/regles.ts`, `web/src/lib/recherche/data.ts`
- Test : `web/tests/mes-formations/regles.test.ts`, `web/tests/recherche/regles.test.ts`, `web/tests/favoris/*.test.ts`, `web/tests/catalogue/data.test.ts`

**Interfaces :**
- Produces :
  - **`listFiches(ids: string[]): Promise<(FicheFormation & { statut: "publiee" | "archivee" | "brouillon" })[]>`** : vide sans requête si `ids` est vide ; même forme que `getFiche`.
  - **Favoris** :
    - `lireFavoris(): Promise<{ formationId: string; ajouteLe: string }[] | null>` (table absente → null) ;
    - `ajouterFavori(formationId)` et `retirerFavori(formationId)`, qui rendent `Promise<{ ok: true } | { ok: false; erreur: string }>` (UUID, compte, `refresh()`).
  - **Mes formations** :
    - `type FormationSuivie = { fiche; etat: "enCours" | "terminee" | "verrouillee"; progression: EtatProgression; favori: boolean; href: string | null; temps: string; derniereVisite: string }` ;
    - `formationsSuivies(fiches, lignes, favoris): FormationSuivie[]` (triées par dernière visite) ;
    - `filtrer(suivies, filtre: "toutes" | "enCours" | "terminees" | "verrouillees" | "favoris")`.
  - **Recherche** :
    - `correspond(texte, requete): boolean` (mots de la requête tous présents, sans accents) ;
    - `rechercher({ cartes, parcours, lecons }, q)` → `{ formations, parcours, lecons, total }` ;
    - `recommandations(cartes, commencees: Set<string>, n = 3)` ;
    - `listLeconsPubliees(): Promise<LeconTrouvable[]>` (`id, titre, dureeSecondes, accessible, formation: { slug, titre }, module: { numero, titre }`).

- [ ] **Step 1 : tests** :
  - **états** :
    - verrouillée si archivée, ou si plus aucune leçon accessible alors qu'elle n'est pas terminée ;
    - temps « suivies » / « restantes » / « Accès fermé » ;
    - `href` vers la leçon où reprendre, `null` si verrouillée ;
    - tri par dernière visite ;
  - **filtres** : 0 % dans « En cours » ; « Favoris » ;
  - **recherche** :
    - « zotéro » trouve Zotero ; « EXCEL » trouve la formation et ses leçons ; « tableaux croises » trouve la leçon ;
    - « » et « &nbsp;&nbsp; » → rien ;
    - un parcours par sa description ;
  - **recommandations** : exclut les commencées ; Populaire / Nouveau d'abord ;
  - **données** : forme de `listFiches` et `listLeconsPubliees` ; actions favoris (refus, `upsert` avec `ignoreDuplicates`, `delete`, `refresh`).
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(mes-formations): données et règles (formations suivies, favoris, recherche)`

### Task 3: Mes formations, Favoris et cœur de la fiche

**Files :**
- Create : `web/src/components/mes-formations/MesFormations.tsx`, `web/src/components/favoris/{PageFavoris,BoutonFavori,CoeurPlein}.tsx`, `web/src/components/mes-formations/CarteSuivie.tsx`
- Modify : `web/src/components/ui/CourseCard.tsx` (`titleAs`, `href` facultatif → carte non cliquable), `web/src/components/ui/EmptyState.tsx` (variante sans cadre), `web/src/components/catalogue/FicheConnectee.tsx` (bouton favori), `web/src/app/(catalogue)/formations/[slug]/page.tsx` (favori de la fiche), les pages `(app)/mes-formations` et `(app)/favoris`, `web/src/lib/pages-a-venir.ts`
- Test : `web/tests/mes-formations/page.test.tsx`, `web/tests/favoris/page.test.tsx`, `web/tests/catalogue/fiche-progression.test.tsx`

- [ ] **Step 1 : tests** :
  - **Mes formations** :
    - en-tête, filtres (`aria-pressed`) ;
    - « En cours » montre la formation à 0 % ;
    - carte verrouillée sans lien, avec badge ;
    - état vide « Aucune formation commencée » avec « Parcourir le catalogue » ;
    - état vide d'un filtre (« Aucune formation terminée pour le moment. ») ;
  - **Favoris** :
    - cartes suivies et non suivies ;
    - le cœur ouvre « Retirer des favoris ? », « Retirer » appelle `retirerFavori(id)` puis la carte disparaît ;
    - bandeau d'aide ;
    - état vide sans cadre ;
  - **fiche** : « Ajouter aux favoris » → `ajouterFavori` → « Dans vos favoris » (`aria-pressed`) ; un clic de plus retire.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(mes-formations): pages Mes formations et Favoris, cœur de la fiche`

### Task 4: Recherche

**Files :**
- Create : `web/src/components/recherche/PageRecherche.tsx`
- Modify : `web/src/app/(app)/recherche/page.tsx`, `web/src/lib/pages-a-venir.ts`
- Test : `web/tests/recherche/page.test.tsx`

- [ ] **Step 1 : tests** :
  - champ nommé, valeur reprise de `q` ;
  - compteur ;
  - groupes Formations / Parcours / Leçons avec leurs badges de nombre ;
  - leçon fermée → lien vers la fiche, ouverte → vers la leçon, « Terminée » ;
  - sans résultat → état vide + « Recommandé pour vous » ;
  - sans requête → pas de compteur, recommandations ;
  - requête `<script>` affichée telle quelle (texte) ;
  - « Effacer la recherche » → `/recherche`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(recherche): page de recherche (formations, parcours, leçons)`

### Task 5: Guide et vérifications

- [ ] Guide, section 13 « Valider Mes formations, Favoris et Recherche (tâche 1.9) » : appliquer la 0009 ; vérifier les filtres, le cœur de la fiche, le retrait d'un favori, et la recherche « zotéro » / « excel ».
- [ ] Suite, `tsc`, `eslint`, `npm run build`, rendu des trois pages (1440, 390, 320).
- [ ] Commit `docs: guide de validation de Mes formations, Favoris et Recherche (tâche 1.9)`
