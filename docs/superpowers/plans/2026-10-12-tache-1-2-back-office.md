# Tâche 1.2 — Back-office minimal : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** l'équipe crée et modifie, depuis `/admin`, les parcours, les fiches formateurs, les formations, leur programme (modules, leçons, vidéos) et les ressources. Validation : l'utilisateur crée lui-même une formation complète (2 modules, 4 leçons).

**Architecture :**
- **Pages** : sous `src/app/(app)/admin/`. Ce sont des composants serveur (`requireSpace("admin")`) qui lisent via `src/lib/admin/data.ts`.
- **Formulaires** : des composants client branchés sur des actions serveur (`src/lib/admin/actions.ts`, motif `useActionState` du profil).
- **Règles partagées du lot 1** : niveaux, statuts, couleurs et leurs libellés vivent dans `src/lib/contenus/`. Les outils propres au back-office vivent dans `src/lib/admin/` : adresse, lien vidéo, durée, formats de fichiers.
- **Ordre des éléments** : une fonction SQL `public.deplacer` (migration 0005), testée sur le banc PGlite.
- **Fichiers de ressources** : envoyés directement du navigateur vers Supabase Storage (jusqu'à 50 Mo, au-delà de la limite de 3 Mo des actions serveur). La règle d'accès de la 0004 n'y autorise que l'équipe. Une action serveur enregistre ensuite la ligne `ressources`.

**Tech Stack :** Next.js 16 (App Router, cacheComponents), React 19, Supabase (`@supabase/ssr`), Zod 4, Vitest + Testing Library, PGlite (banc SQL).

**Spec :** `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` (§10 back-office ; §1 Q4, Q5, Q7, Q12 ; §2 adresses ; §5 YouTube et Vimeo ; §6 ressources ; §3 équipe)

## Global Constraints

- **Pas de design de back-office** (spec §10) : composants existants seulement (`Field`, `TextInput`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Button`, `IconButton`, `ListRow`, `Tag`, `Banner`, `Breadcrumb`, `SegmentedTabs`, `ConfirmDialog`, `FileDrop`, `FileRow`, `EmptyState`, `Toast`, `Heading` / `Lead`), sobres. Aucun nouvel élément visuel.
- **Mise en page** : utilisable à 320 px, sans défilement horizontal. Listes en `ListRow`, pas de tableau large.
- **Textes** : en français, vouvoiement, apostrophes typographiques (’) dans l'interface.
- **Accès** :
  - chaque page appelle `requireSpace("admin")` (rôles moderateur, admin, super_admin, identiques à `equipe_contenus()`) ;
  - chaque action revérifie l'équipe côté serveur ;
  - la base le revérifie (RLS de la 0004).
- **Limites (les mêmes que la base)** :
  - parcours : nom 80, nom court 30, description 500 ;
  - formateur : nom 80, titre 120, domaine 120, présentation 600 ;
  - formation : titre 120, résumé 160, description 2000, seuil 50–100, prix ≥ 0 ;
  - module et leçon : titre 120 ; titre court 40 ; résumé de leçon 1000 ; texte 20000.
- **Adresses** : `^[a-z0-9]+(-[a-z0-9]+)*$`. Une adresse est fixe une fois la formation publiée.
- **Archivage** : on n'efface jamais une formation publiée ; seul un brouillon s'efface (spec §10).
- **Ressources** : 50 Mo par fichier.
  - En consultation seule, seulement PDF, JPG, PNG et WebP.
  - En téléchargement, s'y ajoutent Excel, Word, PowerPoint (xlsx/xls, docx/doc, pptx/ppt), ZIP, CSV et texte.
- **Hors 1.2** :
  - photo des formateurs : le design montre des initiales, report ;
  - page `/admin/avis` : la table `avis` arrive en 1.11 ;
  - éditeur riche : lot 4.
- **Commits** : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Un étudiant qui appelle une action du back-office** (en recopiant la requête) doit recevoir « Accès réservé à l'équipe. » et rien ne doit changer. → Task 3 (garde) ; tests dans chaque tâche d'actions.
- **Lien vidéo collé dans toutes ses formes** : `youtu.be`, `watch?v=` avec paramètres, `shorts`, `embed`, `m.`, `youtube-nocookie`, Vimeo public, Vimeo non répertorié avec code, `player.vimeo.com?h=`. Il est reconnu ; tout autre lien donne un message clair. → Task 1.
- **Tables du lot 1 absentes** (0004 pas encore appliquée) : le back-office le dit (« Appliquez la migration 0004… »), sans écran d'erreur. → Task 2.
- **Supprimer un module ou une leçon** : confirmation, puis les fichiers de ses ressources sont aussi retirés du stockage, sans fichier orphelin. → Tasks 5 et 7.
- **Deux formations au même titre** : l'adresse reçoit un suffixe (`-2`) au lieu d'échouer. → Task 4.

---

### Task 1: Règles partagées et outils de saisie

**Files :**
- Create : `web/src/lib/contenus/libelles.ts`, `web/src/lib/admin/slug.ts`, `web/src/lib/admin/video.ts`, `web/src/lib/admin/duree.ts`, `web/src/lib/admin/fichiers.ts`, `web/src/lib/admin/schemas.ts`
- Test : `web/tests/admin/outils.test.ts`, `web/tests/admin/schemas.test.ts`

**Interfaces :**
- Produces :
  - **`libelles.ts`** : `type Niveau = "debutant" | "intermediaire" | "avance"`, `type StatutFormation = "brouillon" | "publiee" | "archivee"`, `type CouleurParcours = "academique" | "digital" | "business"`, `type Badge = "populaire" | "nouveau"`. Libellés :
    - `NIVEAUX: { value: Niveau; label: string }[]` : Débutant, Intermédiaire, Avancé ;
    - `STATUTS: Record<StatutFormation, string>` : Brouillon, Publiée, Archivée ;
    - `COULEURS: { value: CouleurParcours; label: string }[]` : « Académique (bleu) », « Digital (violet) », « Business (orange) » ;
    - `BADGES: { value: Badge; label: string }[]` : Populaire, Nouveau.
  - **`slugify(titre: string): string`** : minuscules, accents retirés (NFD), tout le reste devient « - », tirets fusionnés, bords nettoyés, 80 caractères au plus (coupé sur un tiret). Il rend `""` s'il ne reste rien.
  - **`parseVideoUrl(lien: string): { fournisseur: "youtube" | "vimeo"; id: string } | null`**. YouTube : identifiant de 11 caractères. Vimeo : `123456789` ou `123456789/hash` (hash hexadécimal).
  - **`videoLabel(v): string`** : « YouTube · dQw4w9WgXcQ » ou « Vimeo · 76979871 ».
  - **`videoLink(v): string`** : lien public à réafficher dans le champ (`https://youtu.be/<id>`, `https://vimeo.com/<id>`).
  - **`parseDuree(saisie: string): number | null`** : « 12:40 » → 760, « 1:02:03 » → 3723, « 45 » → 2700 (minutes seules), « » → 0. Toute autre saisie, ou des secondes ≥ 60, donne null.
  - **`formatDuree(secondes: number): string`** : 760 → « 12:40 », 3723 → « 1:02:03 », 0 → « ».
  - **`fichiers.ts`** :
    - `RESSOURCE_MAX_OCTETS = 52428800` ;
    - `FORMATS: { mime: string; extensions: string[]; label: string; consultable: boolean }[]` (PDF, JPG, PNG et WebP consultables ; Excel, Word, PowerPoint, ZIP, CSV et texte en téléchargement seulement) ;
    - `formatDe(nom: string, octets: Uint8Array): string | null` : signature des octets pour PDF (`%PDF`), JPG, PNG et WebP (`RIFF....WEBP`), extension pour les autres. Un fichier qui se dit `.pdf` sans `%PDF` donne null ;
    - `tailleLisible(octets: number): string` : « 84 Ko », « 1,2 Mo ».
  - **`schemas.ts`** (Zod, limites ci-dessus) :
    - `parcoursSchema`, `formateurSchema`, `formationInfosSchema`, `moduleSchema`, `leconSchema` ;
    - `ressourceSchema` (`titre` 1–120, `fichier`, `format` dans `FORMATS`, `taille_octets` ≤ max, `telechargeable` ; consultation seule ⇒ format consultable) ;
    - les listes (objectifs, compétences, points clés) se saisissent une par ligne. `lignes(texte)` découpe, enlève les espaces et retire les lignes vides.

- [ ] **Step 1 : écrire les tests** (`outils.test.ts`, `schemas.test.ts`)
  - `slugify fabrique une adresse propre` :
    - « Maîtriser Microsoft Excel » → `maitriser-microsoft-excel` ;
    - « Node.js & Vue.js » → `node-js-vue-js` ;
    - « L’IA, ça s’apprend ! » → `l-ia-ca-s-apprend` ;
    - « ??? » → `""` ;
    - 200 « a » + « b » donne au plus 80 caractères.
  - `parseVideoUrl reconnaît YouTube sous toutes ses formes`, avec l'identifiant `dQw4w9WgXcQ` pour :
    - `https://youtu.be/dQw4w9WgXcQ?si=x`
    - `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s`
    - `https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ`
    - `https://youtube.com/shorts/dQw4w9WgXcQ`
    - `https://www.youtube.com/embed/dQw4w9WgXcQ`
    - `https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ`
    - `youtube.com/watch?v=dQw4w9WgXcQ` (sans `https://`)
  - `parseVideoUrl reconnaît Vimeo, public ou non répertorié` :
    - `https://vimeo.com/76979871` → `76979871` ;
    - `https://vimeo.com/76979871/abcdef0123` → `76979871/abcdef0123` ;
    - `https://player.vimeo.com/video/76979871?h=abcdef0123` → `76979871/abcdef0123` ;
    - `https://vimeo.com/channels/staffpicks/76979871` → `76979871`.
  - `parseVideoUrl refuse le reste` : `https://exemple.com/video.mp4`, `https://youtube.com/watch?v=court`, `pas un lien`, `""` → null.
  - `durées` : les cas de `parseDuree` et `formatDuree` ci-dessus ; « 12:75 » → null ; « -3 » → null.
  - `formatDe vérifie le contenu des fichiers` :
    - `guide.pdf` avec `%PDF-1.7` → `application/pdf` ;
    - `guide.pdf` avec « bonjour » → null ;
    - `photo.webp` avec `RIFF` + 4 octets + `WEBP` → `image/webp` ;
    - `donnees.xlsx` → le type Excel ;
    - `script.exe` → null.
  - `tailleLisible` : 84000 → « 84 Ko » ; 1200000 → « 1,2 Mo ».
  - `schemas` :
    - un parcours sans nom donne « Entrez le nom du parcours. » ;
    - une adresse `Excel.js` donne « Lettres minuscules, chiffres et tirets seulement. » ;
    - un seuil de 40 donne « Entre 50 et 100 %. » ;
    - une ressource en consultation seule au format Excel donne « Seuls les PDF et les images peuvent être en consultation seule. ».
- [ ] **Step 2 :** `npx vitest run tests/admin` → FAIL (modules introuvables).
- [ ] **Step 3 :** implémenter les six fichiers.
- [ ] **Step 4 :** `npx vitest run tests/admin` → PASS.
- [ ] **Step 5 : commit** `feat(admin): règles de saisie (adresse, lien vidéo, durée, formats de fichiers)`

### Task 2: Migration 0005 et lecture des données

**Files :**
- Create : `web/supabase/migrations/0005_back_office.sql`, `web/src/lib/admin/data.ts`, `web/src/lib/admin/types.ts`
- Test : `web/tests/db/back-office.test.ts`, `web/tests/admin/data.test.ts`

**Interfaces :**
- Consumes : banc (`creerBanc`, `MIGRATIONS_LOT_0`), la 0004, `demoModeActive()` (`@/lib/auth/current-user`), `createClient` (`@/lib/supabase/server`).
- Produces :
  - **SQL `public.deplacer(p_table text, p_id uuid, p_sens integer) returns void`** (`security invoker`, `search_path = ''`) :
    - tables permises et leur groupe : `parcours` (tous), `modules` (`formation_id`), `lecons` (`module_id`), `ressources` (`lecon_id`). Toute autre table, ou un sens différent de -1 ou 1, lève une erreur ;
    - renumérote d'abord le groupe (1..n, par `ordre`, `cree_le`, `id`), puis échange avec le voisin. Au bord, rien ne change ;
    - les règles d'accès s'appliquent : hors équipe, rien ne bouge.
  - **Espace `ressources`** : `allowed_mime_types` = les types de `FORMATS` (Task 1). La liste est écrite en toutes lettres dans le SQL.
  - **`types.ts`** :
    - `ParcoursAdmin { id, slug, nom, nomCourt, description, couleur, ordre, actif }` ;
    - `FormateurAdmin { id, nom, titre, domaine, presentation }` ;
    - `FormationResume { id, slug, titre, statut, niveau, nbLecons, parcours: string[] }` ;
    - `FormationAdmin` : `FormationResume` plus `resume, description, objectifs, competences, formateurId, gratuite, achatSepare, prixFcfa, badge, seuilVideo, publieeLe, parcoursIds, modules: ModuleAdmin[]` ;
    - `ModuleAdmin { id, titre, ordre, lecons: LeconResume[] }` ;
    - `LeconResume { id, titre, dureeSecondes, apercu, aVideo }` ;
    - `LeconAdmin` : `{ id, moduleId, formationId, formationTitre, titre, titreCourt, dureeSecondes, apercu, resume, pointsCles, video: { fournisseur, id } | null, texte, ressources: RessourceAdmin[] }` ;
    - `RessourceAdmin { id, titre, fichier, format, tailleOctets, telechargeable, ordre }`.
  - **`data.ts`** : `listParcours()`, `getParcours(id)`, `listFormateurs()`, `getFormateur(id)`, `listFormations()`, `getFormationAdmin(id)`, `getLeconAdmin(id)`, `compterContenus(): { parcours, formateurs, publiees, brouillons, archivees }`.
    - Modules, leçons et ressources sont triés par `ordre`.
    - En mode démonstration : listes vides et `null`.
  - **`class TablesAbsentesError`** : levée quand Supabase répond `PGRST205` ou `42P01` (tables du lot 1 absentes).

- [ ] **Step 1 : écrire les tests**
  - `back-office.test.ts` (banc : lot 0 + 0004 + 0005 + exemples ; comptes admin A et étudiant E) :
    - `monter une leçon l'échange avec la précédente` : `select public.deplacer('lecons', <2e leçon du module 1 d'Excel>, -1)` en A, puis les 2 premiers titres du module 1 sont inversés ;
    - `au bord, rien ne bouge` : déplacer la première leçon vers le haut ne change rien ;
    - `des ordres en double sont renumérotés` : deux modules à `ordre = 1`, puis un déplacement donne des ordres 1..n distincts ;
    - `un étudiant ne réordonne rien` : en E, l'appel ne lève pas d'erreur mais l'ordre est inchangé ;
    - `une table non prévue est refusée` : `deplacer('formations', …)` lève une erreur ;
    - `l'espace ressources n'accepte que les formats prévus` : `allowed_mime_types` contient `application/pdf` et pas `application/x-msdownload` ;
    - `la migration se rejoue`.
  - `data.test.ts` (faux client Supabase qui rend des lignes préparées) :
    - `une formation est lue avec son programme dans l'ordre` (colonnes en camelCase, modules et leçons triés) ;
    - `les tables absentes sont signalées` : une erreur `{ code: "PGRST205" }` lève `TablesAbsentesError`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter (requêtes imbriquées de Supabase : `formations?select=*,formations_parcours(parcours_id),modules(id,titre,ordre,lecons(id,titre,duree_secondes,apercu,ordre,lecons_contenus(video_id)))`). **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(admin): ordre des éléments (0005) et lecture des contenus`

### Task 3: Garde de l'équipe, accueil du back-office, parcours et formateurs

**Files :**
- Create :
  - `web/src/lib/admin/garde.ts`
  - `web/src/lib/admin/actions.ts` (début)
  - `web/src/components/admin/PageAdmin.tsx`, `web/src/components/admin/TablesAbsentes.tsx`, `web/src/components/admin/BoutonsOrdre.tsx`, `web/src/components/admin/ParcoursForm.tsx`, `web/src/components/admin/FormateurForm.tsx`
  - `web/src/app/(app)/admin/parcours/page.tsx`, `…/parcours/nouveau/page.tsx`, `…/parcours/[id]/page.tsx`
  - `web/src/app/(app)/admin/formateurs/page.tsx`, `…/formateurs/nouveau/page.tsx`, `…/formateurs/[id]/page.tsx`
- Modify : `web/src/app/(app)/admin/page.tsx` (il remplace la page « Bientôt disponible »)
- Test : `web/tests/admin/garde-et-parcours.test.ts`, `web/tests/admin/pages-admin.test.tsx`

**Interfaces :**
- Consumes : Task 1 (schémas, `slugify`, `COULEURS`), Task 2 (data, `TablesAbsentesError`, `deplacer`), `getShellUser`, `canAccess`, `fieldErrorsFrom`, `FormState`, `IDLE`.
- Produces :
  - **`exigerEquipe(): Promise<{ supabase } | { erreur: string }>`** (`garde.ts`). Sans compte : « Votre session a expiré. Reconnectez-vous. ». Hors équipe : « Accès réservé à l'équipe. ».
  - **Actions** :
    - `saveParcours(prev: FormState, fd: FormData): Promise<FormState>` (champs `id?`, `nom`, `nom_court`, `slug` (vide ⇒ `slugify(nom)`), `description`, `couleur`, `actif` (« on »)) ; à la création, `ordre` = max + 1 ;
    - `saveFormateur(prev, fd)` ;
    - `deplacer(table: "parcours" | "modules" | "lecons" | "ressources", id: string, sens: -1 | 1): Promise<{ ok: boolean; message?: string }>`.
    - Après succès : `refresh()`. Une création redirige vers la liste. Une adresse déjà prise (`23505`) donne `fieldErrors.slug` « Cette adresse est déjà prise. ».
  - **`PageAdmin({ titre, description?, fil?: { label, href? }[], action?, children })`** : le fil d'Ariane commence par « Back-office » → `/admin`.
  - **`TablesAbsentes()`** : `Banner` d'avertissement « Les tables du lot 1 ne sont pas encore dans la base. » avec le texte « Appliquez la migration 0004, puis 0005 (guide « Ce qui te revient », section 5). ».
  - **`BoutonsOrdre({ table, id, premier, dernier })`** : deux `IconButton`, « Monter » et « Descendre », désactivés au bord. Ils appellent `deplacer` ; en cas d'échec, une notification « Le déplacement n'a pas abouti. ».
- **Pages et textes** :
  - **`/admin`** : titre « Back-office ».
    - Description : « Saisissez les parcours, les formateurs et les formations. Les étudiants ne voient que les formations publiées. »
    - Trois `ListRow` : « Parcours » (« 3 parcours »), « Formateurs » (« 1 fiche » / « N fiches »), « Formations » (« N publiées · N brouillons · N archivées »).
  - **`/admin/parcours`** : titre « Parcours », bouton « Nouveau parcours ».
    - Une ligne par parcours : nom, description, `Tag` « Désactivé » si inactif, `BoutonsOrdre`, lien vers sa fiche.
    - Formulaire : Nom, Nom court (aide « Affiché sur les puces, par exemple « Académique ». »), Adresse (aide « Lettres minuscules, chiffres et tirets. Laissez vide pour la créer à partir du nom. »), Description, Couleur, interrupteur « Parcours actif » (description « Un parcours désactivé disparaît du catalogue. »), « Enregistrer ».
  - **`/admin/formateurs`** : même structure. Formulaire : Nom, Titre (aide « Par exemple « Enseignante en statistiques appliquées ». »), Domaine, Présentation (600).
  - Chaque page : `requireSpace("admin")` ; contenu lu sous `Suspense` ; `TablesAbsentesError` affiche `TablesAbsentes`.

- [ ] **Step 1 : écrire les tests**
  - `garde-et-parcours.test.ts` (faux client qui enregistre `insert` / `update` / `rpc`) :
    - `un étudiant ne peut rien enregistrer` : `getShellUser` rend les rôles `["etudiant"]` → `saveParcours` rend « Accès réservé à l'équipe. », sans `insert` ;
    - `un parcours est créé avec une adresse tirée du nom` : nom « Santé & bien-être » → `insert` reçoit `slug: "sante-bien-etre"` et `ordre` = max + 1 ;
    - `une adresse déjà prise est signalée sur son champ` : `insert` rend `{ code: "23505" }` → `fieldErrors.slug` ;
    - `déplacer appelle la fonction de la base` : `rpc("deplacer", { p_table: "lecons", p_id: "x", p_sens: -1 })` ;
    - `une session expirée est annoncée` : `getShellUser` rend null → « Votre session a expiré. Reconnectez-vous. ».
  - `pages-admin.test.tsx` :
    - `l'accueil du back-office résume les contenus` : `compterContenus` simulé `{ parcours: 3, formateurs: 1, publiees: 10, brouillons: 0, archivees: 0 }` → les textes « 3 parcours », « 1 fiche », « 10 publiées · 0 brouillon · 0 archivée » ;
    - `les tables absentes sont annoncées` : `compterContenus` lève `TablesAbsentesError` → « Les tables du lot 1 ne sont pas encore dans la base. ».
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS, et `npx vitest run tests/layout/session-guard.test.tsx` → PASS (chaque page sous `admin/` appelle `requireSpace("admin")`).
- [ ] **Step 5 : commit** `feat(admin): accueil du back-office, parcours et formateurs`

### Task 4: Formations : liste, création, informations, publication

**Files :**
- Create :
  - `web/src/components/admin/FormationInfosForm.tsx`, `web/src/components/admin/PublicationPanel.tsx`, `web/src/components/admin/FormationOnglets.tsx`
  - `web/src/app/(app)/admin/formations/page.tsx`, `…/formations/nouvelle/page.tsx`, `…/formations/[id]/page.tsx`
- Modify : `web/src/lib/admin/actions.ts`
- Test : `web/tests/admin/formations-actions.test.ts`, `web/tests/admin/formation-form.test.tsx`

**Interfaces :**
- Consumes : Tasks 1 à 3.
- Produces :
  - **Actions** :
    - `createFormation(prev, fd)` : champ `titre`. L'adresse `slugify(titre)` reçoit `-2`, `-3`… si elle est prise. Puis insertion en brouillon et `redirect("/admin/formations/<id>")`.
    - `saveFormationInfos(prev, fd)` :
      - champs `id, titre, slug, resume, description, objectifs, competences, niveau, formateur_id, gratuite, achat_separe, prix_fcfa, badge, seuil_video, parcours` (plusieurs) ;
      - met à jour la formation, puis remplace ses lignes `formations_parcours` ;
      - adresse modifiée après publication : message « L'adresse d'une formation publiée ne change plus. » (erreur `P0001` de la base).
    - `setStatutFormation(id, statut: StatutFormation): Promise<{ ok; message? }>`. Publier sans aucune leçon : « Ajoutez au moins une leçon avant de publier. ».
    - `deleteFormation(id)` : brouillon seulement ; ensuite `redirect("/admin/formations")`.
  - **`FormationOnglets`** : `SegmentedTabs` (`keepMounted`) avec « Informations », « Programme » (Task 5) et « Publication ».
- **Pages et textes** :
  - **`/admin/formations`** :
    - titre « Formations », bouton « Nouvelle formation » ;
    - puces « Toutes », « Brouillons », « Publiées », « Archivées » (paramètre `?statut=`) ;
    - une ligne par formation : titre ; sous-titre « Parcours · Niveau · N leçons » ; `Tag` du statut (Brouillon neutre, Publiée réussite, Archivée avertissement) ;
    - vide : `EmptyState` « Aucune formation pour le moment ».
  - **`/admin/formations/nouvelle`** : champ « Titre de la formation », bouton « Créer le brouillon ».
  - **`/admin/formations/[id]`** : fil « Back-office › Formations › {titre} », titre, `Tag` du statut, onglets.
    - **Informations**, dans l'ordre :
      - Titre ;
      - Adresse : en lecture seule après publication, avec l'aide « Fixée depuis la publication : les liens partagés restent valables. » ;
      - Résumé (aide « Deux lignes sous le titre, sur les cartes du catalogue. ») ;
      - Description ;
      - « Ce que vous allez apprendre » (aide « Un objectif par ligne. ») ;
      - « Compétences acquises » (une par ligne) ;
      - Niveau ;
      - Formateur (« Aucun » + fiches) ;
      - Parcours (cases à cocher) ;
      - interrupteur « Formation gratuite » ;
      - interrupteur « Disponible seule » (description « Achat individuel, en formation complémentaire (lot 2). ») ;
      - Prix en FCFA (facultatif) ;
      - Badge (Aucun / Populaire / Nouveau) ;
      - Seuil de validation des vidéos en % (aide « Part de la vidéo à regarder réellement pour terminer une leçon. ») ;
      - « Enregistrer ».
    - **Publication** :
      - brouillon : texte « Brouillon : visible seulement par l'équipe. », bouton « Publier » (confirmation « Publier cette formation ? » / « Elle apparaîtra dans le catalogue. Son adresse ne pourra plus changer. ») et bouton danger « Supprimer le brouillon » (confirmation) ;
      - publiée : texte « Publiée : visible dans le catalogue. », bouton « Archiver » (confirmation « Archiver cette formation ? » / « Elle disparaît du catalogue et ses leçons se ferment. Rien n'est supprimé : vous pourrez la republier. ») ;
      - archivée : texte « Archivée : retirée du catalogue. », bouton « Republier ».

- [ ] **Step 1 : écrire les tests**
  - `formations-actions.test.ts` :
    - `deux formations au même titre reçoivent des adresses distinctes` : `maitriser-excel` déjà pris → `insert` reçoit `maitriser-excel-2` ;
    - `les listes se saisissent une par ligne` : objectifs « A\n\n B \n » → `["A", "B"]` ;
    - `les parcours cochés remplacent les anciens` : `delete` des liens de la formation, puis `insert` des deux parcours cochés ;
    - `on ne publie pas une formation vide` : 0 leçon → message, pas d'`update` ;
    - `une adresse figée par la publication est expliquée` : `update` rend `{ code: "P0001", message: "L'adresse d'une formation publiée ne change plus." }` → `fieldErrors.slug` porte ce texte ;
    - `seul un brouillon s'efface` : statut publiée → « Une formation publiée s'archive, elle ne s'efface pas. », pas de `delete`.
  - `formation-form.test.tsx` :
    - `l'adresse d'une formation publiée est en lecture seule` (champ `readonly` et texte d'aide) ;
    - `les boutons de publication suivent le statut` : brouillon → « Publier » et « Supprimer le brouillon » ; publiée → « Archiver » ; archivée → « Republier ».
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(admin): formations (liste, création, informations, publication)`

### Task 5: Programme : modules et leçons

**Files :**
- Create : `web/src/components/admin/ProgrammeEditor.tsx`
- Modify : `web/src/lib/admin/actions.ts`, `web/src/components/admin/FormationOnglets.tsx` (onglet Programme)
- Test : `web/tests/admin/programme.test.ts`, `web/tests/admin/programme-editor.test.tsx`

**Interfaces :**
- Produces (actions) :
  - `addModule(prev, fd)` : champs `formation_id`, `titre` ; `ordre` = max + 1.
  - `renameModule(prev, fd)` : champs `id`, `titre`.
  - `deleteModule(id)` : retire d'abord du stockage les fichiers des ressources de ses leçons, puis supprime le module (les leçons partent en cascade).
  - `addLecon(prev, fd)` : champs `module_id`, `titre`. Crée la leçon et sa ligne `lecons_contenus` vide, puis `redirect` vers la page de la leçon (Task 6).
  - `deleteLecon(id)` : fichiers d'abord, puis la leçon.
- **`ProgrammeEditor({ formation: FormationAdmin })`** :
  - **Un bloc par module** :
    - en-tête « Module N » et champ de titre avec « Renommer » ;
    - `BoutonsOrdre` et `IconButton` « Supprimer le module » (confirmation « Supprimer ce module ? » / « Ses N leçons, leurs vidéos et leurs ressources seront supprimées. ») ;
    - ses leçons en `ListRow` : titre ; sous-titre « 12:40 · Aperçu · Vidéo » (ou « Sans vidéo ») ; `BoutonsOrdre` ; « Supprimer la leçon » (confirmation) ; lien vers la leçon ;
    - en bas du bloc, le formulaire « Ajouter une leçon » (Titre de la leçon + bouton).
  - **Sous les modules** : « Ajouter un module ».
  - **Sans module** : `EmptyState` « Aucun module pour le moment » / « Commencez par ajouter un module, puis ses leçons. ».

- [ ] **Step 1 : écrire les tests**
  - `programme.test.ts` :
    - `un module s'ajoute à la fin` (`ordre` = max + 1) ;
    - `supprimer un module retire d'abord ses fichiers` : ressources `f/a.pdf` et `f/b.png` → `storage.remove(["f/a.pdf", "f/b.png"])` avant `delete` ;
    - `une leçon naît avec un contenu vide et ouvre sa page` : `insert` dans `lecons` puis dans `lecons_contenus`, puis redirection `/admin/formations/<fid>/lecons/<lid>` ;
    - `un étudiant ne supprime rien` : « Accès réservé à l'équipe. », sans `delete`.
  - `programme-editor.test.tsx` :
    - `le programme s'affiche dans l'ordre avec la durée et l'aperçu` (« Module 1 », « 06:10 · Aperçu · Sans vidéo ») ;
    - `supprimer un module demande confirmation` (la fenêtre annonce le nombre de leçons) ;
    - `sans module, l'état vide guide`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(admin): programme (modules et leçons, ordre, suppression)`

### Task 6: Page d'une leçon : informations, vidéo, contenu

**Files :**
- Create : `web/src/components/admin/LeconForm.tsx`, `web/src/app/(app)/admin/formations/[id]/lecons/[leconId]/page.tsx`
- Modify : `web/src/lib/admin/actions.ts`
- Test : `web/tests/admin/lecon.test.ts`, `web/tests/admin/lecon-form.test.tsx`

**Interfaces :**
- Produces :
  - **`saveLecon(prev, fd)`** :
    - champs `id, titre, titre_court, duree, apercu, video, resume, points_cles, texte` ;
    - `duree` passe par `parseDuree` ;
    - `video` passe par `parseVideoUrl` : vide ⇒ pas de vidéo ; lien non reconnu ⇒ `fieldErrors.video` « Ce lien n'est ni une vidéo YouTube ni une vidéo Vimeo. » ;
    - met à jour `lecons`, puis fait un `upsert` de `lecons_contenus`.
  - **`LeconForm({ lecon: LeconAdmin })`** :
    - le champ vidéo affiche sous lui, pendant la frappe, `videoLabel` du lien reconnu ;
    - le champ durée affiche `formatDuree`.
- **Page** :
  - fil « Back-office › Formations › {formation} › {leçon} » ; titre de la leçon ;
  - formulaire, dans l'ordre :
    - Titre ;
    - Titre court (aide « Pour le programme de gauche, si le titre est long. ») ;
    - Lien de la vidéo (aide « YouTube ou Vimeo, par exemple https://youtu.be/… ») ;
    - Durée (aide « Durée de la vidéo, par exemple 12:40. ») ;
    - interrupteur « Leçon d'aperçu » (description « Visible sans compte, même si la formation est payante. ») ;
    - « Dans cette leçon » (Résumé et Points clés, un par ligne) ;
    - Texte de la leçon (aide « Texte simple ; l'éditeur riche arrive au lot 4. ») ;
    - « Enregistrer » ;
  - puis la section Ressources (Task 7) ;
  - lien « Retour au programme ».

- [ ] **Step 1 : écrire les tests**
  - `lecon.test.ts` :
    - `un lien YouTube est enregistré par son identifiant` : `https://youtu.be/dQw4w9WgXcQ?si=x` → `upsert` avec `{ video_fournisseur: "youtube", video_id: "dQw4w9WgXcQ" }` ;
    - `un lien inconnu est refusé sur son champ` ;
    - `effacer le lien retire la vidéo` : `video_fournisseur: null, video_id: null` ;
    - `la durée se saisit en minutes et secondes` : « 12:40 » → `duree_secondes: 760` ; « 12:75 » → `fieldErrors.duree` « Durée au format 12:40. » ;
    - `les points clés se saisissent un par ligne`.
  - `lecon-form.test.tsx` :
    - `le lien collé est reconnu pendant la frappe` (« YouTube · dQw4w9WgXcQ » s'affiche) ;
    - `la leçon enregistrée réaffiche son lien et sa durée` (`https://youtu.be/<id>`, « 12:40 »).
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(admin): page d'une leçon (vidéo YouTube ou Vimeo, durée, aperçu, contenu)`

### Task 7: Ressources d'une leçon

**Files :**
- Create : `web/src/components/admin/RessourcesEditor.tsx`
- Modify : `web/src/lib/admin/actions.ts`, la page de la leçon (Task 6)
- Test : `web/tests/admin/ressources.test.ts`, `web/tests/admin/ressources-editor.test.tsx`

**Interfaces :**
- Consumes : `formatDe`, `FORMATS`, `RESSOURCE_MAX_OCTETS`, `tailleLisible` (Task 1) ; `createClient` de `@/lib/supabase/client` (navigateur).
- Produces :
  - **`addRessource(input: { leconId; titre; fichier; format; tailleOctets }): Promise<{ ok; message? }>`** :
    - revérifie l'équipe, et que `fichier` commence par `<formationId>/` de la leçon ;
    - `telechargeable = true` ; `ordre` = max + 1.
  - **`updateRessource(input: { id; titre; telechargeable })`** : erreur de consultation pour un format non consultable.
  - **`deleteRessource(id)`** : retire le fichier du stockage, puis la ligne.
  - **`RessourcesEditor({ lecon: LeconAdmin })`** :
    - **Pour chaque fichier déposé dans `FileDrop`** :
      - lire les 16 premiers octets ;
      - `formatDe` ;
      - refus si null (« Format non accepté : PDF, images, Excel, Word, PowerPoint, ZIP, CSV ou texte. ») ou si trop lourd (« Ce fichier dépasse 50 Mo. ») ;
      - envoi navigateur → Storage dans `<formationId>/<uuid>.<ext>` avec `contentType` ;
      - puis `addRessource` ; si l'enregistrement échoue, le fichier envoyé est retiré.
    - **Chaque ressource** est un `FileRow` (titre ; « PDF · 1,2 Mo · Consultation seule » ou « Téléchargeable ») avec :
      - champ de titre ;
      - interrupteur « Consultation seule » (absent pour un format non consultable) ;
      - `BoutonsOrdre` ;
      - « Supprimer » (confirmation).

- [ ] **Step 1 : écrire les tests**
  - `ressources.test.ts` :
    - `une ressource est enregistrée après l'envoi du fichier` ;
    - `un fichier hors du dossier de la formation est refusé` ;
    - `un fichier Excel ne passe pas en consultation seule` ;
    - `supprimer une ressource retire aussi son fichier`.
  - `ressources-editor.test.tsx` (stockage navigateur simulé) :
    - `un faux PDF est refusé sans envoi` ;
    - `un fichier trop lourd est refusé` ;
    - `un PDF est envoyé puis enregistré` : `upload` reçoit un chemin `^<fid>/[0-9a-f-]{36}\.pdf$`, puis `addRessource` est appelée ;
    - `si l'enregistrement échoue, le fichier envoyé est retiré`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(admin): ressources des leçons (envoi, consultation seule, ordre, suppression)`

### Task 8: Guide de validation et vérifications finales

**Files :**
- Modify : `docs/guides/ce-qui-te-revient.md` (section 5 : appliquer aussi `0005_back_office.sql` ; nouvelle section 6 « Valider le back-office (tâche 1.2) »)

- [ ] **Step 1 : guide**
  - **Section 5** : ordre 0004 → 0005 → exemples.
  - **Section 6, pas à pas** :
    1. Connecte-toi avec ton compte super-administrateur, puis ouvre http://localhost:3000/admin.
    2. Formations → Nouvelle formation : crée une formation gratuite.
    3. Ajoute 2 modules et 4 leçons.
    4. Pour chaque leçon, colle un lien YouTube et une durée. Coche « Leçon d'aperçu » sur la première.
    5. Ajoute un PDF à une leçon et passe-le en « Consultation seule ».
    6. Range une leçon avec « Monter ».
    7. Onglet Publication → Publier.
    8. Vérifie dans Table Editor que la formation est `publiee`.
- [ ] **Step 2 :** suite entière, `tsc`, `eslint`, `npm run build` → tout passe.
- [ ] **Step 3 :** dans le navigateur (serveur local), `/admin` s'ouvre. Base sans 0004 : l'avertissement des tables absentes s'affiche, sans écran d'erreur. Mise en page vérifiée à 1440, 390 et 320 px.
- [ ] **Step 4 : commit** `docs: guide de validation du back-office (tâche 1.2)`
