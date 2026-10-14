# Publication : sondages, quiz et programmation — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** le champ de publication façon capture YouTube (Image, Sondage avec images, Sondage avec texte, Quiz, Vidéo,
Fichier ; « Publier ▾ Programmer… »), les cartes de sondage et de quiz, les onglets « Publiées / Programmées ».

**Architecture:** une publication programmée est enregistrée avec son heure de parution comme date (`cree_le` dans le
futur) : le fil, le tri, les « il y a … » restent justes ; la visibilité et les interactions exigent `cree_le <= now()`
(sauf pour son auteur, dans « Programmées », et pour l'équipe). Sondages et quiz : tables `sondages`, `options_sondage`,
`votes_sondage` ; la carte rend un bloc `sondage` calculé pour le compte (résultats et bonne réponse seulement quand il y
a droit).

**Tech Stack:** Next.js 16.4, React 19.3, Supabase, vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-10-14-publication-sondages-quiz-programmation-design.md` (validée le 14 octobre
avec les propositions du §7 : un seul ajout ; pas d'« Archivées » ; quiz à une bonne réponse, définitive ; pas de
notification à la parution ; « Quoi de neuf, … ? » gardé).

## Global Constraints

- Textes en français ; heure du Bénin ; une seule pièce par publication (image, fichier, vidéo, sondage ou quiz).
- La 0026 reprend par script : `publication_visible`, `publication_ouverte`, `verifier_piece` (0020), `publier` (0022),
  `fil_communaute`, `publications_tendances`, `activites_recentes`, `fichier_communaute_lisible` (0021),
  `fichier_communaute_attache` (0019), `carte_publication` (0025).
- La bonne réponse d'un quiz et les résultats d'un sondage ne sont jamais rendus à un compte qui n'y a pas droit.
- Programmation : de 10 min (9 min de tolérance en base) à 3 mois ; sondage : 2 à 10 options texte (80 caractères),
  2 à 6 images ; quiz : 2 à 6 réponses, une seule bonne, explication 300 caractères ; fin : 1 j, 3 j, 7 j (défaut), 14 j, aucune.

## Review Focus

1. Quiz : pas de fuite de la bonne réponse (fil, page, moderation) avant la réponse du compte.
2. Programmée : invisible des autres (fil, populaires, enregistrées, tendances, activités, page directe) et sans
   interaction (commentaire, J’aime, signet, signalement) avant l'heure.
3. Vote : un seul vote par compte (concurrence), refusé après la fin ou avant la parution ; « plusieurs réponses » respecté ;
   quiz définitif.
4. Images de sondage : fichiers vérifiés (dossier du compte, type, taille), lisibles par les membres de l'espace,
   retirés à la suppression.
5. Avant la 0026 : publier sans sondage ni programmation marche comme avant.

---

### Task 1: Migration 0026 — tests PGlite d'abord (`tests/db/sondages.test.ts`)
- Produces : `publier(p_parcours, p_titre, p_texte, p_piece, p_analyse, p_apercu, p_video, p_publie_le timestamptz default null, p_sondage jsonb default null)` ;
  `voter(p_publication uuid, p_options uuid[]) returns jsonb` (le bloc à jour) ; `reprogrammer(p_publication uuid, p_publie_le timestamptz) returns void`
  (null : maintenant) ; `images_sondage(p_publication uuid) returns text[]` ; `bloc_sondage(p_publication uuid) returns jsonb` ;
  carte : `programmee`, `sondage` ; `fil_communaute(…, p_tri 'programmees')`.
- Messages : « Choisissez une heure au moins 10 minutes plus tard. », « Choisissez une date dans les 3 mois qui viennent. »,
  « Une publication porte un seul ajout : une image, un fichier, une vidéo, un sondage ou un quiz. », « Ce sondage est terminé. »,
  « Vous avez déjà répondu à ce quiz. », « Choisissez une seule réponse. », « Cette publication n’est pas encore parue. ».
- Guide section 31.

### Task 2: Règles et actions
- `lib/communaute/sondage.ts` (pur) : `refusSondage(s: SondageSaisi): string | null`, `DUREES_SONDAGE`, `finDepuis(duree, debut)`,
  `refusProgrammation(iso, maintenant)`, `pourcentages(options)`.
- `publierPublication(…, options?: { sondage?: SondageSaisi; publieLe?: string | null })`, `voter(publicationId, optionIds)`,
  `reprogrammer(publicationId, publieLe | null)`, `chargerFil(…, "programmees")` ; `Publication.programmee`, `Publication.sondage`.

### Task 3: Le champ de publication
- Rangée d'options (Image, Sondage avec images, Sondage avec texte, Quiz, Vidéo, Fichier), éditeurs `ChampSondage`
  (texte et images) et `ChampQuiz`, `BoutonPublier` (bouton double, menu « Programmer… », fenêtre date et heure).

### Task 4: Les cartes
- `CarteSondage` (texte, images) et `CarteQuiz` ; étiquette « Programmée pour le … » ; menu ⋮ « Modifier la date »,
  « Publier maintenant ».

### Task 5: Onglets « Publiées / Programmées » sous le champ

### Task 6: Vérification (lint, types, suite, compilation, rendu 1440 / 390 / 320 px), revue finale, bilan
