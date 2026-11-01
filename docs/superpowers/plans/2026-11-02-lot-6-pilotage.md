# Lot 6, partie A : pilotage — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** les droits de l'équipe par rôle fixe (dans la base et dans l'appli), le journal des actions, renommer et supprimer un compte, la vue d'ensemble du design et une page « Statistiques ».

**Architecture :**
- **Les droits** : une table des domaines par rôle dans la base (`domaines_role`), reprise à l'identique dans l'appli (`DOMAINES_PAR_ROLE`), et un test qui les compare. `equipe_contenus()` passe aux admins ; la communauté passe par `equipe_communaute()`.
- **Le journal** : il est écrit par des déclencheurs sur les tables concernées.
- **Les statistiques** : deux fonctions qui rendent du JSON.

**Tech Stack :** Next.js 16 (`web/`), Supabase/Postgres, Vitest, banc PGlite (`tests/db/banc.ts`, `migrationsJusqua`), faux Supabase (`tests/admin/faux-supabase.ts`).

**Spec :** `docs/superpowers/specs/2026-11-02-lot-6-pilotage-design.md` (choix validés le 2 novembre 2026 ; l'utilisateur a dit « Vas y avec les recommandations » et attend le bilan à la fin).

## Global Constraints

- **Domaines, et les rôles qui y ont accès :**
  - `communaute` : moderateur, admin, super_admin ;
  - `contenus`, `utilisateurs`, `paiements`, `statistiques` : admin, super_admin ;
  - `roles`, `journal` : super_admin ;
  - un compte suspendu n'a aucun domaine.
- **Migrations** `0060_domaines_equipe.sql`, `0061_journal_comptes.sql`, `0062_statistiques_pilotage.sql`. Elles sont rejouables. Les fonctions sont en `security definer`, `set search_path = ''`, et leurs droits sont retirés à `public, anon` puis accordés à `authenticated`.
- **Le journal** n'a aucun droit `insert`, `update` ou `delete` pour `anon` et `authenticated`. On ne le lit que par fonction, et seulement le super admin.
- **Heure** : les mois, les jours et les heures affichées sont ceux de `Africa/Porto-Novo`.
- **Textes** : en français, avec la typographie française (’ « » espaces), comme dans la spec.
- **Composants client** : ils n'importent jamais un module qui importe `next/headers` ou `@/lib/supabase/server` (vérifié par `tests/build/imports-client.test.ts`).
- **Écrans** : la vue d'ensemble reprend `NdAdmin` (lire `project/NdAdmin.dc.html` de l'artefact `9Ei2bCdhG75Nr3KnFZQxfg`). Le journal et les statistiques se composent avec le tableau et les filtres de `NdAdminUtilisateurs` ; sur téléphone, les tailles sont plus petites que le design (`max-sm`).
- **Commits** : terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Un modérateur qui ouvre une adresse hors de son domaine** (`/admin/paiements` en favori) ou qui appelle la base directement doit être ramené à la vue d'ensemble, et la base doit le refuser. Tests : la matrice de la tâche 1 et la garde de page de la tâche 2.
2. **Le super admin qui supprime son propre compte ou celui d'un autre super admin** doit être refusé, avec un message clair. Test SQL de la tâche 4.
3. **Un admin qui tente d'écrire, de modifier ou d'effacer une ligne du journal**, par l'API ou par une fonction, doit être refusé. Test SQL de la tâche 3.
4. **Une plateforme vide** (aucun abonnement, aucune formation, aucun paiement) : pas de division par zéro ; 0 ou « — » partout. Tests SQL et composants des tâches 6 et 7.
5. **Un admin suspendu** n'a plus aucun domaine : la base et l'appli le refusent. Test SQL de la tâche 1.

---

### Task 1 : les domaines dans la base (0060)

**Files :** Create `web/supabase/migrations/0060_domaines_equipe.sql` ; Test `web/tests/db/domaines.test.ts`.

