# R1 — Le formateur n'est plus étudiant : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un compte formateur n'a plus que son espace. Il y retrouve sa communauté, son profil et ses notifications. Il ne voit plus aucune formation des autres, et la base l'empêche d'agir comme un étudiant.

**Architecture :**
- **En base (0036) :** `acces_lecon` ferme les formations des autres à un formateur. Un déclencheur refuse toute action d'étudiant d'un compte formateur (progression, favoris, avis, inscriptions, quiz, rendus, conversation côté étudiant). `notifier` ne lui envoie plus les catégories d'apprentissage.
- **Dans l'appli :**
  - `canAccess("etudiant")` exclut le formateur ;
  - `SessionGuard` (déjà présent sur chaque page étudiante) le renvoie vers l'équivalent de son espace (`cheminFormateur`) ;
  - les pages du catalogue et de la leçon le renvoient vers son tableau de bord ou vers l'éditeur de sa formation.
- **Son espace gagne** `/formateur/communaute` (avec ses publications), `/formateur/profil`, `/formateur/notifications` et `/formateur/menu`. Les composants de la communauté prennent leurs adresses dans `lib/communaute/chemins.ts`.

**Tech Stack :** Next.js 16 (App Router, cacheComponents), Supabase/Postgres, Vitest, banc PGlite (`tests/db/banc.ts`).

**Spec :** `docs/superpowers/specs/2026-10-20-restructuration-design.md`, §4.

## Global Constraints

- Tous les textes sont en français. Refus de la base : « Un compte formateur ne suit pas de formation. » (errcode `42501`).
- Un membre de l'équipe n'est jamais formateur (0017). L'équipe garde la vue étudiant ; rien ne change pour elle.
- Les fonctions de la base sont en `security definer` avec `set search_path = ''`. La migration est rejouable (`create or replace`, `drop trigger if exists`).
- On ne lit ni ne crée `web/.env.local`. L'utilisateur applique lui-même la migration 0036.
- Les commits se terminent par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Au téléphone, les tailles restent compactes (`max-sm`), comme dans le reste de l'espace.

## Review Focus

