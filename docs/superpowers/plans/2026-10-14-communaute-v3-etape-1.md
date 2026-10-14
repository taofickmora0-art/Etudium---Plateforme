# Communauté v3, étape 1 : le champ, l'éditeur, la largeur — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fil de 720 px au plus sur ordinateur, choix de l'espace dans le champ, emojis et liens dans l'éditeur.

**Architecture:** le format restreint gagne les liens `[texte](https://…)` (module pur `mise-en-forme.ts`, affichage `TexteMisEnForme`) ; l'éditeur active l'extension Link de Tiptap (http/https seulement) et deux boutons à fenêtre (Radix Popover) ; le champ reçoit la liste des espaces ouverts.

**Tech Stack:** Next.js 16.4, React 19.3, Tiptap 3.31.3, Radix Popover, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-communaute-v3-design.md` (§1)

## Global Constraints

- Messages en français ; aucun HTML d'un compte injecté ; liens `http`/`https` seulement, nouvel onglet, `rel="noopener nofollow ugc"`.
- Pas de migration à cette étape.
- Sur téléphone, tailles compactes (`max-sm:`).

## Review Focus

1. Un lien forgé (`[x](javascript:…)`, `[x](data:…)`, crochets imbriqués, `)` dans l'adresse) : reste du texte ou s'arrête proprement, jamais un lien dangereux.
2. L'aller-retour avec un lien en gras, un lien sur une partie d'un mot, deux liens collés.
3. Un texte d'avant contenant des crochets (« [1] », « [voir] ») : inchangé à l'affichage.
4. Publier dans un autre espace que l'onglet : la publication n'apparaît pas dans un fil qui ne la contient pas.
5. La largeur : à 1920 px, une vidéo et une image ne dépassent pas 720 px de large.

---

### Task 1 : Les liens dans le format

**Files :** `web/src/lib/communaute/mise-en-forme.ts` ; `web/tests/communaute/mise-en-forme.test.ts`.
**Produces :** `Segment` texte gagne `lien?: string` ; `[texte](https://…)` lu et écrit ; nœud Tiptap `link` (attrs.href).
- [ ] Tests : lecture (dont lien en gras, lien sur une partie de mot), refus (`javascript:`, `data:`, crochets non fermés, adresse sans `https?://`), anciens textes à crochets, `texteBrut` (le texte du lien), aller-retour éditeur (lien seul, lien en gras, deux liens collés, crochets littéraux échappés).
- [ ] FAIL → implémenter → PASS → commit `feat(communaute): les liens dans le texte mis en forme`

### Task 2 : L'éditeur — Lien et Emoji ; l'affichage des liens

**Files :** `lib/communaute/editeur-schema.ts`, `components/communaute/{EditeurTexte,TexteMisEnForme}.tsx`, create `components/communaute/emojis.ts` ; tests `tests/communaute/{editeur,texte-mis-en-forme}.test.tsx`.
- [ ] Tests : `TexteMisEnForme` rend `<a target="_blank" rel="noopener nofollow ugc">` ; l'éditeur sans tête : `setLink` refuse `javascript:` ; la barre a « Lien » et « Emoji » ; tout sélectionner, Lien, adresse, Valider → `[Bonjour](https://exemple.com)` ; Emoji → l'emoji inséré.
- [ ] FAIL → implémenter → PASS → commit `feat(communaute): liens et emojis dans l'éditeur`

### Task 3 : « Publication dans : » et la largeur

**Files :** `components/communaute/{ChampPublication,PageCommunaute}.tsx` ; tests `tests/communaute/{page,actualites}.test.tsx`.
- [ ] Tests : la liste « Publication dans » (espaces ouverts, l'onglet par défaut) ; publier dans Académique depuis Actualités → `publierPublication(P, …)`, la carte paraît ; depuis l'onglet Général vers Académique → elle n'apparaît pas dans Général ; le fil porte `max-w-[720px]`.
- [ ] FAIL → implémenter → PASS → commit `feat(communaute): choisir l'espace et un fil de 720 px`

### Task 4 : Vérification

- [ ] lint, types, build ; essai au navigateur (page temporaire) : lien, emoji, espace ; rendu 1440 et 390 px ; suite complète.
