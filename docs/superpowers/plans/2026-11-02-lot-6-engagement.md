# Lot 6, partie B : engagement — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** le tableau de bord de l'étudiant (`/tableau-de-bord`), la série d'apprentissage, les points, les niveaux, les badges, les recommandations et le rappel de série de 18 h.

**Architecture :**
- **La base (0063)** : `activite_jours`, `points_gagnes`, `badges_obtenus`, toutes remplies par des déclencheurs posés sur les tables de l'étudiant. S'y ajoutent trois fonctions de lecture et la tâche planifiée du rappel.
- **L'appli** :
  - la progression des formations (indicateurs, « Continuer », « Leçon suivante ») reprend les règles de « Mes formations » (`formationsSuivies`) ;
  - la prochaine session reprend `prochaine_session` ;
  - `mon_tableau_de_bord()` rend tout le reste.

**Tech Stack :** Next.js 16 (`web/`), Supabase/Postgres, Vitest, banc PGlite (`tests/db/banc.ts`, `migrationsJusqua`), faux Supabase (`tests/admin/faux-supabase.ts`), Testing Library.

**Spec :** `docs/superpowers/specs/2026-11-02-lot-6-engagement-design.md`. L'utilisateur l'a validée le 2 novembre 2026 en répondant « vas y avec ta proposition ». Il attend le bilan à la fin.

## Global Constraints

- **Migration** `0063_engagement.sql` :
  - rejouable ;
  - fonctions en `security definer`, `set search_path = ''`, droits retirés à `public` (et à `anon`), puis accordés à `authenticated` pour les seules fonctions de lecture ;
  - aucune écriture directe pour `anon` ou `authenticated` dans les trois tables ; chacun ne lit que ses lignes.
- **Jour** : celui du Bénin, `(moment at time zone 'Africa/Porto-Novo')::date`. La semaine commence le lundi.
- **Barème** :
  - leçon terminée +10, quiz réussi +20, exercice validé +30, certificat +100, jour d'apprentissage +5 ;
  - une ligne par (compte, raison, référence) : jamais de double compte ; les points ne se perdent pas.
- **Niveau** = `points / 200 + 1` (division entière) ; « Encore `niveau × 200 − points` points pour atteindre le niveau `niveau + 1`. »
- **Badges** (codes → libellés) :
  - `premier_pas` « Premier pas » ;
  - `serie_3` « Série de 3 jours », `serie_7` « Série de 7 jours », `serie_30` « Série de 30 jours » ;
  - `premier_quiz` « Premier quiz réussi », `premier_exercice` « Premier exercice validé » ;
  - `premier_certificat` « Premier certificat », `trois_certificats` « Trois certificats ».
- **Série** : les jours consécutifs avec une activité qui finissent aujourd'hui (s'il y a déjà une activité) ou hier. Sinon 0.
- **Objectif** : 3, 5 (par défaut) ou 7 jours par semaine.
- **Textes** : en français, avec la typographie française (’ « » espaces). Écrans d'après `NdAccueil`, `NdProfil` (carte « Gamification ») et `NdMobMenu` de l'artefact `9Ei2bCdhG75Nr3KnFZQxfg` (copie dans le scratchpad, `artifact-files/…/project/`). Sur téléphone, les tailles sont plus petites que le design (`max-sm`).
- **Composants client** : ils n'importent jamais un module qui importe `next/headers` ou `@/lib/supabase/server`.
- **Migration pas encore appliquée** : les lectures rendent `null` (`estFonctionAbsente`). L'en-tête affiche alors 0, et la page affiche un bandeau « Appliquez la migration 0063 (guide « Ce qui te revient », section 62) ».
- **Commits** : terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Décisions prises en écrivant le plan (spec muette)

