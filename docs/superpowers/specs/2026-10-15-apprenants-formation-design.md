# Onglet « Apprenants » d'une formation (refonte des formations, étape C)

- **Origine :** spec `2026-10-15-refonte-formations-design.md`, §3.1 et choix 8 du §6 (validé le 15 octobre : « étape C,
  après A et B »). Le 15 octobre, après l'étape B : « La migration est appliquée, tu peux continuer ».
- **Consigne en vigueur (14 octobre) :** avancer avec mes recommandations sans demander de confirmation ; les décisions
  sont présentées à la fin.

## 1. Ce que l'on voit

Un quatrième onglet, **Informations | Leçons | Publication | Apprenants**, dans l'éditeur d'une formation :
au back-office (l'équipe, toutes les formations) et dans l'espace formateur (ses formations).

1. **En tête, quatre chiffres** : apprenants, progression moyenne, « Terminée » (nombre), « À risque » (nombre).
2. **Filtres** : Tous · À risque · Terminée (les mêmes que la page « Étudiants » du formateur), et la recherche par nom.
3. **Le tableau**, 25 lignes par page, les plus récemment actifs d'abord :
   - **Apprenant** : initiales et nom ; le nom mène à sa fiche (`/formateur/etudiants/{id}` pour le formateur,
     `/admin/utilisateurs/{id}` pour l'équipe) ;
   - **Progression** : la barre et « 3 / 12 » ;
   - **Commencée le** (première leçon ouverte) ;
   - **Dernière activité** ;
   - **État** : En cours, À risque (rien depuis plus de 10 jours), Terminée.
4. **Vide** : « Personne n'a encore commencé cette formation. » ; filtre sans résultat : « Aucun apprenant ne correspond
   à cette recherche. »
5. Téléphone : le tableau défile horizontalement dans son cadre (composant `TableauListe`, comme « Étudiants »).

## 2. Les règles

- **Apprenant** = un compte qui a ouvert au moins une leçon **publiée** de la formation (pas encore d'inscription : lot 2),
  sauf le compte du formateur de la formation et ceux de l'équipe — les mêmes définitions que la page « Étudiants »
  (migration 0015, reprises en 0027).
- **Qui lit** : l'équipe (`equipe_contenus`) et le formateur de la formation (`formateur_de`). Tout autre compte : refus.
- **Jamais d'adresse e-mail** ; la recherche et les filtres restent dans la page, jamais dans son adresse.
- Les chiffres de l'en-tête portent sur toute la formation, pas sur le filtre.

## 3. La base (migration 0029)

- `suivi_formation(p_formation)` : interne (aucun droit d'exécution), une ligne par apprenant : identifiant, prénom, nom,
  leçons terminées, total des leçons publiées, première ouverture, dernière activité.
- `apprenants_formation(p_formation, p_recherche, p_etat, p_page, p_maintenant)` : `{ resume: { apprenants,
  progression_moyenne, terminees, a_risque }, total, lignes[] }` ; refus (42501) hors équipe et formateur de la
  formation ; un compte suspendu est refusé (les deux vérifications le couvrent déjà).
- Avant la 0029, l'onglet affiche « Appliquez la migration 0029 (guide « Ce qui te revient », section 35). »

## 4. Hors champ

Export CSV, envoi d'un message à un apprenant (lot 5, messagerie), retrait d'un apprenant (lot 2, inscriptions).
