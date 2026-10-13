# Espace formateur « Étudiants » et tableau de bord : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** le formateur suit les étudiants de ses formations (liste, fiche leçon par leçon, remarque privée) et dispose du tableau de bord du design `NdFormateur` ; l'équipe lit les remarques sur la fiche d'un compte.

**Architecture :**
- **Migration 0015.** Une fonction interne `suivi_formateur(fiche)` calcule une ligne par paire étudiant–formation, selon les définitions de la spec (§2). Les fonctions du formateur (liste, fiche, tableau de bord) s'appuient sur elle ; elles sont `security definer` et ne livrent jamais d'adresse e-mail. Les remarques vivent dans une table lisible par leur auteur et par l'équipe, et ne s'écrivent que par une fonction.
- **Application.** Des lectures et une action dans `lib/formateur/suivi.ts`. Deux composants partagés sont extraits du code existant : le tableau du design (de `ListeComptes`) et les blocs du tableau de bord (de `TableauDeBordAdmin`). Puis les pages `/formateur` et `/formateur/etudiants`.

**Tech Stack :** Next.js 16.4, Supabase (fonctions SQL), PGlite (`tests/db/banc.ts`), Vitest + jsdom.

**Spec :** `docs/superpowers/specs/2026-10-14-etudiants-tableau-de-bord-formateur-design.md`

## Global Constraints

- Textes en français, apostrophe typographique (’) dans l'interface. Formulations neutres, sans genre : « Aucune activité depuis 14 jours », pas « Inactive ».
- **Jamais l'adresse e-mail d'un étudiant** dans les données livrées au formateur. Jamais de donnée personnelle dans une adresse de page : recherche et filtres passent par une action du serveur.
- Migration `web/supabase/migrations/0015_suivi_etudiants.sql`, **rejouable**, après la 0014.
- **Avant la 0015** : bandeau « Appliquez la migration 0015 (guide « Ce qui te revient », section 20). » sur les pages concernées ; rien d'autre ne change.
- Seuil « à risque » : **10 jours**. Lignes par page : **25**. Remarque : **2 000 caractères** au plus.
- Heure du Bénin : UTC+1 toute l'année (sans heure d'été). En SQL, le début du mois est `date_trunc('month', p_maintenant + interval '1 hour') - interval '1 hour'`. Dans l'interface, `Africa/Porto-Novo`.
- Chaque page appelle `requireSpace("formateur")` (ou `"admin"`) dans son `page.tsx`.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Le compte du formateur et l'équipe.** Un formateur qui suit sa propre formation, ou un membre de l'équipe qui teste, ne doivent jamais apparaître parmi les étudiants ni dans les chiffres → test de la tâche 1.
2. **Formation sans leçon, ou leçons ajoutées après coup.** Une formation dont le total de leçons a augmenté après qu'un étudiant a tout terminé n'est plus « Terminée » ; une formation sans leçon ne divise jamais par zéro (« — ») → tests des tâches 1 et 2.
3. **Étudiant de deux formateurs.** Le formateur A ne voit ni la progression sur les formations de B, ni la remarque de B → test de la tâche 1 et de la tâche 2.
4. **Recherche avec `%`, `_`, `'` ou des accents** dans les noms d'étudiants : même comportement que la page Utilisateurs (`strpos`, `sans_accents`) → test de la tâche 1.
5. **Les tableaux à 320 px.** Les tableaux défilent dans leur cadre ; la page ne s'élargit jamais. Le cadre est `relative`, sinon le texte réservé aux lecteurs d'écran s'en échappe → mesure de la tâche 7.

---

### Task 1 : Migration 0015 : le suivi des étudiants

**Files :**
- Create : `web/supabase/migrations/0015_suivi_etudiants.sql`
- Test : `web/tests/db/suivi-etudiants.test.ts` (banc : 0001 à 0014, exemples du lot 1)

