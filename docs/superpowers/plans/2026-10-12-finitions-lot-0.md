# Finitions du lot 0 : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Régler, avant le lot 1, les petits défauts relevés par les relectures des tâches 0.4 à 0.6 qui toucheraient de vrais utilisateurs ou bloqueraient les lots suivants.

**Architecture:** Corrections ciblées, chacune avec un test qui échoue d'abord, sans nouvel écran. Les changements de base sont réunis dans une migration `0003_finitions.sql`, que l'utilisateur applique comme les précédentes.

**Tech Stack:** Next.js 16.4, `@supabase/ssr`, Postgres (RLS), Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-10-lot-0-fondations-design.md`, lue avec les bilans `docs/superpowers/bilans/2026-10-10-tache-0-4.md`, `2026-10-10-tache-0-6.md` et `2026-10-12-tache-0-5.md`, sections « Petits défauts reportés ».

## Global Constraints

- **Comportement inchangé**, sauf les défauts corrigés ; aucun texte du design modifié.
- **Base.** Toute modification de la base passe par `web/supabase/migrations/0003_finitions.sql`, rejouable. Elle tient compte des données existantes : la base de test a déjà des comptes.
- **Secrets.** Comme toujours : seulement l'URL et la clé publique.
- **Habitudes.** Tests d'abord ; commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Adresse avec un point.** `/formations/python-3.12` (adresses du lot 1) doit être protégée comme les autres. Les vrais fichiers (images, icônes, manifeste) restent servis sans compte. → Task 1.
- **Cookie d'une connexion Google abandonnée.** Il ne doit plus faire afficher « Votre session a expiré » à un visiteur. → Task 1.
- **Retour après une session expirée ou un échec de Google.** On revient à la page demandée, pas à l'accueil. → Tasks 1 et 2.
- **Adresse de photo forgée.** Écrite directement par l'API, elle est refusée par la base. Les photos déjà enregistrées restent affichées. → Task 4.
- **Photo qui ne se charge pas.** On voit les initiales, pas une image cassée. → Task 3.

---

### Task 1: Proxy et routage

**Files:**
- Modify: `web/src/proxy.ts`, `web/src/lib/auth/routing.ts`, `web/src/app/etat/page.tsx`
- Test: `web/tests/auth/session.test.ts`, `web/tests/auth/proxy.test.ts`, `web/tests/pwa/manifeste.test.ts` (il garde le test de la 0.7)

**Interfaces:**
- Produces :
  - **Matcher** : exclut `_next/static`, `_next/image` et les chemins finissant par une extension de fichier statique : `ico|png|jpe?g|gif|webp|avif|svg|css|js|map|txt|xml|webmanifest|woff2?|ttf|pdf`. Il ne repose plus sur « tout ce qui contient un point ».
  - **`hasSessionCookie`** : reconnaît `/^sb-.+-auth-token(\.\d+)?$/` (morceaux compris), mais plus `…-auth-token-code-verifier`.
  - **`routeFor`** : une session expirée renvoie vers `/connexion?session=expiree&next=<page>`.
  - **`/etat`** : réservée au développement, comme la vitrine (`devOnlyPagesVisible`). En production, elle répond « page introuvable ».

- [ ] **Step 1: Écrire les tests**
  - `une adresse avec un point reste protégée` : le motif du matcher correspond à `/formations/python-3.12` et à `/certificats/ETU-2026.0042`, mais pas à `/icons/icone-192.png`, `/manifest.webmanifest`, `/icon.svg` ni `/_next/static/x.js`.
  - `le cookie d'une connexion Google abandonnée n'est pas une session` : `hasSessionCookie(["sb-projet-auth-token-code-verifier"])` est faux ; `hasSessionCookie(["sb-projet-auth-token.0"])` est vrai.
  - `une session expirée garde la page demandée` : `routeFor({ pathname: "/certificats", signedIn: false, hadSession: true })` donne `/connexion?session=expiree&next=%2Fcertificats`.
  - `l'état de l'application n'existe pas en ligne` : en production, `EtatPage()` lève `NEXT_NOT_FOUND` (même méthode que le test de la vitrine).
  - `le mode démonstration laisse tout passer` (proxy) : sans configuration, en développement, `/accueil` répond sans redirection.
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** Suite entière → PASS.
- [ ] **Step 5: Commit** `fix(auth): proxy et routage (adresses avec un point, retour à la page demandée)`.

