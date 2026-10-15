# Vidéos des leçons sur d'autres plateformes — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal :** accepter TikTok et Tella (mesurées : temps regardé, seuil, durée automatique) et Loom, ScreenPal, Google
Drive (sans mesure : lecteur officiel, leçon terminée d'un clic) pour les vidéos des leçons.

**Architecture :** une seule source pour les plateformes (`web/src/lib/video/plateformes.ts` : liste, mesurée ou non,
reconnaissance des liens, adresse d'intégration, libellé, lien public), utilisée par l'éditeur, la base de données de
l'app et la page leçon ; deux adaptateurs par messages (TikTok, Tella) dans `adaptateurs.ts` ; migration 0030.

**Tech Stack :** Next.js 16.4, Supabase/Postgres (PGlite pour les tests de la base), Vitest/jsdom.

**Spec :** `docs/superpowers/specs/2026-10-15-plateformes-video-design.md`

## Global Constraints

- La base garde fournisseur + identifiant, jamais le lien collé.
- Messages des lecteurs : origine vérifiée (`https://www.tiktok.com`, `https://www.tella.tv`), jamais de `*` pour Tella.
- Textes en français ; téléphone compact.
- La communauté (vidéos des publications) ne change pas.

## Review Focus

1. Un lien d'une autre plateforme (ou un faux domaine `tiktok.com.evil.com`) n'est jamais reconnu.
2. Un message d'une autre origine (ou d'une autre iframe) ne fait pas avancer le temps regardé.
3. Une leçon Drive / Loom / ScreenPal se termine d'un clic, même par appel direct à `terminer_lecon` ; une leçon TikTok
   ou Tella, non.
4. Une leçon sans mesure n'exige pas de durée ; une leçon mesurée, si.
5. TikTok vertical ne dépasse pas la hauteur de l'écran, au téléphone comme à l'ordinateur.

---

### Task 1 : migration 0030
Files : `web/supabase/migrations/0030_plateformes_video.sql` ; test `web/tests/db/plateformes-video.test.ts`.
- [ ] Tests : formats acceptés et refusés par plateforme ; `terminer_lecon` accepte une leçon sans mesure et refuse
  TikTok ; `commencer_visionnage` refuse une leçon sans mesure → ÉCHEC → migration → SUCCÈS → commit.

### Task 2 : les plateformes et leurs liens
Files : Create `web/src/lib/video/plateformes.ts` ; Modify `lib/admin/video.ts` (s'appuie dessus), `lib/lecon/types.ts`,
`lib/lecon/regles.ts` (`urlIntegration`), `lib/admin/data.ts`, `lib/lecon/data.ts` (lecture des 7 fournisseurs) ;
test `web/tests/video/plateformes.test.ts`.
- Produces : `type Fournisseur`, `estMesuree(f)`, `parseVideoUrl`, `videoLabel`, `videoLink`, `urlIntegration`,
  `messageLienCourt(lien)`.
- [ ] Tests : chaque forme de lien du §2, faux domaines, liens courts TikTok, adresses d'intégration → ÉCHEC → SUCCÈS → commit.

### Task 3 : adaptateurs TikTok et Tella
Files : Modify `web/src/lib/video/adaptateurs.ts` ; test `web/tests/video/adaptateurs-messages.test.ts`.
- [ ] Tests (faux iframe et messages) : prêt, état, position et durée, fin, commandes envoyées, origine refusée →
  ÉCHEC → SUCCÈS → vérification réelle dans le navigateur (page d'essai jamais commitée) → commit.

### Task 4 : la page leçon
Files : Modify `ContenuLecon.tsx`, `LecteurEtudium.tsx` (format vertical), `LecteurVideo.tsx`, la page leçon
(`avecVideo` = vidéo mesurée) ; test `web/tests/lecon/plateformes-lecon.test.tsx`.
- [ ] Tests : Drive / Loom / ScreenPal → lecteur officiel et « Terminer la leçon » actif ; TikTok → lecteur Étudium
  vertical → ÉCHEC → SUCCÈS → commit.

### Task 5 : l'éditeur
Files : Modify `EditeurLecon.tsx`, `lib/admin/actions.ts` (durée exigée seulement pour une vidéo mesurée) ; tests
`web/tests/admin/editeur-lecon.test.tsx`, `web/tests/admin/actions*.test.ts`.
- [ ] Tests : libellé reconnu par plateforme, message « sans mesure », rappel Drive, lien court TikTok, durée facultative
  pour Drive, exigée pour TikTok → ÉCHEC → SUCCÈS → commit.

### Task 6 : vérification, guide, revue, bilan
- [ ] Suite, lint, tsc, build ; rendu ; guide section 36 ; revue finale (opus) ; une passe de corrections ; bilan ;
  mémoire.