**Interfaces :**
- Produces (SQL) :
  - **`public.suivi_formateur(p_fiche uuid)`** : `returns table (etudiant uuid, prenom text, nom text, formation uuid, formation_titre text, terminees int, total int, secondes int, derniere_activite timestamptz, premiere_ouverture timestamptz)`.
    - `security definer`, **sans droit d'exécution** pour `public`, `anon` et `authenticated` : interne.
    - Une ligne par paire étudiant–formation de la fiche.
    - Exclut le compte relié à la fiche (`formateurs.compte_id`) et les comptes de l'équipe.
    - `total` = toutes les leçons de la formation ; `secondes` = somme de `secondes_couvertes(passages)` ; `premiere_ouverture` = plus petit `ouverte_le`.
  - **`public.etat_suivi(terminees int, total int, derniere timestamptz, maintenant timestamptz) returns text`** (immutable) :
    - `'terminee'` si `total > 0 and terminees >= total` ;
    - `'a_risque'` si `derniere < maintenant - interval '10 days'` ;
    - sinon `'en_cours'`.
  - **`public.etudiants_formateur(p_recherche text default '', p_formation uuid default null, p_etat text default 'tous', p_page integer default 1, p_maintenant timestamptz default now()) returns jsonb`** :
    - retourne `{"total": n, "lignes": [{etudiant_id, prenom, nom, formation_id, formation_titre, terminees, total, derniere_activite, etat}]}` ;
    - `p_etat` : `tous` | `a_risque` | `terminees` ; une autre valeur vaut `tous` ;
    - recherche par `strpos(sans_accents(prenom || ' ' || nom), sans_accents(btrim(q)))` ;
    - tri `derniere_activite desc, etudiant, formation` ; pages de 25 ;
    - sans fiche (`ma_fiche_formateur()` nulle) : `Votre compte n’est pas encore relié à une fiche formateur.` (`42501`).
  - **`public.etudiant_formateur(p_etudiant uuid, p_maintenant timestamptz default now()) returns jsonb`** :
    - null si l'étudiant ne suit aucune de ses formations ;
    - sinon `{id, prenom, nom, formations: [{id, titre, terminees, total, secondes, derniere_activite, etat, modules: [{titre, lecons: [{id, titre, etat: 'terminee'|'ouverte'|'non_ouverte', terminee_le, secondes}]}]}], remarque: null | {texte, modifiee_le}}` ;
    - modules et leçons dans leur ordre ; la clé `remarque` est posée à la tâche 2 (null jusque-là) ;
    - même refus sans fiche.
  - Les deux fonctions publiques sont exécutables par `authenticated` seulement.

- [ ] **Step 1 : Tests qui échouent.** Préparation :
  - formateur `F`, fiche `FA`, deux formations : `X` (4 leçons) et `Y` (2 leçons) ;
  - formateur `G`, fiche `FB`, formation `Z` ;
  - étudiants `E1` (« Fifamè Adjovi »), `E2` (« Rodrigue Houngbo ») et `E3` ;
  - un admin `A` ; le compte `F` ouvre lui-même une leçon de `X`.
  - Progression posée en direct par `banc.db` : `E1` termine `X` (4/4) ; `E2` ouvre 1 leçon de `X`, dernière activité il y a 12 jours ; `E3` suit `Z` seulement ; `A` ouvre `X`.

```ts
it("une ligne par étudiant et par formation ; ni le formateur lui-même ni l'équipe", …)   // F : lignes (E1,X), (E2,X) ; jamais F ni A ; jamais E3
it("états : terminée, à risque après 10 jours, en cours", …)                                  // E1 X terminee ; E2 X a_risque ; E2 ouvre Y aujourd'hui → (E2,Y) en_cours
it("une leçon ajoutée après coup : la formation n'est plus terminée", …)                      // ajout d'une leçon à X → (E1,X) en_cours, 4/5
it("filtres : formation, état, recherche sans accents ; % _ ' ne sont pas des jokers", …)
it("pages de 25, les plus récemment actifs d'abord", …)
it("aucune adresse e-mail dans ce qui est livré au formateur", …)                              // JSON.stringify(résultat) ne contient pas "@"
it("la fiche d'un étudiant : ses formations chez ce formateur, leçons dans l'ordre, temps de vidéo", …) // passages '{[0,90)}' → secondes 90
it("la fiche d'un étudiant d'un autre formateur, ou inconnu : null", …)                        // F sur E3 → null
it("refus : étudiant, visiteur, formateur sans fiche ou suspendu ; suivi_formateur n'est pas appelable", …)
it("la migration est rejouable", …)
```

- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/db/suivi-etudiants.test.ts` → FAIL (migration absente).
- [ ] **Step 3 : Écrire la migration** (`begin; … commit;`, `create or replace`).
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS.
- [ ] **Step 5 : Commit** : `feat(formateur): suivi des étudiants dans la base (migration 0015)`

### Task 2 : Migration 0015 : remarques et tableau de bord

**Files :** Modify `web/supabase/migrations/0015_suivi_etudiants.sql` ; Test `web/tests/db/suivi-etudiants.test.ts` (nouveau `describe`).

**Interfaces :**
- Consumes : `suivi_formateur`, `etat_suivi` (tâche 1).
- Produces :
  - **Table `public.remarques_formateur`** :
    - colonnes : `formateur uuid → profils on delete cascade`, `etudiant uuid → profils on delete cascade`, `texte text` (contrainte 1 à 2000), `modifiee_le timestamptz default now()` ; clé `(formateur, etudiant)` ;
    - RLS : lecture si `formateur = auth.uid()` ou `equipe_contenus()` ;
    - aucun droit d'écriture direct pour `anon` ni `authenticated`.
  - **`public.enregistrer_remarque(p_etudiant uuid, p_texte text) returns void`** :
    - le formateur avec sa fiche ;
    - l'étudiant doit être dans `suivi_formateur(sa fiche)`, sinon `Cet étudiant ne suit aucune de vos formations.` ;
    - texte nettoyé des espaces : vide → suppression ; plus de 2000 caractères → `La remarque dépasse 2 000 caractères.` ; sinon `insert … on conflict do update`.
  - **`etudiant_formateur`** : la clé `remarque` = la remarque de `auth.uid()` sur cet étudiant.
  - **`public.remarques_compte(p_compte uuid) returns jsonb`** (l'équipe, sinon `42501`) : `[{formateur_nom, texte, modifiee_le}]`, du plus récent au plus ancien. `formateur_nom` = le nom de la fiche reliée à l'auteur, sinon son prénom et son nom.
  - **`public.tableau_de_bord_formateur(p_maintenant timestamptz default now()) returns jsonb`**, avec ces clés :
    - `prenom` : celui du formateur ;
    - `formations` : `{total, brouillons}` ;
    - `etudiants` : `{total, ce_mois}`, où `total` compte les étudiants distincts et `ce_mois` ceux dont la première ouverture date du mois en cours, heure du Bénin ;
    - `progression_moyenne` : un entier ou null, la moyenne de `terminees/total` sur les paires dont le total est positif ;
    - `a_risque` : jusqu'à 5 lignes `[{etudiant_id, prenom, nom, formation_titre, jours, pourcentage}]`, les plus inactifs d'abord ;
    - `formations_detail` : `[{id, titre, statut, envoyee_le, renvoyee_le, inscrits, progression_moyenne, completion, note_moyenne, nb_avis}]`, par `modifie_le` décroissant. Pour une formation sans étudiant, `progression_moyenne` et `completion` sont null.

- [ ] **Step 1 : Tests qui échouent**

```ts
it("une remarque : écrite par le formateur pour son étudiant, relue sur la fiche", …)
it("un texte vide supprime la remarque ; plus de 2 000 caractères refusé", …)
it("remarques : ni l'étudiant, ni un autre formateur ne les lisent ; l'équipe oui, avec le nom de la fiche", …)
it("pas de remarque sur un étudiant d'un autre formateur ; pas d'écriture directe", …)
it("tableau de bord : formations, étudiants (+ce mois), progression moyenne, à risque (5 au plus), détail par formation", …)
it("une formation sans étudiant : progression et complétion nulles, inscrits 0", …)
it("le formateur et l'équipe ne comptent pas dans les chiffres", …)
```

- [ ] **Step 2 : Lancer, ça échoue** → FAIL.
- [ ] **Step 3 : Écrire** la table, les fonctions et la mise à jour de `etudiant_formateur`.
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS.
- [ ] **Step 5 : Commit** : `feat(formateur): remarques privées et tableau de bord du formateur (migration 0015)`

### Task 3 : Lectures, règles et action du suivi

**Files :**
- Create : `web/src/lib/formateur/suivi.ts` (types, lectures), `web/src/lib/formateur/regles-suivi.ts`, `web/src/lib/formateur/actions.ts` (`"use server"`)
- Modify : `web/src/lib/utilisateurs/data.ts` (`lireRemarquesFormateurs`), `web/src/lib/utilisateurs/types.ts`, `web/src/lib/admin/garde.ts` (`exigerFormateur`)
- Test : `web/tests/formateur/suivi.test.ts`, `web/tests/formateur/regles-suivi.test.ts`, `web/tests/utilisateurs/data.test.ts`

**Interfaces :**
- Consumes : les fonctions SQL des tâches 1 et 2 ; `Lecture<T>` (`lib/utilisateurs/types`).
- Produces :
  - **types** :
    - `EtatSuivi = "en_cours" | "a_risque" | "terminee"` ;
    - `FiltreSuivi = "tous" | "a_risque" | "terminees"` ;
    - `LigneSuivi = { etudiantId; prenom; nom; formationId; formationTitre; terminees: number; total: number; derniereActivite: string; etat: EtatSuivi }` ;
    - `PageSuivi = { total: number; lignes: LigneSuivi[] }` ;
    - `SuiviEtudiant = { id; prenom; nom; formations: { id; titre; terminees; total; secondes; derniereActivite; etat; modules: { titre; lecons: { id; titre; etat: "terminee" | "ouverte" | "non_ouverte"; termineeLe: string | null; secondes: number }[] }[] }[]; remarque: { texte: string; modifieeLe: string } | null }` ;
    - `TableauDeBordFormateur` : les clés du §2 en camelCase ;
    - `RemarqueFormateur = { formateurNom; texte; modifieeLe }` ;
  - **`regles-suivi.ts`** :
    - `ETATS_SUIVI: Record<EtatSuivi, string>` = En cours, À risque, Terminée ;
    - `TON_SUIVI` : `en_cours` → `compteur`, `a_risque` → `echoue`, `terminee` → `valide` ;
    - `FILTRES_SUIVI` : Tous, À risque, Terminés ;
    - `LIGNES_PAR_PAGE = 25` ; `REMARQUE_MAX = 2000` ;
    - `dureeVideo(secondes: number): string` : 0 → `Aucune vidéo regardée` ; < 60 → `Moins d’une minute de vidéo` ; sinon `1 h 25 de vidéo` ou `45 min de vidéo` ;
    - `inactivite(jours: number): string` → `Aucune activité depuis 14 jours` (`1 jour` au singulier) ;
  - **`suivi.ts`** (lectures ; fonction absente → `migrationAbsente` ; autre erreur relancée) :
    - `lireSuivi(recherche, formationId: string | null, filtre: FiltreSuivi, page): Promise<Lecture<PageSuivi>>` ;
    - `lireSuiviEtudiant(id): Promise<Lecture<SuiviEtudiant | null>>` : un identifiant mal formé rend null sans appel ;
    - `lireTableauDeBordFormateur(): Promise<Lecture<TableauDeBordFormateur>>` ;
  - **`lib/admin/garde.ts`** : `exigerFormateur(): Promise<{ supabase } | { erreur }>` : le rôle `formateur` ou `super_admin` (comme l'accès à l'espace formateur), sinon `Accès réservé aux formateurs.` ; sans session `SESSION_EXPIREE` ;
  - **`actions.ts`** (garde `exigerFormateur`) :
    - `chercherSuivi(recherche, formationId, filtre, page): Promise<{ ok: true; page: PageSuivi } | { ok: false; message: string }>` : page < 1 ramenée à 1 ; formation non UUID → null ; filtre inconnu → tous ;
    - `enregistrerRemarque(etudiantId: string, texte: string): Promise<{ ok: boolean; message?: string }>` : le message `P0001` est rendu tel quel ; `refresh()` après succès ;
  - **`lib/utilisateurs/data.ts`** : `lireRemarquesFormateurs(compteId): Promise<Lecture<RemarqueFormateur[]>>`.

- [ ] **Step 1 : Tests qui échouent**
  - `regles-suivi` : `dureeVideo` (0, 30, 2700, 5100) ; `inactivite` (1, 14) ; libellés et tons.
  - `suivi` : conversion camelCase de chaque lecture ; `migrationAbsente` ; identifiant mal formé.
  - `actions` : refus d'un étudiant et d'un admin qui n'est pas formateur (`Accès réservé aux formateurs.`) ; paramètres transmis ; message de la base ; `refresh`.
  - `lireRemarquesFormateurs` : conversion ; `migrationAbsente`.
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/formateur tests/utilisateurs` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe**, puis `npx tsc --noEmit`.
- [ ] **Step 5 : Commit** : `feat(formateur): lectures, règles et action du suivi des étudiants`

