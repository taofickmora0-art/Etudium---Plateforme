# Tâche 0.7 — Appli installable : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étudium s'installe depuis le navigateur. Elle s'ouvre alors dans sa propre fenêtre, avec son icône (le logo hexagonal du design) et un écran de lancement à ses couleurs.

**Architecture:**
- **Manifeste.** C'est celui de Next 16 (`app/manifest.ts`), servi à `/manifest.webmanifest`.
- **Icônes.** Ce sont des PNG générés une fois pour toutes, depuis le logo du design, par un script `sharp` (déjà installé avec Next). Elles sont rangées dans `public/icons/` ; l'icône iOS et le favicon suivent les conventions de fichiers de Next (`app/apple-icon.png`, `app/icon.svg`).
- **Pas de service worker.** Il n'est plus requis par Chrome pour installer une appli, et le travail hors connexion n'est pas dans le périmètre de la 0.7.

**Tech Stack:** Next.js 16 (métadonnées `manifest`, `icon`, `apple-icon`, `viewport`), sharp 0.35, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-10-lot-0-fondations-design.md` (§2 ligne « Appli installable », §8 ligne 0.7) ; feuille de route `docs/superpowers/specs/2026-10-09-feuille-de-route-design.md`, ligne 0.7.

## Global Constraints

- **Icône.** Le logo hexagonal du design : hexagone `#0B18C9` aux angles arrondis, « É » blanc (`src/components/brand/Logo.tsx`).
- **Couleurs.** Fond de page `#F2F6FD`, bleu `#0B18C9`.
- **Validation (spec §8, ligne 0.7).** « Dans Chrome sur ton ordinateur, le bouton « Installer Étudium » apparaît et l'appli s'ouvre dans sa propre fenêtre. Sur téléphone, l'installation exige une adresse en `https` : on la vérifiera au passage en production. »
- **Accès sans compte.** Fichiers publics (manifeste, icônes) : jamais redirigés vers la connexion par le proxy.
- **Habitudes.** Tests d'abord ; commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Visiteur non connecté.** Le navigateur charge le manifeste et les icônes avant toute connexion. S'ils étaient redirigés vers `/connexion`, l'installation serait impossible. → Task 2 (test du proxy).
- **Icône « masquable » sur Android.** Android découpe l'icône en cercle ou en goutte. Le logo doit rester entier dans la zone sûre (80 % au centre), sur un fond plein. → Task 1.
- **Écran de lancement.** Il est composé par Android à partir du nom, de la couleur de fond et de l'icône de 512 px. Un fond blanc par défaut ferait un éclair blanc avant l'appli. → Task 2.
- **iPhone.** « Sur l'écran d'accueil » doit afficher l'icône Étudium (180 px) et le nom « Étudium », pas une capture de la page. → Tasks 1 et 2.
- **Favicon.** L'onglet du navigateur montre encore l'icône Next par défaut (`app/favicon.ico`) : il faut la remplacer par le logo. → Task 1.

---

### Task 1: Icônes générées depuis le logo

**Files:**
- Create:
  - `web/scripts/logo-etudium.svg` : le logo, viewBox 30×30, identique à `LogoMark` avec un « É » en police système en gras ;
  - `web/scripts/generer-icones.mjs` ;
  - `web/public/icons/icone-192.png`, `icone-512.png` et `icone-masquable-512.png` ;
  - `web/src/app/apple-icon.png` (180 × 180) ;
  - `web/src/app/icon.svg`.
- Delete: `web/src/app/favicon.ico` (icône Next par défaut).
- Test: `web/tests/pwa/icones.test.ts`

**Interfaces:**
- Produces :
  - `node scripts/generer-icones.mjs` (lancé à la main, une fois ; les PNG sont commités) ;
  - **icônes « any »** (192 et 512) : hexagone sur fond transparent, avec une marge de 6 % ;
  - **icône « masquable »** (512) : fond plein `#0B18C9`, logo blanc inversé (hexagone `#FFFFFF`, « É » `#0B18C9`) occupant 60 % au centre ;
  - **icône iOS** (180) : fond `#F2F6FD`, hexagone à 76 %, car iOS remplit la transparence en noir ;
  - **favicon** : `app/icon.svg`, copie du logo.

