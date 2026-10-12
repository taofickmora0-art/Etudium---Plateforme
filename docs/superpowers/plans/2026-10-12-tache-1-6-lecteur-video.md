# Tâche 1.6 — Lecteur vidéo et temps réellement regardé : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** la vidéo d'une leçon se lit dans un lecteur aux couleurs d'Étudium, posé sur le lecteur officiel de YouTube ou de Vimeo. Pour un compte connecté, on enregistre les passages réellement regardés : une vidéo sautée jusqu'à la fin n'est pas validée, une vidéo regardée l'est, au seuil de la formation (90 % par défaut).

**Architecture :**
- **Base (migration 0007)** :
  - table `progression_lecons` : passages regardés en `int4multirange` (secondes), position, dernier envoi, terminée le ;
  - écriture seulement par deux fonctions `security definer` : `commencer_visionnage` et `enregistrer_visionnage`. La seconde refuse un envoi plus long que le temps écoulé et valide la leçon au seuil.
- **Suivi côté navigateur (`src/lib/video/suivi.ts`, règles pures)** :
  - une observation par seconde : position, heure, vitesse ;
  - un passage ne compte que si la position avance au rythme du temps écoulé ; un saut ne compte pas ;
  - les passages sont fusionnés.
- **Envoi** : route `POST /api/visionnage` (JSON, même origine), appelée toutes les 10 s, à la pause, à la fin et en quittant la page (`fetch` `keepalive`). Une action serveur ne survit pas à la fermeture de la page, d'où la route.
- **Lecteur (`LecteurEtudium`, client)** :
  - adaptateurs YouTube (IFrame API) et Vimeo (Player SDK), chargés à la demande, derrière une interface commune ;
  - commandes du design ;
  - si le script ne se charge pas, retour au lecteur officiel intégré de la 1.5 (sans suivi).
- **Page** :
  - `getLecon` lit le visionnage du compte, et la fiche donne le seuil ;
  - sous la vidéo : « Temps réellement regardé : N % » • « Seuil de validation fixé par la formatrice : 90 % » • « Avancer dans la barre ne compte pas ».

**Tech Stack :** Next.js 16.4 (route handler), React 19, Supabase (RPC, multiranges Postgres ≥ 14), YouTube IFrame API, Vimeo Player SDK, PGlite, Vitest.

**Spec :** `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` (§5 Vidéo et progression, Q3, Q4). **Annexe design :** `docs/superpowers/plans/2026-10-12-tache-1-5-annexe-design.md` §2.3, §2.4, §3.2.

## Global Constraints

- **Lecteur (annexe §2.3)** : boîte 16/9, rayon 16, fond `#1D1D1F`.
  - Bouton central « Lire la vidéo » : rond blanc de 72 px, `PlayIcon` 28 `#1D1D1F`, visible tant que la vidéo n'a pas démarré ou est en pause.
  - Barre du bas (padding 16/18, gap 10, sur un dégradé sombre pour rester lisible) :
    - légende 14/20 500 blanc « Module 3 · <titre> », sur ordinateur seulement ;
    - piste de 4 px (fond `rgba(255,255,255,0.28)`, remplissage blanc) : c'est un `input type="range"` nommé « Avancer dans la vidéo », avec `aria-valuetext` « 4 min 12 sur 12 min 40 » ;
    - à gauche : lecture/pause (`PlayIcon`/`PauseIcon` 18), son (`VolumeHighIcon`/`VolumeMute02Icon` 18, « Couper le son »/« Remettre le son »), « 04:12 / 12:40 » (12/18) ;
    - à droite : vitesse « 1× » (12/18 500, bouton qui passe à 1,25× → 1,5× → 2× → 0,75× → 1×, nommé « Vitesse de lecture : 1× »), sous-titres (`SubtitleIcon` 18, seulement si la vidéo en a, `aria-pressed`), plein écran (`FullScreenIcon`/`MinimizeScreenIcon` 18, seulement si le navigateur le permet).
  - Boutons de 36 px minimum, `focus-blanc`.
  - Pas de choix de qualité.
- **Lecteurs officiels** :
  - YouTube : `host: https://www.youtube-nocookie.com`, `playerVars` `{ controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3 }` ;
  - Vimeo : `{ id | url (avec le code), controls: false, dnt: true }`.
  - L'`iframe` officielle ne reçoit pas les clics : `pointer-events: none`, les commandes Étudium sont au-dessus.
