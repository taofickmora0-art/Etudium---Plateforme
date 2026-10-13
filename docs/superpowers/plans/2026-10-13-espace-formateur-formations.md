# Espace formateur « Mes formations » : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un formateur crée et modifie ses formations depuis son espace, avec l'éditeur du back-office, et les envoie en relecture ; l'équipe publie ou renvoie avec une remarque.

**Architecture :**
- **Migration 0014.** Elle ajoute la relecture (quatre colonnes) et deux fonctions de droits (`ma_fiche_formateur`, `formateur_de`). Des règles d'accès permettent au formateur d'écrire dans ses formations ; la lecture et l'accès aux leçons sont élargis à ses formations.
- **Garde-fous.** Un déclencheur sur `formations` refuse au formateur tout réglage de l'équipe. Il ne s'applique qu'aux écritures directes des rôles de l'API (`current_user` = `authenticated`) : les fonctions `security definer` (relecture, notes des avis) passent.
- **Application.** L'éditeur du back-office est réglé par un `espace` (`admin` | `formateur`) ; les actions de contenu passent par une garde « équipe ou formateur ». La base vérifie que la formation est bien la sienne.

**Tech Stack :** Next.js 16.4, Supabase (RLS, déclencheurs, fonctions SQL), PGlite (`tests/db/banc.ts`), Vitest + jsdom.

**Spec :** `docs/superpowers/specs/2026-10-13-espace-formateur-formations-design.md`

## Global Constraints

- Textes en français, apostrophe typographique (’) dans l'interface.
- Migration `web/supabase/migrations/0014_espace_formateur.sql`, **rejouable**, appliquée par l'utilisateur après la 0013. Elle redéfinit `acces_lecon` **en gardant** `not public.compte_suspendu()` (0013).
- **Avant la 0014** : le back-office marche comme aujourd'hui (colonnes de relecture lues avec `lireAvecRepli`) ; Mes formations affiche « Appliquez la migration 0014 (guide « Ce qui te revient », section 19). »
- **Copies exactes** de la spec :
  - réglage refusé : `Ce réglage revient à l’équipe Étudium.` ;
  - sans fiche reliée : `Votre compte n’est pas encore relié à une fiche formateur. Contactez l’équipe Étudium.` ;
  - remarque : 1 000 caractères au plus.
- **États affichés** : `Brouillon`, `En attente de validation`, `À corriger`, `Publiée`, `Archivée`.
- **Rôles** : jamais de back-office pour un formateur ; `requireSpace("formateur")` en tête de chaque page de l'espace, `requireSpace("admin")` au back-office.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Collision d'adresse invisible.** Un formateur crée une formation dont l'adresse est déjà prise par le brouillon d'un autre, qu'il ne voit pas. Attendu : création réussie avec `-2`, `-3`… → test de la tâche 4.
2. **Réglages de l'équipe déjà posés.** Le formateur enregistre les Informations d'une formation que l'équipe a rendue gratuite ou à laquelle elle a donné un prix. Attendu : enregistrement réussi, réglages de l'équipe intacts → tests des tâches 1 (base) et 4 (action).
3. **Formation réattribuée par l'équipe à une autre fiche.** Attendu : l'ancien formateur la perd aussitôt (liste, éditeur, écritures) → tests des tâches 1 et 3.
4. **Écritures légitimes intactes.** L'avis d'un étudiant (note recalculée) et la publication par l'équipe sur une formation de formateur passent toujours → test de la tâche 1.
5. **Formation publiée d'un autre formateur.** Elle est lisible car publiée. Ouverte à l'adresse `/formateur/formations/<id>`, attendu : page introuvable → test de la tâche 6.

---

### Task 1 : Migration 0014 : droits du formateur sur ses formations

**Files :**
- Create : `web/supabase/migrations/0014_espace_formateur.sql`
- Test : `web/tests/db/espace-formateur.test.ts` (banc : migrations 0001 à 0013, exemples du lot 1)