### Task 2: Connexion

**Files:**
- Modify: `web/src/lib/auth/actions.ts` (`signInWithGoogle`), `web/src/components/auth/GoogleButton.tsx`, `web/src/app/auth/callback/route.ts`, `web/src/components/auth/VerifyCodeForm.tsx`
- Test: `web/tests/auth/sign-in.test.tsx`, `web/tests/auth/verify-form.test.tsx`

**Interfaces:**
- Produces :
  - **« Continuer avec Google »** sur la page de connexion :
    - le formulaire Google envoie le choix « Se souvenir de moi » du formulaire principal, par l'attribut `form` ou un champ synchronisé ;
    - `signInWithGoogle` pose `REMEMBER_COOKIE` (`"1"`/`"0"`) avant de partir chez Google ;
    - à l'inscription, il n'y a pas de case : `"1"` par défaut.
  - **Échec de Google** (action ou `/auth/callback`) : `/connexion?erreur=google&next=<next>`.
  - **Écran du code** : une ligne neutre « Vous avez déjà un compte ? Se connecter » (lien vers `/connexion`), sous « Renvoyer le code ». Elle ne dit pas si l'adresse a un compte.

- [ ] **Step 1: Écrire les tests**
  - `Google respecte « Se souvenir de moi »` : `signInWithGoogle(form({ next: "/accueil", remember: "0" }))` pose `etudium-souvenir=0`.
  - `un échec de Google garde la page demandée` : `signInWithOAuth` en erreur avec `next=/certificats` donne `NEXT_REDIRECT:/connexion?erreur=google&next=%2Fcertificats`.
  - `l'écran du code propose de se connecter` : le lien « Se connecter » pointe vers `/connexion`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `fix(auth): Google respecte « Se souvenir de moi » ; retour à la page demandée`.

### Task 3: Photo de profil plus solide

**Files:**
- Modify: `web/src/components/profile/PhotoPicker.tsx`, `web/src/lib/profile/resize-photo.ts`, `web/src/components/ui/Avatar.tsx`, `web/src/lib/profile/actions.ts`
- Test: `web/tests/profile/photo-picker.test.tsx`, `web/tests/ui/avatar.test.tsx`, `web/tests/profile/delete-account-action.test.ts`

**Interfaces:**
- Produces :
  - **Contrôle dans le navigateur.** `PhotoPicker` lit les 8 premiers octets (`file.slice(0, 8)`) et utilise `detectImageType` : un texte renommé en `.jpg` est refusé sans envoi.
  - **Accessibilité.** L'aide et l'erreur sont reliées au bouton par `aria-describedby`.
  - **Rotation.** `resizePhoto` passe `{ imageOrientation: "from-image" }` à `createImageBitmap` : une photo de téléphone prise de côté reste droite.
  - **Image qui ne se charge pas.** `Avatar` revient aux initiales (petit état client `onError`).
  - **Suppression du compte.** `deleteAccount` s'arrête (erreur) si la liste ou la suppression des photos échoue, au lieu de laisser une photo en ligne sans propriétaire.
  - **Cache.** `cacheControl` passe de un an à une semaine (`"604800"`).

