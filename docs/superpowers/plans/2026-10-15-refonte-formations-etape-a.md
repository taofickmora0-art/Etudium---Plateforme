# Refonte des formations, étape A (création) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** l'onglet « Leçons » (glisser-déposer, statut par leçon), l'éditeur de leçon en deux colonnes avec texte mis en
forme, et « Voir comme un étudiant », pour l'équipe et le formateur.

**Architecture :** migration 0027 (statut `lecons.publiee`, `commentaires_actifs`, visibilité des brouillons dans toutes
les lectures des étudiants, notification à la publication, fonction `ranger`) ; actions et lectures du back-office
étendues ; nouveaux composants `OngletLecons` (dnd-kit) et `EditeurLecon` partagés par `/admin` et `/formateur` ; la page
leçon affiche le texte mis en forme et s'ouvre en aperçu pour l'équipe et le formateur.

**Tech Stack :** Next.js 16.4, React 19, Supabase (PGlite pour les tests SQL), Tiptap 3.31.3 (déjà là), dnd-kit
(`@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2`), Vitest.

**Spec :** `docs/superpowers/specs/2026-10-15-refonte-formations-design.md` (§3, §4 « 0027 », §5 étape A), validée par
l'utilisateur le 15 octobre (« C'est bon » : les 9 choix du §6 avec mes propositions).

## Global Constraints

- Textes en français ; téléphone compact (tailles `max-sm` plus petites) ; aucune donnée personnelle dans les adresses.
- Fonctions SQL `security definer` + `set search_path = ''` (ou `security invoker` comme `deplacer`, pour s'appuyer sur
  les règles d'écriture) ; migration rejouable (`if not exists`, `create or replace`) ; l'utilisateur l'applique lui-même.
- Statut d'une leçon : **Brouillon** ou **Publiée** ; les leçons existantes restent publiées.
- Libellés : onglet « Leçons » ; « + Ajouter une section » ; « Ajouter » (une leçon) ; « Publiée ▾ » / « Brouillon ▾ » ;
  « Voir comme un étudiant » ; « Enregistrer » → « La leçon a bien été mise à jour. » ; « Activer les commentaires » ;
  « Leçon d'aperçu gratuite » ; « Documents & fichiers » ; bandeau « Aperçu : pas encore visible des étudiants ».
- Avant la 0027, les pages du back-office et la page leçon marchent comme avant (repli sans les nouvelles colonnes) et les
  nouvelles actions disent « Appliquez la migration 0027 (guide « Ce qui te revient », section 33). ».

## Review Focus

1. Un étudiant avec le lien direct d'une leçon en brouillon (ou dans une formation non publiée) : refusé, jamais le contenu.
2. Glisser la dernière leçon d'une section vers une autre, ou dans une section vide ou repliée : rien ne se perd, l'ordre
   reste continu.
3. Publier une formation dont toutes les leçons sont en brouillon : refusé avec un message clair.
4. Un formateur ne peut ni ranger une leçon dans le module d'une autre formation, ni changer le statut d'une leçon qui
   n'est pas la sienne.
5. Quitter l'éditeur avec des changements non enregistrés (lien Retour, leçon suivante, fermeture de l'onglet) :
   confirmation demandée.

---

### Task 1 : migration 0027 (leçons)

**Files :** Create `web/supabase/migrations/0027_lecons_statut.sql` ; Test `web/tests/db/lecons-statut.test.ts`.

**Interfaces — Produces :**
- `lecons.publiee boolean not null` (existantes : vraies ; défaut ensuite : faux), `lecons.commentaires_actifs boolean not
  null default true`.
- Règle de lecture « leçons d'un module visible » : publiée, ou `equipe_contenus()`, ou
  `formateur_de(formation_du_module(module_id))`.
- `acces_lecon` : la branche étudiant exige `l.publiee`.
- Ne comptent que les leçons publiées : `peut_donner_avis`, `suivi_formateur`, `etudiant_formateur`,
  `statistiques_back_office`, `compte_equipe` (copies exactes + filtre).
- `envoyer_en_relecture` : au moins une leçon **publiée** (« Publiez au moins une leçon avant d’envoyer la formation en
  relecture. »).
- `notifications_lecons` : à l'insertion d'une leçon publiée, ou quand `publiee` passe de faux à vrai ; déclencheur
  `after insert or update of publiee`.
- `ranger(p_table text, p_id uuid, p_parent uuid, p_position integer) returns void`, `security invoker` :
  `'modules'` (dans sa formation ; `p_parent` ignoré) ou `'lecons'` (`p_parent` = module d'arrivée, de la **même**
  formation, sinon « Cette section n’est pas dans la même formation. ») ; place l'élément au rang `p_position` (1 = en
  tête, borné), renumérote 1…n le groupe d'arrivée et celui de départ.

