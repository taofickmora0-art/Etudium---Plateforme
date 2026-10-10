# Tâche 0.4 — Inscription et connexion : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On crée un compte par e-mail (code à 6 chiffres valable 10 minutes), on se connecte (« Se souvenir de moi », Google), on retrouve l'accès par « Mot de passe oublié », on se déconnecte ; l'espace connecté n'est ouvert qu'aux comptes connectés et affiche le vrai prénom.

**Architecture:** Écrans de compte dans le groupe de routes `web/src/app/(auth)/` avec une mise en page commune (`components/auth/AuthLayout`). Les formulaires sont des composants client (`useActionState`) qui appellent des **actions serveur** (`web/src/lib/auth/actions.ts`) ; celles-ci valident avec Zod (`lib/auth/schemas.ts`), appellent Supabase Auth par le client serveur et traduisent les erreurs (`lib/auth/messages.ts`). Le **proxy** Next 16 (`web/src/proxy.ts`) rafraîchit la session et protège l'espace connecté. Les retours de Google et des liens reçus par e-mail passent par deux routes, `app/auth/callback` et `app/auth/confirm`. La base (profils, rôles) est décrite en SQL dans `web/supabase/migrations/`, que l'utilisateur applique lui-même dans l'éditeur SQL de Supabase.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents`, proxy, actions serveur), React 19 (`useActionState`), `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.117, Zod 4, composants des tâches 0.2 et 0.3, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-10-lot-0-fondations-design.md` (§3, §4, §6, §7, ligne 0.4 du §8).

**Source des valeurs visuelles :** artefact « Étudium — Nouveau design », fichiers `project/NdConnexion.dc.html`, `NdConnexionErreur`, `NdSessionExpiree`, `NdInscription`, `NdCodeVerification`, `NdMotDePasse`, `NdMotDePasseEnvoye`, `NdReinitialisation`, `NdMobConnexion`.

## Global Constraints

- Secrets : le code ne lit que `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Aucune clé secrète (Supabase, Resend, Google) dans le code, le dépôt ou la conversation : l'utilisateur les colle lui-même dans le tableau de bord Supabase.
- Aucune donnée personnelle dans une adresse (pas d'e-mail en paramètre d'URL) : l'adresse en attente de vérification voyage dans un cookie `httpOnly` de courte durée.
- Mot de passe : 8 caractères minimum. Code : 6 chiffres, valable 10 minutes. Renvoi du code : compte à rebours de **45 secondes** (réglage Supabase à faire correspondre).
- « Se souvenir de moi » coché : session de **30 jours** ; décoché : cookies de session, effacés à la fermeture du navigateur.
- « Mot de passe oublié » répond la même chose que le compte existe ou non (spec §4).
- Messages d'erreur en français, sans jargon technique, sans révéler si un compte existe.
- Avec `cacheComponents`, toute lecture de cookies ou de session dans un composant serveur est sous `<Suspense>`.
- Fidélité au design, accessibilité, zones tactiles et commits : comme les tâches 0.2 et 0.3 (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).

## Review Focus

- **Double envoi** : un double clic sur « Créer mon compte », « Se connecter » ou « Vérifier » n'envoie qu'une requête (bouton en chargement pendant l'action). → test dans Task 5.
- **Retour arrière et adresse directe** : un compte connecté qui ouvre `/connexion` va à `/accueil` ; un visiteur qui ouvre `/accueil` va à `/connexion` ; une session expirée mène à `/connexion?session=expiree`. → tests de la fonction de décision du proxy, Task 3.
- **Redirection ouverte** : un paramètre `next` venu de l'extérieur (`https://pirate.example`, `//pirate.example`) ne fait jamais sortir du site. → test dans Task 3.
- **Adresse saisie avec majuscules ou espaces** (`  Aicha.K@Exemple.com `) : elle est nettoyée avant l'envoi, et la même adresse sert à vérifier le code. → test dans Task 2.
- **Code demandé trop souvent** : Supabase refuse (limite d'envoi) ; l'écran le dit clairement au lieu d'une erreur muette. → test dans Task 2 (traduction de l'erreur).