### Task 4 : Composants partagés : le tableau du design et les blocs du tableau de bord

**Files :**
- Create : `web/src/components/ui/TableauListe.tsx`, `web/src/components/tableau/Blocs.tsx`
- Modify : `web/src/components/admin/utilisateurs/ListeComptes.tsx`, `web/src/components/admin/TableauDeBordAdmin.tsx`
- Test : `web/tests/ui/tableau-liste.test.tsx` (nouveau) ; les tests existants `tests/admin/utilisateurs.test.tsx` et `tests/admin/tableau-de-bord.test.tsx` restent verts sans modification.

**Interfaces :**
- Produces :
  - `TableauListe({ nom: string; nomCadre: string; colonnes: string[]; actions?: boolean; largeurMin?: number; occupe?: boolean; children: ReactNode })` :
    - un cadre `relative overflow-x-auto rounded-2xl` (`role="region"`, `aria-label={nomCadre}`, focusable) ;
    - le tableau `aria-label={nom}`, avec `min-width` = `largeurMin` (900 par défaut) ;
    - l'en-tête du design (`bg-page`, 13 px, `text-ardoise`) ;
    - une dernière colonne « Actions » réservée aux lecteurs d'écran si `actions` ;
  - `CELLULE_TABLEAU` : la classe des cellules (56 px, filet en haut) ;
  - `Blocs.tsx` : `Tuile`, `Carte` (avec `lot?`), `AVENIR`, `GRILLE_CHIFFRES`, `RANGEE`, déplacés tels quels de `TableauDeBordAdmin`.

