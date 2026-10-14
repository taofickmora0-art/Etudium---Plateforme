# Communauté : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** l'espace général et un espace par parcours, où les comptes autorisés publient (texte, titre, une image ou un PDF), répondent, aiment, modifient et suppriment leurs publications ; l'équipe supprime ce qui doit l'être.

**Architecture :**
- **Migration 0019.** Trois tables fermées aux comptes (publications, réponses, réactions). Des fonctions `security definer` appliquent la règle d'accès `peut_lire_espace`.
- **Pièces jointes.** Elles vont dans un espace de stockage privé « communaute » : le navigateur dépose le fichier dans le dossier du compte, la base vérifie avant de l'attacher, et la lecture passe par des liens temporaires.
- **Application.** `lib/communaute/` (règles, lectures, actions), `components/communaute/` (la page et ses morceaux), la page d'une publication.

**Tech Stack :** Next.js 16.4, Supabase (SQL, RLS, Storage), PGlite (`tests/db/banc.ts`, avec `storage.objects` simulé), Vitest + jsdom.

**Spec :** `docs/superpowers/specs/2026-10-14-communaute-design.md`

## Global Constraints

- **Textes :** en français, avec l'apostrophe typographique, neutres ; les textes du design et de la spec mot pour mot (§3).
- **Migration** `web/supabase/migrations/0019_communaute.sql` : rejouable, après la 0018. Avant elle, la page affiche « Appliquez la migration 0019 (guide « Ce qui te revient », section 24). ».
- **Limites :**
  - titre **120** (facultatif) ;
  - texte **1 à 3 000** ;
  - réponse **1 à 1 000** ;
  - pièce jointe : **10 Mo**, une seule, `image/jpeg`, `image/png`, `image/webp` ou `application/pdf`, type vérifié sur les premiers octets (`formatDe` de `lib/admin/fichiers.ts`) ;
  - fil : **20** par lecture ; **2** dernières réponses sous une publication ; **3** membres actifs (7 jours) ; liens temporaires des fichiers : **1 h**.
- **Jamais d'adresse e-mail** livrée. Noms : « Prénom Nom » sur une publication, « Prénom N. » sur une réponse.
- **Aucune fonction n'accepte l'heure du client.**
- **Pages :** la page Communauté et celle d'une publication, dans l'espace étudiant, contiennent `<SessionGuard`.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Répondre ou aimer dans un espace fermé** par un appel direct à la base : refusé, comme publier → test de la tâche 2.
2. **Une pièce jointe d'un autre compte**, ou un chemin `autre/../moi/x.pdf` : refusée par `publier`, le dossier étant vérifié par `storage.foldername` → test de la tâche 1.
3. **Le fichier et la publication restent liés.** Supprimer une publication retire son fichier ; une publication refusée après l'envoi du fichier retire ce fichier → tests des tâches 1 et 3.
4. **Plusieurs publications de la même seconde** : « Voir plus » utilise le curseur `(cree_le, id)`, sans saut ni doublon → test de la tâche 1.
5. **Textes longs à 320 px** (3 000 caractères sans espace, nom de PDF de 120 caractères) : aucun débordement → mesure de la tâche 5.

---

### Task 1 : Migration 0019 : espaces, publications, fichiers

**Files :**
- Create : `web/supabase/migrations/0019_communaute.sql`
- Test : `web/tests/db/communaute.test.ts`. Banc : la liste de `tests/db/sessions-live.test.ts`, plus la 0018 et la 0019.