**Interfaces (produit) :**
- `public.domaines_role(p_role text) returns text[]`, `immutable`, selon la table des Global Constraints. Accessible à `authenticated`, pour le test de parité.
- `public.a_domaine(p_domaine text) returns boolean`. Elle vaut vrai si un rôle du compte appelant donne ce domaine et que le compte n'est pas suspendu.
- `public.equipe_communaute()` = `a_domaine('communaute')`, et `public.equipe_contenus()` redéfinie = `a_domaine('contenus')`.
- `public.exiger_equipe_moderation()` passe par `equipe_communaute()`. `public.exiger_equipe_admin()` lève `42501` « Réservé aux administrateurs. » sans `equipe_contenus()`.

**Redéfinitions, recopiées depuis leur dernière définition :**
- **Avec `equipe_contenus()` remplacée par `equipe_communaute()`** :
  - fonctions : `carte_publication`, `carte_reponse`, `carte_commentaire_lecon`, `supprimer_publication`, `supprimer_commentaire`, `supprimer_commentaire_lecon`, `modifier_commentaire`, `signaler`, `signaler_commentaire_lecon`, `bloc_sondage`, `reprogrammer`, `images_sondage`, `publication_communaute`, `publication_ouverte`, `peut_lire_espace`, `acces_abonne`, `avis_equipe`, `masquer_avis`, `cote_conversation`, `conversations_de`, `droit_session`, `creer_session`, `modifier_session`, `annuler_session`, `sessions_equipe`, `peut_publier_replay` ;
  - règles de stockage : « communaute : lire » et « communaute : supprimer » (0019).
- **Avec `exiger_equipe_moderation()` remplacée par `exiger_equipe_admin()`** : `codes_promo_equipe`, `paiements_equipe`, `paiement_equipe`, `resume_paiements`, `abonnements_compte`.
- **À vérifier une par une** : `comptes_equipe`, `compte_equipe`, `remarques_compte`, la règle « remarques : leur auteur et l'équipe », `lot3_etudiant`, `publier_annonce` et `annonces_equipe`. Si elles passent par `equipe_contenus()`, rien à faire. Si elles passent par `exiger_equipe_moderation()`, elles passent à `exiger_equipe_admin()`.