1. **Un formateur qui tape une adresse étudiante à la main**, avec ou sans paramètres (`/accueil?espace=…`, `/communaute/publications/<id>`, `/formations/<slug>/lecons/<id>` d'une autre formation) : il atterrit dans son espace, jamais sur une page vide ou d'erreur. Testé en Task 2.
2. **Un ancien étudiant devenu formateur**, avec de la progression et des conversations côté étudiant : rien de son passé ne se rouvre, et `changer_role(…, 'etudiant')` le lui rend. Testé en Task 1.
3. **Un lien de notification vers une page étudiante** (`/evenements`, une publication) cliqué par un formateur : il passe par le même renvoi. Testé en Task 2 avec `cheminFormateur`.
4. **Un formateur sur sa propre leçon publiée :** aperçu, aucune progression, ni « Terminer la leçon » ni enregistrement de visite. Testé en Task 2.
5. **L'équipe et l'étudiant inchangés :** l'équipe garde « Espace étudiant » et sa progression, l'étudiant toutes ses actions. Testé en Task 1 (base) et Task 3 (menus).

---

### Task 1 : Migration 0036, la base ferme l'espace étudiant au formateur

**Files :**
- Create : `web/supabase/migrations/0036_formateur_sans_espace_etudiant.sql`
- Test : `web/tests/db/formateur-sans-espace-etudiant.test.ts`

**Interfaces :**
- Produces :
  - `public.acces_lecon(p_lecon uuid) returns boolean` : même définition qu'en 0027. La branche « leçon publiée » ajoute `and not public.a_role('formateur')`.
  - `public.refuser_compte_formateur() returns trigger` : lève « Un compte formateur ne suit pas de formation. » (`42501`) si `new.profil_id` a le rôle formateur. Déclencheurs `before insert or update`, un par table : `progression_lecons`, `favoris`, `avis`, `inscriptions_sessions`, `tentatives_quiz`, `rendus_exercices`.
  - `public.refuser_formateur_conversation() returns trigger` :
    - sur `conversations` (`before insert`), refuse si `new.etudiant_id` est formateur ;
    - sur `messages` (`before insert`), refuse si `new.de_etudiant` et que `new.auteur_id` est formateur. Même texte.
  - `public.notifier(uuid[], text, text, text, text, boolean)` : même définition qu'en 0018, plus le filtre `and not (p_categorie in ('sessions_live','nouveaux_contenus','rappels_apprentissage','recommandations','expiration_renouvellement') and exists (select 1 from public.roles r where r.profil_id = p.id and r.role = 'formateur'))`.

- [ ] **Step 1 : écrire le test qui échoue.** Banc : les migrations jusqu'à `0036_formateur_sans_espace_etudiant`, sur le modèle de `tests/db/messagerie.test.ts`. Comptes :
  - S, super admin ;
  - F, formateur de la formation A (payante, publiée, une leçon publiée) ;
  - G, formateur de la formation B (gratuite, publiée, une leçon publiée en aperçu) ;
  - E, étudiante ;
  - X, étudiant qui deviendra formateur.

  Tests :
  - `it("un formateur n'ouvre que ses formations")` :
    - `acces_lecon(leçon de B)` vaut false pour F et true pour E ;
    - `acces_lecon(leçon de A)` vaut true pour F.
  - `it("aucune action d'étudiant pour un formateur, ni par la base")` :
    - `select public.terminer_lecon(<leçon de A>)` en tant que F échoue avec « Un compte formateur ne suit pas de formation. » ;
    - un insert direct (superutilisateur) dans `favoris`, `inscriptions_sessions` et `conversations` (`etudiant_id = F`) avec F échoue avec le même texte.
  - `it("l'étudiante garde toutes ses actions")` : E termine la leçon de B, et son insert dans `favoris` passe.
  - `it("devenu formateur, le passé ne se rouvre pas ; redevenu étudiant, si")` :
    - X termine la leçon de B ;
    - `changer_role(X,'formateur')` par S : X ne peut plus terminer, et `acces_lecon(B)` vaut false ;
    - `changer_role(X,'etudiant')` : de nouveau vrai.
  - `it("les notifications d'apprentissage ne vont plus au formateur")` :
    - `notifier(array[F,E], 'sessions_live', 'T', '', '/evenements')` crée la notification de E seule ;
    - `notifier(array[F], 'messages', …)` crée celle de F.

- [ ] **Step 2 : lancer le test.** `npx vitest run tests/db/formateur-sans-espace-etudiant.test.ts`. Attendu : ÉCHEC (migration absente).
- [ ] **Step 3 : écrire `0036_formateur_sans_espace_etudiant.sql`** selon les Interfaces. Un `begin; … commit;`. Les `revoke execute` des nouvelles fonctions vont à `public, anon, authenticated`.
- [ ] **Step 4 : relancer le test.** Attendu : RÉUSSITE. Relancer aussi `tests/db/messagerie.test.ts` et `tests/db/sessions-live.test.ts`, qui doivent rester verts.
- [ ] **Step 5 : commit.** `feat(roles): migration 0036, un formateur n'agit plus comme un étudiant`

### Task 2 : Le formateur renvoyé vers son espace (règles, garde, connexion, catalogue, leçon)

**Files :**
- Create : `web/src/lib/auth/espace-formateur.ts`
- Modify :
  - `web/src/lib/auth/permissions.ts` (`canAccess`)
  - `web/src/lib/auth/require-space.ts`
  - `web/src/components/layout/SessionGuard.tsx`
  - `web/src/lib/auth/actions.ts` (connexion)
  - `web/src/app/auth/callback/route.ts`
  - `web/src/app/(app)/(etudiant)/profil/page.tsx`, `menu/page.tsx`, `abonnement/page.tsx` (garde)
  - `web/src/app/(catalogue)/formations/page.tsx`, `formations/[slug]/page.tsx`, `formations/[slug]/validation/page.tsx`
  - `web/src/app/(lecon)/formations/[slug]/lecons/[leconId]/page.tsx`
  - `web/src/lib/catalogue/apercu.ts` (export de `editeurFormation`)
  - `web/src/components/lecon/BandeauApercu.tsx` (aperçu `"formateur"`)
- Test :
  - `web/tests/auth/espace-formateur.test.ts`
  - `web/tests/auth/permissions.test.tsx`
  - `web/tests/layout/session-guard.test.tsx`
  - `web/tests/auth/sign-in.test.tsx`
  - les tests existants du catalogue et de la leçon qui en dépendent

**Interfaces :**
- Produces (`lib/auth/espace-formateur.ts`) :
  - `export function cheminFormateur(chemin: string): string`, où va un formateur qui demande `chemin` :
    - `/profil`, `/notifications` et `/menu` vont vers `/formateur/profil`, `/formateur/notifications` et `/formateur/menu` ;
    - `/messages` va vers `/formateur/messages` ;
    - `/communaute/publications/<id>` va vers `/formateur/communaute/publications/<id>` ;
    - une adresse déjà en `/formateur…` reste telle quelle ;
    - tout le reste va vers `/formateur`.
    - La recherche (`?…`) et l'ancre sont ignorées, sauf pour une adresse `/formateur…`.
  - `export function accueilDe(roles: Role[]): string` : `/formateur` pour un formateur, `/accueil` sinon.
  - `export async function rolesDuCompte(supabase: SupabaseClient): Promise<Role[]>` : lit la table `roles` du compte connecté ; renvoie `[]` en cas d'erreur.
- `canAccess("etudiant", roles)` vaut `!roles.includes("formateur")`. Les autres espaces sont inchangés.
- `requireSpace` refusé : `redirect(accueilDe(user.roles))`, au lieu de `/accueil`.
- `SessionGuard` : si le compte n'a pas l'espace étudiant, `redirect(cheminFormateur(chemin de l'en-tête EN_TETE_CHEMIN ?? "/accueil"))`.
- `type Apercu = "formation" | "lecon" | "formateur"`. Le texte de `"formateur"` : « Aperçu de votre leçon, telle que la voit un étudiant : votre progression n'est pas enregistrée. »
- `export async function editeurFormation(formationId: string): Promise<string | null>` (`lib/catalogue/apercu.ts`, désormais exporté).

- [ ] **Step 1 : écrire les tests qui échouent.**
  - `espace-formateur.test.ts` :
    - `cheminFormateur("/profil")` donne `"/formateur/profil"` ;
    - `cheminFormateur("/communaute/publications/abc")` donne `"/formateur/communaute/publications/abc"` ;
    - `cheminFormateur("/accueil")`, `cheminFormateur("/evenements")` et `cheminFormateur("/formations/excel/lecons/x")` donnent `"/formateur"` ;
    - `cheminFormateur("/formateur/sessions")` donne `"/formateur/sessions"` ;
    - `accueilDe(["etudiant","formateur"])` donne `"/formateur"`, et `accueilDe(["etudiant","admin"])` donne `"/accueil"`.
  - `permissions.test.tsx` :
    - `canAccess("etudiant", ["etudiant","formateur"])` vaut false ;
    - `canAccess("etudiant", ["etudiant","admin"])` vaut true ;
    - un formateur qui tape `/admin` va vers `/formateur`.
  - `session-guard.test.tsx` : un compte `["etudiant","formateur"]` sur `/communaute/publications/p1` reçoit `NEXT_REDIRECT:/formateur/communaute/publications/p1`, et sur `/accueil` `NEXT_REDIRECT:/formateur`.
  - `sign-in.test.tsx` :
    - un formateur connecté avec `next` absent va vers `/formateur` ;
    - avec `next=/profil`, vers `/formateur/profil` ;
    - un étudiant garde `/accueil`.
  - **Page leçon (formateur)**, avec le test existant de la page leçon ou un nouveau `tests/lecon/formateur.test.tsx` :
    - formation d'un autre (`lienModifierLecon` à null) : `NEXT_REDIRECT:/formateur` ;
    - sa formation : bandeau « Aperçu de votre leçon… », pas de bouton « Terminer la leçon ».
  - **Fiche** : un formateur va vers l'éditeur de sa formation (`/formateur/formations/<id>`), sinon vers `/formateur`. **Catalogue** `/formations` : `/formateur`.
- [ ] **Step 2 : lancer ces tests.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire le code** selon les Interfaces.
  - **Pages profil, menu et abonnement :** ajouter `<Suspense fallback={null}><SessionGuard /></Suspense>` (le menu peut aussi rediriger dans `MenuDuCompte`).
  - **Connexion et retour Google :** après la session ouverte, `rolesDuCompte`, puis `cheminFormateur(safeNext(next))` pour un formateur.
  - **Leçon :** pour un formateur, sans `lienModifier`, `redirect("/formateur")`. Sinon :
    - `apercu = apercu ?? "formateur"` ;
    - `actif = false` ;
    - `retour = "/formateur/formations"`.
- [ ] **Step 4 : relancer les tests et les suites touchées.** `npx vitest run tests/auth tests/layout tests/catalogue tests/lecon`. Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(roles): le formateur est renvoyé vers son espace`

### Task 3 : L'espace formateur, son menu, son en-tête, son profil et ses notifications

**Files :**
- Modify :
  - `web/src/lib/navigation.ts`
  - `web/src/components/layout/AppShell.tsx` et `AppHeader.tsx` (logo, loupe, compteurs)
  - `web/src/components/ui/ProfileMenu.tsx`
  - `web/src/components/layout/HeaderActions.tsx` (`allHref`)
  - `web/src/components/layout/MobileProfileMenu.tsx`
- Create :
  - `web/src/app/(app)/formateur/profil/page.tsx`
  - `web/src/app/(app)/formateur/notifications/page.tsx`
  - `web/src/app/(app)/formateur/menu/page.tsx`
- Test :
  - `web/tests/layout/menus-espaces.test.tsx`
  - `web/tests/ui/menus.test.tsx`
  - `web/tests/layout/pages.test.tsx`
  - `web/tests/layout/header-actions.test.tsx`
  - nouveau `web/tests/formateur/espace-compte.test.tsx`

**Interfaces :**
- Consumes : `canAccess`, `accueilDe` (Task 2).
- Produces :
  - **`MENUS.formateur` :** le groupe « Enseignement » se termine par `{ href: "/formateur/communaute", label: "Communauté", icon: UserGroupIcon }`.
  - **`NAV_BAS_PAR_ESPACE.formateur` :** « Profil » mène à `/formateur/menu`. L'équipe garde `/menu`.
  - **`export const NAV_MENU_FORMATEUR: NavEntry[]`**, les raccourcis de `/formateur/menu`, dans cet ordre :
    - Mon profil `/formateur/profil` ;
    - Notifications `/formateur/notifications` ;
    - Communauté `/formateur/communaute` ;
    - Messages `/formateur/messages` ;
    - Corrections `/formateur/corrections`.
  - **`MobileProfileMenu({ user, espace }: { user: ShellUser; espace?: "etudiant" | "formateur" })`** : en `"formateur"`, pas de tuiles série et points, la ligne d'état « Formateur·rice », les raccourcis `NAV_MENU_FORMATEUR`, ni « Espace formateur » ni « Back-office ».
  - **`ProfileMenu` :**
    - « Espace étudiant » et « Mon abonnement » seulement si `canAccess("etudiant", roles)` ;
    - « Mon profil » mène à `/formateur/profil` pour un formateur.
  - **`AppShell` transmet `espace` à `AppHeader`.** En `"formateur"` :
    - le logo mène à `/formateur` ;
    - ni loupe ni lien « Rechercher » du téléphone.
  - **`HeaderAccount` :** pas de compteurs série et points pour un formateur.
  - **`HeaderActions` :** passe `allHref="/formateur/notifications"` à `NotificationsPanel` pour un formateur.
  - **Pages :**
    - `/formateur/profil` reprend le contenu de `/profil` ;
    - `/formateur/notifications` reprend `ContenuNotifications` ;
    - `/formateur/menu` affiche `MobileProfileMenu espace="formateur"`.
    - Chacune appelle `requireSpace("formateur")`.

- [ ] **Step 1 : écrire les tests qui échouent.**
  - **Menus :**
    - menu formateur : « Tableau de bord », « Mes formations », « Corrections », « Sessions live », « Étudiants », « Messages », « Communauté » ;
    - barre du bas formateur : « Profil » vers `/formateur/menu` ;
    - `ProfileMenu` avec `["etudiant","formateur"]` : ni « Espace étudiant » ni « Mon abonnement », et « Mon profil » vers `/formateur/profil` ;
    - avec `["etudiant","admin"]` : « Espace étudiant » et « Back-office ».
  - **`MobileProfileMenu espace="formateur"`** : les 5 raccourcis dans l'ordre, pas de « Série d'apprentissage ».
  - **En-tête dans la coque formateur :**
    - lien du logo vers `/formateur` ;
    - pas de lien « Rechercher » ;
    - cloche : « Voir toutes les notifications » vers `/formateur/notifications`.
  - **Pages :** `/formateur/profil`, `/formateur/notifications` et `/formateur/menu` rendent leur contenu ; un étudiant y est renvoyé par `requireSpace`.
- [ ] **Step 2 : lancer les tests.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire le code** selon les Interfaces.
- [ ] **Step 4 : relancer.** `npx vitest run tests/layout tests/ui tests/formateur`. Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(formateur): son menu, son en-tête, son profil et ses notifications`

### Task 4 : La communauté dans l'espace formateur

**Files :**
- Create :
  - `web/src/lib/communaute/chemins.ts`
  - `web/src/app/(app)/formateur/communaute/page.tsx`
  - `web/src/app/(app)/formateur/communaute/publications/[id]/page.tsx`
- Modify :
  - `web/src/components/communaute/ContenuCommunaute.tsx`, `PageCommunaute.tsx`, `ColonneCommunaute.tsx`, `DetailPublication.tsx`, `PagePublication.tsx`
  - `web/src/components/layout/EspacesCommunaute.tsx`, `MenuTiroir.tsx`
  - `web/src/components/sessions/BlocSession.tsx`
- Test :
  - nouveau `web/tests/formateur/communaute.test.tsx`
  - les tests existants de la communauté et du tiroir

**Interfaces :**
- Produces (`lib/communaute/chemins.ts`) :
  ```ts
  export type EspaceCommunaute = "etudiant" | "formateur";
  export type CheminsCommunaute = { accueil: string; libelleAccueil: string; publication: (id: string) => string; evenements: string | null };
  export const CHEMINS_COMMUNAUTE: Record<EspaceCommunaute, CheminsCommunaute>;
  // etudiant  : accueil « /accueil », libellé « Accueil », publication « /communaute/publications/<id> », événements « /evenements »
  // formateur : accueil « /formateur/communaute », libellé « Communauté », publication « /formateur/communaute/publications/<id> », événements null
  export function espaceCommunauteDe(pathname: string | null): EspaceCommunaute; // « /formateur… » → formateur
  ```
- `ContenuCommunaute({ searchParams, espace = "etudiant" })` : en `"formateur"` :
  - le catalogue n'est pas lu ;
  - `nouvelles` et `disponibles` sont vides ;
  - le titre est « Communauté » ;
  - `sessionsAVenir` vaut false ;
  - la colonne n'a pas de « Prochaine session ».
- **Les composants client** (`PageCommunaute`, `DetailPublication`, `EspacesCommunaute`, `BlocSession`) prennent leurs adresses dans `CHEMINS_COMMUNAUTE[espaceCommunauteDe(usePathname())]`. `ColonneCommunaute` et `PagePublication` reçoivent `espace` en prop.
- **`BlocSession` :** si `evenements` est null, ni lien « Voir la session » ni inscription.
- **« Copier le lien »** (`outils.ts`, `lienPublication`) garde l'adresse étudiante : c'est elle qu'on partage, et le renvoi de la Task 2 l'adapte.
- **Le tiroir ≡** montre les espaces de la communauté aussi sur `/formateur/communaute` et ses publications. Ses liens mènent à `/formateur/communaute?espace=…`.
- **Les pages :**
  - `/formateur/communaute` : `requireSpace("formateur")`, puis `<ContenuCommunaute searchParams espace="formateur" />` ;
  - `/formateur/communaute/publications/[id]` : `requireSpace("formateur")`, puis `<PagePublication id espace="formateur" />`.

- [ ] **Step 1 : écrire les tests qui échouent** (`tests/formateur/communaute.test.tsx`), avec les lectures simulées comme dans les tests existants de la communauté :
  - en `espace="formateur"`, le titre est « Communauté » ;
  - aucune carte de formation, ni « Formations disponibles » ;
  - un lien de tendance mène à `/formateur/communaute/publications/<id>` ;
  - `listCatalogue` n'est pas appelé ;
  - la page publication du formateur a le fil d'Ariane « Communauté », vers `/formateur/communaute` ;
  - `espaceCommunauteDe("/formateur/communaute")` vaut `"formateur"`, et `espaceCommunauteDe("/accueil")` vaut `"etudiant"`.
- [ ] **Step 2 : lancer.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire le code** selon les Interfaces.
- [ ] **Step 4 : relancer.** `npx vitest run tests/formateur tests/communaute tests/layout tests/sessions`. Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(formateur): la communauté dans son espace`

### Task 5 : Guide, vérifications complètes, navigateur

**Files :**
- Modify : `docs/guides/ce-qui-te-revient.md` (nouvelle section 43 : appliquer la 0036 et valider R1)

- [ ] **Step 1 : écrire la section 43 du guide.**
  - **Appliquer la 0036** après la 0035.
  - **Avec le compte formateur de test :**
    - arrivée sur le tableau de bord ;
    - `/formations`, `/accueil` et la leçon d'un autre tapés à la main ;
    - publier dans « Communauté » ;
    - « Voir comme un étudiant » sur l'une de ses leçons ;
    - profil et notifications ;
    - au téléphone, l'onglet Profil.
  - **Avec un compte admin :** « Espace étudiant » est toujours là.
- [ ] **Step 2 : vérifier.** Suite complète, `npm run lint`, `npx tsc --noEmit` et `npm run build`. Attendu : tout vert.
- [ ] **Step 3 : vérifier dans le navigateur** avec une page d'essai temporaire, jamais commitée : le menu formateur avec « Communauté », et le menu Profil du téléphone à 375 px. Puis supprimer la page, arrêter le serveur, vider `.next/dev/cache` et relancer.
- [ ] **Step 4 : commit.** `docs(guide): section 43, le formateur sans espace étudiant`
