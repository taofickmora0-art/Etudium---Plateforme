# Communauté v2, le fil « Actualités » : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** refaire la communauté sur le modèle du fil « Actualités » : annonce épinglée, liens et aperçus, tri et enregistrements, commentaires visibles, tendances et activités récentes, téléphone et back-office.

**Architecture :** la migration 0021 étend la 0020 : aperçu des publications, signets, nouveau fil, tendances, activités, annonce épinglée. Le serveur Next lit la page d'un lien au moment de publier, avec une garde contre les adresses privées, et transmet l'aperçu à la base, qui le vérifie. Les écrans suivent la toile de design, version 6.

**Tech Stack :** Next.js 16.4 (cacheComponents), Supabase (RLS, `security definer`), `node:dns` pour la garde des adresses, Vitest et PGlite.

**Spec :** `docs/superpowers/specs/2026-10-14-communaute-actualites-design.md`

## Global Constraints

- Textes en français, mot pour mot ceux de la spec et du design (`NdCommunaute`, `NdMobCommunaute`, `NdMobCommunautePublications`, `NdMobMenuOuvert`, `NdAdminAnnonceCommunaute`).
- Fonctions : `security definer`, `set search_path = ''`, `exiger_compte_actif()` ; jamais l'heure du client ; les filtres de visibilité de la 0020 (`publication_visible`, `peut_lire_espace`) partout.
- Lecture d'une page : `http`/`https`, ports 80 et 443, aucune adresse privée (IPv4 : 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, 224/4 et plus ; IPv6 : `::`, `::1`, `fc00::/7`, `fe80::/10`, et les IPv4 mappées), 3 redirections, 4 000 ms, 524 288 octets, `text/html` seulement.
- Aperçu : titre ≤ 200, description ≤ 300, image ≤ 1 000 caractères, adresse ≤ 2 000 ; YouTube : identifiant `^[A-Za-z0-9_-]{11}$`.
- Annonce : titre ≤ 120, texte ≤ 500.
- Rendu sans débordement à 1440, 390 et 320 px.
- Avant la 0021 : la communauté marche comme avant (sans aperçu ni signet ni annonce) ; la page de l'annonce affiche « Appliquez la migration 0021 (guide « Ce qui te revient », section 26). ».
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Un aperçu fabriqué** (adresse absente du texte, domaine trompeur) : la base le refuse, la carte montre le domaine tiré de l'adresse → tâche 1 et tâche 5.
2. **Une page qui redirige vers une adresse privée**, ou un nom qui en résout une : aucune lecture → tâche 3.
3. **Une publication en attente ou bloquée** : jamais dans les tendances, les activités ni le tri « populaires » ; un signet sur une publication devenue invisible ne la montre pas → tâche 1.
4. **L'annonce d'un parcours** : invisible d'un compte qui n'en lit pas l'espace, son affiche illisible → tâche 2.
5. **Le passage à 0021 sans recharger** : un appel de l'ancienne forme (`fil_communaute` à 4 paramètres) ne doit plus exister ; l'appli appelle la nouvelle → tâches 1 et 4.

---

### Task 1 : Migration 0021, aperçus, fil, signets, tendances, activités

**Files :** Create `web/supabase/migrations/0021_communaute_actualites.sql`, `web/tests/db/actualites.test.ts`.

**Interfaces :**
- Produces (SQL) :
  - `publications.apercu jsonb` ; `publications_enregistrees (profil_id → profils cascade, publication_id → publications cascade, cree_le, pk (profil_id, publication_id))`, fermée ;
  - `verifier_apercu(p_apercu jsonb, p_texte text) returns jsonb` (interne) : `{type:'youtube', id}` si l'identifiant figure dans le texte ; `{type:'lien', url, titre, description, image}` si l'adresse figure dans le texte ; sinon null ;
  - `publier(p_parcours, p_titre, p_texte, p_piece, p_analyse, p_apercu jsonb default null) returns jsonb` et `modifier_publication(p_id, p_titre, p_texte, p_analyse, p_apercu jsonb default null) returns jsonb` : comme la 0020 (verdict, objet, attente, limites) + l'aperçu vérifié ; les anciennes signatures supprimées ;
  - `carte_publication` ajoute `apercu`, `enregistree`, `aimee_par` (initiales des 3 derniers, du plus récent au plus ancien) ;
  - `drop function fil_communaute(text, timestamptz, uuid, integer)` ; `fil_communaute(p_espace text, p_tri text default 'recentes', p_avant timestamptz default null, p_avant_id uuid default null, p_page integer default 0, p_nombre integer default 20) returns jsonb` : `p_espace` `tous` | `general` | id d'un parcours ; `p_tri` `recentes` (curseur) | `populaires` (J’aime + 2 × commentaires sur 30 jours, puis date ; pages) | `enregistrees` (les signets du compte, du plus récent ; pages) ; `{publications, suite}` ;
  - `basculer_enregistrement(p_publication uuid) returns boolean` (publication ouverte, en ligne) ;
  - `publications_tendances() returns jsonb` : 5 au plus, 7 jours, `[{id, extrait, auteur:{nom_court, initiales, equipe}}]` ;
  - `activites_recentes() returns jsonb` : 6 au plus, `[{type:'publication'|'commentaire', publication_id, auteur:{nom_court, initiales}, extrait, cree_le}]`.
