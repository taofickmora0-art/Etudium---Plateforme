# Modération : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** analyser automatiquement chaque publication par une IA, laisser les membres signaler publications et réponses, et donner à l'équipe une file de modération au back-office.

**Architecture :** la migration 0020 ajoute le statut des publications, les signalements, les réglages (jeton, analyse active) et les fonctions de la file. Le serveur Next appelle l'API d'Anthropic (clé dans `web/.env.local`) et transmet le verdict à la base avec le jeton : la base n'applique qu'un verdict qui le porte. Les écrans de la communauté gagnent « Signaler » et l'état « En attente de vérification » ; le back-office gagne `/admin/moderation` et une tuile.

**Tech Stack :** Next.js 16.4 (cacheComponents), Supabase (Postgres, RLS, fonctions `security definer`, stockage), API Messages d'Anthropic par `fetch` (aucune dépendance ajoutée), sharp (déjà là), zod (déjà là), Vitest et PGlite.

**Spec :** `docs/superpowers/specs/2026-10-14-moderation-design.md`

## Global Constraints

- Tous les textes visibles en français, mot pour mot ceux de la spec.
- Fonctions de la base : `security definer`, `set search_path = ''`, `perform public.exiger_compte_actif()` en tête ; jamais l'heure du client (`now()`).
- Les secrets (`ANTHROPIC_API_KEY`, `MODERATION_JETON`) ne sont lus que côté serveur (`process.env`, jamais `NEXT_PUBLIC_`), jamais écrits dans le dépôt ; ne jamais lire ni créer `web/.env.local`.
- Modèle par défaut `claude-haiku-5-5`, réglable par `MODERATION_MODELE` ; délai 20 000 ms ; image réduite à 1 568 px de côté au plus ; PDF analysé jusqu'à 5 242 880 octets.
- Limites : 5 publications et 30 réponses par compte toutes les 10 minutes ; précisions d'un signalement : 500 caractères au plus.
- Notifications de modération en catégorie `service`.
- Rendu sans débordement à 1440, 390 et 320 px.
- Avant la 0020 : la communauté marche comme avant ; la page Modération affiche « Appliquez la migration 0020 (guide « Ce qui te revient », section 25). ».
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Un appel direct à `publier` sans jeton, analyse active** : la publication attend l'équipe (`en_attente`), invisible des autres → test de la tâche 1.
2. **Une publication en attente ou bloquée** : ni réponse, ni J’aime, ni fichier lisible par un autre compte ; son auteur voit la sienne en attente → test de la tâche 1.
3. **Une modification bloquée** : l'ancienne version reste en ligne, inchangée → tests des tâches 1 et 4.
4. **Une IA qui répond hors format, trop tard ou en erreur** : « analyse impossible », la publication paraît et entre dans la file → tests des tâches 3 et 4.
5. **Un jeton mal recopié** : le bloc « Analyse automatique » dit « non reconnu » et l'activation est refusée → tests des tâches 1 et 6.

---

### Task 1 : Migration 0020, publications analysées

**Files :**
- Create : `web/supabase/migrations/0020_moderation.sql` ; `web/tests/db/moderation.test.ts`.
- Modify : `web/tests/db/supabase-simule.sql` (colonne `metadata jsonb` de `storage.objects`).

