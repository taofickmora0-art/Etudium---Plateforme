# Fin du lot 4 : éditeur riche, brouillons et versions — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un éditeur de leçon riche (titres, listes, images, tableaux, blocs d'information, vidéos), enregistré automatiquement dans un brouillon que l'on publie, et un historique des versions de chaque formation, restaurable dans le brouillon.

**Architecture :**
- **Contenu :** le contenu d'une leçon devient un document JSON de l'éditeur (Tiptap), vérifié par une liste fermée côté serveur et affiché par un rendu React fermé. Il est gardé dans `lecons_contenus.document`, et les images dans un espace privé `images_lecons`.
- **Brouillons :** ils vivent dans deux tables fermées, écrites par des fonctions `security definer`. Ces fonctions choisissent entre brouillon et écriture directe selon la visibilité, et refusent un conflit de révision.
- **Versions :** ce sont des instantanés JSON de la formation, pris à chaque publication. La restauration les remet dans les brouillons.

**Tech Stack :** Next.js 16 (`web/`), Supabase (Postgres, Storage), Tiptap 3.31.3 (ajout de `@tiptap/extension-table` 3.31.3), zod 4, Vitest (jsdom, banc PGlite `tests/db/banc.ts`, faux Supabase `tests/admin/faux-supabase.ts`).

**Spec :** `docs/superpowers/specs/2026-11-01-lot-4-editeur-riche-versions-design.md`

## Global Constraints

- Tous les textes de l'interface en français, typographie française : espace insécable avant « : ; ? ! », guillemets « », apostrophe ’.
- Migrations rejouables (`create or replace`, `if not exists`, `drop … if exists`), fonctions `security definer` avec `set search_path = ''`, droits retirés à `public, anon` puis accordés explicitement.
- Droits d'édition : `public.equipe_contenus() or public.formateur_de(<formation>)` (la suspension est déjà comprise).
- Une formation est « visible » quand `statut <> 'brouillon'` ; une leçon est visible quand sa formation est visible et `lecons.publiee`.
- Limites du document : 20 000 caractères de texte, 300 Ko (307 200 octets) de JSON, 40 images, 10 tableaux.
- Images : JPEG, PNG, WebP, 5 Mo (5 242 880 octets) ; chemin `{formation}/{uuid}.{jpg|png|webp}` ; liens signés de 3 600 s.
- Sauvegarde automatique : 1 500 ms après la dernière modification ; nouveaux essais après 2 000, 5 000 puis 15 000 ms.
- Jamais d'HTML injecté : le rendu ne construit que les éléments de la liste fermée.
- Un client (`"use client"`) n'importe jamais un module qui importe `next/headers` ou `@/lib/supabase/server` (test `tests/build/imports-client.test.ts`).
- Ne jamais lancer prettier. Écrire les fichiers en LF.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Contenu collé depuis Word ou Google Docs** (couleurs, polices, images en `data:`). Le schéma de l'éditeur ne garde que les blocs connus. Le serveur refuse une image dont le chemin n'est pas un fichier de l'espace `images_lecons`. Test : `validerDocument` refuse `chemin: "data:image/png;base64,…"` (tâche 1).
2. **Frappe rapide pendant qu'une sauvegarde est en route.** Les sauvegardes partent l'une après l'autre. La suivante part avec la révision rendue par la précédente, et c'est le dernier contenu qui gagne. Test dans `useSauvegardeAuto` (tâche 9).
3. **Publication par quelqu'un d'autre pendant qu'un éditeur est ouvert sur le brouillon.** Ce brouillon a disparu, et la sauvegarde suivante doit être refusée comme conflit, pas recréer un brouillon à partir d'un contenu périmé. Test SQL (tâche 7).
4. **Contenu au-delà des limites.** Le message clair s'affiche dans l'indicateur, et la copie de l'appareil garde le texte. Tests dans l'action (tâche 8) et le hook (tâche 9).
5. **Ouvrir une leçon ancienne (Markdown) sans la toucher.** Aucune sauvegarde ne doit partir, et la base ne doit pas être réécrite. Test (tâche 10).

---

## Étape A — le contenu riche (migration 0055)

### Task 1 : le format du document

**Files :**
- Create : `web/src/lib/lecon/document.ts`
- Test : `web/tests/lecon/document.test.ts`

**Interfaces :**
- Produces :
  - `type TonEncadre = "info" | "astuce" | "attention" | "retenir"` ;
  - `type MarqueDoc = { type: "bold" | "italic" | "underline" | "strike" } | { type: "link"; attrs: { href: string } }` ;
  - `type NoeudDoc = { type: string; attrs?: Record<string, unknown>; content?: NoeudDoc[]; text?: string; marks?: MarqueDoc[] }` ;
  - `type DocumentLecon = { type: "doc"; content: NoeudDoc[] }` ;
  - `const LIMITES = { caracteres: 20_000, octets: 307_200, images: 40, tableaux: 10 }` ;
  - `const CHEMIN_IMAGE: RegExp` (`/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/`) ;
  - `validerDocument(brut: unknown): { ok: true; document: DocumentLecon } | { ok: false; message: string }` ;
  - `texteDuDocument(doc: DocumentLecon): string` (texte brut ; un paragraphe ou une cellule par ligne) ;
  - `depuisMarkdown(markdown: string): DocumentLecon` (via `versDocument` de `@/lib/communaute/mise-en-forme`, titres de niveau 1 ramenés à 2) ;
  - `cheminsImages(doc: DocumentLecon): string[]` ;
  - `documentVide(doc: DocumentLecon): boolean`.

**Liste fermée** (types Tiptap) :
- **Blocs de premier niveau :** `paragraph`, `heading` (`level` 2 ou 3), `bulletList`, `orderedList` (`start` entier ≥ 1 facultatif), `blockquote` (contient des `paragraph`), `encadre` (`ton` de `TonEncadre`, contient `paragraph` | `bulletList` | `orderedList`), `imageLecon` (`chemin` CHEMIN_IMAGE, `alt` ≤ 200, `legende` ≤ 300), `table`, `videoLecon` (`fournisseur` reconnu par `estFournisseur`, `id` ≤ 200), `horizontalRule`.
- **Imbrications :**
  - `listItem` contient des `paragraph` ;
  - `table` contient des `tableRow` ;
  - `tableRow` contient des `tableHeader` | `tableCell` (attributs `colspan` 1, `rowspan` 1, `colwidth` null seulement) ;
  - une cellule contient des `paragraph`.
