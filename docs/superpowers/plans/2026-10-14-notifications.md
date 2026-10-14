# Centre de notifications : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** chaque compte reçoit dans l'appli les notifications des actions de la plateforme (§2 de la spec), les lit dans la cloche et sur la page Notifications ; l'équipe envoie des annonces ; l'auteur d'un avis masqué ne le sait plus.

**Architecture :**
- **Migration 0016.** Une table `notifications` que seule la base remplit, par une fonction interne `notifier`. Elle applique les préférences du profil, écarte l'auteur de l'action et efface ce qui a plus de 6 mois.
  - Chaque événement est capté par un **déclencheur** (formations, leçons, avis, rôles, suspensions) plutôt qu'en réécrivant les fonctions de la 0013 et de la 0014. Elles restent intactes, et un changement fait ailleurs (éditeur SQL) notifie aussi.
  - Les comptes lisent et marquent les leurs par deux fonctions soumises aux règles d'accès.
  - Les annonces ont leur table et leur fonction réservée à l'équipe.
- **Avis masqués.** `avis_formation` garde sa forme, pour que la 0010 reste rejouable, mais rend toujours `masque = false`. La colonne `masque` n'est plus lisible directement par les comptes.
- **Application :**
  - `lib/notifications/` : types, temps relatif, règles, lectures, actions ;
  - la cloche se recharge à chaque changement de page, par une action du serveur ;
  - la page `/notifications` (client, avec « Voir plus ») ;
  - la rubrique `/admin/annonces`.

**Tech Stack :** Next.js 16.4, Supabase (SQL, RLS), PGlite (`tests/db/banc.ts`), Vitest + jsdom.

**Spec :** `docs/superpowers/specs/2026-10-14-notifications-design.md`

## Global Constraints

- **Textes :**
  - en français, avec l'apostrophe typographique (’) dans l'interface ;
  - les titres, textes et liens des notifications sont **exactement** ceux du §2 de la spec.
- **Migration :**
  - `web/supabase/migrations/0016_notifications.sql`, **rejouable** (`begin; … commit;`, `if not exists`, `create or replace`, `drop … if exists`), après la 0015 ;
  - en-tête comme la 0014 : « Si une migration plus ancienne est rejouée un jour, rejouer celle-ci ensuite ».
- **Avant la 0016 :**
  - la cloche est vide (« Vous êtes à jour ») ;
  - la page Notifications et la rubrique Annonces affichent le bandeau « Appliquez la migration 0016 (guide « Ce qui te revient », section 21). » ;
  - rien d'autre ne change.
- **Catégories :** `nouveaux_contenus`, `sessions_live`, `expiration_renouvellement`, `exercices`, `rappels_apprentissage`, `communaute`, `recommandations`, `annonces`, plus `service` (toujours envoyée, sauf canal coupé). Une clé absente des préférences vaut « activée », comme `readPreferences`.
- **Nombres fixés :**
  - conservation : **6 mois** ;
  - cloche : **8** ; page : **20** par lecture ;
  - annonce : titre **80**, texte **300** ;
  - début de la remarque de renvoi : **120** caractères.
- **Liens :** toujours une adresse du site, commençant par `/` et jamais par `//`. Jamais de donnée personnelle dans une adresse.
- **Heure du Bénin** (`Africa/Porto-Novo`) pour les groupes par jour et les heures.
- **Pages :**
  - chaque page du back-office appelle `requireSpace("admin")` ;
  - la page Notifications, dans l'espace étudiant, contient `<SessionGuard`.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Supprimer un compte suspendu.** La suppression efface la suspension en cascade. Le déclencheur de réactivation ne doit alors rien écrire pour un profil qui disparaît : la suppression doit réussir → test de la tâche 2.
