# Tâche 1.1 — Structure des contenus : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** créer dans la base les parcours, formateurs, formations, modules, leçons et ressources. La règle d'accès de la spec §3 est écrite une seule fois, dans la base. Des données d'exemple tirées du design accompagnent le tout.

**Architecture :**
- Une migration `0004_contenus.sql` crée les tables, les règles d'accès (RLS) et la fonction `acces_lecon`.
- Les données d'exemple vivent dans `web/supabase/exemples/lot-1.sql`, hors du dossier des migrations : elles ne partent jamais en production.
- Un banc d'essai PGlite (Postgres en WebAssembly, sans Docker) exécute réellement les migrations dans les tests. Un faux schéma Supabase fournit `auth`, `storage` et les rôles `anon` / `authenticated`.
- Les tables de progression, suivi, favoris, notes et avis de la spec §4, ainsi que la note moyenne des formations, arrivent avec leurs tâches (1.5, 1.7, 1.9 et 1.11).

**Tech Stack :** SQL Postgres (Supabase), Vitest 5, `@electric-sql/pglite` 0.5.8 (dépendance de test, déjà installée).

**Spec :** `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` (§1 Q4-Q7 et Q12, §2 « Adresses des formations », §3, §4, §10 « on n'efface jamais une formation publiée »)

## Global Constraints

- **Fichiers SQL :**
  - rejouables : relancés sur une base qui les a déjà, ils ne changent rien et ne cassent rien ;
  - l'utilisateur les colle lui-même dans le SQL Editor de Supabase ;
  - commentaires en français.
- **Fonctions `security definer`** : `set search_path = ''`, noms qualifiés (`public.…`).
- **Règles d'accès** : écrire `(select auth.uid())` et `(select public.f(…))`, comme dans la migration 0003.
- **Adresses (slugs)** : `^[a-z0-9]+(-[a-z0-9]+)*$`. Jamais de point (spec §2).
- **Énumérations** :
  - niveaux : `debutant`, `intermediaire`, `avance` (Q5) ;
  - statuts : `brouillon`, `publiee`, `archivee` (§4) ;
  - couleurs : `academique`, `digital`, `business` ;
  - badges : `populaire`, `nouveau` ;
  - vidéo : `youtube`, `vimeo`.
- **Seuil vidéo** : 90 par défaut, entre 50 et 100 (Q4).
- **Équipe de saisie** : rôles `admin`, `moderateur`, `super_admin` (spec §3 et §4).
- **Ressources** :
  - espace `ressources` privé, 50 Mo par fichier (52428800 octets) ;
  - en consultation seule, seulement `application/pdf`, `image/jpeg`, `image/png` et `image/webp` (§6).
- **Données d'exemple** : jamais dans `supabase/migrations/`.
- **Commits** : se terminent par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Brouillon visible par la bande.** Un visiteur qui interroge directement `modules` ou `lecons` d'une formation en brouillon ne doit rien voir. → Task 2.
- **Vidéo d'une formation verrouillée.** Un étudiant qui lit `lecons_contenus` ou `ressources` d'une formation payante ou archivée ne doit obtenir aucune ligne. Les fichiers de l'espace `ressources` suivent la même règle. → Task 2.
- **Formateur avant le lot 4.** Le rôle `formateur` seul ne donne aucun droit de saisie (§4 : admin, moderateur, super_admin). → Task 2.
- **Rejouer.** Relancer la 0004 puis les exemples deux fois ne double ni les formations, ni les modules, ni les leçons. → Tasks 2 et 3.
- **Formation publiée.** Son adresse ne change plus et elle ne s'efface pas : on l'archive. Un brouillon, lui, se renomme et s'efface. → Task 2.

---

### Task 1: Banc d'essai SQL (PGlite)

**Files:**
- Create : `web/tests/db/supabase-simule.sql`, `web/tests/db/banc.ts`, `web/tests/db/banc.test.ts`

**Interfaces:**
- Produces (`web/tests/db/banc.ts`) :
  - `type Qui = "anon" | { id: string }`
  - `type Banc = { db: PGlite; en<T>(qui: Qui, sql: string, params?: unknown[]): Promise<T[]>; appliquer(fichier: string): Promise<void>; creerCompte(id: string, roles?: string[]): Promise<void> }`
  - `creerBanc(fichiers: string[]): Promise<Banc>` crée une base neuve, applique `supabase-simule.sql`, puis chaque fichier dans l'ordre (chemins relatifs à `web/`).
  - `MIGRATIONS_LOT_0 = ["supabase/migrations/0001_profils_roles.sql", "supabase/migrations/0002_profil.sql", "supabase/migrations/0003_finitions.sql"]`.
  - **`en`** exécute dans une transaction : `set_config('request.jwt.claim.sub', id ou '', true)`, puis `set local role anon` ou `authenticated`, puis la requête. Il rend `rows` ; une erreur Postgres (règle d'accès, contrainte) remonte telle quelle.
  - **`creerCompte`** insère dans `auth.users` : le déclencheur de la 0001 crée le profil et le rôle `etudiant`. Il ajoute ensuite les rôles demandés dans `public.roles`.
- **`supabase-simule.sql`** doit fournir :
  - les rôles `anon`, `authenticated`, `service_role` (`bypassrls`) ;
  - `usage` sur `public` ; `alter default privileges in schema public grant all on tables, sequences, functions to anon, authenticated, service_role`, comme Supabase ;
  - le schéma `auth` : `auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz default now())` et `auth.uid()`, qui lit `request.jwt.claim.sub` (vide → null) ;
  - le schéma `storage` :
    - `storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[])` ;
    - `storage.objects(id uuid default gen_random_uuid() primary key, bucket_id text references storage.buckets, name text, owner uuid, unique (bucket_id, name))`, avec RLS activée et select/insert/update/delete accordés à `anon` et `authenticated` ;
    - `storage.foldername(name text) returns text[]` (tous les segments sauf le dernier).

- [ ] **Step 1 : écrire les tests** (`banc.test.ts`)
  - `les migrations du lot 0 s'appliquent et se rejouent` : `creerBanc([...MIGRATIONS_LOT_0, ...MIGRATIONS_LOT_0])` ne lève rien.
  - `un nouveau compte reçoit son profil et le rôle étudiant` : après `creerCompte(A)`, `en({ id: A }, "select role from public.roles")` rend `[{ role: "etudiant" }]`.
  - `chacun ne lit que son profil` : A et B créés ; `en({ id: A }, "select id from public.profils")` rend seulement A ; `en("anon", …)` rend `[]`.
  - `la base refuse une adresse de photo forgée` : `en({ id: A }, "update public.profils set photo_url = 'https://ailleurs.example/x.png' where id = $1", [A])` est rejeté. La même requête avec `${A}/${uuid}.jpg` passe.
- [ ] **Step 2 :** `npx vitest run tests/db/banc.test.ts` → FAIL (module `./banc` introuvable).
- [ ] **Step 3 :** écrire `supabase-simule.sql` et `banc.ts`. La base PGlite est partagée par fichier de test (`beforeAll`).
- [ ] **Step 4 :** `npx vitest run tests/db/banc.test.ts` → PASS. Si une migration du lot 0 échoue sur le banc, c'est d'abord le faux schéma qui est en cause : le corriger, sans toucher aux migrations déjà appliquées par l'utilisateur.
- [ ] **Step 5 : commit** `test(base): banc d'essai SQL qui exécute vraiment les migrations (PGlite)`

### Task 2: Migration 0004, contenus et règle d'accès

**Files:**
- Create : `web/supabase/migrations/0004_contenus.sql`, `web/tests/db/contenus.test.ts`

**Interfaces:**
- Consumes : `creerBanc`, `MIGRATIONS_LOT_0`, `Banc.en`, `Banc.creerCompte` (Task 1).
- Produces (base) :
  - **Types** : `public.couleur_parcours`, `public.niveau_formation`, `public.statut_formation`, `public.badge_formation`, `public.fournisseur_video`.
  - **Tables** (colonnes de la spec §4, avec `cree_le` et `modifie_le` tenus par `public.toucher_modifie_le()`) :
    - `public.parcours(id, slug unique, nom ≤ 80, nom_court ≤ 30, description ≤ 500, couleur, ordre, actif)` ;
    - `public.formateurs(id, nom ≤ 80, titre ≤ 120, domaine ≤ 120, presentation ≤ 600, photo text null, compte_id uuid null → profils on delete set null)` ;
    - `public.formations(id, slug unique, titre ≤ 120, resume ≤ 160, description ≤ 2000, objectifs text[], competences text[], niveau défaut debutant, formateur_id null → formateurs on delete set null, gratuite bool, achat_separe bool, prix_fcfa int null ≥ 0, badge null, seuil_video smallint 90 [50-100], statut défaut brouillon, publiee_le timestamptz null)` ;
    - `public.formations_parcours(formation_id, parcours_id, ordre, pk(formation_id, parcours_id))`, en cascade des deux côtés ;
    - `public.modules(id, formation_id cascade, titre ≤ 120, ordre)` ;
    - `public.lecons(id, module_id cascade, titre ≤ 120, titre_court ≤ 40 null, duree_secondes ≥ 0, apercu bool, resume ≤ 1000, points_cles text[], ordre)` ;
    - `public.lecons_contenus(lecon_id pk → lecons cascade, video_fournisseur null, video_id null, texte ≤ 20000)`. Vidéo : les deux nuls, ou YouTube `^[A-Za-z0-9_-]{11}$`, ou Vimeo `^[0-9]{6,12}$` ;
    - `public.ressources(id, lecon_id cascade, titre ≤ 120, fichier text unique, format text, taille_octets bigint ≥ 0, telechargeable bool défaut true, ordre)`. Si `telechargeable` est faux, `format` doit être l'un des 4 formats de consultation.
  - **Fonctions** :
    - `public.equipe_contenus() returns boolean` : `a_role` admin, moderateur ou super_admin ;
    - `public.acces_lecon(p_lecon uuid) returns boolean` (`security definer`, `stable`) : vrai si l'équipe, ou si la formation de la leçon est `publiee` et `(apercu ou (gratuite et auth.uid() non nul))`. Le lot 2 y ajoutera les abonnements ;
    - `public.accessible(l public.lecons) returns boolean` : champ calculé pour l'API (`select=…,accessible`), qui vaut `public.acces_lecon(l.id)`.
  - **Déclencheurs sur `formations`** :
    - quand le statut devient `publiee` et que `publiee_le` est nul, `publiee_le` reçoit `now()` ;
    - si `publiee_le` n'est pas nul, changer `slug` lève « L'adresse d'une formation publiée ne change plus. » ;
    - si `publiee_le` n'est pas nul, supprimer lève « Une formation publiée s'archive, elle ne s'efface pas. ».
  - **Règles d'accès en lecture** (`anon`, `authenticated`) :
    - `parcours` : `actif` ou l'équipe ;
    - `formateurs` : tout ;
    - `formations` : `statut = 'publiee'` ou l'équipe ;
    - `formations_parcours`, `modules`, `lecons` : seulement si la formation (ou le module) parent est elle-même lisible (sous-requête soumise aux règles) ;
    - `lecons_contenus` et `ressources` : `public.acces_lecon(lecon_id)`.
  - **Écriture** : une règle « l'équipe saisit les contenus » (`for all to authenticated`, `(select public.equipe_contenus())`) sur chacune des 8 tables. Insert, update et delete sont retirés à `anon`.
  - **Stockage** :
    - espace `ressources` (privé, 52428800 octets) ;
    - lecture d'un objet seulement si `exists (select 1 from public.ressources r where r.fichier = name and public.acces_lecon(r.lecon_id))` ;
    - dépôt, remplacement et suppression : l'équipe.

- [ ] **Step 1 : écrire les tests** (`contenus.test.ts`). Base : `creerBanc([...MIGRATIONS_LOT_0, "supabase/migrations/0004_contenus.sql"])`. Comptes : un étudiant E, un admin A, un modérateur M, un formateur F. Les contenus sont insérés en superutilisateur (`banc.db`) :
  - une formation publiée gratuite G (2 leçons) ;
  - une formation publiée payante P (2 leçons dont 1 aperçu, avec vidéo YouTube et une ressource) ;
  - une formation en brouillon B (1 leçon) ;
  - une formation archivée R (1 leçon).
  - Tests :
    - `un visiteur voit le catalogue publié, pas les brouillons ni les archives` : `en("anon", "select slug from public.formations")` contient G et P, pas B ni R.
    - `un brouillon ne se devine pas par ses modules ou ses leçons` : `en("anon", …)` sur `modules` et sur `lecons` de B rend `[]`.
    - `l'aperçu se regarde sans compte` : `en("anon", "select video_id from public.lecons_contenus")` ne rend que la leçon d'aperçu de P.
    - `une formation gratuite demande un compte` :
      - en `anon`, aucune ligne de `lecons_contenus` de G ;
      - en étudiant E, les 2 leçons de G.
    - `une formation payante reste verrouillée jusqu'au lot 2` :
      - E lit `lecons` de P avec `accessible` = `[true (aperçu), false]` ;
      - E n'obtient de `lecons_contenus` de P que l'aperçu ;
      - E n'obtient aucune ligne de `ressources` de la leçon verrouillée.
    - `une formation archivée ferme ses leçons` :
      - E n'obtient rien de R dans `lecons` ni dans `lecons_contenus` ;
      - A (admin) les obtient.
    - `l'équipe voit et saisit tout, le formateur pas encore` :
      - A et M insèrent un parcours ;
      - E et F voient l'insertion rejetée ;
      - `en("anon", "insert …")` est rejeté.
    - `un fichier de ressource ne s'ouvre qu'avec l'accès à la leçon` :
      - un objet `storage.objects` (bucket `ressources`, name = `ressources.fichier`) est lisible par A ;
      - il n'est pas lisible par E quand la leçon est verrouillée ;
      - un objet sans ligne `ressources` n'est lisible par personne hors équipe.
    - `une adresse de formation n'a ni point ni majuscule` : les insertions de `node.js`, `Excel` et `excel-` sont rejetées ; `node-js` est acceptée.
    - `le lien vidéo correspond au fournisseur` :
      - rejetés : YouTube `abc`, Vimeo `dQw4w9WgXcQ`, un fournisseur sans identifiant ;
      - acceptés : YouTube `dQw4w9WgXcQ`, Vimeo `76979871`.
    - `une ressource en consultation seule est un PDF ou une image` : `telechargeable = false` avec un format Excel est rejeté ; avec `application/pdf`, accepté.
    - `une formation publiée garde son adresse et s'archive au lieu de s'effacer` :
      - publier B donne une `publiee_le` non nulle ;
      - changer ensuite son `slug` lève l'erreur ;
      - la supprimer lève l'erreur ;
      - un autre brouillon change d'adresse puis s'efface sans erreur.
    - `la migration se rejoue` : `banc.appliquer("supabase/migrations/0004_contenus.sql")` une seconde fois ne lève rien et ne change pas le nombre de formations.
- [ ] **Step 2 :** `npx vitest run tests/db/contenus.test.ts` → FAIL (fichier `0004_contenus.sql` introuvable).
- [ ] **Step 3 :** écrire `0004_contenus.sql`. Les types se créent dans des blocs `exception when duplicate_object`, les tables avec `create table if not exists`, et les règles et déclencheurs par `drop … if exists` puis `create`. Ajouter les index sur les clés étrangères (`modules.formation_id`, `lecons.module_id`, `ressources.lecon_id`, `formations_parcours.parcours_id`) et sur `formations.statut`.
- [ ] **Step 4 :** `npx vitest run tests/db` → PASS (banc, contenus, anciens tests de migration).
- [ ] **Step 5 : commit** `feat(base): parcours, formations, modules, leçons, ressources et règle d'accès (0004)`

### Task 3: Données d'exemple et guide

**Files:**
- Create : `web/supabase/exemples/lot-1.sql`, `web/tests/db/exemples-lot-1.test.ts`
- Modify : `docs/guides/ce-qui-te-revient.md` (nouvelle section « Lot 1 : la base des contenus »)

**Interfaces:**
- Consumes : la 0004 (Task 2), `creerBanc` (Task 1).
- Produces : des données de démonstration rejouables (`on conflict (slug) do update` ; programme d'Excel inséré seulement si la formation n'a pas encore de module).

**Contenu, textes exacts du design :**
- **Parcours :**

| slug | nom | nom_court | couleur | ordre | description |
|---|---|---|---|---|---|
| `reussite-academique` | Réussite académique | Académique | academique | 1 | « Les outils et méthodes pour réussir à l'université : bureautique, recherche, rédaction scientifique et soutenance. » |
| `competences-digitales` | Compétences digitales | Digital | digital | 2 | « Design, intelligence artificielle, contenu et automatisation : les compétences numériques recherchées. » |
| `business-revenus-en-ligne` | Business & revenus en ligne | Business | business | 3 | « Freelance, produits digitaux et vente en ligne : créer une activité grâce au numérique. » |

- **Formateur :** Dr Mireille Adjovi.
  - Titre : « Enseignante en statistiques appliquées ».
  - Domaine : « Statistiques appliquées · Analyse de données ».
  - Présentation : « Elle accompagne depuis plusieurs années des étudiants de master dans l'analyse des données de leur mémoire. »
- **10 formations publiées**. Le résumé de chacune est la description du catalogue du design (rapport d'extraction, NdCatalogue).

| slug | titre | parcours | niveau | gratuite | achat_separe | badge |
|---|---|---|---|---|---|---|
| `maitriser-microsoft-excel` | Maîtriser Microsoft Excel | académique | intermediaire | non | oui | populaire |
| `microsoft-word-travaux-universitaires` | Microsoft Word pour vos travaux universitaires | académique | debutant | non | non | — |
| `zotero-gerer-ses-references` | Zotero : gérer ses références | académique | debutant | **oui** | non | — |
| `powerpoint-reussir-sa-soutenance` | PowerPoint : réussir sa soutenance | académique | debutant | non | non | — |
| `methodologie-du-memoire` | Méthodologie du mémoire | académique | intermediaire | non | non | populaire |
| `canva-debutant-a-expert` | Canva, de débutant à expert | digital | debutant | **oui** | non | — |
| `intelligence-artificielle-etudes` | L'intelligence artificielle au service de vos études | digital | debutant | non | non | nouveau |
| `montage-video-smartphone` | Montage vidéo sur smartphone | digital | intermediaire | non | non | — |
| `marketing-digital-debutants` | Marketing digital pour débutants | business | debutant | non | **oui** | — |
| `lancer-son-activite-freelance` | Lancer son activité de freelance | business | intermediaire | non | non | populaire |

- **Excel en entier :**
  - formateur Dr Mireille Adjovi ;
  - la description, les 6 objectifs et les 5 compétences de NdFormation ;
  - `publiee_le` du plus ancien au plus récent dans l'ordre du tableau, l'IA en dernier (badge « Nouveau »).
- **Programme d'Excel** : 4 modules, 12 leçons (quiz et exercices au lot 3).
  - **Module 1, « Bases d'Excel »** :
    - Découvrir l'interface, 370 s, **aperçu** ;
    - Saisir et mettre en forme des données, 750 s, titre court « Saisir et mettre en forme », **aperçu** ;
    - Les formules essentielles, 845 s ;
    - Références relatives et absolues, 640 s, titre court « Références relatives ».
  - **Module 2, « Formules et fonctions »** :
    - SI, ET, OU, 800 s ;
    - RECHERCHEX, 900 s ;
    - Fonctions de texte et de date, 705 s.
  - **Module 3, « Analyse de données »** :
    - Trier et filtrer, 492 s ;
    - Les tableaux croisés dynamiques, 760 s, titre court « Tableaux croisés dynamiques ». Son résumé et ses 4 points clés sont ceux de « Dans cette leçon » ;
    - Les graphiques avancés, 605 s.
  - **Module 4, « Automatisation »** :
    - Mise en forme conditionnelle, 570 s ;
    - Introduction aux macros, 970 s.
- Pas de vidéo ni de ressource : l'utilisateur les ajoute au back-office (1.2, Q12).

- [ ] **Step 1 : écrire les tests** (`exemples-lot-1.test.ts`). Base : lot 0 + 0004 + `supabase/exemples/lot-1.sql` appliqué **deux fois**.
  - `les exemples se rejouent sans doublon` :
    - 3 parcours, 10 formations, 1 formateur ;
    - Excel a 4 modules et 12 leçons.
  - `un visiteur voit les 10 formations et les deux leçons d'aperçu d'Excel` :
    - `en("anon", "select count(*) from public.formations")` → 10 ;
    - `en("anon", "select l.titre from public.lecons l where public.accessible(l)")` → les 2 leçons d'aperçu.
  - `Zotero et Canva sont gratuites, Excel et Marketing se vendent seules` : vérifié par les slugs.
  - `chaque formation appartient à son parcours` : pour chaque ligne du tableau, le slug du parcours est le bon.
  - `la durée d'Excel se calcule à partir des leçons` : `sum(duree_secondes)` vaut 8407.
- [ ] **Step 2 :** `npx vitest run tests/db/exemples-lot-1.test.ts` → FAIL (fichier introuvable).
- [ ] **Step 3 :** écrire `lot-1.sql`, d'abord dans un bloc `do $$ … $$` qui récupère les identifiants par slug. Puis ajouter au guide `ce-qui-te-revient.md` la section « Lot 1 : la base des contenus » :
  1. appliquer `web/supabase/migrations/0004_contenus.sql`, comme les précédentes ;
  2. appliquer `web/supabase/exemples/lot-1.sql`, **seulement sur la base de test** ;
  3. vérifier dans Table Editor : `parcours` 3 lignes, `formations` 10, `lecons` 12.
- [ ] **Step 4 :** `npx vitest run` (suite entière), `npx tsc --noEmit -p .`, `npx eslint .` → tout passe.
- [ ] **Step 5 : commit** `feat(base): données d'exemple du lot 1 (3 parcours, 10 formations, programme d'Excel)`
