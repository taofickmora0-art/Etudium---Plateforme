# Lot 5, étape A : la messagerie et la page Aide — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Une messagerie privée :
  - l'étudiant écrit au formateur d'une formation qu'il suit et à l'Équipe Étudium ;
  - le formateur écrit à ses étudiants ;
  - l'équipe répond à l'assistance.
- La page Aide refaite selon NdAide, avec le formulaire « Contacter l'équipe » qui écrit dans l'assistance.

**Architecture :**
- **Base (migration 0035)** : tables fermées `conversations` et `messages`, l'espace privé « messages », des fonctions `security definer` pour tout lire et écrire, et la notification « Nouveau message ».
- **Appli** :
  - `src/lib/messages/` : types, conversion, lecture, actions, fichiers ;
  - `src/components/messages/` : la page, sous trois adresses (`/messages`, `/formateur/messages`, `/admin/messages`), la conversation choisie par `?c=<id>` ;
  - la conversation ouverte se relit toutes les 10 s, la pastille du menu chaque minute.

**Tech Stack:** Next.js 16.4 (`cacheComponents`), React 19, Supabase (Postgres, Storage), Vitest (PGlite, jsdom).

**Spec :** `docs/superpowers/specs/2026-10-15-lot-5-fin-messagerie-push-desactivation-design.md`.
- Choix Q1 à Q7, et l'étape A.
- Design : NdMessages et NdAide. Les valeurs sont relevées dans `scratchpad/arbre-NdMessages.txt` et `scratchpad/arbre-NdAide.txt`, et reprises ici quand elles comptent.

## Global Constraints

- Tables fermées : RLS sans règle, `revoke all`. Seules les fonctions lisent et écrivent ; elles ont `set search_path = ''`.
- Avant la 0035, l'appli marche. Les pages Messages affichent « Appliquez la migration 0035 (guide « Ce qui te revient », section 42). » (`MIGRATION_MESSAGES`).
- Textes en français, vouvoiement, apostrophes typographiques `’`. Aucune donnée personnelle dans les adresses (`?c=` porte un identifiant opaque).
- Téléphone (moins de 640 px) : tailles compactes, `max-sm:`.
- Pièces jointes : les formats de `formats_rendu()` (0032) et de `FORMATS_RENDU`, 10 Mo au plus (10 485 760 octets).
- **Règle provisoire** : un étudiant suit une formation dès qu'il a une ligne dans `progression_lecons` sur une de ses leçons (comme `suiveurs_formation`).

## Review Focus

1. **Droits.** Un étudiant n'écrit pas à un formateur dont il ne suit aucune formation. Un formateur n'écrit pas à un inconnu. Un autre compte ne lit pas une conversation, même avec son identifiant. Un membre de l'équipe ne lit que l'assistance (Task 1).
2. **Fichiers.** Un fichier d'un autre dossier, déjà attaché, de plus de 10 Mo ou d'un format refusé est rejeté. Un fichier n'est lisible que par les participants (Task 1).
3. **Non-lus et notification.** Envoyer marque lu de son côté. Une seule notification non lue par conversation et par destinataire. Toute l'équipe est prévenue pour l'assistance (Task 1).
4. **Mise à jour.** Une erreur pendant la relecture toutes les 10 s ne vide pas la conversation affichée. Un message envoyé apparaît tout de suite, sans doublon à la relecture suivante (Task 3).
5. **Téléphone.** La liste, puis la conversation en plein écran avec un retour. La zone de saisie reste visible (Task 3).

---

### Task 1: Migration 0035 (base)

**Files:**
- Create: `web/supabase/migrations/0035_messagerie.sql`
- Test: `web/tests/db/messagerie.test.ts`

**Interfaces :**

