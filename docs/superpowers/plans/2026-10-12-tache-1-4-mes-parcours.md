# Tâche 1.4 — Mes parcours : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** la page `/parcours` (NdParcours) présente chaque parcours (couleur, description, état, progression) et la liste de ses formations avec leur état. Au lot 1, personne n'a d'abonnement : chaque parcours est « Non inclus », ses formations gratuites restent ouvertes et un bouton mène aux formules (lot 2).

**Architecture :**
- **Données** : réutilise le catalogue (`listCatalogue`, `listParcoursCatalogue`).
- **Règles pures** (`src/lib/parcours/regles.ts`) : formations d'un parcours dans l'ordre, état d'une formation, progression d'un parcours.
- **Progression** : elle arrive en 1.7. D'ici là, la page reçoit une table de progression vide ; tout est à 0 % et « Pas commencé ».
- **Page** : composant serveur dans `(app)/parcours/page.tsx`, avec `SessionGuard` ; les onglets sont ceux de `SegmentedTabs`.

**Spec :** `docs/superpowers/specs/2026-10-12-lot-1-catalogue-apprentissage-design.md` (§2 « /parcours », §3 états d'accès). **Design :** `NdParcours` (contenu du `main`).

## Global Constraints

- **Valeurs du design** :
  - en-tête : H1 « Mes parcours » + sous-titre + bouton contour 42 px ;
  - onglets segmentés (piste `#E9EFFB`, 40 px) ; cadenas de 16 px sur un parcours non inclus ;
  - trait `#DBE0EB` (marge haute de 20 px), puis contenu (marge de 32 px) ;
  - carte du parcours : bordure `#EAEEF7`, rayon 16, padding 22/19/17 ;
    - tuile de 48 px, rayon 14, aux couleurs du parcours (fond / icône : `#DDE1FF`/`#0B18C9`, `#EDE9FE`/`#6D28D9`, `#FFEDD9`/`#C2410C`) ;
    - icône Route de 22 px ; H2 20/28 600 ; description 14/22 `#667085` ;
    - badge d'état ; barre de 8 px (marge haute 20) ; méta 12/18 (marge haute 8) ;
  - section « Formations du parcours » : H2 20/28 600 + badge compteur gris ;
    - liste dans une carte (padding 4 px 15 px, bordure `#EAEEF7`, rayon 16) ;
    - lignes : lien, gap 14, padding 14 px 4 px, min-hauteur 48 ; numéro « 01 » dans un carré de 44 px (rayon 12, fond `#E9EFFB`, 14 px 600) ; titre 15/22 500 ; barre de 6 px sur 120 px ; badge dans une colonne de 100 px alignée à droite ; chevron de 18 px `#667085` ;
    - séparateurs de 1 px `#EAEEF7` ;
  - bloc « non inclus » (NdParcours, Business) : carte bordée, état vide (tuile cadenas de 56 px, titre 18/26 600, texte 14/22 `#667085` de 420 px au plus, bouton principal de 42 px).
- **Textes du lot 1 (sans abonnement)** :
  - sous-titre : « Compte gratuit : aucun parcours actif. Les formations gratuites restent ouvertes à tous. » ;
  - bouton d'en-tête : « Voir les formules » → `/abonnement` ;
  - badge du parcours : « Non inclus » ;
  - méta : « 0 % du parcours » • « Aucune formation terminée sur 6 » (ou « 2 formations terminées sur 6 ») ;
  - bloc non inclus : titre « Ce parcours n’est pas inclus dans votre compte gratuit », texte « Choisissez une formule pour ouvrir toutes ses formations. Les formations gratuites restent accessibles dès maintenant. », bouton « Voir les formules » ;
  - le bloc se place entre la carte du parcours et la liste des formations, qui reste affichée pour découvrir le parcours.
- **État d'une formation (colonne de droite)** :
  - progression ≥ 100 → « Terminé » (vert) ;
  - progression > 0 → « N % » (bleu) ;
  - sinon formation ouverte (gratuite) → « Gratuite » (vert) ;
  - sinon « Verrouillée » (gris, cadenas).
  - Chaque ligne mène à la fiche `/formations/<adresse>`.
- **Téléphone (320 px)** : la barre de 120 px de chaque ligne se masque sous 640 px ; le titre garde la place.
- **Parcours sans formation** : « Aucune formation dans ce parcours pour le moment. »
- **Aucun parcours actif en base** : état vide « Aucun parcours pour le moment ».
- **Tables absentes** : avertissement `TablesAbsentes`.
- **Commits** : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Formation archivée ou brouillon** : jamais listée dans un parcours (le catalogue ne lit que les publiées).
- **Parcours désactivé** : absent des onglets.
- **Ordre des formations** : celui de leur position dans le parcours (back-office, `formations_parcours.ordre`), pas l'ordre alphabétique.
- **Numéro « 01 »** : suit la position affichée, sans trou si une formation est retirée.
- **320 px** : pas de défilement horizontal, titre lisible.

---

### Task 1: Règles et page « Mes parcours »

**Files :**
- Create : `web/src/lib/parcours/regles.ts`, `web/src/components/parcours/MesParcours.tsx`
- Modify : `web/src/app/(app)/parcours/page.tsx` (remplace « Bientôt disponible »), `web/src/lib/pages-a-venir.ts` (retire `parcours`), `web/src/components/ui/SegmentedTabs.tsx` (icône facultative dans un onglet)
- Test : `web/tests/parcours/regles.test.ts`, `web/tests/parcours/mes-parcours.test.tsx`

**Interfaces :**
- Produces :
  - `type ProgressionFormation = { pourcentage: number; terminee: boolean }` ;
  - `formationsDuParcours(cartes, slug): CarteCatalogue[]` (triées par position) ;
  - `etatFormation(carte, progression?): { libelle: string; ton: TagTone; verrou?: boolean }` ;
  - `progressionDuParcours(cartes, progressions): { pourcentage: number; terminees: number; total: number }` (moyenne arrondie des pourcentages ; 0 si aucune formation) ;
  - `MesParcours({ parcours, cartes, progressions })`.

- [ ] **Step 1 : tests**
  - `regles.test.ts` :
    - ordre par position (Word, Excel, PowerPoint, Zotero, Méthodologie) ;
    - états : Zotero sans progression → « Gratuite » ; Excel → « Verrouillée » ; Excel à 68 % → « 68 % » ; Word terminée → « Terminé » ;
    - progression d'un parcours : (100 + 68 + 0) / 3 → 56 %, 1 terminée sur 3 ;
    - parcours vide → 0 % sur 0.
  - `mes-parcours.test.tsx` (données du design) :
    - un onglet par parcours avec son nom court ; le premier est affiché ;
    - la carte montre le nom, la description, « Non inclus », « 0 % du parcours », « Aucune formation terminée sur 5 » ;
    - le bloc « Ce parcours n’est pas inclus dans votre compte gratuit » et le bouton « Voir les formules » (→ `/abonnement`) ;
    - la liste : « 01 » … « 05 », titres dans l'ordre, Zotero « Gratuite », les autres « Verrouillée », chaque ligne → `/formations/<adresse>` ;
    - l'onglet « Digital » affiche ses 3 formations ;
    - aucun parcours → « Aucun parcours pour le moment ».
- [ ] **Step 2 :** → FAIL. **Step 3 :** implémenter. **Step 4 :** → PASS, suite entière verte.
- [ ] **Step 5 : commit** `feat(parcours): page Mes parcours (parcours, formations, état d'accès)`

### Task 2: Guide et vérifications

- [ ] **Step 1 : guide `ce-qui-te-revient.md`, section 8 « Valider Mes parcours (tâche 1.4) »**
  1. Ouvre « Mes parcours » : un onglet par parcours.
  2. Chaque parcours affiche sa couleur, sa description, « Non inclus » et ses formations, dans l'ordre du back-office.
  3. Zotero et Canva sont « Gratuite », les autres « Verrouillée ».
  4. Ranger une formation au back-office change son ordre ici.
  5. La progression viendra avec la tâche 1.7.
- [ ] **Step 2 :** suite, `tsc`, `eslint`, `npm run build`.
- [ ] **Step 3 :** rendu de la page avec les données du design (injecté dans le serveur local, vrais styles) mesuré à 1440, 390 et 320 px, sans débordement.
- [ ] **Step 4 : commit** `docs: guide de validation de Mes parcours (tâche 1.4)`
