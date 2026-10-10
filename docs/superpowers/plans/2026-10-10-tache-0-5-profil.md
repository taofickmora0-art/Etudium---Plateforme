# Tâche 0.5 — Profil : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur `/profil`, on modifie ses informations et sa photo, on choisit ses notifications, on change son mot de passe (les autres navigateurs sont déconnectés) et on peut supprimer son compte. Tout reste après rechargement.

**Architecture:**
- **Page.** `/profil` est une page de l'espace connecté. Son titre est statique ; le contenu, lu par `getProfile()`, arrive sous `<Suspense>`.
- **Onglets.** Les trois onglets (`SegmentedTabs`) sont des composants client dans `web/src/components/profile/`. Ils appellent les actions serveur de `web/src/lib/profile/actions.ts`, qui valident avec Zod (`lib/profile/schemas.ts`), vérifient la session et écrivent dans Supabase.
- **Base.** Les écritures sont limitées par la base elle-même (droits par colonne, migration 0002).
- **Coque.** Elle lit désormais la session par `getUser()` : une session fermée ailleurs (changement de mot de passe, suppression) ne rouvre plus l'espace connecté. Une route `/auth/sortie` efface alors la session de l'appareil.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents`, actions serveur, `refresh()` de `next/cache`), React 19, `@supabase/ssr` 0.12 (Auth, Storage, RPC), Zod 4, composants des tâches 0.2 à 0.4, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-10-lot-0-fondations-design.md` (§4 ligne `/profil`, §6, §7 « Changer de mot de passe », §8 ligne 0.5, §9 décision 1).

**Source des valeurs visuelles :** artefact « Étudium — Nouveau design », `project/NdProfil.dc.html` (onglets, cartes, fenêtres), `NdProfilEnregistre` (notification), `NdMotDePasseModifie`, `NdProfilSuppression`. Il n'y a pas d'écran téléphone dédié : la page s'empile sous 1024 px, dans la coque de la 0.3.

## Global Constraints

- **Secrets.** Le code ne lit que `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. La suppression de compte passe par une fonction SQL `security definer`, jamais par une clé secrète.
- **Base.** Chacun lit et modifie uniquement son propre profil (spec §6). La base l'impose par RLS et par des droits d'écriture colonne par colonne. L'utilisateur applique `0002_profil.sql` dans l'éditeur SQL.
- **Photos.** JPG ou PNG, 2 Mo maximum (spec §6), vérifiés à l'envoi par la signature du fichier, pas par son nom.
- **Mot de passe.**
  - Le changer vérifie d'abord le mot de passe actuel, puis déconnecte les autres appareils (spec §7).
  - 8 caractères minimum.
- **Suppression.** Confirmée en saisissant « SUPPRIMER » (spec §4). Le texte de la fenêtre ne promet rien sur les certificats : ils n'existent pas avant le lot 3 (spec §9, décision 1).
- **Textes.** Ceux du design, mot pour mot, sauf ceux qu'une ligne « Ruling » du plan modifie. Messages d'erreur en français, sans jargon.
- **Cache Components.** Toute lecture de session est sous `<Suspense>`. `refresh()` est appelé après une modification visible dans la coque (nom, photo).
- **Mode démonstration.** Sans base configurée, en développement, `/profil` s'affiche avec les données des écrans du design. Les envois y échouent avec le message générique.
- **Habitudes.** Fidélité au design, accessibilité, zones tactiles, tests d'abord, et commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Compte Google sans mot de passe** : l'onglet Sécurité ne demande pas un « mot de passe actuel » qui n'existe pas ; il l'explique. → Task 8.
- **Fichier piège** (texte renommé en `.jpg`, image de plus de 2 Mo, photo HEIC d'iPhone) : message clair, rien n'est envoyé ni enregistré. → Task 6.
- **L'autre navigateur après un changement de mot de passe** : il est renvoyé à la connexion dès sa page suivante, pas une heure plus tard à l'expiration du jeton. → Tasks 3 et 8.
- **Interrupteurs actionnés vite** : c'est le dernier état qui est enregistré ; en cas d'échec, l'interrupteur revient en arrière et le dit. → Task 7.
- **`/profil` sans session** : renvoi à la connexion. La page quitte la liste des pages « Bientôt disponible », qui servait aussi à protéger les routes. → Task 4.

---

### Task 1: Base de données (migration 0002)

**Files:**
- Create: `web/supabase/migrations/0002_profil.sql`
- Test: `web/tests/db/migration-0002.test.ts` (lecture du texte SQL, comme `migration.test.ts`)

**Interfaces:**
- Produces:
  - **Droits d'écriture.** `revoke update on public.profils from authenticated, anon;` puis `grant update (prenom, nom, telephone, pays, niveau_etudes, etablissement, filiere, objectifs, photo_url, preferences_notifications) on public.profils to authenticated;`. `id`, `cree_le` et `modifie_le` deviennent non modifiables (corrige le mineur différé de la 0.4).
  - **Contraintes de longueur.** Contraintes nommées `profils_*_longueur`, chacune créée dans un bloc `do $$ … exception when duplicate_object then null; end $$` :
    - `telephone` ≤ 30, `pays` ≤ 60, `niveau_etudes` ≤ 60 ;
    - `etablissement` ≤ 120, `filiere` ≤ 120 ;
    - `objectifs` ≤ 500, `photo_url` ≤ 500.
    - Plus `profils_preferences_objet` : `jsonb_typeof(preferences_notifications) = 'object'`.
  - **Photos publiques.** `update storage.buckets set public = true where id = 'photos-profil';` Les photos sont lisibles par leur adresse ; les noms de fichier sont aléatoires et la liste du dossier reste réservée à son propriétaire.
  - **Suppression du compte.** `public.supprimer_mon_compte() returns void` :
    - déclarée `language plpgsql security definer set search_path = ''` ;
    - lève `exception 'non connecté'` si `auth.uid()` est nul, puis exécute `delete from auth.users where id = (select auth.uid());` (profil et rôles suivent par `on delete cascade`) ;
    - `revoke execute … from public, anon;` puis `grant execute … to authenticated;`.

- [ ] **Step 1: Écrire les tests**
  - `personne ne peut modifier id, cree_le ni modifie_le` : le `grant update (…)` existe et sa liste exclut `id`, `cree_le` et `modifie_le` ; le `revoke update` est présent.
  - `la suppression ne touche que le compte connecté` : contient `security definer`, `set search_path = ''`, `where id = (select auth.uid())`, `revoke execute on function public.supprimer_mon_compte() from public, anon`.
  - `les photos sont lisibles par leur adresse` : `public = true` pour `photos-profil`.
  - `le fichier est rejouable` : chaque `add constraint` est dans un bloc qui ignore `duplicate_object` ; la fonction est créée avec `create or replace`.
- [ ] **Step 2:** `npx vitest run tests/db/migration-0002.test.ts` → FAIL (fichier absent).
- [ ] **Step 3:** Écrire `0002_profil.sql` (en-tête comme 0001 : comment l'appliquer, rejouable).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(base): droits du profil, photos et suppression du compte`.