- **Suivi** :
  - Échantillon : toutes les 1 s pendant la lecture.
  - Un passage `[p, q]` compte si `0 < q − p ≤ écoulé × vitesse × 1,5 + 0,75`, l'écoulé étant le temps réel depuis l'échantillon précédent. Sinon, c'est un saut : on repart de `q`.
  - Passages en secondes entières (`Math.floor`), fusionnés.
  - Envoi : `commencer` au premier « lecture » ; `enregistrer` toutes les 10 s pendant la lecture, à la pause, à la fin, au passage en arrière-plan (`visibilitychange` caché) et en quittant la page (`pagehide`).
  - Un envoi refusé (passage trop long) est abandonné ; on rappelle `commencer` au prochain « lecture ».
  - Un visiteur n'envoie rien.
- **Base** :
  - Durée de référence = durée de la leçon. Si le lecteur annonce une vidéo plus courte, mais d'au moins la moitié, on prend celle du lecteur. Si la leçon n'a pas de durée, on prend celle du lecteur.
  - Un envoi ne peut couvrir plus de `écoulé depuis le dernier envoi × 2 + 3` secondes (vitesse 2× au plus).
  - Leçon terminée quand `secondes vues × 100 ≥ seuil × référence`.
- **Ligne sous la vidéo (annexe §2.4)**, compte connecté seulement, ordinateur et téléphone (12/18 `#667085`, points séparateurs) :
  - « Temps réellement regardé : 33 % » • « Seuil de validation fixé par la formatrice : 90 % » • « Avancer dans la barre ne compte pas » ;
  - une fois la leçon validée, le premier élément devient « Leçon validée » (vert, `CheckmarkCircle02Icon` 16), et un toast annonce « Leçon terminée. ».
- **Route `/api/visionnage`** :
  - `POST`, `Content-Type: application/json` et en-tête `Origin` égal à l'origine du site ; sinon 403 ;
  - corps `{ action: "commencer", lecon }` ou `{ action: "enregistrer", lecon, passages: [debut, fin][] (50 au plus, 0 ≤ debut < fin ≤ 86 400), position, duree }` ;
  - réponses : 200 `{ secondesVues, reference, terminee }` (`{}` pour commencer) ; 400 corps invalide ; 401 sans compte ; 409 refus de la base.
- **Plus tard** : reprise à la position enregistrée, « Marquer comme terminée » et pourcentages : 1.7.
- **Textes** : français, vouvoiement, apostrophes typographiques. **Commits** : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Saut jusqu'à la fin** : aucun passage compté ; la base refuse un envoi inventé plus long que le temps écoulé. → Tasks 1, 2.
- **Passage regardé deux fois** : compté une fois (union des intervalles, côté navigateur et en base). → Tasks 1, 2.
- **Requête d'un autre site** (formulaire ou `fetch` sans en-tête JSON) : refusée, rien n'est enregistré. → Task 3.
- **Script YouTube ou Vimeo bloqué** (réseau, bloqueur) : la vidéo reste lisible avec le lecteur officiel, sans erreur. → Task 4.
- **Fermeture de l'onglet en pleine lecture** : le dernier envoi part (`keepalive`). → Task 4.

---

### Task 1: Visionnage en base (migration 0007)

**Files :** Create `web/supabase/migrations/0007_visionnage.sql` ; Test `web/tests/db/visionnage.test.ts`

**Interfaces :**
- Produces :
  - table `public.progression_lecons` :
    - colonnes : `profil_id` (défaut `auth.uid()`, références `profils`, cascade), `lecon_id` (références `lecons`, cascade), `passages int4multirange not null default '{}'`, `position_secondes integer not null default 0`, `dernier_envoi timestamptz`, `vue_le timestamptz not null default now()`, `terminee_le timestamptz` ;
    - clé primaire `(profil_id, lecon_id)`.
  - `public.commencer_visionnage(p_lecon uuid) returns void` ;
  - `public.enregistrer_visionnage(p_lecon uuid, p_passages int4multirange, p_position integer, p_duree_video integer default null) returns jsonb` → `{ "secondes_vues": int, "reference": int, "terminee": bool }`.
  - Erreurs : sans compte ou sans accès → `42501` ; leçon sans vidéo → `22023` ; non commencé → `55000` ; trop long → `22023`.