2. **Lien d'annonce hors du site.** `https://…`, `//site.com`, `javascript:…` et `\\…` sont refusés, par la base comme par l'action. `/` seul et `/formations/excel` sont acceptés → tests des tâches 3 et 5.
3. **Plus de 8 non lues.** La cloche annonce le vrai nombre (« Notifications, 12 non lues ») tout en n'en listant que 8 → test de la tâche 6.
4. **Plusieurs notifications de la même seconde** (plusieurs leçons ajoutées d'un coup). « Voir plus » ne saute ni ne répète rien : le curseur est l'identifiant croissant, pas la date → test de la tâche 1.
5. **Textes longs à 320 px.** Une annonce de 300 caractères sans espace, ou un titre de formation de 120 caractères, se coupent dans la cloche et sur la page : jamais de débordement → mesure de la tâche 9.

---

### Task 1 : Migration 0016 : la table, `notifier` et la lecture par les comptes

**Files :**
- Create : `web/supabase/migrations/0016_notifications.sql`
- Test : `web/tests/db/notifications.test.ts`. Banc : la liste de `tests/db/suivi-etudiants.test.ts`, plus `0015_suivi_etudiants.sql` et la 0016.

**Interfaces :**
- Produces (SQL) :
  - **Table `public.notifications`** :
    - colonnes :
      - `id bigint generated always as identity primary key` ;
      - `destinataire uuid not null → profils on delete cascade` ;
      - `categorie text not null`, l'une des 9 valeurs (contrainte `check`) ;
      - `titre text not null` (1 à 200) ;
      - `texte text not null default ''` (400 au plus) ;
      - `lien text`, nul ou `~ '^/'` et `!~ '^//'` ;
      - `cree_le timestamptz not null default now()` ;
      - `lue_le timestamptz` ;
    - index `(destinataire, id desc)` ;
    - RLS : `select` et `update` si `destinataire = auth.uid()`, plus la règle restrictive « compte suspendu : rien » (même texte que la 0013) ;
    - droits : `revoke all` à `anon` et `authenticated` ; puis `grant select` et `grant update (lue_le)` à `authenticated`.
  - **`public.notifier(p_destinataires uuid[], p_categorie text, p_titre text, p_texte text, p_lien text) returns integer`** :
    - `security definer`, sans droit d'exécution pour `public`, `anon` et `authenticated` ;
    - commence par effacer les notifications de plus de 6 mois de ces destinataires ;
    - enregistre une ligne par destinataire distinct et existant, sauf dans trois cas :
      - le destinataire est `auth.uid()` ;
      - `preferences_notifications ->> 'canal_appli' = 'false'` ;
      - la catégorie n'est pas `service` et `preferences_notifications ->> p_categorie = 'false'` ;
    - titre et texte coupés à 200 et 400 caractères ;
    - rend le nombre de lignes enregistrées.
  - **`public.mes_notifications(p_non_lues boolean default false, p_avant bigint default null, p_nombre integer default 20) returns jsonb`** :
    - `security invoker` : les règles d'accès filtrent ;
    - rend `{"lignes": [{id, categorie, titre, texte, lien, cree_le, lue}], "suite": bool, "non_lues": int}` ;
    - lignes par `id` décroissant, `id < p_avant` si donné, `p_nombre` borné entre 1 et 50 ;
    - `suite` dit s'il en reste après ; `non_lues` compte toutes les siennes non lues.
  - **`public.marquer_lues(p_ids bigint[] default null) returns void`** :
    - `security invoker` ;
    - pose `lue_le = now()` sur les siennes non lues ;
    - `null` vaut toutes, sinon seulement ces identifiants.
  - `mes_notifications` et `marquer_lues` sont exécutables par `authenticated` seulement.
  - *Écart à la spec* : `nombre_non_lues()` n'existe pas. Le nombre de non lues est rendu par `mes_notifications`, ce qui fait une seule lecture pour la cloche.

- [ ] **Step 1 : Tests qui échouent.**
  - Préparation : des comptes `E1` et `E2` (étudiants), `A` (admin) et `S` (super admin).
  - Helper `notifierEn(auteur | null, destinataires, categorie, titre, texte, lien)` : une transaction en superutilisateur qui pose `request.jwt.claim.sub`, puis appelle `select public.notifier(...)`.

```ts
it("notifier : une ligne par destinataire, jamais l'auteur de l'action ; rend le nombre", …)          // notifierEn(E1, [E1,E2,E2]) → 1, seul E2
it("préférences : catégorie coupée → rien ; service passe ; canal dans l'appli coupé → rien, service compris", …)
it("une clé absente des préférences vaut activée", …)
it("mes_notifications : les siennes, plus récentes d'abord ; non lues seulement ; non_lues ; suite", …)
it("Voir plus : 25 notifications de la même seconde, lues par 20 puis à partir de la dernière : 25 distinctes", …)
it("marquer_lues : null marque toutes les siennes ; une liste ne touche jamais celles d'un autre", …)
it("aucune écriture directe : insert refusé ; update d'une autre colonne que lue_le refusé ; notifier refusé à un compte", …)
it("un compte suspendu ne lit rien", …)
it("plus de 6 mois : effacées au prochain envoi au même destinataire", …)   // cree_le posé à now() - 7 mois par banc.db
it("la migration est rejouable", …)
```

- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/db/notifications.test.ts` → FAIL (migration absente).
- [ ] **Step 3 : Écrire** la table, les règles, `notifier`, `mes_notifications`, `marquer_lues`.
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS.
- [ ] **Step 5 : Commit** : `feat(notifications): table, notifier et lecture par les comptes (migration 0016)`

### Task 2 : Migration 0016 : les événements qui notifient

**Files :** Modify `web/supabase/migrations/0016_notifications.sql` ; Test `web/tests/db/notifications.test.ts` (nouveau `describe`).

**Interfaces :**
- Consumes : `notifier` (tâche 1) ; `nom_avis` (0010) ; `formateurs.compte_id`.
- Produces (fonctions internes, `security definer`, sans droit d'exécution pour les comptes) :
  - `public.suiveurs_formation(p_formation uuid) returns uuid[]` : les comptes qui ont une ligne `progression_lecons` sur une leçon de la formation ;
  - `public.membres_equipe() returns uuid[]` : les comptes qui ont le rôle admin, modérateur ou super admin et ne sont pas suspendus.
- Produces (déclencheurs ; leurs fonctions sont `security definer`) :
  - **`notifications_formations`**, `after insert or update on formations`, une ligne à la fois :
    - **Première publication** : `new.publiee_le is not null` et (insertion ou `old.publiee_le is null`).
      - Pour chaque parcours de la formation, dans l'ordre `parcours.ordre` : les comptes qui suivent une formation de ce parcours et n'ont pas encore été notifiés. Le compte du formateur de la formation est exclu.
      - Ils reçoivent `nouveaux_contenus`, « Nouvelle formation : <titre> », « Dans le parcours <nom_court>. », lien `/formations/<slug>`.
      - Puis le compte du formateur reçoit `service`, « Votre formation est en ligne », « <titre> », lien `/formateur/formations/<id>`.
    - **Archivage** (`old.statut <> 'archivee'` et `new.statut = 'archivee'`) : `suiveurs_formation`, `service`, « Formation archivée », « <titre> n’est plus disponible. Votre progression est conservée. », `/mes-formations`.
    - **Envoi en relecture** (`old.envoyee_le is null` et `new.envoyee_le is not null`) : `membres_equipe()`, `service`, « Formation à valider », « <titre>, par <nom de la fiche formateur> », `/admin/formations/<id>?onglet=publication`.
    - **Renvoi** (`new.renvoyee_le is not null` et `new.renvoyee_le is distinct from old.renvoyee_le`) : le compte du formateur, `service`, « Votre formation est à corriger ».
      - Texte : la remarque si elle a 120 caractères au plus, sinon ses 119 premiers suivis de « … ».
      - Lien : `/formateur/formations/<id>?onglet=publication`.
  - **`notifications_lecons`**, `after insert on lecons` : si la formation du module est `publiee`, `suiveurs_formation`, `nouveaux_contenus`, « Nouvelle leçon dans <titre de la formation> », « <titre de la leçon> », `/formations/<slug>/lecons/<id>`.
  - **`notifications_avis`**, `after insert on avis` : un avis modifié passe par `on conflict do update` et ne déclenche donc rien.
    - Destinataire : le compte du formateur, `service`.
    - Titre « Nouvel avis sur <titre> » ; texte « <nom_avis(prénom, nom)> : <note>/5 » ; lien `/formations/<slug>`.
  - **`notifications_roles`**, `after insert on roles referencing new table as nouveaux for each statement` :
    - chaque compte qui reçoit `formateur` : `service`, « Vous êtes formateur », « Créez et suivez vos formations depuis l’espace formateur. », `/formateur` ;
    - chaque compte qui reçoit un rôle d'équipe et n'en avait aucun hors de `nouveaux` : une seule notification `service`, « Vous faites partie de l’équipe », « Le back-office vous est ouvert. », `/admin`.
  - **`notifications_reactivation`**, `after delete on suspensions` : si le profil existe encore, `service`, « Votre compte est réactivé », « Vous retrouvez tous vos accès. », `/accueil`.
  - Masquer un avis (`masquer_avis`) **ne notifie personne**.

- [ ] **Step 1 : Tests qui échouent.**
  - Préparation, avec les fonctions réelles là où elles existent (`changer_roles`, `envoyer_en_relecture`, `renvoyer_au_formateur`, `enregistrer_avis`, `masquer_avis`, `suspendre_compte`, `reactiver_compte`) :
    - formateur `F` relié à sa fiche ;
    - parcours `P1` (« Académique ») et `P2` ; formation publiée `W` dans `P1`, suivie par `E1` ; formation publiée `V` dans `P2`, suivie par `E2` ;
    - formation brouillon `X` de `F`, dans `P1` et `P2`, avec une leçon.
  - Un helper `recues(compte)` lit en superutilisateur `categorie, titre, texte, lien` de ce compte.

```ts
it("première publication : E1 « Dans le parcours Académique. », E2 celui de P2, une seule fois chacun ; F : « Votre formation est en ligne »", …)
it("le formateur qui suit le parcours ne reçoit pas « Nouvelle formation »", …)
it("archiver puis republier : « Formation archivée » à ses étudiants, puis aucune nouvelle annonce de formation", …)
it("nouvelle leçon : ses étudiants, lien vers la leçon ; dans un brouillon : rien ; jamais l'auteur", …)
it("envoi en relecture : admin, modérateur et super admin, pas le formateur ; un second envoi pendant l'attente : rien", …)
it("renvoi : le formateur, la remarque coupée à 120 caractères avec « … »", …)
it("nouvel avis : le formateur, « Fifamè A. : 4/5 » ; modifier ou masquer l'avis : rien", …)
it("rôles : « Vous êtes formateur » ; admin et modérateur d'un coup : une seule « équipe » ; un rôle d'équipe de plus : rien ; ses propres rôles : rien", …)
it("réactivation : « Votre compte est réactivé » ; supprimer un compte suspendu (auth.users) réussit", …)
```

- [ ] **Step 2 : Lancer, ça échoue** → FAIL.
- [ ] **Step 3 : Écrire** les fonctions internes et les déclencheurs (`drop trigger if exists` avant chaque `create trigger`).
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS (les tests des migrations précédentes compris).
- [ ] **Step 5 : Commit** : `feat(notifications): publication, leçons, relecture, avis, rôles et réactivation notifient (migration 0016)`

### Task 3 : Migration 0016 : les annonces

**Files :** Modify `web/supabase/migrations/0016_notifications.sql` ; Test `web/tests/db/notifications.test.ts`.

**Interfaces :**
- Consumes : `notifier`, `equipe_contenus()`.
- Produces :
  - **Table `public.annonces`** :
    - colonnes :
      - `id uuid primary key default gen_random_uuid()` ;
      - `titre text not null` (1 à 80) ;
      - `texte text not null` (1 à 300) ;
      - `lien text`, nul ou `^/`, jamais `^//`, sans `\`, 300 caractères au plus ;
      - `auteur uuid → profils on delete set null` ;
      - `cree_le timestamptz default now()` ;
      - `destinataires integer not null default 0` ;
    - RLS active, aucun droit pour `anon` ni `authenticated` : tout passe par les fonctions.
  - **`public.publier_annonce(p_titre text, p_texte text, p_lien text default null) returns integer`** (`security definer`) :
    - hors de l'équipe : `Accès réservé à l’équipe.` (`42501`) ;
    - textes nettoyés des espaces ; lien vide → null ;
    - messages de refus :
      - titre : `Écrivez un titre (80 caractères au plus).` ;
      - texte : `Écrivez le texte de l’annonce (300 caractères au plus).` ;
      - lien : `Le lien doit être une adresse du site, commençant par « / ».` ;
    - enregistre l'annonce, puis appelle `notifier(tous les profils, 'annonces', titre, texte, lien)` ;
    - garde le nombre dans `destinataires` et le rend.
  - **`public.annonces_equipe() returns jsonb`** (`security definer`) :
    - réservée à l'équipe, sinon `42501` ;
    - rend `[{id, titre, texte, lien, auteur, cree_le, destinataires}]`, des plus récentes aux plus anciennes, 100 au plus ;
    - `auteur` vaut « prénom nom », ou « Compte supprimé ».
  - Les deux fonctions sont exécutables par `authenticated` seulement.

- [ ] **Step 1 : Tests qui échouent**

```ts
it("une annonce : tous les comptes sauf son auteur et ceux qui ont coupé les annonces ; nombre rendu et gardé", …)
it("refusée à un étudiant et à un formateur", …)
it("titre, texte et lien vérifiés ; https://…, //site.com, javascript:… refusés ; / et /formations/excel acceptés", …)
it("annonces_equipe : la liste avec l'auteur ; refusée à un étudiant ; la table n'est pas lisible directement", …)
```

- [ ] **Step 2 : Lancer, ça échoue** → FAIL.
- [ ] **Step 3 : Écrire.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS.
- [ ] **Step 5 : Commit** : `feat(notifications): annonces de l'équipe (migration 0016)`

### Task 4 : L'auteur d'un avis masqué ne le sait plus

**Files :**
- Modify :
  - `web/supabase/migrations/0016_notifications.sql` ;
  - `web/src/lib/avis/types.ts` (retirer `masque` de `AvisPublic`) ;
  - `web/src/lib/avis/data.ts` (ne plus lire `masque` dans `lireAvis`) ;
  - `web/src/components/avis/CarteAvis.tsx` (retirer la mention et la mettre à jour dans le commentaire du composant).
- Test : `web/tests/db/notifications.test.ts` (`describe` « Avis masqué ») ; adapter les tests existants qui attendent « Masqué par l’équipe » chez l'auteur (`tests/avis/section.test.tsx`, `tests/avis/data.test.ts`, au besoin `tests/avis/fenetre.test.tsx`).

**Interfaces :**
- Produces :
  - `avis_formation(p_formation, p_limite)` : même signature et mêmes colonnes. La colonne `masque` vaut **toujours `false`** ; elle est gardée pour que la 0010 reste rejouable. Le filtre reste le même : un avis masqué n'est rendu qu'à son auteur.
  - Sur `public.avis`, pour `authenticated` : `revoke select`, puis `grant select (id, profil_id, formation_id, note, commentaire, cree_le, modifie_le)`.
  - L'équipe garde `avis_equipe()`, `compte_equipe()` et la mention « Masqué » au back-office, sans changement.

- [ ] **Step 1 : Tests qui échouent**

```ts
// base
it("l'auteur reçoit son avis masqué avec masque = false ; un autre compte ne le reçoit pas", …)
it("l'auteur ne lit plus la colonne masque de ses avis ; il lit encore les autres colonnes", …)   // select masque → permission denied
it("l'équipe voit toujours qu'il est masqué", …)                                                   // avis_equipe() → masque true
// application
it("la carte de son propre avis ne porte jamais « Masqué par l’équipe »", …)                      // section.test.tsx
```

- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/db/notifications.test.ts tests/avis` → FAIL.
- [ ] **Step 3 : Implémenter** (migration, type, lecture, carte).
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db tests/avis tests/admin tests/utilisateurs`, puis `npx tsc --noEmit` → PASS.
- [ ] **Step 5 : Commit** : `feat(avis): l'auteur d'un avis masqué ne le sait plus (migration 0016)`

### Task 5 : Lectures, règles, temps et actions des notifications

**Files :**
- Create (sous `web/src/lib/notifications/`) : `types.ts`, `temps.ts`, `regles.ts`, `data.ts`, `actions.ts` (`"use server"`).
- Test (sous `web/tests/notifications/`) : `temps.test.ts`, `regles.test.ts`, `data.test.ts`, `actions.test.ts`. Ils utilisent `fauxSupabase`, sur le modèle de `tests/formateur/suivi.test.ts`.

**Interfaces :**
- Consumes : `mes_notifications`, `marquer_lues`, `publier_annonce`, `annonces_equipe` ; `Lecture<T>` ; `estFonctionAbsente`, `liste`, `texte` ; `exigerEquipe`, `SESSION_EXPIREE` ; `dateCourte` ; `demoModeActive`.
- Produces :
  - **`types.ts`** :
    - `CategorieNotification` : les 9 valeurs ;
    - `NotificationLue = { id: string; categorie: CategorieNotification; titre: string; texte: string; lien: string | null; creeLe: string; lue: boolean }` ;
    - `LotNotifications = { lignes: NotificationLue[]; suite: boolean; nonLues: number }` ;
    - `Annonce = { id: string; titre: string; texte: string; lien: string | null; auteur: string; creeLe: string; destinataires: number }`.
  - **`temps.ts`**, fonctions pures avec un `maintenant: Date` en paramètre, à l'heure du Bénin :
    - `quand(iso, maintenant): string`, avec ces paliers :
      - moins d'une minute → `À l’instant` ;
      - moins d'une heure → `Il y a 5 min` ;
      - le même jour → `Il y a 2 h` ;
      - la veille → `Hier` ;
      - sinon → `dateCourte` (« 12 oct. 2026 ») ;
    - `heure(iso): string` → `14 h 05` ;
    - `libelleJour(iso, maintenant)` → `Aujourd’hui`, `Hier` ou `dateCourte` ;
    - `grouperParJour<T extends { creeLe: string }>(lignes: T[], maintenant): { cle: string; libelle: string; lignes: T[] }[]` : un groupe par jour, dans l'ordre reçu.
  - **`regles.ts`** :
    - `NOMBRE_CLOCHE = 8` ; `NOMBRE_PAGE = 20` ;
    - `ANNONCE_TITRE_MAX = 80` ; `ANNONCE_TEXTE_MAX = 300` ;
    - `lienDuSite(lien: string): boolean` : commence par `/`, jamais par `//`, sans `\` ni espace ;
    - `EVENEMENT_NOTIFICATIONS = "etudium:notifications"` : l'événement de `window` qui fait recharger la cloche.
  - **`data.ts`** :
    - `lireNotifications(options: { nonLues?: boolean; avant?: string | null; nombre?: number }): Promise<Lecture<LotNotifications>>` : `avant` non numérique → `null` ; identifiants rendus en chaîne ;
    - `lireAnnonces(): Promise<Lecture<Annonce[]>>` ;
    - fonction absente → `migrationAbsente` ; autre erreur relancée ; en mode démo : une page vide.
  - **`actions.ts`** :
    - `chargerCloche(): Promise<LotNotifications | null>` : `NOMBRE_CLOCHE` lignes. Rend `null` sans session, avant la 0016 ou en cas d'erreur, qui est consignée : la cloche ne casse jamais l'en-tête.
    - `chargerNotifications(nonLues: boolean, avant: string | null): Promise<{ ok: true; page: LotNotifications } | { ok: false; message: string }>` : `NOMBRE_PAGE` lignes ; sans session, `SESSION_EXPIREE`.
    - `marquerLues(ids: string[] | null): Promise<{ ok: boolean; message?: string }>` : les identifiants non numériques sont écartés ; une liste vide n'appelle rien.
    - `publierAnnonce(titre: string, texte: string, lien: string): Promise<{ ok: true; destinataires: number } | { ok: false; message: string }>` :
      - garde `exigerEquipe` ;
      - vérifie d'abord les longueurs et `lienDuSite`, avec les messages de la tâche 3 ;
      - un message `P0001` de la base est rendu tel quel ;
      - `refresh()` après un succès.

- [ ] **Step 1 : Tests qui échouent**
  - `temps` : `À l’instant`, `Il y a 5 min`, `Il y a 2 h`, `Hier` ;
    - minuit au Bénin : 23 h 50 la veille, lu à 0 h 10 → `Hier`, et non `Il y a 20 min` ;
    - `12 oct. 2026` ; `heure` → `14 h 05` ;
    - groupes Aujourd’hui / Hier / date, dans l'ordre reçu.
  - `regles` : `lienDuSite` accepte `/`, `/formations/excel` ; refuse `https://a.b`, `//a.b`, `javascript:alert(1)`, `/\\a`, `formations`.
  - `data` : conversion (`id` en chaîne, `lue`, `nonLues`) ; paramètres transmis (`p_non_lues`, `p_avant`, `p_nombre`) ; `migrationAbsente` ; erreur relancée.
  - `actions` :
    - `chargerCloche` rend null sans session et avant la 0016 ;
    - `marquerLues(["12", "abc"])` → `p_ids: [12]` ; `marquerLues(null)` → `p_ids: null` ;
    - `publierAnnonce` : refus d'un étudiant (`ACCES_EQUIPE`) sans appel, refus d'un lien hors du site sans appel, message de la base, `refresh`.
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/notifications` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe**, puis `npx tsc --noEmit`.
- [ ] **Step 5 : Commit** : `feat(notifications): lectures, temps relatif et actions`

### Task 6 : La cloche

**Files :**
- Modify : `web/src/components/ui/NotificationsPanel.tsx`, `web/src/components/layout/HeaderActions.tsx`.
- Create : `web/src/components/notifications/affichage.ts`.
- Test :
  - `web/tests/notifications/cloche.test.tsx` (nouveau) ;
  - `web/tests/layout/header-actions.test.tsx` : simuler `@/lib/notifications/actions`, `chargerCloche` résolu à `null` ; les tests existants restent verts ;
  - `web/tests/ui/menus.test.tsx`, qui reste vert.
  - tout test qui rend l'en-tête (`HeaderActions`, `HeaderAccount`) simule désormais `@/lib/notifications/actions`.

**Interfaces :**
- Consumes : `chargerCloche`, `marquerLues`, `quand`, `EVENEMENT_NOTIFICATIONS`, `NotificationLue`.
- Produces :
  - **`NotificationsPanel`** :
    - nouveau ton `annonce` (`bg-premium-fond text-premium-texte`, `Megaphone01Icon`) ;
    - nouvelles props `unreadCount?: number` (sinon, le compte de la liste) et `onSelect?: (id: string) => void`, appelée au clic d'une notification, avant de suivre son lien ;
    - exporte `ElementNotification({ notification, onSelect })`, la ligne actuelle du panneau, réutilisée par la page.
  - **`affichage.ts`** :
    - `TON_CATEGORIE: Record<CategorieNotification, { tone; icon? }>` : `nouveaux_contenus` → `information` + `BookOpen01Icon` ; `annonces` → `annonce` ; `service` → `neutre` + `Notification02Icon` ; `sessions_live` → `information` + `Video01Icon` ; `communaute` → `neutre` ; `exercices` → `reussite` ; `expiration_renouvellement` → `attention` ; `rappels_apprentissage` et `recommandations` → `information` ;
    - `versPanneau(n: NotificationLue, maintenant: Date, quandDe = quand): AppNotification`.
  - **`HeaderActions`** :
    - à chaque `usePathname()` et à chaque `EVENEMENT_NOTIFICATIONS`, appelle `chargerCloche()` et garde `{ nonLues, lignes }` (vide si `null`) ;
    - `onMarkAllRead` → `marquerLues(null)`, puis tout passe à lu sur place ;
    - `onSelect(id)` → `marquerLues([id])`, la ligne passe à lu et le compteur baisse sur place.

- [ ] **Step 1 : Tests qui échouent** (`cloche.test.tsx`)
  - « 12 non lues, 8 listées : le bouton dit « Notifications, 12 non lues » » ;
  - « ouvrir la cloche : titres, textes, « Il y a 5 min », point Non lue ; « Voir toutes les notifications » mène à /notifications » ;
  - « clic sur une notification : marquerLues([id]) et le compteur baisse » ;
  - « Tout marquer comme lu : marquerLues(null) ; le bouton disparaît » ;
  - « changement de page ou événement etudium:notifications : la cloche se recharge » ;
  - « une annonce porte le ton violet ; chargerCloche null : Vous êtes à jour ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/notifications tests/layout tests/ui` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : même commande → PASS.
- [ ] **Step 5 : Commit** : `feat(notifications): la cloche de l'en-tête`

### Task 7 : La page Notifications et l'onglet des préférences

**Files :**
- Modify :
  - `web/src/app/(app)/(etudiant)/notifications/page.tsx` (remplace la page à venir) ;
  - `web/src/lib/pages-a-venir.ts` et `web/src/components/layout/ComingSoon.tsx` (retirer `notifications`) ;
  - `web/src/app/(app)/(etudiant)/profil/page.tsx` et `web/src/components/profile/ProfileTabs.tsx` (`?onglet=notifications` ouvre l'onglet).
- Create : `web/src/components/notifications/PageNotifications.tsx` (client), `web/src/components/notifications/ContenuNotifications.tsx` (serveur).
- Test : `web/tests/notifications/page.test.tsx`, `web/tests/profile/` (l'onglet initial), `web/tests/layout/pages.test.tsx` et `session-guard.test.tsx` (verts).

**Interfaces :**
- Consumes : `lireNotifications`, `chargerNotifications`, `marquerLues`, `grouperParJour`, `quand`, `heure`, `ElementNotification`, `TON_CATEGORIE`, `EVENEMENT_NOTIFICATIONS` ; `FilterChips`, `Heading`, `Lead`, `Banner`, `Button`.
- Produces :
  - `page.tsx` contient `<ContenuNotifications />` sous `Suspense`, puis `<SessionGuard />` sous `Suspense` ; métadonnées « Notifications · Étudium ».
  - `ContenuNotifications()` (serveur) :
    - lit la première page ;
    - avant la 0016, le bandeau « Les notifications ne sont pas encore dans la base. » avec le texte de la contrainte globale ;
    - sinon `<PageNotifications initial={page} />`.
  - **`PageNotifications({ initial: LotNotifications })`**, design `NdNotifications` :
    - titre « Notifications » et « Corrections, sessions live, abonnement et communauté. » ;
    - « Tout marquer comme lu », seulement s'il reste des non lues ; lien « Préférences » vers `/profil?onglet=notifications` ;
    - `FilterChips` « Filtrer les notifications » : Toutes / Non lues. Changer de filtre recharge la liste par `chargerNotifications` ;
    - un groupe par jour (`h2` : Aujourd’hui, Hier, date). L'heure affichée : `quand` aujourd'hui, `heure` les autres jours ;
    - un clic marque la notification lue ;
    - « Voir plus » si `suite`, avec `avant` = l'identifiant de la dernière ligne ;
    - vide : « Vous êtes à jour » et « Aucune notification non lue. Les prochaines apparaîtront ici. » ;
    - après chaque marquage, `window.dispatchEvent(new Event(EVENEMENT_NOTIFICATIONS))`.
  - `ProfileTabs({ profile, ongletInitial? })` → `defaultValue`. `profil/page.tsx` lit `searchParams.onglet`, accepte seulement `informations`, `notifications` et `securite`, dans le composant sous `Suspense`.

- [ ] **Step 1 : Tests qui échouent** (`page.test.tsx` et profil)
  - « groupes Aujourd’hui / Hier / date ; Il y a 2 h aujourd'hui, 14 h 05 les autres jours » ;
  - « filtre Non lues : chargerNotifications(true, null) ; Voir plus : chargerNotifications(false, "<dernier id>"), lignes ajoutées à la suite » ;
  - « Tout marquer comme lu : marquerLues(null), les points disparaissent, l'événement est émis » ;
  - « vide : Vous êtes à jour » ;
  - « avant la 0016 : le bandeau » ;
  - « Préférences mène à /profil?onglet=notifications ; ce lien ouvre l'onglet Notifications du profil ; une autre valeur ouvre Informations ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/notifications tests/profile tests/layout` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : même commande → PASS.
- [ ] **Step 5 : Commit** : `feat(notifications): page Notifications ; lien vers les préférences`

### Task 8 : La rubrique Annonces du back-office

**Files :**
- Create : `web/src/app/(app)/admin/annonces/page.tsx` ; `web/src/components/admin/annonces/PageAnnonces.tsx` (serveur) ; `web/src/components/admin/annonces/FormulaireAnnonce.tsx` (client).
- Modify : `web/src/lib/navigation.ts` (groupe Plateforme : Utilisateurs, **Annonces** `/admin/annonces` `Megaphone01Icon`, Abonnements et paiements, Modération ; barre du bas inchangée).
- Test : `web/tests/admin/annonces.test.tsx` ; `web/tests/layout/menus-espaces.test.tsx` (l'ordre du groupe Plateforme).

**Interfaces :**
- Consumes : `lireAnnonces`, `publierAnnonce`, `ANNONCE_TITRE_MAX`, `ANNONCE_TEXTE_MAX` ; `PageAdmin`, `Section`, `TableauListe`, `CELLULE_TABLEAU`, `ConfirmDialog`, `Field`, `TextInput`, `Textarea`, `Banner`, `dateCourte`, `heure`.
- Produces :
  - `page.tsx` : `requireSpace("admin")` dans un composant sous `Suspense`, comme `admin/avis/page.tsx` ; métadonnées « Annonces · Back-office · Étudium ».
  - `PageAnnonces()` : `PageAdmin` (titre « Annonces », description « Envoyez une notification à tous les comptes d’Étudium. », fil Annonces) ; avant la 0016, le bandeau ; sinon le formulaire, puis la liste.
  - **`FormulaireAnnonce()`** :
    - les champs Titre (80), Texte (300) et Lien (facultatif), avec l'aide « Une adresse du site, par exemple /formations » ;
    - **Envoyer l’annonce** ouvre `ConfirmDialog` :
      - titre « Envoyer cette annonce à tous les comptes ? » ;
      - description « Elle apparaîtra dans leurs notifications et ne pourra pas être retirée. » ;
      - bouton « Envoyer l’annonce » ;
    - succès : le message `role="status"` « Annonce envoyée à 12 comptes. » (« à 1 compte » au singulier) ; les champs sont vidés ;
    - refus : le message sous le formulaire ; les champs sont gardés.
  - **Liste** : `Section` « Annonces envoyées ».
    - `TableauListe` : `nom` « Annonces envoyées » ; colonnes Date (« 12 oct. 2026 à 14 h 05 »), Titre, Auteur, Destinataires ; `largeurMin` 720.
    - Vide : « Aucune annonce envoyée. »

- [ ] **Step 1 : Tests qui échouent**
  - « envoyer : confirmation, puis publierAnnonce(titre, texte, lien) ; message avec le nombre ; champs vidés » ;
  - « annuler la confirmation : rien n'est envoyé » ;
  - « refus (lien hors du site) : le message, champs gardés » ;
  - « la liste : date, titre, auteur, destinataires ; vide » ;
  - « avant la 0016 : le bandeau » ;
  - dans `menus-espaces` : le groupe Plateforme contient Utilisateurs, Annonces, Abonnements et paiements, Modération.
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/admin tests/layout` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/admin tests/layout` → PASS (`session-guard` et `pages` compris).
- [ ] **Step 5 : Commit** : `feat(admin): rubrique Annonces`

### Task 9 : Rendu et guide

- [ ] **Step 1 :** `cd web && npm run lint && npx tsc --noEmit && npm run build` → succès.
- [ ] **Step 2 : Mesurer à 1440, 390 et 320 px** des rendus statiques, temporaires et jamais commités (méthode des bilans précédents) :
  - la cloche ouverte avec une annonce de 300 caractères sans espace et un titre de formation de 120 caractères ;
  - la page Notifications avec trois groupes ;
  - la rubrique Annonces avec une liste de 3 annonces.
  - Attendu : la page ne s'élargit jamais ; les textes se coupent ; le tableau défile dans son cadre.
- [ ] **Step 3 : Section 21 du guide `docs/guides/ce-qui-te-revient.md`** :
  1. appliquer la 0016 après la 0015 ;
  2. avec le compte de test étudiant (section 20), ouvrir une leçon d'une formation d'un parcours ;
  3. au back-office, publier une autre formation de ce parcours. Le compte étudiant voit « Nouvelle formation » dans la cloche ; le clic mène à la fiche ;
  4. envoyer une annonce (Annonces, au back-office). Tous les autres comptes la voient ; le tien non ;
  5. dans le profil du compte étudiant, couper « Annonces », puis envoyer une autre annonce : elle n'arrive pas ;
  6. la page Notifications : filtres, « Tout marquer comme lu », « Préférences » ;
  7. masquer l'avis du compte étudiant (Avis, au back-office). Le compte étudiant voit toujours son avis, sans mention ; un visiteur ne le voit pas.
- [ ] **Step 4 :** `cd web && npx vitest run` → toute la suite passe.
- [ ] **Step 5 : Commit** : `docs: guide de validation des notifications et des annonces`
