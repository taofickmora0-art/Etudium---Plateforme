# Lot 5, étape B : push et e-mails importants — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** les notifications partent aussi en push (navigateur, téléphone une fois en https). Les messages importants (abonnement, paiement, compte) partent aussi par e-mail. Tout passe par une file d'envoi en base, vidée par le serveur de l'appli.

**Architecture :**
- **Base (migration 0058) :**
  - la file `envois` ;
  - le push, mis dans la file par un déclencheur sur `notifications` ;
  - l'e-mail, mis dans la file par `notifier` pour les notifications importantes, avant les filtres de préférences ;
  - la notification « Paiement reçu » ;
  - les e-mails de suspension et de réactivation.
- **Serveur :** il prend la file avec un jeton dont la base garde l'empreinte, envoie (Web Push avec `web-push`, e-mail avec l'API Resend en `fetch`), puis termine chaque envoi.
- **Navigateur :** un service worker `public/sw.js` affiche les notifications push.

**Tech Stack :** Next.js 16 (`web/`), Supabase (Postgres, pg_cron), `web-push` (à ajouter, avec ses types), Vitest (jsdom, banc PGlite, faux Supabase).

**Spec :** `docs/superpowers/specs/2026-11-01-lot-5-etape-b-push-emails-design.md` (avec `2026-10-15-lot-5-fin-messagerie-push-desactivation-design.md`, étape B).

## Global Constraints

- **Textes :** en français, avec la typographie française.
- **Migration :** rejouable. Les fonctions sont en `security definer`, `set search_path = ''`, et leurs droits sont retirés puis accordés explicitement.
- **Secrets :**
  - jamais lus par Claude ;
  - seule la clé publique VAPID porte le préfixe `NEXT_PUBLIC_` ;
  - variables : `ENVOIS_JETON`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUJET`, `RESEND_API_KEY`, `EMAIL_EXPEDITEUR`, `NEXT_PUBLIC_SITE_URL` (déjà prévue).
- **File d'envoi :**
  - réservation de 2 minutes ;
  - nouveaux essais après 1, 5 puis 15 minutes, puis abandon (4 essais en tout) ;
  - abandon de tout envoi de plus de 24 heures ;
  - purge quotidienne de ce qui a plus de 7 jours.
- **Appareils :** 10 au plus par compte ; l'adresse de push est en `https://` et fait 1 000 caractères au plus.
- **E-mails :** tout ce qui vient de la base est échappé dans le HTML ; le lien est absolu (`NEXT_PUBLIC_SITE_URL`, sinon `http://localhost:3000`).
- **Composants client :** un composant client n'importe jamais un module qui importe `next/headers` ou `@/lib/supabase/server`.
- **Commits :** terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Une notification envoyée à tous les comptes** (« C'est l'heure du live ») : un seul insert dans `envois` par requête, et rien pour les comptes sans appareil. Test : 3 comptes, dont 1 avec appareil, donnent 1 envoi push.
2. **Deux serveurs qui vident la file en même temps** (deux cloches à la même seconde) : aucun envoi n'est pris deux fois (`skip locked` et réservation). Test SQL : deux `prendre_envois` successifs sans `terminer`.
3. **Un abonnement push expiré** (réponse 404 ou 410) : l'appareil est retiré et l'envoi est considéré comme fait. Test dans `viderFile`.
4. **Les clés absentes** (aucune, ou seulement celles du push) : rien n'est pris pour le canal sans clé, et rien ne lève d'exception. Test dans `viderFile`.
5. **Un titre ou un texte de notification qui contient du HTML** (« <script> », « & ») : échappé dans l'e-mail. Test du modèle.

---

### Task 1 : migration 0058

**Files :** Create `web/supabase/migrations/0058_push_emails.sql` ; Test `web/tests/db/push-emails.test.ts`

**Interfaces (SQL) :**
- **Tables :**
  - `appareils_push(id uuid pk, profil_id uuid → profils cascade, adresse text unique https ≤ 1000, cle_p256dh text ≤ 200, cle_auth text ≤ 100, cree_le, vu_le)`. RLS : chacun lit les siens. Aucune écriture directe.
  - `envois(id bigint identity pk, canal text push|email, destinataire uuid → profils cascade, titre, texte, lien, statut a_envoyer|envoye|abandonne, essais int, prochain_essai, pris_le, erreur, cree_le)`. Fermée.
  - `reglages_envois(id boolean pk true, empreinte text)`.