- [ ] **Step 1 : Tests qui échouent** (`tests/db/actualites.test.ts`, banc de `moderation.test.ts` + 0021) :
  - « aperçu : vérifié et rangé ; adresse ou identifiant absents du texte : aucun aperçu ; longueurs coupées » ;
  - « fil : general (espace général seul), tous, un parcours ; tri populaires (score, puis date) ; enregistrees (les siennes seulement) ; pages et suite » ;
  - « signet : bascule ; publication d'un espace fermé ou en attente : refus ; invisible ensuite : absente des enregistrements » ;
  - « carte : apercu, enregistree, aimee_par (3 initiales) » ;
  - « tendances : 7 jours, espaces ouverts, publiées seulement, ordre » ; « activités : publications et commentaires, 6 au plus, espaces fermés et attente exclus » ;
  - « les anciennes signatures n'existent plus ; rejouable ».
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/db/actualites.test.ts` → FAIL.
- [ ] **Step 3 : Écrire la migration** (fonctions de la 0020 recopiées et étendues).
- [ ] **Step 4 : Lancer, ça passe** : plus `tests/db/moderation.test.ts` et `tests/db/communaute.test.ts` → PASS.
- [ ] **Step 5 : Commit** : `feat(communaute): aperçus, tri, signets, tendances et activités (migration 0021)`

### Task 2 : Migration 0021, l'annonce épinglée

**Files :** Modify `0021_communaute_actualites.sql`, `tests/db/actualites.test.ts`.

**Interfaces :**
- Produces (SQL) :
  - `annonce_communaute` (une ligne `id = true`) : `active`, `titre` (≤ 120), `texte` (≤ 500), `media` (`youtube` | `image` | null), `youtube_id`, `image_chemin`, `public` (`tous` | `parcours`), `parcours_id` (→ parcours, set null), `modifiee_le` ; fermée ;
  - `annonce_communaute() returns jsonb` (compte connecté) : null si inactive ou si le compte ne lit pas l'espace du parcours ; sinon `{titre, texte, media, youtube_id, image_chemin}` ;
  - `annonce_equipe() returns jsonb` (équipe) : toute la ligne ;
  - `enregistrer_annonce(p_active boolean, p_titre text, p_texte text, p_media text, p_youtube_id text, p_image_chemin text, p_public text, p_parcours uuid)` (équipe) : messages « Écrivez le titre de l’annonce (120 caractères au plus). », « Le texte de l’annonce dépasse 500 caractères. », « Cette adresse YouTube n’est pas reconnue. », « Choisissez une image JPEG, PNG ou WebP de 10 Mo au plus. », « Choisissez un parcours. » ;
  - `retirer_annonce() returns text` (équipe) : inactive et vidée ; rend l'ancien `image_chemin` ;
  - `fichier_communaute_lisible` : aussi l'affiche de l'annonce active et visible du compte.
- [ ] **Step 1 : Tests qui échouent** : « annonce : inactive → null ; tous ; parcours (visible de qui lit l'espace, sinon null) ; équipe seule pour lire et écrire ; validations ; retirer rend le chemin ; affiche lisible selon le public ».
- [ ] **Step 2 : Lancer, ça échoue.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe.**
- [ ] **Step 5 : Commit** : `feat(communaute): l'annonce épinglée (migration 0021)`

### Task 3 : Les liens et la lecture d'une page

**Files :** Create `web/src/lib/communaute/liens.ts` (règles pures, utilisables par les écrans) et `web/src/lib/communaute/apercu.ts` (serveur) ; tests `web/tests/communaute/liens.test.ts`, `apercu.test.ts`.

