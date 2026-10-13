# Tâche 1.8 — Ressources et visualiseur intégré : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** « Consulter » ouvre un visualiseur intégré. Un PDF en consultation seule s'y affiche page par page, sans bouton de téléchargement ni d'impression ; une image s'y affiche aussi. Le visualiseur ne prétend pas être une protection absolue.

**Architecture :**
- **Action serveur `lienConsultation(ressourceId)`** : lien temporaire (60 s) sans `download`. Seulement pour une ressource en consultation seule, d'une leçon ouverte (règles de la base).
- **Affichage des PDF avec pdf.js** (`pdfjs-dist`, version exacte 6.3.289, publiée le 29 août 2026) :
  - le fichier est lu une fois (`fetch` → `ArrayBuffer`), donc le lien de 60 s peut expirer ensuite ;
  - pages dessinées dans des `canvas`, à la demande quand elles approchent de l'écran.
  - Pourquoi pas le lecteur PDF du navigateur : sur Android, Chrome ne l'affiche pas dans la page, il télécharge le fichier.
- **Adaptateur injectable** (`ouvrirPdf`), comme pour la vidéo : jsdom ne sait pas exécuter pdf.js, les tests utilisent un faux document.
- **Composant `VisualiseurRessource`** : la boîte de dialogue du design system (`Dialog`), en grand sur ordinateur et en plein écran sur téléphone.

**Tech Stack :** Next.js 16.4, React 19, pdfjs-dist 6.3.289, Supabase Storage, Vitest.

**Spec :** `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` §6 Ressources. **Design :**
- le design n'a pas d'écran de visualiseur : planche des modales (NdCModales) pour le cadre ;
- bouton « Consulter » (`ViewIcon`) : annexe 1.5 §2.9 et §3.6.

## Global Constraints

- **Consulter** : seulement pour une ressource en consultation seule (PDF, JPG, PNG, WebP). Une ressource téléchargeable garde « Télécharger » (1.5).
- **Dialogue** :
  - titre = titre de la ressource ;
  - ordinateur : largeur 960 px au plus, hauteur 90 % de l'écran ; téléphone : plein écran ;
  - fermeture par la croix, Échap, ou un clic hors du cadre (comportement de `Dialog`) ;
  - aucun lien ni bouton de téléchargement ou d'impression ;
  - mention discrète en bas : « Document en consultation seule. ».
