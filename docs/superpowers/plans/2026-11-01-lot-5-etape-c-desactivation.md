# Lot 5, étape C : désactivation d'une formation — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** l'équipe désactive une formation publiée (plus aucun accès étudiant, tout de suite) et la réactive ; les étudiants qui la suivent sont prévenus (appli, push, e-mail).

**Architecture :** un nouvel état `desactivee` de `statut_formation` (migration 0059). La règle d'accès aux leçons (`acces_lecon`, 0050) n'ouvre déjà que les formations publiées : quiz, exercices, visionnage, discussions et images suivent. Un déclencheur en base prévient les suiveurs, d'où que vienne le changement. Le back-office passe par l'action existante `setStatutFormation`.

**Tech Stack :** Next.js 16 (`web/`), Supabase/Postgres, Vitest + banc PGlite.

**Spec :** `docs/superpowers/specs/2026-10-15-lot-5-fin-messagerie-push-desactivation-design.md`, § « Étape C » et Q10, Q12, Q13 (validée le 15 octobre ; la migration prévue « 0037 » devient **0059**). L'utilisateur, absent, a demandé d'enchaîner seul.

## Global Constraints

- **Migration 0059 rejouable :** `alter type public.statut_formation add value if not exists 'desactivee'` en tête, hors transaction ; la nouvelle valeur ne sert pas dans la même transaction (comme la 0030) : les fonctions comparent `statut::text`.
- **Fonctions :** `security definer`, `set search_path = ''`, droits retirés puis accordés explicitement.
- **Textes (spec) :**
  - désactivation : titre « « X » est momentanément indisponible », texte « Votre progression et vos certificats sont conservés. », lien `/mes-formations` ;
  - réactivation : titre « « X » est de nouveau disponible », texte « Vous reprenez là où vous en étiez. », lien `/formations/<slug>` ;
  - confirmation : « N étudiants suivent cette formation. Leur accès sera suspendu tout de suite ; ils seront prévenus. Vous pourrez la réactiver. » (« 1 étudiant suit », « Aucun étudiant ne suit » selon N).
- **E-mail :** message important (Q10) : une ligne `envois` par suiveur (comme `email_suspension`), hors préférences ; comptes suspendus exclus.
- **Commits :** terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Une formation désactivée pour un étudiant qui l'avait commencée :** leçon, quiz, exercice et validation refusés ; la carte de « Mes formations » reste, « Indisponible ». Test SQL (`acces_lecon`, `ouvrir_lecon`) + test de la règle de « Mes formations ».
2. **Le formateur qui tente de réactiver (ou de désactiver) :** refusé par la base. Test SQL.
3. **Une transition interdite** (désactiver un brouillon ou une formation archivée) : refusée avec un message clair. Test SQL.
4. **La réactivation :** pas de « Nouvelle formation » diffusée à tous, pas de version « Mise en ligne » en plus. Test SQL.
5. **Les certificats déjà délivrés :** toujours vérifiables. Test SQL (`verifier_certificat`).

---

### Task 1 : la migration 0059

**Files :** Create `web/supabase/migrations/0059_desactivation_formations.sql` ; Test `web/tests/db/desactivation.test.ts`.

**Interfaces :**
- `public.nombre_suiveurs_formation(p_formation uuid) returns integer` : l'équipe seulement (sinon 42501) ; comptes suiveurs non suspendus (`suiveurs_formation`).
- Déclencheur `formations_desactivation_regle` (avant mise à jour du statut) : `desactivee` seulement depuis `publiee` (« Seule une formation publiée peut être désactivée. ») ; depuis `desactivee`, seulement `publiee` (« Une formation désactivée se réactive : elle redevient publiée. »).
- Déclencheur `formations_desactivation` (après) : notifie les suiveurs (`service`, auteur inclus) + leurs e-mails ; le formateur (« Votre formation « X » est désactivée par l'équipe » / « … est de nouveau en ligne »).
- `version_mise_en_ligne` redéfinie : rien quand l'ancien statut est `desactivee`.

- [ ] Tests (Review Focus 1 à 5, nombre de suiveurs, notifications et e-mails) → échec → migration → passe → commit `feat(formations): désactiver et réactiver une formation (0059)`.

### Task 2 : le back-office et l'espace formateur

**Files :** Modify `web/src/lib/contenus/libelles.ts`, `web/src/lib/contenus/etat.ts`, `web/src/components/admin/FiltreStatut.tsx`, `web/src/app/(app)/admin/formations/page.tsx`, `web/src/lib/admin/actions.ts` (`setStatutFormation` accepte `desactivee`), `web/src/lib/admin/data.ts` (nombre de suiveurs), `web/src/components/admin/PublicationPanel.tsx`, `web/src/components/formateur/PublicationFormateur.tsx` et les étiquettes formateur.

- Libellé « Désactivée », ton `echoue` ; filtre « Désactivées » au back-office.
- Publication (équipe) : formation publiée → bouton « Désactiver » (confirmation avec N) ; désactivée → « Réactiver ».
- Formateur : « Désactivée par l'équipe », sans bouton.
- [ ] Tests (étiquettes, action, boutons et fenêtre) → échec → implémentation → passe → commit `feat(formations): désactiver depuis le back-office`.

### Task 3 : « Mes formations »

**Files :** Modify `web/src/lib/mes-formations/regles.ts`, `web/src/lib/catalogue/data.ts` (type), les cartes (`CarteSuivie`, `CarteSuivieCompacte`, `CourseCard`).

- Une formation désactivée : carte gardée, étiquette « Indisponible », explication « Momentanément indisponible. Votre progression est conservée. », sans lien.
- [ ] Tests → échec → implémentation → passe → commit `feat(mes-formations): une formation désactivée reste, « Indisponible »`.

### Task 4 : guide, vérification, relecture

- [ ] Guide section 60 (appliquer 0059 ; désactiver puis réactiver une formation de test avec un compte étudiant qui l'a commencée).
- [ ] `tsc`, `eslint`, suite complète ; relecture finale indépendante ; correctifs ; commit `docs: guide section 60 (désactivation)`.