- **Dans un paragraphe ou un titre :** `text` (avec `marks`) et `hardBreak`.
- **Refusé :** tout autre type, attribut ou marque. Un lien dont `adresseDeLien(href)` est faux est refusé aussi.

- [ ] **Step 1 : écrire les tests** :
  - `it("un document de chaque bloc est accepté tel quel")` → `validerDocument(doc).ok === true` et `document` profondément égal à l'entrée ;
  - `it("un bloc inconnu, une marque inconnue ou un attribut en trop sont refusés")` → `{ ok: false, message: "Le contenu contient un élément non reconnu." }` pour `{type:"codeBlock"}`, `marks:[{type:"textStyle"}]`, `heading` `level: 1` ;
  - `it("un lien javascript: est refusé")` → message `"Un lien doit commencer par http:// ou https://."` ;
  - `it("une image collée (data:) ou hors de l'espace est refusée")` → `chemin: "data:image/png;base64,AAAA"` et `"../x.png"` donnent le message `"Le contenu contient un élément non reconnu."` ;
  - `it("les limites")` :
    - 20 001 caractères → `"Le texte dépasse 20 000 caractères."` ;
    - 41 images → `"40 images au plus par leçon."` ;
    - 11 tableaux → `"10 tableaux au plus par leçon."` ;
    - plus de 307 200 octets → `"Le contenu est trop lourd (300 Ko au plus)."` ;
  - `it("texte brut")` → `texteDuDocument` d'un titre + paragraphe + tableau 2×2 = `"Titre\nTexte\nA\tB\nC\tD"` ;
  - `it("depuis le Markdown ancien")` → `depuisMarkdown("# Titre\n\n**gras**")` donne un `heading` niveau 2, puis un paragraphe avec la marque `bold` ;
  - `it("chemins des images et document vide")`.
- [ ] **Step 2 :** `npx vitest run tests/lecon/document.test.ts` → échec (module absent).
- [ ] **Step 3 : implémenter** `document.ts`. Validateur récursif écrit à la main, avec une table `type → { attributs autorisés, enfants autorisés }`. Les comptes (caractères, images, tableaux) se font dans le même parcours ; la taille se mesure avec `new TextEncoder().encode(JSON.stringify(doc)).length`.
- [ ] **Step 4 :** relancer → tout passe.
- [ ] **Step 5 : commit** `feat(lecons): format du contenu riche (liste fermée, limites, conversion du texte ancien)`.

### Task 2 : migration 0055 (colonne, espace d'images, consigne)

**Files :**
- Create : `web/supabase/migrations/0055_contenu_riche.sql`
- Test : `web/tests/db/contenu-riche.test.ts`

**Interfaces :**
- Produces (SQL) :
  - colonne `lecons_contenus.document jsonb`, contrainte `lecons_contenus_document_valide` : `document is null or (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 307200)` ;
  - espace `images_lecons`, privé, 5 242 880 octets, types `image/jpeg`, `image/png`, `image/webp` ;
  - fonction `public.lecture_images_formation(p_nom text) returns boolean`. Vrai pour l'équipe, pour le formateur du dossier, et pour qui a `acces_lecon` sur au moins une leçon de la formation du dossier ;
  - règles sur `storage.objects` :
    - lecture `to anon, authenticated` avec `lecture_images_formation(name)` ;
    - dépôt, remplacement et suppression `to authenticated`, avec `equipe_contenus() or formateur_du_dossier(name)` ;
  - `exercice_etudiant` redéfinie : sa partie `'exercice'` ajoute `'consigne_document', c.document`. On repart de la définition de `0032_exercices.sql`, en vérifiant qu'aucune migration plus récente ne l'a redéfinie (`grep`).

- [ ] **Step 1 : écrire les tests** (banc avec 0001 à 0055) :
  - `it("le document s'enregistre ; un tableau JSON ou un document trop lourd est refusé")` ;
  - `it("images : l'équipe et le formateur de la formation déposent ; un étudiant non")` ;
  - `it("images : lecture pour qui a accès à une leçon de la formation, pas pour un compte sans accès ni pour un visiteur d'une formation payante")` (abonné via `abonner`, non abonné, anon) ;
  - `it("exercice_etudiant renvoie le document de la consigne")`.
- [ ] **Step 2 :** `npx vitest run tests/db/contenu-riche.test.ts` → échec.
- [ ] **Step 3 : écrire la migration** (`begin; … commit;`, en-tête de commentaire comme les autres).
- [ ] **Step 4 :** relancer → tout passe ; relancer aussi `tests/db/exercices.test.ts`.
- [ ] **Step 5 : commit** `feat(lecons): migration 0055, contenu riche et espace des images (0055)`.

### Task 3 : l'affichage du document

**Files :**
- Create : `web/src/components/lecon/DocumentLecon.tsx`, `web/src/lib/lecon/images.ts`
- Test : `web/tests/lecon/document-lecon.test.tsx`, `web/tests/lecon/images.test.ts`

**Interfaces :**
- Consumes : `DocumentLecon`, `NoeudDoc` (tâche 1) ; `LecteurVideo` (`@/components/lecon/LecteurVideo`).
- Produces :
  - `DocumentLecon({ document, images }: { document: DocumentLecon; images: Record<string, string> }): JSX.Element`, composant serveur-compatible (pas de `"use client"`) ;
  - `signerImages(supabase: SupabaseClient, chemins: string[]): Promise<Record<string, string>>` : un seul `createSignedUrls(chemins, 3600)` sur `images_lecons`, chemins absents ignorés, `{}` si la liste est vide ou si la lecture échoue.

**Rendu :**

