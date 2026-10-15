# Lot 3, étape A : les quiz — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal :** des quiz dans le programme des formations : le formateur les crée (quatre types de questions), l'étudiant
les passe une question à la fois, la base corrige, garde le meilleur score et applique le score minimal de la formation.

**Architecture :** un quiz est une leçon de type `quiz` (colonne `lecons.type`) ; ses questions dans `questions_quiz`,
les tentatives dans `tentatives_quiz` ; tout passe par des fonctions `security definer` (les bonnes réponses ne
quittent la base qu'après l'envoi). L'éditeur de leçon montre l'éditeur de questions pour un quiz ; la page leçon
montre le quiz (accueil, questions, résultat) à la place de la vidéo.

**Tech Stack :** Next.js 16.4, Supabase/Postgres (PGlite pour les tests), Vitest/jsdom.

**Spec :** `docs/superpowers/specs/2026-10-15-lot-3-quiz-exercices-certificats-design.md` (§1, §2, §9 validés).

## Global Constraints

- Quiz et exercices **hors du pourcentage de progression** et des comptes de leçons (fiche, suivi, avis à 50 %,
  statistiques) ; rien ne bloque ni ne se verrouille.
- Correction **sur le serveur** ; les bonnes réponses et explications ne sont envoyées qu'avec le résultat.
- Tentatives illimitées, **meilleur score** conservé ; **score minimal par formation** (`formations.score_quiz`, 70 par
  défaut, 0 à 100).
- Réponses multiples : juste seulement si exactement les bonnes. Réponse courte : comparée sans majuscules, accents
  ni espaces en trop.
- Textes en français ; téléphone compact ; avant la 0031, le reste de l'appli marche (replis).

## Review Focus

1. Un étudiant ne lit jamais les bonnes réponses avant d'avoir envoyé (ni par appel direct à la base).
2. Un étudiant sans accès à la leçon (payante, brouillon) ne passe pas le quiz, même par appel direct.
3. Le pourcentage de progression, « n leçons » et le temps restant ignorent les quiz.
4. Un quiz sans question, ou une question mal formée (aucune bonne réponse, une seule réponse proposée), est refusé à
   l'enregistrement avec un message clair.
5. Réponse courte : « Recherchex » et « RECHERCHEX » sont justes pour « RECHERCHEX » ; « RechercheV », non.

---

### Task 1 : migration 0031 (les quiz en base)
Files : Create `web/supabase/migrations/0031_quiz.sql` ; Test `web/tests/db/quiz.test.ts`.
- `lecons.type` (`lecon`, `quiz`, `exercice` ; défaut `lecon`), `formations.score_quiz` (0-100, défaut 70).
- Tables `questions_quiz` (lecon_id, ordre, genre `unique|multiple|vrai_faux|courte`, enonce, choix jsonb
  `[{texte, correcte}]`, reponses text[], explication) et `tentatives_quiz` (profil_id, lecon_id, numero, bonnes,
  total, score, detail jsonb, cree_le) ; RLS sans règle (fonctions seulement).
- Fonctions : `quiz_editeur(p_lecon)`, `enregistrer_quiz(p_lecon, p_questions jsonb)` (équipe ou formateur de la
  formation ; validation de chaque question ; remplace tout), `quiz_a_passer(p_lecon)` (sans les bonnes réponses ;
  meilleur score, nombre de tentatives, score minimal), `envoyer_quiz(p_lecon, p_reponses jsonb)` (corrige, enregistre,
  rend le détail), `mes_scores_quiz(p_formation)` ; comptages repris avec `type = 'lecon'` : `compte_equipe`,
  `peut_donner_avis`, `statistiques_back_office`, `suivi_formateur`, `suivi_formation`, `etudiant_formateur`,
  `envoyer_en_relecture`.
- [ ] Tests (accès, validation, correction des 4 genres, meilleur score, comptages) → ÉCHEC → migration → SUCCÈS → commit.

### Task 2 : la logique de l'appli
Files : Create `web/src/lib/quiz/{types,data,actions}.ts` ; Modify `lib/catalogue/{types,data}.ts` (type des leçons,
`nbQuiz`, comptes sans les quiz), `lib/progression/regles.ts` (`etatFormation` sans les quiz), `lib/admin/{types,data}.ts`
(type, nombre de questions, score du quiz), `lib/admin/actions.ts` (`addLecon` avec type, `saveLecon` qui enregistre les
questions d'un quiz, score minimal de la formation) ; tests `web/tests/quiz/*.test.ts`.
- [ ] Tests : conversions, replis avant 0031, `envoyerQuiz` (forme, refus), `etatFormation` ignore les quiz → ÉCHEC →
  SUCCÈS → commit.

### Task 3 : l'éditeur
Files : Create `web/src/components/admin/EditeurQuiz.tsx` ; Modify `OngletLecons.tsx` (« Nouvelle leçon » : Leçon ou
Quiz ; ligne « Quiz · 4 questions »), `EditeurLecon.tsx` (un quiz : l'éditeur de questions à la place de la vidéo et du
texte), `FormationInfosForm.tsx` (« Score minimal aux quiz »).
- [ ] Tests : ajouter un quiz ; ajouter, modifier, ranger, supprimer des questions des quatre genres ; enregistrer ;
  erreurs de la base affichées ; score minimal → ÉCHEC → SUCCÈS → commit.

### Task 4 : passer un quiz
Files : Create `web/src/components/quiz/QuizLecon.tsx` ; Modify la page leçon et `ContenuLecon.tsx` (un quiz à la place
de la vidéo ; pas de « Terminer la leçon »), `ProgrammeLecon`, `ProgrammeMobile`, `ProgrammeFiche`, `FicheConnectee`
(icône et « Quiz », meilleur score ; « 24 leçons · 4 quiz »).
- [ ] Tests : accueil (« 4 questions · meilleur score : — · score minimal : 70 % », « Commencer »), une question à la
  fois, précédente, passer, « Quitter le quiz ? », envoi, résultat (réussi ou pas encore, détail, Recommencer) →
  ÉCHEC → SUCCÈS → commit.

### Task 5 : vérification, guide, revue, bilan
- [ ] Suite, lint, tsc, build ; rendu ; guide section 37 (appliquer la 0031) ; revue finale (opus) ; corrections ;
  bilan ; mémoire.