**Interfaces :**
- Produces (SQL) :
  - `publications` + `statut text not null default 'publiee' check (statut in ('publiee','en_attente','bloquee'))`, `analyse jsonb`, `a_examiner boolean not null default false` ;
  - `reglages_moderation (id boolean primary key default true check (id), jeton text not null, analyse_active boolean not null default false, derniere_analyse timestamptz)`, une ligne, jeton = deux `gen_random_uuid()` sans tirets ; fermée (RLS, `revoke all`) ; `on conflict do nothing` garde le jeton ;
  - `moderation_active() returns boolean` (authenticated) ;
  - `etat_moderation(p_jeton text) returns jsonb` (équipe) : `{active, jeton_reconnu (null si p_jeton null), derniere_analyse, en_attente}` ;
  - `regler_analyse(p_active boolean, p_jeton text)` (équipe) : activer exige le bon jeton, sinon « Le jeton de modération n’est pas reconnu. » ;
  - `drop function public.publier(uuid,text,text,jsonb)` puis `publier(p_parcours uuid, p_titre text, p_texte text, p_piece jsonb default null, p_analyse jsonb default null) returns jsonb` → `{id, statut, categorie}` ;
  - `drop function public.modifier_publication(uuid,text,text)` puis `modifier_publication(p_id uuid, p_titre text, p_texte text, p_analyse jsonb default null) returns jsonb` → `{statut, categorie}` ;
  - `p_analyse = {jeton, decision: 'autoriser'|'signaler'|'bloquer'|'echec', categorie, raison}` ; verdict valide si `jeton` est le bon :
    - autoriser → `publiee` ; signaler, echec → `publiee` + `a_examiner` ; bloquer → `bloquee` (publier) ou aucun changement (modifier) ;
    - sans verdict valide : analyse inactive → `publiee` ; active → `en_attente` ;
    - `analyse = {decision, categorie, raison, le}` ; `derniere_analyse = now()` ;
  - limite : 5 publications (toutes, bloquées comprises) et 30 réponses (`commenter`) par auteur en 10 minutes : « Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes. » ;
  - `publication_visible(p publications) returns boolean` : `statut = 'publiee' or (statut = 'en_attente' and auteur = auth.uid())` ;
  - redéfinies pour ne montrer que les visibles : `fil_communaute`, `publication_communaute` (visible, ou équipe pour tout statut), `membres_actifs` (publiées), `fichier_communaute_lisible` (publiées) ; `publication_ouverte` refuse une publication non publiée : « Cette publication attend sa vérification. » pour son auteur, « Cette publication n’existe plus. » sinon ;
  - `carte_publication` ajoute `statut` et `peut_signaler` (ni l'auteur, ni l'équipe, publiée) ; `carte_reponse` ajoute `peut_signaler` ;
  - `verifier_piece` exige `metadata->>'mimetype'` = type annoncé et `(metadata->>'size')::bigint` = taille annoncée ;
  - à l'insertion d'une publication `a_examiner` ou `en_attente` : `notifier(<comptes de l'équipe>, 'service', 'À modérer', 'Une publication de l’espace <nom_court|général> attend votre examen.', '/admin/moderation')`.