- **Tables**
  - `conversations` :
    - `id`, `etudiant_id` (profil, cascade) et `formateur_id` (profil, cascade, null = assistance) ;
    - `cree_le`, `dernier_message_le`, `lu_etudiant_le`, `lu_autre_le` ;
    - deux index uniques partiels : `(etudiant_id, formateur_id) where formateur_id is not null` et `(etudiant_id) where formateur_id is null` ;
    - `check (etudiant_id <> formateur_id)`.
  - `messages` :
    - `id`, `conversation_id` (cascade), `auteur_id` (profil, `set null`) ;
    - `de_etudiant boolean` ;
    - `texte` (4 000 caractères au plus) ;
    - `fichier`, `nom_fichier`, `format`, `taille_octets` ;
    - `cree_le` ;
    - `check (texte <> '' or fichier is not null)` ;
    - un index unique partiel sur `fichier`.
- **Espace privé « messages »** :
  - 10 Mo, `formats_rendu()` ;
  - déposer dans son dossier (pas suspendu) ;
  - lire le sien, ou un fichier attaché à une conversation dont on est participant (`message_lisible(nom)`) ;
  - supprimer le sien.
- **Fonctions** (`authenticated`, sauf mention) :
  - `cote_conversation(p_conversation uuid) returns text`, interne : `'etudiant'`, `'formateur'`, `'equipe'` ou null.
  - `mes_conversations(p_espace text) returns jsonb` :
    - liste triée par `dernier_message_le` décroissant ; `p_espace` vaut `etudiant`, `formateur` ou `equipe` ;
    - chaque élément : `{ id, avec: { nom, photo, role, equipe }, formation: { titre, slug } | null, dernier: { texte, fichier, de_moi, cree_le } | null, non_lu }`.
  - `fil_conversation(p_conversation uuid, p_avant timestamptz default null) returns jsonb` :
    - renvoie `{ conversation: <même forme>, messages: [{ id, texte, fichier: { nom, format, taille } | null, de_moi, auteur, cree_le }], plus_anciens }`, du plus ancien au plus récent, 50 au plus ;
    - marque lu de son côté quand `p_avant` est null ;
    - null si l'on n'est pas participant.
  - `ouvrir_conversation(p_avec uuid default null) returns uuid` :
    - null, c'est l'assistance de l'appelant ;
    - un formateur, l'étudiant doit suivre une de ses formations ;
    - un étudiant, l'appelant doit être son formateur ;
    - sinon « Vous ne pouvez pas écrire à cette personne. ».
  - `envoyer_message(p_conversation uuid, p_texte text, p_fichier text, p_nom text) returns jsonb` (le message, même forme que dans le fil). Refus :
    - non participant (42501) ;
    - compte suspendu ;
    - message vide : « Écrivez un message ou joignez un fichier. » ;
    - plus de 4 000 caractères : « Votre message dépasse 4 000 caractères. » ;
    - plus de 30 messages en 10 minutes : « Trop de messages en peu de temps : réessayez dans quelques minutes. » ;
    - fichier : « Ce fichier n’a pas été reçu. Déposez-le à nouveau. », « Ce format n’est pas accepté. », « Le fichier dépasse 10 Mo. ».

    Effets :
    - le dernier message et sa date, son côté marqué lu ;
    - notification `messages` à l'autre côté (ou à `membres_equipe()` pour l'assistance), sans doublon non lu ;
    - titre : « Nouveau message de <nom> », ou « Nouvelle demande d’assistance de <nom> » pour l'équipe ;
    - lien : `/messages?c=`, `/formateur/messages?c=` ou `/admin/messages?c=`.
  - `contacts_messagerie(p_espace text, p_recherche text default '') returns jsonb` : `[{ id, nom, photo, formation }]`.
    - Étudiant : les comptes des formateurs des formations suivies. L'assistance est ajoutée par l'appli.
    - Formateur : ses étudiants, 20 au plus, filtrés par nom.
  - `messages_non_lus(p_espace text) returns integer` : le nombre de conversations non lues.
  - `fichier_message(p_message uuid) returns jsonb` : `{ chemin, nom }` si participant, sinon null.
  - `oublier_mes_messages() returns text[]` : supprime les conversations de l'appelant (comme étudiant ou formateur) et renvoie ses chemins de fichiers à effacer.