**Interfaces :**
- Produces (SQL) :
  - **Tables** (RLS active, `revoke all` à `anon` et `authenticated`) :
    - `public.publications (id uuid, auteur uuid → profils on delete cascade, parcours_id uuid → parcours on delete cascade, titre text default '', texte text, piece_jointe jsonb, cree_le timestamptz, modifie_le timestamptz, modifiee boolean default false)` ;
    - index `(cree_le desc, id desc)` et `(parcours_id)`.
  - **`public.peut_lire_espace(p_parcours uuid) returns boolean`** (interne) :
    - faux pour un visiteur ou un compte suspendu ;
    - vrai pour le général (nul) ;
    - pour un parcours : l'équipe (`equipe_contenus()`), le formateur (`ma_fiche_formateur()`) d'une formation de ce parcours, ou un compte qui a une ligne `progression_lecons` sur une leçon d'une formation de ce parcours ;
    - un parcours inactif est fermé, sauf à l'équipe.
  - **`public.espaces_communaute() returns jsonb`** : `[{id, nom, nom_court, couleur, slug, ouvert}]` ; d'abord `{id: null, nom: "Général", nom_court: "Général", couleur: null, slug: null, ouvert: true}`, puis les parcours actifs par `ordre`.
  - **`public.carte_publication(p publications) returns jsonb`** (interne) :
    - `{id, auteur: {prenom, nom, role}, est_moi, espace: {id, nom}, titre, texte, piece_jointe, cree_le, modifiee, reactions, j_aime, reponses, dernieres_reponses, peut_supprimer}` ;
    - `role` : `equipe` si l'auteur a un rôle d'équipe, `formateur` s'il a ce rôle, sinon nul ;
    - `espace.nom` : « général » ou le `nom_court` du parcours ;
    - `peut_supprimer` : l'auteur ou l'équipe ;
    - `reactions`, `j_aime`, `reponses` et `dernieres_reponses` valent 0, faux, 0 et `[]` jusqu'à la tâche 2.
  - **`public.fil_communaute(p_espace text, p_avant timestamptz default null, p_avant_id uuid default null, p_nombre integer default 20) returns jsonb`** :
    - `{publications: [...], suite: bool}` ;
    - `tous` : les publications des espaces ouverts au compte ; un id de parcours : cet espace, `[]` s'il est fermé ;
    - tri `(cree_le desc, id desc)` ; curseur `(cree_le, id) < (p_avant, p_avant_id)` ; nombre borné de 1 à 50.
  - **`public.publication_communaute(p_id uuid) returns jsonb`** : la carte plus `toutes_reponses` (`[]` jusqu'à la tâche 2) ; null si inconnue ou fermée.
  - **`public.publier(p_parcours uuid, p_titre text, p_texte text, p_piece jsonb default null) returns uuid`** :
    - textes nettoyés ;
    - la pièce `{chemin, nom, type, taille}` : `(storage.foldername(chemin))[1] = auth.uid()::text`, `chemin !~ '\.\.'`, un objet existant dans `storage.objects` (espace `communaute`), l'un des 4 types, taille de 10 Mo au plus ;
    - sinon « Ce fichier n’est pas le vôtre. ».
  - **`public.modifier_publication(p_id uuid, p_titre text, p_texte text) returns void`** : l'auteur seulement ; `modifiee = true`.
  - **`public.supprimer_publication(p_id uuid) returns text`** : l'auteur ou l'équipe ; rend le `chemin` de la pièce jointe, ou nul.
  - **Stockage :**
    - l'espace `communaute` (privé, 10485760 octets, les 4 types) ;
    - règles sur `storage.objects` :
      - déposer : `bucket_id = 'communaute'`, son dossier, et `not compte_suspendu()` ;
      - lire : son dossier, ou une publication qui l'attache et que `peut_lire_espace` ouvre ;
      - supprimer : son dossier, ou l'équipe.
  - **Messages** de la spec, §5.

- [ ] **Step 1 : Tests qui échouent.**
  - Préparation :
    - un formateur `F` (fiche, une formation `X` du parcours `P`) ;
    - un étudiant `E1` qui suit `X` ; un étudiant `E2` qui ne suit rien ;
    - un admin `A` ; un parcours `Q` sans suiveur.

```ts
it("espaces_communaute : Général d'abord, puis les parcours ; ouvert selon le compte", …)       // E1 : P ouvert, Q fermé ; E2 : seulement Général ; A : tout
it("publier : général pour tous ; parcours pour le suiveur, le formateur et l'équipe ; refus pour E2", …)
it("publier : textes nettoyés et bornés ; titre facultatif", …)
it("fil « tous » : mêle les espaces ouverts, jamais un espace fermé ; fil d'un espace fermé : vide", …)
it("Voir plus : 25 publications de la même seconde, lues par 20 puis à partir de la dernière : 25 distinctes", …)
it("modifier : l'auteur seulement, « modifiee » ; supprimer : l'auteur ou l'équipe, chemin du fichier rendu", …)
it("pièce jointe : refusée hors de son dossier, avec « .. », inexistante ou d'un autre type ; acceptée sinon", …)
it("stockage : le fichier se lit par un compte de l'espace, pas par un autre ; on ne dépose que dans son dossier", …)
it("carte : rôle formateur ou équipe, est_moi, peut_supprimer ; aucune adresse e-mail", …)
it("compte suspendu et visiteur : refusés ; la migration est rejouable", …)
```

- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/db/communaute.test.ts` → FAIL.
- [ ] **Step 3 : Écrire.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS.
- [ ] **Step 5 : Commit** : `feat(communaute): espaces, publications et fichiers (migration 0019)`

### Task 2 : Migration 0019 : réponses, réactions, membres actifs

**Files :** Modify `web/supabase/migrations/0019_communaute.sql` ; Test `web/tests/db/communaute.test.ts`.

**Interfaces :**
- Produces :
  - **Tables** (fermées aux comptes) :
    - `public.commentaires_publications (id uuid, publication_id → publications on delete cascade, auteur → profils on delete cascade, texte, cree_le)` ;
    - `public.reactions_publications (publication_id → publications on delete cascade, profil_id → profils on delete cascade, cree_le, primary key (publication_id, profil_id))`.
  - **`carte_publication`** complète :
    - `reactions`, `j_aime`, `reponses` (nombre) ;
    - `dernieres_reponses` : les 2 plus récentes, dans l'ordre chronologique, `[{id, auteur: {prenom, nom_court}, est_moi, texte, cree_le, peut_supprimer}]`, où `nom_court` vaut `nom_avis(prenom, nom)`.
  - **`publication_communaute`** : `toutes_reponses`, dans l'ordre chronologique.
  - **`public.commenter(p_publication uuid, p_texte text) returns uuid`** :
    - « Cette publication n’existe plus. » si elle est inconnue ; « Cet espace ne vous est pas ouvert. » si l'espace est fermé ;
    - puis notifie l'auteur de la publication : catégorie `communaute`, « Nouvelle réponse » · « <nom_avis> a répondu à votre publication dans l’espace <nom> » (« dans l’espace général »), lien `/communaute/publications/<id>`.
  - **`public.supprimer_commentaire(p_id uuid) returns void`** : l'auteur ou l'équipe.
  - **`public.basculer_reaction(p_publication uuid) returns jsonb`** : `{j_aime, reactions}` ; mêmes refus que `commenter`.
  - **`public.membres_actifs() returns jsonb`** :
    - `[{prenom, nom_court, initiales, espace}]` : les 3 comptes qui ont le plus publié et répondu en 7 jours dans les espaces ouverts au demandeur ;
    - `espace` : le nom de l'espace où ils ont le plus écrit (« Général » ou le nom court du parcours).

- [ ] **Step 1 : Tests qui échouent**

```ts
it("répondre : réponses et 2 dernières dans l'ordre ; « Nouvelle réponse » à l'auteur, pas à soi", …)
it("répondre ou aimer dans un espace fermé : refus ; publication inconnue : « Cette publication n’existe plus. »", …)
it("supprimer une réponse : l'auteur ou l'équipe ; un autre : refus", …)
it("J’aime bascule : 1 puis 0 ; j_aime suit le compte", …)
it("supprimer une publication emporte ses réponses et ses réactions", …)
it("membres actifs : 3 au plus, les plus actifs, avec leur espace ; jamais un espace fermé au demandeur", …)
```

- [ ] **Step 2 : Lancer, ça échoue** → FAIL.
- [ ] **Step 3 : Écrire.**
- [ ] **Step 4 : Lancer, ça passe** : `cd web && npx vitest run tests/db` → PASS.
- [ ] **Step 5 : Commit** : `feat(communaute): réponses, réactions et membres actifs (migration 0019)`

### Task 3 : Règles, lectures et actions

**Files :**
- Create (sous `web/src/lib/communaute/`) : `types.ts`, `regles.ts`, `data.ts`, `actions.ts` (`"use server"`).
- Test (sous `web/tests/communaute/`) : `regles.test.ts`, `data.test.ts`, `actions.test.ts`.

**Interfaces :**
- Consumes : les fonctions SQL des tâches 1 et 2 ; `Lecture<T>`, `estFonctionAbsente`, `getShellUser`, `SESSION_EXPIREE` ; `quand` (`lib/notifications/temps`).
- Produces :
  - **`types.ts`** :
    - `Espace = { id: string | null; nom: string; nomCourt: string; couleur: string | null; slug: string | null; ouvert: boolean }` ;
    - `PieceJointe = { chemin: string; nom: string; type: string; taille: number; url: string | null }` ;
    - `Reponse = { id; auteur: { prenom; nomCourt }; estMoi; texte; creeLe; peutSupprimer }` ;
    - `Publication = { id; auteur: { prenom; nom; role: "formateur" | "equipe" | null }; estMoi; espace: { id: string | null; nom: string }; titre; texte; pieceJointe: PieceJointe | null; creeLe; modifiee; reactions; jAime; reponses: number; dernieresReponses: Reponse[]; peutSupprimer }` ;
    - `LotPublications = { publications: Publication[]; suite: boolean }` ;
    - `MembreActif = { prenom; nomCourt; initiales; espace }`.
  - **`regles.ts`** :
    - `TITRE_MAX = 120` ; `TEXTE_MAX = 3000` ; `REPONSE_MAX = 1000` ; `PIECE_MAX_OCTETS = 10485760` ; `TYPES_PIECE` (les 4) ; `NOMBRE_FIL = 20` ;
    - `refusPublication(titre, texte): string | null` ; `refusReponse(texte): string | null` ;
    - `tailleLisible(octets)` → « 240 Ko », « 1,2 Mo » ;
    - `nomEspace(espace)` → « Espace Académique », « Espace général » ;
    - `curseur(p: Publication)` → `{ avant: creeLe, avantId: id }`.
  - **`data.ts`** (fonction absente → `migrationAbsente`) :
    - `lireEspaces(): Promise<Lecture<Espace[]>>` ;
    - `lireFil(espace: string, curseur?: { avant: string; avantId: string } | null): Promise<Lecture<LotPublications>>` ;
    - `lirePublication(id): Promise<Lecture<(Publication & { toutesReponses: Reponse[] }) | null>>` ;
    - `lireMembresActifs(): Promise<Lecture<MembreActif[]>>` ;
    - les pièces jointes reçoivent leur `url` par `createSignedUrls` (3 600 s) en un seul appel par lecture ; `null` si le lien échoue.
  - **`actions.ts`** (session vérifiée ; message `P0001` rendu tel quel ; `refresh()` après chaque écriture réussie) :
    - `chargerFil(espace, curseur)` ;
    - `publierPublication(espaceId: string | null, titre, texte, piece: Omit<PieceJointe, "url"> | null): Promise<{ ok: true; id: string } | { ok: false; message: string }>` : si la base refuse, le fichier est retiré du stockage ;
    - `modifierPublication(id, titre, texte)` ;
    - `supprimerPublication(id)` : retire ensuite le fichier rendu par la base ;
    - `repondre(publicationId, texte): Promise<{ ok: true; reponse: Reponse } | { ok: false; message }>` ;
    - `supprimerReponse(id)` ;
    - `aimer(publicationId): Promise<{ ok: true; jAime: boolean; reactions: number } | { ok: false; message }>`.

- [ ] **Step 1 : Tests qui échouent**
  - `regles` : limites et messages ; `tailleLisible(245760)` → « 240 Ko », `tailleLisible(1258291)` → « 1,2 Mo » ; `nomEspace`.
  - `data` : conversions ; liens temporaires des fichiers (un seul `createSignedUrls`) ; `migrationAbsente`.
  - `actions` :
    - refus sans session ;
    - `refusPublication` avant tout appel ;
    - `publierPublication` refusée par la base : `storage.remove([chemin])` est appelé ;
    - `supprimerPublication` retire le fichier rendu ;
    - `aimer` et `repondre` convertis.
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/communaute` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe**, puis `npx tsc --noEmit`.
- [ ] **Step 5 : Commit** : `feat(communaute): règles, lectures et actions`

### Task 4 : La page Communauté et la page d'une publication

**Files :**
- Create (sous `web/src/components/communaute/`) :
  - `PageCommunaute.tsx` (client) : en-tête, onglets, fil, Voir plus, colonne de droite ;
  - `ChampPublication.tsx` (client) : titre, texte, Image et Fichier, Publier ;
  - `CartePublication.tsx` (client) : menu, modification sur place, suppression confirmée, J’aime, réponses ;
  - `Reponses.tsx` (client) ;
  - `EspaceVerrouille.tsx` ;
  - `ColonneCommunaute.tsx` ;
  - `ContenuCommunaute.tsx` (serveur) ;
  - `PagePublication.tsx` (serveur).
- Create : `web/src/app/(app)/(etudiant)/communaute/publications/[id]/page.tsx`.
- Modify :
  - `web/src/app/(app)/(etudiant)/communaute/page.tsx` (remplace la page à venir) ;
  - `web/src/lib/pages-a-venir.ts` (retirer `communaute`) ;
  - les tests qui prenaient « communaute » comme exemple de page à venir prennent « messages ».
- Test : `web/tests/communaute/page.test.tsx` ; `web/tests/layout` (verts).

**Interfaces :**
- Consumes : tâche 3 ; `lireProchaineSession` (sessions live) ; `SegmentedTabs` ou `FilterChips` (comme le design : des onglets à cadenas), `Menu`, `ConfirmDialog`, `Avatar`, `Tag`, `Button`, `Textarea`, `TextInput`, `Toast`, `EmptyState`, `Banner` ; `createClient` du navigateur et `formatDe` pour l'envoi.
- Produces : les textes et les comportements du §3 de la spec :
  - envoi du fichier dans `communaute/<compte>/<uuid>.<ext>`, avant `publierPublication` ;
  - « Publication en ligne » ;
  - « Lien copié » (`navigator.clipboard.writeText` de l'adresse absolue de la publication) ;
  - « Publication supprimée ».

- [ ] **Step 1 : Tests qui échouent**
  - « en-tête, onglets Général puis parcours ; un espace fermé : cadenas, puis « Espace <nom> verrouillé » et le lien vers ses formations » ;
  - « changer d'onglet appelle chargerFil(id) ; Voir plus avec le curseur de la dernière publication » ;
  - « publier : chargerFil inchangé, la publication s'ajoute en haut, « Publication en ligne » ; un refus s'affiche ; texte vide refusé sans appel » ;
  - « pièce jointe : un fichier d'un autre type est refusé sans envoi ; une image est envoyée dans le dossier du compte puis passée à publierPublication » ;
  - « une publication : nom, Formateur ou Équipe Étudium ou Vous, Espace Académique · il y a 2 h, titre, texte, image ou PDF (nom · taille), J’aime 24, 2 réponses » ;
  - « menu : Copier le lien (Lien copié), Modifier (l'auteur), Supprimer (l'auteur ou l'équipe) avec la confirmation du design » ;
  - « J’aime bascule ; Voir les 5 réponses les déplie (lirePublication) ; Répondre ajoute la réponse ; Supprimer une réponse » ;
  - « vide : Aucune publication pour l’instant » ;
  - « colonne de droite : Prochaine session, Membres actifs » ;
  - « page d'une publication : toutes ses réponses ; introuvable : page introuvable » ;
  - « avant la 0019 : le bandeau ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/communaute tests/layout` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** : même commande → PASS (`session-guard` et `pages` compris).
- [ ] **Step 5 : Commit** : `feat(communaute): la page Communauté et la page d'une publication`

### Task 5 : Rendu et guide

- [ ] **Step 1 :** `cd web && npm run lint && npx tsc --noEmit && npm run build` → succès, sans message d'erreur dans le journal.
- [ ] **Step 2 : Mesurer à 1440, 390 et 320 px** des rendus statiques, temporaires et jamais commités :
  - le fil, avec une publication de 3 000 caractères sans espace, une image et un PDF au nom de 120 caractères ;
  - un espace verrouillé ;
  - la colonne de droite.
  - Attendu : aucun débordement.
- [ ] **Step 3 : Section 24 du guide** :
  1. appliquer la 0019 ;
  2. avec le compte étudiant, Communauté : publier dans Général avec une image ;
  3. un onglet de parcours fermé : le cadenas et le lien ;
  4. avec le compte formateur, répondre ; l'étudiant reçoit « Nouvelle réponse » ;
  5. J’aime, Copier le lien (la page de la publication s'ouvre), Modifier, Supprimer ;
  6. avec ton compte, supprimer la publication d'un autre ;
  7. sur téléphone.
- [ ] **Step 4 :** `cd web && npx vitest run` → toute la suite passe.
- [ ] **Step 5 : Commit** : `docs: guide de validation de la communauté`