- [ ] **Step 1: Écrire les tests**
  - `les icônes ont les bonnes tailles` : avec `sharp(fichier).metadata()`, 192×192 et 512×512 en PNG ; `apple-icon.png` mesure 180×180.
  - `l'icône masquable a un fond plein` : le pixel (2, 2) est opaque et vaut `#0B18C9`, à 2 unités près par canal.
  - `l'icône iOS n'a pas de transparence` : `metadata().hasAlpha` est faux, ou le pixel (2, 2) est opaque et vaut `#F2F6FD`.
  - `l'onglet montre le logo Étudium` : `src/app/favicon.ico` n'existe plus et `src/app/icon.svg` contient `#0B18C9`.
- [ ] **Step 2:** `npx vitest run tests/pwa/icones.test.ts` → FAIL (fichiers absents).
- [ ] **Step 3:** Écrire le SVG et le script, puis lancer `node scripts/generer-icones.mjs` et supprimer `favicon.ico`.
- [ ] **Step 4:** → PASS. Regarder les PNG : le « É » est lisible et centré.
- [ ] **Step 5: Commit** `feat(pwa): icônes Étudium`.

### Task 2: Manifeste, métadonnées et guide

**Files:**
- Create: `web/src/app/manifest.ts`
- Modify: `web/src/app/layout.tsx` (`metadata.appleWebApp`, `export const viewport`), `docs/guides/ce-qui-te-revient.md` (validation de la 0.7)
- Test: `web/tests/pwa/manifeste.test.ts`

**Interfaces:**
- Produces :
  - `manifest(): MetadataRoute.Manifest` :
    - `name: "Étudium"`, `short_name: "Étudium"`, `lang: "fr"` ;
    - `description` : la même que le site ;
    - `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `orientation: "portrait"` ;
    - `background_color: "#F2F6FD"`, `theme_color: "#F2F6FD"` ;
    - `icons` : les deux PNG en `purpose: "any"`, plus le masquable en `purpose: "maskable"`.
  - Métadonnées : `appleWebApp: { capable: true, title: "Étudium", statusBarStyle: "default" }` ; `viewport = { themeColor: "#F2F6FD" }`.
- Ruling à reporter au journal :
  - **iPhone** : pas d'images de lancement (il en faudrait une par taille d'écran). iOS affiche le fond de la page avant l'appli.
  - **Bouton d'installation** : pas de bouton maison. Chrome affiche le sien, et le design n'en prévoit pas.

- [ ] **Step 1: Écrire les tests**
  - `le manifeste décrit l'appli` : `manifest()` correspond à `{ name: "Étudium", start_url: "/", display: "standalone", background_color: "#F2F6FD", theme_color: "#F2F6FD", lang: "fr" }`.
  - `chaque icône déclarée existe` : chaque `icons[i].src` existe sous `web/public`, et l'une d'elles a `purpose: "maskable"`.
  - `le manifeste et les icônes ne passent pas par le proxy` : `new RegExp(\`^${config.matcher[0]}$\`)` (le motif de `src/proxy.ts`) ne correspond ni à `/manifest.webmanifest`, ni à `/icons/icone-192.png`, ni à `/apple-icon.png`, mais correspond à `/accueil`.
  - `l'iPhone reconnaît l'appli` : `metadata.appleWebApp` correspond à `{ capable: true, title: "Étudium" }` et `viewport.themeColor` vaut `"#F2F6FD"`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** → PASS.
  - Suite entière, `tsc`, `eslint` et `npm run build` passent ; la compilation liste `/manifest.webmanifest`.
  - En production (`web-production`), sans base : `/manifest.webmanifest` et `/icons/icone-512.png` répondent 200 sans redirection.
- [ ] **Step 5: Guide.** Ajouter à « Ce qui te revient » la validation de la 0.7 :
  1. Ouvre http://localhost:3000 dans **Chrome** sur l'ordinateur. Dans la barre d'adresse, l'icône **« Installer Étudium »** apparaît (un écran avec une flèche).
  2. Clique dessus, puis **Installer** : l'appli s'ouvre dans sa propre fenêtre, avec le logo Étudium.
  3. Sur téléphone : à vérifier lors de la mise en ligne (`https` obligatoire).
- [ ] **Step 6: Commit** `feat(pwa): Étudium s'installe comme une appli`.

## Validation de la tâche 0.7 (par l'utilisateur)

Dans Chrome sur ton ordinateur, le bouton « Installer Étudium » apparaît et l'appli s'ouvre dans sa propre fenêtre.