- **PDF** :
  - pages empilées, chacune dans un `canvas` à la largeur du cadre (ratio de l'appareil compris, pour rester net) ;
  - nommées « Page 1 sur 12 » (`role="img"`, `aria-label`) ;
  - rendues quand elles arrivent à moins d'un écran (`IntersectionObserver`) ;
  - zoom : « Réduire » / « Agrandir » (75 %, 100 %, 125 %, 150 %, 200 %), défilement horizontal au-delà de 100 % ;
  - compteur « 12 pages ».
- **Image** : `img` avec `alt` = titre, ajustée au cadre.
- **Dissuasion, sans promesse** :
  - menu contextuel coupé sur les pages et l'image, et image non déplaçable ;
  - contenu masqué à l'impression (`print:hidden`, avec à sa place « L’impression de ce document n’est pas disponible. ») ;
  - **aucune** phrase promettant une protection.
- **États** :
  - chargement (`Spinner` + « Chargement du document… ») ;
  - erreur (« Ce document n’a pas pu être affiché. » + bouton « Réessayer ») ;
  - lien refusé par l'action : son message.
- **Textes** : français, vouvoiement, apostrophes typographiques. **Commits** : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Ressource téléchargeable passée à `lienConsultation`** : refusée (« Ce fichier se télécharge. »). Ressource d'une leçon fermée : refusée (règles de la base). → Task 1.
- **Lien expiré pendant la lecture d'un long PDF** : le fichier est lu une fois à l'ouverture, les pages suivantes s'affichent quand même. → Task 2.
- **PDF de 50 Mo ou de 300 pages** : seules les pages proches de l'écran sont dessinées ; le téléphone reste fluide. → Task 2.
- **Fermer puis rouvrir** : le document est libéré (`destroy`), aucune fuite de mémoire ; un nouveau lien est demandé. → Task 2.
- **Le worker de pdf.js** se charge dans Next (Turbopack, dev et build). → Task 3, vérifié dans le navigateur.

---

### Task 1: Lien de consultation

**Files :** Modify `web/src/lib/lecon/actions.ts` ; Test `web/tests/lecon/actions.test.ts`

**Interfaces :**
- Produces : `lienConsultation(ressourceId: string): Promise<{ url: string; format: string } | { erreur: string }>` :
  - identifiant non UUID ou ressource absente → « Ce fichier n’est pas accessible. » ;
  - ressource téléchargeable → « Ce fichier se télécharge. » ;
  - format non consultable → « Ce format ne s’affiche pas ici. » ;
  - sinon `createSignedUrl(fichier, 60)`, sans `download` → `{ url, format }`.

- [ ] **Step 1 : tests** : les trois refus ; le lien accordé (60 s, sans option `download`, format rendu) ; lien impossible → « Le lien n’a pas pu être créé. Réessayez. ».
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(ressources): lien de consultation`

### Task 2: Visualiseur

**Files :**
- Create : `web/src/lib/ressources/pdf.ts` (`ouvrirPdf`), `web/src/components/lecon/VisualiseurRessource.tsx`
- Modify : `web/package.json` (`pdfjs-dist` `6.3.289`, version exacte)
- Test : `web/tests/lecon/visualiseur.test.tsx`

**Interfaces :**
- Produces :
  - `type DocumentPdf = { pages: number; dessiner(page: number, canvas: HTMLCanvasElement, largeur: number): Promise<void>; fermer(): void }` ;
  - `ouvrirPdf(donnees: ArrayBuffer): Promise<DocumentPdf>` (import dynamique de `pdfjs-dist`, worker `pdf.worker.min.mjs` par `new URL(…, import.meta.url)`, `isEvalSupported: false`) ;
  - `VisualiseurRessource({ ressource: RessourceLecon | null, onFermer, ouvrir?: typeof ouvrirPdf, consulter?: typeof lienConsultation })`.

- [ ] **Step 1 : tests** (faux document de 3 pages, `fetch` simulé) :
  - ouverture → `lienConsultation(id)` → `fetch(url)` → `ouvrir(données)` ;
  - le titre ; « 3 pages » ; trois pages nommées « Page 1 sur 3 »… ;
  - aucun lien ni bouton « Télécharger » ou « Imprimer » dans le dialogue ;
  - « Agrandir » → 125 %, page redessinée plus large ; « Réduire » jusqu'à 75 %, puis le bouton est désactivé ;
  - image → `img` au bon `alt`, sans `fetch` du PDF ;
  - échec du lien → son message ; échec de lecture → « Ce document n’a pas pu être affiché. » puis « Réessayer » qui relance ;
  - fermeture → `fermer()` sur le document ;
  - « Document en consultation seule. ».
- [ ] **Step 2 :** → FAIL. **Step 3 :**
  - installer `pdfjs-dist@6.3.289` (exacte) ;
  - implémenter (dessin des pages : `getViewport({ scale })` ajusté à la largeur × `devicePixelRatio`, `render({ canvasContext, viewport }).promise`).

  **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(ressources): visualiseur intégré (PDF page par page, images)`

### Task 3: Bouton « Consulter », guide et vérifications

**Files :** Modify `web/src/components/lecon/RessourcesLecon.tsx` ; `docs/guides/ce-qui-te-revient.md` (section 12) ; Test `web/tests/lecon/ressources.test.tsx`

- [ ] **Step 1 : tests** :
  - « Consulter Guide des tableaux croisés » est actif et ouvre le visualiseur (titre du dialogue) ;
  - « Télécharger » inchangé.
- [ ] **Step 2 :** → FAIL. **Step 3 :** intégrer. **Step 4 :** → PASS.
- [ ] **Step 5 : vérification réelle de pdf.js**, dans le navigateur, sur le serveur local :
  - une page temporaire (jamais commitée, supprimée aussitôt) ouvre un petit PDF de `public/` avec `ouvrirPdf` et dessine sa page 1 ;
  - on vérifie que le worker se charge et que le canvas n'est pas vide ;
  - même contrôle avec `npm run build`.
- [ ] **Step 6 : guide**, section 12 « Valider le visualiseur (tâche 1.8) » :
  1. Au back-office, ajouter à une leçon ouverte un PDF de plusieurs pages en consultation seule, et une image.
  2. Sur la page leçon, onglet Ressources : « Consulter » ouvre le document ; pas de bouton de téléchargement ni d'impression ; zoom.
  3. Sur téléphone : plein écran, défilement des pages.
  4. Ctrl + P : le document ne s'imprime pas.
- [ ] **Step 7 :** suite, `tsc`, `eslint`, `npm run build`.
- [ ] **Step 8 : commit** `feat(ressources): bouton « Consulter » et guide de validation`
