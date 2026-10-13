# Images de couverture des formations : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** chaque formation a une image de couverture 16:9, envoyée au back-office, affichée sur les cartes, la fiche, l'image de partage, la carte « Continuer » et la page de la leçon ; sans image, une couverture par défaut aux couleurs du parcours.

**Architecture :**
- **Base (0012)** : colonne `formations.couverture` (chemin), espace de stockage public `couvertures` réservé en écriture à l'équipe.
- **Envoi** : le navigateur vérifie et dépose le fichier (comme les ressources), puis une action serveur l'enregistre sur la formation et supprime l'ancien.
- **Affichage** : un composant `Couverture` (`next/image` ou couverture par défaut) utilisé par `CardShell` et les autres emplacements.
- **Repli** : les lectures du catalogue retombent sans la colonne tant que la 0012 n'est pas appliquée.

**Tech Stack :** Next.js 16.4 (`next/image`, `next/og`), React 19, Supabase Storage, PGlite, Vitest.

**Spec :** `docs/superpowers/specs/2026-10-13-couvertures-formations-design.md`

## Global Constraints

- **Formats et poids** : JPG, PNG ou WebP, 5 Mo au plus (`5 * 1024 * 1024` octets). Le format est reconnu à la signature du fichier, pas à son nom.
- **Chemin** : `<formation_id>/<uuid>.<jpg|png|webp>` dans l'espace `couvertures`.
- **Textes** :
  - conseil : « JPG, PNG ou WebP, 5 Mo au plus. Conseil : 1280 × 720 pixels. » ;
  - boutons : « Choisir une image », « Remplacer », « Retirer » ;
  - retrait : fenêtre « Retirer l’image de couverture ? », bouton « Retirer » ;
  - toasts : « Image de couverture enregistrée. », « Image de couverture retirée. » ;
  - erreurs : « Choisissez une image JPG, PNG ou WebP. », « L’image dépasse 5 Mo. », « L’image n’a pas pu être envoyée. Réessayez. ».
- **Affichage** :
  - ratio 16:9 partout, `object-fit: cover` (le centre est gardé), `alt=""` (le titre suit) ;
  - couverture par défaut : fond clair du parcours (`PALETTES` de `CourseIllustration`) et l'illustration du parcours au centre.
- **Commits** : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Un PDF renommé en `.jpg`, ou une image de 6 Mo** : refusé avant l'envoi, avec le message ; l'espace de stockage le refuse aussi (types et taille). → Tasks 1, 2.
- **Un chemin dans le dossier d'une autre formation passé à l'action** : refusé. → Task 2.
- **Remplacer puis retirer une image** : l'ancien fichier est supprimé ; si la suppression échoue, l'enregistrement tient quand même. → Task 2.
- **Migration 0012 pas encore appliquée** : catalogue, fiches, Mes formations et back-office s'affichent avec la couverture par défaut, sans erreur. Les notes des avis (0010) restent là. → Task 2.
- **Image très large (bandeau 3000 × 500) ou portrait (photo de téléphone)** : cadrée en 16:9, sans déformation ni débordement. → Task 3 (classe `object-cover` vérifiée), Task 6 (rendu).

---

### Task 1: Base (migration 0012)

**Files :** Create `web/supabase/migrations/0012_couvertures.sql` ; Test `web/tests/db/couvertures.test.ts` (banc PGlite, migrations 0001 à 0011 et exemples)

**Interfaces :**
- Produces :
  - `formations.couverture text` (null par défaut), avec la contrainte `formations_couverture_chemin` : `couverture is null or couverture ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')` ;
  - espace `couvertures` : `public = true`, `file_size_limit = 5242880`, `allowed_mime_types = {image/jpeg,image/png,image/webp}` ;
  - règles sur `storage.objects` pour `bucket_id = 'couvertures'` : lecture pour `anon` et `authenticated` ; dépôt, remplacement et suppression si `equipe_contenus()` et si le premier dossier est l'identifiant d'une formation existante.

- [ ] **Step 1 : tests** :
  - un admin dépose `<excel_id>/<uuid>.jpg` ; un étudiant et un visiteur sont refusés ;
  - un dépôt dans le dossier `pas-une-formation/…` est refusé ;
  - l'admin supprime le fichier, un étudiant non ;
  - un visiteur lit l'objet ;
  - `update formations set couverture = '<autre_id>/<uuid>.jpg'` viole la contrainte ; le chemin de la formation est accepté ; `.gif` est refusé ;
  - l'espace a ses limites (taille, types) ;
  - la migration se rejoue.