- [ ] **Step 1 : tests.** Comptes `M` (moderateur), `A` (admin), `S` (super_admin), `E` (étudiant), `AS` (admin suspendu). Les tests :
  - `domaines_role` pour chaque rôle, avec les valeurs exactes des Global Constraints ;
  - `M` peut : `etat_moderation()`, `enregistrer_annonce(...)`, `masquer_avis`, `sessions_equipe()`, `conversations_de` (l'équipe), lire un espace de la communauté sans abonnement ;
  - `M` est refusé pour : insérer une formation (RLS : 0 ligne ou erreur), `paiements_equipe()`, `comptes_equipe(...)`, `statistiques_back_office()`, `changer_role` ; `acces_lecon` d'une leçon payante vaut faux ;
  - `A` peut : insérer une formation, `paiements_equipe()`, `comptes_equipe(...)` ; `A` est refusé pour `changer_role` ;
  - `AS` est refusé partout (Review Focus 5) ;
  - `E` est refusé à `etat_moderation`.
- [ ] **Step 2 :** lancer le test, constater l'échec.
- [ ] **Step 3 :** écrire la 0060. Les redéfinitions sont générées par un script (dans le dossier temporaire, non commité) qui :
  - prend, dans les migrations lues dans l'ordre, la dernière instruction `create or replace function public.<nom>(` jusqu'à sa fin `$$;` ;
  - applique le remplacement ;
  - vérifie qu'aucun nom n'a deux signatures.

  Les deux règles de stockage sont recréées avec `drop policy if exists` puis `create policy`.
- [ ] **Step 4 :** relancer le test, puis `npx vitest run tests/db` en entier : tous les anciens tests de la communauté, de la modération, des sessions, des paiements et des contenus doivent rester verts. Tout test qui utilisait un modérateur hors de son domaine se corrige selon la spec, avec une ligne `Ruling:` au registre.
- [ ] **Step 5 :** commit `feat(equipe): les domaines du back-office par rôle (0060)`.

### Task 2 : les domaines dans l'appli

**Files :**
- Create : `web/src/lib/auth/domaines.ts`, `web/src/lib/auth/require-domaine.ts`, `web/src/components/admin/TableauModerateur.tsx`.
- Modify :
  - `web/src/lib/navigation.ts` : un champ `domaine?: Domaine` sur chaque entrée du back-office, et un groupe « Pilotage » avec « Statistiques » (`/admin/statistiques`, `statistiques`) et « Journal » (`/admin/journal`, `journal`) ;
  - la barre latérale, le tiroir et la barre du bas, avec une propriété `domaines` ;
  - les pages de `web/src/app/(app)/admin/**` ;
  - `web/src/lib/admin/garde.ts` (`exigerDomaine`) et les actions du serveur des contenus, des utilisateurs, des annonces et des paiements ;
  - `web/src/app/(app)/admin/page.tsx`.
- Test : `web/tests/auth/domaines.test.ts` (parité avec la base, via `domaines_role` sur le banc), `web/tests/layout/menu-admin.test.tsx`, `web/tests/admin/garde-domaine.test.ts`.

**Interfaces (produit) :**
- `type Domaine = "communaute" | "contenus" | "utilisateurs" | "paiements" | "statistiques" | "roles" | "journal"`.
- `DOMAINES_PAR_ROLE: Record<Role, Domaine[]>`, `domainesDe(roles: Role[]): Domaine[]`, `aDomaine(roles: Role[], d: Domaine): boolean`.
- `requireDomaine(d: Domaine): Promise<ShellUser>` : il appelle `requireSpace("admin")`, puis redirige vers `/admin` sans le domaine.
- `exigerDomaine(d)` rend la même forme que `exigerEquipe()`, avec l'erreur « Vous n’avez pas accès à cette partie du back-office. ».

**Les domaines des entrées :**
- `contenus` : Parcours, Formateurs, Formations, Corrections ;
- `communaute` : Avis, Sessions live, Messages, Communauté, Modération ;
- `utilisateurs` : Utilisateurs, Annonces ;
- `paiements` : Abonnements et paiements ;
- toujours visible : Tableau de bord.

- [ ] **Steps :**
  1. Les tests :
     - le modérateur voit Tableau de bord, Avis, Sessions live, Messages, Communauté et Modération, rien d'autre, et aucun groupe vide ;
     - l'admin voit tout sauf Journal ;
     - le super admin voit tout ;
     - `requireDomaine("paiements")` redirige un modérateur vers `/admin` ;
     - `exigerDomaine("contenus")` refuse un modérateur avec le message exact ;
     - la page `/admin` d'un modérateur montre « À traiter » : contenus à examiner, messages non lus, prochaines sessions.
  2. Lancer les tests, constater l'échec.
  3. Implémenter.
  4. Relancer les tests, plus `tests/layout` et `tests/admin` en entier.
  5. Commit `feat(equipe): le menu et les pages du back-office selon le rôle`.

### Task 3 : le journal des actions (0061, première partie)

**Files :** Create `web/supabase/migrations/0061_journal_comptes.sql` ; Test `web/tests/db/journal.test.ts`.

**Interfaces (produit) :**
- **La table** `public.journal_actions` : `id bigint identity`, `cree_le timestamptz default now()`, `auteur uuid references profils on delete set null`, `auteur_nom text`, `categorie text check in ('comptes','paiements','contenus','communaute')`, `action text`, `cible_type text`, `cible_id text`, `cible_libelle text`, `resume text`, `details jsonb default '{}'`.
- **`public.journaliser(p_categorie, p_action, p_cible_type, p_cible_id, p_cible_libelle, p_resume, p_details jsonb default '{}')`** : elle n'écrit rien si `not equipe_communaute()`. Ses droits sont retirés à tous.
- **Les déclencheurs** (après l'action, lignes et résumés exacts) :
  - **comptes** :
    - `roles`, ajout ou retrait d'un rôle autre qu'`etudiant` : « Rôle « Administrateur » donné à Aïcha Kpadé », « … retiré à … » ;
    - `suspensions` : « Compte de X suspendu » (`details.motif`), « Compte de X réactivé » (rien si le profil n'existe plus) ;
    - `annonces` : « Annonce « titre » envoyée à tous » ;
  - **paiements** :
    - `abonnements`, un abonnement attribué à la main (paiement `source = 'manuel'`) : « Abonnement Standard attribué à X jusqu’au 1 mai 2027 » ;
    - `abonnements`, `annule_le` posé : « Abonnement Standard de X annulé » (`details.motif`) ;
    - `formules`, prix changé : « Prix de Standard : 15 000 → 12 000 FCFA » ;
    - `codes_promo`, ajout, modification ou suppression : « Code promo PROMO20 créé », « … modifié », « … supprimé » ;
    - le réglage d'activation des paiements : « Paiements activés », « Paiements désactivés » ;
  - **contenus** :
    - `formations`, statut changé : « Formation « X » : Publiée → Désactivée » (libellés de `STATUTS`) ;
    - `formations`, suppression : « Formation « X » supprimée » ;
    - `versions_formations`, une version notée : « Version N de « X » : résumé » ;
  - **communaute** :
    - `avis`, `masque` changé : « Avis de X sur « F » masqué », « … réaffiché » ;
    - `publications`, statut changé par l'équipe : « Publication de X bloquée », « … rétablie » ;
    - suppression d'une publication, d'un commentaire ou d'un commentaire de leçon d'un autre : « Publication de X supprimée », « Commentaire de X supprimé » ;
    - l'annonce épinglée (0039), ajout, modification ou retrait : « Annonce épinglée publiée », « … modifiée », « … retirée » ;
    - les réglages de l'analyse (0020), modifiés : « Réglages de l’analyse modifiés ».
- **`public.lire_journal(p_categorie text, p_auteur uuid, p_jours int, p_avant bigint, p_nombre int default 50) returns jsonb`** : `{lignes:[{id,cree_le,auteur,auteur_nom,categorie,action,cible_type,cible_id,cible_libelle,resume,details}], suite:boolean}`. Elle est réservée au super admin (`a_domaine('journal')`) ; sinon elle lève `42501`.
- **`public.auteurs_journal() returns jsonb`** : `[{id, nom}]`, les membres de l'équipe qui ont au moins une ligne. Elle est réservée au super admin.

- [ ] **Steps :**
  1. Les tests :
     - chaque déclencheur, joué par un membre de l'équipe, écrit sa ligne avec le résumé exact ;
     - joué par un étudiant ou sans compte (cron), il n'écrit rien ;
     - Review Focus 3 : `A` est refusé à `insert`, `update` et `delete` sur `journal_actions` et à `journaliser(...)` ;
     - `lire_journal` est refusé à `A` ; pour `S`, les filtres par catégorie, auteur et jours fonctionnent, ainsi que la pagination par `p_avant` (`suite`).
  2. Lancer les tests, constater l'échec.
  3. Écrire la 0061 (journal). Les noms des colonnes et des tables de l'annonce épinglée, des réglages de l'analyse et de l'activation des paiements sont lus dans leurs migrations.
  4. Relancer les tests, plus `tests/db` en entier.
  5. Commit `feat(journal): le journal des actions de l'équipe (0061)`.

### Task 4 : renommer et supprimer un compte (0061, seconde partie)

**Files :**
- Modify `0061_journal_comptes.sql`.
- Create `web/src/components/admin/utilisateurs/RenommerCompte.tsx`, `SupprimerCompte.tsx`.
- Modify :
  - `web/src/lib/utilisateurs/actions.ts` (`renommerCompte`, `supprimerCompte`) ;
  - `web/src/lib/utilisateurs/regles.ts` (`droitsSurCompte` rend aussi `renommer` et `supprimer`) ;
  - le menu ⋮ de la liste et la fiche d'un compte.
- Test : `web/tests/db/comptes-equipe.test.ts`, `web/tests/utilisateurs/renommer-supprimer.test.tsx`.

**Interfaces (produit) :**
- **`public.renommer_compte(p_compte uuid, p_prenom text, p_nom text) returns void`** :
  - elle exige le domaine `utilisateurs` ;
  - un compte de l'équipe ne se renomme que par le super admin ;
  - chaque valeur fait de 1 à 60 caractères après `btrim`, sinon « Écrivez le prénom et le nom (60 caractères au plus). » ;
  - elle journalise « Compte de X renommé en Y ».
- **`public.fichiers_du_compte(p_compte uuid) returns jsonb`** : `{photos:[chemins], rendus:[chemins], messages:[chemins]}`, réservée au super admin. Les espaces de fichiers sont lus dans les migrations et dans `src/lib/profile/actions.ts:122-150`. La 0061 ajoute les règles de stockage « super admin : supprimer » sur ces espaces.
- **`public.supprimer_compte(p_compte uuid, p_motif text) returns void`** :
  - elle est réservée au super admin (domaine `roles`) ;
  - elle refuse soi-même : « Vous ne pouvez pas supprimer votre propre compte d’ici : passez par votre profil. » ;
  - elle refuse un super admin : « Un compte super admin ne se supprime pas. » ;
  - elle journalise « Compte de X (adresse) supprimé » (`details.motif`), puis exécute `delete from auth.users`.
- **`supprimerCompte(id, motif)`** (serveur) : il lit `fichiers_du_compte`, retire les fichiers, puis appelle `supprimer_compte`.

- [ ] **Steps :**
  1. Les tests :
     - **renommer (SQL)** : l'admin renomme un étudiant ; il est refusé pour un modérateur ; le super admin renomme un modérateur ; des valeurs vides ou trop longues sont refusées ; la ligne du journal est écrite ;
     - **supprimer (SQL)** : le super admin supprime un étudiant qui a payé et a un certificat ; le paiement reste avec `profil_id` nul ; `verifier_certificat` rend toujours le certificat ; la ligne du journal reste, auteur conservé ;
     - **Review Focus 2** : soi-même et un autre super admin sont refusés avec les messages exacts ; l'admin est refusé ;
     - **les composants** : « Modifier le nom » et « Supprimer le compte » dans le menu ⋮ selon les droits ; la fenêtre de suppression montre ce qui part et ce qui reste et demande le motif ; l'action est appelée avec l'identifiant et le motif.
  2. Lancer les tests, constater l'échec.
  3. Implémenter.
  4. Relancer les tests.
  5. Commit `feat(utilisateurs): renommer et supprimer un compte depuis le back-office`.

### Task 5 : la page « Journal »

**Files :**
- Create `web/src/lib/journal/{types,data,actions}.ts`, `web/src/app/(app)/admin/journal/page.tsx`, `web/src/components/admin/journal/PageJournal.tsx`.
- Test `web/tests/admin/journal.test.tsx`.

**Interfaces (produit) :**
- `LigneJournal = { id: string; creeLe: string; auteurNom: string; categorie: CategorieJournal; resume: string }`.
- `lireJournal(filtres: { categorie: CategorieJournal | null; auteur: string | null; jours: number | null }, avant?: string): Promise<{ lignes: LigneJournal[]; suite: boolean } | null>`.
- `chargerJournal(...)` est l'action du serveur pour « Voir plus ».

**La page** (`requireDomaine("journal")`) :
- le titre « Journal des actions » et le sous-titre « Ce que l’équipe a fait dans le back-office. » ;
- les filtres dans l'adresse (`?categorie=&auteur=&periode=7|30|365|tout`) ;
- le tableau : date (« 2 nov. 2026, 14:05 », heure du Bénin), auteur, catégorie (étiquette), résumé ;
- « Voir plus » ;
- sans ligne : « Aucune action sur cette période. ».

- [ ] **Steps :** tests (lignes, filtres qui changent l'adresse, « Voir plus », page refusée sans le domaine) → échec → implémentation → passe → commit `feat(journal): la page du journal pour le super admin`.

### Task 6 : les statistiques en base (0062)

**Files :** Create `web/supabase/migrations/0062_statistiques_pilotage.sql` ; Test `web/tests/db/statistiques-pilotage.test.ts`.

**Interfaces (produit) :**
- **`public.vue_ensemble_back_office(p_maintenant timestamptz default now()) returns jsonb`**, domaine `statistiques` :
  - `utilisateurs {total, ce_mois}` ;
  - `abonnes {actifs, mois_precedent}` ;
  - `revenus_mois` ;
  - `formations {total, brouillons}` ;
  - `certificats` ;
  - `taux_completion` (0 à 100, nul sans formation commencée) ;
  - `abonnements_par_mois [{mois:'2026-10', nouveaux, renouvellements}]`, sur 6 mois ;
  - `formules [{code, nom, part}]` ;
  - `a_traiter {a_examiner, paiements_echoues[], paiements_en_attente[], fins_proches[]}`, 5 éléments au plus chacun ;
  - `dernieres_inscriptions [{id, nom, cree_le, formule}]`, 4 ;
  - `derniers_paiements [{id, nom, formule, duree_mois, moyen, montant, statut, date}]`, 5.
- **`public.statistiques_periode(p_jours int, p_maintenant timestamptz default now()) returns jsonb`**, domaine `statistiques`. `p_jours` vaut 30, 90 ou 365 ; sinon `22023`.
  - `etudiants` : `{inscrits, courbe:[{debut, nombre}], actifs, lecons_terminees, formations_terminees, quiz:{passes, reussis}, exercices_valides, secondes_video}`.
  - `formations` : `[{id, titre, statut, suiveurs, nouveaux, progression, achevement, secondes_video, note, avis, certificats}]`.
  - `business` : `{abonnes_actifs, nouveaux, renouvellements, revenus, courbe:[{debut, montant}], conversion, formules:[{code, nom, nombre}], codes_promo:{utilisations, remise}}`.
- **Les définitions** :
  - un abonnement est un **renouvellement** si le compte avait un abonnement commencé avant ;
  - la **courbe** est par semaine sur 30 ou 90 jours, par mois sur 365 jours ;
  - les **secondes vidéo** = `secondes_couvertes(passages)` des leçons vues (`vue_le`) sur la période ;
  - la **conversion** = la part des inscrits de la période qui ont un abonnement.

- [ ] **Steps :** tests sur des données connues (comptes, abonnements, paiements, progressions, certificats, avis), chiffres exacts ; Review Focus 4 (base vide : zéros et `taux_completion` nul) ; refus du modérateur → échec → 0062 → passe → commit `feat(statistiques): vue d'ensemble et statistiques par période (0062)`.

### Task 7 : la vue d'ensemble et la page « Statistiques »

**Files :**
- Create `web/src/lib/statistiques/{types,data}.ts`, `web/src/components/admin/statistiques/{VueEnsemble,PageStatistiques}.tsx` (et leurs sous-composants), `web/src/app/(app)/admin/statistiques/page.tsx`.
- Modify `web/src/app/(app)/admin/page.tsx` : `VueEnsemble` pour le domaine `statistiques`, sinon `TableauModerateur`. Retirer `TableauDeBordAdmin` et ses tests s'il n'est plus utilisé.
- Test `web/tests/admin/vue-ensemble.test.tsx`, `web/tests/admin/statistiques.test.tsx`.

**Interfaces (produit) :** `lireVueEnsemble(): Promise<VueEnsemble | null>` et `lireStatistiques(jours: 30 | 90 | 365): Promise<StatistiquesPeriode | null>` (null en démo ou si la migration manque, avec le bandeau « Appliquez la migration 0062 »).

**Les écrans :**
- **La vue d'ensemble** suit `NdAdmin` dans son ordre :
  - six indicateurs : « Utilisateurs », « Abonnés actifs », « Revenus du mois », « Formations », « Certificats », « Taux de complétion » ;
  - « Abonnements actifs par mois » (« Nouveaux », « Renouvellements ») ;
  - « Formules les plus choisies » ;
  - « À traiter » ;
  - « Dernières inscriptions » (« Tout voir » mène à `/admin/utilisateurs`) ;
  - « Derniers paiements » (« Tout voir » mène à `/admin/paiements`).
- **La page « Statistiques »** :
  - la période dans l'adresse (`?periode=30|90|365`, « 30 jours », « 3 mois », « 12 mois ») ;
  - les onglets « Étudiants », « Formations », « Business » ;
  - le tableau des formations se trie par colonne ;
  - la note « Temps mesuré sur les vidéos suivies (YouTube, Vimeo, TikTok, Tella) ».

- [ ] **Steps :** tests (indicateurs et textes exacts, plateforme vide : « 0 » et « — », changement de période et d'onglet dans l'adresse, tri) → échec → implémentation → passe → commit `feat(statistiques): la vue d'ensemble du design et la page Statistiques`.

### Task 8 : guide, vérification, relecture

- [ ] **Guide** : section 61 (appliquer 0060 à 0062 ; les essais de la spec §5).
- [ ] **Vérification** : `tsc`, `eslint`, suite complète.
- [ ] **Relecture** : relecture finale indépendante (opus), puis les correctifs.
- [ ] **Commit** : `docs: guide section 61 (pilotage)`.
