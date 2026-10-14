# Sessions live : promotion et publication dans la communauté — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** visuel de promotion et aperçu dans le formulaire, publication automatique de la session dans la communauté avec
son bloc (Google Meet / Zoom), bouton « Sessions live programmées » et pastille rouge.

**Architecture:** la migration 0024 relie `sessions_live` et `publications` (création et modification dans les mêmes
fonctions SQL), la carte d'une publication rend le bloc de sa session ; côté écran, un composant `BlocSession` sert à la
carte et à l'aperçu du formulaire ; un compteur « nouvelles sessions » par compte alimente le bouton et la pastille.

**Tech Stack:** Next.js 16.4, React 19.3, Supabase (Postgres, stockage « communaute »), vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-10-14-sessions-promotion-design.md`

## Global Constraints

- Textes en français, apostrophe typographique ; le lien du live n'apparaît jamais dans une publication.
- Migrations rejouables, `set search_path = ''` ; la 0024 reprend `modifier_session` de la **0023** et
  `carte_publication` de la **0022** par script (aucune recopie à la main).
- Téléphone : tailles compactes `max-sm:` ; fichiers d'essai jamais commités.

## Review Focus

1. Modifier une session sans changer son affiche : l'affiche reste (pas refusée comme « déjà attachée »).
2. Remplacer l'affiche : l'ancienne n'est plus attachée et peut être retirée du stockage.
3. Une session « Tous les parcours » : sa publication est dans Général, lisible par tous.
4. Le compteur ne compte ni ses propres sessions, ni les passées, ni les annulées ; un compte neuf voit les sessions à venir comme nouvelles.
5. Avant la 0024 : programmer une session marche encore (sans visuel), la page Communauté et le menu ne cassent pas.

---

### Task 1: Migration 0024

**Files:** Create `web/supabase/migrations/0024_sessions_promotion.sql` (script `scratchpad/migration_0024.py`) ;
Test `web/tests/db/sessions-promotion.test.ts` ; Modify `docs/guides/ce-qui-te-revient.md` (section 29).

**Interfaces — Produces:**
- `creer_session(p_titre, p_description, p_debut, p_duree, p_lien, p_parcours, p_formateur, p_image jsonb default null, p_video jsonb default null) returns uuid`
- `modifier_session(p_session, p_titre, p_description, p_debut, p_duree, p_lien, p_parcours, p_formateur, p_image jsonb default null, p_video jsonb default null) returns void`
- `session_detail` rend en plus `promo_image` ({chemin, nom, type, taille} | null) et `promo_video`.
- `carte_publication` rend en plus `session` : `{id, debut, duree_minutes, plateforme, animateur, statut, inscriptions, inscrit}` | null.
- `nouvelles_sessions() returns integer`, `marquer_evenements_vus() returns void`.
- Messages : « Choisissez une affiche ou une vidéo, pas les deux. » ; « Ce fichier n’est pas le vôtre. » (verifier_piece) ;
  affiche non image : « L’affiche doit être une image (JPG, PNG ou WebP). ».

- [ ] Tests PGlite (RED) : publication créée (auteur, espace = parcours, titre, texte = description ou « Session live
  programmée. », piece_jointe = affiche, video) ; modifier met à jour la publication et garde la même affiche ; affiche +
  vidéo refusées ; PDF refusé ; affiche d'un autre dossier refusée ; carte : `session.plateforme = 'Google Meet'`,
  `statut = 'annulee'` après `annuler_session` ; compteur (nouvelle, puis 0 après `marquer_evenements_vus`, pas les siennes
  ni annulées ni passées).
- [ ] Générer la migration, `npx vitest run tests/db/sessions-promotion.test.ts tests/db/sessions-rappels.test.ts` vert ; guide §29.
- [ ] Commit `feat(sessions): publication dans la communauté et visuel de promotion (0024)`.

### Task 2: Données et actions

**Files:** Modify `web/src/lib/sessions/{types,data,actions}.ts`, `web/src/lib/communaute/{types,data}.ts` ;
Create `web/src/lib/sessions/nouvelles.ts` (actions `compterNouvellesSessions`, `marquerEvenementsVus`) ;
Test `web/tests/sessions/actions-promotion.test.ts`, `web/tests/communaute/data.test.ts`.

**Interfaces — Produces:**
- `DonneesSession` + `image: PieceSession | null` (`{ chemin, nom, type, taille }`) et `video: string | null` (adresse).
- `SessionDetail` + `promoImage: (PieceSession & { url: string | null }) | null`, `promoVideo: Video | null`.
- `Publication.session: SessionPublication | null` (`{ id, debut, dureeMinutes, plateforme, animateur, statut, inscriptions, inscrit }`).
- `creerSession`/`modifierSession` : vidéo reconnue par `reconnaitreVideo` (sinon « Collez l’adresse complète de la
  vidéo (https://…). »), transmise en `p_video` ; `p_image` transmise telle quelle ; avant la 0024 (fonction absente
  avec ces paramètres) : nouvel appel sans eux si aucun visuel, sinon « Appliquez la migration 0024 (guide « Ce qui te
  revient », section 29). ».
- `compterNouvellesSessions(): Promise<number>` (0 sans session, sans la 0024 ou en erreur) ; `marquerEvenementsVus(): Promise<void>`.

- [ ] Tests (RED) puis implémentation, `npx vitest run tests/sessions tests/communaute` vert, commit.

### Task 3: Le bloc de session dans la carte

**Files:** Create `web/src/components/sessions/BlocSession.tsx` ; Modify `web/src/components/communaute/CartePublication.tsx` ;
Test `web/tests/sessions/bloc-session.test.tsx`.

**Interfaces — Produces:** `BlocSession({ session: SessionPublication; maintenant?: Date })` : tuile date (« OCT. » « 24 »),
« Session live », « Samedi 24 octobre · 15 h 00 », plateforme (icône + nom), animateur, « N inscriptions », lien
« Voir la session » vers `/evenements` ; annulée : « Annulée », pas de lien.

- [ ] Tests (RED), implémentation, commit.

### Task 4: Le formulaire : visuel de promotion et aperçu

**Files:** Modify `web/src/components/sessions/FormulaireSession.tsx`, `PageSessionsEdition.tsx` (largeur) ;
Create `web/src/components/sessions/ApercuSessionCommunaute.tsx` ; Test `web/tests/sessions/formulaire-promotion.test.tsx`.

- Rubrique « Visuel de promotion » : « Ajouter une affiche » (fichier image, dépôt dans `communaute/<compte>/<id>.<ext>`
  par le navigateur, contrôle `verifierPiece` existant si réutilisable), « Ajouter une vidéo » (champ d'adresse, aperçu
  `VideoIntegree`), « Retirer le visuel ». Aperçu à droite (`xl:` deux colonnes), dessous sur les écrans plus petits.
- [ ] Tests (RED) : l'aperçu reprend titre, description, espace et plateforme (Google Meet d'après le lien) ; une vidéo
  YouTube s'affiche ; l'affiche choisie aussi ; `creerSession` reçoit `image`/`video`. Puis implémentation, commit.

### Task 5: « Sessions live programmées » et pastille

**Files:** Create `web/src/components/sessions/BoutonSessionsProgrammees.tsx`, `web/src/components/sessions/useNouvellesSessions.ts` ;
Modify `PageCommunaute.tsx`, `SidebarNav.tsx` (pastille sur Événements), `MobileProfileMenu.tsx`, `PageEvenements.tsx`
(appel `marquerEvenementsVus` à l'ouverture) ; Test `web/tests/sessions/nouvelles-sessions.test.tsx`.

- [ ] Tests (RED) : bouton avec « 2 » en pastille et lien `/evenements` ; sans session à venir, pas de bouton ; pastille
  sur Événements dans la barre latérale ; la page Événements appelle `marquerEvenementsVus`. Implémentation, commit.

### Task 6: Vérification

- [ ] lint, types, suite complète, compilation ; rendu du formulaire et de la carte à 1440 et 390 px (page d'essai supprimée).