### Task 2: Règles du profil (listes, préférences, validation)

**Files:**
- Create: `web/src/lib/profile/options.ts`, `web/src/lib/profile/preferences.ts`, `web/src/lib/profile/schemas.ts`
- Test: `web/tests/profile/rules.test.ts`

**Interfaces:**
- Produces:
  - `options.ts` : `PAYS` et `NIVEAUX: { value: string; label: string }[]`.
    - `PAYS`, dans cet ordre : `benin` Bénin, `burkina_faso` Burkina Faso, `cameroun` Cameroun, `cote_ivoire` Côte d’Ivoire, `gabon` Gabon, `guinee` Guinée, `mali` Mali, `niger` Niger, `rdc` République démocratique du Congo, `senegal` Sénégal, `togo` Togo, `france` France, `autre` Autre pays.
    - `NIVEAUX` : `bts_dut` BTS / DUT, `licence_1` Licence 1, `licence_2` Licence 2, `licence_3` Licence 3, `master_1` Master 1, `master_2` Master 2, `doctorat` Doctorat, `jeune_diplome` Jeune diplômé(e), `autre` Autre.
    - `labelOf(list, value): string | null`.
  - `preferences.ts` :
    - `NOTIFICATION_CATEGORIES` : les 8 entrées `{ key, label, description }` du design, dans l'ordre :
      - `nouveaux_contenus` Nouveaux contenus / Nouvelles leçons dans vos parcours
      - `sessions_live` Sessions live / Programmation et rappels 1 h avant
      - `expiration_renouvellement` Expiration et renouvellement / Rappels avant la fin de votre abonnement
      - `exercices` Exercices / Corrections et remarques de vos formateurs
      - `rappels_apprentissage` Rappels d’apprentissage / Pour garder votre série active
      - `communaute` Communauté / Réponses et mentions dans vos publications
      - `recommandations` Recommandations / Formations suggérées selon votre progression
      - `annonces` Annonces / Nouveautés d’Étudium
    - `CHANNELS` : `canal_appli` Notifications dans l’appli, `canal_push` Notifications push.
    - `type PreferenceKey` (les 10 clés) ; `type NotificationPreferences = Record<PreferenceKey, boolean>`.
    - `readPreferences(raw: unknown): NotificationPreferences` : une clé absente ou non booléenne vaut `true`, les clés inconnues sont ignorées.
  - `schemas.ts` :
    - `profileSchema` : `prenom` et `nom` réutilisent les règles de l'inscription (rendre `nameSchema` exportable dans `lib/auth/schemas.ts`) ; `telephone` vide → `null`, sinon `/^[+0-9 ().-]{6,30}$/` ; `pays` et `niveau_etudes` ∈ valeurs des listes, ou vide → `null` ; `etablissement` et `filiere` ≤ 120 ; `objectifs` ≤ 500. Tout est nettoyé des espaces au bord, et une chaîne vide donne `null`.
    - `preferencesSchema` : `z.strictObject` des 10 clés booléennes.
    - `passwordChangeSchema` : `current` non vide, `password` = `passwordSchema`.

