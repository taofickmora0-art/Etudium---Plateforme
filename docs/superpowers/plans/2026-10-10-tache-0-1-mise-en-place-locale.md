# Tâche 0.1 — Mise en place locale : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une application Next.js qui tourne sur `http://localhost:3000`, affiche une page Étudium provisoire indiquant « Base connectée » quand le projet Supabase de test répond, et dont le code est versionné avec Git et sauvegardé sur un dépôt GitHub privé.

**Architecture:** Dépôt Git à la racine du dossier (docs + code), application dans `web/`. La configuration publique est lue et contrôlée par un module unique (`src/lib/env.ts`) qui refuse toute clé secrète. Un module de santé (`src/lib/supabase/health.ts`) interroge l'API d'authentification de Supabase ; la page d'accueil provisoire, rendue côté serveur, affiche son résultat.

**Tech Stack:** Next.js 16 (App Router, `src/`), React 19, TypeScript strict, Tailwind CSS 4, `@supabase/ssr` 0.12 + `@supabase/supabase-js` 2, Zod 4, Vitest 5, Node 24 / npm 11, Git 2.55.

**Spec:** `docs/superpowers/specs/2026-10-10-lot-0-fondations-design.md` (sections 2, 3, 5 et 8, ligne 0.1)

## Global Constraints

