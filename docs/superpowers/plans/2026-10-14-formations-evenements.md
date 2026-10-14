# Onglet Formations et Événements — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un seul onglet « Formations » (page à deux rangées), Google Agenda, rappel 10 min et annonce du début du live à tous.

**Architecture:** menus pilotés par `src/lib/navigation.ts` (une entrée peut être active sur d'autres chemins) ; la page
`/formations` connectée ajoute une rangée « Mes formations » (composant serveur) au-dessus du catalogue ; les rappels et
l'annonce passent par une fonction SQL globale et idempotente (`traiter_sessions_live`), appelée par `pg_cron` et par la
cloche, qui se recharge chaque minute.

**Tech Stack:** Next.js 16.4 (cacheComponents), React 19.3, Tailwind v4, Supabase (Postgres, pg_cron), vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-10-14-formations-evenements-design.md`

## Global Constraints

- Tous les textes en français, apostrophe typographique (’) dans l'interface.
- Aucune donnée personnelle dans une adresse (l'adresse Google ne porte que la session).
- Migrations : `set search_path = ''`, `security definer` pour les fonctions de droits, rejouables ; l'utilisateur les applique.
- Téléphone : tailles `max-sm:` compactes (mémoire « téléphone compact »).
- Fichiers temporaires de vérification supprimés, jamais commités ; `web/.env.local` jamais lu.

## Review Focus

1. Deux appels simultanés de `traiter_sessions_live()` (cron + cloche) : aucune notification en double.
2. Une session annulée ou terminée avant tout traitement : jamais d'annonce « C'est l'heure du live ».
3. Une session déplacée après un rappel : les rappels et l'annonce repartent de zéro pour la nouvelle heure.
4. La migration appliquée sur une base sans `pg_cron` (et la base en mémoire) : elle passe sans erreur.
5. Un compte sans aucune formation suivie : la page Formations s'affiche sans rangée vide ni erreur.

---

### Task 1: Navigation

**Files:**
- Modify: `web/src/lib/navigation.ts`, `web/src/components/layout/SidebarNav.tsx`, `web/src/components/layout/MobileNav.tsx`
  (ou `ui/BottomBar.tsx`), `web/src/components/layout/MobileProfileMenu.tsx`, et tout autre appelant de `isActive`
- Test: `web/tests/layout/menus-espaces.test.tsx`, `web/tests/layout/navigation.test.tsx`

**Interfaces:**
- Produces: `NavEntry.aussi?: string[]` (autres chemins où l'entrée est marquée) ; `entreeActive(pathname: string, e: NavEntry): boolean`.

- [ ] **Step 1: tests** — `menus-espaces` : groupe principal étudiant `["Accueil","Formations","Communauté","Messages","Événements"]` ;
  « Mon espace » `["Exercices","Mes parcours","Certificats","Formations gratuites","Favoris","Mon abonnement","Aide"]` ;
  barre du bas `["Accueil","Formations","Communauté","Certificats","Profil"]` avec Formations → `/formations` ; menu
  téléphone sans « Toutes les formations ». `navigation` : `entreeActive` vrai pour Formations sur `/formations`,
  `/mes-formations`, `/formations/excel` ; faux sur `/formations-gratuites`.
- [ ] **Step 2:** lancer `npx vitest run tests/layout` → échecs attendus.
- [ ] **Step 3:** implémenter (entrée `{ href: "/formations", label: "Formations", icon: CourseIcon, aussi: ["/mes-formations"] }`).
- [ ] **Step 4:** `npx vitest run tests/layout` → vert.
- [ ] **Step 5:** commit `feat(navigation): un seul onglet Formations, Événements après Messages`.

### Task 2: La page Formations

**Files:**
- Create: `web/src/components/catalogue/RangeeMesFormations.tsx` (serveur : lecture), `web/src/components/mes-formations/CarteSuivieCompacte.tsx`
- Modify: `web/src/components/catalogue/Catalogue.tsx`, `PageCatalogue.tsx`, `web/src/app/(catalogue)/formations/page.tsx`
- Test: `web/tests/catalogue/page-formations.test.tsx`, `web/tests/catalogue/catalogue.test.tsx`

**Interfaces:**
- Consumes: `lireProgression`, `lireFavoris`, `listFiches`, `formationsSuivies`, `versVueCarte` (comme `mes-formations/page.tsx`).
- Produces: `Catalogue` prop `rangee?: ReactNode` (rendue sous l'en-tête) ; titre « Formations » + section h2 « Toutes les
  formations » quand `chemin === "/formations"` en connecté ; `GRILLE_CONNECTEE` à 5 colonnes au plus, minimum 220 px.

- [ ] **Step 1: tests** — `RangeeMesFormations` (présentationnel `ListeMesFormations({ suivies })`) : 8 suivies → 6 cartes ;
  lien « Voir plus » vers `/mes-formations` ; 0 suivie → rien. `Catalogue` connecté `/formations` : h1 « Formations »,
  h2 « Toutes les formations », la rangée passée rendue avant la recherche ; `/formations-gratuites` inchangé (h1).
- [ ] **Step 2:** lancer → échecs.
- [ ] **Step 3:** implémenter ; rangée : `grid grid-flow-col auto-cols-[minmax(168px,calc((100%-80px)/6))] gap-4 overflow-x-auto`.
- [ ] **Step 4:** `npx vitest run tests/catalogue tests/mes-formations` → vert.
- [ ] **Step 5:** commit `feat(formations): page Formations avec la rangée Mes formations`.

### Task 3: Ajouter à mon agenda (Google)

**Files:**
- Modify: `web/src/lib/sessions/agenda.ts`, `web/src/components/sessions/FenetreInscription.tsx`, `CarteSession.tsx`, `PageEvenements.tsx`
- Test: `web/tests/sessions/agenda.test.ts`, `web/tests/sessions/evenements.test.tsx`

**Interfaces:**
- Produces: `lienGoogleAgenda(s: SessionAgenda, adresse: string): string` ;
  `fichierIcs` gagne `BEGIN:VALARM / TRIGGER:-PT10M / ACTION:DISPLAY / DESCRIPTION:… / END:VALARM`.

- [ ] **Step 1: tests** — l'adresse commence par `https://calendar.google.com/calendar/render?action=TEMPLATE`, porte
  `dates=20261024T140000Z/20261024T150000Z`, `text` et `details` encodés ; le .ics contient `TRIGGER:-PT10M` ; la fenêtre
  « Inscription confirmée » a un lien « Ajouter à mon agenda » vers Google (`target="_blank"`) et « Autre agenda (.ics) » ;
  la carte d'une session où l'on est inscrit (pas commencée) a « Ajouter à mon agenda » ; textes « la veille, 1 h avant et
  10 min avant ».
- [ ] **Step 2:** lancer → échecs.
- [ ] **Step 3:** implémenter.
- [ ] **Step 4:** `npx vitest run tests/sessions` → vert.
- [ ] **Step 5:** commit `feat(evenements): Ajouter à mon agenda ouvre Google Agenda`.

### Task 4: Migration 0023 — rappels 10 min et annonce du début

**Files:**
- Create: `web/supabase/migrations/0023_sessions_rappels.sql` (fonctions reprises de la 0018 par script)
- Modify: `docs/guides/ce-qui-te-revient.md` (section 28)
- Test: `web/tests/db/sessions-rappels.test.ts`

**Interfaces:**
- Produces: colonnes `inscriptions_sessions.rappel_dix_le`, `sessions_live.debut_annonce_le` ; `traiter_sessions_live() returns integer`
  (sans droit pour `public, anon, authenticated`) ; `rappels_sessions()` = `exiger_compte_actif()` puis `traiter_sessions_live()` ;
  `sinscrire_session` marque aussi `rappel_dix_le` si moins de 10 min ; `modifier_session` remet à zéro `rappel_dix_le` et
  `debut_annonce_le` quand l'heure change ; tâche `cron.schedule('etudium-sessions-live', '* * * * *', 'select public.traiter_sessions_live()')`
  dans un bloc qui ignore l'absence de `pg_cron`.
- Règles : réservation par `update … where … is null returning` avant chaque `notifier(..., true)` ; annonce si
  `statut = 'programmee' and debut <= now() and debut + duree > now()` ; destinataires de l'annonce : `array(select id from public.profils)`.

- [ ] **Step 1: tests (PGlite)** — 10 min : un inscrit reçoit « Session live dans 10 minutes » une seule fois (2 appels) ;
  l'annonce va à tous les profils (dont l'équipe et un non-inscrit), une fois ; rien pour une session annulée ou terminée ;
  heure modifiée → nouvelle annonce et nouveau rappel ; `rappels_sessions()` d'un compte crée le rappel d'un autre inscrit ;
  `traiter_sessions_live` refusé à `authenticated` ; la migration s'applique sur PGlite (sans pg_cron).
