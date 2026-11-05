# « Mes résultats » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'espace « Mes résultats » : parcours scolaires, semestres, UE, ECUE, notes ; moyennes, crédits, mentions et « Ce qu'il te faut » calculés selon les règles de l'école ; code PIN facultatif vérifié par la base.

**Architecture:**
- **Base** : la base garde la saisie brute (migration 0077) ; chaque table est réservée à son propriétaire.
- **Code PIN** : quand il existe, la base exige un jeton de déverrouillage. Ce jeton est envoyé par le serveur Next dans l'en-tête `x-etudium-resultats` (lu dans `request.headers`) et gardé dans un cookie httpOnly.
- **Calculs** : ce sont des fonctions pures en TypeScript (`src/lib/resultats/calcul.ts`), partagées par l'écran et les tests.
- **Écrans** : des pages serveur derrière une porte (code PIN ou proposition de code), et des composants clients pour la saisie (fenêtres) et l'affichage.

**Tech Stack:** Next.js 16 (App Router, cacheComponents), Supabase (Postgres + RLS + PostgREST), Vitest + PGlite, Tailwind v4, hugeicons.

**Spec:** `docs/superpowers/specs/2026-11-05-mes-resultats-design.md` (choix du §7 : toutes les recommandations).

## Global Constraints

**Nom et accès**
- Nom affiché : « Mes résultats » ; adresse `/mes-resultats` (espace étudiant) ; entrée dans « Mon espace » (barre latérale et menu ≡).
- Gratuit pour tous les comptes. Personne d'autre que le propriétaire ne lit ni n'écrit ses résultats, pas même l'équipe.

**Règles de calcul par défaut**
- Le barème est « Contrôle continu 40 % » (`cc`) puis « Examen 60 % » (`examen`, `examen: true`).
- Le seuil d'une UE est de 10/20, de même que celui du semestre.
- La compensation est désactivée ; le rattrapage remplace l'examen.
- Modèles de barème : 40/60, 30/70, 50/50, « Examen seul » (100 %), « Personnalisé » (1 à 6 types, total 100 %, au plus un type « examen »).

**Notes et moyennes**
- Notes sur 20 par défaut (`sur` de 1 à 100), ramenées sur 20.
- Moyennes affichées avec 2 décimales et une virgule (« 12,46 »), calculées sans arrondi.
- Mentions : Passable dès 10, Assez bien dès 12, Bien dès 14, Très bien dès 16.

**Code PIN**
- Le code PIN fait 4 chiffres. L'espace se reverrouille après 15 minutes sans activité. Au bout de 5 erreurs, il est bloqué 15 minutes.
- En cas d'oubli, il faut s'être reconnecté dans les 10 dernières minutes (`amr` du jeton de session) pour en créer un nouveau.

**Rédaction, limites et numérotation**
- Textes en français, avec des apostrophes typographiques (’) dans l'interface.
- Limites par compte : 10 parcours ; par parcours, 20 semestres ; par semestre, 30 UE ; par UE, 20 ECUE ; par ECUE, 60 notes.
- Prochaine migration : 0077 ; guide « Ce qui te revient », section 76. Rien n'est poussé avant que l'utilisateur ait appliqué la 0077.

## Review Focus

1. Un barème modifié après coup laisse des notes d'un type qui n'existe plus : elles ne comptent pas, et l'écran les signale (« n'entre dans aucun type »). Un test le vérifie à la tâche 2.
2. Une note sur 10 ou sur 40 est ramenée sur 20 avant la moyenne. Testé à la tâche 2.
3. Une UE sans ECUE, ou une ECUE sans note, n'est ni validée ni comptée dans le semestre. Elle est « Provisoire » seulement si elle a déjà des notes. Testé à la tâche 2.
4. Un jeton expiré ou absent, alors qu'un code existe, ne lit rien et n'écrit rien, même avec la session ouverte. Testé à la tâche 1.
5. 5 codes faux bloquent l'espace, même si chaque erreur est rendue par la fonction : le compteur n'est pas annulé par une exception. Testé à la tâche 1.

---

### Task 1: La base (migration 0077)

**Files:**
- Create: `web/supabase/migrations/0077_resultats.sql`
- Modify: `web/tests/db/banc.ts` (4ᵉ paramètre facultatif de `en` : des réglages de requête, `request.headers` et `request.jwt.claims`)
- Test: `web/tests/db/resultats.test.ts`

