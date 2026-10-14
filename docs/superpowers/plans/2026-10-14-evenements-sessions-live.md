# Événements et sessions live : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** le formateur et l'équipe programment des sessions live (Meet, Zoom), tout compte connecté les voit, s'y inscrit et les rejoint 10 min avant ; nouvelles sessions, changements, annulations et rappels arrivent dans la cloche.

**Architecture :**
- **Migration 0018.** Deux tables fermées aux comptes (`sessions_live`, `inscriptions_sessions`) et des fonctions `security definer` : celles de l'animateur et de l'équipe (tâche 1), celles de tout compte connecté (tâche 2).
  - Le lien n'est livré que dans sa fenêtre.
  - Les notifications passent par `notifier`. Une option de `notifier` sert aux rappels, que la cloche demande en se chargeant.
- **Application :**
  - `lib/sessions/` : types, dates en français, fichier `.ics`, lectures, actions ;
  - `components/sessions/` : les composants, partagés par le back-office et l'espace formateur comme l'éditeur de formation (`EspaceEdition`) ;
  - les pages et les cartes des tableaux de bord.

**Tech Stack :** Next.js 16.4, Supabase (SQL, RLS), PGlite (`tests/db/banc.ts`), Vitest + jsdom.

**Spec :** `docs/superpowers/specs/2026-10-14-evenements-sessions-live-design.md`

## Global Constraints

- **Textes :** en français, avec l'apostrophe typographique (’), **neutres** : « Inscription confirmée », « 128 inscriptions », « personnes inscrites ». Les titres et textes des notifications sont exactement ceux du §3 de la spec.
- **Migration** `web/supabase/migrations/0018_sessions_live.sql` : rejouable, après la 0017, avec l'en-tête habituel (« rejouer celle-ci après toute ancienne migration rejouée »).
- **Avant la 0018 :**
  - les pages Événements et Sessions live (formateur, back-office) affichent « Appliquez la migration 0018 (guide « Ce qui te revient », section 23). » ;
  - les cartes « Prochaine session live » restent comme aujourd'hui ;
  - la cloche marche sans les rappels.
- **Aucune fonction n'accepte l'heure du client.** La fenêtre du lien, les rappels et les limites de date utilisent toujours `now()`. Les tests posent leurs sessions par rapport à `now()`.
- **Nombres fixés :**
  - fenêtre du lien : de **10 min avant** le début à la fin (début + durée) ;
  - rappels : **24 h** et **1 h** avant ;
  - durée : de **30 à 240 min**, par pas de **15**, **60** par défaut ;
  - début : au moins **10 min** dans le futur, au plus **1 an** ;
  - titre **120**, description **1 000**, lien **500**.
- **Heure du Bénin** (UTC+1, `Africa/Porto-Novo`) partout : dates affichées, formulaires, textes des notifications.
- **Jamais d'adresse e-mail** dans ce qui est livré : les inscrits apparaissent par prénom et nom (fiche de session) ou par leurs initiales (carte de l'accueil).
- **Pages :** `requireSpace("formateur")` ou `requireSpace("admin")` dans chaque `page.tsx` des espaces réservés ; `<SessionGuard` pour Événements.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Une session vers minuit au Bénin** (par exemple 0 h 30 le 25, soit 23 h 30 UTC le 24) :
   - la carte, la notification et le formulaire de modification disent le 25 ;
   - « Demain » ou « Aujourd’hui » suivent le jour du Bénin.
   → tests des tâches 1 (`quand_session`) et 3 (`dateSession`, `champsDepuis`).