- **Fonctions :**
  - `enregistrer_appareil(p_adresse text, p_p256dh text, p_auth text) returns void` : pour un compte connecté ; insère, ou reprend l'adresse si un autre compte l'avait ; garde les 10 plus récents.
  - `retirer_appareil(p_adresse text) returns void` : seulement les siens.
  - `notification_importante(p_categorie text, p_lien text) returns boolean`, immuable : `expiration_renouvellement`, ou `service` avec un lien en `/abonnement`.
  - `notifier(...6 paramètres)` : même corps qu'en 0036. Avant l'insert, une notification importante met un e-mail dans la file pour chaque destinataire, sans l'auteur sauf `p_auteur_inclus`.
  - `nouveau_jeton_envois() returns text` : un jeton de 64 caractères hexadécimaux, dont la base garde l'empreinte. Exécution retirée à tous (éditeur SQL seulement).
  - `prendre_envois(p_jeton text, p_canaux text[], p_limite integer) returns jsonb`. Elle rend `[{ id, canal, titre, texte, lien, email, prenom, appareils: [{adresse, p256dh, auth}] }]` et refuse un jeton faux avec 42501.
  - `terminer_envoi(p_jeton text, p_id bigint, p_reussi boolean, p_erreur text, p_disparus text[]) returns void`.
- **Déclencheurs :**
  - après insert sur `notifications` (instruction, table de transition) : le push dans la file pour les destinataires qui ont un appareil et n'ont pas coupé `canal_push` ;
  - après insert sur `abonnements` dont le paiement n'est pas `manuel` : « Paiement reçu : votre abonnement X est actif » (ou « Votre abonnement X est actif » s'il est offert), avec un lien vers le reçu ;
  - après insert et après delete sur `suspensions` : e-mail « Votre compte Étudium est suspendu » ou « est réactivé ».
- **pg_cron :** `etudium-envois-purge`, chaque jour à 4 h 10.
- **Fin de la migration :** affiche le jeton s'il n'y en a pas encore. Sinon, elle dit comment en créer un autre.

- [ ] **Step 1 : écrire les tests.** Banc jusqu'à 0058 ; le jeton est créé dans le test par `nouveau_jeton_envois()` en superutilisateur.
  - `it("appareils : enregistrer, reprendre l'adresse d'un autre compte, 10 au plus, retirer les siens seulement")`
  - `it("push : une notification pour 3 comptes dont 1 avec un appareil → 1 envoi ; push coupé → aucun")`
  - `it("e-mail : un rappel d'abonnement part même si les notifications de l'appli sont coupées ; une notification ordinaire, non")`
  - `it("Paiement reçu : un paiement en ligne confirmé crée la notification et l'e-mail ; un abonnement manuel, non (il a la sienne)")`
  - `it("suspension et réactivation : un e-mail chaque fois")`
  - `it("prendre_envois : jeton faux refusé ; seulement les canaux demandés ; deux prises ne prennent pas les mêmes envois (Review Focus 2)")`
  - `it("terminer_envoi : envoyé ; échec puis nouvel essai à 1 min ; abandon au 4e échec ; appareils disparus retirés ; plus de 24 h abandonné")`
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** écrire la migration (repartir de la définition de `notifier` de 0036 et du bloc pg_cron de 0052).
- [ ] **Step 4 :** relancer → tout passe ; relancer aussi `tests/db/notifications.test.ts` en ajoutant 0058 à sa liste si besoin.
- [ ] **Step 5 :** commit `feat(envois): file d'envoi, push et e-mails importants (0058)`.

### Task 2 : l'envoi côté serveur

**Files :**
- Modify : `web/package.json` (`web-push`, `@types/web-push` en dev, versions exactes)
- Create : `web/src/lib/envois/{config,email,resend,push,file}.ts`
- Test : `web/tests/envois/{email,file}.test.ts`