- **Catégorie de notification `messages`** ajoutée à la contrainte `notifications_categorie`.

**Étapes :**
- [ ] **Step 1: les tests**, sur un banc 0001 → 0035. Comptes : étudiante E qui suit la formation de F, autre étudiant X, formateur F, autre formateur G, admin A.
  - ouvrir et écrire dans les deux sens E ↔ F ; X ne peut ni ouvrir avec F ni lire la conversation ; G non plus ;
  - l'assistance de E : A la lit et y répond ; un autre étudiant ne la lit pas ;
  - non-lus : envoi de F, puis `messages_non_lus('etudiant')` de E vaut 1, puis 0 après le fil ;
  - une seule notification non lue par conversation ; titres et liens ;
  - les refus : vide, longueur, limite, compte suspendu ;
  - les fichiers : dossier, format, taille, déjà attaché, lecture par le participant et refus pour un autre ;
  - `contacts_messagerie` ;
  - `oublier_mes_messages` ;
  - la catégorie `messages` respecte la préférence.
- [ ] **Step 2:** lancer `npx vitest run tests/db/messagerie.test.ts`. Attendu : ÉCHEC (0035 absente).
- [ ] **Step 3:** écrire la migration.
- [ ] **Step 4:** relancer, avec `tests/db/notifications.test.ts`. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `feat(messages): migration 0035, la messagerie (conversations, messages, fichiers, notifications)`.

### Task 2: La bibliothèque `src/lib/messages`

**Files:**
- Create : `types.ts`, `conversion.ts`, `data.ts`, `actions.ts` et `fichiers.ts` dans `web/src/lib/messages/`
- Test: `web/tests/messages/logique.test.ts` (faux Supabase)

**Interfaces (Produces) :**
- **Types** :
  - `EspaceMessages = "etudiant" | "formateur" | "equipe"` ;
  - `Interlocuteur = { nom; photoUrl: string | null; role; equipe: boolean }` ;
  - `ConversationResume = { id; avec: Interlocuteur; formation: { titre; slug } | null; dernier: { texte; fichier: string | null; deMoi; creeLe } | null; nonLu }` ;
  - `Message = { id; texte; fichier: { nom; format; taille } | null; deMoi; auteur: string | null; creeLe }` ;
  - `Fil = { conversation: ConversationResume; messages: Message[]; plusAnciens }` ;
  - `Contact = { id: string | null; nom; photoUrl; formation: string | null }`, où `id` null désigne l'Équipe Étudium.
- **Lecture** (`data.ts`) :
  - `lireConversations(espace): Promise<Lecture<ConversationResume[]>>` ;
  - `lireFil(id, avant?): Promise<Lecture<Fil | null>>` ;
  - `lireContacts(espace, recherche?): Promise<Lecture<Contact[]>>` ;
  - `MIGRATION_MESSAGES`.
- **Actions** (`actions.ts`, `"use server"`) :
  - `relireFil(id: string): Promise<Fil | null>`, pour la relecture toutes les 10 s ;
  - `relireConversations(espace)` ;
  - `ouvrirConversation(avec: string | null): Promise<{ ok: true; id } | { ok: false; message }>` ;
  - `envoyerMessage(conversationId, texte, fichier: { chemin; nom } | null): Promise<{ ok: true; message: Message } | { ok: false; message: string }>` ;
  - `contacterEquipe(sujet, texte): Promise<{ ok: true } | { ok: false; message }>` : ouvre l'assistance et écrit « Sujet : <sujet> », un saut de ligne, puis le texte ;
  - `lienFichierMessage(messageId): Promise<string | null>`, un lien signé de 60 s ;
  - `compterMessagesNonLus(espace): Promise<number>`, qui vaut 0 sur une erreur ou avant la 0035.
- **Fichiers** (`fichiers.ts`) :
  - `MESSAGE_MAX_OCTETS = 10485760` ;
  - `LIBELLE_FORMATS_MESSAGE = "PDF, Word, Excel, PowerPoint, image ou ZIP · 10 Mo maximum"` ;
  - `formatDeMessage(nom, octets)`, qui reprend `formatDeRendu`.