- [ ] **Step 1 : Tests qui échouent** (`tests/db/moderation.test.ts`, banc de `communaute.test.ts` + 0019 + 0020 ; `deposer(qui, chemin, type, taille)` remplit `metadata`) :
  - « analyse inactive : publier sans verdict publie ; un verdict au mauvais jeton est ignoré » ;
  - « regler_analyse : refus sans le bon jeton (« Le jeton de modération n’est pas reconnu. ») ; l'équipe seule ; etat_moderation rend active, jeton_reconnu true/false/null, en_attente » ;
  - « analyse active : autoriser → publiee ; signaler et echec → publiee + a_examiner ; bloquer → bloquee, rend la catégorie ; sans verdict (appel direct) → en_attente » ;
  - « visibilité : en_attente visible de son auteur seul dans le fil, bloquee de personne ; page : l'équipe voit tout ; répondre ou aimer une en_attente : « Cette publication attend sa vérification. » pour l'auteur ; fichier d'une en_attente illisible par un autre » ;
  - « modifier : bloquer garde l'ancienne version ; signaler applique + a_examiner ; sans verdict, analyse active → en_attente » ;
  - « limite : la 6e publication en 10 minutes est refusée ; la 31e réponse aussi » ;
  - « verifier_piece : type ou taille différents des métadonnées → « Ce fichier n’est pas le vôtre. » » ;
  - « À modérer : l'équipe est prévenue d'une publication signaler ou en_attente, pas d'une autoriser ni bloquer » ;
  - « carte : statut et peut_signaler (faux pour l'auteur et l'équipe) ; la migration est rejouable et garde le jeton ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/db/moderation.test.ts` → FAIL (migration absente).
- [ ] **Step 3 : Écrire la migration** (fonctions de la 0019 redéfinies en entier, avec les filtres ci-dessus).
- [ ] **Step 4 : Lancer, ça passe** : même commande, plus `npx vitest run tests/db/communaute.test.ts` → PASS.
- [ ] **Step 5 : Commit** : `feat(moderation): publications analysées, jeton et visibilité (migration 0020)`

### Task 2 : Migration 0020, signalements et file

**Files :** Modify : `web/supabase/migrations/0020_moderation.sql`, `web/tests/db/moderation.test.ts`.

**Interfaces :**
- Consumes : tâche 1.
- Produces (SQL) :
  - `signalements (id uuid pk, publication_id uuid null → publications on delete cascade, commentaire_id uuid null → commentaires_publications on delete cascade, auteur uuid → profils on delete cascade, motif text check in ('inapproprie','spam','harcelement','autre'), precisions text not null default '' check (char_length ≤ 500), cree_le timestamptz default now(), traite_le timestamptz)`, exactement une cible ; index uniques partiels (auteur, publication_id) et (auteur, commentaire_id) ; fermée ;
  - `signaler(p_publication uuid, p_commentaire uuid, p_motif text, p_precisions text) returns void` :
    - une cible lisible (`publication_ouverte`) ; pas son propre contenu : « Vous ne pouvez pas signaler votre propre contenu. » ; pas l'équipe : « L’équipe modère depuis la file. » ;
    - « Autre » sans précisions : « Précisez le motif du signalement. » ; doublon : « Vous avez déjà signalé ce contenu. » ;
    - premier signalement non traité d'un contenu qui n'était pas déjà dans la file : « À modérer » à l'équipe (« Une publication de l’espace … attend votre examen. » ou « Une réponse de l’espace … attend votre examen. ») ;
  - `file_moderation(p_onglet text) returns jsonb` (équipe ; `a_examiner` ou `bloquees`, 50 au plus) : éléments `{type: 'publication'|'reponse', id, publication_id, espace:{id, nom}, auteur:{id, prenom, nom}, cree_le, titre, texte, piece_jointe, statut, analyse, extrait (début de la publication, pour une réponse), signalements:{nombre, motifs:[{motif, nombre}], details:[{motif, precisions, par, le}]}}` ; « À examiner » = publications `en_attente` ou `a_examiner` ou avec signalement non traité + réponses avec signalement non traité, les plus anciennes d'abord ; « Bloquées » = `bloquee`, les plus récentes d'abord ;
  - `nombre_a_examiner() returns integer` (équipe) ;
  - `garder_contenu(p_publication uuid, p_commentaire uuid)` : signalements traités, `a_examiner = false` ; `en_attente` → `publiee` + « Publication en ligne » à l'auteur (« Votre publication dans l’espace … a été vérifiée par l’équipe Étudium et mise en ligne. », lien de la publication) ;
  - `supprimer_contenu(p_publication uuid, p_commentaire uuid) returns text` (chemin du fichier ou null) : supprime ; à l'auteur « Publication retirée » (« Votre publication dans l’espace … a été retirée par l’équipe Étudium : elle ne respecte pas les règles de la communauté. ») ou « Réponse retirée » (« Votre réponse dans l’espace … a été retirée par l’équipe Étudium : elle ne respecte pas les règles de la communauté. »), lien `/communaute` ;
  - `retablir_publication(p_id uuid)` : `bloquee` → `publiee`, « Publication en ligne » à l'auteur ;
  - contenu disparu : « Ce contenu n’existe plus. » ; hors équipe : 42501.

- [ ] **Step 1 : Tests qui échouent** :
  - « signaler : motif et précisions ; doublon refusé ; son propre contenu et l'équipe refusés ; Autre sans précisions refusé ; espace fermé refusé » ;
  - « À modérer : au premier signalement seulement » ;
  - « file : à examiner (en attente, signalée par l'IA, signalée par 3 membres avec motifs comptés, réponse signalée), dans l'ordre ; bloquées ; hors équipe refusé ; nombre_a_examiner » ;
  - « garder : quitte la file ; en_attente publiée et l'auteur prévenu » ;
  - « supprimer : la publication et ses signalements disparaissent, chemin rendu, l'auteur prévenu ; une réponse aussi » ;
  - « rétablir : bloquée → publiée, l'auteur prévenu ; contenu disparu : « Ce contenu n’existe plus. » ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/db/moderation.test.ts` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** → PASS.
- [ ] **Step 5 : Commit** : `feat(moderation): signalements et file de l'équipe (migration 0020)`

### Task 3 : L'analyse côté serveur

**Files :**
- Create : `web/src/lib/moderation/types.ts`, `regles.ts`, `analyse.ts` ; tests `web/tests/moderation/regles.test.ts`, `analyse.test.ts`.