2. **Le lien qui fuit.** Avant la fenêtre, aucune lecture d'un compte ne le contient :
   - ni `sessions_live` ;
   - ni `prochaine_session` (carte de l'accueil) ;
   - ni `session_detail` pour un compte qui n'est ni l'animateur ni l'équipe.
   → test de la tâche 2.
3. **Une session modifiée.**
   - Changer seulement le titre ne prévient personne et ne remet pas les rappels à zéro.
   - Changer l'heure prévient les inscrits et remet les rappels à zéro.
   - Une session en cours se modifie encore (corriger le lien), une session terminée non.
   → test de la tâche 1.
4. **« Ajouter à mon agenda » avec un titre qui contient `,` `;` `\` ou un retour à la ligne.** Le fichier reste valide (caractères échappés) et l'heure est en UTC (`…T140000Z` pour 15 h 00 au Bénin). → test de la tâche 3.
5. **Une page Événements laissée ouverte avant le live.** Le bouton **Rejoindre** apparaît à l'ouverture de la fenêtre, sans recharger la page. → test de la tâche 4.

---

### Task 1 : Migration 0018 : les sessions, l'animateur et l'équipe

**Files :**
- Create : `web/supabase/migrations/0018_sessions_live.sql`
- Test : `web/tests/db/sessions-live.test.ts`. Banc : la liste de `tests/db/role-unique.test.ts`, plus la 0017 et la 0018.

**Interfaces :**
- Produces (SQL) :
  - **Tables :**
    - `public.sessions_live` : `id uuid`, `titre`, `description text default ''`, `debut timestamptz`, `duree_minutes integer default 60`, `lien`, `parcours_id`, `formateur_id`, `statut text default 'programmee'` (`programmee` ou `annulee`), `annulee_le`, `cree_par`, `cree_le`, `modifie_le`, avec les contraintes du §2 de la spec ;
    - `public.inscriptions_sessions (session_id, profil_id, inscrit_le, rappel_veille_le, rappel_heure_le)`, clé `(session_id, profil_id)`, en cascade ;
    - RLS active sur les deux, `revoke all` à `anon` et `authenticated`.
  - **`public.plateforme_session(p_lien text) returns text`** (immutable) : « Google Meet », « Zoom », sinon « En ligne ».
  - **`public.quand_session(p_debut timestamptz) returns text`** (immutable) : « samedi 24 octobre à 15 h 00 », à l'heure du Bénin. Jours et mois viennent de tableaux en français, jamais de la langue du serveur.
  - **`public.notifier(p_destinataires uuid[], p_categorie text, p_titre text, p_texte text, p_lien text, p_auteur_inclus boolean) returns integer`** :
    - nouvelle version à 6 paramètres ; avec `p_auteur_inclus`, le compte qui demande n'est pas écarté ;
    - la version à 5 paramètres (0016) la rappelle avec `false` ;
    - aucune des deux n'est exécutable par les comptes.
  - **`public.creer_session(p_titre text, p_description text, p_debut timestamptz, p_duree integer, p_lien text, p_parcours uuid, p_formateur uuid) returns uuid`** :
    - réservée à l'équipe (`equipe_contenus()`) ou à un formateur (`ma_fiche_formateur()`) ;
    - pour un formateur, `formateur_id` est toujours sa fiche ; l'équipe garde `p_formateur` (nul : Équipe Étudium) ;
    - textes nettoyés des espaces, contrôles du §2 ;
    - puis la notification « Nouvelle session live » à tous les profils, sauf l'auteur.
  - **`public.modifier_session(p_session uuid, p_titre text, p_description text, p_debut timestamptz, p_duree integer, p_lien text, p_parcours uuid, p_formateur uuid) returns void`** :
    - mêmes droits ; le formateur, sur les sessions de sa fiche seulement ;
    - refusée pour une session terminée ou annulée ;
    - le début n'est revérifié (10 min dans le futur) que s'il change ;
    - si le début, la durée ou le lien changent : notification « Session live modifiée » aux inscrits ;
    - si le début change : `rappel_veille_le` et `rappel_heure_le` remis à nul.
  - **`public.annuler_session(p_session uuid) returns void`** : mêmes droits ; refusée pour une session terminée ; `statut = 'annulee'`, `annulee_le = now()`, puis notification « Session live annulée » aux inscrits.
  - **`public.sessions_animees() returns jsonb`** (formateur) et **`public.sessions_equipe() returns jsonb`** (équipe) :
    - rendent `{"a_venir": [...], "passees": [...]}` ;
    - à venir : celles qui ne sont pas terminées, annulées comprises, du plus proche au plus lointain ;
    - passées : du plus récent au plus ancien, 50 au plus ;
    - chaque ligne : `{id, titre, debut, duree_minutes, plateforme, statut, inscriptions, parcours: {nom_court, couleur} | null, animateur}`, où `animateur` vaut le nom de la fiche ou « Équipe Étudium ».
  - **`public.session_detail(p_session uuid) returns jsonb`** :
    - pour l'animateur ou l'équipe : `{id, titre, description, debut, duree_minutes, lien, plateforme, parcours: {id, nom_court, couleur} | null, formateur_id, animateur, statut, annulee_le, inscrits: [{prenom, nom}]}`, inscrits par date d'inscription ;
    - pour un autre compte, ou une session inconnue : null.
  - **Messages de refus** (P0001 ; droits : 42501) :
    - « Accès réservé aux formateurs et à l’équipe. » ;
    - « Cette session n’est pas la vôtre. » ;
    - « Une session terminée ne se modifie plus. » ;
    - « Cette session est annulée. » ;
    - « Choisissez une date au moins 10 minutes dans le futur. » ;
    - « Choisissez une date dans l’année qui vient. » ;
    - « Écrivez un titre (120 caractères au plus). » ;
    - « La description dépasse 1 000 caractères. » ;
    - « Choisissez une durée de 30 minutes à 4 heures, par quarts d’heure. » ;
    - « Le lien doit commencer par https:// ».

- [ ] **Step 1 : Tests qui échouent.**
  - Préparation :
    - un formateur `F` avec sa fiche (`changer_role`), un formateur `G`, un admin `A`, des étudiants `E1` et `E2` ;
    - `E2` a coupé « Sessions live » ;
    - un parcours `P`.
  - Helper `session(debutDans: string, lien = "https://meet.google.com/abc-defg-hij")` : insère une session directement en superutilisateur, pour les débuts proches ou passés.

```ts
it("plateforme_session : Google Meet, Zoom (sous-domaine compris), sinon En ligne", …)
it("quand_session : « samedi 24 octobre à 15 h 00 » ; 23 h 30 UTC le 24 est « dimanche 25 octobre à 0 h 30 »", …)
it("un formateur crée : sa fiche est l'animateur même s'il en donne une autre ; « Nouvelle session live : … » à tous sauf lui et E2", …)
it("l'équipe crée avec l'animateur choisi, ou Équipe Étudium", …)
it("refus : étudiant ; date dans 9 min ou dans plus d'un an ; durée 20 ou 50 ; lien http ; titre vide", …)
it("modifier le titre : personne n'est prévenu, rappels gardés ; modifier l'heure : les inscrits seulement, rappels remis à zéro", …)
it("une session en cours se modifie (lien) ; terminée : refus ; G sur la session de F : refus", …)
it("annuler : « Session live annulée » aux inscrits ; annuler une session terminée : refus", …)
it("sessions_animees et sessions_equipe : à venir et passées, inscriptions, animateur ; aucun « @ » dans le résultat", …)
it("session_detail : lien et inscrits pour l'animateur et l'équipe ; null pour un étudiant ou un autre formateur", …)
it("notifier : la version à 5 paramètres écarte toujours l'auteur ; avec p_auteur_inclus, non", …)
it("la migration est rejouable", …)
```

- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/db/sessions-live.test.ts` → FAIL (migration absente).
- [ ] **Step 3 : Écrire** les tables, `plateforme_session`, `quand_session`, `notifier` à 6 paramètres, et les fonctions de l'animateur et de l'équipe.
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS.
- [ ] **Step 5 : Commit** : `feat(sessions): sessions live, côté animateur et équipe (migration 0018)`

### Task 2 : Migration 0018 : inscriptions, lecture et rappels

**Files :** Modify `web/supabase/migrations/0018_sessions_live.sql` ; Test `web/tests/db/sessions-live.test.ts` (nouveau `describe`).

**Interfaces :**
- Consumes : tables, `plateforme_session`, `quand_session`, `notifier` (tâche 1).
- Produces (SQL ; tout compte connecté non suspendu, sinon refus `42501`) :
  - **`public.sessions_live(p_vue text) returns jsonb`** :
    - `p_vue` vaut `a_venir`, `inscriptions` ou `passees` (une autre valeur vaut `a_venir`) ;
    - rend des cartes `{id, titre, description, debut, duree_minutes, plateforme, lien, parcours: {nom_court, couleur} | null, animateur, inscriptions, inscrit, statut}` ;
    - `lien` est nul hors de la fenêtre, sauf pour l'animateur et l'équipe ;
    - les vues suivent le §4 de la spec : à venir = programmées pas terminées ; inscriptions = les siennes pas terminées, annulées comprises ; passées = les siennes terminées et programmées, 50 au plus.
  - **`public.prochaine_session() returns jsonb`** :
    - la plus proche de ses inscriptions programmées pas terminées, sinon la prochaine session programmée ;
    - même carte, plus `initiales` : celles des 3 premiers inscrits ;
    - null sans session.
  - **`public.sinscrire_session(p_session uuid) returns void`** :
    - refus « Les inscriptions à cette session sont closes. » si la session est annulée ou terminée ;
    - une seconde inscription ne change rien ;
    - un rappel dont le moment est déjà passé est marqué comme envoyé.
  - **`public.se_desinscrire_session(p_session uuid) returns void`** : refus « La session a commencé. » après le début.
  - **`public.rappels_sessions() returns integer`** : les rappels dus au compte qui demande, sur ses sessions programmées.
    - Veille, si `rappel_veille_le` et `rappel_heure_le` sont nuls et que le début est dans moins de 24 h et plus d'1 h :
      - titre « Session live demain », ou « Session live aujourd’hui » si le début tombe le même jour au Bénin ;
      - texte « <titre>, à 15 h 00. ».
    - 1 h avant, si `rappel_heure_le` est nul et que le début est dans moins d'1 h :
      - titre « Session live dans moins d’une heure » ;
      - texte « <titre>, à 15 h 00. Le lien s’ouvre 10 min avant. » ;
      - pose aussi `rappel_veille_le`.
    - Les deux par `notifier(…, true)`, avec le lien `/evenements`. Rend le nombre de rappels créés.

- [ ] **Step 1 : Tests qui échouent**

```ts
it("le lien : absent à 11 min du début, présent à 9 min et pendant, absent après la fin ; toujours là pour l'animateur et l'équipe", …)
it("prochaine_session et session_detail ne livrent pas le lien à un étudiant avant la fenêtre", …)
it("vues : à venir (sans les annulées), mes inscriptions (avec « annulee »), passées ; inscriptions et inscrit", …)
it("prochaine_session : la plus proche de mes inscriptions, sinon la prochaine ; 3 initiales ; null sans session", …)
it("s'inscrire deux fois ne compte qu'une ; session annulée ou terminée : « Les inscriptions à cette session sont closes. »", …)
it("se désinscrire avant le début ; après : « La session a commencé. »", …)
it("rappels : la veille (23 h avant) puis 1 h avant (50 min), une seule fois chacun, à l'inscrit seulement", …)
it("rappel « aujourd’hui » ou « demain » selon le jour au Bénin", …)
it("s'inscrire 30 min avant : aucun rappel ; 5 h avant : seulement celui d'1 h, plus tard", …)
it("compte suspendu : refus ; visiteur : refus", …)
```

- [ ] **Step 2 : Lancer, ça échoue** → FAIL.
- [ ] **Step 3 : Écrire.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS.
- [ ] **Step 5 : Commit** : `feat(sessions): inscriptions, lecture et rappels des sessions live (migration 0018)`

### Task 3 : Règles, dates, agenda, lectures et actions

**Files :**
- Create (sous `web/src/lib/sessions/`) : `types.ts`, `regles.ts`, `agenda.ts`, `data.ts`, `actions.ts` (`"use server"`).
- Modify : `web/src/lib/notifications/actions.ts` (`chargerCloche` demande d'abord les rappels).
- Test (sous `web/tests/sessions/`) : `regles.test.ts`, `agenda.test.ts`, `data.test.ts`, `actions.test.ts`. Aussi `web/tests/notifications/actions.test.ts`.

**Interfaces :**
- Consumes : les fonctions SQL des tâches 1 et 2 ; `Lecture<T>`, `estFonctionAbsente`, `exigerEditeur`, `SESSION_EXPIREE`, `getShellUser`, `EspaceEdition`.
- Produces :
  - **`types.ts`** :
    - `VueSessions = "a_venir" | "inscriptions" | "passees"` ;
    - `SessionCarte = { id; titre; description; debut: string; dureeMinutes: number; plateforme: string; lien: string | null; parcours: { nomCourt: string; couleur: string } | null; animateur: string; inscriptions: number; inscrit: boolean; statut: "programmee" | "annulee" }` ;
    - `ProchaineSession = SessionCarte & { initiales: string[] }` ;
    - `LigneSessionEdition = { id; titre; debut; dureeMinutes; plateforme; statut; inscriptions; parcours; animateur }` ;
    - `ListeSessionsEdition = { aVenir: LigneSessionEdition[]; passees: LigneSessionEdition[] }` ;
    - `SessionDetail = { id; titre; description; debut; dureeMinutes; plateforme; lien: string | null; parcours: { id: string; nomCourt: string; couleur: string } | null; formateurId: string | null; animateur; statut; annuleeLe: string | null; inscrits: { prenom: string; nom: string }[] }` ;
    - `DonneesSession = { titre; description; date: string; heure: string; dureeMinutes: number; lien; parcoursId: string | null; formateurId: string | null }`.
  - **`regles.ts`**, fonctions pures, à l'heure du Bénin :
    - `FENETRE_LIEN_MIN = 10` ; `DUREES` : les minutes de 30 à 240 par pas de 15, avec `dureeLisible(minutes)` → « 30 min », « 1 h », « 1 h 15 » ;
    - `jourCarte(iso) → { mois: "OCT."; jour: "24" }` ;
    - `dateSession(iso) → "Samedi 24 octobre · 15 h 00"` ;
    - `phraseSession(iso) → "samedi 24 octobre à 15 h 00"` ;
    - `dansJours(iso, maintenant) → "Aujourd’hui" | "Demain" | "Dans 2 jours"` ;
    - `finSession(s) → Date` ; `enCours(s, maintenant)` ; `terminee(s, maintenant)` ;
    - `debutDepuis(date: "2026-10-24", heure: "15:00") → "2026-10-24T15:00:00+01:00" | null` ;
    - `champsDepuis(iso) → { date, heure }` ;
    - `refusSession(d: DonneesSession, maintenant): string | null` : mêmes messages et mêmes limites que la base ;
    - `libelleInscriptions(n)` → « 1 inscription », « 128 inscriptions ».
  - **`agenda.ts`** :
    - `fichierIcs(s: { id; titre; description; debut; dureeMinutes }, adresse: string, maintenant: Date): string` ;
    - lignes séparées par CRLF ;
    - `UID:<id>@etudium`, `DTSTART` et `DTEND` en UTC (`YYYYMMDDTHHMMSSZ`), `SUMMARY`, `DESCRIPTION`, `URL` ;
    - `\`, `;`, `,` et les retours à la ligne échappés.
  - **`data.ts`** (fonction absente → `migrationAbsente` ; autre erreur relancée) :
    - `lireSessions(vue): Promise<Lecture<SessionCarte[]>>` ;
    - `lireProchaineSession(): Promise<Lecture<ProchaineSession | null>>` ;
    - `lireSessionsAnimees(): Promise<Lecture<ListeSessionsEdition>>` ;
    - `lireSessionsEquipe(): Promise<Lecture<ListeSessionsEdition>>` ;
    - `lireSessionDetail(id): Promise<Lecture<SessionDetail | null>>` : un identifiant mal formé rend null sans appel.
  - **`actions.ts`** :
    - `chargerSessions(vue): Promise<{ ok: true; sessions: SessionCarte[] } | { ok: false; message: string }>` ;
    - `sinscrire(id)` et `seDesinscrire(id)` : `Promise<{ ok: boolean; message?: string }>` ;
    - `creerSession(d: DonneesSession): Promise<{ ok: true; id: string } | { ok: false; message: string }>` ;
    - `modifierSession(id, d): Promise<{ ok: boolean; message?: string }>` ;
    - `annulerSession(id): Promise<{ ok: boolean; message?: string }>` ;
    - celles de l'éditeur sont gardées par `exigerEditeur`, et `refusSession` est vérifié avant tout appel ;
    - un message `P0001` est rendu tel quel ; une fonction absente rend le message de la 0018 ;
    - `refresh()` après chaque succès.
  - **`chargerCloche`** appelle `rappels_sessions` avant de lire. Une erreur sur cet appel (fonction absente comprise) est ignorée.

- [ ] **Step 1 : Tests qui échouent**
  - `regles` :
    - `dateSession("2026-10-24T14:00:00Z")` → `Samedi 24 octobre · 15 h 00` ;
    - `jourCarte("2026-10-24T23:30:00Z")` → `{ mois: "OCT.", jour: "25" }` ;
    - `dansJours` : aujourd'hui, demain, dans 2 jours, à minuit au Bénin ;
    - `debutDepuis` ↔ `champsDepuis` en aller-retour ; `debutDepuis("", "15:00")` → null ;
    - `refusSession` : chaque message ; `DUREES` (de 30 à 240) ; `dureeLisible(75)` → « 1 h 15 » ;
    - `libelleInscriptions(1)` → « 1 inscription ».
  - `agenda` :
    - `DTSTART:20261024T140000Z`, `DTEND:20261024T150000Z` ;
    - `SUMMARY:Excel\, avancé\; niveau 2` ;
    - une description sur deux lignes → `\n` ;
    - lignes séparées par `\r\n`.
  - `data` : conversion de chaque lecture ; `migrationAbsente` ; identifiant mal formé.
  - `actions` :
    - refus d'un étudiant pour créer (`Accès réservé aux formateurs et à l’équipe.`), sans appel ;
    - `refusSession` avant tout appel ;
    - paramètres transmis (`p_debut` en ISO +01:00) ;
    - message `P0001` ; message de la 0018 ; `refresh`.
  - `notifications/actions` : `chargerCloche` appelle `rappels_sessions` puis `mes_notifications`, et lit même si les rappels échouent.
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/sessions tests/notifications` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe**, puis `npx tsc --noEmit`.
- [ ] **Step 5 : Commit** : `feat(sessions): dates, agenda, lectures et actions ; la cloche demande les rappels`

### Task 4 : La page Événements et la carte de l'accueil

**Files :**
- Create (sous `web/src/components/sessions/`) : `CarteSession.tsx` (client), `FenetreInscription.tsx` (client), `PageEvenements.tsx` (client), `ContenuEvenements.tsx` (serveur), `CarteProchaineSession.tsx` (client).
- Modify :
  - `web/src/app/(app)/(etudiant)/evenements/page.tsx` (remplace la page à venir) ;
  - `web/src/lib/pages-a-venir.ts` (retirer `evenements`) ;
  - `web/src/app/(app)/(etudiant)/accueil/page.tsx` et `web/src/components/accueil/TableauDeBord.tsx` (la carte).
- Test : `web/tests/sessions/evenements.test.tsx`, `web/tests/accueil/` (la carte), `web/tests/layout/pages.test.tsx` et `session-guard.test.tsx` (verts).

**Interfaces :**
- Consumes : tâche 3 ; `SegmentedTabs`, `Dialog`, `Button`, `Tag`, `EmptyState`, `Avatar`, `Groupe`, `Banner`.
- Produces :
  - **`CarteSession({ session, maintenant, onInscrire, onDesinscrire, occupe })`**, la carte du design `NdEvenements` :
    - le bloc du jour (`jourCarte`) ;
    - l'étiquette du parcours, ou « Tous les parcours » ; « Session live » ; `libelleInscriptions` ;
    - le titre ; `dateSession` ; la plateforme ; l'animateur ;
    - la description, sur deux lignes ;
    - les actions :
      - **Je m’inscris** ; inscrit : `Tag` « Inscription confirmée » et **Se désinscrire** (avant le début) ;
      - **Rejoindre** (lien `target="_blank" rel="noopener noreferrer"`) quand `lien` est présent et la session pas terminée ;
      - `Tag` « En cours » pendant la session ; `Tag` « Annulée » si annulée, sans aucun bouton.
  - **`FenetreInscription({ session, ouverte, onOuverteChange })`** :
    - titre « Inscription confirmée » ;
    - texte « <titre>, <phraseSession>, sur <plateforme>. Un rappel vous sera envoyé la veille et 1 h avant. » ;
    - **Ajouter à mon agenda** télécharge `session.ics` (`fichierIcs`, adresse `<origine>/evenements`) ;
    - **Fermer**.
  - **`PageEvenements({ initial: SessionCarte[] })`** :
    - en-tête de la spec, §4 ;
    - `SegmentedTabs` « À venir », « Mes inscriptions », « Passées » : changer d'onglet appelle `chargerSessions` ;
    - s'inscrire ouvre la fenêtre ;
    - les trois états vides de la spec ;
    - si une carte attend sa fenêtre dans moins d'une heure, une minuterie relit l'onglet à `debut − 10 min`.
  - **`ContenuEvenements()`** (serveur) : lit « À venir » ; avant la 0018, le bandeau.
  - **`CarteProchaineSession({ session: ProchaineSession })`**, la carte « Prochaine session live » de `NdAccueil` :
    - lien « Événements » ;
    - jusqu'à 3 initiales, puis « 128 inscriptions » ;
    - **Je m’inscris à la session**, ou « Inscription confirmée » ; **Rejoindre** dans la fenêtre.
    - `TableauDeBord` la reçoit par une prop `session?: ProchaineSession | null`, dans la colonne de droite, sous « À faire ». Le compte qui n'a rien commencé l'a aussi, sous l'invitation.

- [ ] **Step 1 : Tests qui échouent** (avec `vi.useFakeTimers({ toFake: ["Date"] })` quand l'heure compte)
  - « la carte du design : OCT. 24, Académique, Session live, 128 inscriptions, Samedi 24 octobre · 15 h 00, Google Meet, animateur » ;
  - « Je m’inscris : sinscrire(id), la fenêtre « Inscription confirmée », Ajouter à mon agenda télécharge un .ics » ;
  - « inscrit : Inscription confirmée et Se désinscrire ; seDesinscrire(id) » ;
  - « Rejoindre seulement avec un lien, ouvert dans un nouvel onglet ; En cours pendant ; Annulée sans bouton » ;
  - « onglets : chargerSessions("inscriptions"), chargerSessions("passees") ; les trois états vides » ;
  - « page ouverte 15 min avant : à 10 min, l'onglet est relu et Rejoindre apparaît » (minuterie simulée) ;
  - « avant la 0018 : le bandeau » ;
  - « accueil : la carte Prochaine session live, 3 initiales, Je m’inscris à la session ; sans session, pas de carte ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/sessions tests/accueil tests/layout` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : même commande → PASS.
- [ ] **Step 5 : Commit** : `feat(sessions): page Événements et carte de l'accueil`

### Task 5 : Sessions live dans l'espace formateur

**Files :**
- Create (sous `web/src/components/sessions/`) : `ListeSessionsEdition.tsx` (serveur), `FormulaireSession.tsx` (client), `FicheSession.tsx` (serveur), `AnnulerSession.tsx` (client), `cadre.tsx` (bandeau de la 0018, `baseSessions(espace)`).
- Create (sous `web/src/app/(app)/formateur/sessions/`) : `nouvelle/page.tsx`, `[id]/page.tsx`, `[id]/modifier/page.tsx`.
- Modify :
  - `web/src/app/(app)/formateur/sessions/page.tsx` (remplace la page à venir) ;
  - `web/src/lib/pages-a-venir.ts` (retirer `formateur/sessions`) ;
  - `web/src/components/formateur/TableauDeBordFormateur.tsx` (la carte).
- Test : `web/tests/sessions/edition.test.tsx`, `web/tests/formateur/tableau-de-bord.test.tsx`.

**Interfaces :**
- Consumes : tâche 3 ; `EspaceEdition`, `PageAdmin`, `TableauListe`, `Section`, `Field`, `TextInput`, `Textarea`, `Select`, `ConfirmDialog`, `listParcours`, `listFormateurs` (`lib/admin/data`).
- Produces :
  - `baseSessions(espace: EspaceEdition)` → `/formateur/sessions` ou `/admin/sessions`.
  - **`ListeSessionsEdition({ espace, liste: ListeSessionsEdition })`** :
    - le bouton **Nouvelle session** ;
    - les sections « À venir » et « Passées » ;
    - `TableauListe` (`nom` « Sessions à venir » ou « Sessions passées ») : Date, Titre (lien vers la fiche), Plateforme, Inscriptions, État (« Programmée », « Annulée », « En cours ») ; plus Animateur au back-office ;
    - vide : « Aucune session programmée. ».
  - **`FormulaireSession({ espace, parcours, formateurs?, initial? })`** :
    - les champs Titre (120), Description (1 000), Date (`type="date"`), Heure (`type="time"`), Durée (`Select` de `DUREES`), Lien (`type="url"`, « https://meet.google.com/… »), Parcours (« Tous les parcours » puis les parcours) ;
    - au back-office, en plus : Animateur (« Équipe Étudium » puis les fiches) ;
    - **Programmer la session**, ou **Enregistrer** en modification ;
    - les erreurs de `refusSession` ou de la base sous le formulaire ;
    - en cas de succès : `router.push` vers la fiche.
  - **`FicheSession({ espace, id })`** :
    - introuvable → `notFound()` ;
    - les informations, le lien en clair, la Section « Inscriptions » (prénom et nom, ou « Aucune inscription pour l’instant. ») ;
    - **Modifier**, absent si terminée ou annulée ; `AnnulerSession`.
  - **`AnnulerSession({ id, inscriptions })`** :
    - `ConfirmDialog` « Annuler cette session ? » · « Les <N> personnes inscrites seront prévenues. Elle ne pourra pas être reprogrammée. » (« Personne n’est encore inscrit. » à zéro) ;
    - bouton « Annuler la session », ton danger.
  - **Carte du tableau de bord du formateur** :
    - elle lit `lireSessionsAnimees()` et prend la prochaine des « à venir » programmées, puis `lireSessionDetail` de celle-ci pour ses inscrits ;
    - elle montre `dansJours`, le titre, `dateSession`, la plateforme, jusqu'à 5 initiales (`initialesCompte`) puis « +N », et le lien « Voir la session » ;
    - sans session : « Aucune session programmée. » et **Nouvelle session** ;
    - avant la 0018 : la carte d'aujourd'hui.

- [ ] **Step 1 : Tests qui échouent**
  - « liste : à venir et passées, état, lien vers la fiche ; Nouvelle session » ;
  - « formulaire : les champs ; le formateur n'a pas d'Animateur ; Programmer la session appelle creerSession avec date, heure, durée ; refus affiché » ;
  - « modification : champs remplis depuis la session (heure du Bénin) ; Enregistrer appelle modifierSession » ;
  - « fiche : lien, inscrits (prénom nom, jamais d'e-mail), Modifier ; terminée : pas de Modifier ; Annuler la session avec le nombre de personnes inscrites » ;
  - « tableau de bord : Dans 2 jours, initiales, Voir la session ; sans session : Nouvelle session » ;
  - « avant la 0018 : le bandeau ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/sessions tests/formateur` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/sessions tests/formateur tests/layout` → PASS (`session-guard`, `pages` compris).
- [ ] **Step 5 : Commit** : `feat(sessions): sessions live de l'espace formateur`

### Task 6 : Sessions live au back-office

**Files :**
- Create (sous `web/src/app/(app)/admin/sessions/`) : `page.tsx`, `nouvelle/page.tsx`, `[id]/page.tsx`, `[id]/modifier/page.tsx`.
- Modify :
  - `web/src/lib/navigation.ts` (groupe Contenus : Parcours, Formateurs, Formations, Avis, **Sessions live** `/admin/sessions` `Video01Icon`) ;
  - `web/src/components/admin/TableauDeBordAdmin.tsx` et la page `/admin` (la tuile).
- Test : `web/tests/sessions/edition.test.tsx` (back-office), `web/tests/layout/menus-espaces.test.tsx`, `web/tests/admin/tableau-de-bord.test.tsx`.

**Interfaces :**
- Consumes : les composants de la tâche 5 avec `espace="admin"` ; `lireSessionsEquipe`, `listFormateurs`.
- Produces :
  - les pages du back-office ;
  - `TableauDeBordAdmin({ stats, sessionsAVenir?: number | null })` : la tuile « Sessions live à venir » affiche le nombre et « Programmées », ou « — » et « Disponible au lot 5 » si null.

- [ ] **Step 1 : Tests qui échouent**
  - « back-office : la liste a la colonne Animateur ; le formulaire propose Équipe Étudium et les fiches ; creerSession reçoit formateurId » ;
  - « le menu : Contenus contient Sessions live après Avis » ;
  - « la tuile : 3 Programmées ; null : — ».
- [ ] **Step 2 : Lancer, ça échoue.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/sessions tests/admin tests/layout` → PASS.
- [ ] **Step 5 : Commit** : `feat(admin): rubrique Sessions live et tuile du tableau de bord`

### Task 7 : Rendu et guide

- [ ] **Step 1 :** `cd web && npm run lint && npx tsc --noEmit && npm run build` → succès.
- [ ] **Step 2 : Mesurer à 1440, 390 et 320 px** des rendus statiques, temporaires et jamais commités :
  - la page Événements, avec un titre de 120 caractères et une description de 1 000 ;
  - la carte de l'accueil ;
  - le formulaire ;
  - la fiche, avec 30 inscrits ;
  - la liste du back-office.
  - Attendu : la page ne s'élargit jamais ; les tableaux défilent dans leur cadre.
- [ ] **Step 3 : Section 23 du guide `docs/guides/ce-qui-te-revient.md`** :
  1. appliquer la 0018 après la 0017 ;
  2. avec le compte formateur : programmer une session dans 15 min (lien Meet), puis une autre demain. Les autres comptes reçoivent « Nouvelle session live » ;
  3. avec le compte étudiant : Événements, **Je m’inscris**, la fenêtre, **Ajouter à mon agenda** ; la carte de l'accueil ;
  4. à 10 min du début, **Rejoindre** apparaît (aussi pour un compte non inscrit) et ouvre Meet ;
  5. la cloche : le rappel d'1 h ;
  6. avec le formateur : modifier l'heure de la seconde session, puis l'annuler ; l'étudiant reçoit les deux notifications ; la session apparaît « Annulée » dans « Mes inscriptions » ;
  7. au back-office : Sessions live, une session « Équipe Étudium », la tuile du tableau de bord.
- [ ] **Step 4 :** `cd web && npx vitest run` → toute la suite passe.
- [ ] **Step 5 : Commit** : `docs: guide de validation des sessions live`
