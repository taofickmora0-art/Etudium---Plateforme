# Refonte des formations, étape B (suivi) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** la page leçon façon izimentor (barre du haut, « Terminer la leçon », programme repliable, tiroir « Leçons »
sur téléphone, discussions de la leçon) et les retouches de la page du cours.

**Architecture :** migration 0028 (discussions des leçons : tables, fonctions, notifications, limite de débit,
signalements dans la file de modération existante) ; `lib/lecon/discussions.ts` ; le composant des commentaires de la
communauté (`Reponses`) reçoit ses actions en paramètre et sert aux deux ; la page leçon gagne une barre du haut, un
programme repliable et un tiroir.

**Tech Stack :** Next.js 16.4, React 19, Supabase (PGlite pour les tests SQL), Radix (tiroir), Vitest.

**Spec :** `docs/superpowers/specs/2026-10-15-refonte-formations-design.md` (§1, §2, §4 « 0028 », §5 étape B), validée le
15 octobre.

## Global Constraints

- Textes en français ; téléphone compact ; aucune donnée personnelle dans les adresses.
- Fonctions SQL `security definer` + `set search_path = ''` ; migration rejouable ; l'utilisateur l'applique.
- Libellés : « Terminer la leçon » → « Leçon suivante » ; « Leçon 4 sur 22 » ; « Modifier la leçon » ; « Mode lecture » ;
  « Leçons » (tiroir) ; « Discussions de la leçon » ; « Rédiger un commentaire » ; « Publier » ; étiquette « Formateur » ;
  « Poursuivre le cours » ; « Progression du cours » ; « Terminé 3 sur 22 » ; « Tout déplier » / « Tout replier » ;
  « Modifier les leçons ».
- La règle du seuil vidéo reste : « Terminer la leçon » s'active au seuil (« Regardez au moins 90 % de la vidéo »).
- Discussions : comptes qui ont accès à la leçon ; un visiteur (aperçu gratuit) ne les voit pas ; le formateur est
  prévenu d'un nouveau commentaire, l'auteur d'une réponse ; l'auteur modifie et supprime le sien ; le formateur de la
  formation et l'équipe suppriment ; « Activer les commentaires » décoché masque la section.
- Avant la 0028 : la page leçon s'affiche sans discussions, sans erreur.

## Review Focus

1. Un compte sans accès à la leçon (leçon payante, brouillon) ne lit ni n'écrit de commentaire, même par appel direct.
2. Une réponse à une réponse reste au premier niveau (un seul niveau), comme dans la communauté.
3. « Terminer la leçon » sur la dernière leçon de la formation : pas de « Leçon suivante », un message de fin.
4. Le tiroir « Leçons » sur téléphone : se ferme au choix d'une leçon, garde le focus, Échap le ferme.
5. Signaler un commentaire de leçon : il arrive dans la file de modération ; « Supprimer » l'y retire et le retire de la leçon.

---

### Task 1 : migration 0028 (discussions)

**Files :** Create `web/supabase/migrations/0028_discussions_lecons.sql` ; Test `web/tests/db/discussions-lecons.test.ts`.

**Interfaces — Produces :**
- Tables `commentaires_lecons(id, lecon_id, auteur, parent_id, texte 1..2000, cree_le, modifie_le)` et
  `reactions_commentaires_lecons(commentaire_id, profil_id)` ; règles : rien en direct, tout par fonctions.
- `discussion_lecon(p_lecon uuid, p_avant timestamptz default null, p_nombre int default 20) returns jsonb` (commentaires de
  premier niveau, du plus ancien au plus récent, avec leurs réponses, J'aime, `j_aime`, `est_moi`, `peut_modifier`,
  `peut_supprimer`, `formateur`).
- `commenter_lecon(p_lecon, p_texte, p_parent default null) returns jsonb` ; `modifier_commentaire_lecon(p_id, p_texte)` ;
  `supprimer_commentaire_lecon(p_id) returns integer` ; `basculer_reaction_commentaire_lecon(p_id) returns jsonb`.
- Droits : `acces_lecon(p_lecon)` et un compte connecté ; `commentaires_actifs` sinon « Les commentaires sont fermés sur
  cette leçon. » ; 30 commentaires en 10 minutes.