- [ ] **Step 1 : tests** (`creerBanc` jusqu'à la 0026, puis la 0027 ; comptes équipe, formateur de la formation, autre
  formateur, étudiant) :
  - « les leçons déjà là restent publiées ; une nouvelle naît en brouillon » (insérer une leçon **avant** d'exécuter la 0027) ;
  - « l'étudiant ne lit ni n'ouvre une leçon en brouillon ; l'équipe et le formateur de la formation, oui » (`select` sur
    `lecons`, `acces_lecon`) ;
  - « avis à 50 % et suivi du formateur : seules les leçons publiées comptent » ;
  - « envoyer en relecture : refusé sans leçon publiée » ;
  - « notification : pas à l'ajout d'un brouillon, à sa publication ; une seule fois » ;
  - « ranger : une leçon vers une autre section, à sa place ; les deux sections renumérotées ; refus vers une autre
    formation ; un autre formateur ne range pas (aucune ligne modifiée) ; une section remonte en tête ».
- [ ] **Step 2 : lancer** `npx vitest run tests/db/lecons-statut.test.ts` → ÉCHEC (migration absente).
- [ ] **Step 3 : écrire la 0027** (scripts Python du scratchpad qui recopient les fonctions de leur dernière migration et
  ajoutent le filtre) ; droits d'exécution : `ranger` à `authenticated`.
- [ ] **Step 4 : lancer** le test, puis `npx vitest run tests/db` → SUCCÈS.
- [ ] **Step 5 : commit** « feat(formations): statut des leçons et rangement en base (0027) ».

### Task 2 : actions et lectures

**Files :** Modify `web/src/lib/admin/{actions,data,types}.ts` ; Test `web/tests/admin/lecons-statut.test.ts`.