**Interfaces :**
- Produces :
  - `types.ts` :
    - `Decision = "autoriser" | "signaler" | "bloquer" | "echec"` ;
    - `Categorie = "spam" | "harcelement" | "haine" | "sexuel" | "arnaque" | "hameconnage" | "publicite" | "illegal" | "hors_sujet" | "autre" | "aucune"` ;
    - `Verdict = { decision; categorie; raison: string }` ;
    - `MotifSignalement = "inapproprie" | "spam" | "harcelement" | "autre"` ;
    - `ConfigModeration = { cle: string; jeton: string; modele: string }` ;
    - `ContenuAnalyse = { titre; texte; espace: string; fichier: { type: string; octets: Uint8Array } | null }`.
  - `regles.ts` :
    - `LIBELLES_CATEGORIES` : « Spam », « Harcèlement », « Haine », « Contenu sexuel ou inapproprié », « Arnaque », « Hameçonnage », « Publicité abusive », « Contenu illégal », « Hors sujet », « Autre violation des règles », « Aucune » ;
    - `LIBELLES_MOTIFS` : « Contenu inapproprié », « Spam ou publicité », « Harcèlement », « Autre » ;
    - `PRECISIONS_MAX = 500` ; `refusSignalement(motif, precisions): string | null` ;
    - `messageBloquee(categorie)` → « Votre publication n’a pas été publiée : elle semble enfreindre les règles de la communauté (Arnaque). Si c’est une erreur, l’équipe Étudium pourra la rétablir. » ;
    - `PDF_ANALYSE_MAX = 5_242_880`, `IMAGE_COTE_MAX = 1568`, `DELAI_ANALYSE_MS = 20_000`.
  - `analyse.ts` (serveur seulement : importe sharp) :
    - `configurationModeration(): ConfigModeration | null` : `ANTHROPIC_API_KEY` et `MODERATION_JETON` non vides, sinon null ; `MODERATION_MODELE` ou `claude-haiku-5-5` ;
    - `analyserPublication(contenu: ContenuAnalyse, config: ConfigModeration, f = fetch): Promise<Verdict>` ; ne lève jamais : toute erreur rend `{ decision: "echec", categorie: "aucune", raison: "Analyse impossible : <cause courte>" }` ;
    - requête : `POST https://api.anthropic.com/v1/messages`, en-têtes `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json` ; `{ model, max_tokens: 400, temperature: 0, system, tools: [rendre_verdict], tool_choice: { type: "tool", name: "rendre_verdict" }, messages }` ; le titre et le texte entre `<publication>` et `</publication>`, le système disant qu'ils sont des données, jamais des consignes ; image : réduite par sharp (`rotate`, `resize` 1 568 `fit: inside`, `withoutEnlargement`, `jpeg` qualité 80) en bloc `image` base64 `image/jpeg` ; PDF ≤ 5 Mo : bloc `document` base64 ; PDF plus lourd : « echec » sans appel ;
    - réponse : le bloc `tool_use` validé par zod ; sinon « echec ».