- [ ] **Step 2:** lancer `npx vitest run tests/db/sessions-rappels.test.ts` → échecs.
- [ ] **Step 3:** écrire la migration (+ banc de test s'il liste les migrations) et la section 28 du guide.
- [ ] **Step 4:** `npx vitest run tests/db` → vert.
- [ ] **Step 5:** commit `feat(sessions): rappel 10 min et annonce du début du live à tous (0023)`.

### Task 5: La cloche se met à jour seule

**Files:**
- Modify: `web/src/components/layout/HeaderActions.tsx`
- Test: `web/tests/notifications/cloche-auto.test.tsx`

**Interfaces:**
- Produces: `INTERVALLE_CLOCHE_MS = 60_000` ; rechargement si `document.visibilityState === "visible"` ; au retour sur
  l'onglet ; message (toast) pour une notification `sessions_live` non lue plus récente que la plus récente déjà vue
  (pas au premier chargement).

- [ ] **Step 1: tests** — minuteries simulées : 2 chargements après 60 s ; aucun quand l'onglet est caché ; nouvelle
  notification de session live → toast avec son titre et « Voir » ; premier chargement → pas de toast.
- [ ] **Step 2:** lancer → échecs.
- [ ] **Step 3:** implémenter.
- [ ] **Step 4:** `npx vitest run tests/notifications tests/layout` → vert.
- [ ] **Step 5:** commit `feat(notifications): la cloche se met à jour chaque minute`.

### Task 6: Vérification

- [ ] lint, `tsc --noEmit`, suite complète, `next build` ; rendu de la page Formations et des Événements à 1440, 1280,
  390 et 320 px (fichiers temporaires supprimés ensuite).