**Interfaces :**
- Produces :
  - `liens.ts` : `type Apercu = { type: "youtube"; id: string } | { type: "lien"; url: string; titre: string; description: string; image: string | null }` ; `premiereAdresse(texte): string | null` ; `idYoutube(adresse): string | null` ; `decouperLiens(texte): ({ texte: string } | { lien: string })[]` ; `domaine(url): string` (sans `www.`) ;
  - `apercu.ts` : `adressePrivee(ip: string): boolean` ; `lireApercu(adresse: string, outils = { fetch, resoudre }): Promise<Apercu | null>` ; `apercuDuTexte(texte, outils?): Promise<Apercu | null>` (YouTube sans lecture réseau).
- [ ] **Step 1 : Tests qui échouent** : la première adresse (ponctuation finale retirée) ; YouTube (watch, youtu.be, shorts, refus d'un faux id) ; le découpage ; `adressePrivee` (les plages des contraintes, IPv6, IPv4 mappées) ; la lecture (og, twitter, `<title>`, entités HTML, image relative résolue) ; refus : schéma, port, nom privé, redirection privée, 4 redirections, délai, taille, type non HTML ; échec → null.
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/communaute/liens.test.ts tests/communaute/apercu.test.ts` → FAIL.
- [ ] **Step 3 : Implémenter** (`redirect: "manual"`, lecture du corps par morceaux jusqu'à la limite, `AbortController`).
- [ ] **Step 4 : Lancer, ça passe.**
- [ ] **Step 5 : Commit** : `feat(communaute): liens cliquables et aperçus lus par le serveur`

### Task 4 : Lectures et actions de la communauté v2

**Files :** Modify `web/src/lib/communaute/{types,data,actions}.ts` ; create `web/src/lib/communaute/annonce.ts` (lectures et actions de l'annonce) ; tests `web/tests/communaute/{data,actions}.test.ts`, `annonce.test.ts`.

**Interfaces :**
- Produces :
  - `Publication` gagne `apercu: Apercu | null`, `enregistree: boolean`, `aimeePar: string[]` ; `TriFil = "recentes" | "populaires" | "enregistrees"` ; `Tendance = { id; extrait; auteur: { nomCourt; initiales; equipe: boolean } }` ; `Activite = { type: "publication" | "commentaire"; publicationId; auteur: { nomCourt; initiales }; extrait; creeLe }` ; `Annonce = { titre; texte; media: "youtube" | "image" | null; youtubeId: string | null; image: string | null (lien signé) }` ; `AnnonceEquipe = Annonce & { active; public: "tous" | "parcours"; parcoursId: string | null; imageChemin: string | null }` ;
  - `lireFil(espace: "tous" | "general" | string, tri: TriFil = "recentes", suite?: { curseur?: Curseur | null; page?: number })` ; `chargerFil(espace, tri, suite)` ;
  - `lireTendances()`, `lireActivites()` (Lecture, migrationAbsente avant la 0021) ;
  - `publierPublication` et `modifierPublication` calculent `apercuDuTexte` et passent `p_apercu` (avec la 0021) ;
  - `basculerEnregistrement(id) → { ok: true; enregistree } | { ok: false; message }` ;
  - `annonce.ts` : `lireAnnonce(): Promise<Annonce | null>` ; `lireAnnonceEquipe(): Promise<Lecture<AnnonceEquipe>>` ; actions `enregistrerAnnonce(donnees)` et `retirerAnnonce()` (retire l'affiche du stockage).
- [ ] **Step 1 : Tests qui échouent** (conversions, paramètres transmis, aperçu calculé puis passé, avant la 0021 : sans `p_apercu` ni `p_tri`, signet, annonce).
- [ ] **Step 2 : Lancer, ça échoue.**
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe** ; `npx tsc --noEmit`.
- [ ] **Step 5 : Commit** : `feat(communaute): lectures et actions du fil Actualités`

### Task 5 : Les écrans de la communauté

**Files :** Modify `web/src/components/communaute/*` (PageCommunaute, CartePublication, Reponses, ChampPublication, ColonneCommunaute, ContenuCommunaute, PagePublication) ; create `CarteAnnonce.tsx`, `VideoYoutube.tsx`, `ApercuLien.tsx`, `TexteAvecLiens.tsx`, `MenuTri.tsx` ; tests `web/tests/communaute/*.test.tsx`.

**Interfaces :**
- Consumes : tâches 3 et 4.
- Produces (textes du design et de la spec) :
  - onglets « Actualités », « Général », parcours ;
  - la carte de l'annonce (« Annonce épinglée », vidéo au clic : `iframe` `https://www.youtube-nocookie.com/embed/<id>?autoplay=1` titré « Vidéo YouTube », ⋮ « Gérer l’annonce » pour l'équipe vers `/admin/communaute`) ;
  - le champ fermé « Quoi de neuf, <prénom> ? » (+ Image, Fichier), qui s'ouvre sur le champ complet ;
  - « Trier par : » et le menu « Les plus récentes », « Les plus populaires », « Mes enregistrements » ;
  - la carte : « Publié dans <espace> », signet (« Enregistrer la publication » / « Retirer des enregistrements »), texte avec liens, aperçu (`ApercuLien` : domaine tiré de l'adresse) ou `VideoYoutube`, J’aime et Commenter, les initiales et « N J’aime · N commentaires », les commentaires en bulles, « Voir les N commentaires », « Écrire un commentaire… » ;
  - « réponse » → « commentaire » dans tous les textes de la communauté (fenêtre « Signaler ce commentaire », « Supprimer le commentaire de … », « Commentaire supprimé ») ;
  - la colonne : « Publications tendances », « Activités récentes », « Prochaine session ».
- [ ] **Step 1 : Tests qui échouent** (les écrans existants mis à jour, plus : annonce, vidéo au clic, liens, aperçu au domaine de l'adresse, tri, signet, colonne).
- [ ] **Step 2 : Lancer, ça échoue** : `cd web && npx vitest run tests/communaute` → FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Lancer, ça passe.**
- [ ] **Step 5 : Commit** : `feat(communaute): le fil Actualités`

### Task 6 : Téléphone et menu ≡

**Files :** Modify `MenuTiroir.tsx`, `src/app/(app)/(etudiant)/communaute/page.tsx` et `ContenuCommunaute.tsx` (onglet de départ `?espace=`) ; tests `tests/layout/menu-tiroir.test.tsx`, `tests/communaute/page.test.tsx`.

**Interfaces :**
- Produces : sur `/communaute…`, le tiroir ajoute le groupe « Espaces de la communauté » (Actualités `?espace=tous`, Général `?espace=general`, les parcours `?espace=<id>`, cadenas s'ils sont fermés), lus par une action `chargerEspaces()` ; la page ouvre l'onglet demandé ; les onglets défilent en largeur sur téléphone.
- [ ] **Step 1 : Tests qui échouent.** **Step 2 : FAIL.** **Step 3 : Implémenter.** **Step 4 : PASS.**
- [ ] **Step 5 : Commit** : `feat(communaute): le téléphone et les espaces dans le menu ≡`

### Task 7 : L'annonce au back-office

**Files :** Create `web/src/app/(app)/admin/communaute/page.tsx`, `web/src/components/admin/communaute/*` ; modify `web/src/lib/navigation.ts` (entrée « Communauté » du groupe Plateforme, icône `UserGroupIcon`) ; tests `web/tests/admin/annonce.test.tsx`.

**Interfaces :**
- Consumes : tâche 4 (`lireAnnonceEquipe`, `enregistrerAnnonce`, `retirerAnnonce`).
- Produces : la page du design `NdAdminAnnonceCommunaute` (interrupteur, titre, texte, média YouTube ou affiche déposée par le navigateur dans le dossier du compte, public, aperçu à droite, « Annonce enregistrée », retrait confirmé) ; avant la 0021, le bandeau.
- [ ] **Step 1 : Tests qui échouent.** **Step 2 : FAIL.** **Step 3 : Implémenter.** **Step 4 : PASS.**
- [ ] **Step 5 : Commit** : `feat(communaute): l'annonce épinglée au back-office`

### Task 8 : Rendu, guide, suite complète

- [ ] **Step 1 :** `npm run lint && npx tsc --noEmit && npm run build` → succès.
- [ ] **Step 2 :** rendus temporaires à 1440, 390 et 320 px (fil avec annonce, aperçu, YouTube, commentaires ; colonne ; tiroir ; page de l'annonce) : aucun débordement.
- [ ] **Step 3 : Section 26 du guide** : appliquer la 0021 ; écrire l'annonce (YouTube puis affiche, puis un parcours) ; publier un lien Google Meet, un lien YouTube, un site quelconque ; trier ; enregistrer ; tendances et activités ; menu ≡ sur téléphone.
- [ ] **Step 4 :** `npx vitest run` → toute la suite passe.
- [ ] **Step 5 : Commit** : `docs: guide de validation du fil Actualités`
