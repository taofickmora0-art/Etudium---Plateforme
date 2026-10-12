# Tâche 1.5 — Interface de cours et notes privées : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** la page `/formations/<adresse>/lecons/<id>` (NdLecon, NdMobLecon) permet de suivre une leçon de bout en bout, sur ordinateur et sur téléphone :
- programme de la formation ;
- vidéo (lecteur officiel YouTube ou Vimeo) ou texte de la leçon ;
- « Dans cette leçon » ;
- ressources à télécharger ;
- notes privées ;
- leçon précédente / suivante.

Une leçon fermée ne livre jamais son contenu au navigateur.

**Architecture :**
- **Route et cadre propres** : un groupe `(lecon)` sert `/formations/[slug]/lecons/[leconId]` hors du groupe `(catalogue)`. La page a son propre cadre, `CadreLecon` :
  - sur ordinateur, l'en-tête de l'appli (ou l'en-tête public pour un visiteur), et le panneau « Programme de la formation » à la place de la barre latérale ;
  - sur téléphone, l'en-tête « détail » (retour + titre de la formation), sans barre du bas, avec une barre d'action collée en bas.
- **Données** : `getLecon` réutilise `getFiche` (programme, accès calculé par la base), puis lit la leçon, son contenu et ses ressources. La base ne renvoie le contenu et les ressources que si la personne a accès (règles de la 0004). La note vient de la nouvelle table `notes_lecons` (migration 0006).
- **Règles pures** : leçons voisines, position dans le module, adresse d'intégration de la vidéo, durées, état d'une ligne du programme, textes du verrou.
- **Actions serveur** : enregistrer une note, obtenir un lien de téléchargement temporaire (60 s).
- **Progression** : `terminees` (ensemble d'identifiants de leçons) est vide jusqu'à la 1.7. Le programme et le pourcentage savent déjà l'afficher.

**Tech Stack :** Next.js 16.4 (cacheComponents, route groups), React 19, Supabase (RLS, Storage), PGlite pour la migration, Vitest + Testing Library.

**Spec :** `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` (§1 Q1, Q3, Q9 ; §2 ligne `/formations/[…]/lecons/[…]` ; §3 ; §4 `notes_lecons` ; §6). **Annexe design :** `docs/superpowers/plans/2026-10-12-tache-1-5-annexe-design.md` (valeurs exactes, sections citées « annexe §… »).

## Global Constraints

- **Ce qui est dans la 1.5** :
  - page, cadre et programme ;
  - lecteur officiel intégré ;
  - texte de la leçon ;
  - « Dans cette leçon » ;
  - onglet Ressources, avec « Télécharger » ;
  - onglet Notes ;
  - leçon précédente / suivante ;
  - version téléphone.
- **Ce qui vient plus tard (rien ne s'affiche à leur place)** :
  - ligne « Temps réellement regardé… / Seuil… » et lecteur aux couleurs d'Étudium : 1.6 ;
  - « Marquer comme terminée », états « terminé », pourcentage et temps restant réels : 1.7 ;
  - « Consulter » (visualiseur) : 1.8. D'ici là, le bouton est affiché désactivé, avec l'info-bulle « Bientôt disponible » ;
  - onglet Questions : lot 5 (Q9) ;
  - quiz, exercices, « À faire dans ce module » et déverrouillage d'un module : lot 3.
- **Cadre ordinateur (≥ 1024 px, le point de rupture de la coque)** :
  - En-tête : `AppHeader` pour un compte connecté, `EnTetePublic` pour un visiteur.
  - Conteneur gris-bleu arrondi 32 px, puis `nav aria-label="Programme de la formation"` (flex 0 1 337px, padding 20/18/20/20, gap 12) à la place de `SidebarNav`.
  - `main` identique à la coque (annexe §1.1).
- **Cadre téléphone (< 1024 px)** :
  - En-tête « détail » : bouton 48 px `aria-label="Retour"` (fond `#E9EFFB`, rayon 14) et titre de la formation 18/26 600 tronqué (annexe §1.2).
  - Ni barre du bas, ni série, ni cloche.
  - Le panneau blanc descend jusqu'en bas ; la barre d'action est `sticky bottom-0`.
- **Panneau Programme (annexe §2.2)**, de haut en bas :
  - **Lien retour** : « Mes formations » → `/mes-formations` (connecté) ou « Toutes les formations » → `/formations` (visiteur).
  - **Titre de la formation** : lien 16/24 600 vers la fiche.
  - **Progression** (connecté seulement) : barre de 8 px « Progression de la formation », puis la méta « N % terminé » • horloge « 2 h restantes ».
  - **Modules** :
    - en-tête : surtitre majuscule « 1 · Bases d’Excel » et trait `#DAE0EE` ;
    - lignes NAV-ITEM de 48 px, titre `titreCourt ?? titre` tronqué, avec `title` = titre complet.
  - **États d'une ligne** :
    - leçon courante : lien `aria-current="page"`, blanc + ombre, texte bleu, icône `PlayCircleIcon` ;
    - à venir : lien, `PlayCircleIcon` ;
    - terminée : lien, `CheckmarkCircle02Icon` `#17663A` ;
    - verrouillée : `span aria-disabled="true"`, `SquareLock02Icon`, texte `#535E75`.
- **Lecteur (annexe §2.3)** :
  - boîte 16/9, rayon 16, fond `#1D1D1F`, contenant une `iframe` :
    - `title="Vidéo : <titre de la leçon>"` ;
    - `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"`, `allowFullScreen`, `referrerPolicy="strict-origin-when-cross-origin"` ;
  - YouTube : `https://www.youtube-nocookie.com/embed/<id>?rel=0` ;
  - Vimeo : `https://player.vimeo.com/video/<id>?dnt=1`, plus `&h=<code>` pour un identifiant `id/code`.
- **Leçon sans vidéo** : pas de boîte vidéo ; le texte de la leçon s'affiche en paragraphes (`whitespace-pre-line`, 15/24 `#232326`) sous l'en-tête. Le texte s'affiche aussi sous l'en-tête quand il y a une vidéo.
- **En-tête de la leçon (annexe §2.5, §3.3)** : un seul `h1` : 32/40 500 sur ordinateur, 20/28 600 sur téléphone.
  - Ordinateur : « Module 3 · Analyse de données » au-dessus ; méta : `TeachingIcon` + formateur • horloge + « 12 min 40 » • « Leçon 2 sur 5 de ce module ».
  - Téléphone : méta « Module 3 · Analyse de données » • formateur.
  - Formateur absent : on l'omet.
  - Durée nulle : on l'omet.
- **Navigation** :
  - ordinateur : ligne `justify-between`, « Leçon précédente » (`ArrowLeft02Icon` 18 avant) et « Leçon suivante » (`ArrowRight02Icon` 18 après), boutons secondaires 42 px ; puis le trait `#DBE0EB` ;
  - téléphone (barre basse, bordure haute `#EAEEF7`, padding 12/16) : « Leçon précédente » (secondaire 48 px, flex none) et « Leçon suivante » (principal 48 px, flex 1). La 1.7 y insérera « Marquer comme terminée ».
  - Une voisine absente (début ou fin) n'est pas affichée.
  - Une voisine verrouillée reste un lien : sa page montre le verrou.
- **Onglets** (`SegmentedTabs`, nom « Contenu de la leçon ») :
  - ordinateur : « Ressources » (par défaut) | « Notes » ;
  - téléphone : « Programme » (par défaut) | « Ressources » | « Notes ». Notes est ajouté au design mobile (Q9).
  - Deux blocs d'onglets (`hidden lg:flex` et `lg:hidden`) : chaque taille d'écran garde son onglet par défaut, sans script.
  - Une leçon verrouillée n'a pas d'onglets.
- **Programme téléphone (annexe §3.5)** : tous les modules (le déverrouillage par module est au lot 3).
  - En-tête h3 16/24 600 « Module 3 : Analyse de données » (comme la fiche), avec à droite « 0/5 » (connecté seulement).
  - Lignes LIGNE-LISTE : tuile 40 px, titre, sous-titre « 12:40 » (`formatDuree`), badge « En cours » sur la leçon courante (`aria-current="page"`).
  - Tuiles : terminée = `#DDF3E4`/`#17663A` `Tick02Icon` ; courante = `#DDE1FF`/`#0B18C9` `PlayIcon` ; à venir = `#E9EFFB` `Video01Icon` ; verrouillée = div non cliquable, `SquareLock02Icon`, titre `#667085`.
- **Ressources (annexe §2.9 a, §3.6)** :
  - Ligne bordée `#EAEEF7`, rayon 14, padding 12/14 ; tuile 40 px avec l'icône du format :
    - PDF `Pdf01Icon` ; images `Image01Icon` ; Excel/CSV `Xls01Icon` ; Word `Doc01Icon` ; PowerPoint `Ppt01Icon` ; ZIP `Zip01Icon` ; autre `File01Icon`.
  - Nom 14/20 500 tronqué ; méta « Excel · 84 Ko · téléchargeable » ou « PDF · 1,2 Mo · consultation seule » (`label` de `FORMATS`, `tailleLisible`).
  - Bouton :
    - « Télécharger » (`Download04Icon`) ou « Consulter » (`ViewIcon`) ;
    - texte + icône 16 en 34 px sur ordinateur ; icône 20 seule en 44 px sur téléphone ;
    - `aria-label` « Télécharger <titre> » / « Consulter <titre> ».
  - Aucune ressource : « Aucune ressource pour cette leçon. » (14/22 `#667085`).
- **Notes (annexe §2.11)** :
  - Label « Mes notes sur cette leçon ».
  - Textarea de 7 lignes, `maxLength` 5000, avec le placeholder « Notez ce que vous voulez retenir : une formule, un raccourci, une idée pour votre mémoire… ».
  - Aide « Vos notes sont privées. Vous les retrouvez à chaque retour sur cette leçon. ».
  - Bouton tonal « Enregistrer la note » (`Note01Icon`), puis, à sa droite, un statut `aria-live="polite"` : « Note enregistrée » ou le message d'erreur.
  - Une note vide efface la note.
  - Visiteur : « Vos notes sont privées : créez un compte gratuit pour en prendre. » + bouton « Créer un compte gratuit » → `/inscription`.
  - Table absente : « Les notes seront disponibles quand la base sera à jour (fichier 0006). »
- **Carte « Dans cette leçon » (annexe §2.12)** : fond `#F2F6FD`, rayon 16, padding 20.
  - h2 16/24 600 « Dans cette leçon », résumé 14/22 `#535E75`.
  - Points clés : `Tick02Icon` 18 `#17663A` + texte 14/22.
  - Placée à droite des onglets (flex 1 1 300px, gap 32, `flex-wrap`), donc dessous sur téléphone.
  - Sans résumé ni points clés : pas de carte.
- **Visiteur sur une leçon d'aperçu (Q1)** : `Banner` « information » au-dessus de la vidéo, titre « Vous regardez un aperçu gratuit », texte « Créez votre compte gratuit pour enregistrer votre progression. », action « Créer un compte gratuit » → `/inscription`.
- **Leçon verrouillée** : à la place de la vidéo, une carte bordée (tuile cadenas 56 px, titre 18/26 600, texte 14/22 `#667085`, boutons 42 px). Ni contenu, ni ressources, ni note, ni onglets.
  - **Visiteur, formation gratuite** : « Cette leçon est réservée aux comptes Étudium » / « Créez votre compte gratuit pour suivre toute la formation. » / « Créer un compte gratuit » (→ `/inscription`), « Se connecter » (→ `/connexion?next=<adresse de la leçon>`).
  - **Autres cas** : « Cette leçon est verrouillée » / « Elle fait partie d’un parcours. Les leçons d’aperçu restent ouvertes à tous. »
    - visiteur : « Créer un compte gratuit » ;
    - connecté : « Voir les formules » (→ `/abonnement`) ;
    - dans les deux cas, « Voir l’aperçu gratuit » s'il existe une leçon d'aperçu (→ la première).
- **Page introuvable** :
  - adresse ou identifiant mal formé ;
  - formation absente ou non publiée ;
  - leçon qui n'appartient pas à cette formation.
  - L'équipe ne prévisualise pas un brouillon ici.
- **Métadonnées** : titre « <leçon> · <formation> · Étudium » ; `robots: { index: false }` (la fiche est la page à référencer).
- **Tables du lot 1 absentes** : `siTablesAbsentes`.
- **Textes** : français, vouvoiement, apostrophes typographiques.
- **Commits** : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Leçon verrouillée** : aucune trace de la vidéo (identifiant, `youtube`, `vimeo`), du texte de la leçon, des ressources ou de la note dans le HTML envoyé, même si la base renvoyait un contenu par erreur (le code n'affiche le contenu que si `accessible`). → Task 3.
- **Identifiant d'une leçon d'une autre formation dans l'adresse** → page introuvable. → Task 2.
- **Notes d'un autre compte** : impossible à lire, écrire ou effacer. Une note sur une leçon fermée est refusée par la base. → Task 1.
- **Lien de téléchargement** : refusé pour une ressource en consultation seule ou sans accès ; il expire en 60 s et ne passe jamais par l'adresse de la page. → Task 2.
- **320 px** : pas de défilement horizontal ; titres longs tronqués dans le programme, lisibles ailleurs. → Task 4.

---

### Task 1: Notes privées en base (migration 0006)

**Files :**
- Create : `web/supabase/migrations/0006_notes.sql`
- Test : `web/tests/db/notes.test.ts`

**Interfaces :**
- Produces : table `public.notes_lecons` :
  - colonnes : `profil_id uuid not null default auth.uid() references public.profils(id) on delete cascade`, `lecon_id uuid not null references public.lecons(id) on delete cascade`, `texte text not null`, `modifie_le timestamptz not null default now()` ;
  - clés et contraintes : `primary key (profil_id, lecon_id)`, `check (char_length(texte) between 1 and 5000)` ;
  - déclencheur `toucher_modifie_le`.

- [ ] **Step 1 : tests** (`creerBanc([...MIGRATIONS_LOT_0, 0004, 0005, 0006, exemples])`) :
  - un étudiant écrit, relit et modifie sa note sur une leçon d'aperçu ;
  - sur une leçon gratuite (Zotero) : `insert … on conflict (profil_id, lecon_id) do update` ;
  - un autre compte ne voit pas cette note ; ses `update` et `delete` sur elle n'affectent aucune ligne ; son insertion avec le `profil_id` du premier est refusée ;
  - un visiteur (anon) ne lit ni n'écrit rien ;
  - une note sur une leçon payante non-aperçu (Excel module 3) est refusée ;
  - un texte de 5001 caractères est refusé, ainsi qu'un texte vide ;
  - la suppression d'une leçon efface ses notes.
- [ ] **Step 2 :** → FAIL (table absente).
- [ ] **Step 3 :** écrire la 0006 :
  - `begin;`/`commit;` ;
  - RLS : un `select`, un `insert` (`with check (profil_id = (select auth.uid()) and public.acces_lecon(lecon_id))`), un `update` (`using` et `with check` sur `profil_id`, et `acces_lecon` dans `with check`), un `delete`, tous `to authenticated` ;
  - grants : `revoke all … from anon`, `revoke truncate … from authenticated`.
- [ ] **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(lecon): notes privées en base (migration 0006)`

### Task 2: Données, règles et actions de la page leçon

**Files :**
- Create : `web/src/lib/lecon/types.ts`, `web/src/lib/lecon/regles.ts`, `web/src/lib/lecon/data.ts`, `web/src/lib/lecon/actions.ts`
- Modify : `web/src/lib/catalogue/types.ts` (`LeconFiche.titreCourt: string | null`), `web/src/lib/catalogue/data.ts` (select `titre_court`)
- Test : `web/tests/lecon/regles.test.ts`, `web/tests/lecon/data.test.ts`, `web/tests/lecon/actions.test.ts`, `web/tests/lecon/donnees.ts` (programme d'Excel des exemples : 4 modules, 12 leçons, 2 aperçus)

**Interfaces :**
- Produces :
  - **`types.ts`** :
    - `RessourceLecon { id, titre, format: string /* mime */, tailleOctets: number, telechargeable: boolean }` ;
    - `VideoLecon { fournisseur: "youtube" | "vimeo"; id: string }` ;
    - `LeconDetail { id, titre, dureeSecondes, apercu, accessible, resume: string, pointsCles: string[], video: VideoLecon | null, texte: string, ressources: RessourceLecon[] }`. `video`, `texte` et `ressources` sont vides sans accès ;
    - `DonneesLecon { fiche: FicheFormation, lecon: LeconDetail, note: string | null, notesDisponibles: boolean }`.
  - **`regles.ts`** :
    - `leconsAPlat(modules): (LeconFiche & { module: { numero: number; titre: string } })[]` ;
    - `voisines(modules, leconId): { precedente: LeconFiche | null; suivante: LeconFiche | null }` (à travers les modules) ;
    - `situation(modules, leconId): { numero: number; titreModule: string; rang: number; total: number } | null` ;
    - `urlIntegration(video: VideoLecon): string` ;
    - `dureeLecon(secondes): string` : 760 → « 12 min 40 », 720 → « 12 min », 3723 → « 1 h 02 min », 0 → « » ;
    - `type EtatLigne = "courante" | "terminee" | "a-venir" | "verrouillee"` ;
    - `etatLigne(lecon, leconCourante: string, terminees: ReadonlySet<string>): EtatLigne`. L'ordre des tests : courante, puis verrouillée (`!accessible`), puis terminée, puis à venir ;
    - `tempsRestant(modules, terminees): number` (secondes) ;
    - `metaRessource(r): string` ;
    - `verrou(fiche, connecte: boolean): { titre: string; texte: string; inscription: boolean; connexion: boolean; formules: boolean; apercu: LeconFiche | null }`, avec les textes des Global Constraints.
  - **`data.ts`** : `getLecon(slug: string, leconId: string, connecte: boolean): Promise<DonneesLecon | null>`.
    - `leconId` hors format UUID → null, sans requête.
    - `getFiche(slug)` null → null ; leçon absente de `fiche.modules` → null.
    - Sinon, une requête `lecons` : `id, titre, duree_secondes, apercu, resume, points_cles, accessible, lecons_contenus(video_fournisseur, video_id, texte), ressources(id, titre, format, taille_octets, telechargeable, ordre)` (ressources triées par `ordre`).
    - Si `accessible` est faux, `video`, `texte` et `ressources` sont vidés, quoi que la base renvoie.
    - Si `connecte`, `notes_lecons.select("texte").eq("lecon_id", id).maybeSingle()`. Une table absente donne `notesDisponibles: false`, sans erreur.
  - **`actions.ts`** (`"use server"`) :
    - `enregistrerNote(leconId: string, texte: string): Promise<{ ok: true } | { ok: false; erreur: string }>` :
      - sans compte : « Connectez-vous pour enregistrer vos notes. » ;
      - plus de 5000 caractères : « Votre note dépasse 5 000 caractères. » ;
      - texte vide après `trim` : `delete` de la note ; sinon `upsert` sur `profil_id,lecon_id` ;
      - erreur de la base : « La note n’a pas pu être enregistrée. Réessayez. » ;
    - `lienRessource(ressourceId: string): Promise<{ url: string } | { erreur: string }>` :
      - lit la ressource (règles de la base) ;
      - absente : « Ce fichier n’est pas accessible. » ;
      - consultation seule : « Ce fichier se consulte sans téléchargement. » ;
      - sinon `storage.from("ressources").createSignedUrl(fichier, 60, { download: "<titre>.<extension>" })`.

- [ ] **Step 1 : tests** :
  - **règles** :
    - voisines au début, au milieu (changement de module) et à la fin ;
    - « Leçon 2 sur 4 » ;
    - URL YouTube et Vimeo (avec et sans code) ;
    - durées ;
    - les quatre états ;
    - temps restant ;
    - méta Excel et PDF ;
    - les trois verrous : visiteur gratuite, visiteur payante, connecté payante avec aperçu.
  - **données (faux client)** :
    - identifiant non UUID → null sans requête ;
    - leçon d'une autre formation → null ;
    - leçon accessible : vidéo, texte, ressources dans l'ordre, note ;
    - leçon verrouillée dont la base renverrait un contenu : tout est vidé ;
    - table des notes absente → `notesDisponibles: false` ;
    - visiteur : aucune requête sur `notes_lecons`.
  - **actions** :
    - note sans compte, trop longue, vide (→ delete), normale (→ upsert avec `onConflict`), erreur de la base ;
    - lien refusé pour une ressource absente ou en consultation seule ;
    - lien accordé : `createSignedUrl` avec 60 s et le nom de téléchargement.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS (avec `tests/catalogue`).
- [ ] **Step 5 : commit** `feat(lecon): données, règles et actions de la page leçon`

### Task 3: Composants de la page leçon

**Files :**
- Create, dans `web/src/components/lecon/` :
  - `CadreLecon.tsx`, `ProgrammeLecon.tsx`, `ProgrammeMobile.tsx`, `LecteurVideo.tsx`, `EnTeteLecon.tsx` ;
  - `NavigationLecon.tsx` (ligne ordinateur + barre téléphone), `OngletsLecon.tsx`, `RessourcesLecon.tsx`, `NotesLecon.tsx` ;
  - `DansCetteLecon.tsx`, `LeconVerrouillee.tsx`, `ContenuLecon.tsx` (assemble le `main`).
- Test : `web/tests/lecon/page-lecon.test.tsx`, `web/tests/lecon/notes.test.tsx`, `web/tests/lecon/ressources.test.tsx`, `web/tests/lecon/cadre.test.tsx`

**Interfaces :**
- Consumes : Task 2.
- Produces :
  - `ContenuLecon({ donnees: DonneesLecon; connecte: boolean; terminees: ReadonlySet<string> })` ;
  - `ProgrammeLecon({ fiche, leconId, connecte, terminees })` ;
  - `BarreLecon({ fiche, leconId })` ;
  - `CadreLecon({ connecte, titreFormation, retour: { href: string; libelle: string }, programme: ReactNode, barre?: ReactNode, children })`.

- [ ] **Step 1 : tests** (programme d'Excel de `donnees.ts`) :
  - **Connecté, leçon accessible** :
    - `h1` au titre de la leçon et « Leçon 2 sur 4 de ce module » ;
    - `iframe` YouTube nocookie au titre « Vidéo : … » ;
    - liens précédente/suivante vers les bonnes adresses ;
    - onglets « Ressources » | « Notes » (ordinateur) et « Programme » | « Ressources » | « Notes » (téléphone) ;
    - carte « Dans cette leçon » avec ses points clés.
  - **Leçon sans vidéo** : pas d'`iframe`, le texte est affiché.
  - **Visiteur sur un aperçu** : bandeau « Vous regardez un aperçu gratuit », lien « Créer un compte gratuit », onglet Notes avec l'invitation, pas de barre de progression dans le programme.
  - **Leçon verrouillée** (connecté, payante) :
    - titre « Cette leçon est verrouillée », « Voir les formules » → `/abonnement`, « Voir l’aperçu gratuit » → première leçon d'aperçu ;
    - `container.innerHTML` ne contient ni `youtube`, ni `vimeo`, ni le texte de la leçon, ni le nom d'une ressource ;
    - aucun `tablist`.
  - **Visiteur, formation gratuite, leçon non-aperçu** : titre « Cette leçon est réservée aux comptes Étudium », « Se connecter » → `/connexion?next=…`.
  - **Programme (ordinateur)** :
    - `nav` « Programme de la formation » ;
    - ligne courante `aria-current="page"` ;
    - leçon fermée = élément `aria-disabled="true"`, non lien ;
    - `title` = titre complet.
  - **Programme (téléphone)** : « Module 1 : Bases d’Excel », badge « En cours », sous-titre « 06:10 ».
  - **Notes** :
    - saisie puis « Enregistrer la note » → action appelée avec `(leconId, texte)`, puis « Note enregistrée » ;
    - erreur → message affiché ;
    - `maxLength` 5000 ;
    - table absente → message 0006.
  - **Ressources** :
    - « Télécharger <titre> » appelle `lienRessource` puis navigue vers l'URL reçue ;
    - erreur → message ;
    - « Consulter <titre> » désactivé ;
    - liste vide → « Aucune ressource pour cette leçon. ».
  - **Cadre** :
    - visiteur → lien « Toutes les formations », bouton « Retour » vers la fiche ;
    - connecté → « Mes formations » et retour vers `/mes-formations`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter, en reprenant les valeurs de l'annexe et des Global Constraints. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(lecon): page leçon (programme, vidéo, ressources, notes)`

### Task 4: Route, guide et vérifications

**Files :**
- Create : `web/src/app/(lecon)/layout.tsx` (Suspense), `web/src/app/(lecon)/formations/[slug]/lecons/[leconId]/page.tsx`
- Modify : `docs/guides/ce-qui-te-revient.md` (section 9)
- Test : `web/tests/lecon/route.test.ts`

**Interfaces :**
- Consumes : `getLecon`, `compteConnecte`, `CadreLecon`, `ContenuLecon`, `ProgrammeLecon`, `BarreLecon`, `siTablesAbsentes`.

- [ ] **Step 1 : tests** (`getLecon` simulé) — `generateMetadata` :
  - leçon trouvée → titre « Découvrir l’interface · Maîtriser Microsoft Excel · Étudium » et `robots.index === false` ;
  - leçon introuvable → titre « Leçon introuvable · Étudium ».
- [ ] **Step 2 :** → FAIL. **Step 3 :** route :
  - `params` lus dans Suspense ; `notFound()` quand `getLecon` rend null ;
  - `terminees = new Set()` jusqu'à la 1.7 ;
  - `retour` : `/mes-formations` (connecté) ou la fiche (visiteur). **Step 4 :** → PASS.
- [ ] **Step 5 : guide**, section 9 « Valider la page leçon (tâche 1.5) » :
  1. Appliquer `0006_notes.sql` dans l'éditeur SQL.
  2. Coller un lien YouTube dans une leçon d'aperçu d'Excel (back-office).
  3. Sans compte, ouvrir cette leçon : vidéo et bandeau d'aperçu. Une leçon non-aperçu montre le verrou.
  4. Connecté, ouvrir une leçon de Zotero : programme, précédente/suivante, téléchargement d'une ressource, note enregistrée, retrouvée après rechargement.
  5. Même parcours sur téléphone (onglets Programme, Ressources, Notes ; barre du bas).
- [ ] **Step 6 :** suite entière, `tsc`, `eslint`, `npm run build`. Rendu de la page avec les données d'exemple, mesuré à 1440, 390 et 320 px, sans débordement.
- [ ] **Step 7 : commit** `feat(lecon): route de la page leçon et guide de validation`
