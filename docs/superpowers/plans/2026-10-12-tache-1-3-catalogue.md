# Tâche 1.3 — Catalogue et fiche formation : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un visiteur, comme un étudiant connecté, parcourt le catalogue publié et ouvre la fiche d'une formation. Le visiteur voit `NdCataloguePublic` et `NdFormationPublic` ; le connecté voit `NdCatalogue` et `NdFormation`, sous la même adresse. L'aperçu gratuit est signalé, et le lien partagé (WhatsApp…) montre un titre et une image.

**Architecture :**
- **Lecture des données** : `src/lib/catalogue/` lit les formations publiées avec le client serveur. Les règles d'accès de la 0004 s'appliquent : un visiteur est `anon`.
- **Règles pures, testées** : filtres, tri, badge et durée lisible.
- **Pages** : un groupe de routes `(catalogue)` contient `/formations` et `/formations/[slug]`. Sa mise en page choisit le cadre selon la personne : le cadre public (en-tête et pied de page publics) pour un visiteur, la coque de l'appli pour un compte connecté.
- **Formations gratuites** : `/formations-gratuites` reste dans l'espace connecté et montre le même catalogue, filtré.
- **Filtrage côté navigateur** : il s'appuie sur la liste complète, petite à ce stade. Les filtres sont gardés dans l'adresse ; le serveur applique les mêmes filtres au premier affichage.
- **Partage** : `generateMetadata` et `opengraph-image.tsx` (`next/og`) pour la fiche.

**Tech Stack :** Next.js 16.4 (cacheComponents, route groups, `next/og`), React 19, Supabase, Vitest + Testing Library.

**Spec :** `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` (§2 écrans et adresses, §3 états d'accès, §7 « Pas encore d'avis », §9 image de partage, §11 incohérences). **Annexe design :** `docs/superpowers/plans/2026-10-12-tache-1-3-annexe-design.md` (valeurs exactes des écrans).

## Global Constraints

- **Design** : le rendu reproduit les écrans du design (annexe) avec les composants existants : `CardShell`/`CatalogCard`, `CourseIllustration`, `Tag`, `FilterChips`, `SortMenu`, `SearchInput`, `Select`, `Accordion`, `EmptyState`, `Breadcrumb`, `Button`, `Icon`.
- **Mise en page** : 320 px sans défilement horizontal ; grille 3 colonnes (connecté) ou 4 (public) sur ordinateur, 1 colonne sur téléphone.
- **Catalogue** : formations `publiee` seulement, y compris pour l'équipe (le brouillon se voit au back-office). Parcours `actif` seulement.
- **Avis (1.11)** :
  - sans avis, pas de note sur les cartes, et la fiche affiche « Pas encore d'avis » ;
  - le tri « Note des étudiants » est masqué jusqu'à la 1.11 ;
  - la fiche annonce « Vous pourrez laisser un avis à partir de 50 % de progression. ».
- **Badge d'une carte (un seul)** : « Gratuit » si gratuite ; sinon le badge saisi (Populaire, Nouveau) ; sinon « Complémentaire » si disponible seule (spec §11 : un badge cohérent partout).
- **Durées** : somme des leçons. Elles s'affichent comme le design (« 6 h 20 », « 45 min ») et sont masquées si elles sont nulles. Nombre de leçons : « 12 leçons ».
- **Plus tard** :
  - progression, « Continuer », badges Terminé / En cours : 1.7 ;
  - favoris : 1.9 ;
  - « Écrire à la formatrice » : lot 5 (Q9) ;
  - page leçon : 1.5. Les liens vers `/formations/[slug]/lecons/[id]` sont posés dès maintenant.
