# Tâche 1.7 — Progression : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** après quelques leçons, le pourcentage affiché est juste partout :
- page leçon : programme, barre et temps restant ;
- fiche formation (« Votre progression », « Prochaine leçon », « Continuer ») ;
- Mes parcours.

Une leçon sans vidéo se termine avec « Marquer comme terminée » ; une leçon vidéo, en la regardant (1.6). La vidéo reprend là où on l'avait laissée.

**Architecture :**
- **Base (migration 0008)** :
  - `progression_lecons` gagne `ouverte_le` (première ouverture) ;
  - `ouvrir_lecon(p_lecon)` note une visite (dernière leçon ouverte) ;
  - `terminer_lecon(p_lecon)` termine une leçon **sans vidéo** ; une leçon vidéo se valide par le temps regardé.
  - Le « suivi des formations » de la spec (§4 : commencée le, dernière leçon ouverte, terminée le) se **déduit** de `progression_lecons` : pas de table en double.
- **Règles pures (`src/lib/progression/regles.ts`)** :
  - pourcentage = leçons terminées ÷ leçons de la formation (Q2) ;
  - temps restant = durées des leçons non terminées ;
  - leçon où reprendre ;
  - état d'un module.
- **Lecture (`src/lib/progression/data.ts`)** : les lignes de progression du compte, avec la formation de chaque leçon.
- **Page leçon** :
  - état « terminée » partagé entre le lecteur et le bouton (contexte client), parce que la barre du téléphone est dans le cadre, hors du contenu ;
  - visite notée au chargement (action serveur, côté navigateur, jamais pendant un préchargement) ;
  - reprise de la vidéo à `position_secondes`.

**Tech Stack :** Next.js 16.4, React 19, Supabase (RPC), PGlite, Vitest.

**Spec :** `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` (Q2, Q3 ; §4 `progression_lecons`, `suivi_formations` ; §5 Reprise ; §2 `/parcours`). **Design :**
- `docs/superpowers/plans/2026-10-12-tache-1-5-annexe-design.md` §2.6, §3.8 (bouton de fin) ;
- `docs/superpowers/plans/2026-10-12-tache-1-3-annexe-design.md` §6.3 b et §6.4 (fiche connectée : programme et carte de progression).

## Global Constraints