**Étapes :**
- [ ] **Step 1: les tests**
  - conversion des réponses de la base (dates, photos, équipe) ;
  - avant la 0035, `migrationAbsente` ;
  - refus traduits (P0001 tel quel, 42501 en « Vous ne pouvez pas écrire à cette personne. ») ;
  - `contacterEquipe` écrit « Sujet : Certificat », un saut de ligne, puis le message ;
  - `compterMessagesNonLus` vaut 0 sur une erreur.
- [ ] **Step 2:** lancer les tests. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire le code.
- [ ] **Step 4:** relancer les tests. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `feat(messages): lecture et actions de la messagerie`.

### Task 3: L'écran Messages

**Files :**
- Create, dans `web/src/components/messages/` :
  - `PageMessages.tsx` (serveur) ;
  - `Messagerie.tsx` (client : liste et conversation, relecture, envoi, pièce jointe) ;
  - `NouveauMessage.tsx` (fenêtre) ;
  - `useMessagesNonLus.ts`.
- Modify :
  - les pages `src/app/(app)/(etudiant)/messages/page.tsx` et `src/app/(app)/formateur/messages/page.tsx` ;
  - create `src/app/(app)/admin/messages/page.tsx` ;
  - `src/lib/navigation.ts` : « Messages » dans le menu de l'équipe, groupe de la communauté ;
  - `src/lib/pages-a-venir.ts` : retirer `messages` et `formateur/messages` ;
  - `SidebarNav.tsx` et la barre du bas : pastille sur « Messages ».
- Test: `web/tests/messages/messagerie.test.tsx`