- [ ] **Step 1 : Test qui échoue** (`tableau-liste.test.tsx`) :
  - « le cadre et le tableau sont nommés ; l'en-tête liste les colonnes ; la colonne Actions est réservée aux lecteurs d'écran » ;
  - « le cadre est positionné (relative) : le texte caché ne s'en échappe pas ».
- [ ] **Step 2 : Lancer, ça échoue.**
- [ ] **Step 3 : Extraire**, puis faire utiliser ces composants par `ListeComptes` et `TableauDeBordAdmin`.
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/ui tests/admin` → PASS, sans toucher aux tests existants.
- [ ] **Step 5 : Commit** : `refactor(ui): tableau du design et blocs du tableau de bord partagés`

### Task 5 : La page Étudiants

**Files :**
- Create (sous `web/src/app/(app)/formateur/`) : `etudiants/page.tsx`, `etudiants/[id]/page.tsx`.
- Create (sous `web/src/components/formateur/`) : `ListeEtudiants.tsx` (client), `PageEtudiants.tsx`, `FicheEtudiant.tsx`, `RemarqueEtudiant.tsx` (client).
- Modify :
  - `web/src/app/(app)/formateur/apprenants/page.tsx` : `requireSpace("formateur")`, puis `redirect("/formateur/etudiants")` ;
  - `web/src/lib/navigation.ts` (menu et barre du bas) ;
  - `web/src/lib/pages-a-venir.ts` (retirer `formateur/apprenants`) ;
  - `web/src/components/formateur/cadre.tsx` (bandeau 0015).
- Test : `web/tests/formateur/etudiants.test.tsx`, `web/tests/layout/menus-espaces.test.tsx`.

**Interfaces :**
- Consumes : tâches 3 et 4 ; `lireMaFiche`, `listFormations({ formateurId })` ; `RACINE_FORMATEUR`, `SansFiche`, `MigrationFormateurAbsente`.
- Produces :
  - `ListeEtudiants({ initial: PageSuivi; formations: { id: string; titre: string }[] })` :
    - `FilterChips` des états ;
    - `Select` « Formation » (Toutes les formations, puis les siennes) ;
    - recherche « Rechercher un étudiant… » ;
    - `TableauListe` (`nom` « Étudiants », colonnes Étudiant, Formation, Progression, Dernière activité, État ; `largeurMin` 760) ;
    - pagination `N sur T lignes`.
  - `FicheEtudiant({ id })` (serveur) :
    - une `Section` par formation : `ProgressBar`, `6 / 12 leçons`, `dureeVideo`, la dernière activité, l'état ;
    - les leçons par module ;
    - la mention `Quiz, exercices et certificat : disponibles au lot 3.` ;
    - puis `RemarqueEtudiant`.
  - `RemarqueEtudiant({ etudiantId, remarque })` :
    - un `Textarea` « Remarque privée » (2000 au plus) et un bouton **Enregistrer** ;
    - le texte d'aide « Visible par vous et l’équipe Étudium. Jamais par l’étudiant. » ;
    - « Modifiée le <date> » ; le message « Remarque enregistrée » (ou « Remarque supprimée » si le texte est vide).
  - **Menu formateur** :
    - Tableau de bord, Mes formations, Corrections, Sessions live, **Étudiants** (`/formateur/etudiants`, `StudentsIcon`), Messages ;
    - barre du bas : Tableau de bord, Formations, Étudiants, Sessions live, Profil.

- [ ] **Step 1 : Tests qui échouent**
  - « le tableau des étudiants : nom (lien vers la fiche), formation, 6 / 12, date, état » ;
  - « filtres et recherche passent par l'action, jamais par l'adresse » ;
  - « vide : Aucun étudiant ne suit encore vos formations. ; filtré : Aucun étudiant ne correspond à cette recherche. » ;
  - « fiche : leçons Terminée le … / Ouverte / Pas encore ouverte, temps de vidéo, mention du lot 3 » ;
  - « fiche d'un étudiant qui ne suit aucune de ses formations : page introuvable » ;
  - « remarque : enregistrer, vider pour supprimer ; refus affiché » ;
  - « sans fiche et avant la 0015 : les bandeaux » ;
  - dans `menus-espaces` : l'ordre et les noms du menu formateur, et la barre du bas.
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/formateur tests/layout` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/formateur tests/layout tests/auth` → PASS (`session-guard` et `pages` compris).
- [ ] **Step 5 : Commit** : `feat(formateur): page Étudiants (liste, fiche leçon par leçon, remarque privée)`

### Task 6 : Le tableau de bord du formateur ; les remarques au back-office

**Files :**
- Modify : `web/src/app/(app)/formateur/page.tsx` (remplace « Bientôt disponible »), `web/src/lib/pages-a-venir.ts` (retirer `formateur`), `web/src/components/admin/utilisateurs/FicheUtilisateur.tsx`.
- Create : `web/src/components/formateur/TableauDeBordFormateur.tsx`, `web/src/components/admin/utilisateurs/RemarquesFormateurs.tsx`.
- Test : `web/tests/formateur/tableau-de-bord.test.tsx`, `web/tests/admin/utilisateurs.test.tsx`.

**Interfaces :**
- Consumes : `lireTableauDeBordFormateur`, `lireRemarquesFormateurs`, `Blocs`, `TableauListe`, `ETATS`, `TON_ETAT`.
- Produces :
  - `TableauDeBordFormateur()` (serveur, design `NdFormateur`). Dans l'ordre :
    - `Bonjour <prénom>. Voici ce qui demande votre attention aujourd’hui.` ;
    - 4 tuiles : Formations (`N en brouillon`), Étudiants (`+N ce mois`), Progression moyenne (`Toutes formations`), Certificats délivrés (`Disponible au lot 3`) ;
    - Carte « Exercices à corriger » (lot 3) ;
    - Carte « Étudiants à risque » : `Inactifs depuis plus de 10 jours.`, une ligne par étudiant (`inactivite(jours) · <formation> <pourcentage> %`) et un lien « Voir le suivi » ; sinon `Aucun étudiant à risque.` ;
    - Cartes « Prochaine session live » et « Question récente » (lot 5) ;
    - Carte « Mes formations » : `TableauListe` (`nom` « Mes formations », `largeurMin` 820). Colonnes : Formation, Inscrits, Progression moyenne, Taux de complétion, Note (« 4,8 » ou « — »), Statut (`ETATS`/`TON_ETAT`), et le lien **Modifier**.
  - `RemarquesFormateurs({ compteId })` (serveur) : `Section` « Remarques des formateurs », une remarque par entrée (fiche, date, texte) ; sinon `Aucune remarque.` ; avant la 0015, rien n'est affiché.

- [ ] **Step 1 : Tests qui échouent**
  - « chiffres, à risque (lien vers la fiche), tableau des formations (— sans étudiant) » ;
  - « aucun étudiant à risque » ;
  - « sans fiche, avant la 0015 : les bandeaux » ;
  - « la fiche d'un compte au back-office montre les remarques des formateurs ».
- [ ] **Step 2 : Lancer, ça échoue.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/formateur tests/admin tests/layout` → PASS.
- [ ] **Step 5 : Commit** : `feat(formateur): tableau de bord du formateur ; remarques des formateurs au back-office`

