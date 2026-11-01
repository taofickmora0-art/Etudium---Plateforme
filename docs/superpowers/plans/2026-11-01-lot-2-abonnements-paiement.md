# Lot 2 — Abonnements, paiement Payiz et codes promo : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un compte gratuit prend un abonnement Basique (3 mois), Standard (6 mois) ou Premium (1 an), le paie par MTN ou Moov sans quitter Étudium (code promo possible), et tout s'ouvre dès la confirmation. L'équipe règle les prix et les codes, et suit les paiements au back-office.

**Architecture :**
- **En base (0049 à 0052) :**
  - les tables `formules`, `codes_promo`, `paiements`, `abonnements`, `evenements_payiz` et `reglages_paiement` ;
  - des fonctions `security definer` pour tout ce qui écrit. L'étudiant prépare un paiement. Seul le serveur, muni du jeton `PAIEMENT_JETON` dont la base ne garde que l'empreinte SHA-256, note un essai, le confirme ou l'échec ;
  - l'accès se calcule à la date du jour (`abonne(profil)`).
- **Côté serveur :**
  - un petit client Payiz (`fetch` natif) ;
  - des actions serveur (préparer, payer, suivre, réessayer) ;
  - une route de notifications signées `/api/paiements/payiz`.

  Le suivi et les notifications passent tous deux par `appliquerPayiz`, qui relit l'état chez Payiz puis appelle la base.
- **Les écrans :**
  - `/abonnement` (état, historique, reçus) ;
  - `/abonnement/souscrire` (abonnement, paiement, confirmation) ;
  - `/abonnement/recus/[numero]` (reçu imprimable) ;
  - les prix de la page d'accueil ;
  - le bandeau « Renouveler » ;
  - les verrous ;
  - `/admin/paiements` et les tuiles du tableau de bord.

**Tech Stack :** Next.js 16.4 (App Router, cacheComponents), Supabase/Postgres, Vitest 5, banc PGlite (`web/tests/db/banc.ts`), faux client Supabase (`web/tests/admin/faux-supabase.ts`), `node:crypto` pour la signature.

**Spec :** `docs/superpowers/specs/2026-11-01-lot-2-abonnements-paiement-design.md` (validée le 1er novembre 2026, choix 1 : lives et replays réservés aux abonnés).

**Annexe design :** `docs/superpowers/plans/2026-11-01-lot-2-annexe-design.md` (NdAbonnement, NdMobPaiement, bandeau, NdAdminPaiements : textes, couleurs, tailles). Les éléments marqués [ANCIEN] dans l'annexe ne sont pas codés : prorata, « / mois », étape Parcours, Celtiis, formations complémentaires, tableau comparatif.

## Global Constraints