**Valeurs du design (NdMessages) :**
- **En-tête** : h1 « Messages » ; sous-titre « Une question sur une leçon ? Écrivez directement à votre formateur. » (formateur : « Les messages de vos étudiants. » ; équipe : « Les demandes d’assistance des étudiants. ») ; bouton gris « Nouveau message », 42 px (pas pour l'équipe).
- **Liste** (`flex 1 1 300px`), carte bordée de 8 px de marge intérieure :
  - un bouton par conversation : `aria-pressed`, rayon 14 px, avatar de 44 px ;
  - nom en 15/22 600, heure en 12/18 `#535E75`, aperçu en 13/20 `#535E75` (« Vous : … ») ;
  - point « Non lu » de 8 px, bleu.
- **Conversation** (`flex 999 1 420px`), carte bordée :
  - en-tête : avatar de 44 px, nom, rôle en 13/20 discret (« Formateur·rice · <formation> », « Étudiant·e · <formation> » ou « Assistance ») et « Voir la formation » (bouton contour de 34 px) ;
  - fil en colonne, avec 14 px d'écart et 20 px de marge intérieure ;
  - séparateur de jour : traits et « Aujourd’hui », « Hier » ou « 12 octobre » en 12/18 ;
  - bulle : `max-w-[min(100%,460px)]`, `px-3.5 py-2.5`, rayon 16 px, 14/22. La sienne est bleue, alignée à droite ; celle de l'autre est en `bg-coque`, à gauche ;
  - pièce jointe : carte bordée de `min(100%,320px)`, tuile de 40 px, nom et taille ;
  - sous la bulle : « Vous · 14 h 05 » ou « 14 h 02 » ; pour l'équipe, le nom du membre ;
  - zone de saisie : « Joindre un fichier » (48 px, icône), champ de 48 px « Écrivez votre message… » nommé « Message à <nom> », bouton « Envoyer » de 48 px.
- **Sans conversation** : un état vide qui invite à « Nouveau message ».
- **Téléphone** : si `?c=` est présent, la conversation seule avec « ‹ Messages » ; sinon la liste.

**Étapes :**
- [ ] **Step 1: les tests**
  - la liste (non lu, aperçu « Vous : ») et la conversation choisie par `?c=` ;
  - envoi : le message apparaît, puis le champ se vide ;
  - un refus s'affiche ;
  - pièce jointe : refus d'un mauvais format côté navigateur ;
  - relecture toutes les 10 s, avec un minuteur simulé ; une erreur de relecture garde les messages ;
  - « Nouveau message » liste les contacts et ouvre la conversation ;
  - la pastille ;
  - les pages des trois espaces ;
  - avant la 0035, le bandeau.
- [ ] **Step 2:** lancer les tests. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire le code.
- [ ] **Step 4:** relancer les tests. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `feat(messages): l'écran Messages (étudiant, formateur, équipe)`.

### Task 4: La page Aide (NdAide)

**Files :**
- Modify : `web/src/components/aide/PageAide.tsx`, `web/src/lib/site/faq.ts` (ajouter `QUESTIONS_FORMULES`)
- Create : `web/src/components/aide/ContacterEquipe.tsx`
- Test: `web/tests/aide/page.test.tsx`

**Valeurs :**
- h1 « Aide » ; chapeau « Trouvez une réponse dans les questions fréquentes ou écrivez à l’équipe Étudium. ».
- Recherche « Rechercher dans l’aide… » : 520 px au plus, filtre les deux listes ; sans résultat, « Aucune question ne correspond. ».
- **À gauche** (`flex 999 1 420px`), avec 36 px entre les deux blocs :
  - h2 « Questions fréquentes », puis les 7 questions en accordéon ouvert sur la première, sans boîte ;
  - h2 « Questions sur les formules », puis les 4 questions de NdAide, verbatim.
- **À droite** (`flex 1 1 300px`), la carte « Contacter l’équipe » :
  - chapeau « Vous ne trouvez pas la réponse ? Écrivez-nous. » ;
  - liste « Sujet » : Paiement et abonnement, Accès à une formation, Certificat, Problème technique, Autre ;
  - « Message », avec l'indication « Décrivez votre question en quelques lignes » ;
  - bouton « Envoyer », 42 px.
  - Après l'envoi, le message bref « Message envoyé : La réponse arrivera dans vos messages. ».

**Étapes :**
- [ ] **Step 1: les tests**
  - les deux listes ;
  - la recherche filtre ;
  - envoyer appelle `contacterEquipe(sujet, message)`, puis affiche le message bref ;
  - un message vide est refusé ;
  - le refus de la base s'affiche.
- [ ] **Step 2:** lancer les tests. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire le code.
- [ ] **Step 4:** relancer les tests. Attendu : RÉUSSITE.
- [ ] **Step 5:** commit `feat(aide): la page Aide selon le design, « Contacter l’équipe » écrit à l’assistance`.

### Task 5: Intégrations, guide et vérifications

**Files :**
- `web/src/components/formateur/FicheEtudiant.tsx` : bouton « Envoyer un message », qui ouvre la conversation puis mène à `/formateur/messages?c=`.
- `web/src/lib/profile/preferences.ts` : catégorie « Messages », « Messages de vos formateurs et de l’équipe ».
- `web/src/lib/profile/actions.ts` : `deleteAccount` appelle `oublier_mes_messages`, puis efface les fichiers.
- Le texte de la suppression du compte, s'il faut l'ajuster.
- `docs/guides/ce-qui-te-revient.md`, section 42.

**Étapes :**
- [ ] **Step 1: les tests**
  - le bouton de la fiche étudiant ;
  - la catégorie dans les préférences ;
  - la suppression du compte efface aussi les fichiers des messages.
- [ ] **Step 2:** lancer les tests. Attendu : ÉCHEC.
- [ ] **Step 3:** écrire le code.
- [ ] **Step 4:** relancer les tests. Attendu : RÉUSSITE.
- [ ] **Step 5: vérifications**
  - suite complète, `npm run lint`, `npx tsc --noEmit` et `npm run build` ;
  - rendu dans le navigateur par une page d'essai temporaire (jamais commitée) : liste et conversation, sur ordinateur et à 375 px.
- [ ] **Step 6:** commit `feat(messages): message depuis la fiche étudiant, préférence, suppression du compte` puis `docs(guide): section 42, la messagerie`.