- [ ] **Step 1 : tests** (banc 0001–0007 + exemples ; vidéo YouTube posée sur « Découvrir l’interface », 370 s, seuil 90) :
  - commencer, puis (dernier envoi reculé de 30 s) enregistrer `{[0,40)}` → 40 s vues, non terminée ;
  - réenregistrer `{[20,60)}` → 60 s (union, pas 80) ;
  - un envoi de 300 s après 30 s → refusé, rien ne change ;
  - enregistrer sans avoir commencé → refusé ;
  - passages au-delà de la durée → coupés à 370 ;
  - atteindre 333 s (90 % de 370) → `terminee: true`, `terminee_le` posé et gardé ensuite ;
  - durée du lecteur 300 (≥ la moitié) → référence 300 ; durée du lecteur 100 → référence 370 ;
  - leçon fermée (Excel module 3) → refusé ; visiteur → refusé ; leçon sans vidéo → refusé ;
  - un autre compte ne voit pas la ligne ; `insert`/`update` directs sur la table refusés ;
  - la migration se rejoue.
- [ ] **Step 2 :** → FAIL. **Step 3 :** écrire la 0007 :
  - `begin/commit` ; RLS `select` des siennes seulement ;
  - `revoke insert, update, delete, truncate` pour `anon` et `authenticated` ;
  - fonctions `security definer`, `set search_path = ''`, `execute` révoqué à `public`/`anon` et accordé à `authenticated`. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(video): visionnage en base (migration 0007)`

### Task 2: Règles du suivi et lecture du visionnage

**Files :**
- Create : `web/src/lib/video/suivi.ts`
- Modify : `web/src/lib/catalogue/types.ts` (`FicheFormation.seuilVideo: number`), `web/src/lib/catalogue/data.ts` (lit `seuil_video`), `web/src/lib/lecon/types.ts`, `web/src/lib/lecon/data.ts`
- Test : `web/tests/video/suivi.test.ts`, `web/tests/lecon/data.test.ts`

**Interfaces :**
- Produces :
  - **`suivi.ts`** :
    - `type Intervalle = [number, number]` ;
    - `fusionner(intervalles): Intervalle[]` (triés, contigus fusionnés) ;
    - `ajouter(intervalles, nouveau): Intervalle[]` ;
    - `total(intervalles): number` ;
    - `versMultirange(intervalles): string` (`"{[0,40),[60,90)}"`, entiers, vides retirés) ;
    - `depuisMultirange(texte): Intervalle[]` ;
    - `type EtatSuivi = { position: number | null; instant: number; passages: Intervalle[] }` ;
    - `observer(etat, { position, instant, vitesse, enLecture }): EtatSuivi` (règle des Global Constraints ; hors lecture, on repart de la position) ;
    - `pourcentageVu(intervalles, reference): number` (arrondi, 0 si pas de référence, 100 au plus).
  - **`LeconDetail.visionnage`** : `{ passages: Intervalle[]; positionSecondes: number; terminee: boolean } | null`. Il est rempli pour un compte connecté, sur une leçon ouverte. Table absente → null.
  - **`FicheFormation.seuilVideo`** : 90 par défaut.

- [ ] **Step 1 : tests** :
  - fusion et ajout (chevauchement, contiguïté, ordre quelconque) ;
  - total ;
  - aller-retour multirange (`"{}"`, `"empty"`) ;
  - **observer** :
    - 1 s de lecture → `[p, p+1]` ;
    - saut de 300 s en 1 s → aucun passage ;
    - vitesse 2 → 2 s comptées ;
    - pause → rien ;
    - retour en arrière → rien ;
  - pourcentage ;
  - `getLecon` connecté lit `progression_lecons` (`passages` `"{[0,40)}"`, `terminee_le` non nul) → `visionnage` ;
  - visiteur → aucune lecture et `visionnage: null` ;
  - la fiche porte `seuilVideo`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(video): règles du suivi et lecture du visionnage`

### Task 3: Route d'envoi `/api/visionnage`

**Files :** Create `web/src/app/api/visionnage/route.ts` ; Test `web/tests/video/route.test.ts`

**Interfaces :**
- Consumes : `versMultirange` (Task 2), RPC (Task 1).
- Produces : `POST(request: Request): Promise<Response>` (contrat des Global Constraints).