- [ ] **Step 1: Écrire les tests**
  - `les préférences manquantes sont activées` : `readPreferences({})` donne 10 clés à `true` ; `readPreferences({ recommandations: false, inconnue: false })` donne seulement `recommandations` à `false`, sans clé `inconnue` ; `readPreferences("x")` donne tout à `true`.
  - `le profil est nettoyé avant l'enregistrement` : `{ prenom: " Aïcha ", telephone: "", pays: "benin", objectifs: " " }` donne `prenom: "Aïcha"`, `telephone: null`, `objectifs: null`.
  - Messages d'erreur :

    | Saisie | Message |
    | --- | --- |
    | prénom `"   "` | « Entrez votre prénom. » |
    | téléphone `"abc"` | « Saisissez un numéro de téléphone valide. » |
    | téléphone `"+229 01 97 00 00 00"` | accepté |
    | pays `"atlantide"` | « Choisissez un pays de la liste. » |
    | niveau `"x"` | « Choisissez un niveau de la liste. » |
    | établissement de 121 caractères | « 120 caractères au maximum. » |
    | objectifs de 501 caractères | « 500 caractères au maximum. » |

  - `les préférences reçues sont complètes et booléennes` : `preferencesSchema` refuse une clé manquante, une valeur `"oui"` et une clé en trop.
  - `changer de mot de passe demande l'actuel` : `current: ""` donne « Saisissez votre mot de passe actuel. » ; `password: "court"` donne « Au moins 8 caractères. ».
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(profil): listes, préférences et règles de saisie`.

### Task 3: La coque vérifie la session auprès de Supabase ; photo dans la coque

**Files:**
- Modify: `web/src/lib/auth/current-user.ts`, `web/src/lib/demo-user.ts`, `web/src/app/(app)/layout.tsx`, `web/src/lib/auth/actions.ts` (`signOut` utilise le nouvel utilitaire), `web/src/lib/auth/require-space.ts` si la 0.6 est déjà faite (sans compte : `/auth/sortie` au lieu de `/connexion`, comme la mise en page)
- Create: `web/src/lib/auth/local-session.ts`, `web/src/app/auth/sortie/route.ts`
- Modify: `web/src/components/ui/Avatar.tsx`, `web/src/components/layout/AppHeader.tsx` (`HeaderAccount`), `web/src/components/layout/HeaderActions.tsx`, `web/src/components/ui/ProfileMenu.tsx`, `web/src/components/layout/MobileProfileMenu.tsx`
- Test: `web/tests/auth/current-user.test.ts` (mocks `getClaims` → `getUser`), `web/tests/auth/sortie.test.ts`, `web/tests/ui/avatar.test.tsx`

**Interfaces:**
- Consumes: `createClient`, `demoModeActive`, `DEMO_USER`, `REMEMBER_COOKIE`.
- Produces:
  - `getAuthUser = cache(async (): Promise<User | null>)` (type `User` de `@supabase/supabase-js`). Appelle `supabase.auth.getUser()`, qui interroge Supabase et voit les sessions fermées ailleurs. Une erreur ou l'absence de compte donne `null`. Partagé par `getShellUser` et `getProfile` : un seul appel par requête.
  - `getShellUser` se fonde sur `getAuthUser` : `email` = `user.email`, métadonnées = `user.user_metadata`. Il lit aussi `photo_url`. `ShellUser` gagne `photoUrl: string | null` (`DEMO_USER.photoUrl = null`).
  - `clearLocalSession(): Promise<void>` (`local-session.ts`, serveur) : efface les cookies `sb-*` et `REMEMBER_COOKIE`. Repris par `signOut` (même comportement qu'aujourd'hui).
  - `GET /auth/sortie` :
    - si `getUser()` trouve encore un compte, renvoie vers `/accueil` sans rien effacer (un lien piégé ne déconnecte personne) ;
    - sinon `clearLocalSession()` puis renvoi vers `/connexion?session=expiree`.
  - `(app)/layout.tsx` : sans compte, `redirect("/auth/sortie")` au lieu de `/connexion`. Sans cela, le proxy, qui voit encore un jeton valable, renverrait de `/connexion` vers `/accueil` en boucle.
  - `Avatar` :
    - prop `src?: string | null` : affiche `<img alt="" class="size-full rounded-full object-cover">` dans le rond, sinon les initiales ;
    - nouvelle taille `64` (`size-16 text-[23px]`) ;
    - `<img>` simple, avec `eslint-disable-next-line @next/next/no-img-element` et sa raison : photo déjà réduite à 512 px, servie par Supabase.
  - L'en-tête, le menu du profil et la page « Profil » du téléphone passent `photoUrl` à `Avatar`.
- Ruling à reporter au journal : `getShellUser` passe de `getClaims` (ruling de la Task 8 de la 0.4) à `getUser`.
  - **Raison.** La validation de la 0.5 exige que l'autre navigateur soit déconnecté ; `getClaims` ne voit pas une session fermée avant l'expiration du jeton (1 h).
  - **Coût.** Un aller-retour vers Supabase par page, dans la partie en `<Suspense>` : il ne retarde pas l'affichage de la page.
  - **Proxy.** Il garde `getClaims`.

- [ ] **Step 1: Écrire les tests**
  - `une session fermée ailleurs ne donne plus de compte` : `getUser` → `{ data: { user: null }, error: { code: "session_not_found", status: 403 } }` ; `getShellUser()` donne `null`.
  - `getShellUser lit le profil, les rôles et la photo` : `photoUrl` vaut la valeur de `photo_url`.
  - `une session encore valable n'est pas fermée par ce lien` (`/auth/sortie`) : la réponse renvoie vers `/accueil` et aucun cookie n'est effacé.
  - `une session fermée ailleurs est effacée de l'appareil` : les cookies `sb-projet-auth-token` et `etudium-souvenir` sont effacés ; la réponse renvoie vers `/connexion?session=expiree`.
  - `la photo remplace les initiales` : `<Avatar initials="AK" src="https://…/a.jpg" name="Aïcha Kpadé" />` contient une `img` ; sans `src`, le texte « AK » s'affiche.
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter ; adapter les tests existants qui simulaient `getClaims` pour `getShellUser`. **Step 4:** Suite entière → PASS.
- [ ] **Step 5: Commit** `feat(auth): la coque voit les sessions fermées ailleurs ; photo de profil`.