**Textes et formats**
- Tous les textes sont en français, avec l'apostrophe typographique ’, y compris dans les messages de la base.
- Montants : en FCFA entiers, affichés par `montantFcfa` (« 15 000 FCFA », séparateur U+202F d'`Intl` fr-FR). Le minimum Payiz est de 1 000 FCFA.
- Dates : à l'heure du Bénin (`Africa/Porto-Novo`, UTC+1 fixe). On écrit « 1er mai 2027 », « 14 mars 2027 ».
- Les durées s'additionnent en mois **à l'heure du Bénin**, ramenées au dernier jour du mois : 31 août + 6 mois = 28 février. La base (`fin_periode`) et l'appli (`ajouterMois`) donnent la même date.

**Base de données**
- Les fonctions sont en `security definer` avec `set search_path = ''`.
- Les migrations sont rejouables :
  - `create … if not exists`, `create or replace`, `drop policy if exists` ;
  - un `begin; … commit;` ;
  - le bloc `cron` hors transaction, comme en 0041.
- Chaque fonction reçoit `revoke execute … from public, anon, authenticated`, puis les `grant` qui lui reviennent.
- Une fonction modifiée reprend sa **dernière** définition (le fichier est indiqué) et n'y ajoute que ce que la tâche dit.

**Droits**
- Back-office : lecture par `equipe_contenus()`. Écritures qui touchent à l'argent (prix, codes, activation, annulation) : `equipe_paiements()`, c'est-à-dire admin ou super_admin. Un modérateur voit tout sans boutons d'écriture.

**Secrets et données personnelles**
- `PAYIZ_CLE_SECRETE`, `PAYIZ_SECRET_WEBHOOK` et `PAIEMENT_JETON` :
  - ne sont lus que côté serveur, par `configurationPaiement(env = process.env)` (`?.trim()`) ;
  - n'ont jamais le préfixe `NEXT_PUBLIC_` ;
  - se simulent dans les tests par `vi.stubEnv`.

  On ne lit, ne crée ni ne commite `web/.env.local`.
- Le numéro complet n'est jamais enregistré ni journalisé. La base ne garde que `telephone_masque` (« +229 01 •• •• •• 00 »).
- Aucune donnée personnelle dans une URL. Seul `?formule=standard` y passe.

**Appels Payiz**
- Adresse : `https://api.payiz.app/v1`. En-têtes : `Authorization: Bearer <clé>`, `Idempotency-Key`, `Content-Type: application/json`.
- Corps de création : `currency: "XOF"`, `fees_paid_by: "merchant"`, `expires_at` (maintenant + 15 min, en secondes Unix), `metadata: { formule: <code> }`. Aucune donnée du compte n'y figure.
- Délai d'abandon : 15 s.

**Interface**
- Au téléphone, les tailles restent compactes (`max-sm`), comme dans le reste de l'appli.
- `Dialog` devient déjà une feuille du bas sous 640 px.

**Livraison**
- L'utilisateur applique lui-même 0049, 0050, 0051 et 0052.
- Les commits se terminent par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ne jamais lancer prettier sur un fichier.
- Commandes depuis `web/`. Suite complète : `npx tsc --noEmit && npx eslint . && npx vitest run`.

**Banc des tests de base**
- Il reprend la liste de `tests/db/replays.test.ts`.
- Il y ajoute `0047_sans_achat_seul`, `0048_monetisation`, puis les migrations du lot 2 jusqu'à celle de la tâche.
- Un abonnement de test s'insère en superutilisateur par l'aide `abonner()` (Task 1).

## Review Focus

1. **L'étudiant ferme l'onglet pendant l'attente, sans webhook (en local).**
   - Attendu : le paiement réussi s'active à sa prochaine visite de « Mon abonnement », sans rien faire de plus.
   - Testé : Task 4 (`resynchroniserEnAttente`) et Task 7.
2. **La relecture et la notification confirment le même paiement deux fois.**
   - Attendu : un seul abonnement et un seul numéro de reçu, même pour un paiement noté expiré ou annulé entre-temps (l'argent reçu l'emporte).
   - Testé : Task 1.
3. **Un faux appel.** Il peut s'agir d'un étudiant qui appelle `confirmer_paiement` ou `noter_essai` sans jeton ou avec un mauvais jeton, d'un montant différent, ou d'une notification bien signée pour un paiement d'une autre référence.
   - Attendu : refus, aucun accès ouvert.
   - Testé : Task 1, Task 3 et Task 5.
4. **Un numéro saisi de toutes les façons.** Exemples : « 01 42 00 00 00 », « +229 0142000000 », « 00229 01… », les 8 chiffres d'avant 2024 (« 97 00 00 00 »), des lettres ou une longueur fausse.
   - Attendu : le numéro est normalisé en `+22901XXXXXXXX`, sinon un message clair.
   - Testé : Task 3.
5. **Les bornes de dates.**
   - Attendu :
     - un abonnement pris en cours s'ajoute à la fin ;
     - l'accès se ferme à l'instant exact de la fin ;
     - un abonnement annulé ne compte plus ;
     - 31 août + 6 mois = 28 février ;
     - les rappels ne visent que la fin réelle (pas un abonnement suivi d'un autre).
   - Testé : Task 1, Task 2, Task 4 et Task 12.

---

### Task 1 : Migration 0049, abonnements et paiements en base

**Files :**
- Create : `web/supabase/migrations/0049_abonnements_paiements.sql`
- Create : `web/tests/db/abonner.ts` (aide de test)
- Test : `web/tests/db/abonnements-paiements.test.ts`

**Interfaces :**
- Produces (tables) :
  - `formules(id uuid pk default gen_random_uuid(), code text unique check in ('basique','standard','premium'), nom text, duree_mois int check in (3,6,12), prix_fcfa int null check (prix_fcfa is null or prix_fcfa >= 1000), recommandee bool default false, active bool default true, ordre int)`.
    - Graines : `('basique','Basique',3,1)`, `('standard','Standard',6,2)` recommandée, `('premium','Premium',12,3)`, sans prix, insérées par `on conflict (code) do nothing`.
    - RLS : lecture pour `anon, authenticated` (`using (true)`).
  - `codes_promo(id uuid pk, code text unique check (code ~ '^[A-Z0-9_-]{3,30}$'), type text check in ('pourcentage','montant'), valeur int check (valeur > 0 and (type <> 'pourcentage' or valeur <= 100)), debut timestamptz null, fin timestamptz null, limite int null check (limite > 0), actif bool default true, cree_par uuid references profils on delete set null, cree_le timestamptz default now())`.
    - RLS : lecture pour `equipe_contenus()`.
  - `paiements(id uuid pk, profil_id uuid null references profils on delete set null, formule_id uuid not null references formules, code_promo_id uuid null references codes_promo on delete set null, prix_initial int not null, remise int not null default 0, montant int not null check (montant = 0 or montant >= 1000), statut text not null default 'en_attente' check in ('en_attente','reussi','echoue','expire','annule'), payiz_id text unique null, operateur text null check in ('mtn','moov'), telephone_masque text null, motif_echec text null, essai_le timestamptz null, cree_le timestamptz default now(), confirme_le timestamptz null, numero_recu text unique null)`.
    - RLS : lecture si `profil_id = (select auth.uid()) or equipe_contenus()`. Aucune écriture directe.
  - `abonnements(id uuid pk, profil_id uuid not null references profils on delete cascade, formule_id uuid not null references formules, paiement_id uuid not null unique references paiements, debut timestamptz not null, fin timestamptz not null check (fin > debut), annule_le timestamptz null, motif_annulation text null, rappel_7j_le timestamptz null, rappel_veille_le timestamptz null, rappel_fin_le timestamptz null, cree_le timestamptz default now())`.
    - Index `(profil_id, fin)`. RLS : même lecture que `paiements`.
  - `evenements_payiz(id text pk, recu_le timestamptz default now())` : RLS sans politique.
  - `reglages_paiement(id boolean pk check (id), empreinte text null, active_le timestamptz, active_par uuid)` : une ligne `(true)`, RLS sans politique.
  - Séquence `public.numeros_recus`.
- Produces (fonctions internes, fermées à tous) :
  - `equipe_paiements() returns boolean` : le compte a le rôle `admin` ou `super_admin`.
  - `jeton_paiement_valide(p_jeton text) returns boolean` : `coalesce(p_jeton,'') <> '' and encode(sha256(convert_to(p_jeton,'UTF8')),'hex') = (select empreinte from public.reglages_paiement where id)`.
  - `exiger_jeton_paiement(p_jeton text) returns void` : lève « Jeton de paiement non reconnu. » (`42501`).
  - `abonne(p_profil uuid) returns boolean` : un abonnement non annulé avec `debut <= now() < fin`.
  - `fin_abonnement(p_profil uuid) returns timestamptz` : `max(fin)` des abonnements non annulés dont `fin > now()`, sinon null.
  - `fin_periode(p_debut timestamptz, p_mois int) returns timestamptz` : `((p_debut at time zone 'Africa/Porto-Novo') + make_interval(months => p_mois)) at time zone 'Africa/Porto-Novo'`.
  - `remise_code(p_code text, p_formule uuid, p_profil uuid) returns jsonb` : la règle des codes, partagée.
  - `carte_paiement(p public.paiements) returns jsonb` :
    - clés `id, statut, formule {code, nom, duree_mois}, prix_initial, remise, montant, code, operateur, telephone_masque, motif_echec, numero_recu, payiz_id, cree_le, essai_le, confirme_le` ;
    - `abonnement {debut, fin}` ou null.
  - `activer_paiement(p_id uuid) returns void` :
    - verrouille la ligne (`for update`), et ne fait rien si elle est déjà `reussi` ;
    - sinon la passe à `reussi` avec `confirme_le = now()` et `numero_recu = 'ET-R-' || to_char(now() at time zone 'Africa/Porto-Novo','YYYY') || '-' || lpad(nextval('public.numeros_recus')::text, 6, '0')` ;
    - insère l'abonnement avec `debut = greatest(now(), coalesce(fin_abonnement(profil), now()))` et `fin = fin_periode(debut, duree_mois)`, `on conflict (paiement_id) do nothing`.
- Produces (ouvertes à `authenticated`) :
  - `paiements_ouverts() returns boolean` : empreinte posée. Ouverte aussi à `anon`.
  - `activer_paiements(p_jeton text) returns void` :
    - `exiger_compte_actif()`, puis `equipe_paiements()`, sinon « Réservé aux administrateurs. » (`42501`) ;
    - un jeton de moins de 32 caractères lève « Le jeton de paiement doit compter au moins 32 caractères. » (`P0001`) ;
    - pose l'empreinte, `active_le` et `active_par`.
  - `desactiver_paiements() returns void` : même garde ; l'empreinte redevient null.
  - `etat_paiements(p_jeton text) returns jsonb` : `{ ouverts, jeton_reconnu }`. `jeton_reconnu` vaut null si le jeton est vide. Réservé à `equipe_contenus()`.
  - `mon_abonnement() returns jsonb` :
    - `{etat:'actif', formule:{code,nom}, fin: fin_abonnement(uid)}` (formule de la ligne en cours) ;
    - sinon `{etat:'expire', formule, fin}` (dernier abonnement non annulé terminé) ;
    - sinon `{etat:'gratuit'}`.
  - `essayer_code(p_code text, p_formule uuid) returns jsonb` : `{ok:true, code_id, prix_initial, remise, montant}` ou `{ok:false, message}`.
    - Le code est comparé par `upper(trim(p_code))`.
    - Remise : en pourcentage, `floor(prix * valeur / 100)` ; en montant, `least(valeur, prix)`.
    - Messages, dans cet ordre :
      1. formule inactive ou sans prix : « Cet abonnement n’est pas encore proposé. » ;
      2. code absent ou inactif : « Ce code n’existe pas. » ;
      3. `now() < debut` : « Ce code n’est pas encore valable. » ;
      4. `now() >= fin` : « Ce code a expiré. » ;
      5. utilisations ≥ limite : « Ce code a atteint sa limite. » ;
      6. paiement réussi de ce compte avec ce code : « Vous avez déjà utilisé ce code. » ;
      7. montant entre 1 et 999 : « Ce code ne s’applique pas à cet abonnement. ».
    - Seuls les paiements `reussi` comptent comme utilisations.
  - `preparer_paiement(p_formule uuid, p_code text default null) returns jsonb` (renvoie `carte_paiement || {repris}`) :
    1. `exiger_compte_actif()`. Un formateur lève « Un compte formateur n’a pas d’abonnement. » (`42501`).
    2. Paiement en cours (`en_attente`, `payiz_id` posé, `essai_le > now() - 3 min`) : on le renvoie avec `repris: true`.
    3. Formule inactive ou sans prix : « Cet abonnement n’est pas encore proposé. ». Code refusé : son message (`P0001`).
    4. Si `montant > 0 and not paiements_ouverts()` : « Les paiements ouvrent bientôt. » (`P0001`).
    5. Insertion. Si `montant = 0`, `activer_paiement` aussitôt : abonnement offert, même paiements fermés.
  - `mes_paiements() returns jsonb` : les cartes du compte, de la plus récente à la plus ancienne. On exclut les paiements jamais envoyés à Payiz (`payiz_id is null and montant > 0`).
  - `mon_paiement(p_id uuid) returns jsonb` : la carte si elle appartient au compte, sinon null.
  - `recu(p_numero text) returns jsonb` :
    - à son compte ou à `equipe_contenus()`, et seulement pour un paiement `reussi`, sinon null ;
    - `{numero, date, compte {prenom, nom}, formule {nom, duree_mois}, debut, fin, prix_initial, remise, code, montant, operateur, telephone_masque}`.
- Produces (ouvertes à `anon, authenticated`, gardées par le jeton) :
  - `noter_essai(p_paiement uuid, p_payiz text, p_operateur text, p_telephone_masque text, p_jeton text) returns jsonb` :
    - statut `en_attente` ou `echoue`, sinon « Ce paiement n’attend plus de règlement. » ;
    - `payiz_id` nul ou égal, sinon « Paiement Payiz différent. » ;
    - repasse `en_attente`, `motif_echec` null, `essai_le = now()` ;
    - renvoie la carte.
  - `confirmer_paiement(p_paiement uuid, p_payiz text, p_montant int, p_jeton text) returns jsonb` :
    - paiement introuvable : « Paiement inconnu. » ;
    - déjà `reussi` : renvoie la carte telle quelle ;
    - `payiz_id` posé et différent : « Paiement Payiz différent. » ;
    - `p_montant <> montant` : « Montant différent du paiement enregistré. » ;
    - sinon `payiz_id = coalesce(payiz_id, p_payiz)`, puis `activer_paiement`, quel que soit l'état (`en_attente`, `echoue`, `expire`, `annule`).
  - `noter_echec(p_paiement uuid, p_statut text, p_motif text, p_jeton text) returns jsonb` :
    - `p_statut` dans `echoue|expire|annule` ;
    - sans effet sur un paiement `reussi` ;
    - `echoue` garde `p_motif` s'il fait partie des 8 codes Payiz de la spec, sinon `unknown`. Les autres statuts mettent le motif à null.
  - `evenement_payiz(p_id text, p_jeton text) returns boolean` : `insert … on conflict do nothing`, et vrai si l'événement est nouveau.
- Produces (aide de test) : `abonner(banc, profilId, { formule?: 'basique'|'standard'|'premium'; debut?: string; fin?: string; annule?: boolean })`. En superutilisateur, elle insère un paiement `reussi` puis l'abonnement, avec des dates SQL libres (`"now() - interval '1 day'"`).

- [ ] **Step 1 : écrire le test qui échoue.** Banc jusqu'à `0049_abonnements_paiements`.
  - Comptes : S (super_admin), E et G (étudiants), F (formateur).
  - Prix posé en superutilisateur : Standard 15 000, Basique 9 000.
  - Codes : `PROMO20` (20 %), `VIEUX` (fin passée), `FUTUR` (début demain), `UNIQUE` (limite 1, déjà réussi par G), `GROS` (montant 14 500), `OFFERT` (100 %).
  - Jeton `J = 'j'.repeat(40)`.

  Tests :
  - `it("trois formules sans prix, lisibles par un visiteur")`. Le visiteur lit les trois formules avant la pose des prix, triées par ordre, et Standard est recommandée.
  - `it("un code s'essaie avec ses messages")` :
    - `PROMO20` sur Standard donne `{ok:true, remise:3000, montant:12000}` ;
    - chacun des cinq refus donne exactement son message de l'Interface ;
    - « promo20 » en minuscules marche.
  - `it("préparer : fermé tant que les paiements ne sont pas activés, puis en cours repris")` :
    - avant activation : « Les paiements ouvrent bientôt. » ;
    - `activer_paiements('court')` par S : refus des 32 caractères ;
    - `activer_paiements(J)` par S réussit. Par E : « Réservé aux administrateurs. » ;
    - E prépare Standard + `PROMO20` : `en_attente`, montant 12 000 ;
    - après `noter_essai(…, 'pay_1', 'mtn', '+229 01 •• •• •• 00', J)`, une nouvelle préparation renvoie le même `id` avec `repris: true`.
  - `it("l'empreinte seule est gardée")` : `empreinte = encode(sha256(convert_to(J,'UTF8')),'hex')` et `empreinte <> J`.
  - `it("seul le jeton du serveur confirme, et une seule fois")` :
    - E appelle `confirmer_paiement(id,'pay_1',12000,'faux')` : « Jeton de paiement non reconnu. » ;
    - `anon` avec J et 1 000 : « Montant différent du paiement enregistré. » ;
    - avec 12 000 : `statut 'reussi'`, `numero_recu ~ '^ET-R-\d{4}-\d{6}$'` ;
    - un second appel renvoie le même numéro ;
    - `count(*)` des abonnements de E vaut 1, et `abonne(E)` est vrai.
  - `it("un paiement noté expiré puis payé s'active quand même")` : `noter_echec(…,'expire',null,J)` puis `confirmer_paiement` passent à `reussi`.
  - `it("les durées s'ajoutent")` : un second paiement Basique confirmé a `debut` = `fin` du premier et `fin = fin_periode(debut, 3)`. `mon_abonnement()` renvoie la `fin` du second.
  - `it("31 août + 6 mois = 28 février, à l'heure du Bénin")` : `fin_periode('2026-08-31 00:00+01', 6) = '2027-02-28 00:00+01'`.
  - `it("un échec se note, se relance et ne consomme pas le code")` :
    - G prépare Standard avec `PROMO20`, puis on note l'essai et `noter_echec(…,'echoue','insufficient_funds',J)` ;
    - motif gardé ; un motif inconnu devient `unknown` ;
    - `noter_essai` remet `en_attente` sans motif ;
    - `essayer_code('PROMO20', standard)` par G reste `ok`.
  - `it("100 % : abonnement offert sans Payiz, même paiements fermés")` : après `desactiver_paiements()`, `preparer_paiement(standard,'OFFERT')` renvoie `reussi`, montant 0, un numéro de reçu, et un abonnement.
  - `it("chacun ne lit que ses paiements et ses reçus")` :
    - G ne voit pas les paiements de E dans `mes_paiements()`, et `recu(<numéro de E>)` vaut null pour G ;
    - le reçu est non nul pour E et pour S ;
    - un paiement jamais envoyé (sans `payiz_id`) n'apparaît pas.
  - `it("un formateur n'a pas d'abonnement")` : `preparer_paiement` par F lève le message de l'Interface.
- [ ] **Step 2 : lancer le test.** `npx vitest run tests/db/abonnements-paiements.test.ts`. Attendu : ÉCHEC (migration absente).
- [ ] **Step 3 : écrire `0049_abonnements_paiements.sql` et `tests/db/abonner.ts`** selon les Interfaces.
- [ ] **Step 4 : relancer le test.** Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(abonnements): migration 0049, formules, codes promo, paiements et abonnements`

### Task 2 : Migration 0050, ce qu'ouvre un abonnement

**Files :**
- Create : `web/supabase/migrations/0050_acces_abonnes.sql`
- Test : `web/tests/db/acces-abonnes.test.ts`

**Interfaces :**
- Consumes : `abonne`, plus `abonner()` (Task 1).
- Produces :
  - `acces_abonne() returns boolean` : `equipe_contenus() or abonne((select auth.uid()))`. Ouverte à `authenticated`.
  - `acces_replays() returns boolean` : `acces_abonne() or peut_publier_replay()`. Ouverte à `authenticated`.
  - Fonctions modifiées (dernière définition) :
    - `acces_lecon(p_lecon uuid)` (0036) : la condition de la leçon publiée devient `(l.apercu or (f.gratuite and (select auth.uid()) is not null) or public.abonne((select auth.uid())))`. L'exclusion du formateur ne change pas.
    - `peut_lire_espace(p_parcours uuid)` (0019) : une alternative de plus, `public.abonne((select auth.uid()))`.
    - `espaces_communaute()` (0046) : pour l'espace `replays`, `'ouvert', public.acces_replays()`.
    - `fil_communaute(…)` (0046) : `p_espace = 'replays' and not acces_replays()` renvoie la même forme qu'une page vide.
    - `nouvelles_publications(p_espace, p_apres)` (0046) : `replays` sans `acces_replays()` renvoie `{nombre:0, auteurs:[]}`.
    - `publication_communaute(p_id uuid)` (0020) : null aussi si `v.replay and not public.acces_replays()`.
    - `sinscrire_session(p_session uuid)` (0023) : après les contrôles existants, `if not public.acces_abonne()`, lève « Les lives sont réservés aux abonnés. » (`42501`).
    - `carte_session(s public.sessions_live)` (0018) :
      - `lien` exige en plus `public.acces_abonne()` dans la fenêtre du live. L'animateur et l'équipe le gardent ;
      - nouvelle clé `'reservee', not (public.acces_abonne() or public.droit_session(s.formateur_id))`.

- [ ] **Step 1 : écrire le test qui échoue.** Banc jusqu'à `0050_acces_abonnes`.
  - Comptes :
    - E, gratuit ;
    - A, abonné (`abonner`, de `now() - 1 day` à `now() + 30 days`) ;
    - X, expiré (fin `now() - 1 minute`) ;
    - C, annulé ;
    - M, modérateur ;
    - F, formateur avec fiche.
  - Contenus :
    - une formation payante publiée avec une leçon publiée hors aperçu ;
    - un parcours P qui la contient ;
    - une publication `replay` de F ;
    - une session programmée qui commence dans 5 minutes.

  Tests :
  - `it("un abonnement actif ouvre les leçons payantes, pas un expiré ni un annulé")` : `acces_lecon` vaut vrai pour A et M, faux pour E, X et C.
  - `it("un abonné lit tous les espaces")` : `peut_lire_espace(P)` vaut vrai pour A, faux pour E.
  - `it("les replays : réservés aux abonnés, ouverts à leur auteur")` :
    - `espaces_communaute()` donne `replays.ouvert` faux pour E, vrai pour A et F ;
    - `fil_communaute('replays',…)` est vide pour E ;
    - `publication_communaute(<replay>)` est null pour E, non null pour A.
  - `it("les lives : inscription et lien réservés aux abonnés")` :
    - `sinscrire_session` par E lève « Les lives sont réservés aux abonnés. » ; par A, ça passe ;
    - `carte_session` en fenêtre : pour E, `lien` est null et `reservee` vrai ; pour A, `lien` présent et `reservee` faux.
- [ ] **Step 2 : lancer le test.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire `0050_acces_abonnes.sql`.**
- [ ] **Step 4 : relancer.** Relancer aussi `tests/db/replays.test.ts`, `tests/db/sessions-fuseaux.test.ts` et `tests/db/formateur-sans-espace-etudiant.test.ts`, inchangés car leur banc s'arrête avant 0050. Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(abonnements): migration 0050, l'abonnement ouvre formations, espaces, lives et replays`

### Task 3 : Le client Payiz et ses règles

**Files :**
- Create :
  - `web/src/lib/paiements/config.ts`
  - `web/src/lib/paiements/regles.ts`
  - `web/src/lib/paiements/payiz.ts`
  - `web/src/lib/paiements/signature.ts`
  - `web/src/lib/paiements/synchroniser.ts`
  - `web/src/lib/abonnement/types.ts`
  - `web/src/lib/abonnement/conversion.ts`
- Test :
  - `web/tests/paiements/regles.test.ts`
  - `web/tests/paiements/payiz.test.ts`
  - `web/tests/paiements/signature.test.ts`
  - `web/tests/paiements/synchroniser.test.ts`

**Interfaces :**
- Produces (`abonnement/types.ts`) :
  ```ts
  export type CodeFormule = "basique" | "standard" | "premium";
  export type Operateur = "mtn" | "moov";
  export type StatutPaiement = "en_attente" | "reussi" | "echoue" | "expire" | "annule";
  export type Formule = { id: string; code: CodeFormule; nom: string; dureeMois: 3 | 6 | 12; prix: number | null; recommandee: boolean; active: boolean };
  export type EtatAbonnement =
    | { etat: "gratuit" }
    | { etat: "actif" | "expire"; formule: { code: CodeFormule; nom: string }; fin: string };
  export type CartePaiement = {
    id: string; statut: StatutPaiement; formule: { code: CodeFormule; nom: string; dureeMois: 3 | 6 | 12 };
    prixInitial: number; remise: number; montant: number; code: string | null; operateur: Operateur | null;
    telephoneMasque: string | null; motifEchec: string | null; numeroRecu: string | null; payizId: string | null;
    creeLe: string; essaiLe: string | null; confirmeLe: string | null; abonnement: { debut: string; fin: string } | null;
    repris?: boolean;
  };
  export type EssaiCode = { ok: true; prixInitial: number; remise: number; montant: number } | { ok: false; message: string };
  export type EtapePaiement =
    | { etat: "attente"; paiement: CartePaiement; finAttente: string }
    | { etat: "reussi"; paiement: CartePaiement }
    | { etat: "echoue"; paiement: CartePaiement; message: string }
    | { etat: "expire"; paiement: CartePaiement }
    | { etat: "erreur"; message: string };
  ```
- Produces (`abonnement/conversion.ts`) : `versFormule(l)`, `versEtatAbonnement(j)`, `versCartePaiement(j)` et `versEssaiCode(j)`, de la forme SQL (snake_case) vers ces types. Ce module n'importe rien du serveur.
- Produces (`paiements/config.ts`) :
  - `export type ConfigPaiement = { cle: string; jeton: string; secretWebhook: string | null; mode: "test" | "reel" }` ;
  - `configurationPaiement(env = process.env): ConfigPaiement | null`. Elle renvoie null s'il manque `PAYIZ_CLE_SECRETE` ou `PAIEMENT_JETON`. Le mode est `"reel"` si la clé commence par `sk_live_`.
- Produces (`paiements/regles.ts`) :
  - `normaliserTelephone(saisie: string): string | null`.
    1. Retirer espaces, points et tirets.
    2. Retirer `+229`, `00229` ou `229` en tête quand il reste 10 chiffres.
    3. 8 chiffres : préfixer `01`.
    4. Le résultat doit valoir `/^01\d{8}$/` ; on renvoie alors `+229` + chiffres.
  - `operateurDuNumero(telephone: string): Operateur | null`, d'après les deux chiffres qui suivent `01` :
    - MTN : `42 46 50 51 52 53 54 56 57 59 61 62 66 67 69 90 91 96 97` ;
    - Moov : `55 58 60 63 64 65 68 94 95 98 99` ;
    - sinon null.
  - `masquerTelephone(telephone: string): string` : `"+2290142000000"` donne `"+229 01 •• •• •• 00"`.
  - `messageEchec(motif: string | null): string` : les textes de la spec §6, avec ’. `declined`, `unknown` et null donnent « Le paiement n’a pas abouti. ».
  - `messageErreurPayiz(code: string): string` :
    - `operator_required` : « Choisissez votre opérateur, MTN ou Moov. » ;
    - `phone_invalid` : « Ce numéro n’est pas valide. Vérifiez-le. » ;
    - `attempt_in_progress` : « Une demande est déjà en attente sur votre téléphone. Validez-la ou attendez quelques minutes. » ;
    - `operator_unavailable` : `messageEchec("operator_unavailable")` ;
    - `payment_closed` : « Cette demande est close. Recommencez le paiement. » ;
    - `too_many_attempts` : « Trop d’essais sur ce paiement. Recommencez dans quelques minutes. » ;
    - autre code : « Le paiement est indisponible pour le moment. Réessayez plus tard. ».
  - `export type Verdict = { action: "confirmer"; montant: number } | { action: "echec"; statut: "echoue" | "expire" | "annule"; motif: string | null } | { action: "attendre" }` et `verdictPayiz(p: PaiementPayiz): Verdict` :
    - `succeeded`, `partially_refunded` ou `refunded` : confirmer ;
    - `expired` : echec `expire` ;
    - `canceled` : echec `annule` ;
    - `requires_payment` avec un dernier essai `failed` : echec `echoue`, motif `failure_code ?? "unknown"`. Avec un dernier essai `expired` : motif `"timeout"` ;
    - sinon : attendre.
- Produces (`paiements/payiz.ts`) :
  - `export type PaiementPayiz = { id: string; status: string; amount: number; currency: string; reference: string | null; metadata?: Record<string, string>; expires_at: number | null; latest_attempt: { id: string; status: "pending" | "succeeded" | "failed" | "expired"; failure_code: string | null; operator: string | null; phone: string | null } | null }`.
  - `export class ErreurPayiz extends Error { code: string; statut: number; details?: Record<string, unknown> }`. L'erreur réseau ou le délai dépassé donnent `code "reseau"` et `statut 0`.
  - `creerPaiementPayiz(cle: string, d: { paiementId: string; montant: number; formule: { code: CodeFormule; nom: string; dureeMois: number }; telephone: string; operateur: Operateur | null }, f: typeof fetch = fetch): Promise<PaiementPayiz>` :
    - `POST /payments`, avec `Idempotency-Key: paiementId` ;
    - corps `{amount, currency:"XOF", reference: paiementId, description: "Abonnement Étudium Standard (6 mois)", metadata:{formule}, fees_paid_by:"merchant", expires_at, payer:{phone, operator?}}`. `operator` est omis s'il est null.
  - `relancerPaiementPayiz(cle: string, payizId: string, e: { telephone: string; operateur: Operateur | null; cleIdempotence: string }, f = fetch): Promise<void>` : `POST /payments/{id}/attempts`, corps `{phone, operator?}`.
  - `lirePaiementPayiz(cle: string, payizId: string, f = fetch): Promise<PaiementPayiz>` : `GET /payments/{id}`.
  - Une réponse non 2xx est lue comme `{error:{code, message, details}}` et devient `ErreurPayiz`.
- Produces (`paiements/signature.ts`) : `verifierSignature(corps: string, entete: string | null, secret: string, maintenant = Date.now()): boolean`.
  - L'en-tête `t=…,v1=…` peut contenir plusieurs `v1`.
  - On calcule l'HMAC-SHA256 hexadécimal de `${t}.${corps}`, et on compare avec `timingSafeEqual`.
  - On refuse si `|maintenant/1000 - t| > 300`.
- Produces (`paiements/synchroniser.ts`) :
  - `appliquerPayiz(supabase: SupabaseClient, paiementId: string, p: PaiementPayiz, jeton: string): Promise<CartePaiement | null>` :
    - refuse « Paiement Payiz étranger. » si `p.reference !== paiementId` ou `p.currency !== "XOF"` ;
    - selon `verdictPayiz`, appelle `confirmer_paiement` (`p_montant: p.amount`) ou `noter_echec` ;
    - renvoie la carte, ou null pour « attendre ».
  - `resynchroniserEnAttente(): Promise<void>` est ajoutée en Task 4.

- [ ] **Step 1 : écrire les tests qui échouent.**
  - `regles.test.ts` :
    - `normaliserTelephone` :
      - « 01 42 00 00 00 », « +229 0142000000 », « 00229 01 42 00 00 00 » et « 229-01-42-00-00-00 » donnent tous `+2290142000000` ;
      - « 97 00 00 00 » donne `+2290197000000` ;
      - « 01 97 00 », « abc » et « 02 42 00 00 00 » donnent null.
    - `operateurDuNumero` : `+2290142000000` donne mtn, `+2290155000000` donne moov, `+2290140000000` donne null.
    - `masquerTelephone`, comme dans l'Interface.
    - Chaque motif donne son texte exact. Chaque code d'erreur donne son texte.
    - `verdictPayiz` sur sept objets : `succeeded`, `processing`, `requires_payment` avec un essai `failed` (`insufficient_funds`), avec un essai `expired`, avec un essai `pending`, puis `expired` et `canceled`.
  - `payiz.test.ts` (fetch injecté qui enregistre ses appels) :
    - création : URL `https://api.payiz.app/v1/payments`, `Authorization: Bearer sk_test_x`, `Idempotency-Key` égal à l'id, corps exact. `expires_at` tombe entre maintenant + 899 et + 901 s ;
    - un 422 `operator_required` donne `ErreurPayiz { code:"operator_required", statut:422 }` ;
    - un fetch qui jette donne `code "reseau"` ;
    - relance : URL `/payments/pay_1/attempts`, et `Idempotency-Key` égal à `cleIdempotence`.
  - `signature.test.ts` :
    - vrai pour une signature calculée dans le test, et pour un en-tête à deux `v1` dont un juste ;
    - faux pour un mauvais secret, pour un `t` de plus de 300 s, et pour un en-tête mal formé ou absent.
  - `synchroniser.test.ts` (faux Supabase) :
    - `succeeded` (12 000) appelle `rpc.confirmer_paiement` avec `{p_paiement, p_payiz:"pay_1", p_montant:12000, p_jeton:"J"}` ;
    - `requires_payment` avec un essai `failed` appelle `rpc.noter_echec` avec `{p_statut:"echoue", p_motif:"insufficient_funds"}` ;
    - `processing` n'appelle rien et renvoie null ;
    - une référence différente lève « Paiement Payiz étranger. » sans rien appeler.
- [ ] **Step 2 : lancer.** `npx vitest run tests/paiements`. Attendu : ÉCHEC (modules absents).
- [ ] **Step 3 : écrire les modules** selon les Interfaces.
- [ ] **Step 4 : relancer.** Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(paiements): client Payiz, signature des notifications et règles de paiement`

### Task 4 : Lectures et actions serveur de la souscription

**Files :**
- Create :
  - `web/src/lib/abonnement/regles.ts`
  - `web/src/lib/abonnement/data.ts`
  - `web/src/lib/abonnement/actions.ts`
- Modify : `web/src/lib/paiements/synchroniser.ts` (ajout de `resynchroniserEnAttente`)
- Test :
  - `web/tests/abonnement/regles.test.ts`
  - `web/tests/abonnement/actions.test.ts`

**Interfaces :**
- Consumes : Task 1 (fonctions SQL), Task 3 (tout).
- Produces (`abonnement/regles.ts`, pur) :
  - `montantFcfa(n: number): string` ;
  - `dateLongue(iso: string): string` : « 1er mai 2027 », à l'heure du Bénin ;
  - `dureeAbonnement(mois: number): string` : « 3 mois », « 6 mois », « 1 an » ;
  - `ajouterMois(iso: string, mois: number): string`, même règle que `fin_periode` ;
  - `periodeSouscription(maintenant: Date, etat: EtatAbonnement, mois: number): { debut: string; fin: string }`. Le début est la fin en cours si l'abonnement est actif, sinon maintenant ;
  - `joursRestants(fin: string, maintenant: Date): number`, arrondi au jour supérieur ;
  - `libelleStatut(s: StatutPaiement): { libelle: string; ton: TagTone }` :
    - Réussi / `reussi` ;
    - En attente / `enAttente` ;
    - Échoué / `echoue` ;
    - Expiré / `enAttente` ;
    - Annulé / `enAttente`.
  - `libelleMoyen(p: CartePaiement): string` : « MTN Mobile Money », « Moov Money », ou « Offert » si le montant vaut 0 ;
  - `etapeDepuisCarte(c: CartePaiement): EtapePaiement` :
    - `reussi` donne reussi ;
    - `echoue` donne echoue, avec `messageEchec(motifEchec)` ;
    - `expire` et `annule` donnent expire ;
    - `en_attente` donne attente, avec `finAttente = (essaiLe ?? creeLe) + 3 min`.
  - `formuleDuCompte(e: EtatAbonnement): string` : le nom de la formule si l'abonnement est actif, sinon « Gratuite ».
- Produces (`abonnement/data.ts`, serveur, `cache`) :
  - `lireFormules(): Promise<Formule[]>` : `from("formules")…order("ordre")`. Table absente : `[]`.
  - `lireAbonnement(): Promise<EtatAbonnement>` : `rpc("mon_abonnement")`. Fonction absente ou mode démo : `{etat:"gratuit"}`.
  - `lirePaiements(): Promise<CartePaiement[]>` : `rpc("mes_paiements")`.
  - `lireRecu(numero: string): Promise<Recu | null>`. `Recu` est défini ici, d'après `recu()` (Task 1).
  - `paiementsOuverts(): Promise<boolean>` : `rpc("paiements_ouverts")` **et** `configurationPaiement() !== null`.
- Produces (`abonnement/actions.ts`, `"use server"`) :
  - `essayerCode(formuleId: string, code: string): Promise<EssaiCode>`.
  - `payer(e: { formuleId: string; code: string; telephone: string; operateur: Operateur | null }): Promise<EtapePaiement>` :
    1. Numéro saisi mais invalide : « Saisissez un numéro béninois à 10 chiffres (01 XX XX XX XX). » (sans appel).
    2. `rpc("preparer_paiement", {p_formule, p_code: code.trim() || null})`. Un refus de la base devient `erreur`, avec son message.
    3. Carte `reussi` : `{etat:"reussi"}`.
    4. Sans configuration : « Les paiements ouvrent bientôt. ».
    5. `repris` : l'étape de la carte.
    6. Numéro vide : « Saisissez votre numéro Mobile Money. ».
    7. `creerPaiementPayiz`. Une `ErreurPayiz` devient `erreur`, avec `messageErreurPayiz(code)`.
    8. `rpc("noter_essai", {…, p_operateur: operateur ?? latest_attempt.operator, p_telephone_masque: masquerTelephone(tel), p_jeton})`.
    9. `etapeDepuisCarte`.
  - `suivrePaiement(paiementId: string): Promise<EtapePaiement>` :
    - `rpc("mon_paiement")` ; null donne « Paiement introuvable. » ;
    - `en_attente` avec `payizId` et configuration : `lirePaiementPayiz`, puis `appliquerPayiz`. Une `ErreurPayiz` laisse la carte telle quelle ;
    - renvoie `etapeDepuisCarte`.
  - `reessayer(e: { paiementId: string; telephone: string; operateur: Operateur | null }): Promise<EtapePaiement>` :
    - normaliser ; vérifier la configuration ; `mon_paiement` ;
    - une carte `reussi` est renvoyée telle quelle ;
    - `relancerPaiementPayiz(…, { cleIdempotence: \`${paiementId}-${Date.now()}\` })` :
      - `payment_closed` : `noter_echec(…,"expire")`, puis `{etat:"expire"}` ;
      - `attempt_in_progress` : l'étape actuelle ;
      - autre code : `erreur`.
    - Puis `noter_essai`, et l'étape « attente ».
- Produces (`paiements/synchroniser.ts`) : `resynchroniserEnAttente(): Promise<void>`. Pour chaque carte de `mes_paiements` en `en_attente`, avec `payizId` et un `essaiLe` de moins d'une heure : `lirePaiementPayiz`, puis `appliquerPayiz`. Les erreurs sont ignorées une à une, et rien ne se fait sans configuration.

- [ ] **Step 1 : écrire les tests qui échouent.**
  - `regles.test.ts` :
    - `montantFcfa(15000) === "15 000 FCFA"` ;
    - `dateLongue("2027-05-01T10:00:00Z") === "1er mai 2027"` ;
    - `ajouterMois("2026-08-30T23:00:00Z", 6) === "2027-02-27T23:00:00.000Z"` (31 août à minuit, heure du Bénin) ;
    - `periodeSouscription` avec un abonnement actif part de sa fin ; sans abonnement, de maintenant ;
    - `etapeDepuisCarte` pour les cinq statuts, et `finAttente` = `essaiLe` + 180 s ;
    - `formuleDuCompte`.
  - `actions.test.ts` (faux Supabase, `vi.stubEnv("PAYIZ_CLE_SECRETE","sk_test_x")`, `vi.stubEnv("PAIEMENT_JETON","J")`, `vi.stubGlobal("fetch", …)`) :
    - `it("numéro invalide : message, sans appel")` ;
    - `it("sans configuration : « Les paiements ouvrent bientôt. », sans appel à Payiz")` ;
    - `it("paiement lancé : Payiz puis noter_essai avec le numéro masqué")` : `p_code` vaut null pour un code vide, le corps Payiz a `payer.phone "+2290142000000"` et `operator "mtn"`, et l'étape « attente » a `finAttente` ;
    - `it("paiement en cours repris : pas de second appel à Payiz")` ;
    - `it("abonnement offert : réussi sans Payiz")` ;
    - `it("erreur Payiz traduite")` (`operator_required`) ;
    - `it("suivre : réussi chez Payiz, confirmé en base")` ;
    - `it("suivre : Payiz injoignable, on reste en attente")` ;
    - `it("réessayer : nouvelle clé d'idempotence ; paiement clos, expiré")` ;
    - `it("resynchroniser : seuls les paiements en attente de moins d'une heure")`.
- [ ] **Step 2 : lancer.** `npx vitest run tests/abonnement/regles.test.ts tests/abonnement/actions.test.ts`. Attendu : ÉCHEC.
- [ ] **Step 3 : écrire les modules.**
- [ ] **Step 4 : relancer.** Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(abonnements): lectures et actions de la souscription (préparer, payer, suivre, réessayer)`

### Task 5 : La route des notifications Payiz

**Files :**
- Create : `web/src/app/api/paiements/payiz/route.ts`
- Test : `web/tests/paiements/route.test.ts`, sur le modèle de `tests/video/route.test.ts`.

**Interfaces :**
- Consumes : `verifierSignature`, `lirePaiementPayiz`, `appliquerPayiz`, `configurationPaiement`, et `evenement_payiz` (Task 1).
- Produces : `export async function POST(request: Request): Promise<Response>`.
  1. Lit le corps brut (`await request.text()`).
  2. Configuration ou `secretWebhook` absents : `503`.
  3. Signature fausse : `400` (« Signature refusée. »), sans rien lire d'autre.
  4. `JSON.parse`, puis `rpc("evenement_payiz", {p_id: evt.id, p_jeton})`. Un événement déjà vu donne `200`.
  5. Un `type` qui ne commence pas par `payment.` donne `200`.
  6. `lirePaiementPayiz(evt.data.object.id)`, puis `appliquerPayiz(supabase, objet.reference, …)`.
     - « Paiement Payiz étranger. » : `200` (rien n'est activé).
     - Payiz ou la base en erreur : `500`, pour que Payiz relance.
  7. Sinon : `Response.json({ recu: true })`.

  Le client Supabase est celui de `@/lib/supabase/server`, sans session. Les fonctions appelées sont ouvertes à `anon` et gardées par le jeton.

- [ ] **Step 1 : écrire le test qui échoue.** Les six cas de l'Interface :
  - le `503` ;
  - le `400` sans aucun `rpc` ;
  - `payment.succeeded`, qui appelle `evenement_payiz`, puis `GET` Payiz, puis `confirmer_paiement` (`200`) ;
  - l'événement en double, sans `GET` ;
  - `refund.succeeded`, ignoré ;
  - Payiz en `502` : réponse `500`.

  La signature est calculée dans le test avec `createHmac`.
- [ ] **Step 2 : lancer.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire la route.**
- [ ] **Step 4 : relancer.** Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(paiements): route des notifications Payiz signées`

### Task 6 : L'écran de souscription

**Files :**
- Create :
  - `web/src/app/(app)/(etudiant)/abonnement/souscrire/page.tsx`
  - `web/src/components/abonnement/Souscription.tsx`
  - `web/src/components/abonnement/AttentePaiement.tsx`
  - `web/src/components/abonnement/ResultatPaiement.tsx`
- Test : `web/tests/abonnement/souscription.test.tsx`

**Interfaces :**
- Consumes : `lireFormules`, `lireAbonnement`, `paiementsOuverts`, `essayerCode`, `payer`, `suivrePaiement`, `reessayer`, et les règles de la Task 4.
- Produces : `Souscription({ formules, abonnement, ouverts, initiale }: { formules: Formule[]; abonnement: EtatAbonnement; ouverts: boolean; initiale: CodeFormule | null })`, composant client.
  - La page est asynchrone sous `Suspense`. Elle a pour titre « S’abonner », et « Prolonger mon abonnement » si un abonnement est actif. `initiale` vient de `?formule=`.
- Comportement et textes (annexe, §3.4 à §3.6, sans les éléments [ANCIEN]) :
  - **`Stepper`** : « Abonnement », « Paiement », « Confirmation ».
  - **Étape 1, « 1. Choisissez votre abonnement »** :
    - `ChoiceCards` : titre = nom (Standard porte « Recommandé ») ; sous-titre = `dureeAbonnement` ; à droite, `montantFcfa(prix)`, ou « Prix annoncés au lancement » (option désactivée) ;
    - choix par défaut : `initiale` si elle a un prix, sinon la formule recommandée ;
    - aide : « Un abonnement pris avant la fin du précédent s’ajoute à sa date de fin. » ;
    - bouton « Continuer ».
  - **Étape 2, « 2. Paiement par Mobile Money »** :
    - Formulaire :
      - champ « Numéro Mobile Money » (`type="tel"`, placeholder « 01 00 00 00 00 », aide « Vous recevrez une demande de confirmation sur ce téléphone. ») ;
      - `ChoiceCards` « Opérateur » : « MTN Mobile Money » et « Moov Money ». Il est proposé par `operateurDuNumero` tant que la personne ne l'a pas choisi elle-même ;
      - champ « Code promo (facultatif) » avec « Appliquer ». Si le code passe : « Code appliqué : − 3 000 FCFA sur ce paiement. ». Sinon : le message du refus, en erreur de champ.
    - Récapitulatif (bloc gris) :
      - « Abonnement Standard » / « 6 mois · du 1er novembre 2026 au 1er mai 2027 » (`periodeSouscription`), avec le prix ;
      - la ligne « Code promo », « − 3 000 FCFA » ;
      - « Total ».
    - Pied :
      - cadenas, « Paiement sécurisé par Payiz. Étudium ne voit jamais votre code secret. » ;
      - « Retour » ;
      - « Payer 12 000 FCFA ». Si le total vaut 0 : « Activer mon abonnement offert », sans le champ du numéro ni l'opérateur.
    - Si `!ouverts` et que le total est positif : `Banner` d'information « Les paiements ouvrent bientôt. », et le bouton désactivé.
    - Une `erreur` d'action s'affiche sous le bouton (`role="alert"`).
  - **Attente** (`AttentePaiement`, `Dialog` non fermable par le voile) :
    - titre « Confirmez sur votre téléphone » ;
    - texte « Une demande de 12 000 FCFA a été envoyée au +229 01 •• •• •• 00. Saisissez votre code secret Mobile Money pour valider. » ;
    - encadré avec `Spinner`, « En attente de votre confirmation… » et le compte à rebours « 2:47 » (jusqu'à `finAttente`) ;
    - bouton « Fermer », qui arrête le suivi et revient à l'étape 2.
    - `suivrePaiement` est appelé toutes les 3 s, jamais deux fois en même temps, et s'arrête au démontage. À 0:00, un dernier suivi a lieu. S'il reste en attente, on passe à l'échec, avec le motif `timeout`.
  - **Résultat** (`ResultatPaiement`, `Dialog`) :
    - **réussi** : « Paiement confirmé », « Votre abonnement Standard est actif jusqu’au 1er mai 2027. », « Voir le reçu » (`/abonnement/recus/<numero>`) et « Commencer » (`/parcours`). L'étape 3 affiche le même texte derrière la fenêtre ;
    - **échoué** : « Le paiement n’a pas abouti », le message du motif, puis « Aucun montant n’a été débité. ». Boutons « Changer de numéro » (ferme et place le focus dans le champ) et « Réessayer » (`reessayer`, même numéro) ;
    - **expiré** : « La demande a expiré », « Aucun montant n’a été débité. Recommencez le paiement. », « Recommencer » (`payer` de nouveau).

- [ ] **Step 1 : écrire le test qui échoue** (actions simulées par `vi.mock("@/lib/abonnement/actions")`, faux minuteurs) :
  - `it("trois abonnements, Standard recommandé et choisi")` ;
  - `it("un abonnement sans prix ne se choisit pas")` ;
  - `it("récapitulatif : dates calculées, code appliqué, total")` ;
  - `it("un code refusé affiche son message")` ;
  - `it("le numéro propose l'opérateur")` : « 01 55 00 00 00 » coche Moov ;
  - `it("paiements fermés : message et bouton désactivé")` ;
  - `it("attente puis succès : numéro masqué, compte à rebours, reçu")` : 2 suivis « attente », puis « réussi » ;
  - `it("échec : motif clair, Réessayer relance le même paiement")` ;
  - `it("3 minutes sans réponse : « La demande n’a pas été validée à temps. »")` ;
  - `it("100 % : abonnement offert sans numéro")`.
- [ ] **Step 2 : lancer.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire la page et les composants.**
- [ ] **Step 4 : relancer.** Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(abonnements): écran de souscription, attente et résultat du paiement`

### Task 7 : « Mon abonnement » et le reçu

**Files :**
- Modify :
  - `web/src/app/(app)/(etudiant)/abonnement/page.tsx` (à la place de `ComingSoon`)
  - `web/src/components/layout/CoqueConnectee.tsx` (classe `print:hidden` sur la barre du haut, le menu et la barre du bas)
- Create :
  - `web/src/components/abonnement/PageAbonnement.tsx`
  - `web/src/components/abonnement/HistoriquePaiements.tsx`
  - `web/src/app/(app)/(etudiant)/abonnement/recus/[numero]/page.tsx`
  - `web/src/components/abonnement/Recu.tsx`
- Test :
  - `web/tests/abonnement/page-abonnement.test.tsx`
  - `web/tests/abonnement/recu.test.tsx`

**Interfaces :**
- Consumes : `resynchroniserEnAttente`, `lireAbonnement`, `lirePaiements`, `lireRecu`, et les règles de la Task 4.
- Produces :
  - `PageAbonnement({ abonnement, paiements, maintenant }: { abonnement: EtatAbonnement; paiements: CartePaiement[]; maintenant: Date })`.
  - La page appelle `resynchroniserEnAttente()` **avant** ses lectures.
  - `Recu({ recu }: { recu: Recu })`.
- Textes :
  - **En-tête** : « Mon abonnement », puis « Un abonnement de 3, 6 ou 12 mois, payé par Mobile Money. Pas de prélèvement automatique : vous renouvelez quand vous le décidez. ».
  - **Carte de l'état** (annexe §3.3) :
    - **gratuit** : « Compte gratuit », « Les formations gratuites, votre progression et vos certificats. », et « S’abonner » ;
    - **actif** : « Abonnement Standard », avec la pastille « Actif » (succès), ou « Expire dans 5 jours » (alerte) s'il reste 7 jours ou moins. Ensuite « Jusqu’au 14 mars 2027 » · « Renouvellement manuel », et « Prolonger » ;
    - **expiré** : « Abonnement Standard », la pastille « Expiré », « Expiré le 14 mars 2027 », et « Renouveler ».
    - Chaque bouton mène à `/abonnement/souscrire`.
  - **« Historique des paiements »** :
    - sous-titre « Chaque paiement réussi a son reçu. » ;
    - tableau « Date » | « Abonnement » | « Moyen » | « Montant » | « Statut » | « Reçu » ;
    - une ligne : « 01/11/2026 » · « Standard · 6 mois » · `libelleMoyen` · `montantFcfa` · `Tag` (`libelleStatut`) · « Voir le reçu » (paiements réussis seulement, `aria-label` « Voir le reçu du 01/11/2026 ») ;
    - liste vide : « Aucun paiement pour le moment. ».
  - **Reçu** (`notFound()` si `lireRecu` vaut null) :
    - « Reçu de paiement » et le numéro ;
    - date ; « Compte : Prénom Nom » ;
    - « Abonnement Standard · 6 mois », « Du 1er novembre 2026 au 1er mai 2027 » ;
    - « Prix », « Remise (PROMO20) » si elle existe, « Montant payé » ;
    - « Moyen : MTN Mobile Money · +229 01 •• •• •• 00 » (« Offert » si le montant vaut 0) ;
    - « Étudium · Paiement traité par Payiz » ;
    - bouton « Imprimer ou enregistrer en PDF » (`window.print()`, `print:hidden`).

- [ ] **Step 1 : écrire les tests qui échouent.**
  - Page : les trois états, avec leurs textes et liens ; la pastille « Expire dans 5 jours » ; le tableau et « Offert » ; le reçu proposé seulement sur un paiement réussi ; l'historique vide.
  - Page serveur : `resynchroniserEnAttente` est appelée avant `lirePaiements`, grâce à des mocks qui notent l'ordre des appels.
  - Reçu : tous les champs de l'Interface. « Imprimer » appelle `window.print`. Un numéro inconnu appelle `notFound`.
- [ ] **Step 2 : lancer.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire.** Retirer l'entrée `abonnement` de `src/lib/pages-a-venir.ts`, et mettre à jour le test qui la liste.
- [ ] **Step 4 : relancer.** Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(abonnements): page « Mon abonnement », historique et reçu imprimable`

### Task 8 : Les prix sur la page d'accueil

**Files :**
- Modify :
  - `web/src/components/landing/SectionFormules.tsx`
  - `web/src/components/landing/ContenuLanding.tsx`
  - `web/src/app/page.tsx`
  - `web/src/lib/landing/textes.ts`
- Test : le test existant de la landing qui vérifie « Prix annoncés au lancement » (le chercher avec `grep -rl PRIX_A_VENIR tests`), plus `web/tests/landing/formules-prix.test.tsx`.

**Interfaces :**
- Consumes : `lireFormules` (Task 4).
- Produces : `SectionFormules({ formules }: { formules: Formule[] })`.
  - Le prix est `montantFcfa(prix)`, suivi de « pour 6 mois » (« pour 1 an » pour Premium).
  - Formule absente ou sans prix : `PRIX_A_VENIR`, sans changer la hauteur.
  - Les textes et points restent ceux de `FORMULES`, associés par nom.
  - Bouton « Choisir Standard » : `/inscription?next=${encodeURIComponent("/abonnement/souscrire?formule=standard")}`.
  - `ContenuLanding` reçoit `formules` comme les formations, dans un `Suspense`. Le repli est la section sans prix.
  - Retirer de son commentaire la promesse d'une page Tarifs. « Tarifs » reste l'ancre `/#formules`.

- [ ] **Step 1 : écrire le test qui échoue.**
  - Avec Standard à 15 000 : « 15 000 FCFA » et « pour 6 mois ».
  - Sans prix : « Prix annoncés au lancement » sur les trois cartes.
  - Le lien « Choisir Premium » porte `next` vers `/abonnement/souscrire?formule=premium`.
  - Vérifier aussi que `/inscription` transmet `next` jusqu'au retour de confirmation, en lisant `src/lib/auth/actions.ts` et la page d'inscription. S'il manque, ajouter le champ caché `next`, avec le test qui le prouve dans `tests/auth`.
- [ ] **Step 2 : lancer.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire.** Relire `src/lib/site/faq.ts` : aucune réponse ne doit parler de « mensuel », de « prorata » ni de « formation complémentaire », et les moyens de paiement cités sont « MTN ou Moov ». Corriger en conséquence.
- [ ] **Step 4 : relancer.** Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(landing): prix des abonnements lus au back-office`

### Task 9 : L'appli suit l'abonnement (verrous, lives, replays, profil, bandeau)

**Files :**
- Modify :
  - `web/src/lib/catalogue/regles.ts` (`etatAcces`)
  - `web/src/components/catalogue/FicheConnectee.tsx`
  - `web/src/lib/parcours/regles.ts` (`etatFormation`)
  - `web/src/components/parcours/MesParcours.tsx`
  - `web/src/components/parcours/PageMesParcours.tsx`
  - `web/src/components/lecon/ContenuLecon.tsx`
  - `web/src/components/lecon/LeconVerrouillee.tsx`
  - `web/src/lib/sessions/types.ts`
  - `web/src/components/sessions/CarteSession.tsx`
  - `web/src/components/communaute/EspaceVerrouille.tsx`
  - `web/src/lib/auth/current-user.ts`
  - `web/src/app/(app)/(etudiant)/accueil/page.tsx`
- Create : `web/src/components/abonnement/BandeauRenouveler.tsx`
- Test :
  - `web/tests/abonnement/verrous.test.tsx`
  - `web/tests/abonnement/bandeau-renouveler.test.tsx`
  - mise à jour des tests existants de `etatAcces`, `etatFormation` et `CarteSession`

**Interfaces :**
- Consumes : `lireAbonnement`, `formuleDuCompte`, `versEtatAbonnement`, `joursRestants` et `dateLongue` (Tasks 3 et 4). `reservee` et `replays.ouvert` (Task 2).
- Produces :
  - `etatAcces(fiche, connecte): "gratuite" | "incluse" | "apercu" | "verrouillee"`. La valeur `"incluse"` vaut si `connecte && !fiche.gratuite` et qu'une leçon de contenu non-aperçu est `accessible` : la base a ouvert la formation.
    - `FicheConnectee` traite `"incluse"` comme `"gratuite"` (« Commencer le cours »), avec la pastille « Incluse dans votre abonnement ».
  - `etatFormation(carte, progression?, abonne = false)` : une formation payante non commencée d'un abonné donne `{ libelle: "Incluse", ton: "nouveau" }`.
    - `MesParcours` reçoit `abonne` (lu par `PageMesParcours`). La note « Voir les abonnements » n'apparaît que s'il reste un verrou.
  - Les liens « Voir les abonnements » des leçons et des parcours mènent à `/abonnement/souscrire`.
  - `SessionCarte` gagne `reservee: boolean` (false si la clé manque).
    - Dans `CarteSession`, une session `reservee` montre une pastille cadenas « Avec un abonnement ». Les boutons « Je m’inscris », « Rejoindre » et « Voir le replay » sont remplacés par le lien « Voir les abonnements ».
  - `EspaceVerrouille`, pour `espace.id === REPLAYS` :
    - titre « Replays réservés aux abonnés » ;
    - description « Revoyez chaque live quand vous voulez avec un abonnement. » ;
    - action « Voir les abonnements ».
  - `getShellUser` : `formule: formuleDuCompte(versEtatAbonnement(await supabase.rpc("mon_abonnement")))`, avec « Gratuite » en cas d'erreur. On ne passe pas par `lib/abonnement/data` (pour éviter une importation circulaire).
  - `BandeauRenouveler({ abonnement, maintenant }: { abonnement: EtatAbonnement; maintenant: string })`, composant client en tête de l'Accueil (annexe §5.1 et §5.3) :
    - **actif, 7 jours ou moins :**
      - titre « Votre abonnement Standard se termine dans 5 jours. » (« demain », « aujourd’hui ») ;
      - texte « Prolongez-le pour garder l’accès à tout. Rien ne sera supprimé. » ;
      - bouton « Prolonger ».
    - **expiré depuis 30 jours ou moins :**
      - titre « Votre abonnement Standard a expiré le 14 mars 2027. » ;
      - texte « Renouvelez-le pour rouvrir vos formations. Rien n’a été supprimé. » ;
      - bouton « Renouveler ».
    - Les boutons mènent à `/abonnement/souscrire`.
    - « Plus tard » le masque jusqu'au lendemain. Il passe par `localStorage` (`etudium.renouveler.masque` = date du jour), lu sans erreur d'hydratation (`useSyncExternalStore`, comme `useFuseau`) et protégé par try/catch.
    - Au téléphone, seul le titre s'affiche.

- [ ] **Step 1 : écrire les tests qui échouent.**
  - `etatAcces` :
    - une formation payante dont une leçon non-aperçu est accessible donne `"incluse"` ;
    - sans leçon accessible, `"apercu"` ou `"verrouillee"`, comme avant.
  - `etatFormation` avec `abonne` donne « Incluse ».
  - `CarteSession` `reservee` : la pastille et « Voir les abonnements », sans « Je m’inscris ».
  - `EspaceVerrouille` replays : ses textes et son lien.
  - Bandeau :
    - il apparaît à J-5 avec « Prolonger », et sur un expiré avec « Renouveler » ;
    - il est absent pour un compte gratuit, à J-10, et à J+31 après l'expiration ;
    - « Plus tard » le masque.
  - `formuleDuCompte`, branchée sur `MobileProfileMenu` : « Étudiant·e · Standard ».
- [ ] **Step 2 : lancer.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire.**
- [ ] **Step 4 : relancer**, avec la suite complète, puisque `etatAcces` et `CarteSession` sont partagés. Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(abonnements): verrous, lives, replays, formule du profil et bandeau « Renouveler »`

### Task 10 : Migration 0051 et back-office « Abonnements et paiements »

**Files :**
- Create :
  - `web/supabase/migrations/0051_paiements_equipe.sql`
  - `web/src/lib/admin/paiements/data.ts`
  - `web/src/lib/admin/paiements/actions.ts`
  - `web/src/components/admin/paiements/PagePaiements.tsx`
  - `web/src/components/admin/paiements/ReglagePaiements.tsx`
  - `web/src/components/admin/paiements/OngletPaiements.tsx`
  - `web/src/components/admin/paiements/DetailPaiement.tsx`
  - `web/src/components/admin/paiements/OngletFormules.tsx`
  - `web/src/components/admin/paiements/OngletCodesPromo.tsx`
- Modify : `web/src/app/(app)/admin/paiements/page.tsx` (à la place de `ReservedComingSoon`), et `src/lib/pages-a-venir.ts` (retirer l'entrée `admin/paiements`)
- Test :
  - `web/tests/db/paiements-equipe.test.ts`
  - `web/tests/admin/paiements-actions.test.ts`
  - `web/tests/admin/paiements-ecran.test.tsx`

**Interfaces :**
- Consumes : tables et fonctions de la Task 1 ; `configurationPaiement` ; `montantFcfa`, `dateLongue` et `libelleStatut`.
- Produces (SQL, 0051) :
  - `regler_formule(p_formule uuid, p_prix int, p_recommandee bool, p_active bool) returns void` :
    - réservé à `equipe_paiements` ;
    - un prix non nul inférieur à 1 000 lève « Le prix doit être d’au moins 1 000 FCFA. » ;
    - recommander une formule retire la recommandation des autres.
  - `codes_promo_equipe() returns jsonb` (`equipe_contenus`) : `[{id, code, type, valeur, debut, fin, limite, actif, utilisations, cree_le}]`, du plus récent au plus ancien. Seuls les paiements réussis comptent comme utilisations.
  - `enregistrer_code_promo(p_id uuid, p_code text, p_type text, p_valeur int, p_debut timestamptz, p_fin timestamptz, p_limite int, p_actif bool) returns uuid` (`equipe_paiements`). Un `id` null crée le code. Messages :
    - « Le code compte 3 à 30 lettres, chiffres, tirets ou soulignés. » ;
    - « Un pourcentage va de 1 à 100. » ;
    - « Le montant de la remise doit être positif. » ;
    - « La fin doit suivre le début. » ;
    - « Ce code existe déjà. » (`23505` intercepté).
  - `paiements_equipe(p_statut text, p_recherche text, p_page int) returns jsonb` (`equipe_contenus`) : `{total, lignes:[{id, cree_le, compte:{id, prenom, nom, email}, formule:{code, nom, duree_mois}, montant, statut, operateur, telephone_masque, numero_recu}]}`.
    - Statuts filtrés : null (tous), `reussi`, `en_attente`, `echoue`, `expire` (qui inclut `annule`).
    - Recherche (`ilike`) sur le prénom, le nom, l'adresse ou le numéro de reçu. L'adresse vient de la même source que `comptes_equipe`.
    - 20 lignes par page. Les paiements jamais envoyés sont exclus.
  - `paiement_equipe(p_id uuid) returns jsonb` : la carte, plus `compte`, plus `abonnement {id, debut, fin, annule_le, motif_annulation}`.
  - `annuler_abonnement(p_abonnement uuid, p_motif text) returns void` (`equipe_paiements`) :
    - motif de 3 à 300 caractères, sinon « Indiquez le motif (3 à 300 caractères). » ;
    - pose `annule_le` et le motif ;
    - `notifier(array[profil], 'service', 'Votre abonnement a été annulé', motif, '/abonnement')`.
  - `resume_paiements() returns jsonb` (`equipe_contenus`) : `{revenus_mois, reussis_mois, echoues_mois, abonnes_actifs}`. Le mois est celui du Bénin.
- Produces (TS) :
  - `data.ts` :
    - `lireResumePaiements()` ;
    - `lireCodesPromo()` ;
    - `lirePaiementsEquipe(f: { statut: string | null; recherche: string; page: number })` ;
    - `lireEtatPaiements(): Promise<{ ouverts: boolean; jeton: "reconnu" | "non_reconnu" | "absent"; cle: "test" | "reel" | "absente"; webhook: boolean }>`. Elle passe par `rpc("etat_paiements", {p_jeton})` et ne renvoie jamais la clé ni le jeton.
  - `actions.ts` (`"use server"`, garde `requireSpace("admin")`) :
    - `reglerFormule(formData)`, `enregistrerCodePromo(prev, formData)`, `basculerCodePromo(id, actif)` ;
    - `activerPaiements()` (envoie `PAIEMENT_JETON`), `desactiverPaiements()` ;
    - `annulerAbonnement(id, motif)` ;
    - `chargerPaiements(f)`, `chargerPaiement(id)`.
- Écran (annexe §8.1, sans remboursement) :
  - **En-tête** : `PageAdmin` « Abonnements et paiements », « Les prix des abonnements, les codes promo et les paiements Mobile Money. ».
  - **Quatre `StatCard`** : « Revenus du mois » (FCFA), « Paiements réussis » (« Ce mois »), « Paiements échoués » (« Ce mois »), « Abonnés actifs ».
  - **`ReglagePaiements`** :
    - **désactivés** : « Paiements désactivés », « Les étudiants voient « Les paiements ouvrent bientôt. » », et « Activer les paiements ». Le bouton est désactivé si la clé ou le jeton manquent, avec l'aide « Ajoutez PAYIZ_CLE_SECRETE et PAIEMENT_JETON dans web/.env.local (guide « Ce qui te revient », section 56), puis relancez le serveur. » ;
    - **activés et jeton reconnu** : pastille « Paiements activés », « Clé Payiz : mode test » (ou « mode réel »), et « Désactiver les paiements » (`ConfirmDialog` « Désactiver les paiements ? » / « Les étudiants ne pourront plus payer. Les abonnements en cours ne changent pas. ») ;
    - **activés, jeton non reconnu** : `Banner` attention « Le jeton du serveur ne correspond plus à celui enregistré : les paiements ne peuvent pas être confirmés. », et « Réactiver » ;
    - **sans secret de notification** : « Notifications Payiz : à brancher une fois le site en ligne. ».
  - **`SegmentedTabs`** :
    - **« Paiements »** :
      - `FilterChips` « Tous », « Réussis », « En attente », « Échoués », « Expirés » ;
      - `SearchInput` « Rechercher un compte ou un numéro de reçu » ;
      - tableau « Date » | « Compte » | « Abonnement » | « Opérateur » | « Montant » | « Statut », et `Pagination` ;
      - une ligne ouvre `DetailPaiement` (`Dialog`). Il montre tous les champs et « Voir le reçu ». Pour un paiement réussi dont l'abonnement court encore et n'est pas annulé, il propose « Annuler l’abonnement », avec un motif obligatoire.
    - **« Abonnements »** : une ligne par formule.
      - Le nom et la durée sont affichés, pas modifiables.
      - Champs « Prix (FCFA) » (vide pour « Non fixé »), `Switch` « Proposé », et le choix « Recommandé ».
      - Bouton « Enregistrer ».
    - **« Codes promo »** :
      - « Nouveau code » ouvre un `Dialog` : Code, Type (« Pourcentage », « Montant »), Valeur, Début, Fin, Limite (vide pour « Sans limite »), Actif ;
      - tableau « Code » | « Remise » (« 20 % » ou « 2 000 FCFA ») | « Validité » | « Utilisations » (« 3 / 50 ») | « État » (« Actif », « Inactif », « Expiré ») | « Modifier » et « Désactiver » / « Activer ».
  - Un modérateur voit tout, sans aucun bouton d'écriture.

- [ ] **Step 1 : écrire les tests qui échouent.**
  - Base (banc jusqu'à 0051) :
    - un modérateur ne règle pas un prix ; un admin, si ;
    - un prix de 500 est refusé ;
    - la recommandation est unique ;
    - les cinq messages des codes ;
    - les utilisations ne comptent que les paiements réussis ;
    - le filtre, la recherche par numéro de reçu et la pagination de `paiements_equipe` ;
    - l'annulation ferme `abonne()` et notifie le compte ;
    - `resume_paiements` ;
    - `paiement_equipe` est refusé à un étudiant.
  - Actions (faux Supabase) :
    - `activerPaiements` sans `PAIEMENT_JETON` renvoie le message du guide, sans appel ;
    - avec le jeton, il appelle `rpc.activer_paiements` avec `{p_jeton:"J"}` ;
    - `lireEtatPaiements` ne contient jamais la clé.
  - Écran :
    - les trois états du réglage ;
    - les onglets ;
    - le détail avec « Annuler l’abonnement » ;
    - la vue modérateur sans boutons d'écriture.
- [ ] **Step 2 : lancer.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire.**
- [ ] **Step 4 : relancer.** Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(admin): migration 0051, back-office des abonnements, codes promo et paiements`

### Task 11 : Tableau de bord et liste des comptes

**Files :**
- Modify :
  - `web/supabase/migrations/0051_paiements_equipe.sql` (ajouts avant le `commit`)
  - `web/src/lib/admin/statistiques.ts`
  - `web/src/components/admin/TableauDeBordAdmin.tsx`
  - `web/src/lib/utilisateurs/regles.ts` (`formuleAffichee`)
  - `web/src/lib/utilisateurs/data.ts`
  - `web/src/components/admin/utilisateurs/ListeComptes.tsx`
- Test :
  - `web/tests/db/paiements-equipe.test.ts` (cas ajoutés)
  - le test existant du tableau de bord admin
  - le test existant de `ListeComptes`

**Interfaces :**
- Produces (SQL, dans 0051) :
  - `statistiques_back_office(p_maintenant timestamptz default now())` : la définition de 0031, plus les clés :
    - `abonnes_actifs`, `etudiants` (comptes au rôle étudiant) ;
    - `ca_mois`, `ca_total` ;
    - `ca_par_mois` : `[{mois:'2026-06', montant}]`, les 6 derniers mois en heure du Bénin, mois sans paiement compris ;
    - `revenus_par_formule` : `[{code, nom, montant, nombre}]`, dans l'ordre des formules.
  - `comptes_equipe(…)` (dernière définition, à retrouver par `grep -l "function public.comptes_equipe"`) : chaque ligne gagne `formule` (nom de l'abonnement en cours, ou null).
- Produces (TS) :
  - `StatistiquesBackOffice` gagne `abonnesActifs`, `etudiants`, `caMois`, `caTotal`, `caParMois: { mois: string; montant: number }[]` et `revenusParFormule: { code: string; nom: string; montant: number; nombre: number }[]`. Les clés absentes valent 0 ou `[]`.
  - Tuiles :
    - « Utilisateurs payants » : `abonnesActifs`, avec « abonnements actifs » ;
    - « Taux de conversion » : `Math.round(100 * abonnes / etudiants)` + « % », avec « des étudiants ont un abonnement actif » (« — » sans étudiant) ;
    - « Chiffre d’affaires » (sans `lot`) : « Ce mois » et « Au total » en FCFA, puis 6 barres CSS (libellé court du mois, `aria-label` « juin 2026 : 45 000 FCFA ») ;
    - « Revenus par formule » : une ligne par formule, avec `Progress`, le montant et « N abonnements ».
  - `formuleAffichee(roles: Role[], formule: string | null): string` : le nom si la personne est abonnée ; « Gratuit » pour un étudiant ; « — » sinon. `ListeComptes` affiche le nom avec `Tag` `nouveau`, et « Gratuit » avec `enAttente`.

- [ ] **Step 1 : écrire les tests qui échouent.**
  - Base : deux paiements réussis (Standard 15 000 ce mois-ci, Basique 9 000 il y a deux mois), qui donnent `ca_mois` 15 000, `ca_total` 24 000, 6 entrées dans `ca_par_mois`, `revenus_par_formule`, `abonnes_actifs` et la `formule` de `comptes_equipe`.
  - Écran : valeurs des tuiles, plus de « Disponible au lot 2 », barres, et une colonne « Formule » qui montre « Standard ».
- [ ] **Step 2 : lancer.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire.**
- [ ] **Step 4 : relancer.** Attendu : RÉUSSITE.
- [ ] **Step 5 : commit.** `feat(admin): tuiles de revenus et formule des comptes`

### Task 12 : Migration 0052, rappels d'expiration, puis le guide

**Files :**
- Create : `web/supabase/migrations/0052_rappels_abonnements.sql`
- Modify :
  - `web/.env.example` (bloc commenté des trois variables)
  - `docs/guides/ce-qui-te-revient.md` (section 56)
- Test : `web/tests/db/rappels-abonnements.test.ts`

**Interfaces :**
- Produces (SQL) :
  - `date_longue(p timestamptz) returns text` : « 14 mars 2027 », « 1er mai 2027 », à l'heure du Bénin.
  - `traiter_abonnements() returns integer` : verrou `pg_try_advisory_xact_lock(hashtext('etudium.traiter_abonnements'))`, puis :
    1. **Nettoyage** : les paiements `en_attente` dont `coalesce(essai_le, cree_le) < now() - 1 hour` passent à `expire`.
    2. **Rappels** : seulement sur le dernier abonnement non annulé de chaque compte (aucun abonnement non annulé du même compte avec une `fin` plus tardive). Chaque rappel est réservé par `update … where rappel_x_le is null returning`, puis envoyé par `notifier(…, 'expiration_renouvellement', titre, texte, '/abonnement/souscrire')`.
       - **7 jours** (`fin - 7 days <= now() < fin - 1 day`) :
         - titre « Votre abonnement Standard se termine dans 7 jours » ;
         - texte « Il prend fin le 14 mars 2027. Prolongez-le pour garder l’accès à tout. ».
       - **la veille** (`fin - 1 day <= now() < fin`) :
         - titre « Votre abonnement Standard se termine demain » ;
         - même texte ;
         - pose aussi `rappel_7j_le`.
       - **expiré** (`fin <= now() < fin + 3 days`) :
         - titre « Votre abonnement Standard a expiré » ;
         - texte « Vos formations payantes sont verrouillées. Votre progression et vos certificats restent sur votre compte. » ;
         - pose aussi les deux autres.
    Elle renvoie le nombre de rappels envoyés. Elle est fermée à tous.
  - `rappels_sessions()` (0041) : appelle aussi `traiter_abonnements()`.
  - Tâche cron : `cron.schedule('etudium-abonnements', '*/15 * * * *', 'select public.traiter_abonnements()')`, sur le modèle de 0041.
- Guide, section 56 « Lot 2 : abonnements et paiement Payiz » :
  1. Créer le compte sur payiz.app (mode test), activer le **paiement direct** (sans lui, Payiz répond `direct_not_enabled`), puis copier la clé `sk_test_…` dans `PAYIZ_CLE_SECRETE`.
  2. Générer `PAIEMENT_JETON` avec `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, le coller, puis relancer `npm run dev`.
  3. Appliquer 0049, 0050, 0051 et 0052 dans l'ordre.
  4. Au back-office : fixer les prix, puis « Activer les paiements ».
  5. Tester avec les numéros du simulateur (`01 42 00 00 00` MTN, `01 55 00 00 00` Moov), en se rappelant que **les deux derniers chiffres décident** du résultat :
     - `00` : succès ;
     - `01` : solde insuffisant ;
     - `03` : délai dépassé ;
     - `04` : succès après 2 min ;
     - `06` : succès sans notification.
  6. Vérifier dans le tableau de bord Payiz qu'un paiement de 15 000 apparaît bien comme 15 000 F CFA (unité de `amount`).
  7. Simuler une expiration avec le SQL suivant, en remplaçant l'adresse :
     ```sql
     update public.abonnements set debut = debut - interval '7 months', fin = fin - interval '7 months'
     where profil_id = (select id from auth.users where email = 'ton-adresse-de-test');
     ```
  8. Une fois le site en ligne : déclarer `https://<domaine>/api/paiements/payiz` dans Payiz (Développeurs › Webhooks) avec les événements `payment.succeeded`, `payment.attempt_failed`, `payment.expired` et `payment.canceled`, coller le secret dans `PAYIZ_SECRET_WEBHOOK`, et passer à `sk_live_…` après la vérification du compte.

  Ajouter la ligne de la section 56 au récapitulatif du guide, s'il en a un.

- [ ] **Step 1 : écrire le test qui échoue.** Banc jusqu'à 0052, avec des abonnements insérés par `abonner()`.
  - Fin à `now() + 6 days 23 hours` : un rappel « 7 jours ». Un second appel n'en envoie pas d'autre.
  - Fin à `now() + 20 hours` : seulement « demain ».
  - Fin à `now() - 1 hour` : seulement « a expiré ».
  - Fin à `now() + 6 days`, suivie d'un autre abonnement : aucun rappel.
  - Abonnement annulé : aucun rappel.
  - Un paiement `en_attente` de 2 heures passe à `expire`. Un paiement d'une minute ne change pas.
  - `rappels_sessions()` envoie aussi les rappels d'abonnement.
- [ ] **Step 2 : lancer.** Attendu : ÉCHEC.
- [ ] **Step 3 : écrire la migration, le guide et `.env.example`.** Le bloc de `.env.example` reprend le modèle de celui de la modération : « Lues par le serveur seulement : jamais de préfixe NEXT_PUBLIC_ ». Les valeurs restent vides.
- [ ] **Step 4 : relancer**, puis la suite complète : `npx tsc --noEmit && npx eslint . && npx vitest run`. Attendu : tout passe.
- [ ] **Step 5 : commit.** `feat(abonnements): migration 0052, rappels d'expiration ; guide section 56`