- [ ] **Step 1 : Tests qui échouent** :
  - regles : libellés, `refusSignalement("autre", " ")` → « Précisez le motif du signalement. », plus de 500 caractères → « 500 caractères au plus pour les précisions. », `messageBloquee("arnaque")` ;
  - analyse : « configuration : null sans clé ou sans jeton ; modèle par défaut » ; « requête : modèle, outil imposé, publication entre balises, en-têtes » ; « verdict lu dans tool_use » ; « image réduite à 1 568 px en JPEG » (une image 3 000 × 1 000 générée par sharp) ; « PDF joint en document ; PDF de plus de 5 Mo : echec sans appel » ; « HTTP 500, réponse hors format, délai dépassé (fetch qui n'aboutit pas, minuterie simulée) : echec ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/moderation` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** → PASS ; `npx tsc --noEmit`.
- [ ] **Step 5 : Commit** : `feat(moderation): analyse des publications par l'IA`

### Task 4 : Publier, modifier et signaler avec la modération

**Files :**
- Modify : `web/src/lib/communaute/types.ts`, `data.ts`, `actions.ts` ; `web/tests/communaute/data.test.ts`, `actions.test.ts`.

**Interfaces :**
- Consumes : tâches 1 à 3.
- Produces :
  - `Publication` gagne `statut: "publiee" | "en_attente"` et `peutSignaler: boolean` ; `Reponse` gagne `peutSignaler: boolean` (absents de la base avant la 0020 : `"publiee"` et `false`) ;
  - `lireAnalyseActive(): Promise<boolean>` (data) : `moderation_active`, faux avant la 0020 ;
  - `publierPublication(...)` rend `{ ok: true; id: string; statut: "publiee" | "en_attente" } | { ok: false; message: string }` :
    - analyse active et configuration présente : le fichier relu (`storage.download`), ses premiers octets vérifiés par `formatDe` (sinon fichier retiré et « Ce fichier n’est pas une image ou un PDF valide. ») ; l'espace nommé par `espaces_communaute` ; `analyserPublication` ; `p_analyse = { jeton, ...verdict }` ;
    - sinon `p_analyse: null` ;
    - statut `bloquee` → `{ ok: false, message: messageBloquee(categorie) }` (fichier gardé pour l'équipe) ;
  - `modifierPublication(...)` rend `{ ok: true; statut } | { ok: false; message }` ; analyse du titre et du texte seuls ; `bloquee` → `messageBloquee` ;
  - `signaler(cible: { publicationId: string } | { reponseId: string }, motif: MotifSignalement, precisions: string): Promise<{ ok: true } | { ok: false; message: string }>` ; `refusSignalement` avant tout appel.

- [ ] **Step 1 : Tests qui échouent** :
  - data : `statut` et `peut_signaler` convertis ; absents → `"publiee"`, `false` ;
  - actions : « analyse inactive : publier sans p_analyse (null) ni appel à l'IA » ; « active et configurée : verdict et jeton transmis ; statut en_attente rendu » ; « bloquee : messageBloquee, aucun retrait du fichier » ; « faux fichier : retiré, « Ce fichier n’est pas une image ou un PDF valide. », rien publié » ; « active sans configuration : p_analyse null » ; « modifier : texte analysé, bloquée → message » ; « signaler : paramètres, refus local, message de la base » (`@/lib/moderation/analyse` simulé par `vi.mock`).
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/communaute` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** → PASS.
- [ ] **Step 5 : Commit** : `feat(moderation): publier, modifier et signaler avec l'analyse`

### Task 5 : Signaler et l'attente dans la communauté

**Files :**
- Create : `web/src/components/communaute/FenetreSignalement.tsx` ; test `web/tests/communaute/signaler.test.tsx`.
- Modify : `CartePublication.tsx`, `Reponses.tsx`, `ChampPublication.tsx`, `PageCommunaute.tsx`, `ContenuCommunaute.tsx`.

**Interfaces :**
- Consumes : tâche 4 (`signaler`, `statut`, `peutSignaler`, `lireAnalyseActive`, retours de `publierPublication` et `modifierPublication`).
- Produces :
  - `FenetreSignalement({ cible, type: "publication" | "reponse", open, onOpenChange })` : textes du §4 de la spec ; `RadioGroup` des motifs ; `Textarea` « Précisions » ; message « Signalement envoyé » · « Merci, la publication a été signalée à la modération. » (« la réponse ») ;
  - menu ⋮ : **Signaler** (icône drapeau) quand `peutSignaler` ; réponse : `IconButton` « Signaler la réponse de <Prénom N.> » ;
  - carte `en_attente` : étiquette « En attente de vérification », sans J’aime ni réponses ;
  - `PageCommunaute` reçoit `analyseActive` ; le champ dit « Les publications sont vérifiées automatiquement. » ou « Soyez bienveillant : l’équipe Étudium veille aux échanges. » ;
  - publication en attente : « Publication envoyée » · « Elle paraîtra après vérification par l’équipe Étudium. », carte en tête avec l'étiquette ; refus (bloquée) : le message dans le champ, le texte gardé.

- [ ] **Step 1 : Tests qui échouent** :
  - « Signaler une publication : motifs du design, Autre sans précisions refusé, envoi, message » ; « une réponse » ; « l'auteur et l'équipe n'ont pas Signaler » ;
  - « carte en attente : étiquette, ni J’aime ni réponses » ;
  - « mention du champ selon analyseActive » ; « publier en attente : message et carte » ; « bloquée : message, texte gardé ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/communaute` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** → PASS.
- [ ] **Step 5 : Commit** : `feat(moderation): Signaler et publications en attente dans la communauté`

### Task 6 : La file de modération au back-office

**Files :**
- Create : `web/src/lib/moderation/data.ts`, `actions.ts` ; `web/src/components/admin/moderation/PageModeration.tsx` (client), `ElementModeration.tsx`, `BlocAnalyse.tsx`, `ContenuModeration.tsx` (serveur) ; tests `web/tests/moderation/data.test.ts`, `actions.test.ts`, `page.test.tsx`.
- Modify : `web/src/app/(app)/admin/moderation/page.tsx` (remplace la page à venir) ; `web/src/lib/pages-a-venir.ts` (retire `admin/moderation`) ; `web/src/app/(app)/admin/page.tsx` et `TableauDeBordAdmin.tsx` (tuile « Contenus à examiner ») ; les tests qui citent `admin/moderation` comme page à venir.

**Interfaces :**
- Consumes : tâches 2 et 3.
- Produces :
  - `ElementFile` (types.ts) : la forme de `file_moderation` en camelCase, `pieceJointe.url` signé ;
  - `EtatModeration = { active: boolean; cle: boolean; jeton: "reconnu" | "non_reconnu" | "absent"; derniereAnalyse: string | null; enAttente: number }` ;
  - data : `lireFileModeration(onglet: "a_examiner" | "bloquees"): Promise<Lecture<ElementFile[]>>`, `lireEtatModeration(): Promise<Lecture<EtatModeration>>`, `lireNombreAExaminer(): Promise<number | null>` ;
  - actions (« use server », `exigerEquipe` ou équivalent existant) : `garderContenu(cible)`, `supprimerContenu(cible)` (retire le fichier rendu), `retablirPublication(id)`, `reglerAnalyse(active: boolean)` (le jeton lu côté serveur), `chargerFile(onglet)` ; `cible = { publicationId } | { reponseId }` ;
  - page : en-tête, bloc « Analyse automatique », onglets « À examiner (N) » et « Bloquées », éléments et actions (§5 de la spec), confirmation « Supprimer ce contenu ? » · « Il disparaîtra de la communauté et son auteur sera prévenu. », messages « Contenu gardé », « Contenu supprimé », « Publication rétablie », « Analyse automatique activée », « Analyse automatique désactivée » ;
  - tuile « Contenus à examiner » : nombre, « À examiner » ou « Disponible au lot 5 » avant la 0020, lien `/admin/moderation`.

- [ ] **Step 1 : Tests qui échouent** :
  - data : conversion d'un élément (publication signalée par 3 membres, réponse), liens signés en un appel ; état (clé absente → `cle: false`, jeton absent / non reconnu / reconnu) ; avant la 0020 → `migrationAbsente` ;
  - actions : hors équipe refusé ; garder, supprimer (fichier retiré), rétablir, régler (jeton du serveur transmis ; sans configuration : « Ajoutez la clé de l’IA et le jeton de modération (guide, section 25). ») ;
  - page : « bloc inactif : clé, jeton, Activer seulement si les deux sont là » ; « actif : Désactiver confirmé » ; « en attente avec analyse active : l'avertissement » ; « onglets et éléments : raisons (analyse, signalements comptés, précisions), Garder, Supprimer confirmé, Rétablir » ; « vides » ; « avant la 0020 : le bandeau » ; tuile du tableau de bord.
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/moderation tests/admin tests/layout` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** → PASS.
- [ ] **Step 5 : Commit** : `feat(moderation): la file de modération du back-office`

### Task 7 : Rendu, guide et suite complète

- [ ] **Step 1 :** `cd web && npm run lint && npx tsc --noEmit && npm run build` → succès.
- [ ] **Step 2 : Mesurer à 1440, 390 et 320 px** (rendus temporaires, jamais commités) : la file avec un texte de 3 000 caractères sans espace et un nom de fichier de 120 caractères ; la fenêtre Signaler ; une carte en attente. Attendu : aucun débordement.
- [ ] **Step 3 : `web/.env.example`** : `ANTHROPIC_API_KEY=`, `MODERATION_JETON=`, `# MODERATION_MODELE=claude-haiku-5-5`, avec un commentaire : serveur seulement, jamais dans le dépôt.
- [ ] **Step 4 : Section 25 du guide** :
  1. appliquer la 0020 (rejouer la 0019 demande de rejouer la 0020 ensuite) ;
  2. créer une clé sur console.anthropic.com (avec du crédit) ; `select jeton from public.reglages_moderation;` ; les recopier dans `web/.env.local` ; redémarrer ;
  3. back-office → Modération : clé présente, jeton reconnu, **Activer** ;
  4. publier une arnaque de test : bloquée ; une publication douteuse : dans la file ; une normale : en ligne ;
  5. signaler une publication et une réponse avec un autre compte ; « À modérer » dans ta cloche ;
  6. Garder, Supprimer (l'auteur prévenu), Rétablir ;
  7. Désactiver ; puis, analyse réactivée et clé retirée : la publication attend et le bloc le dit ;
  8. politique de confidentialité : mentionner l'analyse par Anthropic.
- [ ] **Step 5 :** `cd web && npx vitest run` → toute la suite passe.
- [ ] **Step 6 : Commit** : `docs: guide de validation de la modération`