1. **« Chaque jour de série +5 »** : +5 pour chaque jour d'apprentissage, à la première activité du jour (raison `jour`, référence = la date).
2. **Activité** : toute insertion ou modification de `progression_lecons` (leçon ouverte, vidéo regardée, leçon terminée), toute tentative de quiz, tout rendu d'exercice. La correction d'un rendu par le formateur n'en est pas une. `secondes_video` reçoit l'écart de `secondes_couvertes(passages)`.
3. **Quiz réussi** : `score >= formations.score_quiz` ; les points sont comptés une fois par quiz (référence = la leçon). **Exercice validé** : après une correction `valide` ou pour un exercice simple terminé ; une fois par exercice (référence = la leçon). **Certificat** : la référence est l'id du certificat.
4. **Objectif** : une colonne `profils.objectif_jours` et la fonction `choisir_objectif(p_jours)`, parce que les préférences de notification sont des booléens validés strictement.
5. **Tableau de bord** : la progression reste calculée par l'appli, qui sait déjà la calculer pour « Mes formations ». Deux calculs différents de la même chose finiraient par se contredire.
6. **Les jours de la semaine** du bloc « Objectif » s'affichent sans être cliquables : on n'a rien à y faire. Le design en fait des boutons.
7. **Recommandations** :
   - « commencée » = au moins une ligne de progression (définition SQL de `formation_commencee`), ou un certificat ;
   - « populaire » = le nombre de comptes étudiants qui l'ont commencée ;
   - ses parcours = ceux dont il a commencé une formation.
8. **Rappel de 18 h** :
   - jamais à un compte suspendu ; une seule fois par jour ;
   - lien `/tableau-de-bord`, texte « Une leçon, un quiz ou un exercice aujourd’hui suffit pour la garder. » ;
   - tâche `etudium-rappel-serie`, `0 17 * * *` (17 h UTC = 18 h au Bénin).
9. **Badges** : pas de notification (« gamification légère ») ; ils apparaissent dans « Activité récente » et dans la carte du profil.
10. **Les pastilles de l'en-tête** deviennent des liens vers `/tableau-de-bord`. Les points affichés sont ceux de la semaine (« Gagnés cette semaine », `NdMobMenu`).
11. **Les tuiles Série et Points du téléphone reviennent** : la spec validée les demande. Je les avais retirées le 31 octobre parce qu'elles affichaient de faux chiffres. Le test de ce jour-là est mis à jour.

## Review Focus

1. **Le changement de jour au Bénin** (activité à 23 h 30 puis à 0 h 30) : deux jours distincts, et la série vaut 2. Test SQL de la tâche 2, avec des dates posées directement.
2. **Une même leçon terminée, un même quiz réussi deux fois, un exercice validé puis rendu de nouveau** : les points ne sont comptés qu'une fois. Test SQL de la tâche 1.
3. **Un compte sans aucune activité** (nouveau, ou formation commencée avant la 0063) : 0 partout, niveau 1, « Encore 200 points », pas d'erreur. Tests des tâches 2 et 4.
4. **Le rappel à un compte qui a coupé « Rappels d’apprentissage », à un formateur ou à un compte suspendu** : rien ne part. Test SQL de la tâche 5.
5. **Les recommandations d'un étudiant qui a tout commencé** : une liste vide, sans erreur ; la page affiche alors le catalogue. Tests des tâches 3 et 7.

---

### Task 1 : activité, points et badges (0063, partie 1)

**Files :** Create `web/supabase/migrations/0063_engagement.sql` ; Test `web/tests/db/engagement-points.test.ts`.

