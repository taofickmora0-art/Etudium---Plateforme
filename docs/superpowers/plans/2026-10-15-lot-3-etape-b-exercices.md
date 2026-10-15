# Lot 3, étape B : les exercices — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal :** des exercices dans le programme des formations : le formateur écrit la consigne et joint des fichiers ;
l'étudiant marque un exercice simple comme terminé, ou dépose son travail (versions conservées) ; le formateur ou l'équipe
corrige (« Valider l'exercice » ou « Demander une correction ») ; chacun est notifié ; la page « Exercices » de
l'étudiant et la page « Corrections » ouvrent enfin.

**Architecture :** un exercice est une leçon de type `exercice` (0031) ; sa consigne est le texte de la leçon, ses
fichiers fournis sont les ressources de la leçon ; une colonne `lecons.genre_exercice` (`simple` | `rendu`). Les rendus
vivent dans `rendus_exercices` (fermée : fonctions `security definer` seulement) ; les fichiers déposés dans l'espace
privé `rendus` (dossier du compte), lus par leur auteur et par les correcteurs.

**Tech Stack :** Next.js 16.4, Supabase/Postgres (PGlite pour les tests), Vitest/jsdom.

**Spec :** `docs/superpowers/specs/2026-10-15-lot-3-quiz-exercices-certificats-design.md` (§1, §3, §9 validés).
Design : NdExercice, NdExerciceEnvoi, NdExerciceEnvoye, NdExercices, NdCorrection, NdCorrectionDemande,
NdCorrectionValidation.

## Global Constraints

- Exercices **hors du pourcentage de progression** et des comptes de leçons (`estLeconDeContenu`, déjà en place) ;
  **rien ne se débloque** : le texte du design « le module suivant sera débloqué » est remplacé.
- Fichiers de rendu : **PDF, Word, Excel, PowerPoint, image (JPG, PNG, WebP) ou ZIP, 20 Mo** (20 971 520 octets).
- Statuts : **En attente** (`en_attente`), **À corriger** (`a_corriger`), **Validé** (`valide`) ; aucune note chiffrée.
- Un fichier déposé ne se modifie plus tant qu'il n'est pas corrigé ; une nouvelle version seulement après « À corriger ».
- Correcteurs : le formateur de la formation **et l'équipe** ; « Demander une correction » exige une remarque.
- Notifications, catégorie `exercices` : « Nouveau travail à corriger » (formateur), « Exercice validé » et « Une
  correction est demandée » (étudiant).
- Textes en français, téléphone compact ; avant la 0032, le reste de l'appli marche (replis) et les pages disent
  « Appliquez la migration 0032 (guide « Ce qui te revient », section 38). »

## Review Focus

1. Un étudiant ne lit ni ne télécharge le travail d'un autre ; un formateur ne lit que les rendus de ses formations.
2. Un dépôt pendant qu'une version attend sa correction est refusé (base), même par appel direct.
3. Un rendu qui annonce un fichier absent de l'espace `rendus`, ou celui d'un autre compte, est refusé.
4. Une correction sur une version déjà corrigée (deux onglets) est refusée sans double notification.
5. Un étudiant sans accès à la leçon (payante, brouillon) ne rend rien et ne voit rien.

---

### Task 1 : migration 0032 (les exercices en base)
Files : Create `web/supabase/migrations/0032_exercices.sql` ; Test `web/tests/db/exercices.test.ts`.
- `lecons.genre_exercice text` (`simple` | `rendu`, null pour les autres types ; `rendu` par défaut pour un exercice :
  déclencheur `before insert` qui met `rendu` si `type = 'exercice'` et rien n'est donné).
- Table `rendus_exercices` (id, lecon_id → lecons cascade, profil_id → profils cascade, version int, fichier text null,
  nom_fichier text, format text, taille_octets int, message text ≤ 1000, statut `en_attente|a_corriger|valide`,
  remarque text ≤ 2000, corrige_par uuid null, corrige_le timestamptz null, cree_le) ; unique (profil_id, lecon_id,
  version) ; RLS sans règle, `revoke all`.
- Espace `rendus` : privé, 20 Mo, les types MIME des formats acceptés ; dépôt dans son dossier (`<compte>/…`) ; lecture :
  le sien, ou `rendu_lisible(name)` (fichier d'un rendu dont on est correcteur) ; suppression : le sien tant qu'aucun
  rendu ne l'attache.
- Fonctions (`security definer`, `search_path = ''`) :
  - `correcteur_de_lecon(p_lecon)` interne = `editeur_de_lecon` ;
  - `exercice_etudiant(p_lecon) → jsonb | null` : `{ genre, statut, peut_deposer, versions: [...] }` (versions de la
    plus récente à la plus ancienne : id, version, nom_fichier, format, taille_octets, message, statut, remarque,
    correcteur (nom), corrige_le, cree_le) ; null sans accès (`acces_lecon`) ou si ce n'est pas un exercice ;
  - `rendre_exercice(p_lecon, p_fichier, p_nom, p_message) → jsonb` : accès, exercice `rendu`, fichier dans
    `storage.objects` (espace `rendus`, `owner` = compte, dossier du compte), format (`metadata->>'mimetype'`) et taille
    (`metadata->>'size'`) admis, dernière version absente ou `a_corriger` ; insère la version n+1 `en_attente` ;
    notifie le formateur (`formateurs.compte_id`) « Nouveau travail à corriger » ; 20 dépôts / 10 min ;
  - `terminer_exercice(p_lecon) → jsonb` : exercice `simple`, accès ; une version 1 `valide` (rien si déjà validé) ;
  - `mes_exercices() → jsonb` : les exercices où le compte a au moins une version (dernier statut, titre, formation,
    module, dernière remarque et correcteur, date), du plus récent au plus ancien ;
  - `mes_statuts_exercices(p_formation) → jsonb` `{ "<leçon>": "valide" | … }` ;
  - `corrections_a_faire() → jsonb` : dernières versions `en_attente` des formations du formateur (toutes pour
    l'équipe), les plus anciennes d'abord (rendu, étudiant, exercice, formation, module, version, déposée le) ;
  - `rendu_a_corriger(p_rendu) → jsonb | null` (correcteur seulement) : étudiant, exercice (titre, consigne = texte),
    formation, module, la version, l'historique de l'étudiant pour cet exercice, `suivant` (rendu en attente suivant) ;
  - `fichier_rendu(p_rendu) → text | null` : le chemin, pour son auteur ou un correcteur ;
  - `corriger_rendu(p_rendu, p_decision, p_remarque) → jsonb` : correcteur ; version `en_attente` et la dernière ;
    `a_corriger` exige une remarque (« Expliquez ce qu’il faut corriger. ») ; notifie l'étudiant « Exercice validé » ou
    « Une correction est demandée » (lien `/formations/<slug>/lecons/<leçon>`).
- Messages : « Cet exercice ne vous est pas ouvert. », « Votre travail attend déjà sa correction. », « Ce fichier n’a pas
  été reçu. Déposez-le à nouveau. », « Ce format n’est pas accepté. », « Le fichier dépasse 20 Mo. », « Cet exercice se
  termine sans dépôt. », « Cet exercice demande un dépôt. », « Ce travail a déjà été corrigé. », « Expliquez ce qu’il faut
  corriger. », « Trop de dépôts en peu de temps : réessayez dans quelques minutes. »
- [ ] Tests (dépôt, versions, refus, correction, droits de lecture du fichier, notifications, listes) → ÉCHEC →
  migration → SUCCÈS → commit.

### Task 2 : la logique de l'appli
Files : Create `web/src/lib/exercices/{types,conversion,data,actions}.ts`, `web/src/lib/exercices/fichiers.ts`
(`FORMATS_RENDU`, `RENDU_MAX_OCTETS = 20971520`, `formatDeRendu(nom, octets)`) ; Modify `lib/admin/{actions,data,types}.ts`
(`addLecon` type `exercice` ; `saveLecon` `genre_exercice` ; `LeconAdmin.genreExercice`), `lib/catalogue/{types,data}.ts`
(`nbExercices`) ; tests `web/tests/exercices/*.test.ts`.
- Produces : `MIGRATION_EXERCICES` ; `lireExercice(leconId) → ExerciceEtudiant | null` ; `lireMesExercices() →
  Lecture<ExerciceListe[]>` ; `lireStatutsExercices(formationId) → Record<string, StatutRendu>` ;
  `lireCorrections() → Lecture<CorrectionAFaire[]>` ; `lireRenduACorriger(renduId) → RenduACorriger | null` ;
  actions `rendreExercice(leconId, fichier, nom, message)`, `terminerExercice(leconId)`,
  `corrigerRendu(renduId, decision, remarque)`, `lienRendu(renduId) → { url } | { erreur }` (60 s, nom du fichier).
- [ ] Tests : conversions, replis avant 0032, refus relayés, `lienRendu` → ÉCHEC → SUCCÈS → commit.

### Task 3 : l'éditeur
Files : Modify `OngletLecons.tsx` (« Exercice » dans « Nouvelle leçon » ; ligne « Exercice avec rendu » / « Exercice
simple » ; compte « · n exercices »), `EditeurLecon.tsx` (un exercice : « Consigne » à la place du texte, choix
« Exercice simple / Exercice avec rendu », documents gardés, ni vidéo ni durée).
- [ ] Tests → ÉCHEC → SUCCÈS → commit.

### Task 4 : rendre un exercice (page leçon, programme, fiche)
Files : Create `web/src/components/exercices/{ExerciceLecon,DepotTravail,HistoriqueRendus}.tsx` ; Modify
`ContenuLecon.tsx`, `lib/lecon/{data,types}.ts` (`exercice`), la page leçon et la fiche (statuts), `ProgrammeLecon`,
`ProgrammeMobile`, `ProgrammeFiche`, `FicheConnectee`, `FichePublique`, `BlocsFiche`, `lib/catalogue/regles.ts`
(`nombreDExercices`, `libelleExercice(statut?)`).
- [ ] Tests : simple (« Marquer comme terminé »), dépôt (type et taille refusés dans le navigateur, « Envoyer votre
  travail ? », toast « Travail envoyé »), attente, nouvelle version après « À corriger », historique, visiteur ;
  programme « Exercice · Validé » ; fiche « 3 exercices » → ÉCHEC → SUCCÈS → commit.

### Task 5 : corriger (formateur et équipe)
Files : Create `web/src/components/corrections/{ListeCorrections,CorrectionRendu}.tsx`, pages
`app/(app)/formateur/corrections/[renduId]/page.tsx`, `app/(app)/admin/corrections/{page,[renduId]/page}.tsx` ;
Modify `app/(app)/formateur/corrections/page.tsx`, `lib/navigation.ts` (« Corrections » dans « Contenus » du back-office).
- [ ] Tests : liste (plus anciens d'abord, vide), détail (travail, message, Télécharger, consigne, historique),
  « Valider cet exercice ? » (commentaire facultatif), « Demander une correction » (remarque exigée), toasts, exercice
  suivant → ÉCHEC → SUCCÈS → commit.

### Task 6 : la page « Exercices » de l'étudiant
Files : Create `web/src/components/exercices/ListeExercices.tsx` ; Modify `app/(app)/(etudiant)/exercices/page.tsx`.
- [ ] Tests : filtres Tous · À corriger · En attente · Validés, remarque du formateur, vides → ÉCHEC → SUCCÈS → commit.

### Task 7 : vérification, guide, revue, bilan
- [ ] Suite, lint, tsc, build ; rendu ; guide section 38 (appliquer la 0032) ; revue finale (opus) ; corrections ;
  bilan ; mémoire.
