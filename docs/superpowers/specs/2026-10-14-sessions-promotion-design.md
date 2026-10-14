# Sessions live : visuel de promotion, publication dans la communauté, « Sessions live programmées » — spec

- **Date :** 14 octobre 2026 (nuit)
- **Statut :** écrite sans validation intermédiaire, à la demande de l'utilisateur. Décisions au §6.
- **Origine :** message du 14 octobre, 13 h 28 (capture du formulaire « Nouvelle session », zone de droite entourée en
  rouge), rappelé à 19 h 50 : « la partie session où il faut un bouton où il y a le nom […] écrit », « l'insertion dans le fil ».
  Aussi, 13 h 35 : « pour les lives, […] des aperçus pour que les gens voient que la séance sera sur Google Meet ou Zoom ».

## 1. Le formulaire « Nouvelle session » / « Modifier la session »

- Nouvelle rubrique **« Visuel de promotion »** (facultative) : **une affiche** (image JPG, PNG ou WebP, 10 Mo au plus) **ou
  une vidéo** (lien YouTube, Vimeo… comme dans la communauté). Deux boutons « Ajouter une affiche » et « Ajouter une
  vidéo » ; un visuel choisi se retire (croix « Retirer le visuel ») ; choisir l'un remplace l'autre.
- **À droite du formulaire, sur ordinateur, « Aperçu dans la communauté »** : la publication telle qu'elle paraîtra, mise à
  jour à chaque frappe (auteur, « Publié dans {espace} », titre, description mise en forme, visuel, bloc de la session).
  Sur téléphone et tablette, l'aperçu passe sous le formulaire.

## 2. La publication automatique (migration 0024)

- **Programmer une session publie aussitôt une publication dans la communauté** :
  - auteur : le compte qui programme ; espace : le parcours de la session (ou Général pour « Tous les parcours ») ;
  - titre : celui de la session ; texte : sa description (ou « Session live programmée. » sans description) ;
  - pièce jointe : l'affiche ; vidéo : la vidéo de promotion ;
  - pas d'analyse ni de limite de publication (formateur ou équipe) ; statut « publiée ».
- **Sous le texte, le bloc de la session** : la date (« OCT. 24 »), « Session live », le jour et l'heure, la plateforme
  bien visible (**Google Meet**, **Zoom** ou « En ligne », avec son icône), l'animateur, le nombre d'inscrits, et le
  bouton **« Voir la session »** (page Événements). Annulée : « Annulée » à la place du bouton. Le lien du live n'est
  jamais dans la publication (il reste réservé à sa fenêtre de 10 min).
- **Modifier la session** met à jour sa publication (titre, texte, visuel). **L'annuler** laisse la publication, dont
  le bloc affiche « Annulée ».
- Supprimer la publication (auteur ou équipe) ne supprime pas la session.

## 3. « Sessions live programmées » et la pastille rouge

- **Une session est « nouvelle »** pour un compte tant qu'il n'a pas ouvert la page Événements depuis qu'elle a été
  programmée (et qu'elle n'est ni passée ni annulée, ni programmée par lui).
- **Dans la communauté**, à droite des onglets d'espaces (sous eux sur téléphone) : un bouton **« Sessions live
  programmées »** (icône vidéo) avec une **pastille rouge** qui compte les nouvelles sessions ; il mène à la page
  Événements. Le bouton n'apparaît que s'il y a au moins une session à venir ; la pastille, que s'il y en a de nouvelles.
- **Dans le menu**, l'entrée **Événements** porte la même pastille rouge (barre latérale et menu du téléphone).
- Ouvrir la page Événements remet le compteur à zéro.

## 4. Base (migration 0024)

- `sessions_live.promo_image` (jsonb, format d'une pièce jointe de la communauté, image seulement), `promo_video` (jsonb,
  format vérifié par `verifier_video`), `publication_id` ; `publications.session_id` ; `profils.evenements_vus_le`.
- `creer_session(…, p_image jsonb default null, p_video jsonb default null)` et `modifier_session(…, p_image, p_video)` :
  une affiche ou une vidéo, pas les deux ; l'affiche est vérifiée comme une pièce jointe (dans le dossier du compte,
  type et taille réels) sauf si c'est déjà celle de la session.
- `carte_publication` rend `session` (id, début, durée, plateforme, animateur, statut, inscrits, inscrit) pour une
  publication de session.
- `nouvelles_sessions()` (nombre) et `marquer_evenements_vus()`.

## 5. Tests

- Base : publication créée avec la session (espace, titre, texte, affiche ou vidéo) ; modifiée avec elle ; « Annulée »
  dans la carte ; affiche d'un autre compte refusée ; affiche et vidéo ensemble refusées ; compteur des nouvelles sessions
  (ni les siennes, ni les passées, ni les annulées) remis à zéro par `marquer_evenements_vus`.
- Écrans : rubrique « Visuel de promotion » et aperçu à jour ; bloc de session dans la carte (Google Meet, « Voir la
  session », « Annulée ») ; bouton « Sessions live programmées » et pastille ; pastille de l'entrée Événements.

## 6. Décisions prises pour l'utilisateur

1. Une affiche **ou** une vidéo, pas les deux (comme une publication : une vidéo, ou une pièce jointe).
2. L'affiche est rangée comme une pièce jointe de la communauté (même espace de stockage, mêmes contrôles).
3. La publication n'est pas analysée par l'IA : seuls les formateurs et l'équipe programment des sessions.
4. « Nouvelle » = programmée depuis la dernière visite de la page Événements.
5. Le bouton de la communauté mène à la page Événements (pas à une session précise).
