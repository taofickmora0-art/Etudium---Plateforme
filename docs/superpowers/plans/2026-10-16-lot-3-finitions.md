# Lot 3 — finitions (défauts reportés des étapes A, B et C) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les petits défauts laissés par les étapes A, B et C du lot 3, quand ils se voient ou touchent à la fiabilité. Préparer la recette 3.7 pour la partie faisable sans le lot 2.

**Architecture:**
- Une migration 0034, qui ne crée rien : elle reprend des fonctions et ajoute deux garde-fous.
- Des corrections ciblées dans `src/lib/{quiz,exercices,catalogue,certificats}` et leurs composants.
- La section 41 du guide.

**Tech Stack:** Next.js 16.4, Supabase/Postgres (banc PGlite), Vitest/RTL.

**Spec :** `docs/superpowers/specs/2026-10-15-lot-3-quiz-exercices-certificats-design.md`.

Les défauts eux-mêmes sont dans les bilans `docs/superpowers/bilans/2026-10-15-lot-3-etape-{a-quiz,b-exercices,c-certificats}.md`, rubrique « Petits défauts ».

## Global Constraints

- Migrations appliquées par l'utilisateur. La 0034 se rejoue sans erreur (`create or replace`, `if not exists`, `not valid`).
- Avant la 0034, l'appli marche comme aujourd'hui : aucune lecture nouvelle n'en dépend.
- Textes en français, apostrophes typographiques `’`, tutoiement interdit dans l'appli (vouvoiement).

## Ce qui est laissé (décisions)