- Tout reste en local : aucun déploiement, aucun Vercel, aucun domaine.
- L'application vit dans `web/`. Le dépôt Git est à la racine `D:\Claude Code\Etudium - Plateforme`.
- Variables d'environnement publiques, et seulement elles : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Aucun secret ne doit être lu, affiché ou commité par l'agent. `web/.env.local` est créé et rempli par l'utilisateur, et il est ignoré par Git.
- Tous les textes visibles sont en français, vouvoiement, majuscule au premier mot seulement.
- Couleurs de la page provisoire : celles de la planche « Fondations » (spec, section 5). Fond `#F2F6FD`, coque `#E9EFFB`, panneau `#FFFFFF`, encre `#1D1D1F`, texte `#232326`, discret `#667085`, bleu `#0B18C9`, réussite `#DDF3E4`/`#17663A`, erreur `#FBE3E1`/`#B42318`. Police Inter.
- Chaque commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Clé secrète collée par erreur dans la variable publique** (`sb_secret_…` ou JWT `service_role`) : l'application refuse de démarrer la connexion et affiche un message clair, sans jamais afficher la clé. → test dans Task 2.
- **Projet Supabase en pause ou injoignable** (les projets gratuits se mettent en pause après une semaine d'inactivité) : la page répond en moins de 6 secondes avec « Supabase ne répond pas… », au lieu de tourner indéfiniment. → test dans Task 2.
- **`web/.env.local` envoyé sur GitHub** : `git check-ignore` doit le reconnaître avant le premier commit du code. → vérification dans Task 1.
- **URL mal saisie** (sans `https://`, avec une barre oblique finale, avec des espaces) : les espaces et la barre finale sont retirés ; une URL sans `https://` est refusée avec un message. → test dans Task 2.
- **Variables absentes** (fichier `.env.local` pas encore créé) : la page s'affiche quand même, avec « Configuration manquante » et le nom de la variable à remplir. → test dans Task 2 et vérification dans Task 3.

---

### Task 1: Dépôt Git et squelette Next.js

**Files:**
- Create: `.gitignore` (racine)
- Create: `web/` (généré par create-next-app), puis `web/vitest.config.ts`
- Modify: `web/package.json` (scripts `test`, dépendances)
- Create: `web/.env.example`

**Interfaces:**
- Produces: un projet Next.js qui compile (`npm run build`), le script `npm test` (Vitest), l'alias d'import `@/*` → `web/src/*`.

- [ ] **Step 1: Initialiser Git à la racine**

Run: `git init -b main` dans `D:\Claude Code\Etudium - Plateforme`
Expected: `Initialized empty Git repository`

- [ ] **Step 2: Écrire `.gitignore` à la racine**

Entrées : `node_modules/`, `.next/`, `out/`, `coverage/`, `*.log`, `.env`, `.env.*`, `!.env.example`, `.DS_Store`, `Thumbs.db`, `.vercel/`, `*.tsbuildinfo`, `next-env.d.ts`.

- [ ] **Step 3: Générer l'application**

Run (racine) : `npx create-next-app@16 web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes`
Si une question s'affiche malgré tout : TypeScript oui, ESLint oui, Tailwind oui, `src/` oui, App Router oui, Turbopack valeur par défaut, React Compiler non.
Expected: dossier `web/` créé, `Success! Created web`. Supprimer `web/.git` s'il a été créé (le dépôt est à la racine).

- [ ] **Step 4: Ajouter les dépendances**

Run (dans `web/`) : `npm install @supabase/ssr @supabase/supabase-js zod` puis `npm install -D vitest`
Expected: installation sans erreur.

- [ ] **Step 5: Configurer Vitest**

`web/vitest.config.ts` : environnement `node`, fichiers `tests/**/*.test.ts`, alias `@` → `./src`. Script `"test": "vitest run"` dans `web/package.json`.

- [ ] **Step 6: Écrire `web/.env.example`**

```
# Copiez ce fichier en .env.local et remplissez-le avec les valeurs du projet Supabase etudium-dev
# (Project Settings > API). Seulement la clé PUBLIQUE (publishable ou anon), jamais la clé secrète.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

- [ ] **Step 7: Vérifier que les secrets sont ignorés**

Run (racine) : `git check-ignore -v web/.env.local web/.env` puis `git check-ignore -v web/.env.example`
Expected: les deux premiers sont listés comme ignorés ; la troisième commande ne renvoie rien (le fichier exemple est suivi).

- [ ] **Step 8: Vérifier la compilation**

Run (dans `web/`) : `npm run build`
Expected: `Compiled successfully` (ou équivalent), sans erreur TypeScript.

- [ ] **Step 9: Commit**

```bash
git add .gitignore docs "Projet Claude Code" web
git commit -m "chore: initialise le dépôt et l'application Next.js (tâche 0.1)"
```
Vérifier avant avec `git status` qu'aucun fichier `.env.local` n'est listé.

---

### Task 2: Configuration publique et test de connexion à Supabase

**Files:**
- Create: `web/src/lib/env.ts`
- Create: `web/src/lib/supabase/health.ts`
- Create: `web/src/lib/supabase/server.ts`
- Create: `web/src/lib/supabase/client.ts`
- Test: `web/tests/env.test.ts`, `web/tests/health.test.ts`

**Interfaces:**
- Produces:
  - `type PublicEnv = { supabaseUrl: string; supabaseKey: string }`
  - `class EnvError extends Error { variable: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' }`
  - `readPublicEnv(source: Record<string, string | undefined>): PublicEnv` : lève `EnvError` en cas de problème.
  - `getPublicEnv(): PublicEnv` : `readPublicEnv` appliqué aux deux variables `NEXT_PUBLIC_…` (référencées littéralement pour que Next les injecte côté navigateur).
  - `type SupabaseStatus = { ok: true } | { ok: false; reason: 'cle' | 'injoignable' | 'inconnu'; message: string }`
  - `checkSupabase(env: PublicEnv, fetchImpl?: typeof fetch, timeoutMs?: number): Promise<SupabaseStatus>` (`timeoutMs` vaut 5000 par défaut).
  - `createClient()` dans `server.ts` (async, cookies de `next/headers`) et dans `client.ts` (navigateur), tous deux construits avec `getPublicEnv()` et `@supabase/ssr`. Ils serviront à partir de la tâche 0.4.

- [ ] **Step 1: Écrire les tests de configuration**

`web/tests/env.test.ts` :
- `accepte une URL et une clé publishable` : `readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: ' https://abcd.supabase.co/ ', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_xyz' })` renvoie `{ supabaseUrl: 'https://abcd.supabase.co', supabaseKey: 'sb_publishable_xyz' }`.
- `accepte une clé anon au format JWT` : un JWT dont la charge utile vaut `{"role":"anon"}` est accepté.
- `refuse une URL vide` : lève `EnvError` avec `variable === 'NEXT_PUBLIC_SUPABASE_URL'` et un message contenant `web/.env.local`.
- `refuse une URL sans https` : `'abcd.supabase.co'` → `EnvError`, message contenant `https://`.
- `refuse une clé vide` : `EnvError` avec `variable === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'`.
- `refuse une clé secrète sb_secret_` : message contenant `secrète`, et **ne contenant pas** la valeur de la clé.
- `refuse un JWT service_role` : charge utile `{"role":"service_role"}` → message contenant `secrète`.

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

Run (dans `web/`) : `npx vitest run tests/env.test.ts`
Expected: FAIL (module `@/lib/env` introuvable).

- [ ] **Step 3: Implémenter `readPublicEnv` et `getPublicEnv` dans `web/src/lib/env.ts`**

Nettoyer les espaces, retirer la barre oblique finale de l'URL. Clé : refuser le préfixe `sb_secret_` ; si la clé a trois segments séparés par des points, décoder la charge utile en base64url et refuser `role === 'service_role'`. Messages exacts :
- URL vide : `NEXT_PUBLIC_SUPABASE_URL est vide : collez l’URL du projet Supabase dans web/.env.local.`
- URL sans https : `NEXT_PUBLIC_SUPABASE_URL doit commencer par https:// (exemple : https://abcd.supabase.co).`
- Clé vide : `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est vide : collez la clé publique du projet dans web/.env.local.`
- Clé secrète : `La clé collée dans NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est une clé secrète. Remplacez-la par la clé publique (publishable ou anon) et ne la partagez avec personne.`

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent**

Run: `npx vitest run tests/env.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 5: Écrire les tests du contrôle de santé**

`web/tests/health.test.ts`, avec un `fetchImpl` simulé :
- `appelle /auth/v1/health avec la clé en en-tête apikey` : l'URL appelée vaut `https://abcd.supabase.co/auth/v1/health` et l'en-tête `apikey` vaut la clé.
- `renvoie ok quand Supabase répond 200` : `{ ok: true }`.
- `renvoie cle quand Supabase répond 401` : `reason === 'cle'`, message `Supabase refuse la clé : vérifiez NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans web/.env.local.`
- `renvoie injoignable en cas d'erreur réseau` : `fetchImpl` qui rejette → `reason === 'injoignable'`, message `Supabase ne répond pas : vérifiez l’URL et votre connexion, ou réactivez le projet s’il est en pause.`
- `renvoie injoignable après le délai` : `fetchImpl` qui ne répond jamais, `timeoutMs = 50` → résultat `injoignable` obtenu en moins de 500 ms.
- `renvoie inconnu pour un autre statut` : 500 → `reason === 'inconnu'`, message contenant `500`.

- [ ] **Step 6: Lancer les tests et vérifier qu'ils échouent**

Run: `npx vitest run tests/health.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 7: Implémenter `checkSupabase` dans `web/src/lib/supabase/health.ts`**

`AbortController` + `setTimeout(timeoutMs)` ; `cache: 'no-store'`. Les statuts 401 et 403 donnent `cle`.

- [ ] **Step 8: Implémenter `server.ts` et `client.ts`**

Suivre le modèle `@supabase/ssr` pour Next.js App Router : `createServerClient` avec `getAll`/`setAll` sur `await cookies()` (les erreurs de `setAll` dans un composant serveur sont ignorées) ; `createBrowserClient` côté navigateur.

- [ ] **Step 9: Lancer tous les tests**

Run: `npm test`
Expected: 13 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add web/src/lib web/tests
git commit -m "feat: configuration publique contrôlée et test de connexion Supabase"
```

---

### Task 3: Page provisoire « Base connectée »

**Files:**
- Modify: `web/src/app/globals.css` (couleurs de la planche « Fondations »)
- Modify: `web/src/app/layout.tsx` (`lang="fr"`, Inter, titre)
- Create: `web/src/components/brand/Logo.tsx`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: `getPublicEnv`, `EnvError` (`@/lib/env`), `checkSupabase`, `SupabaseStatus` (`@/lib/supabase/health`).
- Produces: `Logo` (`@/components/brand/Logo`), sans prop obligatoire : l'hexagone bleu avec « É » et le mot « Étudium ». Les couleurs `page`, `coque`, `panneau`, `encre`, `texte`, `discret`, `bleu`, `bleu-survol`, `reussite-fond`, `reussite-texte`, `erreur-fond`, `erreur-texte` sont déclarées dans `@theme` (utilisables en `bg-page`, `text-bleu`…). La tâche 0.2 complètera cette liste.

- [ ] **Step 1: Déclarer les couleurs et la police**

`globals.css` : `@import "tailwindcss";` puis un bloc `@theme` avec les couleurs listées dans Interfaces (valeurs : Global Constraints, plus `bleu-survol` = `#08149F`) et `--font-sans` sur la variable de police Inter. Supprimer les styles de démonstration de create-next-app (dégradés, mode sombre).
`layout.tsx` : `next/font/google` Inter (poids 400, 500, 600, 700), `<html lang="fr">`, `metadata.title = 'Étudium'`, `metadata.description = 'Formation, compétences digitales et accompagnement pour les étudiants et les jeunes diplômés.'`.

- [ ] **Step 2: Créer `Logo`**

Reprendre le SVG du design (fichier `NdConnexion.dc.html`, lien « Étudium, accueil ») : hexagone `points="15,4 24.5,9.5 24.5,20.5 15,26 5.5,20.5 5.5,9.5"` en `#0B18C9` avec contour arrondi de 5, lettre « É » blanche, 14 px, gras ; texte « Étudium » 17 px, gras, `letter-spacing: -0.02em`, couleur bleu. SVG `aria-hidden`, le composant porte `aria-label="Étudium"`.

- [ ] **Step 3: Écrire la page `web/src/app/page.tsx`**

Composant serveur asynchrone, `export const dynamic = 'force-dynamic'`. Mise en page reprise des écrans de compte du design : fond `page`, cadre `coque` arrondi 32 px, panneau blanc arrondi 28 px au centre. Contenu :
- le `Logo` ;
- titre (32/38, poids 500, encre) : `L’application Étudium tourne en local`
- texte (discret) : `Cette page provisoire vérifie que tout est branché. Elle sera remplacée par l’accueil au lot 1.`
- un encadré d'état, arrondi 16 px :
  - Supabase répond : fond `reussite-fond`, texte `reussite-texte`, titre `Base connectée`, détail `Projet Supabase de test joignable.`
  - `EnvError` attrapée : fond `erreur-fond`, texte `erreur-texte`, titre `Configuration manquante`, détail = message de l'erreur ;
  - `checkSupabase` en échec : même style, titre `Base non connectée`, détail = `status.message`.
- pied : `Tâche 0.1 · environnement local` en discret, 12 px.

- [ ] **Step 4: Vérifier l'état « Configuration manquante »**

`web/.env.local` n'existe pas encore. Run (dans `web/`) : `npm run dev`, puis ouvrir `http://localhost:3000` dans le navigateur intégré.
Expected: page Étudium avec l'encadré rouge « Configuration manquante » et le message sur `NEXT_PUBLIC_SUPABASE_URL`. Aucune erreur dans la console du navigateur ni dans le terminal.

- [ ] **Step 5: Vérifier la compilation et les tests**

Run: `npm run build` puis `npm test`
Expected: compilation réussie, 13 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat: page provisoire avec l’état de la connexion à Supabase"
```

---

### Task 4: Branchement du projet Supabase de test (avec l'utilisateur)

**Files:**
- Create (par l'utilisateur) : `web/.env.local`
- Create: `web/README.md` (remplace celui de create-next-app)

**Interfaces:**
- Consumes: la page de la Task 3.

- [ ] **Step 1: Donner le guide de création du projet Supabase**

Guide pas à pas en français, à suivre par l'utilisateur sur supabase.com :
1. Se connecter (le compte du calculateur convient), puis « New project ».
2. Nom : `etudium-dev`. Région : `West EU (Paris)`. Mot de passe de la base : en générer un et le garder pour soi, sans le communiquer.
3. Attendre la fin de la création, puis ouvrir « Project Settings › API ».
4. Copier `web/.env.example` en `web/.env.local`, puis y coller l'URL du projet et la clé **publique** (publishable, ou anon pour les anciennes clés). Ne jamais coller la clé secrète.
5. Enregistrer le fichier.

- [ ] **Step 2: Vérifier « Base connectée »**

L'utilisateur indique que `.env.local` est rempli. Redémarrer `npm run dev` (Next ne relit pas `.env.local` à chaud), puis recharger `http://localhost:3000`.
Expected: encadré vert « Base connectée ». Si c'est rouge, appliquer le message affiché (il nomme la variable fautive) sans jamais demander la valeur de la clé.

- [ ] **Step 3: Écrire `web/README.md`**

Contenu en français : prérequis (Node 20.9 ou plus), `npm install`, copier `.env.example` en `.env.local`, `npm run dev`, `npm test`, et le rappel que `.env.local` ne doit jamais être partagé ni commité.

- [ ] **Step 4: Vérifier que rien de secret n'est suivi**

Run (racine) : `git status --porcelain` et `git ls-files | grep -i "\.env"`
Expected: `web/.env.local` n'apparaît nulle part ; seul `web/.env.example` est suivi.

- [ ] **Step 5: Commit**

```bash
git add web/README.md
git commit -m "docs: guide de démarrage local de l’application"
```

---

### Task 5: Sauvegarde sur un dépôt GitHub privé (avec l'utilisateur)

**Files:** aucun.

- [ ] **Step 1: Donner le guide de création du dépôt**

Guide pour l'utilisateur, sur github.com avec son compte `taofickmora0-art` :
1. « New repository ». Nom : `etudium-plateforme`. Visibilité : **Private**.
2. Ne cocher ni README, ni .gitignore, ni licence (le dépôt doit être vide).
3. « Create repository », puis envoyer l'adresse affichée (`https://github.com/taofickmora0-art/etudium-plateforme.git`).

- [ ] **Step 2: Relier et envoyer**

Run (racine) : `git remote add origin <adresse fournie>` puis `git push -u origin main`
Expected: si Windows ouvre une fenêtre de connexion GitHub, l'utilisateur s'y connecte lui-même. Le push se termine par `branch 'main' set up to track 'origin/main'`.

- [ ] **Step 3: Vérifier la visibilité et le contenu**

L'utilisateur ouvre le dépôt sur GitHub.
Expected: badge « Private », dossiers `docs`, `Projet Claude Code` et `web` présents, aucun fichier `.env.local`.

---

## Validation de la tâche 0.1 (par l'utilisateur)

- `npm run dev` affiche la page Étudium sur `http://localhost:3000` avec l'encadré vert « Base connectée ».
- Le dépôt `etudium-plateforme` existe sur GitHub, en privé, sans aucun fichier `.env.local`.
