# Tâche 0.2 — Composants du design en code : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tous les composants des planches « Composants » du design, en React, réunis sur une page vitrine `/vitrine` qui reproduit ces planches.

**Architecture:** Un composant par fichier dans `web/src/components/ui/`, stylé en Tailwind avec les valeurs exactes des planches. Les comportements accessibles délicats (fenêtres, menus, onglets, accordéons, cases, interrupteurs, infobulles, notifications éphémères) reposent sur les primitives sans style de **Radix** ; les variantes sur **class-variance-authority**. La vitrine `web/src/app/vitrine/` a une section par planche.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, `radix-ui` 1.7, `class-variance-authority` 0.7, `clsx` 2 + `tailwind-merge` 3, `@hugeicons/react` 1.1 + `@hugeicons/core-free-icons` 4.3, Vitest 5 + Testing Library (React 16, user-event 14, jest-dom) + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-10-lot-0-fondations-design.md` (sections 2, 4, 5 ; ligne 0.2 de la section 8)

**Source des valeurs visuelles :** l'artefact « Étudium — Nouveau design » (https://claude.ai/artifact/9Ei2bCdhG75Nr3KnFZQxfg), fichiers `project/NdCFondations.dc.html`, `NdCBoutons`, `NdCFormulaires`, `NdCCartes`, `NdCNavigation`, `NdCRetours`, `NdCMenus`, `NdCModales`. Chaque tâche recopie les styles en ligne de la section citée : couleurs, tailles, arrondis, espacements, poids, ombres et survols (`style-hover`, `style-focus-visible`, `style-focus`).

## Global Constraints

- Fidélité : mêmes dimensions, couleurs, arrondis et espacements que la planche. En cas de doute, la planche fait foi, pas la spec.
- Toute couleur utilisée deux fois ou plus devient un jeton `@theme` dans `globals.css`. Pas de couleur en dur dans les composants, sauf une valeur unique propre à un seul composant.
- Icônes : uniquement Hugeicons (jeu gratuit), contour 1,5 px, via le composant `Icon`.
- Accessibilité : vrais `<button>`/`<a>`/`<input>` ; `aria-label` sur les boutons sans texte ; focus visible `outline: 2px solid #0B18C9; outline-offset: 2px` (valeur des planches) ; cibles d'au moins 44 px sur mobile.
- Textes en français, vouvoiement. Les données affichées dans la vitrine sont celles des planches.
- Les composants sont des composants serveur par défaut ; `"use client"` seulement quand il y a état ou interaction.
- Chaque commit se termine par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Clavier** : on doit pouvoir ouvrir, parcourir et fermer menus, fenêtres et listes au clavier (Échap ferme, Tab ne sort pas d'une fenêtre ouverte). → tests dans Tasks 7 et 8.
- **Saisie du code à 6 chiffres** : un code collé d'un coup (« 482 913 », avec espace) remplit les 6 cases ; une lettre est ignorée. → test dans Task 3.
- **Bouton en chargement** : il ne peut pas être cliqué deux fois (double paiement, double envoi). → test dans Task 2.
- **Textes longs** : un titre de formation trop long est coupé avec « … » sans casser la carte ; un nom de fichier long ne déborde pas. → vérification visuelle dans Tasks 3 et 4 avec un titre de 90 caractères.
- **Téléphone (375 px)** : la vitrine ne défile pas horizontalement, sauf le tableau, qui défile dans son cadre. → vérification dans Task 9.

---

### Task 1: Fondations, outils et page vitrine

**Files:**
- Modify: `web/src/app/globals.css` (jetons complets)
- Create: `web/src/lib/cn.ts`, `web/src/components/ui/Icon.tsx`, `web/src/components/ui/Text.tsx`
- Create: `web/src/app/vitrine/page.tsx`, `web/src/app/vitrine/Section.tsx`
- Create: `web/vitest.setup.ts` ; Modify: `web/vitest.config.ts`
- Test: `web/tests/ui/icon.test.tsx`

**Interfaces:**
- Produces:
  - `cn(...inputs: ClassValue[]): string` (clsx + tailwind-merge)
  - `Icon({ icon, size = 20, className, label }: { icon: IconSvgElement; size?: number; className?: string; label?: string })` : décoratif (`aria-hidden`) sans `label`, `role="img"` + `aria-label` avec.
  - `Heading` (`level: "page" | "section" | "card"`, rendu `h1`/`h2`/`h3` par défaut, prop `as` facultative), `Lead` (chapeau 16/24), `Description` (12/18), `Eyebrow` (intertitre 13,5 px en capitales)
  - `Section({ title, description, children })` pour la vitrine
  - Jetons `@theme` : toutes les couleurs relevées dans les 8 planches (surfaces, textes, bleu et ses teintes, bordures, états fond + texte, parcours), rayons `--radius-etiquette: 4px`, `--radius-champ: 12px`, `--radius-bouton: 14px`, `--radius-carte: 16px`, `--radius-panneau: 28px`, `--radius-coque: 32px`, et ombres des menus et fenêtres.

- [ ] **Step 1:** Installer `radix-ui class-variance-authority clsx tailwind-merge @hugeicons/react @hugeicons/core-free-icons`, et en dev `@testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`.
- [ ] **Step 2:** Vitest : `include` aussi `tests/**/*.test.tsx`, environnement `jsdom` pour `tests/ui/**` (les tests existants restent en `node`), `setupFiles: ["./vitest.setup.ts"]` (import de `@testing-library/jest-dom/vitest`). Renommer la config en `vitest.config.mts` (supprime l'avertissement ESM relevé à la tâche 0.1).
- [ ] **Step 3: Écrire le test** `tests/ui/icon.test.tsx` : `Icon` sans label → l'`svg` a `aria-hidden="true"` ; avec `label="Rechercher"` → `getByRole("img", { name: "Rechercher" })` ; `size={16}` → attributs `width` et `height` à 16.
- [ ] **Step 4:** Lancer `npx vitest run tests/ui/icon.test.tsx` → FAIL (module absent).
- [ ] **Step 5:** Implémenter `cn`, `Icon` (`HugeiconsIcon` avec `strokeWidth={1.5}`), `Text.tsx`, les jetons (relevés dans `NdCFondations` puis complétés en parcourant les 7 autres planches), `Section` et la page `/vitrine` avec la section « Fondations » : nuancier, typographie, rayons, grille des 49 icônes de la planche.
- [ ] **Step 6:** `npm test` → tout PASS ; `npm run dev`, ouvrir `/vitrine` : la section correspond à `NdCFondations` (comparaison visuelle côte à côte).
- [ ] **Step 7:** Commit `feat(ui): fondations, icônes et page vitrine`.

---

### Task 2: Boutons, filtres, onglets, étiquettes, avatars, progression (`NdCBoutons`)

**Files:**
- Create: `web/src/components/ui/Button.tsx`, `IconButton.tsx`, `FilterChips.tsx`, `SegmentedTabs.tsx`, `Tag.tsx`, `Avatar.tsx`, `Progress.tsx`, `TopBarButtons.tsx`
- Modify: `web/src/app/vitrine/page.tsx`
- Test: `web/tests/ui/button.test.tsx`, `web/tests/ui/tabs.test.tsx`

**Interfaces:**
- Produces:
  - `Button` : props HTML du bouton + `variant: "principal" | "gris" | "contour" | "discret" | "danger" | "dangerDoux"` (défaut `principal`), `size: "lg" | "md" | "sm"` (48 / 42 / 34 px, défaut `md`), `iconLeft?: IconSvgElement`, `loading?: boolean`, `asChild?: boolean` (Radix `Slot`, pour un lien stylé en bouton).
  - `IconButton` : `icon`, `label` (obligatoire, devient `aria-label`), `variant: "plein" | "contour"`.
  - `FilterChips` : `options: { value: string; label: string }[]`, `value`, `onValueChange`. Groupe de boutons à `aria-pressed`, actif en bleu clair / texte bleu.
  - `SegmentedTabs` : Radix `Tabs` ; `items: { value: string; label: string; content: ReactNode }[]`, `defaultValue`. Piste grise, pastille blanche, texte bleu.
  - `Tag` : `tone: "nouveau" | "gratuit" | "populaire" | "complementaire" | "verrouillee" | "valide" | "aCorriger" | "enAttente" | "echoue" | "reussi" | "compteur" | "academique" | "digital" | "business"`, `children`, `icon?`.
  - `Avatar` : `initials`, `size: 52 | 40 | 32`, `tone?` ; `AvatarGroup` : `children`.
  - `ProgressBar` : `value` (0–100), `label` (accessible), `status?: "enCours" | "terminee"` ; `ProgressMeta` : la ligne « 68 % terminé · 2 h restantes ».
  - `TopBarButtons` : `LogoButton`, `SearchButton`, `ActionButton`, `CounterPill` (`icon`, `value`, `label`), utilisés à la tâche 0.3.

- [ ] **Step 1: Écrire les tests** `button.test.tsx` :
  - `un bouton en chargement est désactivé et annoncé` : `loading` → `disabled`, `aria-busy="true"`, un clic n'appelle pas `onClick`.
  - `asChild rend un lien stylé` : `<Button asChild><a href="/x">Aller</a></Button>` → `getByRole("link", { name: "Aller" })`.
  - `IconButton exige un nom accessible` : `getByRole("button", { name: "Fermer" })`.
  `tabs.test.tsx` :
  - `FilterChips marque le filtre actif` : le filtre actif a `aria-pressed="true"` ; cliquer « Terminées » appelle `onValueChange("terminees")`.
  - `SegmentedTabs change d'onglet au clavier` : focus sur « Informations », flèche droite → « Notifications » sélectionné et son contenu affiché.
- [ ] **Step 2:** Lancer les deux fichiers → FAIL.
- [ ] **Step 3:** Implémenter chaque composant d'après la section correspondante de `NdCBoutons` (« Boutons · variantes », « Tailles et icônes », « Boutons de la barre du haut », « Filtres et onglets », « Étiquettes », « Avatars et progression »).
- [ ] **Step 4:** Tests PASS ; ajouter la section « Boutons, filtres et étiquettes » à la vitrine avec les exemples de la planche ; comparaison visuelle.
- [ ] **Step 5:** Commit `feat(ui): boutons, filtres, onglets, étiquettes, avatars et progression`.

---

### Task 3: Formulaires (`NdCFormulaires`)

**Files:**
- Create: `web/src/components/ui/Field.tsx`, `TextInput.tsx`, `PasswordInput.tsx`, `SearchInput.tsx`, `Select.tsx`, `Textarea.tsx`, `CodeInput.tsx`, `Checkbox.tsx`, `RadioGroup.tsx`, `Switch.tsx`, `ChoiceCards.tsx`, `FileDrop.tsx`, `FileRow.tsx`
- Test: `web/tests/ui/forms.test.tsx`

**Interfaces:**
- Produces:
  - `Field` : `label`, `htmlFor`, `hint?`, `error?` (message d'erreur en rouge avec icône, `aria-invalid` et `aria-describedby` reliés au contrôle), `children`.
  - `TextInput`, `PasswordInput` (bouton œil « Afficher / Masquer le mot de passe »), `SearchInput`, `Textarea` : props HTML + `invalid?: boolean`. Hauteur 48 px.
  - `Select` : select natif stylé (la liste ouverte du système), `options: { value; label }[]`.
  - `CodeInput` : `length = 6`, `value`, `onChange(code: string)`, `onComplete?(code: string)`, `label`.
  - `Checkbox`, `RadioGroup` (`options`), `Switch` : Radix, avec `label`.
  - `ChoiceCards` : `options: { value; title; subtitle; price }[]`, `value`, `onValueChange` (Radix RadioGroup présenté en cartes).
  - `FileDrop` : `accept`, `maxSizeLabel`, `onFiles(files: File[])`. `FileRow` : `name`, `meta`, `progress?` (0–100), `onRemove?`.

- [ ] **Step 1: Écrire les tests** `forms.test.tsx` :
  - `Field relie l'erreur au champ` : avec `error="Entrez un numéro à 10 chiffres."` → le champ a `aria-invalid="true"` et sa description accessible contient ce texte.
  - `PasswordInput affiche puis masque` : `type="password"` → clic sur « Afficher le mot de passe » → `type="text"`, le bouton devient « Masquer le mot de passe ».
  - `CodeInput accepte un code collé avec espace` : coller « 482 913 » → `onChange("482913")` et `onComplete("482913")`.
  - `CodeInput ignore les lettres` : taper « 4a8 » → `onChange("48")`.
  - `CodeInput recule avec Retour arrière` : sur la 3ᵉ case vide, Retour arrière → focus sur la 2ᵉ case.
  - `Switch bascule` : clic → `aria-checked="true"`.
  - `ChoiceCards sélectionne une formule` : clic sur « Premium » → `onValueChange("premium")`, la carte a `aria-checked="true"`.
  - `FileRow affiche la progression d'envoi` : `progress={62}` → `getByRole("progressbar")` a `aria-valuenow="62"`.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter d'après `NdCFormulaires` (« Champs de texte », « Listes, zones de texte et code », « Cases, boutons radio et interrupteurs », « Choix en cartes », « Dépôt de fichier »).
- [ ] **Step 4:** Tests PASS ; section « Formulaires » de la vitrine, plus un `FileRow` avec un nom de fichier de 90 caractères (coupé avec « … »).
- [ ] **Step 5:** Commit `feat(ui): formulaires`.

---

### Task 4: Cartes, listes et tableaux (`NdCCartes`)

**Files:**
- Create: `web/src/components/ui/CourseIllustration.tsx`, `CourseCard.tsx`, `CatalogCard.tsx`, `StatCard.tsx`, `ListRow.tsx`, `DataTable.tsx`, `Pagination.tsx`
- Test: `web/tests/ui/cards.test.tsx`

**Interfaces:**
- Produces:
  - `CourseIllustration` : `parcours: "academique" | "digital" | "business"` (l'illustration en couches de la planche « Fondations », couleurs du parcours).
  - `CourseCard` : `href`, `title`, `description`, `parcours`, `progress` (0–100), `timeLabel` (« 2 h restantes »), `state: "enCours" | "terminee" | "aCommencer" | "verrouillee"`, `tag?` (ton de `Tag`).
  - `CatalogCard` : `href`, `title`, `description`, `parcours`, `rating`, `reviews`, `duration`, `level`, `tag?`.
  - `StatCard` : `label`, `value`, `hint`, `icon?`, `hintTone?: "neutre" | "hausse"`.
  - `ListRow` : `leading` (icône ou avatar), `title`, `subtitle`, `trailing?`, `href?`.
  - `DataTable<T>` : `columns: { key; header; render?(row: T): ReactNode; align? }[]`, `rows: T[]`, `caption` (accessible) ; défile horizontalement dans son cadre.
  - `Pagination` : `page`, `pageCount`, `onPageChange`, `label?` (« 3 paiements »).

- [ ] **Step 1: Écrire les tests** `cards.test.tsx` :
  - `une carte verrouillée l'annonce` : `state="verrouillee"` → texte « Verrouillée » visible et lien accessible dont le nom contient le titre.
  - `la barre suit la progression` : `progress={68}` → `aria-valuenow="68"`.
  - `Pagination désactive Précédent en page 1` et `appelle onPageChange(3)` au clic sur « 3 ».
  - `DataTable affiche une ligne par élément` : 3 lignes → 3 `row` dans le corps.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter d'après `NdCCartes` (« Carte de formation · états », « Carte de catalogue et indicateurs », « Liste », « Tableau et pagination »).
- [ ] **Step 4:** Tests PASS ; section « Cartes, listes et tableaux » de la vitrine, plus une carte au titre de 90 caractères (coupé avec « … »).
- [ ] **Step 5:** Commit `feat(ui): cartes, listes, tableau et pagination`.

---

### Task 5: Navigation (`NdCNavigation`)

**Files:**
- Create: `web/src/components/ui/SidebarItem.tsx`, `SidebarGroup.tsx`, `Breadcrumb.tsx`, `Stepper.tsx`, `UnderlineTabs.tsx`, `Accordion.tsx`, `BottomBar.tsx`
- Test: `web/tests/ui/navigation.test.tsx`

**Interfaces:**
- Produces:
  - `SidebarItem` : `href`, `icon`, `label`, `active?` (`aria-current="page"`, pastille blanche), `tag?`.
  - `SidebarGroup` : `title?` (intertitre en capitales + filet), `children`.
  - `Breadcrumb` : `items: { label; href? }[]` (le dernier sans lien, `aria-current="page"`).
  - `Stepper` : `steps: string[]`, `current` (index).
  - `UnderlineTabs` : Radix `Tabs` ; mêmes props que `SegmentedTabs`.
  - `Accordion` : Radix `Accordion` ; `items: { question; answer }[]`.
  - `BottomBar` : `items: { href; icon; label; active? }[]` (barre du bas du téléphone).

- [ ] **Step 1: Écrire les tests** `navigation.test.tsx` :
  - `l'entrée active est annoncée` : `aria-current="page"`.
  - `le fil d'Ariane marque la page courante`.
  - `l'accordéon déplie une question` : clic → `aria-expanded="true"` et réponse visible.
  - `le stepper annonce l'étape courante` : l'étape `current` a `aria-current="step"`.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter d'après `NdCNavigation`.
- [ ] **Step 4:** Tests PASS ; section « Navigation » de la vitrine.
- [ ] **Step 5:** Commit `feat(ui): navigation`.

---

### Task 6: Messages, états vides et chargement (`NdCRetours`)

**Files:**
- Create: `web/src/components/ui/Banner.tsx`, `Toast.tsx`, `EmptyState.tsx`, `Skeleton.tsx`, `Spinner.tsx`, `Tooltip.tsx`, `TaskProgress.tsx`
- Test: `web/tests/ui/feedback.test.tsx`

**Interfaces:**
- Produces:
  - `Banner` : `tone: "attention" | "information" | "reussite" | "erreur"`, `title`, `children`, `action?: ReactNode`.
  - `ToastProvider` (à monter une fois) + `useToast()` → `toast({ tone: "reussite" | "information" | "erreur", title, description?, action?: { label; onClick } })`. Disparaît seul après 5 s, sauf avec une action.
  - `EmptyState` : `icon`, `title`, `description`, `action?`.
  - `Skeleton` (`className`) et `SkeletonCard`.
  - `Spinner` : `label` (« Chargement de la leçon… », lu par les lecteurs d'écran).
  - `Tooltip` : Radix ; `content`, `children`.
  - `TaskProgress` : `label`, `value`.

- [ ] **Step 1: Écrire les tests** `feedback.test.tsx` :
  - `un bandeau d'erreur est une alerte` : `tone="erreur"` → `role="alert"` ; les autres tons → `role="status"`.
  - `un toast de réussite disparaît seul` : avec horloge simulée, visible puis absent après 5 s.
  - `un toast avec action reste affiché` : toujours présent après 5 s ; clic sur « Réessayer » appelle l'action.
  - `le spinner est annoncé` : `getByRole("status", { name: "Chargement de la leçon…" })`.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter d'après `NdCRetours`.
- [ ] **Step 4:** Tests PASS ; section « Messages, états vides et chargement » de la vitrine (boutons qui déclenchent chaque toast).
- [ ] **Step 5:** Commit `feat(ui): messages, états vides et chargement`.

---

### Task 7: Menus déroulants (`NdCMenus`)

**Files:**
- Create: `web/src/components/ui/Menu.tsx`, `ProfileMenu.tsx`, `NotificationsPanel.tsx`, `SearchSuggestions.tsx`, `SortMenu.tsx`, `FilterMenu.tsx`
- Test: `web/tests/ui/menus.test.tsx`

**Interfaces:**
- Produces:
  - `Menu` (Radix `DropdownMenu`) : `trigger: ReactNode`, `items: ({ label; icon?; onSelect?; href?; danger?: boolean } | { separator: true })[]`, `align?`. Surface blanche, rayon 18, lignes de 44 px minimum.
  - `ProfileMenu` : `user: { initials; name; email }`, `roles: ("etudiant" | "formateur" | "admin")[]`, `onSignOut()` (entrées Espace formateur / Back-office seulement pour ces rôles).
  - `NotificationsPanel` (Radix `Popover`) : `notifications: { id; tone; title; body; when; unread }[]`, `onMarkAllRead()`, état vide « Vous êtes à jour ».
  - `SearchSuggestions` : `groups: { title; items: { label; meta; href }[] }[]`, `query`.
  - `SortMenu` : `options`, `value`, `onValueChange` (option cochée). `FilterMenu` : `options`, `values`, `onApply(values)`, « Réinitialiser ».

- [ ] **Step 1: Écrire les tests** `menus.test.tsx` :
  - `le menu s'ouvre et se ferme au clavier` : Entrée sur le déclencheur → `menu` visible, flèche bas déplace le focus, Échap ferme et rend le focus au déclencheur.
  - `le menu du profil masque le back-office aux étudiants` : `roles={["etudiant"]}` → pas d'entrée « Back-office » ; `["etudiant","admin"]` → présente.
  - `une action dangereuse est signalée` : l'entrée `danger` a la classe de texte erreur et appelle `onSelect`.
  - `le panneau vide l'annonce` : `notifications=[]` → « Vous êtes à jour ».
  - `FilterMenu applique les cases cochées` : cocher « Digital » puis « Appliquer » → `onApply(["digital"])`.
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter d'après `NdCMenus`.
- [ ] **Step 4:** Tests PASS ; section « Menus déroulants » de la vitrine.
- [ ] **Step 5:** Commit `feat(ui): menus déroulants`.

---

### Task 8: Modales et confirmations (`NdCModales`)

**Files:**
- Create: `web/src/components/ui/Dialog.tsx`, `ConfirmDialog.tsx`, `TypedConfirmDialog.tsx`
- Test: `web/tests/ui/dialogs.test.tsx`

**Interfaces:**
- Produces:
  - `Dialog` (Radix `Dialog`) : `open`, `onOpenChange`, `title`, `description?`, `icon?` + `iconTone?`, `children`, `footer`. Rendu et dimensions des fenêtres de la planche.
  - `ConfirmDialog` : `open`, `onOpenChange`, `title` (la question), `description`, `confirmLabel` (le verbe de l'action), `cancelLabel = "Annuler"`, `tone: "neutre" | "danger"`, `onConfirm(): void | Promise<void>` (bouton en chargement pendant la promesse).
  - `TypedConfirmDialog` : comme `ConfirmDialog` + `confirmWord` (« SUPPRIMER ») ; le bouton reste désactivé tant que le mot n'est pas saisi exactement.

- [ ] **Step 1: Écrire les tests** `dialogs.test.tsx` :
  - `Échap ferme la fenêtre` : `onOpenChange(false)`.
  - `le focus reste dans la fenêtre` : Tab depuis le dernier bouton revient au premier élément de la fenêtre.
  - `confirmer appelle onConfirm et montre le chargement` : promesse en attente → bouton `aria-busy="true"`.
  - `la suppression exige le mot exact` : désactivé avec « supprimer » (minuscules), activé avec « SUPPRIMER ».
- [ ] **Step 2:** Lancer → FAIL.
- [ ] **Step 3:** Implémenter d'après `NdCModales`. Dans la vitrine, reproduire les fenêtres de la planche avec ces trois composants (déconnexion, session expirée, quitter sans enregistrer, suppression du compte, mot de passe mis à jour, changement de formule, rappel de renouvellement, paiement en attente / confirmé / échoué, quitter le quiz, envoi d'un exercice, certificat obtenu, partage du certificat, inscription à la session). Le texte de la suppression du compte suit la décision de la spec (§9.1) : « Vos formations et votre progression seront supprimées. Vos certificats déjà délivrés resteront vérifiables. »
- [ ] **Step 4:** Tests PASS ; section « Modales et confirmations » de la vitrine (un bouton ouvre chaque fenêtre).
- [ ] **Step 5:** Commit `feat(ui): modales et confirmations`.

---

### Task 9: Vérification d'ensemble de la vitrine

**Files:** aucun nouveau (corrections éventuelles).

- [ ] **Step 1:** `npm test`, `npx tsc --noEmit`, `npx eslint src tests`, `npm run build` → tout passe.
- [ ] **Step 2:** `/vitrine` à 1440 px puis à 375 px : aucune barre de défilement horizontale (`document.documentElement.scrollWidth <= innerWidth`), sauf à l'intérieur du tableau ; aucune erreur dans la console.
- [ ] **Step 3:** Parcours au clavier de la vitrine (Tab) : chaque élément interactif montre le contour de focus bleu.
- [ ] **Step 4:** Commit des éventuelles corrections `fix(ui): ajustements de la vitrine`.

## Validation de la tâche 0.2 (par l'utilisateur)

`npm run dev`, puis http://localhost:3000/vitrine : chaque section ressemble à la planche correspondante du design, sur ordinateur et sur téléphone.