- **En-tête public** : seulement les pages qui existent. « Formations » en 1.3, puis Parcours, Tarifs et Communauté avec la landing (1.12). « Vérifier un certificat » viendra au lot 3. Les boutons « Se connecter » et « Créer un compte gratuit » sont présents.
- **Adresses publiques** : `/formations` et tout ce qui est dessous (image de partage comprise).
- **Textes** : français, vouvoiement, apostrophes typographiques.
- **Commits** : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Une formation en brouillon ou archivée** ne doit jamais apparaître au catalogue ni s'ouvrir par son adresse, même pour un compte de l'équipe : page introuvable. → Tasks 1 et 4.
- **Un visiteur** ne voit jamais le lien d'une vidéo, ni une leçon verrouillée cliquable ; les leçons d'aperçu sont cliquables et signalées « Aperçu ». → Task 4.
- **Filtres dans l'adresse** (`?parcours=digital&acces=gratuites&niveau=debutant&q=excel&tri=recentes`) : un rechargement retrouve le même résultat, et une valeur inconnue est ignorée. → Tasks 1 et 3.
- **Un compte connecté dont la session tombe** (Supabase injoignable) sur le catalogue : la page s'affiche quand même, en cadre public, sans écran d'erreur. → Task 2.
- **Image de partage d'une adresse inconnue** : réponse 404, pas d'erreur serveur. → Task 5.

---

### Task 1: Données et règles du catalogue

**Files :**
- Create : `web/src/lib/catalogue/types.ts`, `web/src/lib/catalogue/regles.ts`, `web/src/lib/catalogue/filtres.ts`, `web/src/lib/catalogue/data.ts`
- Test : `web/tests/catalogue/regles.test.ts`, `web/tests/catalogue/filtres.test.ts`, `web/tests/catalogue/data.test.ts`

