# Lot 3, étape C : validation de la formation et certificats — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal :** l'étudiant voit ce qui lui reste pour valider une formation ; dès que tout est rempli, son certificat est
délivré (figé, identifiant `ET-2026-XXXX-XXXX`), téléchargeable en PDF et en image avec un QR Code, et vérifiable par
tous sur `/verifier` et `/c/<identifiant>`.

**Architecture :** la base calcule l'état de validation (`etat_validation`) et délivre le certificat (déclencheurs sur la
progression, les tentatives de quiz et les rendus validés, et à chaque ouverture de la page de validation). Le
certificat garde une copie des noms (titulaire, formation, formateur, parcours). L'image est générée par le serveur
(`ImageResponse`), le PDF enveloppe cette image (A4 paysage) ; le QR Code vient de la bibliothèque `qrcode`.

**Tech Stack :** Next.js 16.4 (`next/og`), sharp, `qrcode` 1.5.4 (nouvelle dépendance), Supabase/Postgres, Vitest.

**Spec :** `docs/superpowers/specs/2026-10-15-lot-3-quiz-exercices-certificats-design.md` (§4, §5, §6, §7, §9).
Design : NdCertificat, NdCertificatObtenu, NdCertificatPartage, NdCertificats, NdVerification, NdVerificationValide,
NdEditeur (carte « Certification »).

## Global Constraints

- **Conditions (R18)** : progression à 100 % (leçons de contenu publiées, au moins une) · tous les quiz publiés réussis
  (meilleur score ≥ score minimal) · tous les exercices publiés validés si « Exercices obligatoires » (activé par défaut).
- **Délivré automatiquement**, une seule fois par étudiant et par formation ; **définitif** : nom, formation, formateur,
  parcours et date (jour au Bénin) figés ; reste vérifiable si le compte est supprimé.
- **Identifiant** `ET-<année>-XXXX-XXXX`, 8 caractères tirés au hasard parmi `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- Notification « Votre certificat est prêt » (catégorie `service`, toujours envoyée).
- Vérification **sans compte** : « Certificat authentique. » ou « Aucun certificat trouvé. ».
- Le PDF et l'image ne se téléchargent que par le titulaire ; le partage passe par le lien de vérification.
- Textes en français, téléphone compact ; avant la 0033, le reste marche et les pages disent « Appliquez la migration
  0033 (guide « Ce qui te revient », section 39). »

## Review Focus

1. Un certificat ne se délivre jamais deux fois, ni sans toutes les conditions (quiz non réussi, exercice en attente,
   leçon publiée après coup non terminée).
2. Un identifiant ne se devine pas et la vérification n'expose rien d'autre que ce que montre le certificat.
3. Le PDF et l'image d'un certificat ne se lisent pas par un autre compte.
4. La suppression du compte garde le certificat vérifiable (nom figé), et le texte de la suppression le dit.
5. Une formation sans leçon publiée ne délivre rien.

---

### Task 1 : migration 0033 (validation et certificats en base)
Files : Create `web/supabase/migrations/0033_certificats.sql` ; Test `web/tests/db/certificats.test.ts`.
- `formations.exercices_obligatoires boolean not null default true`.
- Table `certificats` (id, identifiant unique, profil_id → profils on delete set null, formation_id → formations on
  delete set null, titulaire, formation_titre, formateur_nom, parcours_nom, delivre_le date, cree_le, vu_le) ; unique
  (profil_id, formation_id) ; RLS sans règle, `revoke all`.
- Fonctions : `etat_validation(p_profil, p_formation)` (interne) ; `delivrer_si_complet(p_profil, p_formation)`
  (interne, identifiant au hasard, notification) ; déclencheurs sur `progression_lecons` (terminee_le), `tentatives_quiz`
  (insert), `rendus_exercices` (statut `valide`) ; `validation_formation(p_formation)` (l'état, délivre si complet,
  rend le certificat) ; `mes_certificats()` (obtenus + en préparation) ; `mon_certificat(p_identifiant)` (titulaire
  seulement) ; `marquer_certificat_vu(p_identifiant)` ; `verifier_certificat(p_identifiant)` (anon aussi) ;
  `certificats_formateur()` (nombre délivré dans ses formations ; toutes pour l'équipe) ; `lot3_etudiant(p_etudiant)`
  (scores, exercices, certificat par formation du formateur).
- [ ] Tests → ÉCHEC → migration → SUCCÈS → commit.

### Task 2 : la logique de l'appli
Files : Create `web/src/lib/certificats/{types,conversion,data,actions,qr,pdf}.ts` ; Modify `lib/admin/{actions,data,types}.ts`
(`exercicesObligatoires`) ; `package.json` (`qrcode` 1.5.4, `@types/qrcode`).
- Produces : `lireValidation(formationId)`, `lireMesCertificats()`, `lireMonCertificat(identifiant)`,
  `verifierCertificat(identifiant)`, `lireCertificatsFormateur()`, `lireLot3Etudiant(etudiantId)` ;
  `marquerCertificatVu(identifiant)` ; `matriceQr(texte) → boolean[][]` ; `pdfDepuisJpeg(jpeg, largeur, hauteur) → Uint8Array` ;
  `adresseVerification(identifiant)`.
- [ ] Tests → ÉCHEC → SUCCÈS → commit.

### Task 3 : le certificat en image et en PDF
Files : Create `web/src/components/certificats/dessinCertificat.tsx` (JSX pour `ImageResponse`),
`web/src/app/certificats/[identifiant]/image/route.ts`, `.../pdf/route.ts`.
- [ ] Tests (titulaire seulement, 404 sinon ; PDF A4 paysage) → ÉCHEC → SUCCÈS → commit.

### Task 4 : la validation de la formation
Files : Create `web/src/components/certificats/{PageValidation,Felicitations,PartagerCertificat}.tsx`, page
`app/(catalogue)/formations/[slug]/validation/page.tsx` ; Modify `FicheConnectee` (lien « Validation et certificat »),
`FormationInfosForm` (carte « Certification » : score minimal, « Exercices obligatoires »).
- [ ] Tests → ÉCHEC → SUCCÈS → commit.

### Task 5 : la page Certificats et la vérification publique
Files : Create `web/src/components/certificats/{ListeCertificats,FormulaireVerification,ResultatVerification}.tsx`,
pages `app/(app)/(etudiant)/certificats/page.tsx`, `app/(catalogue)/verifier/page.tsx`, `app/(catalogue)/c/[identifiant]/page.tsx` ;
Modify `EnTetePublic`, `PiedDePagePublic`, `pages-a-venir.ts`.
- [ ] Tests → ÉCHEC → SUCCÈS → commit.

### Task 6 : formateur et finitions
Files : Modify `TableauDeBordFormateur` (« Certificats délivrés », « Exercices à corriger »), `FicheEtudiant` (scores,
exercices, certificat), `DeleteAccountCard` (« vos certificats restent vérifiables »), page Exercices (« Un exercice validé
compte pour votre certificat »).
- [ ] Tests → ÉCHEC → SUCCÈS → commit.

### Task 7 : vérification, guide, revue, bilan
- [ ] Suite, lint, tsc, build ; rendu ; guide section 39 (appliquer la 0033) ; revue finale (opus) ; corrections ;
  bilan ; mémoire.