**Interfaces:**
- Produces (tables) :
  - `parcours_scolaires(id, profil_id, nom, etablissement, regles jsonb, ordre, cree_le)` ;
  - `semestres_scolaires(id, parcours_id, profil_id, nom, annee, ordre)` ;
  - `ue_scolaires(id, semestre_id, profil_id, code, intitule, credits numeric, ordre)` ;
  - `ecue_scolaires(id, ue_id, profil_id, intitule, poids numeric, bareme jsonb null, ordre)` ;
  - `notes_scolaires(id, ecue_id, profil_id, categorie, libelle, note numeric, sur numeric, rattrapage boolean, date date, cree_le)`.
  - `profil_id` vaut `auth.uid()` par défaut. Les règles d'accès sont réservées au propriétaire, avec `resultats_ouverts()`, et le parent doit appartenir au même compte.
- Produces (fonctions) :
  - `etat_resultats() → jsonb { pin, ouvert, bloque_jusqua, propose }` (prolonge le jeton de 15 minutes) ;
  - `proposer_pin_vu()` ;
  - `definir_pin_resultats(p_pin text, p_actuel text default null) → jsonb { ok, jeton? , message? }` ;
  - `ouvrir_resultats(p_pin text) → jsonb { ok, jeton?, message? }` ;
  - `fermer_resultats()` ;
  - `retirer_pin_resultats(p_pin text) → jsonb { ok, message? }` ;
  - `oublier_pin_resultats() → boolean`.

- [ ] **Step 1:** écrire `tests/db/resultats.test.ts`. Cas à couvrir :
  - un compte crée parcours → semestre → UE → ECUE → note, et un autre compte (y compris un admin) ne lit rien ;
  - une note est refusée si elle dépasse `sur` ou si elle est négative ;
  - les règles et les barèmes invalides sont refusés (total 99, deux types « examen », clé invalide, 7 types) ;
  - les limites sont tenues (11ᵉ parcours refusé) ;
  - sans code : tout est lisible ;
  - avec code :
    - sans jeton, rien n'est lu ni écrit ;
    - avec le jeton rendu par `ouvrir_resultats`, tout est lu ;
    - un jeton expiré ne lit rien ;
    - 4 erreurs puis le bon code donnent `ok` ;
    - 5 erreurs donnent « Trop d’essais », et même le bon code est refusé ensuite ;
  - `definir_pin_resultats` avec un code existant exige le code actuel ;
  - `retirer_pin_resultats` rend tout lisible sans jeton ;
  - `oublier_pin_resultats` est refusé sans connexion récente, et accepté avec un `amr` daté de moins de 10 minutes ;
  - `etat_resultats` reflète tout cela ;
  - la migration se rejoue.
- [ ] **Step 2:** lancer `npx vitest run tests/db/resultats.test.ts`. Attendu : ÉCHEC (fichier de migration absent).
- [ ] **Step 3:** écrire la migration :
  - fonctions de validation `bareme_resultats_valide(jsonb)` et `regles_resultats_valides(jsonb)` ;
  - limites par déclencheur ;
  - `empreinte_pin(sel, pin)`, avec SHA-256 répété 1 000 fois, sans pgcrypto ;
  - les jetons sont des empreintes SHA-256 d'un aléa, valables 15 minutes ;
  - les erreurs de code sont rendues (`ok: false`) et jamais levées, pour que le compteur reste enregistré ;
  - droits : `authenticated` seulement, `anon` exclu.
- [ ] **Step 4:** relancer le test. Attendu : SUCCÈS. Puis `node scripts/assembler-migrations.mjs`, `npx vitest run tests/db/production-parties.test.ts tests/production` : SUCCÈS.
- [ ] **Step 5:** commit `feat(résultats): la base de « Mes résultats » (migration 0077)`.

### Task 2: Les calculs

**Files:**
- Create: `web/src/lib/resultats/types.ts`, `web/src/lib/resultats/calcul.ts`, `web/src/lib/resultats/regles.ts`
- Test: `web/tests/resultats/calcul.test.ts`, `web/tests/resultats/regles.test.ts`

**Interfaces:**
- Produces (types) :
  - `Categorie { cle, nom, poids, examen? }` ;
  - `Regles { seuilUe, seuilSemestre, compensation, rattrapage: "remplace" | "meilleure", categories }` ;
  - `Parcours`, `Semestre`, `Ue`, `Ecue`, `Note` (champs de la tâche 1 en camelCase) ;
  - `REGLES_PAR_DEFAUT`, `MODELES_BAREME: { cle, nom, categories }[]`.