**Interfaces (produit) :**
- `public.jour_benin(p_moment timestamptz) returns date`, `stable`.
- Table `activite_jours (profil_id uuid → profils on delete cascade, jour date, activites integer default 0, secondes_video integer default 0, primary key (profil_id, jour))`.
- Table `points_gagnes (id bigint identity, profil_id → profils cascade, raison text check in ('lecon','quiz','exercice','certificat','jour'), reference text, points integer > 0, gagne_le timestamptz default now(), unique (profil_id, raison, reference))`, avec un index `(profil_id, gagne_le desc)`.
- Table `badges_obtenus (profil_id → profils cascade, badge text check in (les 8 codes), obtenu_le timestamptz default now(), primary key (profil_id, badge))`.
- `profils.objectif_jours smallint not null default 5 check in (3,5,7)` ; `public.choisir_objectif(p_jours integer) returns void`. Elle refuse :
  - `42501` « Connectez-vous pour choisir votre objectif. » si personne n'est connecté ou si le compte est suspendu ;
  - `22023` « Choisissez 3, 5 ou 7 jours. » pour une autre valeur.
- `public.serie_de(p_profil uuid, p_jour date) returns integer` (interne, sans droit d'exécution).
- `public.gagner_points(p_profil, p_raison, p_reference, p_points, p_quand timestamptz default now())` (interne) : elle insère la ligne `on conflict do nothing`. Si la ligne est nouvelle, elle donne les badges de cette raison :
  - `lecon` → `premier_pas` ;
  - `quiz` → `premier_quiz` ;
  - `exercice` → `premier_exercice` ;
  - `certificat` → `premier_certificat`, et `trois_certificats` à partir de 3 certificats ;
  - `jour` → `serie_3`, `serie_7` ou `serie_30` selon `serie_de`.

  Les badges sont insérés `on conflict do nothing` avec `obtenu_le = p_quand`.
- `public.noter_activite(p_profil uuid, p_secondes integer)` (interne) : un upsert sur le jour du Bénin. Au premier insert du jour, elle appelle `gagner_points(…, 'jour', jour::text, 5)`.
- **Déclencheurs** :
  - `progression_lecons` after insert or update : activité, avec l'écart de secondes ; +10 quand `terminee_le` passe de null à une valeur ;
  - `tentatives_quiz` after insert : activité ; +20 si le quiz est réussi ;
  - `rendus_exercices` after insert : activité. After insert or update of `statut` : +30 quand le statut devient `valide` ;
  - `certificats` after insert : +100 si `profil_id` n'est pas null.
- **Rattrapage, en fin de migration** : chaque certificat existant appelle `gagner_points(profil, 'certificat', id, 100, cree_le)`, dans l'ordre de `cree_le`.

- [ ] **Step 1 : tests** (comptes E et E2, une formation avec 2 leçons `lecon`, 1 quiz à `score_quiz` 70 et 1 exercice `simple`, toutes publiées ; abonnement posé par `tests/db/abonner.ts`). Ils doivent échouer avant le SQL :
  - `ouvrir_lecon` crée `activite_jours(E, aujourd'hui)` avec `activites = 1`, et une ligne `jour` de 5 points ; une deuxième ouverture le même jour donne `activites = 2` et toujours une seule ligne `jour` ;
  - `terminer_lecon` donne +10 et le badge `premier_pas` ; la même leçon terminée de nouveau (mise à jour directe) ne rajoute rien ;
  - `envoyer_quiz` avec 0 bonne réponse : activité, pas de points ; avec toutes les bonnes réponses : +20 et `premier_quiz` ; réussi une seconde fois : toujours 20 ;
  - `terminer_exercice` (simple) : +30 et `premier_exercice` ; rendu `en_attente` puis `corriger_rendu(…, 'valide', '')` sur un exercice `rendu` : +30 ;
  - un certificat inséré : +100 et `premier_certificat` ; trois certificats : `trois_certificats` ;
  - E ne lit que ses lignes des trois tables ; `insert into public.points_gagnes` par E est refusé ;
  - `choisir_objectif(7)` change la valeur ; `choisir_objectif(4)` est refusé par `22023` ; `anon` reçoit `42501` ;
  - le rattrapage : un banc jusqu'à la 0062 avec un certificat, puis la 0063 appliquée : +100 daté du `cree_le` du certificat, et le badge `premier_certificat`.
- [ ] **Step 2 :** `npx vitest run tests/db/engagement-points.test.ts` → FAIL (la 0063 n'existe pas).
- [ ] **Step 3 :** écrire la partie 1 de la 0063.
- [ ] **Step 4 :** relancer → PASS. Relancer aussi `tests/db` en entier : les déclencheurs ajoutés ne cassent rien.
- [ ] **Step 5 :** commit `feat(engagement): activité du jour, points et badges remplis par la base (0063)`.

### Task 2 : la série et `ma_progression_jeu()`

**Files :** Modify `0063_engagement.sql` ; Test `web/tests/db/engagement-serie.test.ts`.

**Interfaces (produit) :** `public.ma_progression_jeu() returns jsonb` (`authenticated` ; `42501` sans compte). Elle rend :
```
{ serie, points_total, points_semaine, niveau, points_avant_niveau, objectif_jours,
  jours_semaine: [7 booléens, lundi → dimanche], badges: [{ code, obtenu_le }] (du plus ancien au plus récent) }
```

- [ ] **Step 1 : tests** (activité posée directement dans `activite_jours` par `banc.db`, relative à `public.jour_benin(now())`) :
  - **série de 3** : J−2, J−1 et J donnent 3 ; J−2 et J−1 sans activité aujourd'hui donnent encore 2 ; J−3 et J−2 seulement (un jour entier sans activité) donnent 0 ;
  - **changement de jour** : `jour_benin('2026-11-02T22:30:00Z')` vaut `2026-11-02`, et `jour_benin('2026-11-02T23:30:00Z')` vaut `2026-11-03` ;
  - **niveaux** : 0 point → niveau 1, encore 200 ; 199 → niveau 1, encore 1 ; 200 → niveau 2, encore 200 ; 450 → niveau 3, encore 150 ;
  - **points de la semaine** : ceux de lundi (heure du Bénin) à maintenant seulement ; un point daté de dimanche dernier n'y est pas ;
  - **jours de la semaine** : les jours actifs de la semaine en cours sont vrais ;
  - **série de 3 jours vraie** (critère 6.4) : trois appels de `noter_activite` à trois dates différentes donnent le badge `serie_3`. `noter_activite` reçoit un `p_jour date default jour_benin(now())` pour ce test ;
  - **compte neuf** : serie 0, points 0, niveau 1, objectif 5, aucun badge ; `anon` reçoit `42501`.
- [ ] **Step 2 :** FAIL. **Step 3 :** écrire le SQL. **Step 4 :** PASS. **Step 5 :** commit `feat(engagement): série d'apprentissage, niveau et points de la semaine (0063)`.

### Task 3 : `recommandations_pour_moi(p_nombre)`

**Files :** Modify `0063_engagement.sql` ; Test `web/tests/db/engagement-recommandations.test.ts`.

**Interfaces (produit) :** `public.recommandations_pour_moi(p_nombre integer default 3) returns jsonb`. `p_nombre` est borné à 1–12. Elle rend un tableau de `{ id, slug, titre, motif: 'suite'|'monetisation'|'parcours'|'catalogue', message: text|null }`. Le message n'existe que pour `suite` : « Vous avez terminé « X ». Découvrez maintenant « Y ». ».

**Règle :**
- **Candidates** : les formations `publiee`, sans ligne de progression du compte et sans certificat du compte.
- **Ordre**, chaque formation n'apparaissant qu'une fois, au premier rang trouvé :
  1. `suite` : pour chaque certificat du compte (le plus récent d'abord), la première candidate qui suit cette formation dans chacun de ses parcours (`formations_parcours.ordre`, puis titre) ;
  2. `monetisation` : les formations Business liées par `formations_monetisation` à une compétence que le compte a commencée ;
  3. `parcours` : les candidates des parcours où le compte a commencé une formation, populaires puis nouvelles ;
  4. `catalogue` : les autres candidates, dans le même ordre.
- **Populaire** = le nombre de comptes étudiants (sans rôle autre qu'`etudiant`) qui ont une ligne de progression. **Nouvelle** = `publiee_le` desc, puis titre.

- [ ] **Step 1 : tests**, un par règle :
  - après le certificat de A (parcours P : A, B, C), B arrive en tête avec son message ; B commencée → C ;
  - une compétence digitale commencée → sa formation Business liée, motif `monetisation` ;
  - parcours : la plus suivie d'abord, puis à égalité la plus récente ;
  - le catalogue complète jusqu'à `p_nombre` ;
  - jamais une formation commencée, jamais une brouillon, archivée ou désactivée ;
  - tout commencé → `[]` ;
  - `p_nombre` 0 → 1 résultat, 50 → 12 au plus.
- [ ] **Step 2 :** FAIL. **Step 3 :** SQL. **Step 4 :** PASS. **Step 5 :** commit `feat(engagement): recommandations (suite du parcours, monétisation, parcours, catalogue) (0063)`.

### Task 4 : `mon_tableau_de_bord()`

**Files :** Modify `0063_engagement.sql` ; Test `web/tests/db/engagement-tableau.test.ts`.

**Interfaces (produit) :** `public.mon_tableau_de_bord() returns jsonb` (`authenticated` ; `42501` sans compte). Elle rend :
- `certificats: { nombre, titres }` : `titres` = les `formation_titre` des 2 plus récents ;
- `a_faire: [{ type: 'exercice'|'quiz', formation, slug, lecon_id, lecon }]` (6 au plus) :
  - exercices dont le dernier rendu est `a_corriger` ;
  - quiz tentés dont le meilleur score est sous `score_quiz` ;
  - formations `publiee` seulement, les plus récents d'abord ;
- `activite: [{ type: 'exercice'|'quiz'|'certificat'|'badge', titre, formation, score, quand }]` (3 au plus, les plus récents) :
  - lue dans `points_gagnes` (sans `lecon` ni `jour`) et dans `badges_obtenus` ;
  - `titre` est le titre de la leçon, ou le code du badge ;
  - `score` est le meilleur score pour un quiz ;
- `jeu` = `ma_progression_jeu()` ;
- `recommandations` = `recommandations_pour_moi(3)`.

- [ ] **Step 1 : tests** :
  - compte neuf : `nombre` 0, listes vides, `jeu.niveau` 1, recommandations du catalogue ;
  - compte plein : un exercice `a_corriger`, un quiz à 40 % → deux éléments « à faire » ; un quiz réussi ensuite → il quitte « à faire » et entre dans l'activité avec son score ;
  - l'activité ne dépasse pas 3 éléments et finit par le plus ancien ;
  - un badge figure dans l'activité.
- [ ] **Step 2 :** FAIL. **Step 3 :** SQL. **Step 4 :** PASS. **Step 5 :** commit `feat(engagement): le tableau de bord de l'étudiant en une lecture (0063)`.

### Task 5 : le rappel de série de 18 h

**Files :** Modify `0063_engagement.sql` (fonction, puis le bloc `do $cron$` après le `commit`, sur le modèle de 0058:389-403) ; Test `web/tests/db/engagement-rappel.test.ts`.

**Interfaces (produit) :** `public.rappeler_series() returns integer` (aucun droit pour `public`, `anon`, `authenticated`). Elle prend un verrou consultatif `hashtext('etudium.rappeler_series')` et rend le nombre de notifications créées. Elle notifie en catégorie `rappels_apprentissage` :
- **titre** : « Votre série de N jours s’arrête ce soir » ;
- **texte** : « Une leçon, un quiz ou un exercice aujourd’hui suffit pour la garder. » ;
- **lien** : `/tableau-de-bord` ;
- **destinataires** : les comptes actifs hier, inactifs aujourd'hui, avec `serie_de` ≥ 2, non suspendus, et pas déjà rappelés aujourd'hui (aucune notification `rappels_apprentissage` depuis minuit au Bénin).

- [ ] **Step 1 : tests** :
  - série de 2 (J−2, J−1) → 1 notification avec le titre exact ; un second appel → 0 ;
  - série de 1 → rien ;
  - activité aujourd'hui → rien ;
  - préférence `rappels_apprentissage: false` → rien ;
  - formateur → rien (`notifier` l'écarte) ;
  - compte suspendu → rien ;
  - `authenticated` ne peut pas l'appeler (`permission denied`) ;
  - la migration passe sur le banc (pas de `pg_cron` : le bloc avertit et continue).
- [ ] **Step 2 :** FAIL. **Step 3 :** SQL. **Step 4 :** PASS, puis `tests/db` en entier. **Step 5 :** commit `feat(engagement): rappel de série à 18 h (0063)`.

### Task 6 : l'appli lit le jeu (en-tête, tuiles du téléphone)

**Files :**
- Create : `web/src/lib/engagement/{types,regles,data}.ts`.
- Modify :
  - `web/src/lib/auth/current-user.ts` ;
  - `web/src/components/ui/TopBarButtons.tsx` (`CounterPill` accepte un `href`) ;
  - `web/src/components/layout/AppHeader.tsx` ;
  - `web/src/components/layout/MobileProfileMenu.tsx`.
- Tests :
  - `web/tests/engagement/regles.test.ts` ;
  - `tests/auth/current-user.test.ts` ;
  - `tests/ui/topbar.test.tsx` ;
  - `tests/layout/profil-telephone.test.tsx`.

**Interfaces (produit) :**
- `types.ts` :
  - `CodeBadge` (les 8 codes) ;
  - `ProgressionJeu = { serie, pointsTotal, pointsSemaine, niveau, pointsAvantNiveau, objectifJours: 3|5|7, joursSemaine: boolean[], badges: { code: CodeBadge; obtenuLe: string }[] }`.
- `regles.ts` :
  - `BADGES: Record<CodeBadge, { nom: string; condition: string }>`, avec les libellés des Global Constraints. Conditions : « Terminer une première leçon », « 3 jours d’apprentissage d’affilée », « 7 jours… », « 30 jours… », « Réussir un premier quiz », « Faire valider un premier exercice », « Obtenir un premier certificat », « Obtenir trois certificats » ;
  - `jours(n)` → « 1 jour » / « 8 jours » (« 0 jour ») ;
  - `points(n)` → « 1 point » / « 165 points » (« 0 point »), avec l'espace fine des milliers de `toLocaleString("fr-FR")` ;
  - `versProgressionJeu(brut)` : convertit le JSON de la base, et rend des valeurs par défaut sûres pour un champ absent.
- `data.ts` (serveur) :
  - `lireProgressionJeu(): Promise<ProgressionJeu | null>` : `null` en démo ou si la fonction est absente ; relance toute autre erreur ;
  - `lireProgressionJeuDouce()` : la même, mais rend `null` aussi pour toute erreur (avec `console.error`), pour l'en-tête qui ne doit jamais casser une page.
- `getShellUser` appelle `rpc("ma_progression_jeu")` en parallèle avec ses lectures actuelles : `serie = jeu.serie`, `points = jeu.pointsSemaine`, et 0 si la lecture est `null`.
- `CounterPill({ …, href? })` : avec `href`, c'est un `Link` dont le nom accessible est « Série d’apprentissage : 8 jours » ou « Points gagnés cette semaine : 165 points ».
- `MobileProfileMenu` : pour un compte qui a accès à l'espace étudiant, deux tuiles avant la liste « Mon compte » : « N jours » / « Série d’apprentissage » et « N points » / « Gagnés cette semaine ». On reprend le composant `Tuile` du commit `85177d2`, en lien vers `/tableau-de-bord`.

- [ ] **Step 1 : tests** :
  - `regles` : pluriels, badges, conversion (JSON partiel → valeurs par défaut) ;
  - `current-user` : `serie: 8, points: 40` quand la doublure rend le jeu ; 0 quand la RPC rend `PGRST202` ou une panne ;
  - `topbar` : avec `href`, un lien et son nom accessible ;
  - `profil-telephone` : l'étudiant voit « 8 jours », « Série d’apprentissage », « 165 points » et « Gagnés cette semaine », en liens vers `/tableau-de-bord` ; le formateur ne voit pas les tuiles.
- [ ] **Step 2 :** FAIL. **Step 3 :** code. **Step 4 :** PASS. **Step 5 :** commit `feat(engagement): la série et les points réels dans l'en-tête et sur le téléphone`.

### Task 7 : la page « Tableau de bord »

**Files :**
- Create :
  - `web/src/app/(app)/(etudiant)/tableau-de-bord/page.tsx` ;
  - `web/src/lib/tableau-de-bord/{types,regles,data}.ts` ;
  - `web/src/components/tableau-de-bord/{TableauDeBord,Indicateurs,Continuer,AFaire,ObjectifSemaine,ActiviteRecente,Recommandations,ProchaineSessionBloc}.tsx`.
- Modify : `web/src/lib/navigation.ts` (« Tableau de bord », `/tableau-de-bord`, `DashboardSquare02Icon`, en tête de « Mon espace »).
- Tests :
  - `web/tests/tableau-de-bord/{regles,page}.test.tsx` ;
  - `tests/layout/menus-espaces.test.tsx` (le lien existe, en premier).

**Interfaces :**
- `regles.ts` :
  - `indicateurs(suivies: FormationSuivie[], lignes: LigneProgression[], maintenant: Date)` rend `{ progression, progressionMois, enCours, commencees }`, où :
    - `progression` = leçons terminées / total des leçons des formations commencées ;
    - `progressionMois` = celles terminées ce mois-ci (au Bénin) / le même total, arrondi ;
  - `continuer(suivies)` : la première suivie `enCours`, avec `{ titre, parcours, lecon: "Module N · titre · durée", pourcentage, temps, href, hrefFormation }`, ou `null` ;
  - `leconsSuivantes(suivies)` : les leçons à reprendre des autres formations `enCours` ;
  - `aFaire(base, suivantes)` : 3 éléments au plus. D'abord les exercices, puis les quiz, puis les leçons ; chaque élément a `{ titre, detail, href, etiquette? }`.
- `data.ts` : `lireTableauDeBord()` lit en parallèle :
  - `mon_tableau_de_bord` (`null` si la fonction est absente) ;
  - la progression et les fiches (comme `lireFormationsSuivies`, en gardant les `FormationSuivie`) ;
  - `lireProchaineSession()` ;
  - `listCatalogue()` (les cartes des recommandations, dans l'ordre rendu).
- **Les blocs**, d'après `NdAccueil` :
  - « Bonjour, Prénom » avec « Continuez votre apprentissage et atteignez vos objectifs. » et « Explorer le catalogue » ;
  - `BandeauAbonnement` ;
  - les 4 indicateurs ;
  - « Continuer l’apprentissage » : vide → « Commencez votre première formation » ;
  - « À faire » (« N éléments » ; vide → « Rien à faire pour l’instant. ») ;
  - « Prochaine session live » : reprise du bloc existant, inscription d'un clic par `sinscrire` ;
  - « Objectif de la semaine » : « 3 / 5 jours », « Apprendre 5 jours cette semaine. », L M M J V S D, la barre, « Points gagnés cette semaine : N · Niveau N » ;
  - « Activité récente » : vide → « Votre activité apparaîtra ici : quiz réussis, exercices validés, certificats et badges. » ;
  - « Recommandé pour vous » : le message de suite, 3 `CarteFormation`, « Tout voir » → `/formations`.
- **Indicateurs** : « Progression globale » (« +N % ce mois »), « Formations en cours » (« Sur N formations »), « Certificats obtenus » (« Word et Zotero », vide → « Aucun pour l’instant »), « Série d’apprentissage » (« Continuez comme ça », à 0 → « Apprenez aujourd’hui pour la lancer »).

- [ ] **Step 1 : tests** :
  - `regles` : indicateurs, et un mois qui change au Bénin ; continuer ; « à faire » (ordre, 3 au plus) ;
  - page vide : « Commencez votre première formation », recommandations ;
  - page pleine : les 4 indicateurs avec leurs valeurs, « Reprendre la leçon » vers la leçon, « À faire » avec ses liens, objectif « 3 / 5 jours » et 3 jours marqués, activité, recommandations avec le message ;
  - migration absente : le bandeau 0063, et la page tient ;
  - menu : « Tableau de bord » en tête de « Mon espace » ; `pages.test` trouve la page.
- [ ] **Step 2 :** FAIL. **Step 3 :** code. **Step 4 :** PASS. **Step 5 :** commit `feat(engagement): la page Tableau de bord de l'étudiant (NdAccueil)`.

### Task 8 : le profil (carte « Gamification », objectif)

**Files :**
- Create : `web/src/components/profile/CarteGamification.tsx` et `web/src/components/profile/ChoixObjectif.tsx`.
- Modify :
  - `web/src/lib/profile/actions.ts` (`choisirObjectif`) ;
  - la page profil et `ProfileTabs` (lecture `lireProgressionJeu()` en plus) ;
  - `InformationsTab` (la carte, à l'endroit de `NdProfil`) ;
  - `NotificationsTab` (le choix).
- Tests : `web/tests/profile/gamification.test.tsx` et `tests/profile/notifications-form.test.tsx`.

**Interfaces :**
- `choisirObjectif(jours: number): Promise<{ ok: boolean; message?: string }>` : `jours` dans 3, 5 ou 7, sinon `{ ok: false }` sans appel ; puis `rpc("choisir_objectif", { p_jours })`.
- `CarteGamification({ jeu })` :
  - les trois chiffres de `NdProfil` : « Niveau N », « N jours », « N badges » ;
  - la ligne « Encore N points pour atteindre le niveau X. » ;
  - les badges obtenus en étiquettes (aucun → « Terminez une première leçon pour obtenir « Premier pas ». ») ;
  - `jeu` null → la carte n'est pas affichée.
- `ChoixObjectif({ valeur })` : « Objectif de la semaine », trois choix (« 3 jours », « 5 jours », « 7 jours »), enregistrement immédiat, retour à l'ancienne valeur et toast en cas d'échec (comme les interrupteurs).

- [ ] **Step 1 : tests** : la carte (niveau, série, badges, encore N points ; vide) ; le choix (appel de l'action, retour en arrière sur échec) ; l'action (valeur refusée sans appel).
- [ ] **Step 2 :** FAIL. **Step 3 :** code. **Step 4 :** PASS. **Step 5 :** commit `feat(engagement): carte Gamification et objectif de la semaine dans le profil`.

### Task 9 : guide, vérifications, relecture

- [ ] Ajouter au guide `docs/guides/ce-qui-te-revient.md` une §62 : appliquer la 0063 (avec son bloc `cron`) ; vérifier `select jobname, schedule from cron.job where jobname = 'etudium-rappel-serie';` ; ce qui commence à zéro (la série et les points), et les certificats déjà obtenus qui donnent leurs points.
- [ ] `npx tsc --noEmit`, `npx eslint .` et la suite complète `npx vitest run` : tout doit être vert.
- [ ] La relecture finale de toute la branche (un relecteur neuf, le modèle le plus capable), puis une passe de corrections et le bilan `docs/bilans/2026-11-02-point-lot-6b.md`.