- [ ] **Step 2 :** → FAIL. **Step 3 :** écrire la 0012 (même forme que la 0010, `begin`/`commit`, rejouable). **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(couvertures): colonne et espace de stockage des images de couverture (migration 0012)`

### Task 2: Données, règles et actions

**Files :**
- Create : `web/src/lib/couvertures/regles.ts` (sans dépendance serveur), `web/src/lib/couvertures/adresse.ts`
- Modify :
  - `web/src/lib/catalogue/types.ts` : `couverture: string | null` (chemin) sur `CarteCatalogue` ;
  - `web/src/lib/catalogue/data.ts` : colonnes facultatives en cascade ;
  - `web/tests/catalogue/cartes-design.ts` : `couverture: null` ;
  - `web/src/lib/admin/types.ts` et `web/src/lib/admin/data.ts` : `FormationAdmin.couverture` ;
  - `web/src/lib/admin/actions.ts` : deux actions ;
  - `web/next.config.ts` : `images.remotePatterns`.
- Test : `web/tests/couvertures/regles.test.ts`, `web/tests/couvertures/actions.test.ts`, `web/tests/catalogue/data.test.ts`

**Interfaces :**
- Produces :
  - **règles** (`lib/couvertures/regles.ts`) :
    - `COUVERTURE_MAX_OCTETS = 5 * 1024 * 1024` ;
    - `detecterImage(octets: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null`. WebP = `RIFF` (0–3) et `WEBP` (8–11) ;
    - `extensionDe(type): "jpg" | "png" | "webp"` ;
    - `verifierCouverture(fichier: { size: number }, octets: Uint8Array): { ok: true; type; extension } | { ok: false; erreur: string }` ;
    - `cheminValide(formationId: string, chemin: string): boolean` ;
  - **adresse** (`lib/couvertures/adresse.ts`) :
    - `urlCouverture(chemin: string | null, supabaseUrl?: string): string | null` → `${supabaseUrl}/storage/v1/object/public/couvertures/${chemin}`. L'adresse vient par défaut de `NEXT_PUBLIC_SUPABASE_URL` ; null sans chemin ou sans adresse ;
    - `motifsImages(supabaseUrl?: string)` : les `remotePatterns` de `next.config` (`https`, hôte de l'URL, `pathname: "/storage/v1/object/public/couvertures/**"`), vide sans adresse ;
  - **lectures** : `listCatalogue`, `getFiche`, `listFiches` lisent `couverture`. Sur `42703`, on relit avec `", note_moyenne, nb_avis"`, puis sans colonne facultative ;
  - **actions** (`"use server"`, `exigerEquipe()`, `refresh()`), qui rendent `Resultat` :
    - `enregistrerCouverture(formationId: string, chemin: string)` : refuse un identifiant ou un chemin invalide avec « Ce fichier n’est pas dans le dossier de la formation. » ; met à jour la colonne ; supprime l'ancien fichier s'il était différent (un échec de suppression ne fait pas échouer l'action) ;
    - `retirerCouverture(formationId: string)` : vide la colonne, puis supprime le fichier.
- [ ] **Step 1 : tests** :
  - **règles** :
    - signatures JPEG, PNG et WebP reconnues ; un PDF (`%PDF`) et un GIF refusés ;
    - 5 Mo pile accepté, 5 Mo + 1 octet refusé (« L’image dépasse 5 Mo. ») ;
    - `cheminValide` : vrai pour `<id>/<uuid>.webp`, faux pour un autre dossier, un sous-dossier ou `.gif` ;
  - **adresse** : `urlCouverture` exacte, null sans chemin ; `motifsImages`.
  - **actions** (faux client) :
    - enregistrement : `update` puis `remove` de l'ancien ;
    - chemin d'une autre formation refusé ;
    - suppression qui échoue sans faire échouer l'action ;
    - retrait ; refus hors équipe ;
  - **catalogue** :
    - `couverture` lue ;
    - `42703` avec la colonne, puis de nouveau `42703` sans elle → troisième lecture sans colonne facultative (`couverture: null`, `note: null`) ;
    - `42703` sur la seule couverture → les notes restent.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS, suite complète.
- [ ] **Step 5 : commit** `feat(couvertures): règles, lectures et actions des images de couverture`

### Task 3: Composant `Couverture` et cartes

**Files :**
- Create : `web/src/components/ui/Couverture.tsx`
- Modify :
  - `web/src/components/ui/CourseCard.tsx` : `CardShell` gagne `couverture?: string | null` (une URL) ;
  - `web/src/components/ui/CatalogCard.tsx`, `web/src/components/catalogue/CarteFormation.tsx`, `web/src/components/mes-formations/CarteSuivie.tsx` (`VueCarteSuivie.couverture: string | null`, une URL) ;
  - la vitrine si elle ne compile plus.
- Test : `web/tests/ui/couverture.test.tsx`, `web/tests/ui/cards.test.tsx`

**Interfaces :**
- Produces :
  - `Couverture({ src, parcours, sizes, priority?, className })` :
    - avec `src` : `next/image` en `fill`, `object-cover`, dans un cadre `aspect-video` ;
    - sinon : fond clair du parcours et `CourseIllustration` (64 px) au centre, `aria-hidden`.
  - **`CardShell`** :
    - la couverture en haut, pleine largeur (bord à bord, coins supérieurs arrondis comme la carte), puis le contenu ;
    - les étiquettes (`parcoursTag`, `tag`) posées en haut à droite de l'image ;
    - l'ancienne rangée « illustration + étiquettes » disparaît.
- [ ] **Step 1 : tests** :
  - **`Couverture`** :
    - avec `src`, une `img` (`alt=""`) dont l'adresse contient l'URL de la couverture, et la classe `object-cover` ;
    - sans `src`, pas d'`img`, et la couverture par défaut porte la couleur du parcours ;
  - **cartes** :
    - une `CatalogCard` avec couverture montre l'image et le badge « Populaire » sur l'image ;
    - sans couverture, la couverture par défaut ;
    - le titre reste le nom du lien.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. `CarteFormation` et `versVueCarte` passent `urlCouverture(fiche.couverture)`. **Step 4 :** → PASS, suite complète (les tests des cartes et des pages qui cherchaient l'illustration sont adaptés).
- [ ] **Step 5 : commit** `feat(couvertures): image de couverture sur les cartes, couverture par défaut du parcours`

### Task 4: Fiche, Accueil, leçon et image de partage

**Files :**
- Modify :
  - `web/src/components/catalogue/FichePublique.tsx` : bandeau, à droite du texte, au-dessus sous 1024 px ;
  - `web/src/components/catalogue/FicheConnectee.tsx` : en tête de la colonne de droite ;
  - `web/src/lib/accueil/regles.ts` (`Reprise.couverture: string | null`, une URL) et `web/src/components/accueil/CarteReprise.tsx` : vignette 16:9 de 112 px de large à la place de l'illustration ;
  - `web/src/components/lecon/ProgrammeLecon.tsx` : vignette 16:9 en haut du programme ;
  - `web/src/app/(catalogue)/formations/[slug]/opengraph-image.tsx`.
- Test : `web/tests/catalogue/fiche.test.tsx`, `web/tests/accueil/*.test.tsx`, `web/tests/lecon/*.test.tsx` (programme), `web/tests/catalogue/image-partage.test.ts`

- [ ] **Step 1 : tests** :
  - fiche publique et fiche connectée : l'image de la couverture quand elle existe, la couverture par défaut sinon ;
  - `tableauDeBord` : `reprise.couverture` est l'URL de la couverture ;
  - carte « Continuer » : l'image ;
  - programme de la leçon : la vignette ;
  - image de partage : avec couverture, l'image générée contient une `img` qui pointe vers la couverture ; sans couverture, l'image bleue actuelle (test existant).
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS, suite complète.
- [ ] **Step 5 : commit** `feat(couvertures): couverture sur la fiche, la carte « Continuer », la leçon et l'image de partage`

### Task 5: Envoi au back-office

**Files :**
- Create : `web/src/components/admin/CouvertureEditor.tsx` (client)
- Modify : `web/src/components/admin/FormationInfosForm.tsx` (le bloc, en tête de l'onglet Informations, hors du formulaire)
- Test : `web/tests/admin/couverture-editor.test.tsx`

**Interfaces :**
- Consumes :
  - `verifierCouverture`, `extensionDe` (Task 2) ;
  - `enregistrerCouverture`, `retirerCouverture` (Task 2) ;
  - `Couverture` (Task 3) ;
  - `createClient` navigateur (`@/lib/supabase/client`), comme `RessourcesEditor`.
- Produces : `CouvertureEditor({ formationId: string; parcours: CouleurParcours; couverture: string | null })`, où `couverture` est l'URL.

- [ ] **Step 1 : tests** (client Supabase navigateur et actions simulés) :
  - **sans image** : la couverture par défaut, le conseil et « Choisir une image » ;
  - **envoi d'un JPEG** :
    - dépôt dans `couvertures` sous `<formationId>/<uuid>.jpg` ;
    - puis `enregistrerCouverture(formationId, chemin)` ;
    - puis le toast « Image de couverture enregistrée. » ;
  - **refus avant l'envoi** :
    - un fichier PDF renommé `.jpg` : « Choisissez une image JPG, PNG ou WebP. » ;
    - un fichier de 6 Mo : « L’image dépasse 5 Mo. » ;
    - dans les deux cas, aucun dépôt ;
  - **échec de l'enregistrement** : le fichier déposé est supprimé, et l'erreur s'affiche ;
  - **avec image** : « Remplacer » et « Retirer » ; « Retirer » → « Retirer l’image de couverture ? » → `retirerCouverture` → le toast.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS ; suite, `tsc`, `eslint`.
- [ ] **Step 5 : commit** `feat(couvertures): envoi de l'image de couverture au back-office`

### Task 6: Guide et vérifications

- [ ] Guide, section 17 « Valider les images de couverture » :
  - appliquer la 0012 ;
  - au back-office, envoyer une image à une formation, puis vérifier :
    - la carte du catalogue ;
    - la fiche ;
    - la carte « Continuer » ;
    - la page de la leçon ;
  - essayer un PDF et une image de plus de 5 Mo ;
  - remplacer l'image, puis la retirer.
- [ ] Suite, `tsc`, `eslint`, `npm run build`.
- [ ] Rendu mesuré avec la feuille de styles du build, à 1440, 390 et 320 px : aucun débordement. Pages :
  - cartes avec et sans image, image bandeau et portrait ;
  - fiche ;
  - carte « Continuer ».
- [ ] Commit `docs: guide de validation des images de couverture`
