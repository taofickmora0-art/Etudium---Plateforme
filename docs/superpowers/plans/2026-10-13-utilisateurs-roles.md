# Page Utilisateurs du back-office : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** au back-office, une page Utilisateurs (liste, fiche d'un compte) où le super admin donne les rôles et relie une fiche formateur, où l'équipe voit l'activité d'un compte et peut le suspendre ou le réactiver.

**Architecture :**
- **Migration 0013.** Une table `suspensions` et la fonction `compte_suspendu()`, branchée dans les fonctions de droits existantes (`a_role`, `equipe_contenus`, `acces_lecon`, avis) et dans des règles **restrictives** sur les données personnelles. Des fonctions `security definer` réservées à l'équipe lisent l'e-mail et la dernière connexion dans `auth.users` ; d'autres changent les rôles et suspendent, avec les garde-fous de la spec.
- **Application.** `getShellUser` repère un compte suspendu et l'envoie vers `/auth/suspendu`, qui le déconnecte. La connexion par mot de passe et le retour de Google refusent un compte suspendu. Les pages `/admin/utilisateurs` passent par des actions du serveur ; la recherche n'apparaît jamais dans l'adresse.

**Tech Stack :** Next.js 16.4 (cacheComponents), Supabase (RLS, fonctions SQL), PGlite (banc `tests/db/banc.ts`), Vitest + jsdom, composants `src/components/ui`.

**Spec :** `docs/superpowers/specs/2026-10-13-utilisateurs-roles-design.md`

## Global Constraints

- Textes en français, apostrophe typographique (’) dans l'interface, comme le reste du code.
- **Jamais de donnée personnelle dans une adresse** : recherche et filtre passent par une action du serveur, jamais par l'URL ; le message de suspension passe par `?erreur=suspendu`.
- **Aucune clé secrète** : seulement la clé publique ; tout ce qui touche `auth.users` passe par des fonctions SQL `security definer`.
- Migration `web/supabase/migrations/0013_utilisateurs.sql` **rejouable** (`if not exists`, `drop … if exists`, `create or replace`), appliquée par l'utilisateur dans l'éditeur SQL, après la 0012.
- **Avant la 0013, l'application marche comme aujourd'hui** : fonction absente (`estFonctionAbsente`) → compte non suspendu ; la page Utilisateurs affiche un bandeau « Appliquez la migration 0013 ».
- Vérifier le rôle en tête de chaque page (`requireSpace("admin")`) et de chaque action (`exigerEquipe()`), jamais dans une mise en page.
- Message exact : `Ce compte est suspendu. Pour en savoir plus, contactez l’équipe Étudium.`
- 25 comptes par page ; motif de suspension : 500 caractères au plus.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Avant la 0013**, toute page connectée doit s'afficher normalement (`compte_suspendu` absente : pas de redirection, pas d'erreur) → test de la tâche 3.
2. **Recherche avec `%`, `_`, `'` ou des accents** (« Fifamè », « élodie ») : pas d'erreur SQL, pas de joker ; les accents ne comptent pas → test de la tâche 2.
3. **Identifiant de compte inconnu ou mal formé** dans l'adresse de la fiche : page introuvable (404), pas d'écran d'erreur → test de la tâche 4 (`lireCompte`) et de la tâche 5 (page).
4. **Double clic** : suspendre un compte déjà suspendu, réactiver un compte actif ne change rien et ne lève pas d'erreur (la date et l'auteur de la suspension restent ceux d'origine) → test de la tâche 1.
5. **Adresse e-mail ou nom très longs à 320 px** : aucune ligne ni fiche ne déborde → mesure de rendu de la tâche 6 (adresse de 60 caractères, nom de 50 + 50).

---

### Task 1 : Migration 0013, partie 1 : la suspension dans la base

**Files :**
- Create : `web/supabase/migrations/0013_utilisateurs.sql`
- Modify : `web/tests/db/supabase-simule.sql` (colonne `last_sign_in_at timestamptz` de `auth.users`, présente dans le vrai Supabase)
- Test : `web/tests/db/utilisateurs.test.ts`