### Task 4: Page `/profil`, onglets et notifications

**Files:**
- Modify: `web/src/lib/pages-a-venir.ts` (retirer `profil`), `web/src/lib/auth/routing.ts` (`/profil` dans `ESPACE_CONNECTE`), `web/src/app/(app)/layout.tsx` (`ToastProvider` autour de la coque), `web/src/lib/demo-user.ts` (`DEMO_PROFILE`)
- Create: `web/src/lib/profile/data.ts`, `web/src/app/(app)/profil/page.tsx` (remplace la page « Bientôt disponible »), `web/src/components/profile/ProfileTabs.tsx`, `InformationsTab.tsx`, `NotificationsTab.tsx` et `SecurityTab.tsx` (dans `web/src/components/profile/`)
- Test: `web/tests/auth/session.test.ts`, `web/tests/layout/pages.test.tsx`, `web/tests/profile/page.test.tsx`

**Interfaces:**
- Consumes: `getAuthUser`, `readPreferences`, `SegmentedTabs`, `Heading`, `Lead`, `Skeleton`, `ToastProvider`.
- Produces:
  - `type ProfileData = { prenom; nom; email; telephone; pays; niveauEtudes; etablissement; filiere; objectifs; photoUrl; preferences: NotificationPreferences; hasPassword: boolean; googleLinked: boolean }`. Les champs texte facultatifs sont `string | null`.
  - `hasPassword` et `googleLinked` viennent de `user.identities` (fournisseurs `email` et `google`).
  - `getProfile = cache(async (): Promise<ProfileData | null>)`. En mode démonstration, il renvoie `DEMO_PROFILE` (les valeurs de `NdProfil`) :
    - téléphone « 01 97 00 00 00 », `benin`, `master_1` ;
    - « Université d’Abomey-Calavi », « Sociologie » ;
    - objectifs « Terminer mon mémoire avant juin et trouver un stage en communication digitale. » ;
    - `recommandations` et `annonces` désactivées ;
    - `hasPassword` et `googleLinked` à `true`.
  - **Page.**
    - `Heading level="page"` « Mon profil ».
    - `Lead` « Vos informations, vos préférences de notification et la sécurité de votre compte. ».
    - Sous `<Suspense fallback={<Skeleton …/>}>` : le chargeur appelle `getProfile()` ; s'il n'y a pas de compte, `redirect("/auth/sortie")`.
  - `ProfileTabs({ profile }: { profile: ProfileData })` :
    - onglets `SegmentedTabs` intitulés « Sections du profil », valeurs `informations` / `notifications` / `securite`, libellés « Informations » / « Notifications » / « Sécurité » ;
    - séparateur `h-px bg-separateur mt-5`, puis le contenu avec `mt-8`.
  - Chaque onglet est un composant `({ profile })`. Cette tâche n'en pose que le titre de la première carte ; les tâches 5, 7 et 8 les complètent.