**Interfaces :**
- `configurationEnvois(env = process.env): { jeton: string; push: { publique: string; privee: string; sujet: string } | null; email: { cle: string; expediteur: string } | null; site: string } | null` : null sans jeton.
- `modeleEmail(e: { titre: string; texte: string; lien: string | null; prenom: string | null }, site: string): { sujet: string; html: string; texte: string }`. Charte des modèles de `web/supabase/templates` ; bouton « Ouvrir Étudium » vers `site + lien` ; pied de page « Vous recevez cet e-mail car il concerne votre compte Étudium. ».
- `envoyerEmail(config: {cle, expediteur}, m: { a: string; sujet: string; html: string; texte: string }, f = fetch): Promise<{ ok: true } | { ok: false; erreur: string }>` : `POST https://api.resend.com/emails`.
- `envoyerPush(config: {publique, privee, sujet}, appareils: {adresse, p256dh, auth}[], charge: { titre: string; texte: string; lien: string }, envoi = webpush.sendNotification): Promise<{ ok: boolean; disparus: string[]; erreur?: string }>` : 404 et 410 donnent un appareil disparu ; c'est un succès si au moins un appareil a reçu l'envoi, ou si tous ont disparu.
- `viderFile(deps?: { client?, config?, envoyerEmail?, envoyerPush? }): Promise<{ envoyes: number; echecs: number }>` : canaux = ceux dont les clés existent ; limite de 20 ; un `terminer_envoi` par envoi ; ne lève jamais d'exception.

- [ ] **Step 1 : écrire les tests.**
  - `email.test.ts` : échappement (Review Focus 5), lien absolu, sans lien pas de bouton, texte brut.
  - `file.test.ts` : sans jeton rien ; push sans clés → seulement `email` demandé (Review Focus 4) ; réussite → `terminer(reussi)` ; échec → `terminer(échec, erreur)` ; 410 → appareil disparu (Review Focus 3).
- [ ] **Step 2 :** lancer → échec.
- [ ] **Step 3 :** installer `web-push`, puis implémenter.
- [ ] **Step 4 :** relancer → tout passe ; `tsc` propre.
- [ ] **Step 5 :** commit `feat(envois): envoi des push et des e-mails depuis la file`.

### Task 3 : quand la file se vide

**Files :** Modify `web/src/lib/notifications/actions.ts` (`chargerCloche`, `publierAnnonce`), l'action d'envoi d'un message dans `web/src/lib/messages/actions.ts` ; Test `web/tests/envois/declenchement.test.ts`

- **Comportement :** `after(() => viderFile())` (de `next/server`) dans `chargerCloche`, après l'envoi d'un message et après `publierAnnonce`.
- [ ] **Steps :** test (`after` simulé : la fonction donnée appelle `viderFile`) → échec → implémentation → passe → commit `feat(envois): la file se vide après la cloche, un message ou une annonce`.

### Task 4 : le push dans le navigateur

**Files :**
- Create : `web/public/sw.js`, `web/src/lib/envois/abonnement-push.ts` (client), `web/src/lib/envois/actions.ts` (`"use server"` : `enregistrerAppareil`, `retirerAppareil`), `web/src/components/profile/InterrupteurPush.tsx`
- Modify : `web/src/components/profile/NotificationsTab.tsx`
- Test : `web/tests/envois/sw.test.ts`, `web/tests/profile/interrupteur-push.test.tsx`

**Interfaces :**
- `sw.js` :
  - `push` affiche `titre` et `texte`, avec l'icône `/icons/icone-192.png` et `data.lien` ;
  - `notificationclick` met au premier plan un onglet de l'appli et y ouvre le lien, sinon ouvre une fenêtre.
- `etatDuPush(): "sans_cle" | "non_pris_en_charge" | "iphone_a_installer" | "refuse" | "possible"`.
- `abonnerPush(clePublique): Promise<{ ok: true; abonnement: { adresse, p256dh, auth } } | { ok: false; message: string }>` et `desabonnerPush(): Promise<string | null>` (rend l'adresse).
- **`InterrupteurPush({ actif, onChange })`, selon l'état :**
  - « Bientôt disponible » (désactivé) sans clé ;
  - « Votre navigateur ne reçoit pas les notifications push. » ;
  - « Sur iPhone, ajoutez d'abord Étudium à l'écran d'accueil (Partager › Sur l'écran d'accueil). » ;
  - refus : « Autorisez les notifications pour Étudium dans les réglages du navigateur. »
- [ ] **Steps :** tests (service worker chargé dans un faux `self` ; interrupteur avec `Notification`, `serviceWorker` et `PushManager` simulés) → échec → implémentation → passe → commit `feat(envois): notifications push dans le navigateur`.

### Task 5 : guide, vérification, relecture

- [ ] **Guide :** section 59 du guide (spec §3).
- [ ] **Vérification :** `tsc`, `eslint`, suite complète.
- [ ] **Relecture :** relecture finale de l'étape par un relecteur indépendant ; correctifs.
- [ ] **Commit :** `docs: guide section 59 (push et e-mails)`.
