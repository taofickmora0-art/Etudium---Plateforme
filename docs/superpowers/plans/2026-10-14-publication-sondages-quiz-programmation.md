# Publication : sondages, quiz et programmation — plan d'exécution (à valider)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** le champ de publication façon capture YouTube (Image, Sondage avec images, Sondage avec texte, Quiz, Vidéo,
Fichier ; « Publier ▾ Programmer… ») et les cartes de sondage et de quiz.

**Architecture:** migration 0026 (parution programmée, sondages, options, votes ; carte enrichie ; fil filtré par
`publie_le`) ; règles pures dans `lib/communaute/sondage.ts` ; composants `ChampSondage`, `ChampQuiz`, `BoutonPublier`
(bouton double), `CarteSondage`, `CarteQuiz`, onglets « Publiées / Programmées ».

**Tech Stack:** Next.js 16.4, React 19.3, Supabase, vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-10-14-publication-sondages-quiz-programmation-design.md`

## Global Constraints

- **Aucun codage avant la validation de l'utilisateur.**
- Textes en français ; heure du Bénin ; une seule pièce par publication.
- La 0026 reprend `publier`, `carte_publication` (0025) et `fil_communaute`, `publications_tendances`, `activites_recentes`
  (0021) par script.
- La bonne réponse d'un quiz n'est jamais rendue avant la réponse du compte.

## Review Focus

1. Quiz : aucune fuite de la bonne réponse (carte, fil, page de la publication, file de modération) avant de répondre.
2. Publication programmée : invisible des autres jusqu'à l'heure (fil, tendances, activités, page directe, recherche).
3. Vote : un seul par compte (deux onglets en même temps), refusé après la fin, « plusieurs réponses » respecté.
4. Sondage avec images : fichiers vérifiés comme les pièces jointes, retirés si la publication est refusée ou supprimée.
5. Avant la 0026 : publier sans sondage ni programmation marche comme avant.

---

### Task 1: Migration 0026 (base, droits, carte, fil) — tests PGlite d'abord
### Task 2: Règles et actions (`lib/communaute/sondage.ts`, `publierPublication` + sondage et date, `voter`, `reprogrammer`)
### Task 3: Le champ de publication (rangée d'options, éditeurs de sondage, de quiz, bouton double et fenêtre « Programmer »)
### Task 4: Les cartes (sondage texte, sondage images, quiz ; « Programmée pour le … »)
### Task 5: Onglets « Publiées / Programmées » de l'auteur
### Task 6: Vérification (lint, types, suite, compilation, rendu 1440 / 390 px) et guide (section 31)

Chaque tâche : tests d'abord (échec constaté), implémentation, tests verts, commit ; détail des interfaces écrit à la
validation (les réponses aux questions du §7 de la spec changent les signatures).