- **A1** : le temps restant compte les quiz. Un quiz dure 0 minute, donc sans effet.
- **A4** : deux tentatives envoyées au même instant peuvent avoir le même numéro. C'est rare et sans conséquence sur le score.
- **B4** : des fichiers orphelins peuvent rester dans l'espace « rendus ». C'est le même comportement que la communauté ; un nettoyage viendra avec la mise en ligne.
- **B6** : les dates « il y a 2 min » sont calculées dans le navigateur. L'écart est minime.
- **B7** : un exercice devenu inaccessible reste dans la page Exercices. Le lien mène à la page verrouillée, qui l'explique. Une correction demanderait de reprendre `mes_exercices`.
- **C1** : deux événements simultanés retardent la délivrance du certificat jusqu'à la prochaine visite de la page, qui la rattrape.
- **C6** : déjà corrigé (l'en-tête du téléphone tient sur une ligne).

## Review Focus

1. Le refus de `terminer_lecon` sur un quiz ou un exercice ne doit pas bloquer une vraie leçon : texte, vidéo mesurée ou non mesurée (Task 1).
2. La contrainte de longueur ajoutée en `not valid` : les questions existantes, même trop longues, restent modifiables par `enregistrer_quiz`. Elle ne doit pas bloquer une ancienne ligne laissée telle quelle (Task 1).
3. Une lecture des scores ou des statuts qui échoue cache seulement l'information. Elle ne doit jamais masquer une vraie absence de migration (Task 2).
4. Une adresse `/c/` contenant `%` invalide, ou très longue, affiche « Aucun certificat trouvé » sans erreur (Task 4).
5. Un « aperçu gratuit » resté coché sur un ancien quiz n'apparaît plus nulle part comme leçon d'aperçu (Task 2).

---

### Task 1: Migration 0034 (base)

**Files:**
- Create: `web/supabase/migrations/0034_finitions_lot_3.sql`
- Test: `web/tests/db/finitions-lot-3.test.ts`

- [ ] **Step 1: les tests**, sur un banc avec les migrations 0001 à 0034 :
  - `terminer_lecon` sur un quiz est refusé (« Un quiz se réussit, il ne se termine pas. ») ;
  - sur un exercice, il est refusé (« Un exercice se termine depuis sa page. ») ;
  - sur une leçon texte, il passe.
  - Publier un quiz notifie « Nouveau quiz dans Excel », un exercice « Nouvel exercice dans Excel », une leçon « Nouvelle leçon dans Excel ».
  - `enregistrer_quiz` refuse un choix ou une réponse acceptée de plus de 300 caractères.
  - Un même `fichier` sur deux rendus est refusé.
- [ ] **Step 2:** lancer `npx vitest run tests/db/finitions-lot-3.test.ts`. Attendu : ÉCHEC (fichier 0034 absent).
- [ ] **Step 3: la migration**
  - `terminer_lecon`, reprise de la 0030, avec le contrôle du type ;
  - `notifications_lecons`, reprise de la 0027, avec un titre selon le type ;
  - fonction immuable `longueurs_quiz_ok(jsonb, text[])` et contrainte `questions_quiz_longueurs check (...) not valid` ;
  - index unique partiel `rendus_exercices_fichier_unique on (fichier) where fichier is not null`.
- [ ] **Step 4:** relancer les mêmes tests, plus `tests/db/quiz.test.ts`, `exercices.test.ts`, `plateformes-video.test.ts` et `lecons-statut.test.ts`. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `feat(lot3): migration 0034, finitions (quiz et exercices ne se « terminent » pas, notifications, garde-fous)`.

### Task 2: Quiz et aperçu (appli)

**Files:**
- Modify :
  - `web/src/lib/quiz/data.ts` et `web/src/lib/exercices/data.ts` (scores et statuts : repli `{}`) ;
  - `web/src/lib/catalogue/regles.ts` (`leconsApercu`, `etatAcces`) ;
  - `web/src/components/catalogue/ProgrammeFiche.tsx` (résumés, lien « Aperçu ») ;
  - `web/src/components/admin/EditeurLecon.tsx` (case d'aperçu masquée pour un quiz ou un exercice) ;
  - `web/src/components/admin/EditeurQuiz.tsx` (Entrée).
- Test: les fichiers voisins existants (`tests/quiz/`, `tests/catalogue/regles.test.ts`, `tests/admin/`).

- [ ] **Step 1: les tests**
  - `lireMesScores` sur une erreur autre que « fonction absente » renvoie `{}` et trace l'erreur ; idem pour `lireStatutsExercices`.
  - `leconsApercu` ignore un quiz coché « aperçu ».
  - `resumeProgramme` et la méta d'un module qui n'a que des quiz n'affichent pas « 0 leçon ».
  - L'éditeur d'un quiz n'a pas la case « Leçon d’aperçu gratuite ».
  - Entrée dans un champ de réponse de l'éditeur de quiz n'enregistre pas.
- [ ] **Step 2:** lancer ces tests. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire le code.
- [ ] **Step 4:** relancer les tests. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `fix(quiz): scores facultatifs, aperçu réservé aux leçons, « 0 leçon » masqué, Entrée dans l'éditeur`.

### Task 3: Exercices (appli)

**Files:** `web/src/components/exercices/DepotTravail.tsx`, `ListeExercices.tsx`, `web/src/components/corrections/CorrectionRendu.tsx` et leurs tests.

- [ ] **Step 1: les tests**
  - L'envoi annonce « Travail envoyé. Vous recevrez une notification dès la correction. », sans « Votre formateur a été prévenu ».
  - Un exercice simple affiche « Terminé il y a… » dans la page Exercices.
  - L'aide de la remarque dit « Visible par l’étudiant et par les correcteurs de la formation. ».
- [ ] **Step 2:** lancer ces tests. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire le code.
- [ ] **Step 4:** relancer les tests. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `fix(exercices): libellés justes (envoi, exercice simple, remarque)`.

### Task 4: Certificats (appli)

**Files:**
- `web/src/app/(catalogue)/c/[identifiant]/page.tsx` (lecture sûre de l'adresse) ;
- `web/src/components/certificats/{ValidationFormation,ListeCertificats,imageCertificat}.tsx` ;
- `web/src/app/(app)/(etudiant)/certificats/[identifiant]/image/route.ts` (cache privé d'un jour) ;
- `web/src/components/lecon/ProgrammeLecon.tsx` (lien « Validation et certificat » sous la progression).

- [ ] **Step 1: les tests**
  - `/c/%E0%A4%A` affiche « Aucun certificat trouvé. ».
  - Texte alternatif : « Certificat de réussite de Kossi Agbo… » et « …d’Aïcha Kpadé… ».
  - Le programme de la page leçon d'un compte connecté mène à `/formations/<slug>/validation`.
  - L'image du certificat porte `cache-control: private, max-age=86400`.
  - « En préparation » avec 0 leçon publiée explique « Les leçons de cette formation ne sont pas encore publiées. ».
  - Le certificat d'un formateur au nom de 60 caractères garde le nom dans sa colonne. Rendu vérifié à l'œil (sonde), car la taille ne se teste pas en jsdom.
- [ ] **Step 2:** lancer ces tests. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire le code.
- [ ] **Step 4:** relancer les tests. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `fix(certificats): adresse mal formée, élision, lien depuis la leçon, cache de l'image, nom long, formation sans leçon`.

### Task 5: Guide, recette et vérifications

- [ ] **Step 1:** guide, section 41 :
  - appliquer la 0034 ;
  - recette 3.7, partie faisable dès maintenant (visiteur, compte gratuit, formation gratuite, quiz, exercice, certificat, vérification). L'étape « abonné » viendra avec le lot 2, le téléphone avec la mise en ligne.
- [ ] **Step 2:** lancer la suite complète, `npm run lint`, `npx tsc --noEmit` et `npm run build`.
- [ ] **Step 3:** commit `docs(guide): section 41, finitions et recette du lot 3`.