### Task 7 : Rendu et guide

- [ ] **Step 1 :** `cd web && npm run build` → succès.
- [ ] **Step 2 : Mesurer à 1440, 390 et 320 px** les rendus statiques (temporaires, jamais commités) :
  - liste des étudiants : nom de 100 caractères, titre de formation de 120 ;
  - fiche : 3 formations, remarque de 2 000 caractères ;
  - tableau de bord : 5 à risque, 4 formations ;
  - Attendu : la page ne s'élargit jamais ; les tableaux défilent dans leur cadre.
- [ ] **Step 3 : Section 20 du guide**
  1. appliquer la 0015 après la 0014 ;
  2. avec le compte de test devenu formateur (section 19), sa formation publiée ;
  3. avec un troisième compte : inscris-en un nouveau, sans rôle, car ton compte (équipe) et celui du formateur ne comptent pas comme étudiants. Ouvre et termine des leçons de la formation ;
  4. Espace formateur → Tableau de bord : chiffres et tableau ;
  5. Étudiants : la ligne, la fiche, les leçons, une remarque ;
  6. au back-office, la fiche de l'étudiant montre la remarque.
- [ ] **Step 4 :** `cd web && npx vitest run` → toute la suite passe.
- [ ] **Step 5 : Commit** : `docs: guide de validation du suivi des étudiants et du tableau de bord du formateur`
