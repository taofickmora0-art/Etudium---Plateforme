# Communauté : mise en forme et vidéo — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un éditeur visuel (titres, gras, italique, souligné, barré, listes, citation) pour les publications, et une vidéo jointe (YouTube, Vimeo, Dailymotion, Loom, TikTok, Facebook, Instagram, Drive, fichier direct ; carte pour les autres).

**Architecture:** le texte reste dans `publications.texte` en Markdown restreint, converti par un module pur (éditeur ↔ Markdown ↔ éléments React). La vidéo est reconnue par un module pur, rangée dans `publications.video` (migration 0022, vérifiée par la base), et affichée par un lecteur construit depuis la plateforme et l'identifiant.

**Tech Stack:** Next.js 16.4 (cacheComponents), React 19.3, Tiptap 3.31.3, Supabase/Postgres, Vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-10-14-communaute-mise-en-forme-video-design.md`

## Global Constraints

- Tous les textes en français ; apostrophes typographiques (’) dans les messages.
- Aucun HTML venu d'un compte n'est injecté (`dangerouslySetInnerHTML` interdit pour le texte d'une publication).
- Messages de la base : « Cette vidéo n’est pas reconnue. » ; « Écrivez votre publication (3 000 caractères au plus). » inchangé.
- Rejouable ; `security definer` + `set search_path = ''` ; droits explicites.
- Avant la 0022 : publier sans vidéo marche comme avant ; avec une vidéo, le message « Appliquez la migration 0022 (guide « Ce qui te revient », section 27). ».
- Sur téléphone, tailles compactes (`max-sm:`).

## Review Focus

1. **Un texte forgé par un appel direct** (balises HTML, `javascript:`, marques imbriquées à l'infini) : affiché comme du texte, sans HTML ni lien dangereux, sans plantage.
2. **Une vidéo forgée** (plateforme inconnue, identifiant avec `/` ou `?`, adresse `http:` ou `javascript:`) : refusée par la base ; le lecteur n'utilise jamais une adresse fournie.
3. **Une ancienne publication** contenant `*`, `#`, `-` ou `>` : s'affiche comme avant, sans marque perdue.
4. **L'aller-retour de l'éditeur** : ouvrir « Modifier » puis enregistrer sans rien changer rend le même texte.
5. **Le premier lien** d'un texte mis en forme (`**https://…**`) : l'aperçu lit la bonne adresse, sans `**`.

---

### Task 1 : Le format (module pur)

**Files :** Create `web/src/lib/communaute/mise-en-forme.ts` ; test `web/tests/communaute/mise-en-forme.test.ts`.

**Interfaces — Produces :**
- `type Marque = "gras" | "italique" | "souligne" | "barre"` ; `type Segment = { texte: string; marques: Marque[] } | { saut: true }`
- `type Bloc = { type: "paragraphe"; segments: Segment[] } | { type: "titre"; niveau: 1|2|3; segments: Segment[] } | { type: "puces" | "numeros"; elements: Segment[][] } | { type: "citation"; segments: Segment[] }`
- `analyser(markdown: string): Bloc[]`
- `texteBrut(markdown: string): string` (sans marques ; listes et titres sur leurs lignes)
- `versMarkdown(doc: JSONContent): string` (document Tiptap → Markdown) ; `versDocument(markdown: string): JSONContent`
- [ ] Tests : chaque marque et bloc ; imbrication `***a***` ; marque sans fermeture laissée telle quelle ; `\*` ; ancienne publication « 5 * 3 = 15 » et « #IA » ; aller-retour `versMarkdown(versDocument(m)) === m` sur un texte complet ; échappement d'un `*` littéral et d'un `#` en début de ligne ; 10 000 `*` sans plantage (temps borné) ; `texteBrut` d'un lien en gras.
- [ ] FAIL → implémenter → PASS → commit `feat(communaute): le format du texte mis en forme`

### Task 2 : La vidéo (module pur)

**Files :** Create `web/src/lib/communaute/video.ts` ; test `web/tests/communaute/video.test.ts`.

