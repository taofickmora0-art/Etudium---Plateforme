# Communauté v3, étape 2 : les commentaires — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sous chaque commentaire, Répondre (un niveau), J’aime, menu ⋮ (copier le lien, signaler, modifier, supprimer) et « Voir plus de commentaires ».

**Architecture:** la migration 0025 ajoute le parent, la modification et les J’aime des commentaires (fonctions SQL,
carte d'un commentaire enrichie, carte de publication limitée aux commentaires de premier niveau) ; côté écran,
`Reponses.tsx` regroupe les réponses sous leur commentaire et porte les actions.

**Tech Stack:** Next.js 16.4, React 19.3, Supabase, vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-10-14-communaute-v3-design.md` (§2 et ses précisions)

## Global Constraints

- Textes en français, apostrophe typographique ; commentaires de 1 à 1 000 caractères ; un seul niveau de réponses.
- La 0025 reprend `commenter` de la 0020, `carte_reponse` de la 0020 et `carte_publication` de la **0024** par script.
- Avant la 0025 : commenter et supprimer marchent comme avant ; répondre, aimer et modifier disent « Appliquez la
  migration 0025 (guide « Ce qui te revient », section 30). ».

## Review Focus

1. Répondre à une réponse : rattachée au même commentaire de premier niveau (jamais un deuxième niveau).
2. Un parent d'une autre publication, ou supprimé entre-temps : refusé proprement.
3. Supprimer un commentaire avec des réponses : tout disparaît de l'écran et le compteur baisse d'autant.
4. Modifier : seulement l'auteur et l'équipe ; « modifié » affiché ; la limite de débit ne bloque pas une correction.
5. La carte du fil : les 2 derniers commentaires de premier niveau, le total compte aussi les réponses.

---

### Task 1: Migration 0025

**Files:** Create `web/supabase/migrations/0025_communaute_commentaires.sql` (script `scratchpad/migration_0025.py`) ;
Test `web/tests/db/commentaires.test.ts` ; Modify `docs/guides/ce-qui-te-revient.md` (section 30).

**Produces:** `commentaires_publications.parent_id` (cascade), `modifie_le` ; table `reactions_commentaires(commentaire_id, profil_id, cree_le)` ;
`commenter(p_publication uuid, p_texte text, p_parent uuid default null) returns uuid` ;
`modifier_commentaire(p_id uuid, p_texte text) returns void` ; `basculer_reaction_commentaire(p_id uuid) returns jsonb {j_aime, reactions}` ;
`carte_reponse` + `parent_id, reactions, j_aime, modifie, peut_modifier` ; `carte_publication.dernieres_reponses` = 2 derniers de premier niveau.
Notification « Nouvelle réponse à votre commentaire » à l'auteur du commentaire parent (pas à soi-même).

- [ ] Tests PGlite (RED) : réponse rattachée ; réponse à une réponse → même parent ; parent d'une autre publication refusé
  (« Ce commentaire n’existe plus. ») ; J’aime ajouté puis retiré ; modifier (auteur, équipe ; autre compte refusé) ;
  supprimer le parent supprime les réponses ; carte du fil : 2 derniers de premier niveau ; notification au parent.
- [ ] Migration, tests verts, guide §30, commit.

### Task 2: Données et actions

**Files:** Modify `web/src/lib/communaute/{types,data,actions}.ts` ; Test `web/tests/communaute/actions.test.ts`, `data.test.ts`.

**Produces:** `Reponse` + `parentId: string | null`, `reactions: number`, `jAime: boolean`, `modifie: boolean`, `peutModifier: boolean` ;
`repondre(publicationId, texte, parentId?: string | null)` ; `modifierReponse(id, texte): Promise<Resultat>` ;
`aimerReponse(id): Promise<{ ok: true; jAime: boolean; reactions: number } | Refus>`.

- [ ] Tests (RED), implémentation, commit.

### Task 3: L'écran des commentaires

**Files:** Modify `web/src/components/communaute/Reponses.tsx`, `DetailPublication.tsx` (défilement vers `#commentaire-…`) ;
Test `web/tests/communaute/commentaires.test.tsx`.

- Sous chaque commentaire : « J’aime » (et le nombre), « Répondre », menu « Actions sur le commentaire de … » :
  « Copier le lien », « Signaler » (si permis), « Modifier » et « Supprimer » (si permis).
- Répondre ouvre un champ « Répondre à Koffi D. » sous le commentaire (réponse à une réponse : « @Koffi D. » au début).
- Les réponses s'affichent sous leur commentaire, décalées ; « Voir plus de commentaires » quand il en reste.

- [ ] Tests (RED), implémentation, commit.

### Task 4: Vérification

- [ ] lint, types, suite complète, compilation ; rendu à 1440 et 390 px (page d'essai supprimée).
