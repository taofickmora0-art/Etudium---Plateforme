# Onglet « Apprenants » — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal :** un quatrième onglet « Apprenants » dans l'éditeur d'une formation (back-office et espace formateur) : les
comptes qui suivent la formation, leur progression et leur état.

**Architecture :** migration 0029 (`suivi_formation` interne, `apprenants_formation` pour l'équipe et le formateur de
la formation) ; lecture et action dans `web/src/lib/formateur/apprenants.ts` ; un composant serveur `OngletApprenants`
(première page) et un composant client `ListeApprenants` (filtres, recherche, pages), branchés dans `FormationOnglets`.

**Tech Stack :** Next.js 16.4 (cacheComponents), Supabase/Postgres, Vitest (PGlite pour la base, jsdom pour l'écran).

**Spec :** `docs/superpowers/specs/2026-10-15-apprenants-formation-design.md`

## Global Constraints

- Tous les textes en français ; formulations sans genre (« Terminée » porte sur la formation, pas sur la personne).
- Jamais d'adresse e-mail ; filtres et recherche jamais dans l'adresse de la page.
- Fonctions SQL : `security definer`, `set search_path = ''`, droits d'exécution retirés à `public` et `anon`.
- Avant la 0029 : « Appliquez la migration 0029 (guide « Ce qui te revient », section 35). »
- Téléphone : tailles compactes (`max-sm:`), libellés lisibles à 115 %.

## Review Focus

1. Un formateur qui appelle `apprenants_formation` sur la formation d'un autre formateur : refus, même par appel direct.
2. Une leçon en brouillon ouverte par un compte (avant d'être dépubliée) ne compte ni dans le total ni dans « terminées ».
3. Une recherche contenant `%` ou `_` : jamais un joker.
4. Une formation sans aucune leçon publiée : pas de division par zéro, progression 0 %.
5. Le formateur de la formation et l'équipe qui ouvrent ses leçons n'apparaissent pas comme apprenants.

---

### Task 1 : migration 0029

**Files :** Create `web/supabase/migrations/0029_apprenants_formation.sql` ; Test `web/tests/db/apprenants-formation.test.ts`.

**Interfaces — Produces :** `apprenants_formation(p_formation uuid, p_recherche text default '', p_etat text default
'tous', p_page integer default 1, p_maintenant timestamptz default now()) returns jsonb` :
`{ resume: { apprenants, progression_moyenne (0-100, entier), terminees, a_risque }, total, lignes: [{ etudiant_id,
prenom, nom, terminees, total, premiere_ouverture, derniere_activite, etat }] }`.

- [ ] Tests : l'équipe et le formateur de la formation lisent ; un autre formateur, un étudiant : refus (42501) ;
  le formateur et l'équipe ne sont pas apprenants ; leçon en brouillon exclue ; filtres `a_risque` / `terminees` ;
  recherche sans accents, `%` littéral ; résumé sur toute la formation ; 25 par page ; formation sans leçon → 0 %.
- [ ] ÉCHEC → écrire la migration → SUCCÈS → commit.

### Task 2 : lecture et action

**Files :** Create `web/src/lib/formateur/apprenants.ts` (lecture `lireApprenants`, conversion `versApprenants`) et
l'action `chercherApprenants` (fichier `"use server"` `web/src/lib/formateur/actions-apprenants.ts`) ; Test
`web/tests/formateur/apprenants.test.ts`.

**Interfaces — Produces :**
- `type LigneApprenant = { etudiantId, prenom, nom, terminees, total, premiereOuverture, derniereActivite, etat: EtatSuivi }`
- `type PageApprenants = { resume: { apprenants, progressionMoyenne, terminees, aRisque }, total, lignes: LigneApprenant[] }`
- `lireApprenants(formationId): Promise<Lecture<PageApprenants>>` (migrationAbsente sur fonction absente)
- `chercherApprenants(formationId, recherche, filtre: FiltreSuivi, page): Promise<{ ok: true; page: PageApprenants } | { ok: false; message }>`

- [ ] Tests : conversion, repli avant la 0029, paramètres nettoyés (recherche tronquée, filtre inconnu → tous, page ≥ 1,
  identifiant invalide refusé sans appel), message de la base (42501) affiché → ÉCHEC → implémenter → SUCCÈS → commit.

### Task 3 : l'onglet

**Files :** Create `web/src/components/admin/OngletApprenants.tsx` (serveur) et `ListeApprenants.tsx` (client) ;
Modify `FormationOnglets.tsx` (prop `apprenants`), les pages `admin/formations/[id]` et `EditeurFormateur.tsx`
(`?onglet=apprenants` accepté) ; Test `web/tests/admin/apprenants.test.tsx`.

- [ ] Tests : les quatre chiffres, le tableau (nom lié à la bonne fiche selon l'espace, « 3 / 12 », dates, état),
  filtres et recherche rappellent l'action, pagination, textes vides, bandeau de migration, l'onglet « Apprenants »
  présent → ÉCHEC → implémenter → SUCCÈS → commit.

### Task 4 : vérification, guide, revue, bilan

- [ ] Suite complète, lint, `tsc`, build ; rendu 1440 / 390 / 320 px (page d'essai temporaire jamais commitée).
- [ ] Guide section 35 (appliquer la 0029) ; revue finale (opus) ; une passe de corrections ; bilan ; mémoire.