**Interfaces — Produces :**
- `type PlateformeVideo = "youtube" | "vimeo" | "dailymotion" | "loom" | "tiktok" | "facebook" | "instagram" | "drive" | "fichier" | "autre"`
- `type Video = { plateforme: PlateformeVideo; url: string; id?: string; h?: string; titre?: string; image?: string | null }`
- `reconnaitreVideo(adresse: string): Video | null` (null : pas une adresse https/http valide)
- `lecteurVideo(v: Video): string | null` (adresse du lecteur intégré ; null pour fichier et autre) ; `miniatureVideo(v): string | null` ; `verticale(v): boolean` (TikTok, Instagram) ; `nomPlateforme(v): string`
- [ ] Tests : une adresse par plateforme (dont youtu.be, shorts, vimeo avec h, dai.ly, fb watch?v=, /videos/, reel, drive /view) ; `.mp4` ; `http://` d'un fichier refusé (fichier en https seulement) ; autre site → `autre` ; `javascript:` → null ; identifiants hors forme → `autre`.
- [ ] FAIL → implémenter → PASS → commit `feat(communaute): reconnaître les vidéos jointes`

### Task 3 : Migration 0022

**Files :** Create `web/supabase/migrations/0022_communaute_video.sql` ; test `web/tests/db/video.test.ts`.

**Interfaces — Produces :** `publications.video`, `verifier_video(jsonb)`, `publier(uuid, text, text, jsonb, jsonb, jsonb, jsonb)`, `carte_publication.video`.
- [ ] Tests : chaque plateforme acceptée et normalisée (champs inconnus retirés) ; identifiant hors forme, plateforme inconnue, `http:`/`javascript:`, adresse trop longue → « Cette vidéo n’est pas reconnue. » ; la carte rend la vidéo ; une seule signature de `publier` ; rejouable.
- [ ] FAIL → implémenter → PASS → commit `feat(communaute): la vidéo jointe (migration 0022)`

### Task 4 : Serveur

**Files :** Modify `lib/communaute/{types,data,actions}.ts`, `lib/moderation/{types,analyse}.ts` ; tests `tests/communaute/{data,actions}.test.ts`, `tests/moderation/analyse.test.ts`.

**Interfaces — Produces :** `Publication.video: Video | null` ; `publierPublication(espaceId, titre, texte, piece, video?: string | null)` → `{ ok, id, statut, apercu, video }` ; l'IA reçoit `video: { url, titre? }`.
- [ ] Tests : vidéo reconnue transmise (`p_video`) ; autre plateforme : réservation puis lecture de la page (titre, image) ; adresse invalide → « Collez l’adresse complète de la vidéo (https://…). » sans appel ; avant la 0022 avec vidéo → message de migration ; sans vidéo, l'ancien appel ; le premier lien cherché dans le texte sans marques.
- [ ] FAIL → implémenter → PASS → commit `feat(communaute): publier avec une vidéo et un texte mis en forme`

### Task 5 : Écrans

**Files :** Create `components/communaute/{EditeurTexte,BarreMiseEnForme,TexteMisEnForme,VideoIntegree,ChampVideo}.tsx` ; modify `ChampPublication`, `CartePublication`, `ColonneCommunaute`, `VideoYoutube` (devient un cas de VideoIntegree), `components/admin/moderation/ElementModeration.tsx` ; tests `tests/communaute/*.test.tsx`.
- [ ] Tests : `TexteMisEnForme` (titres h4-h6, gras…, listes, citation, liens) ; la barre d'outils pilote l'éditeur (commandes appelées, état actif) ; champ Vidéo : aperçu, retrait, transmis à `publierPublication` ; carte : lecteur au clic par plateforme, carte d'une autre plateforme, aperçu non répété ; extraits sans marques.
- [ ] FAIL → implémenter → PASS → commit `feat(communaute): l'éditeur, la vidéo et l'affichage mis en forme`

### Task 6 : Vérification, guide, suite

- [ ] lint, types, build ; l'éditeur réel essayé dans le navigateur (page temporaire non commitée) à 1440 et 360 px ; guide section 27 ; suite complète ; commit `docs: guide de la mise en forme et des vidéos`.