**Interfaces — Produces :**
- `changerStatutLecon(id: string, publiee: boolean): Promise<Resultat>`.
- `ranger(table: "modules" | "lecons", id: string, parent: string | null, position: number): Promise<Resultat>`.
- `addLecon(moduleId, titre)` : brouillon si la formation a déjà été publiée (`publiee_le`), publiée sinon (tout est
  caché tant que la formation ne l'est pas).
- `saveLecon(...)` accepte `commentairesActifs: boolean`.
- `setStatutFormation(id, "publiee")` : au moins une leçon publiée (« Publiez au moins une leçon avant de publier la
  formation. »).
- Lectures : `LeconProgrammeAdmin.publiee`, `LeconAdmin.publiee`, `LeconAdmin.commentairesActifs`,
  `LeconAdmin.position: { rang: number; total: number; module: { rang: number; titre: string } }`,
  `LeconAdmin.voisines: { precedente: string | null; suivante: string | null }` (dans l'ordre de toute la formation).
- Avant la 0027 : lectures relues sans les colonnes (publiée, commentaires actifs) ; `changerStatutLecon` et `ranger`
  rendent le message de migration.

- [ ] **Step 1 : tests** (faux Supabase) : paramètres transmis, refus hors équipe/formateur, brouillon ou publiée à l'ajout
  selon la formation, publication refusée sans leçon publiée, position et voisines calculées, repli avant la 0027.
- [ ] **Step 2 : ÉCHEC.** **Step 3 : implémenter.** **Step 4 :** `npx vitest run tests/admin tests/formateur` → SUCCÈS.
- [ ] **Step 5 : commit** « feat(formations): actions du statut des leçons et du rangement ».

### Task 3 : l'onglet « Leçons »

**Files :** Create `web/src/lib/admin/rangement.ts`, `web/src/components/admin/OngletLecons.tsx`,
`web/src/components/admin/StatutLecon.tsx` ; Modify `FormationOnglets.tsx` (libellé « Leçons », `?onglet=programme`
gardé), pages admin et formateur qui rendaient `ProgrammeEditor` ; Delete `ProgrammeEditor.tsx` s'il ne sert plus ;
Test `web/tests/admin/rangement.test.ts`, `web/tests/admin/onglet-lecons.test.tsx`.

**Interfaces — Produces :**
- `deplacerDans(programme: ModuleProgramme[], d: { type: "module" | "lecon"; id: string; module: string | null; position: number }): ModuleProgramme[]`
  (mise à jour immédiate de l'écran, avant la réponse ; l'écran revient en arrière si l'action échoue).
- `StatutLecon({ publiee, onChange, desactive })` : bouton « Publiée ▾ » (vert) / « Brouillon ▾ » (gris), menu « Publier »
  / « Mettre en brouillon ».

- [ ] **Step 1 : tests** — règle : déplacements dans une section, vers une autre, vers une section vide, bornes ; écran :
  « 7 sections · 22 leçons », « + Ajouter une section » (fenêtre, titre), « Ajouter » (fenêtre « Nouvelle leçon » → page
  de la leçon), pastille « n leçons » qui replie, « Tout replier », menu ⋮ d'une section (Renommer, Monter, Descendre,
  Supprimer avec confirmation), d'une leçon (Modifier, Voir comme un étudiant, Monter, Descendre, « Déplacer vers… »,
  Supprimer), statut qui appelle `changerStatutLecon`, l'action `ranger` appelée avec les bons arguments, retour en arrière
  et message si elle échoue.
- [ ] **Step 2 : ÉCHEC.** **Step 3 : installer dnd-kit** (versions ci-dessus) **et implémenter** (poignées ⠿, capteurs
  souris, toucher et clavier ; annonces en français pour les lecteurs d'écran). **Step 4 :** `npx vitest run tests/admin
  tests/formateur` → SUCCÈS.
- [ ] **Step 5 : commit** « feat(formations): onglet Leçons avec glisser-déposer et statut ».

### Task 4 : l'éditeur de leçon en deux colonnes

**Files :** Create `web/src/components/admin/EditeurLecon.tsx` ; Modify les pages
`admin/formations/[id]/lecons/[leconId]` et `formateur/formations/[id]/lecons/[leconId]`, `RessourcesEditor.tsx` (variante
compacte pour la colonne) ; Delete `LeconForm.tsx` s'il ne sert plus ; Test `web/tests/admin/editeur-lecon.test.tsx`.

**Interfaces — Consumes :** Task 2 (`saveLecon`, `changerStatutLecon`, `LeconAdmin`), `EditeurTexte` de la communauté
(format Markdown restreint de `lib/communaute/mise-en-forme.ts`), `RessourcesEditor`.

- [ ] **Step 1 : tests** (éditeur simulé) : barre du haut (« Retour aux leçons (titre) », « Leçon 2 sur 5 · Module 1 :
  titre », liens ‹ › vers les voisines, statut, « Voir comme un étudiant » → `/formations/{slug}/lecons/{id}`) ; colonne
  Réglages (lien vidéo reconnu → aperçu, durée minutes + secondes → secondes, deux cases, Documents) ; titre et texte ;
  « Dans cette leçon » repliable (résumé, points clés, titre court) ; « Enregistrer » envoie tout et affiche « La leçon a
  bien été mise à jour. » ; changements non enregistrés : `beforeunload` posé, et Retour / ‹ › demandent « Quitter sans
  enregistrer ? ».
- [ ] **Step 2 : ÉCHEC.** **Step 3 : implémenter** (ordinateur : réglages 300 px à gauche, éditeur à droite ; téléphone :
  réglages au-dessus, tailles compactes). **Step 4 :** `npx vitest run tests/admin tests/formateur` → SUCCÈS.
- [ ] **Step 5 : commit** « feat(formations): éditeur de leçon en deux colonnes ».

### Task 5 : côté étudiant — texte mis en forme, voir comme un étudiant

**Files :** Modify `web/src/lib/catalogue/data.ts` (lecture d'une formation non publiée pour l'équipe et son formateur),
la page fiche et la page leçon, `ContenuLecon.tsx` (texte par `TexteMisEnForme`), `ProgrammeLecon.tsx` /
`ProgrammeFiche.tsx` (étiquette « Brouillon » pour l'équipe et le formateur) ; Create `components/lecon/BandeauApercu.tsx` ;
Test `web/tests/lecon/apercu-editeur.test.tsx`.

- [ ] **Step 1 : tests** : le texte de la leçon rendu mis en forme (titre, gras, liste) ; l'équipe ou le formateur ouvre la
  fiche et une leçon d'une formation non publiée → bandeau « Aperçu : pas encore visible des étudiants », ni visite
  enregistrée, ni mesure du temps regardé, ni bouton de fin ; un étudiant → page introuvable ; une leçon en brouillon
  d'une formation publiée → étiquette « Brouillon » dans le programme, pour l'équipe seulement.
- [ ] **Step 2 : ÉCHEC.** **Step 3 : implémenter.** **Step 4 :** `npx vitest run tests/lecon tests/catalogue` → SUCCÈS.
- [ ] **Step 5 : commit** « feat(formations): texte mis en forme et aperçu pour l'équipe et le formateur ».

### Task 6 : vérification, revue, bilan

- [ ] Suite complète, lint, `tsc`, build ; rendu 1440 / 390 / 320 px (page temporaire supprimée ensuite), glisser-déposer
  essayé à la souris et au clavier.
- [ ] Guide « Ce qui te revient », section 33 (appliquer la 0027 ; vérifications).
- [ ] Revue finale (opus), une passe de corrections, bilan `docs/superpowers/bilans/2026-10-15-refonte-formations-etape-a.md`,
  mémoire.