- Ruling à reporter au journal : la colonne de droite de l'onglet Informations (« Mes certificats », « Gamification ») n'est pas reprise. Ces écrans arrivent aux lots 3 et 6. La carte Informations est limitée à `max-w-[680px]` pour garder les proportions du design.

- [ ] **Step 1: Écrire les tests**
  - `le profil est réservé aux comptes connectés` : `routeFor({ pathname: "/profil", signedIn: false, hadSession: false })` donne `/connexion?next=%2Fprofil`.
  - `le profil n'est plus une page à venir` : `PAGES_A_VENIR` n'a pas de clé `profil` ; ajuster le décompte des pages à venir dans `pages.test.tsx`.
  - `les trois sections du profil` : `<ProfileTabs profile={DEMO_PROFILE} />` affiche trois onglets ; « Informations » est sélectionné ; un clic sur « Sécurité » affiche son contenu.
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS ; dans le navigateur, en mode démonstration, `/profil` s'affiche à 1440, 390 et 320 px. Les onglets passent à la ligne s'il le faut, sans défilement horizontal.
- [ ] **Step 5: Commit** `feat(profil): page du profil et ses onglets`.

### Task 5: Onglet Informations

**Files:**
- Create: `web/src/lib/profile/actions.ts` (`"use server"`)
- Modify: `web/src/components/profile/InformationsTab.tsx`
- Test: `web/tests/profile/informations.test.tsx`

**Interfaces:**
- Consumes: `profileSchema`, `PAYS`, `NIVEAUX`, `FormState`, `IDLE`, `fieldErrorsFrom`, `authErrorMessage`, `useToast`, `Field`, `TextInput`, `Select`, `Textarea`, `Button`.
- Produces:
  - `updateProfile(prev: FormState, formData: FormData): Promise<FormState>`.
    - Valide, puis vérifie le compte par `getUser()`. Sans compte : `{ status: "error", message: "Votre session a expiré. Reconnectez-vous." }`.
    - `update` limité aux 8 colonnes du formulaire, `.eq("id", user.id)`. Erreur → message générique.
    - Succès → `refresh()` puis `{ status: "success", values }`. En erreur, `values` reprend aussi la saisie.
  - `sessionUser()` (non exporté) : client et `getUser()`. Les actions des tâches 6 à 9 le réutilisent.
  - **Carte** `rounded-carte border border-bordure-carte p-6`, avec un `gap` de 20 px :
    - l'emplacement de la photo (Task 6 ; ici l'`Avatar` 64 seul) ;
    - une grille de 2 colonnes (`repeat(auto-fill, minmax(min(100%, max(220px, calc((100% - 16px) / 2))), 1fr))`, `gap-4`) avec : Prénom, Nom, Adresse e-mail, Téléphone (`type="tel"`, `autoComplete="tel"`), Pays (`Select`, première option « Choisir… » vide), Niveau d’études (`Select`, idem), Établissement, Filière ;
    - en dessous, Objectifs d’apprentissage (`Textarea`, `rows={3}`) ;
    - « Enregistrer » (`Button size="md"`), aligné à droite.
  - Succès → `toast({ tone: "reussite", title: "Modifications enregistrées" })`.
- Ruling à reporter au journal : l'adresse e-mail est affichée en lecture seule (`readOnly`), avec l'aide « Utilisée pour vous connecter. ». La changer demande une confirmation par e-mail (modèle Supabase en plus) : ce sera une tâche à part si tu la veux.