- Produces (fonctions) :
  - `noteSur20(note): number` ;
  - `resultatEcue(ecue, notes, regles): { moyenne: number | null, provisoire, categories: { cle, nom, poids, moyenne }[], nonClassees: number, lineaire: { a, b } | null }`. `lineaire` décrit la moyenne en fonction de la note d'examen quand seul l'examen manque.
  - `resultatUe(ue, ecues, notes, regles): { moyenne, provisoire, validee: boolean | null, creditsAcquis, ecues, noteVisee: number | "acquis" | "impossible" | null }` ;
  - `resultatSemestre(semestre, ues, ecues, notes, regles): { moyenne, provisoire, credits, creditsAcquis, uesValidees, uesComptees, mention, valide: boolean | null, compense }` ;
  - `resultatParcours(...)` : semestres et moyenne générale pondérée par les crédits ;
  - `mention(moyenne)` ; `formaterNote(n)`.
  - Dans `regles.ts` : `refusBareme(categories): string | null`, `refusNote(note, sur)`, `refusCredits(c)`, `refusRegles(regles)`.

- [ ] **Step 1:** écrire les tests :
  - 40/60 avec CC = 12, examen = 8 → 9,6, non validée ;
  - UE de deux ECUE (12 avec 3 crédits, 8 avec 2) → 10,4, validée ;
  - une note sur 10 → doublée ;
  - le barème propre d'une ECUE prime sur celui du parcours ;
  - rattrapage « remplace » (examen 6 → rattrapage 11) et « meilleure » ;
  - provisoire : seulement le CC → moyenne du CC, `provisoire` ;
  - noteVisee : CC 12 en 40/60 → 8,67 à l'examen pour 10 ; « acquis » si le CC suffit ; « impossible » au-delà de 20 ; au niveau de l'UE avec deux ECUE sans examen ;
  - semestre : moyenne pondérée par les crédits, crédits acquis, mention ; compensation activée avec une moyenne ≥ 10 → `compense`, tous les crédits ; seuil de 12 ;
  - une note d'un type disparu → `nonClassees: 1`, ignorée ;
  - une UE sans ECUE → `moyenne: null`, ni validée ni comptée ;
  - `formaterNote(12.4567)` → « 12,46 » ;
  - `refusBareme` : total 99 → « Le total des poids doit faire 100 %. ».
- [ ] **Step 2:** `npx vitest run tests/resultats` → ÉCHEC.
- [ ] **Step 3:** écrire les fonctions. La moyenne d'un type est la moyenne simple de ses notes sur 20. Le rattrapage s'applique au type « examen ». La moyenne d'une ECUE est pondérée par les poids des types présents. La moyenne d'une UE est pondérée par les poids des ECUE qui ont une moyenne. Le semestre est pondéré par les crédits des UE qui ont une moyenne.
- [ ] **Step 4:** `npx vitest run tests/resultats` → SUCCÈS.
- [ ] **Step 5:** commit.

### Task 3: L'accès serveur

**Files:**
- Modify: `web/src/lib/supabase/server.ts` (option `entetes` → `global.headers`)
- Create: `web/src/lib/resultats/acces.ts` (`COOKIE_RESULTATS = "etudium-resultats"`, `clientResultats()`), `conversion.ts`, `data.ts`, `actions.ts` (« use server »)
- Test: `web/tests/resultats/acces.test.ts`

**Interfaces:**
- Produces (lectures) :
  - `lireEtat(): { pin, ouvert, bloqueJusqua, propose } | null` (null : migration absente) ;
  - `lireParcours(): ResumeParcours[]` ;
  - `lireParcoursComplet(id): ParcoursComplet | null`, avec les semestres, UE, ECUE et notes, triés par `ordre`.
- Produces (actions sur le code) :
  - `creerPin(pin)`, `ouvrirResultats(pin)`, `verrouillerResultats()`, `passerProposition()`, `changerPin(actuel, nouveau)`, `retirerPin(pin)`, `oublierPin()` ;
  - les actions qui ouvrent l'espace posent le cookie httpOnly (`sameSite: lax`, `secure` en production, durée de la session).