**Interfaces :**
- Produces :
  - table `public.suspensions(profil_id uuid pk → profils on delete cascade, depuis timestamptz default now(), par uuid → profils on delete set null, motif text not null default '' check ≤ 500)`, RLS activée, **aucune règle** et `revoke all` pour `anon` et `authenticated` (lue et écrite par les fonctions seulement) ;
  - `public.compte_suspendu() returns boolean` (stable, security definer, `search_path = ''`), accordée à `anon, authenticated` ;
  - `public.suspendre_compte(p_compte uuid, p_motif text default '') returns void` et `public.reactiver_compte(p_compte uuid) returns void`, accordées à `authenticated` seulement.

- [ ] **Step 1 : Écrire les tests qui échouent** (`tests/db/utilisateurs.test.ts`, banc avec les migrations 0001 à 0012, les exemples du lot 1, puis la 0013 ; comptes : étudiant `E`, autre étudiant `E2`, formateur `F`, modérateur `M`, admin `A`, super admin `S`)

```ts
describe("Migration 0013 : suspension", () => {
  it("un admin suspend un étudiant ; le compte suspendu le sait, les autres non", async () => {
    await banc.en({ id: A }, "select public.suspendre_compte($1, 'Spam')", [E]);
    expect(await banc.en({ id: E }, "select public.compte_suspendu() as s")).toEqual([{ s: true }]);
    expect(await banc.en({ id: E2 }, "select public.compte_suspendu() as s")).toEqual([{ s: false }]);
  });
  it("droits : pas un étudiant, pas un modérateur, pas soi-même, pas un super admin ; l'équipe par le super admin seul", async () => {
    await expect(banc.en({ id: E2 }, "select public.suspendre_compte($1)", [E])).rejects.toThrow(/admin/);
    await expect(banc.en({ id: M }, "select public.suspendre_compte($1)", [E])).rejects.toThrow(/admin/);
    await expect(banc.en({ id: A }, "select public.suspendre_compte($1)", [A])).rejects.toThrow(/propre compte/);
    await expect(banc.en({ id: A }, "select public.suspendre_compte($1)", [M])).rejects.toThrow(/super admin/);
    await expect(banc.en({ id: S }, "select public.suspendre_compte($1)", [S2])).rejects.toThrow(/rôle super admin/);
    await banc.en({ id: S }, "select public.suspendre_compte($1)", [M]); // permis
  });
  it("suspendre deux fois ou réactiver un compte actif ne change rien", async () => { /* depuis et par inchangés après un 2e appel ; reactiver_compte(E2) sans erreur */ });
  it("un compte suspendu perd ses droits d'équipe et ses rôles", async () => {
    // A2 (admin) suspendu par S : equipe_contenus() et a_role('admin') rendent false ; insert dans public.parcours refusé.
  });
  it("un compte suspendu ne lit plus aucune leçon, même en aperçu", async () => {
    // acces_lecon(<leçon d'aperçu>) : false pour E suspendu, true pour E2.
  });
  it("un compte suspendu n'écrit plus rien : progression, notes, favoris, avis, profil", async () => {
    // ouvrir_lecon, insert notes_lecons, insert favoris, enregistrer_avis, supprimer_avis, update profils : tous refusés ;
    // select sur ses notes, favoris, progression, avis : [] (règles restrictives).
  });
  it("réactiver rend tout, immédiatement", async () => { /* reactiver_compte(E) par A → compte_suspendu false, acces_lecon true, insert favoris permis */ });
  it("la table des suspensions n'est lisible par personne en direct", async () => {
    await expect(banc.en({ id: A }, "select * from public.suspensions")).rejects.toThrow(/permission denied/);
  });
  it("la migration est rejouable", async () => { await banc.appliquer(MIGRATION); });
});
```

- [ ] **Step 2 : Lancer les tests, ils échouent**

Run : `cd web && npx vitest run tests/db/utilisateurs.test.ts`
Expected : FAIL (fichier de migration introuvable).