- **Pourcentage d'une formation** : `Math.round(100 × terminées ÷ leçons)` ; 0 sans leçon. **Temps restant** : `dureeLisible(Σ durées non terminées) + " restantes"`, masqué à 0.
- **Leçon où reprendre** (« Prochaine leçon », « Continuer », « Vous êtes ici ») :
  - la dernière leçon ouverte (`vue_le` le plus récent), si elle n'est pas terminée ;
  - sinon, la première leçon ouverte non terminée qui la suit dans le programme ;
  - sinon, la première leçon ouverte non terminée ;
  - sinon `null` (tout est fini, ou rien n'est ouvert).
- **Bouton de fin (page leçon, compte connecté)** :
  - **leçon sans vidéo** : bouton principal « Marquer comme terminée » (`Tick02Icon` 18) → action `terminerLecon` → état « Leçon terminée » (tonal `bg-coque`, `CheckmarkCircle02Icon` 18, non cliquable, `aria-disabled`) ; une erreur est annoncée par un toast « La leçon n’a pas pu être marquée comme terminée. Réessayez. » ;
  - **leçon vidéo non validée** : bouton grisé (`disabled`) « Marquer comme terminée », avec le texte « Regardez au moins 90 % de la vidéo » (le seuil de la formation) ; il passe à « Leçon terminée » dès que le lecteur annonce la validation ;
  - **visiteur** : pas de bouton.
  - **Ordinateur** : dans le groupe de droite de la ligne de navigation, avant « Leçon suivante » ; le texte d'aide est en 12/18 `#667085`, sous la ligne.
  - **Téléphone (barre basse)** : « Leçon précédente » + le bouton de fin (flex 1).
    - Une fois la leçon terminée, ce bouton devient « Leçon suivante », s'il y en a une.
    - Le texte d'aide se place au-dessus des boutons.
- **Reprise** : si la position enregistrée est entre 5 s et `durée − 10 s`, la vidéo s'y place dès que le lecteur est prêt ; l'affichage « 04:12 / 12:40 » la montre avant la lecture.
- **Programme de la page leçon** : leçons terminées en vert (déjà prévu en 1.5), pourcentage et temps restant réels.
- **Fiche connectée (annexe 1.3 §6.4)**, formation commencée (au moins une leçon ouverte), dans la carte de droite :
  - « Votre progression » (14/22 500 `#667085`) et « 68 % » (28/32 500 `#262628`) ;
  - barre de 8 px « Progression de la formation » ; horloge et « 2 h restantes » ;
  - séparateur, puis « Prochaine leçon » (12/18), le titre (15/22 500) et « Module 3 · 12:40 » (13/20) ;
  - bouton principal pleine largeur « Continuer » (`ArrowRight02Icon` 20) vers la leçon où reprendre ;
  - tout terminé : « Formation terminée » à la place de la prochaine leçon, et « Revoir la formation » vers la première leçon.
  - Non commencée : la carte de la 1.3 (« Commencer » / « Voir l’aperçu gratuit »).
- **Programme de la fiche connectée (annexe 1.3 §6.3 b)** :
  - leçon terminée : `CheckmarkCircle02Icon` 20 `#17663A` ;
  - leçon où reprendre : titre en 600 et badge « Vous êtes ici » (`Tag` bleu) avant la durée ;
  - badge de module : « Terminé » (vert, toutes ses leçons terminées) ou « En cours » (bleu, au moins une terminée ou la leçon où reprendre).
- **Mes parcours** : la table des progressions (vide depuis la 1.4) vient de la base.
- **Tables absentes** (0007/0008 non appliquées) : pas de progression, rien ne casse ; le bouton de fin est masqué.
- **Textes** : français, vouvoiement, apostrophes typographiques. **Commits** : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Une leçon vidéo ne se termine jamais par le bouton**, même par un appel direct à `terminer_lecon`. → Task 1.
- **Préchargement d'un lien** : il ne note aucune visite (la visite est notée par le navigateur une fois la page affichée). → Task 3.
- **Pourcentage juste** : 3 leçons terminées sur 12 → 25 %, sur la page leçon, la fiche et Mes parcours. → Tasks 2, 4, 5.
- **Formation archivée** : la progression reste en base. La fiche est introuvable, donc la question ne se pose pas avant « Mes formations » (1.9). → noté.
- **Leçon où reprendre fermée** (aperçu d'une formation payante) : on ne la propose pas. → Task 2.

---

### Task 1: Visite et fin d'une leçon (migration 0008)

**Files :** Create `web/supabase/migrations/0008_progression.sql` ; Test `web/tests/db/progression.test.ts`

**Interfaces :**
- Produces :
  - colonne `progression_lecons.ouverte_le timestamptz not null default now()` ;
  - `public.ouvrir_lecon(p_lecon uuid) returns void` : crée la ligne, sinon met `vue_le = now()` ; exige l'accès ;
  - `public.terminer_lecon(p_lecon uuid) returns void` : exige l'accès, et une leçon **sans** vidéo (sinon `22023`) ; pose `terminee_le` s'il est nul. `execute` pour `authenticated` seulement.

- [ ] **Step 1 : tests** (banc 0001–0008 + exemples) :
  - ouvrir crée la ligne puis met `vue_le` à jour, sans toucher `ouverte_le` ;
  - terminer une leçon sans vidéo pose `terminee_le`, et le garde au second appel ;
  - terminer une leçon vidéo est refusé ;
  - leçon fermée ou visiteur → refusé ;
  - un autre compte ne voit rien ;
  - la migration se rejoue.
- [ ] **Step 2 :** → FAIL. **Step 3 :** écrire la 0008. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(progression): visite et fin d'une leçon (migration 0008)`

### Task 2: Règles et lecture de la progression

**Files :** Create `web/src/lib/progression/types.ts`, `regles.ts`, `data.ts` ; Test `web/tests/progression/regles.test.ts`, `web/tests/progression/data.test.ts`

**Interfaces :**
- Produces :
  - `LigneProgression { leconId: string; formationId: string; termineeLe: string | null; vueLe: string; positionSecondes: number }` ;
  - `lireProgression(): Promise<LigneProgression[] | null>` : `progression_lecons` du compte (règles de la base), avec `lecons!inner(modules!inner(formation_id))` ; tables absentes → null ;
  - `etatFormation(fiche, lignes): { pourcentage; terminees: Set<string>; total; restantSecondes; aReprendre: LeconFiche | null; commencee: boolean; terminee: boolean }` ;
  - `progressionsParFormation(cartes: CarteCatalogue[], lignes): Map<string /* slug */, { pourcentage: number; terminee: boolean }>` (formations commencées seulement) ;
  - `etatModule(module, terminees, aReprendre): "termine" | "en-cours" | null`.

- [ ] **Step 1 : tests** :
  - 3 leçons terminées sur 12 → 25 %, temps restant juste ;
  - **leçon où reprendre** :
    - dernière ouverte non terminée ;
    - si elle est terminée, la suivante ;
    - une leçon fermée est sautée ;
    - tout fini → null ;
  - `commencee` et `terminee` ;
  - `etatModule` : terminé, en cours, rien ;
  - `progressionsParFormation` compte par formation (Excel 3/12 → 25) ;
  - **lecture** : forme des lignes ; une table absente donne null.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(progression): règles et lecture de la progression`

### Task 3: Page leçon : bouton de fin, visite et reprise

**Files :**
- Create : `web/src/components/lecon/EtatLecon.tsx` (contexte client `EtatLeconProvider`, `useEtatLecon`), `web/src/components/lecon/BoutonFin.tsx`, `web/src/components/lecon/VisiteLecon.tsx`
- Modify : `web/src/lib/lecon/actions.ts` (`terminerLecon`, `ouvrirLecon`), `web/src/components/lecon/NavigationLecon.tsx`, `ContenuLecon.tsx`, `LecteurEtudium.tsx` (`positionInitiale`, annonce la validation au contexte), `web/src/app/(lecon)/formations/[slug]/lecons/[leconId]/page.tsx` (lit la progression, fournit le contexte, `terminees`)
- Test : `web/tests/lecon/fin.test.tsx`, `web/tests/lecon/actions.test.ts`, `web/tests/video/lecteur.test.tsx`

**Interfaces :**
- Produces :
  - `terminerLecon(leconId): Promise<{ ok: true } | { ok: false; erreur: string }>` (RPC, puis `refresh()`) ;
  - `ouvrirLecon(leconId): Promise<void>` (RPC ; les erreurs sont ignorées) ;
  - `EtatLeconProvider({ termineeInitiale, avecVideo, seuil, connecte, children })` ;
  - `BoutonFin({ leconId, variante: "ordinateur" | "telephone", suivante?: string })`.

- [ ] **Step 1 : tests** :
  - **leçon sans vidéo** : « Marquer comme terminée » → `terminerLecon(id)` → « Leçon terminée » ; une erreur donne un toast ;
  - **leçon vidéo non validée** : bouton désactivé et « Regardez au moins 90 % de la vidéo » ; quand le contexte passe à terminé (validation du lecteur) → « Leçon terminée » ;
  - **téléphone** : une fois terminée → « Leçon suivante » vers la suivante ;
  - **visiteur** : pas de bouton ;
  - **actions** : RPC `terminer_lecon` et `ouvrir_lecon`, `refresh` après la fin, erreurs ;
  - **visite** : `ouvrirLecon` appelé une fois au montage (compte connecté), jamais pour un visiteur ;
  - **lecteur** :
    - `positionInitiale` 250 → `aller(250)` dès qu'il est prêt, « 04:10 / … » ;
    - 3 → pas de saut ;
    - à la validation, le contexte passe à terminé.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(progression): fin d'une leçon, visite et reprise de la vidéo`

### Task 4: Fiche connectée : progression, « Continuer » et programme

**Files :**
- Modify : `web/src/components/catalogue/FicheConnectee.tsx` (prop `progression?: EtatFormationProgression | null`), `web/src/components/catalogue/ProgrammeFiche.tsx` (états), `web/src/app/(catalogue)/formations/[slug]/page.tsx` (lit la progression pour un compte connecté)
- Test : `web/tests/catalogue/fiche.test.tsx`

- [ ] **Step 1 : tests** (Excel ouverte, 3 leçons terminées, dernière ouverte = 4) :
  - « Votre progression », « 25 % », la barre à 25, « 1 h 45 restantes » (la durée exacte calculée) ;
  - « Prochaine leçon », « Références relatives et absolues », « Module 1 · 10:40 », « Continuer » → leçon 4 ;
  - programme : coches vertes sur 1–3, « Vous êtes ici » sur 4, module 1 « En cours » ;
  - tout terminé → « Formation terminée » et « Revoir la formation » ;
  - non commencée → « Commencer » (comme avant).
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(progression): progression et « Continuer » sur la fiche`

### Task 5: Mes parcours, guide et vérifications

**Files :**
- Modify : `web/src/app/(app)/parcours/page.tsx` (progressions de la base), `docs/guides/ce-qui-te-revient.md` (section 11)
- Test : `web/tests/parcours/page.test.ts` (la page passe les progressions de `lireProgression`)

- [ ] **Step 1 : test** : `lireProgression` simulé avec 3 leçons terminées d'Excel → `MesParcours` reçoit `progressions.get("maitriser-microsoft-excel")` = `{ pourcentage: 25, terminee: false }`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : guide**, section 11 « Valider la progression (tâche 1.7) » :
  1. Appliquer `0008_progression.sql`.
  2. Terminer quelques leçons : vidéo regardée, ou « Marquer comme terminée » sans vidéo.
  3. Vérifier le même pourcentage sur la page leçon, la fiche (« Votre progression », « Continuer ») et Mes parcours.
  4. Quitter une vidéo à 4:00, revenir : elle reprend à 4:00.
- [ ] **Step 6 :** suite, `tsc`, `eslint`, `npm run build`, rendu de la fiche et de la page leçon (1440, 390, 320).
- [ ] **Step 7 : commit** `feat(progression): progression dans Mes parcours et guide de validation`