- Notifications (catégorie `communaute`) : le formateur de la formation (sauf s'il écrit), l'auteur du commentaire visé
  par une réponse ; lien `/formations/{slug}/lecons/{id}#commentaire-{id}`.
- Modération : `signalements.commentaire_lecon_id`, contrainte « une seule cible » à trois ; `signaler`,
  `file_moderation`, `garder_contenu`, `supprimer_contenu` reprises avec un paramètre `p_commentaire_lecon` (défaut null).

- [ ] **Step 1 : tests** — lecture et écriture avec et sans accès, réponse à une réponse ramenée au premier niveau,
  commentaires fermés, droits de suppression (auteur, formateur de la formation, équipe ; un autre étudiant non),
  notifications, limite de débit, signalement puis suppression depuis la file, rejouable.
- [ ] **Step 2 : ÉCHEC.** **Step 3 : écrire la 0028** (scripts du scratchpad pour reprendre les fonctions de la 0020).
  **Step 4 :** `npx vitest run tests/db` → SUCCÈS. **Step 5 : commit**.

### Task 2 : actions et lectures des discussions

**Files :** Create `web/src/lib/lecon/discussions.ts` ; Modify `web/src/lib/lecon/{data,types}.ts` (`commentairesActifs`,
première page de la discussion), `web/src/lib/moderation/{actions,data,types}.ts` (cible `commentaireLeconId`) ;
Test `web/tests/lecon/discussions.test.ts`.

**Interfaces — Produces :** les mêmes signatures que les actions des commentaires de la communauté
(`repondre`, `modifierReponse`, `supprimerReponse`, `aimerReponse`, `chargerReponses`), pour une leçon, regroupées dans
`actionsDiscussion(leconId): ActionsReponses`. Avant la 0028 : lecture vide, actions « Appliquez la migration 0028 … ».

- [ ] Tests → ÉCHEC → implémenter → SUCCÈS (`npx vitest run tests/lecon tests/moderation`) → commit.

### Task 3 : la section « Discussions de la leçon »

**Files :** Modify `web/src/components/communaute/Reponses.tsx` (prop `actions?: ActionsReponses`, `lien?: (id) => string`,
`cibleSignalement`), Create `web/src/components/lecon/DiscussionsLecon.tsx` ; Modify `ContenuLecon.tsx` et la page leçon ;
Test `web/tests/lecon/discussions-lecon.test.tsx` (+ tests de la communauté inchangés).

- [ ] Tests : la section sous le contenu, « Rédiger un commentaire » / « Publier », Répondre, J'aime, menu ⋮, étiquette
  « Formateur », « Voir plus de commentaires », section absente si commentaires fermés, pour un visiteur, ou avant la
  0028 → ÉCHEC → implémenter → SUCCÈS → commit.

### Task 4 : la barre du haut et « Terminer la leçon »

**Files :** Modify `CadreLecon.tsx`, `NavigationLecon.tsx`, `BoutonFin.tsx`, `EnTeteLecon.tsx`, la page leçon (le lien
« Modifier la leçon » pour l'équipe et le formateur) ; Test `web/tests/lecon/barre-lecon.test.tsx` (+ mises à jour de
`fin.test.tsx`, `page-lecon.test.tsx`).

- [ ] Tests : « ‹ Titre de la formation », « Mode lecture » (masque le programme, `aria-pressed`), « Terminer la leçon »
  (sans vidéo : termine puis ouvre la suivante ; vidéo : grisé avant le seuil), « Leçon suivante » une fois terminée,
  dernière leçon : « Formation terminée ! » sans lien, « Leçon 4 sur 22 » et ‹ ›, « Modifier la leçon » seulement pour
  l'équipe et le formateur → ÉCHEC → implémenter → SUCCÈS → commit.

### Task 5 : le programme repliable et le tiroir « Leçons »

**Files :** Modify `ProgrammeLecon.tsx`, `OngletsLecon.tsx` (plus d'onglet Programme sur téléphone), `CadreLecon.tsx` ;
Create `web/src/components/lecon/TiroirLecons.tsx` ; Test `web/tests/lecon/programme-repliable.test.tsx`.

- [ ] Tests : sections repliables (celle de la leçon ouverte), durée de chaque leçon, progression en bas du panneau ;
  sur téléphone, « Leçons » ouvre le tiroir, choisir une leçon le ferme, Échap aussi → ÉCHEC → implémenter → SUCCÈS → commit.

### Task 6 : la page du cours

**Files :** Modify `FicheConnectee.tsx`, `ProgrammeFiche.tsx`, `CarteAcces` ; Test `web/tests/catalogue/fiche-cours.test.tsx`.

- [ ] Tests : « Poursuivre le cours », « Progression du cours » (« Terminé 3 sur 22 », %), « 7 modules · 22 leçons », durée
  de chaque module, « Tout déplier / Tout replier », « Modifier les leçons » pour l'équipe et le formateur seulement
  → ÉCHEC → implémenter → SUCCÈS → commit.

### Task 7 : vérification, revue, bilan

- [ ] Suite complète, lint, `tsc`, build ; rendu 1440 / 390 / 320 px ; guide section 34 (appliquer la 0028).
- [ ] Revue finale (opus), une passe de corrections, bilan, mémoire.