- [ ] **Step 3 : Écrire la première partie de la 0013**
  - `compte_suspendu()` d'abord : les fonctions SQL suivantes la référencent.
  - Redéfinir `a_role`, `equipe_contenus`, `acces_lecon` (corps de 0001 et 0004, inchangés, précédés de `not public.compte_suspendu() and (…)`), `peut_donner_avis` (0010, même ajout) et `supprimer_avis` (0010 : lève `Ce compte est suspendu.` si suspendu). Mêmes signatures, mêmes droits d'exécution.
  - Règle restrictive `"compte suspendu : rien"` (`as restrictive for all to authenticated using (not (select public.compte_suspendu())) with check (not (select public.compte_suspendu()))`) sur `profils`, `notes_lecons`, `favoris`, `avis`, `progression_lecons`.
  - `suspendre_compte` (dans cet ordre) :
    1. l'appelant doit avoir `admin` ou `super_admin`, sinon `Seuls un admin ou le super admin suspendent un compte.` (errcode `42501`) ;
    2. le compte doit exister dans `profils`, sinon `Compte introuvable.` ;
    3. `Vous ne pouvez pas suspendre votre propre compte.` ;
    4. un compte cible `super_admin` : `Retirez d’abord le rôle super admin de ce compte.` ;
    5. une cible `moderateur` ou `admin` par un non super admin : `Seul le super admin suspend un membre de l’équipe.` ;
    6. puis `insert … (profil_id, par, motif) values (p_compte, auth.uid(), left(trim(coalesce(p_motif, '')), 500)) on conflict do nothing`.
  - `reactiver_compte` : mêmes droits (sans la règle « soi-même »), puis `delete`.
  - Les messages sont levés avec `raise exception` (code `P0001`), sauf le premier (code `42501`).

- [ ] **Step 4 : Lancer les tests, ils passent**

Run : `cd web && npx vitest run tests/db`
Expected : PASS (les autres fichiers de `tests/db` aussi : la redéfinition ne change rien pour un compte actif).

- [ ] **Step 5 : Commit** : `feat(utilisateurs): suspension d'un compte dans la base (migration 0013)`

### Task 2 : Migration 0013, partie 2 : lire les comptes, changer les rôles

**Files :**
- Modify : `web/supabase/migrations/0013_utilisateurs.sql` (à la suite)
- Test : `web/tests/db/utilisateurs.test.ts` (nouveau `describe`)