| Bloc | Élément | Classes |
|---|---|---|
| Titre 2 | `h2` | `text-xl leading-7 font-semibold` |
| Titre 3 | `h3` | `text-[17px] leading-6 font-semibold` |
| Paragraphe | `p` | `text-[15px] leading-6 text-texte` |
| Listes | `ul` / `ol` | |
| Citation | `blockquote` | |
| Encadré | `div` avec `role="note"`, icône Hugeicons | `bg-info-fond text-info-texte` / `reussite` / `attention` / `premium` |
| Image | `figure` > `img` + `figcaption` | |
| Image sans URL signée | « Image indisponible » | |
| Tableau | `div.overflow-x-auto` > `table` | `thead` pour la première ligne si ce sont des `tableHeader` |
| Vidéo | `LecteurVideo` | |
| Séparateur | `hr` | |

Les marques donnent `strong`, `em`, `u`, `s` et `a` (`target="_blank" rel="noopener nofollow ugc"`). Un type inconnu ne rend rien.

L'étiquette de l'encadré est lue par les lecteurs d'écran : « Information », « Astuce », « Attention », « À retenir ».

- [ ] **Step 1 : écrire les tests** :
  - `it("chaque bloc avec son élément")` : rôles `heading` niveaux 2 et 3, `list`, `table` avec `columnheader`, `note` nommée « Astuce », `img` avec `alt`, `figcaption`, `link` avec `rel` ;
  - `it("un bloc inconnu ne rend rien, sans erreur")` ;
  - `it("image sans lien signé : « Image indisponible »")` ;
  - `signerImages` avec un faux client : un appel, la correspondance chemin → URL, `{}` sur erreur.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** relancer → tout passe.
- [ ] **Step 5 : commit** `feat(lecons): affichage du contenu riche`.

### Task 4 : la page leçon et la consigne affichent le document

**Files :**
- Modify : `web/src/lib/lecon/data.ts` (sélection `lecons_contenus(…, document)` ; `versLecon` ; signature des images), `web/src/lib/lecon/types.ts` (ou le fichier où `DonneesLecon.lecon` est typée), `web/src/components/lecon/ContenuLecon.tsx` (l.113 et l.229-230), `web/src/lib/exercices/conversion.ts` + `types.ts` (`consigneDocument: DocumentLecon | null`)
- Test : `web/tests/lecon/page-lecon.test.tsx`, `web/tests/exercices/page.test.tsx`

**Interfaces :**
- Produces : sur la leçon chargée, `document: DocumentLecon | null` et `images: Record<string, string>` ; sur l'exercice, `consigneDocument: DocumentLecon | null` et `images`. Un `document` invalide à la lecture (`validerDocument` faux) vaut `null`, et le texte ancien s'affiche.

- [ ] **Step 1 : ajouter les tests** :
  - `it("une leçon au contenu riche l'affiche ; une leçon ancienne garde son texte mis en forme")` ;
  - `it("la consigne riche d'un exercice")`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 : implémenter.** `ContenuLecon` choisit `DocumentLecon` quand `document` existe, sinon `TexteMisEnForme`.
- [ ] **Step 4 :** relancer `tests/lecon tests/exercices` → tout passe.
- [ ] **Step 5 : commit** `feat(lecons): la page leçon et la consigne affichent le contenu riche`.

### Task 5 : l'éditeur riche

**Files :**
- Modify : `web/package.json` (`"@tiptap/extension-table": "3.31.3"`, puis `npm install --fetch-retries=5`)
- Create :
  - `web/src/lib/editeur/extensions.ts` ;
  - `web/src/components/editeur/EditeurRiche.tsx` ;
  - `web/src/components/editeur/BarreOutils.tsx` ;
  - `web/src/components/editeur/noeuds/Encadre.tsx`, `ImageLecon.tsx`, `VideoLecon.tsx` ;
  - `web/src/lib/editeur/envoi-image.ts` (client) ;
  - `web/tests/editeur/editeur-riche-simule.tsx`
- Test : `web/tests/editeur/editeur-riche.test.tsx`, `web/tests/editeur/envoi-image.test.ts`

**Interfaces :**
- Consumes : `DocumentLecon`, `validerDocument`, `TonEncadre` (tâche 1) ; `parseVideoUrl` (`@/lib/admin/video`) ; `adresseDeLien` ; `createClient` de `@/lib/supabase/client`.
- Produces :
  - `extensionsLecon(placeholder: string)` : StarterKit sans `code`, `codeBlock`, `link`, `heading`, `blockquote`, `listItem`, `trailingNode` ; Titre niveaux [2, 3] ; Lien (même configuration que la communauté) ; Citation `paragraph+` ; ElementDeListe `paragraph+` ; `HorizontalRule` ; `TableKit` (cellules `paragraph+`, pas de redimensionnement) ; nœuds `encadre`, `imageLecon`, `videoLecon` ; `Placeholder` ;
  - `EditeurRiche(props: { formationId: string; valeur: DocumentLecon; images: Record<string, string>; onChange: (doc: DocumentLecon) => void; onBlur?: () => void; etiquette: string; placeholder: string }): JSX.Element`, `"use client"`. Il n'appelle jamais `onChange` au montage ;
  - `envoyerImage(formationId: string, fichier: File): Promise<{ ok: true; chemin: string; url: string } | { ok: false; message: string }>`. Il refuse un type non accepté (`"Format accepté : JPEG, PNG ou WebP."`) et un fichier de plus de 5 Mo (`"L’image dépasse 5 Mo."`), dépose dans `images_lecons` puis signe 3 600 s ;
  - `tests/editeur/editeur-riche-simule.tsx` exporte `EditeurRiche`, avec les mêmes propriétés : une zone de texte dont chaque ligne devient un paragraphe.