**Interfaces :**
- Produces :
  - **`types.ts`** :
    - `ParcoursCatalogue { slug, nom, nomCourt, couleur: CouleurParcours, ordre }` ;
    - `CarteCatalogue { id, slug, titre, resume, niveau: Niveau, gratuite, achatSepare, badge: Badge | null, publieeLe: string, dureeSecondes, nbLecons, parcours: (ParcoursCatalogue & { position: number })[] }` ;
    - `LeconFiche { id, titre, dureeSecondes, apercu, accessible }` ;
    - `ModuleFiche { id, titre, lecons: LeconFiche[] }` ;
    - `FormateurFiche { nom, titre, domaine, presentation }` ;
    - `FicheFormation` : `CarteCatalogue` plus `description, objectifs, competences, formateur: FormateurFiche | null, modules: ModuleFiche[]`.
  - **`regles.ts`** :
    - `dureeLisible(secondes): string` : 0 → « » ; 2700 → « 45 min » ; 22800 → « 6 h 20 » ; 21600 → « 6 h 00 » ; les minutes sont arrondies ;
    - `nombreDeLecons(n)` : « 1 leçon », « 12 leçons » ;
    - `badgeDeCarte(carte): CardTag | undefined` (règle du badge unique ci-dessus ; tons `gratuit`, `populaire`, `nouveau`, `complementaire`) ;
    - `parcoursPrincipal(carte)` : le premier parcours par ordre (pour la couleur de l'illustration), ou `academique` à défaut ;
    - `etatAcces(fiche, connecte): "gratuite" | "apercu" | "verrouillee"` (spec §3, lot 1 : l'abonnement viendra au lot 2) ;
    - `premiereLeconOuverte(fiche): LeconFiche | null`.
  - **`filtres.ts`** :
    - `type Filtres = { q: string; parcours: string | "tous"; acces: "tout" | "gratuites" | "incluses"; niveau: Niveau | "tous"; tri: "parcours" | "recentes" | "duree" }` ;
    - `FILTRES_PAR_DEFAUT` ;
    - `lireFiltres(params: Record<string, string | string[] | undefined>, parcoursConnus: string[]): Filtres` (valeur inconnue → défaut) ;
    - `ecrireFiltres(f): string` (query sans les valeurs par défaut, ordre stable) ;
    - `appliquerFiltres(cartes, f): CarteCatalogue[]`. Recherche sans accents ni majuscules, dans le titre et le résumé. « incluses » = non gratuite et dans au moins un parcours. Tri : parcours (ordre du parcours, puis position), récentes (`publieeLe` décroissant), durée (croissante).
  - **`data.ts`** :
    - `listCatalogue(): Promise<CarteCatalogue[]>` (`statut = publiee`) ;
    - `listParcoursCatalogue(): Promise<ParcoursCatalogue[]>` (actifs, triés) ;
    - `getFiche(slug): Promise<FicheFormation | null>` : formation publiée ; modules et leçons triés ; `accessible` par le champ calculé `accessible` de la 0004 ; jamais `lecons_contenus` ;
    - en mode démonstration : listes vides et `null` ;
    - tables absentes : `TablesAbsentesError` (réutilisée de `@/lib/admin/data`).

- [ ] **Step 1 : tests**
  - `regles.test.ts` : les cas de `dureeLisible` et `nombreDeLecons`, puis :
    - badge : Zotero → Gratuit ; Excel (populaire + seule) → Populaire ; Marketing (seule) → Complémentaire ; Word → aucun ;
    - `etatAcces` : gratuite + connecté → « gratuite » ; gratuite + visiteur → « apercu » s'il a des leçons d'aperçu, sinon « verrouillee » ; payante → « apercu » ou « verrouillee ».
  - `filtres.test.ts` :
    - `?parcours=inconnu&tri=note&niveau=expert` → valeurs par défaut ;
    - aller-retour `lireFiltres(ecrireFiltres(f)) === f` ;
    - « zotéro » trouve Zotero ;
    - « incluses » exclut les gratuites ;
    - les trois tris sur un jeu de 4 cartes ;
    - Business + Gratuites → vide.
  - `data.test.ts` (faux client de `tests/admin/faux-supabase.ts`) :
    - les cartes portent la durée totale et le nombre de leçons ;
    - le filtre `eq("statut", "publiee")` est toujours posé ;
    - la fiche ne demande jamais `lecons_contenus` ;
    - adresse invalide (`Node.js`) → null sans requête ;
    - tables absentes → `TablesAbsentesError`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(catalogue): lecture des formations publiées, filtres, tri et règles d'affichage`

### Task 2: Adresses publiques et cadre selon la personne

**Files :**
- Create :
  - `web/src/app/(catalogue)/layout.tsx`
  - `web/src/components/site/CadrePublic.tsx`, `web/src/components/site/EnTetePublic.tsx`, `web/src/components/site/PiedDePagePublic.tsx`
  - `web/src/components/layout/CompteDeLEntete.tsx` (extrait de `(app)/layout.tsx`)
  - `web/src/lib/catalogue/visiteur.ts`
- Modify :
  - `web/src/lib/auth/routing.ts` (`PAGES_PUBLIQUES` + `/formations`)
  - `web/src/app/(app)/layout.tsx` (utilise `CompteDeLEntete`)
  - `web/src/lib/pages-a-venir.ts` (retirer `formations` et `formations-gratuites`)
  - `web/src/app/layout.tsx` (`metadataBase` : `process.env.NEXT_PUBLIC_SITE_URL` ou `http://localhost:3000`)
- Delete : `web/src/app/(app)/formations/page.tsx`
- Test : `web/tests/catalogue/cadre.test.tsx`, `web/tests/auth/session.test.ts` (ajouts)

**Interfaces :**
- Produces :
  - **`compteConnecte(): Promise<ShellUser | null>`** (`visiteur.ts`) : `getShellUser()`, mais une indisponibilité de Supabase (`AuthUnavailableError`) donne null (cadre public plutôt qu'un écran d'erreur).
  - **Mise en page `(catalogue)`** : `Suspense`, puis le cadre public (visiteur) ou `ToastProvider` + `AppShell` + `CompteDeLEntete` (connecté).
  - **`CadrePublic({ children, actif })`** : en-tête public et pied de page publics de l'annexe. Le lien « Formations » est marqué actif par `aria-current="page"`.

- [ ] **Step 1 : tests**
  - `session.test.ts` :
    - `le catalogue et les fiches s'ouvrent sans compte` : `/formations`, `/formations/excel`, `/formations/excel/opengraph-image` → `{}` ;
    - `/formations-gratuites` reste protégée.
  - `cadre.test.tsx` :
    - visiteur → « Se connecter » et « Créer un compte gratuit » (liens `/connexion` et `/inscription`), pas de barre latérale ;
    - connecté → « Navigation principale » (barre latérale), pas de « Créer un compte gratuit » ;
    - `AuthUnavailableError` → cadre public.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** suite entière → PASS (les tests des pages « Bientôt disponible » suivent la liste réduite).
- [ ] **Step 5 : commit** `feat(catalogue): adresses publiques et cadre visiteur ou connecté`

### Task 3: Page du catalogue

**Files :**
- Create :
  - `web/src/app/(catalogue)/formations/page.tsx`
  - `web/src/components/catalogue/Catalogue.tsx` (client : filtres, tri, recherche, grille, état vide)
  - `web/src/components/catalogue/CarteFormation.tsx`
  - `web/src/components/catalogue/HerosCatalogue.tsx`
- Modify :
  - `web/src/components/ui/CatalogCard.tsx` et `CourseCard.tsx` (`CardShell` accepte une puce de parcours en plus du badge, comme la carte publique ; la note devient facultative)
  - `web/src/app/(app)/formations-gratuites/page.tsx` (même catalogue, filtre « gratuites »)
- Test : `web/tests/catalogue/catalogue.test.tsx`

**Interfaces :**
- Consumes : Task 1 (données, filtres, règles), Task 2 (cadre).
- Produces : `Catalogue({ cartes, parcours, filtresInitiaux, variante: "public" | "connecte", chemin: "/formations" | "/formations-gratuites" })`.
  - **Variante publique** (NdCataloguePublic) : héros bleu, recherche, niveau, puces de parcours et d'accès, compteur, grille de 4.
  - **Variante connectée** (NdCatalogue, NdMobCatalogue) : titre, recherche, menu « Trier : … » (Parcours, Les plus récentes, Durée), puces « Toutes, Académique, Digital, Business, Gratuites », compteur, grille de 3.
  - **Puce « Gratuites »** : en connecté, elle mène à `/formations-gratuites` ; les autres puces mènent à `/formations`. Le menu latéral reste ainsi juste.
  - **Filtres dans l'adresse** : `history.replaceState` (pas d'aller-retour serveur).
  - **État vide** : « Aucune formation ne correspond », « Essayez un autre mot-clé ou retirez un filtre. », bouton « Effacer les filtres ».

- [ ] **Step 1 : tests** (`catalogue.test.tsx`, cartes du design en données) :
  - `le visiteur filtre par parcours et par accès` : Business + Gratuites → état vide, puis « Effacer les filtres » → 10 formations ;
  - `la recherche ignore accents et majuscules` ;
  - `le compteur suit le filtre` (« 5 formations », « 1 formation ») ;
  - `l'adresse garde les filtres` (`replaceState` appelé avec `?parcours=digital`) ;
  - `la carte publique porte la puce du parcours et le badge` (« Académique » + « Populaire ») ;
  - `la carte connectée porte le seul badge` ;
  - `sans avis, la carte n'affiche pas de note` ;
  - `en connecté, la puce Gratuites mène à /formations-gratuites`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter (valeurs de l'annexe). **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(catalogue): catalogue public et connecté (filtres, tri, recherche)`

### Task 4: Fiche d'une formation

**Files :**
- Create :
  - `web/src/app/(catalogue)/formations/[slug]/page.tsx`
  - `web/src/components/catalogue/FichePublique.tsx`, `web/src/components/catalogue/FicheConnectee.tsx`
  - `web/src/components/catalogue/ProgrammeFiche.tsx`, `web/src/components/catalogue/BlocsFiche.tsx` (« Ce que vous allez apprendre », compétences, formateur, avis vides, « Inclus dans la formation »)
- Test : `web/tests/catalogue/fiche.test.tsx`

**Interfaces :**
- Consumes : `getFiche`, `etatAcces`, `premiereLeconOuverte`, `dureeLisible`, `nombreDeLecons`, `compteConnecte`.
- Produces :
  - **Visiteur** (NdFormationPublic) :
    - héros : fil, puces, titre, méta, formateur, bouton « Voir l'aperçu gratuit » vers la première leçon d'aperçu (absent sans aperçu) ;
    - carte d'offre :
      - formation gratuite : « Formation gratuite » / « Créer mon compte gratuit » ;
      - formation incluse dans un parcours : « Incluse dans le parcours » / nom / « Avec les formules Basique, Standard et Premium. » ;
      - formation disponible seule : « Disponible aussi seule, en formation complémentaire. » (sans prix jusqu'au lot 2) ;
      - « Inclus dans la formation », construit à partir des données ;
    - « Ce que vous allez apprendre », compétences, programme (accordéon, lien « Aperçu » sur les leçons d'aperçu), « Votre formatrice » ou « Votre formateur », carte « Aperçu gratuit » (« N leçons »), avis (« Pas encore d'avis » + la phrase des 50 %), bande bleue d'appel à l'action.
  - **Connecté** (NdFormation) :
    - fil, titre, description, méta ;
    - à gauche : « Ce que vous allez apprendre », compétences, programme (leçon ouverte : icône lecture et lien ; leçon fermée : cadenas, non cliquable), avis vides ;
    - à droite, une carte :
      - « Commencer » vers la première leçon ouverte, si la formation est ouverte ;
      - sinon « Formation verrouillée » / « Incluse dans les formules Basique, Standard et Premium (lot 2). » ;
      - puis la mention de l'accès (« Formation gratuite. », ou « Incluse dans le parcours Réussite académique. ») ;
    - carte du formateur (sans « Écrire à la formatrice ») ; « Inclus dans la formation » ;
    - formation sans leçon : programme vide (« Le programme arrive bientôt. »), pas de bouton.
  - **Adresse invalide ou formation non publiée** : `notFound()`.

- [ ] **Step 1 : tests** (`fiche.test.tsx`, fiche d'Excel du design) :
  - `le visiteur voit l'aperçu et l'offre` : « Voir l'aperçu gratuit » mène à la 1re leçon d'aperçu ; « Créer mon compte gratuit » → `/inscription` ; leçons d'aperçu avec le lien « Aperçu » ; les autres leçons ne sont pas des liens ;
  - `le connecté voit ses leçons ouvertes et fermées` : formation payante → cadenas sur les leçons hors aperçu, « Formation verrouillée » ; formation gratuite → toutes les leçons sont des liens, bouton « Commencer » ;
  - `sans avis, la fiche le dit` ;
  - `la durée et le nombre de leçons viennent des données` (« 2 h 20 », « 12 leçons ») ;
  - `formation sans formateur : pas de carte formateur`.
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter (valeurs de l'annexe). **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(catalogue): fiche formation (visiteur et connecté)`

### Task 5: Partage : titre, description et image

**Files :**
- Create : `web/src/app/(catalogue)/formations/[slug]/opengraph-image.tsx`, `web/src/lib/catalogue/partage.ts`
- Modify : la page de la fiche (`generateMetadata`)
- Test : `web/tests/catalogue/partage.test.ts`

**Interfaces :**
- Produces :
  - **`metadonneesFiche(fiche): Metadata`** :
    - titre « Maîtriser Microsoft Excel · Étudium » ;
    - description = résumé (sinon le début de la description) ;
    - `openGraph` avec `type: "website"`, `locale: "fr_FR"`, `siteName: "Étudium"`.
  - **Image 1200 × 630** :
    - fond bleu Étudium avec motif de points (annexe) ;
    - puce du parcours, titre en blanc, durée et nombre de leçons ;
    - illustration du parcours, logo hexagonal « É » et « Étudium ».
  - **Adresse inconnue** : 404.

- [ ] **Step 1 : tests** (`partage.test.ts`) :
  - `les métadonnées reprennent le titre et le résumé` ;
  - `sans résumé, la description est coupée à 160 caractères` ;
  - `une formation inconnue n'a pas de métadonnées de partage` (titre « Formation introuvable · Étudium »).
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter ; l'image se vérifie au navigateur (Task 6). **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `feat(catalogue): aperçu du lien partagé (titre, description, image)`

### Task 6: Guide, vérifications et navigateur

- [ ] **Step 1 : guide `ce-qui-te-revient.md`, section 7 « Valider le catalogue (tâche 1.3) »**
  1. En navigation privée (sans compte), ouvre http://localhost:3000/formations : 10 formations. Filtre Business + Gratuites : « Aucune formation ne correspond ».
  2. Ouvre « Maîtriser Microsoft Excel » : fiche publique, 2 leçons « Aperçu ».
  3. Connecté, ouvre « Toutes les formations » puis « Formations gratuites » dans le menu.
  4. Ouvre http://localhost:3000/formations/maitriser-microsoft-excel/opengraph-image : l'image de partage s'affiche.
  5. Le vrai test WhatsApp attend l'adresse en ligne.
- [ ] **Step 2 :** suite entière, `tsc`, `eslint`, `npm run build` → tout passe.
- [ ] **Step 3 : navigateur**
  - si la base a les tables du lot 1 : catalogue et fiche en visiteur, à 1440, 390 et 320 px (sans débordement), et l'image de partage ;
  - sinon : l'avertissement des tables absentes s'affiche, sans écran d'erreur.
- [ ] **Step 4 : commit** `docs: guide de validation du catalogue (tâche 1.3)`