**Interfaces :**
- Consumes : `compte_suspendu()`, `suspensions` (tâche 1).
- Produces (toutes `security definer`, `search_path = ''`, accordées à `authenticated` seulement) :
  - `public.sans_accents(t text) returns text` (immutable) : minuscules et sans accents, par `translate` sur les lettres accentuées du français (à, â, ä, é, è, ê, ë, î, ï, ô, ö, ù, û, ü, ç, ÿ et leurs majuscules) ;
  - `public.comptes_equipe(p_recherche text default '', p_filtre text default 'tous', p_page integer default 1) returns jsonb` → `{"total": n, "comptes": [{id, prenom, nom, email, roles, inscrit_le, derniere_connexion, suspendu}]}`. Règles :
    - `roles` est un tableau de textes dans l'ordre `etudiant, formateur, moderateur, admin, super_admin` ;
    - `inscrit_le` vient de `profils.cree_le`, `derniere_connexion` de `auth.users.last_sign_in_at` (null s'il ne s'est jamais connecté) ;
    - filtres : `etudiants` (aucun rôle autre qu'étudiant), `formateurs`, `equipe` (modérateur, admin ou super admin), `suspendus`, et `tous` (toute autre valeur vaut `tous`) ;
    - recherche : `strpos` sur `sans_accents(prenom || ' ' || nom)` ou sur `lower(email)`, jamais `like` ;
    - tri par `cree_le desc, id` ; pages de 25 (une page < 1 vaut 1) ;
  - `public.compte_equipe(p_compte uuid) returns jsonb` → null si le compte n'existe pas, sinon `{id, prenom, nom, email, inscrit_le, derniere_connexion, roles, suspension: null | {depuis, par_nom, motif}, fiche_formateur: null | {id, nom}, formations: [{id, titre, slug, terminees, total, derniere_activite}], avis: [{id, formation_titre, note, commentaire, masque, cree_le}]}`. Règles :
    - `formations` : celles qui ont au moins une ligne dans `progression_lecons` ; `total` = toutes leurs leçons ; `derniere_activite` = la plus grande de `vue_le`, `terminee_le`, `dernier_envoi` ; les plus récentes d'abord ;
    - `avis` : les plus récents d'abord ;
    - `par_nom` : prénom et nom de l'auteur de la suspension, `''` s'il n'existe plus ;
  - ces deux fonctions lèvent `Accès réservé à l’équipe.` (`42501`) hors de l'équipe (`equipe_contenus()`) ;
  - `public.changer_roles(p_compte uuid, p_roles public.role_etudium[], p_fiche uuid default null, p_nouvelle_fiche boolean default false) returns void` ;
  - index unique partiel `formateurs_compte_unique on public.formateurs (compte_id) where compte_id is not null`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
describe("Migration 0013 : comptes et rôles", () => {
  it("la liste : l'équipe (modérateur compris) la lit ; un étudiant, un formateur et un visiteur sont refusés", async () => {
    const [{ r }] = await banc.en<{ r: { total: number; comptes: { email: string }[] } }>({ id: M }, "select public.comptes_equipe() as r");
    expect(r.total).toBeGreaterThanOrEqual(7);
    for (const qui of [{ id: E }, { id: F }, "anon" as const]) await expect(banc.en(qui, "select public.comptes_equipe()")).rejects.toThrow(/équipe|permission denied/);
  });
  it("recherche par nom sans accents ni majuscules, et par adresse e-mail", async () => {
    // profil de E2 renommé « Fifamè Adjovi » : 'fifame' et 'ADJO' le trouvent ; le début de son adresse aussi.
  });
  it("une recherche avec % _ ou ' ne plante pas et ne sert pas de joker", async () => {
    for (const q of ["%", "_", "l'a"]) expect((await liste(A, q)).total).toBe(0);
  });
  it("filtres : étudiants, formateurs, équipe, suspendus", async () => { /* E dans etudiants pas dans equipe ; F dans formateurs ; M, A, S dans equipe ; un suspendu dans suspendus */ });
  it("pages de 25, les plus récents d'abord", async () => { /* 30 comptes créés : page 1 → 25, page 2 → le reste, total identique */ });
  it("la fiche : identité, rôles, suspension, activité (formations suivies et avis)", async () => {
    // E a ouvert 2 leçons d'une formation de 12 et terminé 1, et laissé un avis :
    // formations = [{ titre, terminees: 1, total: 12 }], avis = [{ note }] ; suspension null ; compte inconnu → null.
  });
  it("seul le super admin change les rôles ; Étudiant est toujours gardé", async () => {
    await expect(banc.en({ id: A }, "select public.changer_roles($1, '{moderateur}')", [E])).rejects.toThrow(/super admin/);
    await banc.en({ id: S }, "select public.changer_roles($1, '{moderateur}')", [E]);
    // roles de E = ['etudiant', 'moderateur'] ; puis changer_roles(E, '{}') → ['etudiant']
  });
  it("le super admin ne se retire pas son propre rôle super admin", async () => {
    await expect(banc.en({ id: S }, "select public.changer_roles($1, '{admin}')", [S])).rejects.toThrow(/vous retirer/);
  });
  it("Formateur demande une fiche : existante libre, ou créée à son nom ; retirer le rôle la détache", async () => {
    // sans fiche → /Choisissez la fiche formateur/ ; p_nouvelle_fiche → une fiche au nom « Test xxxx » avec compte_id = E ;
    // retrait → compte_id null, fiche toujours là ; p_fiche d'une fiche déjà reliée à un autre compte → /déjà reliée/.
  });
  it("un compte suspendu ne reçoit pas de nouveau rôle", async () => { /* → /Réactivez le compte/ ; retirer un rôle reste permis */ });
});
```

- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/db/utilisateurs.test.ts` → FAIL (`function public.comptes_equipe… does not exist`).

- [ ] **Step 3 : Écrire la seconde partie de la 0013.** `changer_roles`, dans cet ordre :
  1. appelant `super_admin`, sinon `Seul le super admin change les rôles.` (`42501`) ;
  2. compte existant, sinon `Compte introuvable.` ;
  3. nouvel ensemble = `p_roles` + `etudiant` ;
  4. sur son propre compte sans `super_admin` : `Vous ne pouvez pas vous retirer le rôle super admin.` ;
  5. compte suspendu et rôle ajouté : `Réactivez le compte avant de lui donner un rôle.` ;
  6. `formateur` dans l'ensemble sans fiche reliée :
     - `p_nouvelle_fiche` : nouvelle fiche, `nom = left(coalesce(nullif(trim(prenom || ' ' || nom), ''), 'Formateur'), 80)` ;
     - sinon `p_fiche` : `update … set compte_id = p_compte where id = p_fiche and compte_id is null`, et si rien n'est mis à jour : `Cette fiche formateur est déjà reliée à un compte.` ;
     - sinon : `Choisissez la fiche formateur de ce compte.` ;
  7. `formateur` absent de l'ensemble : `compte_id = null` sur sa fiche ;
  8. supprimer les rôles absents, insérer les nouveaux.

- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS.

- [ ] **Step 5 : Commit** : `feat(utilisateurs): liste et fiche des comptes, changement des rôles et fiche formateur (migration 0013)`

### Task 3 : L'application applique la suspension

**Files :**
- Create : `web/src/lib/auth/suspension.ts`, `web/src/app/auth/suspendu/route.ts`
- Modify : `web/src/lib/auth/current-user.ts` (`getShellUser`), `web/src/lib/auth/actions.ts` (`signIn`), `web/src/app/auth/callback/route.ts`, `web/src/components/auth/FromAddress.tsx` (`SignInNotices`)
- Test : `web/tests/auth/suspension.test.ts`, `web/tests/auth/current-user.test.ts`, `web/tests/auth/sign-in.test.tsx`

**Interfaces :**
- Consumes : la fonction SQL `compte_suspendu()` (tâche 1), appelée par `rpc("compte_suspendu")`.
- Produces :
  - `MESSAGE_SUSPENDU` (le texte des Global Constraints) ;
  - `ADRESSE_SUSPENDU = "/auth/suspendu"` ;
  - `estSuspendu(supabase: { rpc: (nom: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> }): Promise<boolean>`. Elle rend `data === true`. En cas d'erreur, elle rend `false` : la fonction absente (`estFonctionAbsente`) est passée sous silence, toute autre erreur est consignée (`console.error`).

- [ ] **Step 1 : Écrire les tests qui échouent**
  - `getShellUser` :
    - « un compte suspendu est envoyé vers /auth/suspendu » : `rpc` rend `{ data: true }` → lève `NEXT_REDIRECT:/auth/suspendu` ;
    - « avant la migration 0013, la page s'affiche normalement » : `rpc` rend `{ error: { code: "PGRST202" } }` → l'utilisateur est rendu.
  - Route `/auth/suspendu` :
    - « déconnecte un compte suspendu et l'envoie à la connexion avec le message » : `signOut` appelé, redirection vers `/connexion?erreur=suspendu` ;
    - « ne déconnecte pas un compte actif » : `signOut` non appelé, redirection vers `/accueil`.
  - `signIn` :
    - « un compte suspendu est refusé et aussitôt déconnecté » : `signInWithPassword` sans erreur, `rpc` → `true` : résultat `{ status: "error", message: MESSAGE_SUSPENDU }`, `signOut` appelé, pas de redirection.
  - Retour de Google :
    - « un compte suspendu revient à la connexion avec le message » : après l'échange, `signOut` puis redirection vers `/connexion?erreur=suspendu`.
  - `SignInNotices` :
    - « affiche le message de suspension » : adresse `?erreur=suspendu` → bandeau d'erreur contenant `MESSAGE_SUSPENDU`.

- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/auth` → FAIL sur les nouveaux tests.

- [ ] **Step 3 : Implémenter**
  - `getShellUser` ajoute `estSuspendu(supabase)` à son `Promise.all` et appelle `redirect(ADRESSE_SUSPENDU)` si vrai.
  - La route GET vérifie d'abord `estSuspendu` : un compte actif n'est jamais déconnecté par un lien.
  - `signIn` vérifie après une connexion réussie ; le retour de Google vérifie après l'échange du code.

- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/auth` → PASS.

- [ ] **Step 5 : Commit** : `feat(auth): un compte suspendu est déconnecté et ne peut plus se connecter`

### Task 4 : Règles, lecture et actions des comptes

**Files :**
- Create :
  - `web/src/lib/utilisateurs/types.ts`
  - `web/src/lib/utilisateurs/regles.ts`
  - `web/src/lib/utilisateurs/data.ts`
  - `web/src/lib/utilisateurs/actions.ts` (`"use server"`)
- Test :
  - `web/tests/utilisateurs/regles.test.ts`
  - `web/tests/utilisateurs/data.test.ts`
  - `web/tests/utilisateurs/actions.test.ts` (faux client `tests/admin/faux-supabase.ts`)

**Interfaces :**
- Consumes : les fonctions SQL des tâches 1 et 2 ; `exigerEquipe()` (`lib/admin/garde.ts`) ; `Role` (`lib/auth/permissions.ts`).
- Produces :
  - types :
    - `FiltreComptes = "tous" | "etudiants" | "formateurs" | "equipe" | "suspendus"` ;
    - `CompteResume = { id; prenom; nom; email; roles: Role[]; inscritLe: string; derniereConnexion: string | null; suspendu: boolean }` ;
    - `PageComptes = { total: number; comptes: CompteResume[] }` ;
    - `CompteDetail = Omit<CompteResume, "suspendu"> & { suspension: { depuis: string; parNom: string; motif: string } | null; ficheFormateur: { id: string; nom: string } | null; formations: { id; titre; slug; terminees: number; total: number; derniereActivite: string }[]; avis: { id; formationTitre; note: number; commentaire: string; masque: boolean; creeLe: string }[] }` ;
    - `Lecture<T> = { migrationAbsente: true } | { migrationAbsente: false; donnees: T }` ;
    - `ChoixFiche = { existante: string } | { nouvelle: true } | null` ;
    - `Resultat = { ok: boolean; message?: string }` ;
  - `regles.ts` :
    - `COMPTES_PAR_PAGE = 25` ;
    - `FILTRES_COMPTES: { value: FiltreComptes; label: string }[]` (Tous, Étudiants, Formateurs, Équipe, Suspendus) ;
    - `LIBELLES_ROLES: Record<Role, string>` (Étudiant, Formateur, Modérateur, Admin, Super admin) ;
    - `nomAffiche(prenom: string, nom: string): string` (« Sans nom » si vide) ;
    - `resumeChangement(avant: Role[], apres: Role[]): string` (« Donner : Formateur. Retirer : Admin. », chaque partie omise si vide, « Aucun changement. » si rien) ;
    - `droitsSurCompte(moi: { id: string; roles: Role[] }, compte: { id: string; roles: Role[]; suspendu: boolean }): { changerRoles: boolean; suspendre: boolean; reactiver: boolean }`, qui reprend exactement les règles SQL ;
  - `data.ts` :
    - `lireComptes(recherche: string, filtre: FiltreComptes, page: number): Promise<Lecture<PageComptes>>` ;
    - `lireCompte(id: string): Promise<Lecture<CompteDetail | null>>`, où un identifiant qui n'est pas un UUID rend `{ migrationAbsente: false, donnees: null }` sans appeler la base ;
    - `lireFichesLibres(): Promise<{ id: string; nom: string }[]>`, les fiches dont `compte_id` est null, triées par nom ;
    - toute autre erreur est relancée (écran d'erreur du back-office) ;
  - `actions.ts`, qui commencent toutes par `exigerEquipe()` :
    - `chercherComptes(recherche: string, filtre: FiltreComptes, page: number): Promise<{ ok: true; page: PageComptes } | { ok: false; message: string }>` ;
    - `changerRoles(compteId: string, roles: Role[], fiche: ChoixFiche): Promise<Resultat>` ;
    - `suspendreCompte(compteId: string, motif: string): Promise<Resultat>` ;
    - `reactiverCompte(compteId: string): Promise<Resultat>` ;
    - le message d'une erreur `P0001` est rendu tel quel ; une erreur `42501` donne `ACCES_EQUIPE` ; toute autre erreur donne `L’opération n’a pas abouti. Réessayez.` ;
    - après un changement : `revalidatePath("/admin/utilisateurs/" + compteId)` et `revalidatePath("/admin/utilisateurs")`.

- [ ] **Step 1 : Écrire les tests qui échouent**
  - `regles` :
    - `resumeChangement(["etudiant","admin"], ["etudiant","formateur"])` === `"Donner : Formateur. Retirer : Admin."` ;
    - `nomAffiche("", "")` === `"Sans nom"` ;
    - `droitsSurCompte` :
      - modérateur : tout faux ;
      - admin sur un étudiant : `suspendre` vrai, `changerRoles` faux ;
      - admin sur un admin : `suspendre` faux ;
      - super admin sur lui-même : `suspendre` faux, `changerRoles` vrai ;
      - super admin sur un super admin : `suspendre` faux ;
      - compte suspendu : `suspendre` faux, `reactiver` vrai selon les mêmes droits.
  - `data` :
    - « jsonb converti en camelCase » ;
    - « fonction absente → migrationAbsente » ;
    - « identifiant mal formé → null sans appel » ;
    - « autre erreur relancée ».
  - `actions` :
    - « refusé hors de l'équipe, sans appel à la base » ;
    - « changerRoles transmet p_fiche ou p_nouvelle_fiche » : `{ existante: "x" }` → `{ p_fiche: "x", p_nouvelle_fiche: false }` ; `{ nouvelle: true }` → `{ p_fiche: null, p_nouvelle_fiche: true }` ;
    - « message P0001 rendu tel quel » ;
    - « motif coupé à 500 caractères et nettoyé des espaces » ;
    - « chercherComptes ramène une page < 1 à 1 ».

- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/utilisateurs` → FAIL (modules introuvables).
- [ ] **Step 3 : Implémenter** les quatre fichiers, avec les signatures ci-dessus.
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/utilisateurs` → PASS.
- [ ] **Step 5 : Commit** : `feat(utilisateurs): règles, lecture et actions des comptes`

### Task 5 : Les pages Utilisateurs

**Files :**
- Modify :
  - `web/src/app/(app)/admin/utilisateurs/page.tsx` (remplace la page « Bientôt disponible ») ;
  - `web/src/lib/pages-a-venir.ts` (retirer `"admin/utilisateurs"`, et tout test qui énumère les pages à venir).
- Create :
  - `web/src/app/(app)/admin/utilisateurs/[id]/page.tsx`
  - `web/src/components/admin/utilisateurs/ListeComptes.tsx` (client)
  - `web/src/components/admin/utilisateurs/RolesCompte.tsx` (client)
  - `web/src/components/admin/utilisateurs/SuspensionCompte.tsx` (client)
  - `web/src/components/admin/utilisateurs/ActiviteCompte.tsx`
- Test : `web/tests/admin/utilisateurs.test.tsx`

**Interfaces :**
- Consumes : tout ce que produit la tâche 4 ; `getAuthUser()` (identifiant du compte connecté, pour `droitsSurCompte`) ; composants `PageAdmin`, `List`/`ListRow`, `Avatar`, `Tag`, `FilterChips`, `SearchInput`, `Pagination`, `ProgressBar`, `Checkbox`, `Select`, `Textarea`, `ConfirmDialog`, `Banner`, `EmptyState`, `Skeleton`.
- Produces :
  - `ListeComptes({ initial: PageComptes })` ;
  - `RolesCompte({ compte: CompteDetail, fichesLibres: { id: string; nom: string }[], modifiable: boolean })` ;
  - `SuspensionCompte({ compte: CompteDetail, droits: { suspendre: boolean; reactiver: boolean } })` ;
  - `ActiviteCompte({ compte: CompteDetail })`.

**Ce que montrent les pages** (spec §2 et §3) :
- **Liste :**
  - recherche (`SearchInput`, libellé « Rechercher un compte »), lancée 300 ms après la dernière frappe, puis filtres, puis `List` ;
  - chaque ligne : `Avatar` (initiales), titre `nomAffiche`, sous-titre `email · Inscrit le 12 oct. 2026 · Dernière connexion : 13 oct. 2026` (ou `Jamais`), étiquettes des rôles autres qu'Étudiant, et `Suspendu` (ton erreur) ; lien vers la fiche ;
  - `Pagination` au-delà de 25 ;
  - liste vide : `Aucun compte ne correspond à cette recherche.` ;
  - échec : `La liste n’a pas pu être chargée. Réessayez.`
- **Fiche :**
  - fil d'Ariane Utilisateurs › nom ;
  - les sections Identité, Rôles, Activité, Suspension ;
  - `notFound()` si le compte est introuvable ;
  - bandeau `Appliquez la migration 0013 (guide « Ce qui te revient », section 18).` si la fonction est absente, sur les deux pages.
- **Rôles :**
  - Étudiant coché et désactivé ;
  - si non modifiable : cases désactivées et `Seul le super admin change les rôles.` ;
  - Formateur coché sans fiche reliée → `Select` « Fiche formateur » (options : les fiches libres, puis « Créer une fiche à son nom »), obligatoire : **Enregistrer les rôles** est désactivé tant qu'il n'y a pas de choix ;
  - confirmation `ConfirmDialog` dont la description est `resumeChangement` ;
  - fiche reliée : `Fiche formateur : <nom>` avec un lien `/admin/formateurs/<id>`.
- **Activité :**
  - chaque formation suivie : titre, `6 / 12 leçons`, `ProgressBar`, `Dernière activité le <date>` ;
  - chaque avis : formation, note (`4/5`), les 120 premiers caractères du commentaire, et `Masqué par l’équipe` s'il l'est ;
  - sinon : `Aucune formation commencée.` et `Aucun avis.`
- **Suspension :**
  - `Suspendre le compte` (confirmation, motif facultatif, 500 caractères au plus) ;
  - si suspendu : étiquette `Suspendu depuis le <date>, par <nom>`, le motif et `Réactiver le compte` ;
  - boutons absents selon `droitsSurCompte`.

- [ ] **Step 1 : Écrire les tests qui échouent**
  - `ListeComptes` :
    - « une ligne par compte, rôles en étiquettes, Suspendu signalé » ;
    - « liste vide : le message » ;
    - « la recherche appelle l'action et ne touche pas à l'adresse » : `chercherComptes` appelé avec `("fifa", "tous", 1)` ; `window.location.search` inchangé ; `router.replace` jamais appelé.
  - `RolesCompte` :
    - « en lecture seule pour un admin » : cases désactivées, message affiché ;
    - « cocher Formateur demande la fiche ; Enregistrer désactivé tant qu'elle n'est pas choisie » ;
    - « la confirmation résume le changement » : `Donner : Formateur.` ;
    - « Créer une fiche à son nom transmet { nouvelle: true } ».
  - `SuspensionCompte` :
    - « sur son propre compte, aucun bouton » ;
    - « compte suspendu : date, auteur, motif et Réactiver ».
  - Page fiche :
    - « identifiant inconnu → notFound » (`lireCompte` rend `donnees: null`, `notFound` appelé).

- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/admin/utilisateurs.test.tsx` → FAIL.
- [ ] **Step 3 : Implémenter** les pages et les composants (pages enveloppées dans `Suspense`, avec `Skeleton` comme la page Avis).
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/admin tests/navigation* tests/layout` → PASS ; puis `npx tsc --noEmit` et `npx eslint .` sans erreur.
- [ ] **Step 5 : Commit** : `feat(admin): page Utilisateurs (liste, fiche, rôles, fiche formateur, activité, suspension)`

### Task 6 : Rendu et guide

**Files :**
- Modify : `docs/guides/ce-qui-te-revient.md` (section 18)
- Temporaire, jamais commité : un test qui écrit le rendu statique de la liste et de la fiche (adresse de 60 caractères, nom de 50 + 50, compte suspendu avec un motif de 500 caractères, 3 formations, 2 avis), mesuré avec le CSS de la compilation à 1440, 390 et 320 px.

- [ ] **Step 1 : Compiler** : `cd web && npm run build` → succès.
- [ ] **Step 2 : Mesurer le rendu** (méthode des tâches précédentes : `public/formations/__rendus/`, iframes `srcdoc`, puis suppression) → aucun élément ne dépasse la largeur de la fenêtre ; noter les mesures dans le registre.
- [ ] **Step 3 : Écrire la section 18 du guide**
  - appliquer la 0013 dans l'éditeur SQL, après la 0012 ;
  - Back-office → Utilisateurs : te trouver par ton nom ou ton adresse ;
  - sur un compte de test : lui donner Formateur avec « Créer une fiche à son nom », puis le retirer ;
  - le suspendre : dans une fenêtre de navigation privée connectée à ce compte, la page suivante déconnecte avec le message, et une nouvelle connexion est refusée ;
  - le réactiver : la connexion remarche.
- [ ] **Step 4 : Lancer toute la suite** : `cd web && npx vitest run` → toute la suite passe.
- [ ] **Step 5 : Commit** : `docs: guide de validation de la page Utilisateurs`