- [ ] **Step 1: Écrire les tests**
  - `les informations sont enregistrées pour le compte connecté` : `update` reçoit `{ prenom: "Aïcha", nom: "Kpadé", telephone: null, pays: "benin", niveau_etudes: null, etablissement: null, filiere: null, objectifs: null }` ; `eq("id", "u1")` et `refresh` sont appelés.
  - `une saisie invalide n'écrit rien` : `prenom: ""` donne `fieldErrors.prenom` ; `update` n'est pas appelé.
  - `sans session, rien n'est écrit` : on obtient le message « Votre session a expiré. Reconnectez-vous. ».
  - `l'enregistrement est confirmé` : le formulaire est rendu avec un `ToastProvider`, l'action simulée réussit, et « Modifications enregistrées » s'affiche ; le champ « Adresse e-mail » est en lecture seule.
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(profil): modifier ses informations`.

### Task 6: Photo de profil

**Files:**
- Create: `web/src/lib/profile/photo.ts` (fonctions pures), `web/src/lib/profile/resize-photo.ts` (navigateur), `web/src/components/profile/PhotoPicker.tsx`
- Modify: `web/src/lib/profile/actions.ts` (`updatePhoto`), `web/src/components/profile/InformationsTab.tsx`, `web/next.config.ts` (`experimental.serverActions.bodySizeLimit: "3mb"`)
- Test: `web/tests/profile/photo.test.ts`

**Interfaces:**
- Produces:
  - `PHOTO_MAX_OCTETS = 2 * 1024 * 1024`.
  - `detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | null` : signatures `FF D8 FF` (JPEG) et `89 50 4E 47 0D 0A 1A 0A` (PNG).
  - `squareCrop(width: number, height: number, max = 512): { sx: number; sy: number; side: number; size: number }` : carré centré.
  - `resizePhoto(file: File): Promise<File>` : `createImageBitmap`, canvas, `squareCrop`, JPEG de qualité 0,85, nom `photo.jpg`. En cas d'échec (format illisible), il rend le fichier d'origine.
  - `updatePhoto(prev: FormState, formData: FormData): Promise<FormState>` :
    - champ `photo` absent ou vide → « Choisissez une image JPG ou PNG. » ;
    - plus de 2 Mo → « Cette image dépasse 2 Mo. Choisissez-en une plus légère. » ;
    - signature inconnue → « Choisissez une image JPG ou PNG. » ;
    - sinon envoi dans `photos-profil` sous `${user.id}/${crypto.randomUUID()}.jpg|png` (`contentType`, `upsert: false`, `cacheControl: "31536000"`), puis `photo_url` = `getPublicUrl(...)`, puis suppression des autres fichiers du dossier, puis `refresh()` ;
    - échec de l'envoi → « La photo n’a pas pu être enregistrée. Réessayez. ».
  - `PhotoPicker({ initials, photoUrl })` :
    - `Avatar` 64 ;
    - bouton « Changer la photo » (`variant="contour" size="sm"`), qui ouvre un `<input type="file" accept="image/jpeg,image/png">` caché ;
    - aide « JPG ou PNG, 2 Mo maximum. », remplacée par l'erreur (rôle `alert`) s'il y en a une ;
    - même contrôle du type et de la taille dans le navigateur avant l'envoi, puis `resizePhoto`, puis l'action ;
    - succès → `toast({ tone: "reussite", title: "Photo mise à jour" })`.
- Ruling à reporter au journal : la photo est réduite à 512 px dans le navigateur avant l'envoi (environ 80 Ko au lieu de 2 Mo), pour les connexions mobiles. Le serveur accepte quand même un original de 2 Mo si la réduction échoue.

- [ ] **Step 1: Écrire les tests**
  - `seuls les vrais JPG et PNG sont reconnus` : les octets JPEG et PNG sont reconnus ; GIF `47 49 46 38`, `"bonjour"` encodé et un tableau vide donnent `null`.
  - `le recadrage garde le centre` :
    - `squareCrop(1200, 800)` donne `{ sx: 200, sy: 0, side: 800, size: 512 }` ;
    - `squareCrop(300, 400)` donne `{ sx: 0, sy: 50, side: 300, size: 300 }`.
  - `une image trop lourde est refusée sans envoi` : `upload` n'est pas appelé.
  - `un texte renommé en .jpg est refusé`.
  - `la nouvelle photo remplace l'ancienne` :
    - `upload` reçoit un chemin `u1/…​.jpg` et `contentType: "image/jpeg"` ;
    - `update` reçoit `{ photo_url: <publicUrl> }` ;
    - `remove` reçoit `["u1/ancienne.jpg"]` et pas le nouveau fichier ;
    - `refresh` est appelé.
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(profil): photo de profil`.

### Task 7: Onglet Notifications

**Files:**
- Modify: `web/src/lib/profile/actions.ts` (`updatePreferences`), `web/src/components/profile/NotificationsTab.tsx`
- Test: `web/tests/profile/notifications.test.tsx`

**Interfaces:**
- Consumes: `NOTIFICATION_CATEGORIES`, `CHANNELS`, `preferencesSchema`, `Switch`, `Tag`, `useToast`.
- Produces:
  - `updatePreferences(prefs: NotificationPreferences): Promise<{ ok: boolean }>` : valide, vérifie la session, puis `update({ preferences_notifications: prefs })`. Pas de `refresh()`, car rien ne change dans la coque.
  - **Carte de gauche** (`p-6 pb-3`) :
    - h2 « Préférences de notification » (20/28, 600) ;
    - texte « Choisissez ce que vous voulez recevoir. Les messages importants (paiement, sécurité) restent envoyés par e-mail. » ;
    - 8 lignes séparées par `h-px bg-bordure-carte` : libellé (15/22, 500), description (13/20, `text-discret`), et `Switch` dont le nom accessible est le libellé.
  - **Carte de droite** (`p-5 pb-2`, `flex: 1 1 300px`) :
    - h3 « Canaux » ;
    - deux lignes avec interrupteur ;
    - une ligne « E-mail » / « Pour les messages importants », avec un `Tag` « Toujours actif » (fond `fond-doux`, texte `ardoise-fonce`).
  - **Comportement d'un interrupteur.**
    - Le changement s'affiche tout de suite.
    - Les enregistrements partent un par un, toujours avec le dernier état : un envoi en cours est suivi d'un seul envoi de l'état le plus récent.
    - En cas d'échec, retour au dernier état enregistré et `toast({ tone: "erreur", title: "La modification n’a pas été enregistrée.", description: "Vérifiez votre connexion, puis réessayez." })`.
    - Pas de notification en cas de succès : l'interrupteur suffit.

- [ ] **Step 1: Écrire les tests**
  - `les préférences sont enregistrées en entier` : `update` reçoit l'objet des 10 clés ; un objet invalide donne `{ ok: false }` sans `update`.
  - `un interrupteur enregistre son nouvel état` : un clic sur « Recommandations » appelle `updatePreferences` avec `recommandations` inversé.
  - `deux clics rapides : le dernier état est enregistré` : le premier envoi reste en attente ; après lui, un seul envoi qui contient les deux changements.
  - `un échec remet l'interrupteur et le dit` : l'action renvoie `{ ok: false }` ; l'interrupteur revient à son état ; le message s'affiche.
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(profil): préférences de notification`.

### Task 8: Onglet Sécurité — mot de passe et Google

**Files:**
- Modify: `web/src/lib/profile/actions.ts` (`changePassword`), `web/src/components/profile/SecurityTab.tsx`
- Test: `web/tests/profile/security.test.tsx`

**Interfaces:**
- Consumes: `passwordChangeSchema`, `PasswordInput`, `Field`, `Dialog`, `IconTile`, `Tag`, icônes `LockPasswordIcon` et `GoogleIcon`.
- Produces:
  - `changePassword(prev: FormState, formData: FormData): Promise<FormState>`, dans l'ordre :
    1. valider, puis `getUser()` (pour l'e-mail) ;
    2. `signInWithPassword({ email, password: current })` ; en cas d'erreur `invalid_credentials` : `fieldErrors.current` = « Le mot de passe actuel est incorrect. » ;
    3. `updateUser({ password })` ; une erreur passe par `authErrorMessage` (« différent de l’ancien », etc.) ;
    4. `signOut({ scope: "others" })` ;
    5. `{ status: "success" }`.
  - **Colonne de gauche.**
    - Carte « Mot de passe » (h2), texte « Après la mise à jour, les autres appareils seront déconnectés. ».
      - Grille de 2 colonnes :
        - « Mot de passe actuel » : `name="current"`, `autoComplete="current-password"` ;
        - « Nouveau mot de passe » : `name="password"`, `autoComplete="new-password"`, aide « Au moins 8 caractères. ».
      - « Mettre à jour », aligné à droite.
      - Si `!profile.hasPassword`, la carte affiche à la place « Vous vous connectez avec Google : votre compte n’a pas de mot de passe Étudium. ».
    - Si `profile.googleLinked`, carte (`px-6 py-[18px]`) : `IconTile` 44 `GoogleIcon`, « Connexion avec Google », « Associée à {email} », `Tag` « Active » (ton `valide`).
  - **Succès.**
    - `Dialog` : icône `LockPasswordIcon`, ton `reussite`, titre « Mot de passe mis à jour », texte « Cet appareil reste connecté. Les autres appareils ont été déconnectés. », bouton « Compris ».
    - Le formulaire se vide.
  - **Colonne de droite** (`flex: 1 1 300px`) : réservée à la Task 9.
- Ruling à reporter au journal : le texte de la fenêtre devient « Cet appareil reste connecté » au lieu de « Vous restez connectée ». Le design accorde au féminin (Aïcha) ; on ne connaît pas le genre de la personne.

- [ ] **Step 1: Écrire les tests**
  - `un mot de passe actuel faux est signalé sans rien changer` : `fieldErrors.current` vaut « Le mot de passe actuel est incorrect. » ; `updateUser` n'est pas appelé.
  - `le nouveau mot de passe déconnecte les autres appareils` : appels dans l'ordre `signInWithPassword`, `updateUser({ password: "nouveaumdp" })`, `signOut({ scope: "others" })`.
  - `un nouveau mot de passe identique est refusé clairement` : `same_password` donne « Choisissez un mot de passe différent de l’ancien. ».
  - `la réussite est confirmée` : la fenêtre « Mot de passe mis à jour » s'ouvre.
  - `un compte Google sans mot de passe n'a pas de formulaire` : `hasPassword: false` ; pas de champ « Mot de passe actuel » ; l'explication s'affiche.
  - `le compte Google associé est indiqué` : on voit « Associée à aicha.k@exemple.com » et « Active ».
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(profil): changer de mot de passe`.

### Task 9: Supprimer son compte

**Files:**
- Modify: `web/src/lib/profile/actions.ts` (`deleteAccount`), `web/src/components/profile/SecurityTab.tsx`, `web/src/components/auth/FromAddress.tsx` (`SignInNotices` : `compte=supprime`)
- Create: `web/src/components/profile/DeleteAccountCard.tsx`
- Test: `web/tests/profile/delete-account.test.tsx`, `web/tests/auth/address-params.test.tsx`

**Interfaces:**
- Consumes: `clearLocalSession`, `loadFullPage`, `TypedConfirmDialog`, `Button variant="dangerDoux"`, `Delete02Icon`.
- Produces:
  - `deleteAccount(): Promise<void>`. Il lève une erreur en cas d'échec, pour que la fenêtre affiche son message.
    1. `getUser()` (sans compte : erreur) ;
    2. `storage.from("photos-profil").list(user.id)` puis `remove(...)` de tous les fichiers, s'il y en a ;
    3. `rpc("supprimer_mon_compte")` (erreur : on lève) ;
    4. `clearLocalSession()`.
  - **Carte** (`p-5`, `gap-3.5`) :
    - h3 « Supprimer mon compte » ;
    - texte « Cette action est définitive. Vos formations, votre progression et vos certificats seront supprimés. » ;
    - bouton « Supprimer mon compte » (`dangerDoux`, `self-start`).
  - **Fenêtre** `TypedConfirmDialog` :
    - `confirmWord="SUPPRIMER"`, `tone="danger"`, `icon={Delete02Icon}`, `iconTone="danger"` ;
    - titre « Supprimer votre compte ? » ;
    - texte « Cette action est définitive. Vos informations, vos formations et votre progression seront supprimées. » ;
    - `confirmLabel="Supprimer mon compte"` ;
    - `onConfirm` : `await deleteAccount()` puis `loadFullPage("/connexion?compte=supprime")`.
  - `/connexion?compte=supprime` : `Banner tone="reussite"` « Votre compte a été supprimé. ».
- Ruling à reporter au journal : le texte de la fenêtre diffère du design. La phrase « les certificats déjà partagés ne pourront plus être vérifiés » est retirée : la spec §9 garde une trace des certificats, mais seulement à partir du lot 3.

- [ ] **Step 1: Écrire les tests**
  - `la suppression efface la photo puis le compte, puis la session de l'appareil` : `remove` est appelé avec les fichiers de `u1/`, puis `rpc("supprimer_mon_compte")`, puis les cookies `sb-*` sont effacés.
  - `si la base refuse, rien n'est effacé sur l'appareil et l'erreur remonte` : `rpc` renvoie une erreur ; `deleteAccount()` est rejetée ; les cookies restent.
  - `la suppression demande de saisir SUPPRIMER` : le bouton reste inactif avec `supprimer` ; il s'active avec `SUPPRIMER` ; après confirmation, `loadFullPage` est appelé avec `/connexion?compte=supprime`.
  - `la connexion confirme la suppression` : avec `compte=supprime`, on voit « Votre compte a été supprimé. » (rôle `status`).
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(profil): supprimer son compte`.

### Task 10: Guide de validation et vérification d'ensemble

**Files:**
- Modify: `docs/guides/ce-qui-te-revient.md` (section « Valider la tâche 0.5 »), `web/README.md` (page `/profil`)

- [ ] **Step 1: Rédiger la validation, pas à pas.**
  1. Appliquer `web/supabase/migrations/0002_profil.sql` dans **SQL Editor**, comme la 0001.
  2. Modifier ses informations, recharger : elles restent.
  3. Changer sa photo : elle apparaît dans l'en-tête et dans le menu du profil.
  4. Changer deux interrupteurs, recharger : ils restent.
  5. Se connecter dans deux navigateurs (Chrome et Edge). Changer le mot de passe dans le premier. Dans le second, cliquer sur n'importe quelle page : la connexion s'ouvre avec « Votre session a expiré ».
  6. Supprimer un compte de test (créé avec une autre adresse), et vérifier dans **Table Editor** qu'il a disparu.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit`, `npx eslint src tests`, `npm run build` → tout passe.
- [ ] **Step 3: Vérifier dans le navigateur.**
  - En mode démonstration, `/profil` à 1440, 390 et 320 px, avec les trois onglets, sans défilement horizontal.
  - En production (`web-production`, port 3100), `/profil` sans session renvoie vers `/connexion?next=%2Fprofil`.
- [ ] **Step 4: Commit** `docs: validation de la tâche 0.5`.

## Validation de la tâche 0.5 (par l'utilisateur)

Après `0002_profil.sql` :
- tes modifications (informations, photo, notifications) restent après rechargement ;
- le changement de mot de passe déconnecte ton autre navigateur dès sa page suivante ;
- la suppression d'un compte de test le fait disparaître de la base.