**Interfaces :**
- Produces (SQL) :
  - **colonnes** : `formations.envoyee_le`, `renvoyee_le`, `modifiee_par_formateur_le` (`timestamptz`) ; `remarque_relecture text`, contrainte `formations_remarque_longueur` (≤ 1000) ;
  - **fonctions de droits** (`security definer`, `stable`, `search_path = ''`, exécution `anon, authenticated`) :
    - `ma_fiche_formateur() returns uuid` : la fiche dont `compte_id = auth.uid()`, si `a_role('formateur')` (donc pas suspendu) ;
    - `formateur_de(p_formation uuid) returns boolean` ;
    - `formation_du_module(p_module uuid) returns uuid` ;
    - `formation_de_la_lecon(p_lecon uuid) returns uuid` ;
    - `formateur_du_dossier(p_nom text) returns boolean` : premier dossier du chemin = identifiant d'une formation du formateur ; faux si ce n'est pas un UUID, sans erreur de conversion ;
  - **lecture** :
    - la règle « formations publiées visibles » est redéfinie (il reste une seule règle de lecture) : `statut = 'publiee' or (select public.equipe_contenus()) or public.formation_commencee(id) or formateur_id = (select public.ma_fiche_formateur())`. Colonne de la ligne, pas `formateur_de(id)` : une fonction ne voit pas encore la ligne qu'on est en train de créer, et `insert … returning` serait refusé ;
    - `acces_lecon` est redéfinie : `not compte_suspendu() and (equipe_contenus() or formateur_de(formation_de_la_lecon(p_lecon)) or exists (…0004 inchangé…))` ;
  - **écriture**, règles « le formateur ajoute / modifie / supprime » :
    - sur `formations` : `formateur_id = (select public.ma_fiche_formateur())`, en `using` et en `with check` ;
    - sur `formations_parcours` et `modules` : `formateur_de(formation_id)` ;
    - sur `lecons` : `formateur_de(formation_du_module(module_id))` ;
    - sur `lecons_contenus` et `ressources` : `formateur_de(formation_de_la_lecon(lecon_id))` ;
  - **déclencheur** `formations_formateur` (`before insert or update on formations`), dans cet ordre :
    1. passage à `publiee` (quel que soit l'auteur) : `envoyee_le`, `renvoyee_le` et `remarque_relecture` sont vidés ;
    2. si `current_user` n'est pas `authenticated`, ou si `equipe_contenus()` : on laisse passer ;
    3. **création par un formateur** :
       - `formateur_id` = sa fiche (sans fiche : `Votre compte n’est pas encore relié à une fiche formateur. Contactez l’équipe Étudium.`, code `42501`) ;
       - `statut = 'brouillon'` ;
       - `gratuite` et `achat_separe` à `false` ; `prix_fcfa` et `badge` à `null` ; `seuil_video = 90` ;
       - colonnes de relecture à `null` ; `note_moyenne` à `null` ; `nb_avis = 0` ;
    4. **modification par un formateur** :
       - changer `statut`, `formateur_id`, `gratuite`, `achat_separe`, `prix_fcfa`, `badge`, `seuil_video`, `envoyee_le`, `renvoyee_le`, `remarque_relecture`, `note_moyenne`, `nb_avis` ou `modifiee_par_formateur_le` lève `Ce réglage revient à l’équipe Étudium.` ;
       - puis, si `old.publiee_le` est posé : `modifiee_par_formateur_le = now()` ;
  - **déclencheur** `apres_modification_formateur()` (`after insert or update or delete`, `security definer`) sur `formations_parcours`, `modules`, `lecons`, `lecons_contenus` et `ressources` :
    - seulement si `current_user = 'authenticated'` et que ce n'est pas l'équipe ;
    - pose `modifiee_par_formateur_le = now()` sur la formation de la ligne, si elle est publiée (`publiee_le` posé) ;
  - **stockage** : règles « le formateur liste / dépose / remplace / supprime » sur les espaces `couvertures` et `ressources`, avec `formateur_du_dossier(name)`.

- [ ] **Step 1 : Écrire les tests qui échouent.** Préparation :
  - comptes : formateur `F` relié à la fiche `FA` par `changer_roles` ; formateur `G` relié à la fiche `FB` ; formateur `H` sans fiche (rôle posé en direct) ; étudiant `E` ; admin `A` ; super admin `S` ;
  - formations : `MA`, brouillon de `FA` avec une leçon ; `PUB`, publiée de `FA`, réglée par l'équipe (`gratuite = true`, `prix_fcfa = 5000`, `badge = 'populaire'`) ; `AUTRE`, brouillon de `FB`.

```ts
it("le formateur voit ses formations, pas le brouillon d'un autre", …)               // select id where id in (MA, AUTRE) → [MA]
it("il crée une formation : brouillon, à sa fiche, réglages par défaut", …)           // insert {titre, slug, gratuite: true, statut: 'publiee'} → statut brouillon, formateur_id FA, gratuite false
it("sans fiche, ou suspendu, il ne crée rien", …)                                      // H → /pas encore relié/ ; F suspendu → refus
it("il modifie le contenu de ses formations, programme compris", …)                    // update titre de MA ; insert modules/lecons/lecons_contenus/ressources de MA ; delete lecon
it("il ne touche pas aux formations d'un autre (rien ne change)", …)                   // update AUTRE → [] ; insert module dans AUTRE → refus RLS
it("il ne change ni l'état ni les réglages de l'équipe", …)                            // pour statut, gratuite, prix_fcfa, badge, seuil_video, formateur_id, envoyee_le, note_moyenne : /revient à l’équipe/
it("enregistrer le contenu d'une formation réglée par l'équipe garde ses réglages", …) // update PUB set resume → gratuite true, prix 5000, badge populaire intacts
it("après la mise en ligne, toute modification du formateur est datée ; pas avant", …) // update PUB → modifiee_par_formateur_le posé ; insert module dans PUB → idem ; update MA → null
it("l'équipe n'est pas gênée : elle publie, règle, réattribue", …)                     // A : update PUB set prix_fcfa ; update MA set formateur_id = FB → F ne voit plus MA, ne l'écrit plus
it("l'avis d'un étudiant recalcule toujours la note d'une formation de formateur", …)  // E termine PUB, enregistrer_avis → note_moyenne posée
it("il lit les leçons de ses brouillons ; un étudiant non", …)                         // acces_lecon(leçon de MA) : F true, E false ; compte F suspendu → false
it("stockage : il dépose dans le dossier de ses formations seulement", …)              // couvertures et ressources : MA/x ok ; AUTRE/x et 'pas-un-uuid/x' refus
it("une seule règle de lecture par table de contenu ; la migration est rejouable", …)
```

- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/db/espace-formateur.test.ts` → FAIL (migration absente).
- [ ] **Step 3 : Écrire la migration** (`begin; … commit;`, `if not exists`, `drop policy if exists`, `create or replace`). Les règles d'écriture sont créées par une boucle `do $$`, comme en 0004.
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS ; toutes les autres migrations restent vertes (`contenus.test.ts` : le formateur sans fiche est toujours refusé).
- [ ] **Step 5 : Commit** : `feat(formateur): droits du formateur sur ses formations dans la base (migration 0014)`

### Task 2 : Migration 0014 : la relecture

**Files :** Modify `web/supabase/migrations/0014_espace_formateur.sql` ; Test `web/tests/db/espace-formateur.test.ts` (nouveau `describe`).

**Interfaces :**
- Consumes : `formateur_de`, déclencheur `formations_formateur` (tâche 1).
- Produces :
  - `public.envoyer_en_relecture(p_formation uuid) returns void` (`security definer`, exécution `authenticated`), qui vérifie dans cet ordre :
    1. `formateur_de`, sinon `Cette formation n’est pas la vôtre.` (`42501`) ;
    2. statut brouillon, sinon `Seul un brouillon s’envoie en relecture.` ;
    3. au moins une leçon, sinon `Ajoutez au moins une leçon avant d’envoyer la formation en relecture.` ;
    4. puis pose `envoyee_le = now()`, `renvoyee_le = null`, `remarque_relecture = null`.
  - `public.renvoyer_au_formateur(p_formation uuid, p_remarque text) returns void` (`security definer`, exécution `authenticated`), qui vérifie dans cet ordre :
    1. `equipe_contenus()`, sinon `Accès réservé à l’équipe.` (`42501`) ;
    2. remarque nettoyée des espaces de début et de fin, de 1 à 1 000 caractères, sinon `Écrivez une remarque pour le formateur (1 000 caractères au plus).` ;
    3. formation en attente (`statut = 'brouillon'` et `envoyee_le` posé), sinon `Cette formation n’attend pas de validation.` ;
    4. puis pose `envoyee_le = null`, `renvoyee_le = now()`, `remarque_relecture` = la remarque.

- [ ] **Step 1 : Tests qui échouent**

```ts
it("le formateur envoie son brouillon en relecture ; il peut encore le modifier", …)        // envoyee_le posé ; update titre ok
it("pas un brouillon vide, pas un brouillon d'un autre, pas une formation publiée", …)
it("l'équipe renvoie avec une remarque obligatoire ; le formateur la voit, corrige et renvoie", …)
it("renvoyer : pas un formateur, pas une formation qui n'attend pas, pas sans remarque", …)
it("publier efface l'envoi et la remarque", …)                                              // A : update statut publiee → colonnes nulles
it("la remarque de plus de 1 000 caractères est refusée", …)
```

- [ ] **Step 2 : Lancer, ça échoue** → FAIL (`function public.envoyer_en_relecture… does not exist`).
- [ ] **Step 3 : Écrire les deux fonctions** à la suite de la 0014.
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS.
- [ ] **Step 5 : Commit** : `feat(formateur): envoi en relecture et renvoi au formateur (migration 0014)`

### Task 3 : États, lectures du back-office et de l'espace formateur

**Files :**
- Create : `web/src/lib/contenus/etat.ts`, `web/src/lib/formateur/data.ts`
- Modify : `web/src/lib/admin/types.ts`, `web/src/lib/admin/data.ts` (`listFormations`, `getFormationAdmin`)
- Test : `web/tests/contenus/etat.test.ts`, `web/tests/formateur/data.test.ts`, `web/tests/admin/data.test.ts`

**Interfaces :**
- Produces :
  - `etat.ts` :
    - `type EtatFormation = "brouillon" | "en_attente" | "a_corriger" | "publiee" | "archivee"` ;
    - `etatFormation(f: { statut: StatutFormation; envoyeeLe: string | null; renvoyeeLe: string | null }): EtatFormation` ;
    - `ETATS: Record<EtatFormation, string>` (libellés des Global Constraints) ;
    - `TON_ETAT: Record<EtatFormation, TagTone>` : `brouillon` → `enAttente`, `en_attente` → `populaire`, `a_corriger` → `echoue`, `publiee` → `valide`, `archivee` → `aCorriger`.
  - `FormationResume` reçoit `etat: EtatFormation` et `modifieeParFormateurLe: string | null`.
  - `FormationAdmin` reçoit `envoyeeLe`, `renvoyeeLe`, `remarqueRelecture`, `modifieeParFormateurLe` (`string | null`).
  - `listFormations(filtre?: { formateurId: string }): Promise<FormationResume[]>` :
    - colonnes facultatives par `lireAvecRepli([", envoyee_le, renvoyee_le, modifiee_par_formateur_le", ""])` ;
    - avec un filtre : `.eq("formateur_id", …)`, tri par `modifie_le` décroissant ; sinon par titre, comme aujourd'hui.
  - `getFormationAdmin` : variantes `[", couverture, envoyee_le, renvoyee_le, remarque_relecture, modifiee_par_formateur_le", ", couverture", ""]`.
  - `formateur/data.ts` :
    - `lireMaFiche(): Promise<{ migrationAbsente: true } | { migrationAbsente: false; fiche: string | null }>`, par `rpc("ma_fiche_formateur")` ;
    - `estMaFormation(id: string): Promise<boolean>`, par `rpc("formateur_de")` : faux pour un identifiant mal formé (sans appel), et faux si la fonction est absente.

- [ ] **Step 1 : Tests qui échouent**
  - `etatFormation` :
    - les cinq cas : `brouillon` + `envoyeeLe` → `en_attente` ; `brouillon` + `renvoyeeLe` (sans `envoyeeLe`) → `a_corriger` ; `publiee` reste `publiee` même si `envoyeeLe` traîne.
  - `listFormations` :
    - « sans les colonnes de la 0014 (42703), la liste reste lisible, tout en Brouillon / Publiée / Archivée » ;
    - « avec un filtre : formateur_id et tri par modifie_le ».
  - `getFormationAdmin` : « les colonnes de relecture, null avant la 0014 ».
  - `lireMaFiche` : « fiche, null, migrationAbsente (PGRST202) ».
  - `estMaFormation` : « faux sans appel pour "abc" ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/contenus tests/formateur tests/admin/data.test.ts` → FAIL.
- [ ] **Step 3 : Implémenter** les signatures ci-dessus.
- [ ] **Step 4 : Lancer, ça passe**, puis `npx tsc --noEmit` sans erreur.
- [ ] **Step 5 : Commit** : `feat(formateur): états de relecture et lectures de l'espace formateur`

### Task 4 : Actions : le formateur écrit dans ses formations

**Files :**
- Modify : `web/src/lib/admin/garde.ts`, `web/src/lib/admin/actions.ts`
- Test : `web/tests/admin/formations-actions.test.ts`, `programme.test.ts`, `lecon.test.ts`, `ressources.test.ts`, `garde-et-parcours.test.ts`, `web/tests/couvertures/actions.test.ts`, et le nouveau `web/tests/formateur/actions.test.ts`

**Interfaces :**
- Consumes : la 0014 (fonctions `envoyer_en_relecture` et `renvoyer_au_formateur`).
- Produces :
  - `ACCES_EDITEUR = "Accès réservé aux formateurs et à l’équipe."` ;
  - `exigerEditeur(): Promise<{ supabase: Supabase; equipe: boolean } | { erreur: string }>` : l'équipe (`equipe: true`) ou le rôle `formateur` (`equipe: false`) ; sinon `ACCES_EDITEUR`, ou `SESSION_EXPIREE` sans session ;
  - `type EspaceEdition = "admin" | "formateur"` ;
  - `baseFormations(espace: EspaceEdition): "/admin/formations" | "/formateur/formations"` ; le champ caché `espace` est lu par `espaceDe(fd)` (toute autre valeur donne `admin`).
- **Actions qui passent de `exigerEquipe` à `exigerEditeur`** :
  - `createFormation` : redirection `${base}/${id}`. En cas de `23505`, elle réessaie avec la candidate suivante, 10 essais au plus : une adresse prise par un brouillon invisible.
  - `saveFormationInfos` : si `equipe` est faux, elle n'écrit que les champs du contenu (`titre, slug, resume, description, objectifs, competences, niveau`), validés par `formationInfosSchema.pick(...)` ; les parcours, comme aujourd'hui.
  - `deleteFormation(id, espace?)` : redirection `baseFormations(espace)`.
  - `addModule`, `renameModule`, `deleteModule`, `deleteLecon`, `saveLecon`, `addRessource`, `updateRessource`, `deleteRessource`, `enregistrerCouverture`, `retirerCouverture`.
  - `addLecon` : redirection `${base}/${formationId}/lecons/${leconId}`.
  - `deplacer` : passe aussi à `exigerEditeur`, mais la table `parcours` exige `equipe`.
- **Restent à l'équipe** : `setStatutFormation`, `saveParcours`, `saveFormateur`.
- **Nouvelles actions** :
  - `envoyerEnRelecture(id: string): Promise<Resultat>` (`exigerEditeur`) ;
  - `renvoyerAuFormateur(id: string, remarque: string): Promise<Resultat>` (`exigerEquipe`, remarque coupée à 1000 caractères) ;
  - le message `P0001` de la base est rendu tel quel, avec `typographie()`.

- [ ] **Step 1 : Tests qui échouent** (`tests/formateur/actions.test.ts`, faux client, rôles `["etudiant","formateur"]`) :
  - « le formateur crée une formation, redirigée vers /formateur/formations/<id> (espace=formateur) » ;
  - « une adresse prise par un brouillon invisible : réessai avec -2 » (`insert` rend `23505` puis réussit) ;
  - « enregistrer les Informations en formateur n'envoie aucun réglage de l'équipe » : les valeurs de `update` n'ont ni `gratuite`, ni `prix_fcfa`, ni `badge`, ni `seuil_video`, ni `formateur_id`, ni `achat_separe` ;
  - « addLecon en formateur redirige vers la leçon de l'espace formateur » ;
  - « deplacer : le formateur réordonne modules et leçons, pas les parcours » ;
  - « envoyerEnRelecture appelle la fonction ; renvoyerAuFormateur est refusé au formateur » ;
  - « un étudiant est refusé : Accès réservé aux formateurs et à l’équipe. ».
  - Dans les tests existants, remplacer le refus « Accès réservé à l’équipe. » des actions de contenu par `ACCES_EDITEUR`.
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/formateur/actions.test.ts` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/admin tests/couvertures tests/formateur` → PASS.
- [ ] **Step 5 : Commit** : `feat(formateur): les actions de contenu s'ouvrent au formateur sur ses formations`

### Task 5 : L'éditeur réglé par l'espace ; la relecture au back-office

**Files :**
- Modify :
  - `PageAdmin.tsx` (prop `racine?: { label: string; href: string }`, par défaut Back-office `/admin`) ;
  - `FormationInfosForm.tsx` (prop `espace: EspaceEdition`, par défaut `"admin"`) ;
  - `NouvelleFormationForm.tsx` (prop `espace`) ;
  - `ProgrammeEditor.tsx` (prop `base`, par défaut `"/admin/formations"`, pour le lien des leçons ; champ caché `espace` dans l'ajout de leçon) ;
  - `PublicationPanel.tsx` ;
  - `FiltreStatut.tsx` ;
  - `web/src/app/(app)/admin/formations/page.tsx` et `[id]/page.tsx`.
- Create : `web/src/components/admin/RenvoyerAuFormateur.tsx`.
- Test :
  - `web/tests/admin/formation-form.test.tsx`, `programme-editor.test.tsx` ;
  - nouveau `web/tests/admin/relecture.test.tsx`.

**Interfaces :**
- Consumes : `EtatFormation`, `ETATS`, `TON_ETAT` (tâche 3) ; `renvoyerAuFormateur`, `deleteFormation(id, espace)` (tâche 4).
- Produces :
  - `FormationInfosForm({ formation, parcours, formateurs, espace })`. En `formateur` :
    - pas de champs Formateur, Badge, Seuil, Gratuite, Disponible seule, Prix ;
    - à leur place, un bloc « Réglé par l’équipe Étudium » en lecture seule : `Gratuite : oui|non`, `Prix : 5 000 FCFA|—`, `Disponible seule : oui|non`, `Badge : Populaire|Aucun`, `Seuil des vidéos : 90 %` ;
    - le champ caché `espace`.
  - `PublicationPanel({ id, formation: Pick<FormationAdmin, "statut" | "envoyeeLe" | "renvoyeeLe" | "remarqueRelecture" | "modifieeParFormateurLe" | "publieeLe">, formateurNom: string | null })` — l'équipe :
    - si en attente : `Envoyée en relecture le <date> par <formateurNom>`, plus **Publier** et **Renvoyer au formateur** ;
    - si à corriger : `Renvoyée au formateur le <date>` et la remarque ;
    - si publiée et modifiée : `Modifiée par le formateur le <date>` ;
    - le reste inchangé.
  - `RenvoyerAuFormateur({ id })` : bouton et `ConfirmDialog` avec un `Textarea` « Remarque pour le formateur » (obligatoire, 1000 au plus). La confirmation est désactivée tant que la remarque est vide.
  - Liste du back-office :
    - étiquette `ETATS[f.etat]` avec `TON_ETAT` ;
    - sous-titre complété de ` · Modifiée par le formateur le <date>` quand c'est le cas ;
    - filtre `FiltreStatut`, dans l'ordre : `toutes` Toutes, `en_attente` En attente, `brouillon` Brouillons (états brouillon et à corriger), `publiee` Publiées, `archivee` Archivées.
  - Date : `dateCourte` (`lib/utilisateurs/regles`).

- [ ] **Step 1 : Tests qui échouent**
  - « en formateur, pas de réglages de l'équipe, mais le bloc en lecture seule » ;
  - « en admin, rien ne change » ;
  - « le lien d'une leçon suit la base » ;
  - « formation en attente : date, formateur, Publier et Renvoyer » ;
  - « renvoyer : remarque obligatoire, transmise » ;
  - « à corriger : la remarque » ;
  - « modifiée par le formateur » ;
  - « le filtre En attente » ;
  - « le fil d'Ariane suit la racine ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/admin` → FAIL sur les nouveaux tests.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/admin tests/layout` → PASS ; `npx tsc --noEmit`.
- [ ] **Step 5 : Commit** : `feat(admin): éditeur réglé par l'espace ; relecture au back-office (en attente, renvoi, modifiée par le formateur)`

### Task 6 : Les pages de l'espace formateur

**Files :**
- Create (sous `web/src/app/(app)/formateur/formations/`) :
  - `page.tsx` (remplace l'écran « Bientôt disponible ») ;
  - `nouvelle/page.tsx` ;
  - `[id]/page.tsx` ;
  - `[id]/lecons/[leconId]/page.tsx`.
- Create : `web/src/components/formateur/PublicationFormateur.tsx`, `web/src/components/formateur/SansFiche.tsx`.
- Modify :
  - `web/src/components/layout/BoutonAjouterFormation.tsx` (formateur → `/formateur/formations/nouvelle`) ;
  - `web/src/lib/pages-a-venir.ts` (retirer `formateur/formations`, et l'adapter dans les tests qui l'utilisent).
- Test : `web/tests/formateur/pages.test.tsx`, `web/tests/layout/menus-espaces.test.tsx`.

**Interfaces :**
- Consumes :
  - `lireMaFiche`, `estMaFormation`, `listFormations({ formateurId })`, `getFormationAdmin`, `getLeconAdmin`, `listParcours` (tâche 3) ;
  - `envoyerEnRelecture`, `deleteFormation` (tâche 4) ;
  - les composants réglés de la tâche 5, avec `racine = { label: "Espace formateur", href: "/formateur" }`.
- Produces :
  - `PublicationFormateur({ id, formation, jamaisPubliee: boolean })`. Ce qu'il affiche selon l'état :
    - Brouillon : `Envoyer en relecture` (confirmation) et `Supprimer le brouillon` (confirmation) ;
    - En attente : `Envoyée en relecture le <date>. Un admin la relit ; vous pouvez continuer à la modifier.` ;
    - À corriger : bandeau avec la remarque et `Renvoyée le <date>`, puis `Envoyer en relecture` ;
    - Publiée : `En ligne depuis le <date>. Vos corrections sont visibles tout de suite.` ;
    - Archivée : `Archivée par l’équipe Étudium.`
  - Les pages (toutes dans `Suspense`, `requireSpace("formateur")` dans `page.tsx`) :
    - `lireMaFiche()` : migration absente → bandeau 0014 ; fiche nulle → `SansFiche` (message exact de la spec) ;
    - éditeur et leçon : `notFound()` si `!estMaFormation(id)`.
  - Liste vide : `Vous n’avez pas encore de formation. Créez-en une : elle reste un brouillon tant que vous ne l’envoyez pas en relecture.`

- [ ] **Step 1 : Tests qui échouent**
  - « Mes formations : ses formations avec leur état » ;
  - « vide : le message » ;
  - « sans fiche : le message » ;
  - « avant la 0014 : le bandeau » ;
  - « la formation d'un autre (même publiée) : page introuvable » ;
  - « l'éditeur en mode formateur (pas de choix du formateur, liens /formateur/…) » ;
  - « publication : les cinq états et leurs boutons » ;
  - « le bouton Ajouter une formation de l'espace formateur mène à /formateur/formations/nouvelle ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/formateur tests/layout` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/formateur tests/layout tests/auth` → PASS. Le test statique `session-guard` doit trouver `requireSpace("formateur")` dans chaque nouvelle page.
- [ ] **Step 5 : Commit** : `feat(formateur): Mes formations (liste, création, éditeur, envoi en relecture)`

### Task 7 : Rendu et guide

**Files :**
- Modify : `docs/guides/ce-qui-te-revient.md` (section 19).
- Temporaires, jamais commités : le rendu statique de Mes formations et de l'éditeur en mode formateur, mesurés avec le CSS de la compilation.

- [ ] **Step 1 :** `cd web && npm run build` → succès.
- [ ] **Step 2 : Mesurer à 1440, 390 et 320 px :**
  - Mes formations : 5 états, titre de 120 caractères ;
  - Publication (formateur), avec une remarque de 1 000 caractères ;
  - Publication (équipe), en attente ;
  - bloc « Réglé par l’équipe ».
  - Attendu : aucun débordement ; noter les mesures au registre.
- [ ] **Step 3 : Section 19 du guide**
  1. appliquer la 0014 après la 0013, et la rejouer après toute ancienne migration rejouée ;
  2. donner le rôle Formateur au compte de test (section 18) ;
  3. dans sa fenêtre privée : Espace formateur → Mes formations → Nouvelle formation ; remplir, ajouter une leçon, une image ; Envoyer en relecture ;
  4. avec ton compte : Back-office → Formations → filtre En attente ; Renvoyer au formateur avec une remarque ;
  5. dans la fenêtre privée : À corriger et la remarque ; corriger et renvoyer ;
  6. avec ton compte : régler gratuité ou prix, puis Publier ;
  7. dans la fenêtre privée : en ligne ; corriger un texte → au back-office, « Modifiée par le formateur le … ».
- [ ] **Step 4 :** `cd web && npx vitest run` → toute la suite passe.
- [ ] **Step 5 : Commit** : `docs: guide de validation de l'espace formateur (Mes formations)`