**La barre d'outils :**
- boutons avec `aria-label` et `aria-pressed` ;
- un menu « Style » : Texte, Titre, Sous-titre ;
- Gras, Italique, Souligné, Barré, Lien (fenêtre avec champ d'adresse ; refus si `adresseDeLien` est faux) ;
- Liste à puces, Liste numérotée, Citation ;
- Bloc d'information (insère `encadre` ton `info`) ;
- Image (sélecteur de fichier caché) ;
- Tableau (insère 3 × 3 avec ligne d'en-tête) ;
- Vidéo (fenêtre avec lien ; `parseVideoUrl`, message `"Ce lien n’est pas une vidéo reconnue."`) ;
- Séparateur, Annuler, Rétablir.

Elle est collante en haut de la zone, avec `overflow-x-auto` sur téléphone.

**Les menus sur les nœuds :**
- **Tableau** (actif quand le curseur est dans le tableau) : « Ajouter une ligne », « Ajouter une colonne », « Supprimer la ligne », « Supprimer la colonne », « Supprimer le tableau ».
- **Encadré :** un menu de ton.
- **Image :** champs « Texte alternatif » et « Légende », bouton « Retirer ».

Coller ou déposer une image passe par `envoyerImage` ; pendant l'envoi, un repère « Envoi de l’image… » s'affiche.

- [ ] **Step 1 : écrire les tests.** Même préparation jsdom que `tests/communaute/editeur.test.tsx` (Range et `elementFromPoint`).
  - `it("la barre : tous les boutons nommés")` ;
  - `it("rien n'est envoyé à l'ouverture")` → `onChange` pas appelé ;
  - `it("Ctrl+A puis Gras : le document a la marque bold et reste valide")` ;
  - `it("Bloc d'information : un encadre ton info, puis changé en Attention")` ;
  - `it("Tableau : 3 × 3, première ligne en en-tête ; Ajouter une ligne en fait 4")` ;
  - `it("Vidéo : un lien YouTube insère videoLecon ; un lien inconnu affiche le message")` ;
  - `it("Image : envoyerImage simulé, imageLecon avec le chemin, l'image affichée avec l'URL")` ;
  - `envoi-image.test.ts` : format refusé, taille refusée, chemin `{formation}/{uuid}.webp`, erreur de dépôt → `"L’image n’a pas pu être envoyée. Réessayez."`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** relancer → tout passe ; `npx tsc --noEmit -p .` propre.
- [ ] **Step 5 : commit** `feat(editeur): éditeur riche des leçons (titres, listes, images, tableaux, blocs, vidéos)`.

### Task 6 : l'éditeur de leçon utilise l'éditeur riche (enregistrement encore au clic)

**Files :**
- Modify :
  - `web/src/components/admin/EditeurLecon.tsx` (`EditeurRiche` à la place d'`EditeurTexte` ; champ caché `document` en JSON) ;
  - `web/src/lib/admin/actions.ts` `saveLecon` : lit `document`, `validerDocument` (erreur sur le champ `texte`), écrit `document` et `texte = texteDuDocument(document)` ;
  - `web/src/lib/admin/data.ts` (charge `document` ; `depuisMarkdown(texte)` si `document` est vide ; signe les images) ;
  - `web/src/lib/admin/types.ts` (`LeconAdmin.document: DocumentLecon`, `LeconAdmin.images: Record<string, string>`) ;
  - `web/src/lib/admin/schemas.ts` (le texte reste limité à 20 000).
- Test : `web/tests/admin/editeur-lecon.test.tsx` (simulé `vi.mock("@/components/editeur/EditeurRiche", …)`), `web/tests/admin/lecon.test.ts`

- [ ] **Step 1 : adapter et ajouter les tests** :
  - `it("Enregistrer envoie le document et son texte brut")` ;
  - `it("un document refusé : son message sous le texte")` ;
  - `it("une leçon ancienne s'ouvre convertie")`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `npx vitest run tests/admin tests/lecon tests/exercices tests/quiz` → tout passe.
- [ ] **Step 5 : commit** `feat(editeur): l'éditeur de leçon écrit le contenu riche`.

---

## Étape B — brouillons et sauvegarde automatique (migration 0056)

### Task 7 : migration 0056 (brouillons, enregistrement, publication)

**Files :**
- Create : `web/supabase/migrations/0056_brouillons.sql`
- Test : `web/tests/db/brouillons.test.ts`

**Interfaces :**
- **Colonnes :** `lecons.revision integer not null default 0`, `formations.revision integer not null default 0`.
- **Tables** (RLS ; lecture `equipe_contenus() or formateur_de(…)` ; aucune écriture directe) :
  - `brouillons_lecons(lecon_id uuid primary key references lecons on delete cascade, donnees jsonb not null, revision integer not null, modifie_par uuid references profils on delete set null, modifie_le timestamptz not null default now())` ;
  - `brouillons_formations(formation_id uuid primary key references formations on delete cascade, …)`, mêmes colonnes.
- **Données d'une leçon** (`donnees`) : `{ titre, titre_court, resume, points_cles: text[], video_fournisseur, video_id, duree_secondes, document, texte }`.
- **Données d'une formation** : `{ titre, resume, description, objectifs: text[], competences: text[], niveau }`.
- **Fonctions** (`security definer`, `authenticated`) :
  - `edition_lecon(p_lecon uuid) returns jsonb` → `{ donnees, revision, brouillon: bool, en_ligne: bool, modifie_par: text|null, modifie_le }` ;
  - `enregistrer_lecon(p_lecon uuid, p_donnees jsonb, p_revision integer) returns jsonb` :
    - succès : `{ etat: "enregistre", revision, brouillon, enregistre_le }` ;
    - conflit : `{ etat: "conflit", par: <nom de qui a modifié> }` ;
    - refus de droits : exception `42501` `'Vous ne pouvez pas modifier cette leçon.'` ;
    - données invalides : `P0001` avec un message clair (titre vide ou de plus de 120, titre court > 40, résumé > 1000, texte > 20 000, document trop lourd, vidéo incomplète, durée négative) ;
  - `edition_formation(p_formation uuid) returns jsonb` et `enregistrer_infos_formation(p_formation uuid, p_donnees jsonb, p_revision integer) returns jsonb` : même forme (titre 1 à 120, résumé ≤ 160, description ≤ 2000, niveau du type existant) ;
  - `modifications_en_attente(p_formation uuid) returns jsonb` → tableau `[{ type: "formation"|"lecon", id, titre, modifie_par, modifie_le }]`. La formation vient en premier, puis les leçons dans l'ordre des modules et des leçons ;
  - `publier_modifications(p_formation uuid) returns jsonb` → `{ publiees: integer, version: null }` (la 0057 remplira `version`). Droits : l'équipe, ou le formateur si la formation est visible. Applique les brouillons (leçon : `lecons` + `lecons_contenus` ; formation : `formations`), augmente les révisions, efface les brouillons et appelle `marquer_modifiee_par_formateur` si l'auteur est le formateur. Sans brouillon : `{ publiees: 0 }` ;
  - `abandonner_modifications(p_formation uuid, p_lecon uuid default null) returns integer`.
- **Règle du mode** (`enregistrer_*`) :
  - **brouillon** si un brouillon existe ou si l'objet est visible ;
    - un brouillon existe : `p_revision` doit égaler `brouillon.revision` ;
    - pas de brouillon : `p_revision` doit égaler la révision de l'objet ; le brouillon naît avec `revision + 1` ;
  - **direct** sinon : `p_revision` doit égaler la révision de l'objet ; écriture puis `revision + 1` ; `marquer_modifiee_par_formateur` si la formation est publiée et que l'auteur est le formateur.

- [ ] **Step 1 : écrire les tests** :
  - `it("droits : étudiant, formateur d'une autre formation, compte suspendu refusés")` ;
  - `it("leçon invisible : enregistrement direct, révision +1")` ;
  - `it("leçon visible : brouillon ; l'étudiant voit toujours l'ancien contenu")` ;
  - `it("conflit : une révision dépassée est refusée avec le nom de l'auteur")` ;
  - `it("Review Focus 3 : brouillon publié par un autre, puis sauvegarde avec l'ancienne révision → conflit, aucun brouillon recréé")` ;
  - `it("publier : champs appliqués, brouillons effacés, révisions augmentées, date « modifiée par le formateur »")` ;
  - `it("le formateur ne publie pas une formation jamais mise en ligne")` ;
  - `it("abandonner : une leçon, puis toute la formation")` ;
  - `it("informations générales : brouillon quand la formation est visible")` ;
  - `it("données invalides : message clair")`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** écrire la migration.
- [ ] **Step 4 :** relancer → tout passe ; relancer `tests/db/espace-formateur.test.ts tests/db/contenus.test.ts`.
- [ ] **Step 5 : commit** `feat(editeur): brouillons, enregistrement et publication des modifications (0056)`.

### Task 8 : les actions serveur de l'éditeur

**Files :**
- Create : `web/src/lib/editeur/actions.ts` (`"use server"`), `web/src/lib/editeur/types.ts`, `web/src/lib/editeur/saisie.ts` (validation zod partagée)
- Modify : `web/src/lib/admin/actions.ts` (`saveLecon` retiré à la fin de la tâche 10, pas ici)
- Test : `web/tests/editeur/actions.test.ts`

**Interfaces :**
- Produces (`types.ts`) :
  - `type SaisieLecon = { titre: string; titreCourt: string; resume: string; pointsCles: string[]; lienVideo: string; duree: string; document: DocumentLecon }` ;
  - `type SaisieInfos = { titre: string; resume: string; description: string; objectifs: string[]; competences: string[]; niveau: string }` ;
  - `type ResultatSauvegarde = { ok: true; revision: number; brouillon: boolean; enregistreLe: string } | { ok: false; code: "conflit"; par: string | null } | { ok: false; code: "invalide"; erreurs: Record<string, string> } | { ok: false; code: "echec"; message: string }` ;
  - `type EtatEdition<T> = { donnees: T; revision: number; brouillon: boolean; enLigne: boolean; modifiePar: string | null; modifieLe: string | null }` ;
  - `type ModificationEnAttente = { type: "formation" | "lecon"; id: string; titre: string; modifiePar: string | null; modifieLe: string }`.
- Produces (`actions.ts`) :
  - `enregistrerLecon(leconId: string, saisie: SaisieLecon, revision: number): Promise<ResultatSauvegarde>` : validations de `saveLecon` (lien, durée, durée exigée pour une vidéo mesurée, `validerDocument`), puis le RPC `enregistrer_lecon` ;
  - `enregistrerInfosFormation(formationId: string, saisie: SaisieInfos, revision: number): Promise<ResultatSauvegarde>` ;
  - `reglerLecon(leconId: string, reglages: { commentairesActifs: boolean; apercu: boolean; genreExercice?: "simple" | "rendu" }): Promise<Resultat>` : mise à jour directe de `lecons` avec le client de l'utilisateur ;
  - `enregistrerQuestions(leconId: string, questions: unknown): Promise<Resultat>` : RPC `enregistrer_quiz` ;
  - `lireModificationsEnAttente(formationId: string): Promise<Lecture<ModificationEnAttente[]>>` ;
  - `publierModifications(formationId: string): Promise<Resultat & { version?: number | null }>` ;
  - `abandonnerModifications(formationId: string, leconId?: string): Promise<Resultat>`.
- Produces (`saisie.ts`, sans `"use server"`) : `versSaisieLecon(donnees: unknown): SaisieLecon` (fournisseur + identifiant → lien avec `videoLink`, durée → « m:ss », document absent → `depuisMarkdown(texte)`) et `versSaisieInfos(donnees: unknown): SaisieInfos`, utilisées par les chargements des tâches 10 et 11.
- Chaque action appelle `exigerEditeur()`, vérifie les UUID, traduit `estFonctionAbsente` en `"L’éditeur n’est pas encore installé (migration 0056, guide « Ce qui te revient », section 58)."` et appelle `refresh()` après une publication ou un abandon.

- [ ] **Step 1 : écrire les tests** (faux Supabase) :
  - `it("enregistrer : appel du RPC avec les données normalisées (vidéo en fournisseur + identifiant, texte brut)")` ;
  - `it("invalide : lien non reconnu, durée manquante pour YouTube, document refusé → code invalide, sans appel")` ;
  - `it("Review Focus 4 : texte de 20 001 caractères → invalide avec le message des limites")` ;
  - `it("conflit renvoyé tel quel")` ;
  - `it("migration absente → message du guide")` ;
  - `it("publier et abandonner rafraîchissent")`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** relancer → tout passe.
- [ ] **Step 5 : commit** `feat(editeur): actions d'enregistrement, de publication et d'abandon`.

### Task 9 : la sauvegarde automatique (hook, indicateur, copie de l'appareil)

**Files :**
- Create : `web/src/components/editeur/useSauvegardeAuto.ts`, `web/src/components/editeur/IndicateurSauvegarde.tsx`, `web/src/lib/editeur/copie-locale.ts`
- Test : `web/tests/editeur/sauvegarde-auto.test.tsx`, `web/tests/editeur/copie-locale.test.ts`

**Interfaces :**
- Produces :
  - `useSauvegardeAuto<T>(options: { cle: string; valeur: T; revisionInitiale: number; brouillonInitial: boolean; enregistrer: (valeur: T, revision: number) => Promise<ResultatSauvegarde>; delaiMs?: number }): { etat: EtatSauvegarde; enregistrerMaintenant: () => Promise<void>; recuperation: { valeur: T; le: string } | null; recuperer: () => void; ignorer: () => void }` ;
  - `type EtatSauvegarde =`
    - `{ type: "a_jour"; le: string | null; brouillon: boolean }`
    - `| { type: "modifie" }`
    - `| { type: "en_cours" }`
    - `| { type: "hors_ligne" }`
    - `| { type: "echec"; message: string }`
    - `| { type: "conflit"; par: string | null }`
    - `| { type: "invalide"; erreurs: Record<string, string> }` ;
  - `IndicateurSauvegarde({ etat }: { etat: EtatSauvegarde }): JSX.Element`, avec `role="status"`. Libellés :
    - « Modifications non enregistrées » ;
    - « Enregistrement… » ;
    - « Brouillon enregistré à 14 h 32 » / « Enregistré à 14 h 32 » (heure locale `h:mm` → « 14 h 32 ») ;
    - « Hors ligne : vos modifications sont gardées sur cet appareil » ;
    - « Échec de l’enregistrement. Nouvel essai… » ;
  - `copie-locale.ts` :
    - `ecrireCopie(cle: string, valeur: unknown, revision: number): void` ;
    - `lireCopie<T>(cle: string): { valeur: T; revision: number; le: string } | null` ;
    - `effacerCopie(cle: string): void` ;
    - tout est enveloppé de try/catch ; clé `etudium-editeur:` + cle.
- **Comportement :**
  - rien au montage ;
  - chaque changement de `valeur` (comparaison `JSON.stringify`) passe l'état à `modifie`, écrit la copie locale et lance le minuteur de `delaiMs` (1 500 ms par défaut) ;
  - une seule sauvegarde à la fois ; un changement pendant l'envoi repart à la fin, avec la nouvelle révision ;
  - succès : copie effacée si la valeur n'a pas changé depuis ;
  - `echec` : nouveaux essais à 2 000, 5 000 puis 15 000 ms ;
  - `navigator.onLine === false` : `hors_ligne`, puis un nouvel essai à l'événement `online` ;
  - `conflit` et `invalide` : pas de nouvel essai ;
  - `beforeunload` n'est retenu que si l'état est `modifie`, `en_cours`, `echec` ou `hors_ligne` ;
  - à l'ouverture, une copie locale de même `revision` dont la valeur diffère donne `recuperation`.

- [ ] **Step 1 : écrire les tests** (minuteurs simulés) :
  - `it("rien ne part à l'ouverture (Review Focus 5)")` ;
  - `it("1,5 s après la dernière frappe, une seule sauvegarde")` ;
  - `it("Review Focus 2 : changement pendant l'envoi → seconde sauvegarde après la première, avec la révision rendue")` ;
  - `it("échec puis nouvel essai à 2 s ; hors ligne puis reprise à online")` ;
  - `it("conflit : bandeau, plus d'essai")` ;
  - `it("Review Focus 4 : invalide → message, la copie de l'appareil reste")` ;
  - `it("récupération d'une copie plus récente ; ignorer l'efface")` ;
  - `it("indicateur : chaque libellé")` ;
  - `copie-locale` : `localStorage` qui lève une erreur → aucune exception.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** relancer → tout passe.
- [ ] **Step 5 : commit** `feat(editeur): sauvegarde automatique, indicateur et copie de secours`.

### Task 10 : l'éditeur de leçon en sauvegarde automatique

**Files :**
- Modify : `web/src/components/admin/EditeurLecon.tsx`, `web/src/lib/admin/data.ts` (chargement par `edition_lecon` ; repli sur la lecture actuelle si la fonction est absente), `web/src/lib/admin/types.ts` (`LeconAdmin.edition: EtatEdition<…>`), `web/src/components/quiz` (« Enregistrer les questions »), `web/src/lib/admin/actions.ts` (retirer `saveLecon` et ses imports devenus inutiles)
- Create : `web/src/components/editeur/BandeauBrouillon.tsx`
- Test : `web/tests/admin/editeur-lecon.test.tsx` (réécrit sur le nouveau comportement), `web/tests/quiz/editeur.test.tsx`, `web/tests/exercices/editeur.test.tsx`

**Interfaces :**
- Consumes : `useSauvegardeAuto`, `IndicateurSauvegarde`, actions de la tâche 8, `EditeurRiche`.
- Produces : `BandeauBrouillon({ formationId, leconId, brouillon, onAbandon })`. Il affiche « Modifications non publiées », puis « Publier les modifications » (fenêtre de la tâche 12, via `FenetrePublication`) et « Abandonner les modifications de cette leçon » (`ConfirmDialog` ton danger).
- **Barre du haut :**
  - `IndicateurSauvegarde` à la place du bouton « Enregistrer » ;
  - le statut de la leçon et l'œil « Voir comme un étudiant » restent.
- **Champs et enregistrement :**
  - les champs de contenu sont contrôlés et passent par `useSauvegardeAuto` (`cle = "lecon:" + id`) ;
  - les réglages (commentaires, aperçu, genre) passent par `reglerLecon` à chaque changement, avec une notification en cas d'échec ;
  - le quiz garde un bouton « Enregistrer les questions ».
- **Bandeaux :**
  - conflit : « Cette leçon vient d’être modifiée par … Rechargez pour voir sa version. » avec un bouton « Recharger » ;
  - récupération : « Des modifications de cet appareil n’ont pas été enregistrées. » avec « Récupérer » et « Ignorer » ;
  - erreurs invalides sous leurs champs.
- **Quitter :** le `ConfirmDialog` « Quitter sans enregistrer ? » disparaît ; seul `beforeunload` reste (géré par le hook).
- **Perte du focus :** `onBlur` de l'éditeur riche et des champs appelle `enregistrerMaintenant()`.

- [ ] **Step 1 : réécrire et ajouter les tests** :
  - `it("plus de bouton Enregistrer ; l'indicateur dit Enregistré")` ;
  - `it("modifier le titre : 1,5 s plus tard enregistrerLecon reçoit la saisie et la révision")` ;
  - `it("leçon en ligne : « Brouillon enregistré », bandeau Publier / Abandonner")` ;
  - `it("conflit : bandeau et Recharger")` ;
  - `it("réglages enregistrés aussitôt par reglerLecon")` ;
  - `it("quiz : Enregistrer les questions")` ;
  - `it("leçon ancienne ouverte sans modification : aucune sauvegarde (Review Focus 5)")`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `npx vitest run tests/admin tests/quiz tests/exercices tests/formateur` → tout passe.
- [ ] **Step 5 : commit** `feat(editeur): l'éditeur de leçon s'enregistre tout seul, dans un brouillon si elle est en ligne`.

### Task 11 : l'onglet Informations en deux cartes

**Files :**
- Create : `web/src/components/editeur/InfosGenerales.tsx`
- Modify : `web/src/components/admin/FormationInfosForm.tsx` (devient la carte « Réglages » : adresse, formateur, badge, seuil, score, certification, parcours, monétisation, gratuite), `web/src/lib/admin/actions.ts` (`saveFormationInfos` n'écrit plus titre, résumé, description, objectifs, compétences ni niveau), `web/src/lib/admin/data.ts` (`edition_formation`), pages `admin/formations/[id]/page.tsx` et `formateur/formations/[id]/page.tsx` (ou `EditeurFormateur.tsx`)
- Test : `web/tests/admin/formation-form.test.tsx`, `web/tests/editeur/infos-generales.test.tsx`

**Interfaces :**
- Produces : `InfosGenerales({ formationId, edition }: { formationId: string; edition: EtatEdition<SaisieInfos> })`. Sauvegarde automatique (`cle = "formation:" + id`), indicateur, étiquette « Modifications non publiées » quand il y a un brouillon. Mêmes champs, aides et limites qu'aujourd'hui.

- [ ] **Step 1 : écrire les tests** :
  - `it("Informations générales : sauvegarde automatique ; Réglages : bouton Enregistrer")` ;
  - `it("saveFormationInfos ne touche plus aux champs de contenu")`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `npx vitest run tests/admin tests/formateur` → tout passe.
- [ ] **Step 5 : commit** `feat(editeur): informations générales enregistrées toutes seules, réglages à part`.

### Task 12 : publier, abandonner et les repères

**Files :**
- Create : `web/src/components/editeur/FenetrePublication.tsx`, `web/src/components/editeur/BoutonPublierModifications.tsx`
- Modify : `PublicationPanel.tsx`, `PublicationFormateur.tsx`, l'en-tête de l'éditeur de formation (pages `admin/formations/[id]/page.tsx` et `EditeurFormateur.tsx` : `BoutonPublierModifications` à côté du titre), `OngletLecons.tsx` (étiquette « Modifiée, non publiée »), `web/src/app/(app)/admin/formations/page.tsx` et la liste de l'espace formateur (« Modifications non publiées »), `web/src/lib/admin/data.ts` (présence des brouillons : `brouillons_lecons(lecon_id)` et `brouillons_formations(formation_id)` dans les sélections ; repli si les tables sont absentes)
- Test : `web/tests/editeur/publication.test.tsx`, `web/tests/admin/onglet-lecons.test.tsx`

**Interfaces :**
- Produces :
  - `BoutonPublierModifications({ formationId, visible }: { formationId: string; visible: boolean })`. Rien si `visible` est faux. Il ouvre `FenetrePublication`.
  - `FenetrePublication({ formationId, ouverte, onFermer })`. Elle charge `lireModificationsEnAttente` et liste « Informations générales » ou « Leçon N : titre », avec « par X, à 14 h 32 ». Le bouton « Publier » appelle `publierModifications` ; la notification dit « Modifications publiées : version N. » (sans numéro avant la 0057 : « Modifications publiées. »). Rien en attente : « Aucune modification à publier. »
  - Dans l'onglet Publication : « Abandonner les modifications » pour toute la formation (`ConfirmDialog`).

- [ ] **Step 1 : écrire les tests** :
  - `it("la fenêtre liste les modifications et publie")` ;
  - `it("abandonner toute la formation")` ;
  - `it("étiquettes dans la liste des leçons et des formations")`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** relancer `tests/editeur tests/admin tests/formateur` → tout passe.
- [ ] **Step 5 : commit** `feat(editeur): publier ou abandonner les modifications ; repères des brouillons`.

### Task 13 : l'aperçu montre le brouillon à ceux qui modifient

**Files :**
- Modify : `web/src/lib/lecon/data.ts` (`getLeconDans` : si un brouillon de la leçon est lisible (RLS = éditeur), ses champs remplacent l'en-ligne, avec `brouillon: true`), lecture de la fiche (`src/lib/catalogue/…`, informations générales du brouillon pour un éditeur), `EnTeteLecon` et la fiche connectée (étiquette `Tag` « Brouillon »)
- Test : `web/tests/lecon/apercu-editeur.test.tsx`

- [ ] **Step 1 : écrire les tests** :
  - `it("un éditeur voit le brouillon avec l'étiquette ; sans brouillon, l'en-ligne")` ;
  - `it("la fiche d'un éditeur montre la description du brouillon")`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `npx vitest run tests/lecon tests/catalogue` → tout passe.
- [ ] **Step 5 : commit** `feat(editeur): l'aperçu montre le brouillon à l'équipe et au formateur`.

---

## Étape C — historique des versions (migration 0057)

### Task 14 : migration 0057 (versions, restauration)

**Files :**
- Create : `web/supabase/migrations/0057_versions_formations.sql`
- Test : `web/tests/db/versions.test.ts`

**Interfaces :**
- **Table** `versions_formations(id uuid primary key default gen_random_uuid(), formation_id uuid not null references formations on delete cascade, numero integer not null, cree_le timestamptz not null default now(), auteur_id uuid references profils on delete set null, resume text not null, contenu jsonb not null, unique (formation_id, numero))`. RLS : lecture par les éditeurs ; aucune écriture directe.
- **Fonctions internes** (exécution retirée à tous) :
  - `instantane_formation(p_formation uuid) returns jsonb` → `{ infos: {…SaisieInfos en snake_case}, modules: [{ id, titre, ordre, lecons: [{ id, titre, titre_court, type, ordre, publiee, resume, points_cles, video_fournisseur, video_id, duree_secondes, document, texte }] }] }` ;
  - `noter_version(p_formation uuid, p_resume text) returns integer` (numéro = max + 1, auteur `auth.uid()`).
- **Déclencheurs :**
  - `formations` après `update of statut`, quand le nouveau statut vaut `publiee` et l'ancien non → « Mise en ligne » ;
  - `lecons` après `update of publiee`, quand la formation est visible → « Leçon « titre » mise en ligne » ou « Leçon « titre » retirée ».
- **`publier_modifications` redéfinie :** même corps qu'en 0056 et `noter_version`. Résumé :
  - « Informations générales modifiées » ;
  - « 2 leçons modifiées » ;
  - « Informations générales et 2 leçons modifiées » ;
  - « Leçon « titre » modifiée » (une seule leçon).

  Retour : `{ publiees, version }`.
- **`versions_formation(p_formation uuid) returns jsonb`** → `[{ id, numero, cree_le, auteur: text|null, resume, en_ligne: bool }]`, le plus récent d'abord. `en_ligne` vaut vrai pour la plus récente seulement.
- **`restaurer_version(p_version uuid) returns jsonb`** → `{ numero, infos: bool, lecons_modifiees: int, lecons_recreees: int }`. Mêmes droits que la modification. Ce qu'elle fait (spec §3.4) :
  - écrit dans les brouillons selon la règle du mode, et augmente la révision du brouillon ou de l'objet (un éditeur ouvert reçoit alors un conflit) ;
  - recrée une leçon supprimée non publiée, `ordre = max + 1` dans son module ;
  - recrée le module absent avec `ordre = max + 1` ;
  - un quiz recréé n'a pas de questions.

- [ ] **Step 1 : écrire les tests** :
  - `it("mise en ligne : version 1 « Mise en ligne »")` ;
  - `it("publier des modifications : version 2 avec son résumé et son auteur")` ;
  - `it("publier ou retirer une leçon d'une formation en ligne : une version")` ;
  - `it("liste : la plus récente en ligne ; auteur supprimé → null")` ;
  - `it("restaurer : brouillons remplis, l'étudiant ne voit rien changer, puis publier")` ;
  - `it("restaurer une leçon supprimée : recréée non publiée ; un quiz sans questions ; module recréé")` ;
  - `it("restaurer pendant qu'un brouillon existe : remplacé, révision augmentée")` ;
  - `it("droits : étudiant et autre formateur refusés")`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** écrire la migration.
- [ ] **Step 4 :** relancer → tout passe ; relancer `tests/db/brouillons.test.ts`.
- [ ] **Step 5 : commit** `feat(editeur): historique des versions et restauration dans le brouillon (0057)`.

### Task 15 : l'onglet Historique

**Files :**
- Create : `web/src/components/editeur/OngletHistorique.tsx`, `web/src/lib/editeur/versions.ts` (lecture côté serveur)
- Modify : `web/src/lib/editeur/actions.ts` (`restaurerVersion`), `web/src/lib/editeur/types.ts`, `FormationOnglets.tsx` (onglet `historique`, libellé « Historique », visible s'il y a au moins une version), pages admin et formateur de la formation, `PublicationPanel.tsx` et `PublicationFormateur.tsx` (« Version N · aujourd’hui », « hier », sinon la date)
- Test : `web/tests/editeur/historique.test.tsx`

**Interfaces :**
- Produces :
  - `type VersionFormation = { id: string; numero: number; creeLe: string; auteur: string | null; resume: string; enLigne: boolean }` ;
  - `lireVersions(formationId: string): Promise<Lecture<VersionFormation[]>>` ;
  - `restaurerVersion(versionId: string): Promise<Resultat & { resume?: string }>`. Le message suit le modèle « Version 5 restaurée dans le brouillon : 3 leçons modifiées, 1 leçon recréée (non publiée). Relisez, puis publiez. » ; on omet les parties nulles et on accorde le singulier ;
  - `OngletHistorique({ versions }: { versions: VersionFormation[] })` :
    - liste avec « Version 8 », date « 1er novembre 2026 à 14 h 32 », « par Aïcha Kpadé » ou « par un compte supprimé », résumé ;
    - étiquette « En ligne » ;
    - « Restaurer dans le brouillon » avec un `ConfirmDialog` : titre « Restaurer la version 5 ? », texte de la spec §3.3.

- [ ] **Step 1 : écrire les tests** :
  - `it("liste et étiquette En ligne")` ;
  - `it("restaurer : fenêtre, appel, message")` ;
  - `it("onglet absent sans version ; Version N dans Publication")`.
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `npx vitest run tests/editeur tests/admin tests/formateur` → tout passe.
- [ ] **Step 5 : commit** `feat(editeur): onglet Historique et restauration`.

### Task 16 : guide, vérification et relecture finale

**Files :**
- Modify : `docs/guides/ce-qui-te-revient.md` (section 58 : migrations 0055 à 0057, tests de la spec §5)

- [ ] **Step 1 :** écrire la section 58 du guide.
- [ ] **Step 2 :** `npx tsc --noEmit -p .`, `npx eslint src tests` puis `npx vitest run` → tout passe.
- [ ] **Step 3 : vérification visuelle** avec une page d'essai temporaire `src/app/vitrine/essai-editeur/page.tsx`, qui rend `EditeurRiche` et `DocumentLecon` sur un document de chaque bloc. Elle est supprimée ensuite et jamais commitée. Captures sur ordinateur et sur téléphone.
- [ ] **Step 4 :** relecture finale de la branche par un relecteur sur le modèle le plus capable ; correctifs.
- [ ] **Step 5 : commit** `docs: guide section 58 (éditeur riche, brouillons, versions)`.