- [ ] **Step 1: Écrire les tests**
  - `un texte renommé en .jpg est refusé dans le navigateur` : `updatePhoto` n'est pas appelé, et le message « Choisissez une image JPG ou PNG. » s'affiche.
  - `une photo qui ne se charge pas laisse place aux initiales` : `fireEvent.error(img)` fait apparaître « AK ».
  - `si les photos ne peuvent pas être effacées, le compte n'est pas supprimé` : quand `remove` échoue, `deleteAccount()` est rejeté et `rpc` n'est pas appelé.
  - `l'aide de la photo est annoncée avec le bouton` : le bouton « Changer la photo » a une description accessible qui contient « JPG ou PNG ».
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `fix(profil): photo plus solide (contrôle, rotation, repli, suppression)`.

### Task 4: Base, migration 0003

**Files:**
- Create: `web/supabase/migrations/0003_finitions.sql`, `web/src/lib/profile/photo-url.ts`
- Modify: `web/src/lib/profile/actions.ts` (`updatePhoto` enregistre le chemin), `web/src/lib/auth/current-user.ts` et `web/src/lib/profile/data.ts` (ils construisent l'adresse)
- Test: `web/tests/db/migration-0003.test.ts`, `web/tests/profile/photo.test.ts`, `web/tests/auth/current-user.test.ts`

**Interfaces:**
- Produces :
  - **`photo_url` contient le chemin**, `<id>/<uuid>.jpg|png`, et non plus l'adresse complète.
    - La migration convertit les lignes existantes : `regexp_replace(photo_url, '^.*/photos-profil/', '')`.
    - Elle ajoute la contrainte `profils_photo_chemin` : `photo_url is null or photo_url ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png)$')`.
  - **`photoPublicUrl(chemin: string | null): string | null`** (`photo-url.ts`) : `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-profil/${chemin}`, ou `null` si le chemin est vide.
  - **Performances RLS** (conseil Supabase) : dans les règles, `public.a_role(…)` devient `(select public.a_role(…))`. Les règles sont recréées par `drop policy if exists` / `create policy`.

- [ ] **Step 1: Écrire les tests**
  - `la base refuse une adresse de photo forgée` : la contrainte `profils_photo_chemin` existe dans le SQL, avec le motif `[0-9a-f-]{36}\.(jpg|png)`.
  - `les photos déjà enregistrées sont converties` : le SQL contient le `regexp_replace` et le passage en chemin a lieu avant l'ajout de la contrainte.
  - `la nouvelle photo est enregistrée par son chemin` : `update` reçoit `{ photo_url: "u1/<uuid>.jpg" }`.
  - `la coque affiche l'adresse publique de la photo` : `photo_url = "u1/a.jpg"` donne `photoUrl = "https://projet.supabase.co/storage/v1/object/public/photos-profil/u1/a.jpg"`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(base): photos par chemin vérifié ; règles d'accès plus rapides`.

### Task 5: Hygiène du code et guide

**Files:**
- Modify:
  - `web/src/lib/auth/permissions.ts` : `type Role` y est déplacé, et `ProfileMenu` le réexporte ;
  - `web/src/lib/pages-a-venir.ts` : commentaire périmé ;
  - `docs/guides/brancher-la-connexion.md` : étape 1, appliquer aussi `0003_finitions.sql`.
- Test: `web/tests/layout/session-guard.test.tsx`

**Interfaces:**
- Produces : un test de garde. Toute page sous `src/app/(app)/admin/**` utilise `requireSpace("admin")` ou `ReservedComingSoon espace="admin"` ; même règle pour `formateur`.

- [ ] **Step 1: Écrire le test** `chaque page d'un espace réservé vérifie le rôle` (balayage des fichiers, comme le test de session).
- [ ] **Step 2:** → PASS sur le code actuel. C'est un test de garde : il doit échouer si l'on ajoute une page sans vérification, ce qui se vérifie en en ajoutant une temporairement. **Step 3:** Déplacements et guide. **Step 4:** Suite entière, `tsc`, `eslint`, `npm run build`.
- [ ] **Step 5: Commit** `chore: finitions du lot 0 (types, commentaires, guide)`.
