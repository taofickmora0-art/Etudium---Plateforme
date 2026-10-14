# Publication : sondages, quiz et programmation — spec (à valider)

- **Date :** 14 octobre 2026 (nuit)
- **Statut :** **à valider par l'utilisateur avant tout codage** (sa demande : « tu m'envoies le plan, je valide et tu
  commences »). Remplace l'étape 3 de la communauté v3 (programmer et sondages).
- **Origine :** message du 14 octobre (capture d'un champ de publication façon YouTube : Image, Sondage avec images,
  Sondage avec texte, Quiz, Vidéo ; « Publier » avec une flèche ; onglets Publié / Planifié / Archivé).

## 1. Le champ de publication

- Ouvert, il garde : l'avatar et le nom, « Publication dans : » (l'espace), le titre facultatif, l'éditeur (mise en forme,
  lien, emoji).
- **Une seule rangée d'options sous le texte**, comme la capture : **Image**, **Sondage avec images**, **Sondage avec
  texte**, **Quiz**, **Vidéo**, **Fichier** (PDF). Une publication porte **un seul** de ces ajouts à la fois ; en choisir un
  autre remplace le précédent (avec confirmation s'il était rempli).
- **Le bouton « Publier » devient double** : « Publier » à gauche, une flèche ▾ à droite qui ouvre **« Programmer… »**.
  - « Programmer… » ouvre une petite fenêtre : la date et l'heure (heure du Bénin), de 10 min à 3 mois à l'avance ;
    « Programmer » valide. Le bouton principal devient alors « Programmer pour le jeu. 12 nov. à 15 h 00 » (une croix
    revient à « Publier maintenant »).

## 2. Sondage avec texte

- La question est le texte de la publication.
- **2 à 10 options** (« Option 1 », « Option 2 », « Ajouter une option », croix pour retirer), 80 caractères chacune.
- **« Plusieurs réponses possibles »** (case à cocher), et **« Fin du sondage »** : 1 jour, 3 jours, 1 semaine (par
  défaut), 2 semaines, ou sans fin.
- Dans la carte : les options à cocher et **Voter** ; après le vote, les **résultats** (pourcentage, barre, nombre de
  votes, mon choix coché) ; **« Changer mon vote »** tant que le sondage est ouvert ; fermé, les résultats seuls et
  « Sondage terminé ». L'auteur et l'équipe voient les résultats sans voter.

## 3. Sondage avec images

- Comme le sondage avec texte, mais **2 à 6 options, chacune une image** (JPG, PNG ou WebP, 10 Mo) **et un court libellé
  facultatif**.
- Dans la carte : une grille d'images (2 par ligne sur téléphone, 3 sur ordinateur) ; on vote en touchant une image ;
  après le vote, le pourcentage s'affiche sur chaque image.

## 4. Quiz

- La question est le texte de la publication ; **2 à 6 réponses**, dont **une seule bonne** (pastille « Bonne réponse » à
  cocher) ; **une explication** facultative (300 caractères).
- Dans la carte : on choisit une réponse, **Valider** ; la réponse est **définitive** :
  - la bonne réponse s'affiche en vert, la mienne en rouge si elle est fausse ;
  - l'explication s'affiche ; puis le pourcentage de chaque réponse.
  - La bonne réponse n'est jamais envoyée au navigateur avant d'avoir répondu (pas de triche).

## 5. Publications programmées

- Une publication programmée **n'est visible que de son auteur et de l'équipe** jusqu'à son heure, avec l'étiquette
  « Programmée pour le … » ; elle paraît ensuite **en haut du fil**, comme publiée à cette heure-là.
- Elle s'analyse (IA) et compte dans les limites au moment où on la programme ; elle se **modifie**, se **reprogramme**
  (« Modifier la date ») ou se **supprime** comme les autres.
- **Sous le champ, pour l'auteur : des onglets « Publiées » et « Programmées »** (sa liste à lui), en plus du fil
  « Actualités » habituel. (Pas d'onglet « Archivées » : rien n'est archivé dans la communauté — voir §7, question 2.)

## 6. Base (migration 0026)

- `publications.publie_le` (l'heure de parution ; maintenant par défaut) ; le fil, les tendances et les activités ne
  montrent que les publications parues (sauf les siennes et pour l'équipe).
- `sondages` (type texte, images ou quiz ; plusieurs réponses ; fin ; explication), `options_sondage` (texte, image,
  bonne réponse, ordre), `votes_sondage` (un vote ou une réponse de quiz par compte ; changeable pour un sondage ouvert,
  définitive pour un quiz).
- `publier(…, p_publie_le, p_sondage)`, `voter(p_sondage, p_options)`, `reprogrammer(p_publication, p_publie_le)` ; la carte
  rend le sondage (options, nombres, mon vote ; la bonne réponse du quiz seulement après ma réponse).

## 7. À valider (mes propositions entre parenthèses)

1. Un seul ajout par publication (image, sondage, quiz, vidéo ou fichier) — **oui**.
2. Onglets sous le champ : « Publiées » et « Programmées » pour l'auteur ; **pas d'« Archivées »** (si tu veux pouvoir
   archiver une publication — la retirer du fil sans la supprimer — je l'ajoute).
3. Quiz à **une seule** bonne réponse, réponse définitive, explication facultative.
4. Sondage : vote modifiable tant qu'il est ouvert ; résultats visibles après avoir voté ; fin par défaut à 1 semaine.
5. Programmation : de 10 min à 3 mois ; les membres ne sont pas prévenus au moment de la parution (comme une publication
   normale) — **ou** une notification « Nouvelle publication » à l'heure ?
6. Le texte indicatif reste « Quoi de neuf, Koffi ? » (la capture dit « Exprimez-vous ! »).

## 8. Tests

Règles pures (validation des options, des dates), migration sur la base en mémoire (votes, quiz sans triche, parution à
l'heure, droits), écrans (champ, bouton double, fenêtre de programmation, cartes de sondage et de quiz, onglets), rendu à
1440 et 390 px.