---

### Task 1: Base de données (profils et rôles)

**Files:**
- Create: `web/supabase/migrations/0001_profils_roles.sql`, `web/tests/db/migration.test.ts`

**Interfaces:**
- Produces (SQL) : tables `public.profils` (colonnes du §6 de la spec : `id uuid` = `auth.users.id`, `prenom`, `nom`, `telephone`, `pays`, `niveau_etudes`, `etablissement`, `filiere`, `objectifs`, `photo_url`, `preferences_notifications jsonb` par défaut les 8 catégories à `true`, `cree_le`, `modifie_le`) et `public.roles` (`profil_id`, `role` parmi `etudiant`, `formateur`, `moderateur`, `admin`, `super_admin`, clé primaire sur les deux) ; type énuméré `public.role_etudium` ; fonction `public.creer_profil()` déclenchée après chaque insertion dans `auth.users` : crée le profil (prénom/nom depuis `raw_user_meta_data` : `prenom`/`nom`, ou `given_name`/`family_name` pour Google, ou `full_name` découpé) et le rôle `etudiant` ; fonction `public.a_role(r role_etudium)` ; RLS : chacun lit et modifie son profil ; chacun lit ses rôles ; seul `super_admin` insère ou supprime un rôle ; `admin` et `super_admin` lisent tous les profils ; espace de stockage `photos-profil` (privé, JPG/PNG, 2 Mo) avec règles « chacun son dossier `<id>/` ».
- Le fichier est rejouable sans erreur sur une base vide ; il commence par un commentaire disant de le coller dans *SQL Editor* de Supabase.

- [ ] **Step 1: Écrire le test** `migration.test.ts` (lecture du fichier, pas d'exécution : il n'y a pas de Postgres local) : le fichier contient `create table public.profils`, `create table public.roles`, `enable row level security` pour les deux tables, `create trigger` sur `auth.users`, `security definer` **et** `set search_path = ''` pour chaque fonction `security definer`, et ne contient ni `service_role` ni `sb_secret_`.
- [ ] **Step 2:** Lancer → FAIL (fichier absent).
- [ ] **Step 3:** Écrire la migration.
- [ ] **Step 4:** Test PASS.
- [ ] **Step 5: Commit** `feat(base): profils, rôles et règles d'accès`.

---

### Task 2: Règles de saisie et messages d'erreur

**Files:**
- Create: `web/src/lib/auth/schemas.ts`, `web/src/lib/auth/messages.ts`
- Test: `web/tests/auth/schemas.test.ts`, `web/tests/auth/messages.test.ts`

**Interfaces:**
- Produces:
  - `emailSchema` (nettoie espaces et majuscules ; message « Entrez une adresse e-mail valide. ») ; `passwordSchema` (8 caractères minimum ; « Au moins 8 caractères. ») ; `signUpSchema` `{ prenom, nom, email, password, conditions }` (prénom et nom requis, 50 caractères max : « Entrez votre prénom. » / « Entrez votre nom. » ; `conditions` doit valoir `"on"` : « Acceptez les conditions pour créer votre compte. ») ; `signInSchema` `{ email, password (non vide : « Entrez votre mot de passe. »), remember: boolean }` ; `codeSchema` (exactement 6 chiffres : « Saisissez les 6 chiffres du code. ») ; `newPasswordSchema` `{ password, confirmation }` (« Les deux mots de passe ne correspondent pas. ») ; `resetRequestSchema` `{ email }`.
  - `type FormState = { status: "idle" | "error" | "success"; message?: string; fieldErrors?: Partial<Record<string, string>>; values?: Record<string, string> }` et `fieldErrorsFrom(zodError)`.
  - `authErrorMessage(error: { code?: string; status?: number } | null): string` : `invalid_credentials` → « E-mail ou mot de passe incorrect. » ; `otp_expired` → « Ce code est incorrect ou a expiré. Demandez-en un nouveau. » ; `over_email_send_rate_limit`, `over_request_rate_limit` ou statut 429 → « Trop de demandes. Patientez une minute, puis réessayez. » ; `weak_password` → « Choisissez un mot de passe d’au moins 8 caractères. » ; `same_password` → « Choisissez un mot de passe différent de l’ancien. » ; `email_address_invalid` → « Cette adresse e-mail n’est pas acceptée. » ; `signup_disabled` → « Les inscriptions sont fermées pour le moment. » ; tout le reste → « Une erreur est survenue. Vérifiez votre connexion, puis réessayez. »
  - `safeNext(value: string | null | undefined, fallback = "/accueil"): string` : n'accepte qu'un chemin interne commençant par un seul `/` (refuse `//…`, `/\…`, `http…`).