- [ ] **Step 1 : tests** (faux client Supabase avec `auth.getUser`, `rpc`) :
  - sans `Origin` du site ou sans JSON → 403, aucun appel ;
  - corps invalide (leçon non UUID, 51 passages, `debut ≥ fin`, valeur négative) → 400 ;
  - sans compte → 401 ;
  - `commencer` → `rpc("commencer_visionnage", { p_lecon })` → 200 ;
  - `enregistrer` → `rpc("enregistrer_visionnage", { p_lecon, p_passages: "{[0,40),[60,90)}", p_position: 90, p_duree_video: 370 })` → 200 `{ secondesVues: 70, reference: 370, terminee: false }` ;
  - erreur de la base → 409.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter (zod). **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(video): route d'envoi du temps regardé`

### Task 4: Lecteur aux couleurs d'Étudium

**Files :**
- Create : `web/src/lib/video/adaptateurs.ts` (chargement des scripts YouTube et Vimeo, interface commune), `web/src/components/lecon/LecteurEtudium.tsx`
- Test : `web/tests/video/lecteur.test.tsx`

**Interfaces :**
- Produces :
  - `type Adaptateur = { lire(); pause(); aller(s: number); position(): Promise<number>; duree(): Promise<number>; setMuet(m: boolean); setVitesse(v: number); sousTitres(): Promise<boolean>; setSousTitres(actifs: boolean); detruire(); }` ;
  - `creerAdaptateur(video: VideoLecon, conteneur: HTMLElement, evenements: { pret(); etat(enLecture: boolean); fin() }): Promise<Adaptateur>`. Rejette si le script ne charge pas (délai : 8 s).
  - `LecteurEtudium({ video, titre, legende, leconId, suivre: boolean, passagesInitiaux, reference, seuil, termineeInitiale, creer? })`. `creer` remplace `creerAdaptateur` dans les tests.

- [ ] **Step 1 : tests** (faux adaptateur, horloge simulée `vi.useFakeTimers`, `fetch` simulé) :
  - « Lire la vidéo » → `lire()` ; puis « Mettre en pause » ;
  - affichage « 00:00 / 06:10 » ;
  - piste « Avancer dans la vidéo » → `aller(120)` ;
  - vitesse « 1× » → `setVitesse(1.25)`, libellé « 1,25× » ;
  - son → `setMuet(true)` ;
  - sous-titres absents → pas de bouton ;
  - **suivi** :
    - lecture continue 12 s → premier envoi `commencer`, puis `enregistrer` avec `passages: [[0, 10]]` (ou plus) ;
    - un saut de 300 s n'est pas envoyé ;
    - `pagehide` → envoi `keepalive: true` ;
  - réponse `terminee: true` → « Leçon validée » et toast « Leçon terminée. » ;
  - `suivre={false}` (visiteur) → aucun `fetch` ;
  - adaptateur qui échoue → `iframe` du lecteur officiel (titre « Vidéo : … »).
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(video): lecteur aux couleurs d'Étudium avec suivi du temps regardé`

### Task 5: Intégration, guide et vérifications

**Files :**
- Modify : `web/src/components/lecon/ContenuLecon.tsx` (`LecteurEtudium` à la place de `LecteurVideo`), `docs/guides/ce-qui-te-revient.md` (section 10)
- Test : `web/tests/lecon/page-lecon.test.tsx`

- [ ] **Step 1 : tests** :
  - **connecté** : ligne « Temps réellement regardé : 11 % » (40 s sur 370), « Seuil de validation fixé par la formatrice : 90 % », « Avancer dans la barre ne compte pas » ;
  - leçon déjà validée → « Leçon validée » ;
  - **visiteur** : pas de ligne.
- [ ] **Step 2 :** → FAIL. **Step 3 :** intégrer. **Step 4 :** → PASS.
- [ ] **Step 5 : guide**, section 10 « Valider le lecteur vidéo (tâche 1.6) » :
  1. Appliquer `0007_visionnage.sql`.
  2. Une leçon avec vidéo : les commandes Étudium (lecture, piste, son, vitesse, plein écran).
  3. Sauter jusqu'à la fin : le pourcentage ne bouge pas.
  4. Regarder (vitesse 2× permise) jusqu'à 90 % : « Leçon validée ».
  5. Recharger : le pourcentage est gardé.
  6. Vimeo : coller le lien d'une vidéo Vimeo publique.
- [ ] **Step 6 :** suite, `tsc`, `eslint`, `npm run build`, rendu du lecteur à 1440, 390 et 320 px.
- [ ] **Step 7 : commit** `feat(video): lecteur intégré à la page leçon et guide de validation`
