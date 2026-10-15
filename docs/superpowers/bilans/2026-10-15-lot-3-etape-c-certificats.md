# Bilan : la validation des formations et les certificats (lot 3, étape C, 15 octobre 2026)

Fait pendant ton absence, sur ta consigne « Dès que fini continue avec autre chose ». La spec du lot 3 (validée le
15 octobre) : `docs/superpowers/specs/2026-10-15-lot-3-quiz-exercices-certificats-design.md` (§4 à §7). Le plan :
`docs/superpowers/plans/2026-10-15-lot-3-etape-c-certificats.md`. Une relecture indépendante à la fin.

## En bref

- **Les conditions du certificat** : toutes les leçons publiées terminées, tous les quiz publiés réussis (meilleur
  score ≥ score minimal) et, si « Exercices obligatoires » est activé (par défaut), tous les exercices publiés validés.
- **Le réglage** : dans l'onglet « Informations » d'une formation, la carte **Certification** regroupe le score minimal
  aux quiz et l'interrupteur « Exercices obligatoires ».
- **Délivré tout seul**, une seule fois, dès que la dernière condition est remplie (dernière leçon, quiz réussi,
  exercice validé, ou un réglage changé). La cloche annonce « Votre certificat est prêt ».
- **Définitif** : le nom, la formation, le formateur, le parcours et la date sont figés ; changer le titre de la
  formation ne change rien. Un compte supprimé garde son certificat vérifiable (le texte de la suppression le dit).
- **L'identifiant** `ET-2026-XXXX-XXXX` est tiré au hasard (40 bits) : impossible à deviner.
- **La page « Validation de votre formation »** (lien « Validation et certificat » sur la fiche) : chaque condition,
  remplie ou non, avec un lien vers ce qui manque ; à droite, le certificat. À la première visite après la
  délivrance, la fenêtre « Félicitations, … ! ».
- **Le certificat** : une image et un **PDF A4 paysage** avec le **QR Code** (« Télécharger le PDF »), pour son
  titulaire seulement ; « Partager » donne le lien de vérification à copier (ou un e-mail tout prêt).
- **La page « Certificats »** : les certificats obtenus, et les formations « En préparation » avec ce qui manque.
- **La vérification publique, sans compte** : `/verifier` (lien « Vérifier un certificat » en haut et en bas des pages
  publiques) et `/c/<identifiant>` (l'adresse du QR Code) : « Certificat authentique. » ou « Aucun certificat
  trouvé. ».
- **Côté formateur** : « Certificats délivrés » et « Exercices à corriger » au tableau de bord ; sur la fiche d'un
  étudiant, ses quiz, ses exercices et son certificat.
- **Une nouvelle dépendance** : `qrcode` 1.5.4, pour dessiner le QR Code. Le PDF est écrit sans bibliothèque.
- **Vérifications** : 1 774 tests, dont la migration 0033 sur une vraie base Postgres en mémoire ; types, code et
  compilation de production ; le certificat rendu et relu (PDF ouvert par pdf.js lors de la relecture) ; la page de
  vérification ouverte sans compte ; la page de validation à 375 px.

## Corrigé après la relecture

- **La vérification demandait un compte** : un recruteur qui scannait le QR Code arrivait sur la connexion. Elle est
  maintenant ouverte à tous.
- **« Votre certificat est prêt »** n'était pas envoyé quand l'étudiant remplissait lui-même la dernière condition (le
  cas le plus courant).
- **La page Certificats délivre** un certificat devenu dû après un changement de réglage, et ne mène plus à la fiche
  d'une formation archivée.
- **La fenêtre de suppression du compte** dit aussi que les certificats restent vérifiables.
- **Au téléphone**, le détail des conditions passe sous leur libellé.

## Ce qui te revient

1. **Applique les migrations dans l'ordre** : 0029, 0030 (si pas encore fait), puis **0031** (quiz), **0032**
   (exercices), **0033** (certificats). Guide, sections 37, 38 et 39.
2. Suis la section 39 du guide pour obtenir un certificat avec un compte étudiant, puis le vérifier dans une fenêtre
   de navigation privée.
3. **À la mise en ligne** : `NEXT_PUBLIC_SITE_URL` devra être l'adresse publique du site, sinon les QR Codes des
   certificats mèneront à `localhost`.
4. **Avant la mise en ligne** : la politique de confidentialité devra dire qu'un certificat reste vérifiable (avec le
   nom) après la suppression du compte (décision du lot 0).

## Décisions que j'ai prises pour toi

- **La dépendance `qrcode`** plutôt qu'un encodeur maison (fiable, très utilisée).
- **« Formation animée par »** sous le nom du formateur (le design écrit « Formatrice » ; le genre n'est pas connu).
- **La page de validation** est à `/formations/<formation>/validation` ; un visiteur est renvoyé à la connexion.
- **Un formateur (ou l'équipe) qui termine sa propre formation** obtient un certificat ; il compte dans « Certificats
  délivrés ».
- **Le nom du certificat ne se corrige pas** une fois délivré (un outil pour l'équipe pourra venir).
- **Une formation archivée** ne délivre plus de certificat.
- **La fenêtre « Félicitations »** s'ouvre sur la page de validation (la notification y mène).
- **Pas de bouton PNG** : le PDF suffit.

## Petits défauts laissés pour plus tard

- Deux événements au même instant (le formateur valide pendant que l'étudiant termine) peuvent retarder la délivrance
  jusqu'à la prochaine visite de la page de validation ou Certificats.
- Une adresse `/c/…` mal formée peut donner une erreur au lieu de « Aucun certificat trouvé ».
- Le texte alternatif de l'image dit « d’Kossi » pour un prénom qui commence par une consonne.
- Pas de lien vers la validation depuis le programme de la page leçon.
- L'image du certificat est régénérée à chaque visite (données mobiles).
- L'en-tête public passe sur une ligne de plus au téléphone.
- Un nom de formateur très long touche « Vérifiable sur… » sur le certificat.
- Une formation sans leçon publiée reste « En préparation » à 0 % sans explication.

## Le lot 3 est terminé

Quiz (A), exercices (B), validation et certificats (C). La suite de la feuille de route : le lot 2 (abonnements et
paiements), ou la messagerie (lot 5).