- Produces (actions sur le contenu) :
  - `enregistrerParcours`, `enregistrerSemestre`, `enregistrerUe`, `enregistrerEcue`, `enregistrerNote` (création si `id` est absent) ;
  - `supprimerElement(type, id)` et `deplacerElement(type, id, -1 | 1)`.
  - Toutes rendent `{ ok: true } | { ok: false, message }`, et appellent `etat_resultats` avant d'écrire pour prolonger le jeton.

- [ ] **Step 1:** tests avec le faux Supabase :
  - l'en-tête porte le jeton du cookie ;
  - `ouvrirResultats` pose le cookie quand le résultat est `ok`, et rend le message de la base sinon ;
  - `enregistrerUe` refuse des crédits invalides avant d'appeler la base, et sinon insère `semestre_id`, `code`, `intitule`, `credits` ;
  - la conversion des lignes imbriquées.
- [ ] **Step 2:** ÉCHEC. **Step 3:** écrire le code. **Step 4:** SUCCÈS. **Step 5:** commit.

### Task 4: La porte (code PIN)

**Files:**
- Create: `web/src/components/resultats/PorteResultats.tsx` (serveur), `DeverrouillageResultats.tsx`, `PropositionPin.tsx`, `SecuriteResultats.tsx`, `MinuterieResultats.tsx`
- Test: `web/tests/resultats/porte.test.tsx`

- [ ] **Step 1:** tests :
  - avec un code et sans ouverture : le clavier (`CodeInput` de 4 cases, libellé « Ton code PIN ») ; 4 chiffres saisis → `ouvrirResultats` ; un refus affiche son message ;
  - sans code ni proposition : « Protège tes résultats » avec « Créer mon code » (deux saisies identiques) et « Plus tard » → `passerProposition` ;
  - la fenêtre « Sécurité » : changer, retirer, « Code oublié ? » (explication puis « Me reconnecter »).
- [ ] **Step 2–4:** ÉCHEC → code → SUCCÈS. La minuterie rappelle `verrouillerResultats` après 15 minutes sans clic, frappe ni défilement.
- [ ] **Step 5:** commit.

### Task 5: Les écrans

**Files:**
- Create: `web/src/app/(app)/(etudiant)/mes-resultats/page.tsx` et `[parcours]/page.tsx`, ainsi que :
  - `web/src/components/resultats/ListeParcours.tsx` ;
  - `FenetreParcours.tsx` (nom, établissement, règles : modèle de barème ou types personnalisés, seuil d'UE, compensation et seuil de semestre, rattrapage) ;
  - `VueParcours.tsx` (onglets des semestres avec `?semestre=`, tuiles, cartes des UE) ;
  - `CarteUe.tsx` ;
  - `FenetresResultats.tsx` (semestre, UE, ECUE avec un barème propre, note avec son type, rattrapage, libellé, note, sur, date).
- Modify: `web/src/lib/navigation.ts` (`NAV_MON_ESPACE` : « Mes résultats » après « Tableau de bord ») et les tests des menus.
- Test: `web/tests/resultats/ecrans.test.tsx`

- [ ] **Step 1:** tests :
  - aucun parcours → « Crée ton premier parcours » ;
  - la fenêtre du parcours envoie les règles du modèle « 30 % / 70 % » ;
  - la vue d'un semestre : les tuiles (« Moyenne du semestre 10,40 », « Crédits 5 / 5 », mention « Passable ») ;
  - une carte d'UE « Validée », et ses ECUE avec le détail par type ;
  - « Il te faut au moins 8,67/20 à l’examen » ;
  - ajouter une note envoie `enregistrerNote` ;
  - une note de type disparu est signalée ;
  - le menu contient « Mes résultats ».
- [ ] **Step 2–4:** ÉCHEC → code → SUCCÈS.
- [ ] **Step 5:** commit.

### Task 6: Le guide, la vérification, la livraison

**Files:**
- Modify: `docs/guides/ce-qui-te-revient.md` (§76 : appliquer la 0077, puis ce qu'il faut vérifier) et `web/supabase/production/partie-5.sql` (régénéré).

- [ ] `npx tsc --noEmit`, `npm run build`, puis toute la suite `npx vitest run` → tout passe.
- [ ] Une capture des écrans sur une page d'aperçu temporaire, jamais commitée.
- [ ] Commit. Ne pas pousser : l'utilisateur applique d'abord la 0077, je sonde `parcours_scolaires` (401 ou 42501 = table présente), puis je pousse.