- [ ] **Step 1: Écrire les tests** :
  - `l'adresse est nettoyée` : `emailSchema.parse("  Aicha.K@Exemple.com ")` → `"aicha.k@exemple.com"`.
  - `le mot de passe fait au moins 8 caractères` : `"1234567"` refusé avec « Au moins 8 caractères. ».
  - `les conditions sont obligatoires` : `signUpSchema` sans `conditions` → erreur sur `conditions`.
  - `le code fait 6 chiffres` : `"48291"` et `"48a913"` refusés, `"482913"` accepté.
  - `les deux mots de passe doivent correspondre`.
  - `les erreurs Supabase sont traduites` : un cas par code ci-dessus, plus `{ status: 429 }` et `null` → message générique.
  - `safeNext refuse les adresses extérieures` : `"https://pirate.example"`, `"//pirate.example"`, `"/\\pirate"` → `"/accueil"` ; `"/certificats"` → `"/certificats"`.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5: Commit** `feat(auth): règles de saisie et messages d'erreur`.

---

### Task 3: Session, « Se souvenir de moi » et proxy

**Files:**
- Create: `web/src/lib/auth/session-cookies.ts`, `web/src/lib/auth/routing.ts`, `web/src/proxy.ts`
- Modify: `web/src/lib/supabase/server.ts` (options de cookies)
- Test: `web/tests/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `REMEMBER_COOKIE = "etudium-souvenir"` ; `PENDING_EMAIL_COOKIE = "etudium-verification"` (adresse en attente, `httpOnly`, 30 minutes).
  - `withRememberChoice(options: CookieOptions, remember: boolean): CookieOptions` : si `remember`, `maxAge` = 30 jours ; sinon, retire `maxAge` et `expires` (cookie de session). Une suppression (`maxAge: 0`) reste une suppression.
  - `server.ts` : `setAll` applique `withRememberChoice` d'après le cookie `etudium-souvenir` (absent = `true`).
  - `routeFor({ pathname, signedIn, hadSession }): { redirect?: string }` : espace connecté (`/accueil`, `/menu` et toutes les clés de `PAGES_A_VENIR`, sous-pages comprises) sans session → `/connexion?session=expiree` si `hadSession` (un cookie `sb-…-auth-token` était présent), sinon `/connexion?next=<chemin>` ; `/connexion`, `/inscription`, `/verification-email`, `/mot-de-passe-oublie` avec session → `/accueil` ; `/` → `/accueil` ou `/connexion` ; le reste (`/nouveau-mot-de-passe`, `/auth/*`, `/vitrine`, `/etat`, fichiers) → rien.
  - `proxy.ts` : crée le client Supabase sur la requête (motif `@supabase/ssr` : `getAll` sur `request.cookies`, `setAll` qui recopie sur la réponse, avec `withRememberChoice`), appelle `supabase.auth.getUser()`, applique `routeFor`, et laisse passer le reste. `matcher` : tout sauf `_next/static`, `_next/image`, `favicon.ico` et les fichiers à extension.
- [ ] **Step 1: Écrire les tests** `session.test.ts` :
  - `se souvenir garde la session 30 jours` / `sans se souvenir, le cookie s'efface à la fermeture` / `une suppression reste une suppression`.
  - `un visiteur est renvoyé à la connexion` : `/certificats` sans session → `/connexion?next=%2Fcertificats`.
  - `une session expirée l'annonce` : `/accueil`, `hadSession: true` → `/connexion?session=expiree`.
  - `un compte connecté ne revoit pas la connexion` : `/connexion` avec session → `/accueil`.
  - `la racine oriente` : `/` → `/accueil` ou `/connexion`.
  - `la vitrine et les retours d'e-mail restent ouverts` : `/vitrine`, `/auth/confirm`, `/nouveau-mot-de-passe` → aucune redirection.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5: Commit** `feat(auth): session, « Se souvenir de moi » et pages protégées`.

---

### Task 4: Mise en page des écrans de compte

**Files:**
- Create: `web/src/components/auth/AuthLayout.tsx`, `web/src/components/auth/AuthAside.tsx`, `web/src/app/(auth)/layout.tsx`
- Test: `web/tests/auth/layout.test.tsx`

**Interfaces:**
- Produces:
  - `AuthLayout({ aside: "connexion" | "inscription" | "compte", back: { href: string; label: string }, children })` (NdConnexion) :
    - Ordinateur (`lg`) : page `min-h-dvh px-5 pb-5` ; en-tête `py-5 pr-1` avec le logo complet (pastille `bg-coque` 49 px, `pl-[9px] pr-4`, vers `/`) et le bouton gris « Retour… » (flèche `ArrowLeft02`, 20 px, trait 1.9) ; cadre `rounded-coque bg-coque p-5 gap-5` en ligne ; `AuthAside` (`flex: 1 1 400px`) ; `<main>` blanc `rounded-panneau` `p-[clamp(24px,4vw,56px)]`, contenu centré `max-w-[420px]`, colonne `gap-[18px]`.
    - Téléphone (NdMobConnexion) : en-tête `12px 16px` (logo 48×49 + « Étudium » 18/26 600) ; pas d'`AuthAside` ; panneau blanc `mx-2 rounded-t-panneau px-4 py-5`, qui occupe la hauteur restante.
  - `AuthAside({ variant })` : bannière bleue à trame de points (comme la 404), `p-[clamp(28px,4vw,56px)]`, pastille + phrase (`clamp(28px,3.2vw,42px)`, poids 500) :
    - `connexion` : « Formation · Pratique · Accompagnement » / « Les compétences qui comptent, pendant vos études et après. » ;
    - `inscription` : « Compte gratuit » / « Apprenez, pratiquez, faites-vous accompagner. » + 3 puces avec coche (« Des formations gratuites dès la création du compte », « Votre progression sauvegardée sur tous vos appareils », « Des certificats vérifiables par QR Code ») ;
    - `compte` : « Votre compte » / « Votre progression est enregistrée. » + « Vos formations, votre progression et vos certificats restent sur votre compte. » ;
    - en bas, l'illustration décorative (`aria-hidden`) : une `CourseCard` « Maîtriser Microsoft Excel » inclinée de -2° et la pastille « Certificat obtenu · Vérifiable par QR Code » inclinée de 2°.
  - `AuthHeading({ icon?, iconTone?, title, children })` : pastille 56 px `rounded-carte` (optionnelle), `<h1>` 32/38 poids 500 `tracking-[-0.025em]`, texte 15/24 discret, `mt-2.5`.
  - `(auth)/layout.tsx` : simple passe-plat (chaque page choisit sa variante et son lien retour).

- [ ] **Step 1: Écrire le test** `les écrans de compte ont un retour et un panneau` : rendre `AuthLayout aside="connexion" back={{ href: "/", label: "Retour au site" }}` → lien « Étudium, accueil » vers `/`, lien « Retour au site », `main` contenant les enfants, `complementary` (aside) avec « Les compétences qui comptent… » ; variante `inscription` → 3 éléments de liste.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** Test PASS ; vérification visuelle à 1440 px (mesures de NdConnexion) et 390 px (NdMobConnexion).
- [ ] **Step 5: Commit** `feat(auth): mise en page des écrans de compte`.

---

### Task 5: Connexion, Google et session expirée

**Files:**
- Create: `web/src/lib/auth/actions.ts` (actions `signIn`, `signInWithGoogle`), `web/src/components/auth/SignInForm.tsx`, `web/src/components/auth/GoogleButton.tsx`, `web/src/app/(auth)/connexion/page.tsx`, `web/src/app/auth/callback/route.ts`
- Test: `web/tests/auth/sign-in.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`signInSchema`, `authErrorMessage`, `safeNext`, `FormState`), Task 3 (`REMEMBER_COOKIE`, `PENDING_EMAIL_COOKIE`), Task 4 (`AuthLayout`, `AuthHeading`), `ui/Field`, `ui/TextInput`, `ui/PasswordInput`, `ui/Checkbox`, `ui/Button`, `ui/Banner`, `ui/Dialog`.
- Produces:
  - `signIn(prev: FormState, formData: FormData): Promise<FormState>` : valide ; pose `etudium-souvenir` ; `signInWithPassword` ; si `email_not_confirmed` → renvoie un code (`resend({ type: "signup" })`), pose `etudium-verification` et `redirect("/verification-email")` ; autre erreur → `{ status: "error", message, values: { email } }` (jamais le mot de passe) ; succès → `redirect(safeNext(next))`.
  - `signInWithGoogle(formData)` : `signInWithOAuth({ provider: "google", options: { redirectTo: <origine>/auth/callback?next=… } })` puis `redirect(data.url)` ; erreur → `redirect("/connexion?erreur=google")`.
  - `/auth/callback` (GET) : `exchangeCodeForSession(code)` puis redirection vers `safeNext(next)` ; échec → `/connexion?erreur=google`.
  - `SignInForm({ next })` (client, `useActionState`) : NdConnexion — e-mail, mot de passe (œil), « Se souvenir de moi » coché par défaut, lien « Mot de passe oublié ? », bouton principal pleine largeur 48 px « Se connecter » (chargement pendant l'action), séparateur « ou » (filets `separateur`, texte 13/20 discret), `GoogleButton` (contour, 48 px, icône `Google`), « Pas encore de compte ? Créer un compte ». Erreur : `Banner tone="erreur"` « **E-mail ou mot de passe incorrect.** Vérifiez vos identifiants, puis réessayez. » (NdConnexionErreur) au-dessus des champs.
  - `/connexion` : `AuthLayout aside="connexion" back={{ href: "/", label: "Retour au site" }}`, `AuthHeading` « Content de vous revoir » / « Connectez-vous pour reprendre votre apprentissage. » ; `?session=expiree` ouvre la fenêtre bloquante « Votre session a expiré » (NdSessionExpiree, icône `Time02`, bouton « Se reconnecter » qui la ferme) ; `?erreur=google` affiche « La connexion avec Google n’a pas abouti. Réessayez ou utilisez votre e-mail. ». La lecture de `searchParams` est sous `<Suspense>`.

- [ ] **Step 1: Écrire les tests** (`vi.mock("@/lib/supabase/server")` avec un faux `auth`, `vi.mock("next/headers")` pour les cookies, `vi.mock("next/navigation")` où `redirect` lève une erreur `NEXT_REDIRECT:<url>`) :
  - `de bons identifiants mènent à l'accueil` : `signIn` → redirection `/accueil` ; cookie `etudium-souvenir` = `"1"`.
  - `de mauvais identifiants l'annoncent sans renvoyer le mot de passe` : erreur `invalid_credentials` → `{ status: "error", message: "E-mail ou mot de passe incorrect." }` et `values` sans `password`.
  - `un compte non vérifié repart vers le code` : `email_not_confirmed` → `resend` appelé, redirection `/verification-email`.
  - `next ne fait pas sortir du site` : `next=https://pirate.example` → redirection `/accueil`.
  - `le formulaire ne s'envoie qu'une fois` : rendre `SignInForm` avec une action en attente, double clic sur « Se connecter » → action appelée une fois, bouton `aria-busy`.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** Tests PASS ; vérification visuelle de `/connexion`, de l'erreur et de `?session=expiree`.
- [ ] **Step 5: Commit** `feat(auth): connexion, Google et session expirée`.

---

### Task 6: Inscription et code de vérification

**Files:**
- Modify: `web/src/lib/auth/actions.ts` (actions `signUp`, `verifyCode`, `resendCode`), `web/src/components/ui/CodeInput.tsx` (emplacement d'erreur)
- Create: `web/src/components/auth/SignUpForm.tsx`, `web/src/components/auth/VerifyCodeForm.tsx`, `web/src/app/(auth)/inscription/page.tsx`, `web/src/app/(auth)/verification-email/page.tsx`
- Test: `web/tests/auth/sign-up.test.tsx`

**Interfaces:**
- Produces:
  - `signUp(prev, formData)` : valide ; `signUp({ email, password, options: { data: { prenom, nom } } })` ; pose `etudium-verification` = adresse ; `redirect("/verification-email")`. Si Supabase signale déjà un compte (utilisateur sans identité), même parcours (on ne révèle rien).
  - `verifyCode(prev, formData)` : lit l'adresse dans `etudium-verification` (absente → `redirect("/inscription")`) ; `verifyOtp({ email, token, type: "email" })` ; succès → efface le cookie, `redirect("/accueil")` ; erreur → message traduit.
  - `resendCode()` : `resend({ type: "signup", email })` → `{ status: "success", message: "Un nouveau code vous a été envoyé." }` ou erreur traduite.
  - `CodeInput` reçoit `error?: string` : message rouge avec icône sous les cases (comme `Field`), relié au groupe par `aria-describedby`, et cases en `aria-invalid`.
  - `SignUpForm` (NdInscription) : `GoogleButton` en haut, séparateur « ou avec votre e-mail », prénom et nom côte à côte (sur une colonne sous 640 px), e-mail, mot de passe (aide « Au moins 8 caractères. »), case « J’accepte les conditions d’utilisation et la politique de confidentialité. » (liens vers `/conditions` et `/confidentialite` : pages publiques, hors de l'espace connecté, à créer ici avec un texte « Bientôt disponible, au lot 1 » et un lien de retour ; elles s'ouvrent dans un nouvel onglet pour ne pas perdre la saisie), bouton « Créer mon compte », « Déjà inscrit ? Se connecter ». Champs gardés en cas d'erreur, sauf le mot de passe.
  - `VerifyCodeForm({ email })` (NdCodeVerification) : pastille 56 px (icône `Mail01`, bleue), « Vérifiez votre adresse e-mail » / « Nous avons envoyé un code à 6 chiffres à **{email}**. Saisissez-le pour activer votre compte. », `CodeInput` (aide « Le code expire dans 10 minutes. »), bouton « Vérifier » (envoi automatique quand les 6 chiffres sont saisis), « Vous n’avez rien reçu ? Renvoyer le code dans 0:45 » : lien inactif pendant le compte à rebours de 45 s, puis actif ; après un renvoi, le compte à rebours repart. Lien retour de l'en-tête : « Modifier mon adresse » → `/inscription`.
- [ ] **Step 1: Écrire les tests** :
  - `l'inscription mène au code` : `signUp` valide → `signUp` Supabase appelé avec l'adresse nettoyée et `{ prenom, nom }`, cookie `etudium-verification` posé, redirection `/verification-email`.
  - `une saisie incomplète garde les champs sauf le mot de passe`.
  - `le bon code ouvre l'accueil` : `verifyOtp` reçoit `{ email, token: "482913", type: "email" }` → redirection `/accueil`.
  - `un mauvais code l'annonce` : `otp_expired` → message « Ce code est incorrect ou a expiré… ».
  - `le renvoi attend 45 secondes` : rendre `VerifyCodeForm` avec horloge simulée → « Renvoyer le code » désactivé avec « 0:45 », actif après 45 s.
  - `l'erreur du code est reliée aux cases` : `CodeInput error="Code incorrect."` → le groupe a une description accessible contenant ce texte.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** Tests PASS ; vérification visuelle (NdInscription, NdCodeVerification, téléphone).
- [ ] **Step 5: Commit** `feat(auth): inscription et code de vérification`.

---

### Task 7: Mot de passe oublié et nouveau mot de passe

**Files:**
- Modify: `web/src/lib/auth/actions.ts` (actions `requestReset`, `updatePassword`)
- Create: `web/src/components/auth/ResetRequestForm.tsx`, `web/src/components/auth/NewPasswordForm.tsx`, `web/src/app/(auth)/mot-de-passe-oublie/page.tsx`, `web/src/app/(auth)/nouveau-mot-de-passe/page.tsx`, `web/src/app/auth/confirm/route.ts`
- Test: `web/tests/auth/password.test.tsx`

**Interfaces:**
- Produces:
  - `requestReset(prev, formData)` : `resetPasswordForEmail(email, { redirectTo: <origine>/auth/confirm?next=/nouveau-mot-de-passe })` ; **toujours** `{ status: "success", values: { email } }`, sauf limite d'envoi (message traduit).
  - `/auth/confirm` (GET) : `verifyOtp({ type, token_hash })` puis redirection vers `safeNext(next)` ; échec → `/mot-de-passe-oublie?lien=expire` (« Ce lien a expiré. Demandez-en un nouveau. »).
  - `updatePassword(prev, formData)` : `newPasswordSchema` ; `updateUser({ password })` ; succès → `signOut({ scope: "others" })` puis `redirect("/accueil")` ; sans session (lien expiré) → message « Ce lien a expiré. Demandez-en un nouveau. ».
  - `ResetRequestForm` (NdMotDePasse → NdMotDePasseEnvoye) : avant envoi, pastille cadenas bleue, « Mot de passe oublié », champ e-mail, « Envoyer le lien », « Vous vous en souvenez ? Se connecter » ; après envoi, pastille verte (`Mail01`), « Vérifiez votre boîte de réception » / « Si un compte existe pour {email}, vous allez recevoir un lien pour choisir un nouveau mot de passe. Pensez à regarder dans les courriers indésirables. », bouton « Retour à la connexion » et bouton contour « Renvoyer le lien ».
  - `NewPasswordForm` (NdReinitialisation) : « Nouveau mot de passe » / « Choisissez un mot de passe que vous n’utilisez pas ailleurs. », deux champs mot de passe, « Enregistrer le mot de passe ».
  - Ces trois écrans : `aside="compte"`, retour « Retour à la connexion » → `/connexion`.
- [ ] **Step 1: Écrire les tests** :
  - `la réponse est la même que le compte existe ou non` : `resetPasswordForEmail` qui réussit et qui échoue avec `user_not_found` → même état `success`.
  - `la limite d'envoi est annoncée` : `over_email_send_rate_limit` → message « Trop de demandes… ».
  - `le nouveau mot de passe déconnecte les autres appareils` : `updatePassword` valide → `updateUser` puis `signOut({ scope: "others" })`, redirection `/accueil`.
  - `/auth/confirm refuse un next extérieur`.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** Tests PASS ; vérification visuelle.
- [ ] **Step 5: Commit** `feat(auth): mot de passe oublié et nouveau mot de passe`.

---

### Task 8: La coque passe sur le vrai compte ; déconnexion

**Files:**
- Create: `web/src/lib/auth/current-user.ts`, `web/src/app/etat/page.tsx` (l'ancienne page de départ, qui vérifie la connexion à la base)
- Modify: `web/src/app/(app)/layout.tsx`, `web/src/app/(app)/accueil/page.tsx`, `web/src/app/(app)/menu/page.tsx`, `web/src/components/layout/LogoutDialog.tsx`, `web/src/lib/auth/actions.ts` (action `signOut`), `web/src/app/page.tsx` (la racine ne sert plus qu'à rediriger, le proxy s'en charge ; garder un repli qui redirige vers `/connexion`)
- Delete: `web/src/lib/demo-user.ts` (et ses usages)
- Test: `web/tests/auth/current-user.test.ts`, mise à jour des tests de la coque

**Interfaces:**
- Produces:
  - `getShellUser(): Promise<ShellUser | null>` (serveur, `React.cache`) : `getUser()`, profil (`prenom`, `nom`) et rôles depuis la base ; repli sur `user_metadata` si le profil n'existe pas encore ; initiales calculées ; `serie` et `points` à 0 (gamification au lot 6) ; `formule` « Gratuite » (abonnements au lot 2) ; `statut` « Étudiant·e » (genre non connu).
  - `type ShellUser` déplacé dans `current-user.ts` (mêmes champs que `DEMO_USER`).
  - `(app)/layout.tsx` : la coque sous `<Suspense>` (repli : coque vide sans nom) ; sans utilisateur (cas théorique, le proxy redirige déjà) → `redirect("/connexion")`.
  - `/accueil` et `/menu` lisent `getShellUser()` sous `<Suspense>`.
  - `signOut()` (action) : `supabase.auth.signOut()`, efface `etudium-souvenir`, `redirect("/connexion")` ; `LogoutDialog` l'appelle à la place de `router.push("/")`.
  - `/etat` : la vérification « Base connectée » de la tâche 0.1, rendue accessible sans compte.

- [ ] **Step 1: Écrire les tests** :
  - `getShellUser lit le profil et les rôles` (client Supabase simulé) → prénom, nom, initiales « AK », rôles `["etudiant"]`.
  - `sans profil, getShellUser se rabat sur les données d'inscription`.
  - `la déconnexion ferme la session et mène à la connexion` : `signOut` → `auth.signOut` appelé, redirection `/connexion`.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter ; adapter les tests de la coque (tâche 0.3) à `ShellUser` sans `DEMO_USER`.
- [ ] **Step 4:** Suite entière verte.
- [ ] **Step 5: Commit** `feat(auth): la coque affiche le compte connecté ; déconnexion`.

---

### Task 9: Guide de branchement et vérification d'ensemble

**Files:**
- Create: `docs/guides/brancher-la-connexion.md`
- Modify: `docs/guides/ce-qui-te-revient.md` (renvoi vers ce guide), `web/README.md` (pages `/etat`, `/connexion`)

- [ ] **Step 1:** Rédiger le guide, pas à pas, en français, sans jamais demander de clé : (1) appliquer `0001_profils_roles.sql` dans *SQL Editor* et vérifier les deux tables ; (2) *Authentication → URL Configuration* : Site URL `http://localhost:3000`, Redirect URLs `http://localhost:3000/auth/callback` et `http://localhost:3000/auth/confirm` ; (3) *Authentication → Providers → Email* : confirmation obligatoire, longueur du mot de passe 8, durée du code 600 s, longueur du code 6 ; (4) *Authentication → Emails* : modèle « Confirm signup » qui affiche `{{ .Token }}` (texte fourni), modèle « Reset password » dont le lien est `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nouveau-mot-de-passe` (texte fourni) ; (5) *Authentication → Rate Limits* : 45 s entre deux e-mails ; (6) *SMTP* avec Resend (hôte `smtp.resend.com`, port 465, utilisateur `resend`, mot de passe = clé Resend collée par l'utilisateur, expéditeur sur son domaine vérifié) ; (7) Google : créer l'identifiant OAuth dans Google Cloud (URI de redirection `https://<projet>.supabase.co/auth/v1/callback`), coller l'ID et le secret dans *Providers → Google* ; (8) vérification : créer un compte, recevoir le code, se connecter, mot de passe oublié, Google.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit`, `npx eslint src tests`, `npm run build` → tout passe.
- [ ] **Step 3:** Navigateur, sans base branchée : `/connexion`, `/inscription`, `/verification-email` (sans cookie → retour à `/inscription`), `/mot-de-passe-oublie`, `/nouveau-mot-de-passe` s'affichent à 1440, 390 et 320 px, sans défilement horizontal ; `/accueil` sans session → `/connexion?next=%2Faccueil` ; un envoi de formulaire sans base affiche le message d'erreur générique au lieu de planter.
- [ ] **Step 4: Commit** `docs: guide de branchement de la connexion`.

## Validation de la tâche 0.4 (par l'utilisateur)

Après le guide `docs/guides/brancher-la-connexion.md` : tu crées un compte avec ton e-mail, tu reçois le code, tu te connectes, tu te déconnectes, tu réinitialises ton mot de passe, tu te connectes avec Google, et `/accueil` te dit « Bonjour, [ton prénom] ».
