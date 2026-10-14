# Refonte de la création et du suivi des formations (inspirée d'izimentor) — spec

- **Date :** 15 octobre 2026.
- **Statut :** **à valider par l'utilisateur avant tout codage** (sa demande : « je t'enverrai le plan, car c'est un gros
  chantier »). Les propositions marquées ★ sont mes recommandations ; la section 6 liste les choix à confirmer.
- **Origine :** message du 14 octobre (13 captures d'izimentor : page du cours, page leçon et discussions, liste des
  leçons au back-office, éditeur de leçon ; ordinateur et téléphone). Consigne : « s'inspirer, pas copier ; adapter à
  notre design system ».

## 0. Ce qui existe déjà (et reste)

- **Page du cours** (`/formations/[slug]`) : programme en accordéon par module, coches vertes, « Vous êtes ici »,
  carte « Votre progression » et **Continuer**, carte du formateur, avis.
- **Page leçon** : lecteur YouTube/Vimeo avec temps réellement regardé, programme à gauche, Ressources et Notes,
  « Leçon précédente / suivante », « Marquer comme terminée » (automatique pour une vidéo au seuil fixé).
- **Back-office et espace formateur** : onglets Informations | Programme | Publication ; modules et leçons rangés par
  flèches ↑/↓ ; page d'une leçon en une colonne (titre, vidéo, durée, aperçu, résumé, points clés, texte brut, documents).

Ce qui manque par rapport aux captures : les **discussions** sous une leçon, un **statut par leçon**, le
**glisser-déposer**, l'**éditeur de leçon en deux colonnes** avec ses réglages, un **texte mis en forme**, et la
possibilité de **voir la leçon comme un étudiant** avant la publication.

## 1. La page leçon (côté étudiant)

1. **Barre du haut de la leçon** (comme izimentor, à nos couleurs) :
   - à gauche « ‹ Titre de la formation » (retour à la page du cours) ;
   - à droite un bouton « Mode lecture » (masque le programme), puis le bouton principal **« Terminer la leçon › »** ;
   - une fois la leçon terminée, ce bouton devient **« Leçon suivante › »**.
2. **« Terminer la leçon »** remplace « Marquer comme terminée » :
   - leçon sans vidéo : le clic la termine et ouvre la suivante ;
   - leçon avec vidéo ★ : la règle du seuil reste (le formateur l'a fixée). Avant le seuil, le bouton est grisé avec
     « Regardez au moins 90 % de la vidéo » ; au seuil, la leçon se termine seule et le bouton devient « Leçon suivante ».
3. **Au-dessus du titre** : « Leçon 4 sur 22 », les flèches ‹ › et, pour l'équipe et le formateur de la formation, un
   lien **« Modifier la leçon »**.
4. **Le programme** ★ reste **à gauche** sur ordinateur (notre design NdLecon), amélioré :
   - modules **repliables** (le module en cours ouvert), durée de chaque leçon ;
   - il défile seul, la progression du cours (barre et %) fixée en bas, comme izimentor ;
   - sur téléphone, un bouton **« Leçons »** dans la barre du haut ouvre un **tiroir** (comme la capture 13), à la place
     de l'onglet « Programme ».
5. **Le texte de la leçon** s'affiche mis en forme (titres, gras, listes, liens), comme les publications.
6. **« Discussions de la leçon »** sous le contenu (nouveau) :
   - les commentaires, du plus ancien au plus récent ; **Répondre** (un niveau), **J'aime**, menu ⋮ (copier le lien,
     signaler ; modifier et supprimer pour l'auteur ; supprimer pour le formateur de la formation et l'équipe) ;
   - le formateur porte l'étiquette **« Formateur »** ;
   - « Voir plus de commentaires » ; en bas, « Rédiger un commentaire » avec emojis, et **Publier** ;
   - seuls les comptes qui ont accès à la leçon lisent et écrivent ; sur une leçon d'aperçu gratuit, les comptes
     connectés les lisent, les visiteurs non ★ ;
   - **notifications** ★ : le formateur est prévenu d'un nouveau commentaire sur ses leçons, l'auteur d'une réponse ;
   - « Signaler » envoie le commentaire dans la file de modération existante.
   - Les onglets du bas deviennent **Ressources | Notes** (inchangé) ; les discussions ont leur propre section, visible
     sans clic.
7. Le réglage **« Activer les commentaires »** de la leçon (§3) masque la section.

## 2. La page du cours (côté étudiant)

Elle est déjà proche d'izimentor ; retouches :

- en tête, **« Poursuivre le cours »** (au lieu de « Continuer ») toujours visible en haut à droite sur ordinateur ;
- carte **« Progression du cours »** : « Terminé 3 sur 22 · 15 % » et la barre ;
- programme : « 7 modules · 22 leçons », durée de chaque leçon et de chaque module, bouton **« Tout déplier / Tout
  replier »** ;
- pour l'équipe et le formateur : lien **« Modifier les leçons »** vers l'éditeur.

## 3. Le back-office et l'espace formateur (création)

### 3.1 Les onglets d'une formation

**Informations | Leçons | Publication** (« Programme » devient « Leçons », comme izimentor). ★ Un quatrième onglet
**« Apprenants »** (liste des inscrits et leur progression) est proposé pour une seconde étape (§6).

### 3.2 L'onglet Leçons

- En tête : **« 7 sections · 22 leçons »**, « Tout replier », **« + Ajouter une section »**.
- Une ligne par section : poignée ⠿, « Module 1 : titre », pastille « 4 leçons » (replie la section), **« Ajouter »**
  (une leçon dans cette section), menu ⋮ (Renommer, Supprimer).
- Une ligne par leçon : poignée ⠿, titre, résumé discret (« 06:10 · Vidéo · Aperçu »), **statut « Publiée ▾ /
  Brouillon ▾ »** (un clic le change), menu ⋮ (Modifier, Voir comme un étudiant, Supprimer).
- **Glisser-déposer** ★ pour ranger les sections et les leçons, **y compris d'une section à l'autre** ; au clavier,
  « Monter », « Descendre » et « Déplacer vers… » restent dans le menu ⋮ (accessibilité).
- Téléphone : la même liste, en lignes compactes (titre sur deux lignes, statut en dessous).

### 3.3 Le statut d'une leçon (nouveau)

- **Brouillon** ou **Publiée**. Une nouvelle leçon naît en **brouillon** ★.
- Les étudiants ne voient que les leçons publiées (programme, nombre de leçons, progression, aperçus).
- La notification « Nouvelle leçon » part quand la leçon est **publiée** dans une formation en ligne (aujourd'hui elle
  part à la création, leçon encore vide).
- Les leçons existantes restent publiées.

### 3.4 L'éditeur de leçon (deux colonnes)

- **Barre du haut** : « ‹ Retour aux leçons (titre de la formation) », « Leçon 1 sur 1 · Module 1 : titre », flèches
  ‹ › (leçon précédente / suivante de la formation), statut **Publiée ▾**, **Enregistrer**, et l'œil **« Voir comme un
  étudiant »**.
- **Colonne de gauche, « Réglages »** :
  - **Vidéo** : le lien YouTube ou Vimeo, l'aperçu du lecteur, « Modifier la vidéo » ;
  - **Durée** : minutes et secondes (deux champs) ;
  - cases **« Activer les commentaires »** et **« Leçon d'aperçu gratuite »** (avec une info-bulle) ;
  - **Documents & fichiers** : dépôt, puis la liste (renommer, consultation seule, ordre, supprimer).
- **Colonne principale** : le **titre** en grand, puis le **texte de la leçon** dans l'éditeur mis en forme (le même
  que celui de la communauté : titres, gras, italique, listes, citation, lien, emojis) ; dessous, repliable, « Dans
  cette leçon » (résumé, points clés) et le titre court.
- « Enregistrer » affiche « La leçon a bien été mise à jour. » ; quitter la page avec des changements non enregistrés
  demande confirmation. ★ La sauvegarde automatique et l'historique des versions restent pour la tâche 4.2/4.4.
- Téléphone : les réglages au-dessus de l'éditeur, comme la capture 8, en tailles compactes.

### 3.5 Voir comme un étudiant

- L'équipe et le formateur de la formation peuvent ouvrir la page du cours et les leçons d'une formation **non
  publiée** (et les leçons en brouillon), avec un bandeau **« Aperçu : pas encore visible des étudiants »**. Leur
  progression n'y est pas enregistrée.

## 4. Base (migrations 0027 et 0028)

**0027 (étape A, les leçons)**

- `lecons.publiee boolean` (vraie pour les existantes, fausse par défaut ensuite), `lecons.commentaires_actifs boolean`
  (vrai par défaut).
- Visibilité : les lectures des étudiants (programme, accès, progression, avis à 50 %, statistiques, suivi du
  formateur) ne comptent que les leçons publiées ; l'équipe et le formateur voient tout.
- `deplacer_lecon(p_lecon, p_module, p_ordre)` : ranger une leçon, y compris dans une autre section.

**0028 (étape B, les discussions)**

- `commentaires_lecons` (leçon, auteur, texte, parent pour les réponses, dates) et `reactions_commentaires_lecons` ;
  fonctions commenter / modifier / supprimer / aimer / lire (droits = accès à la leçon ; suppression par l'auteur, le
  formateur de la formation et l'équipe) ; limite de débit ; signalements dans la file de modération ; notifications.

## 5. Découpage proposé (une étape à la fois, chacune livrée, relue et testée)

1. **Étape A — Création** (onglet Leçons avec glisser-déposer et statut, éditeur de leçon en deux colonnes, texte mis
   en forme, voir comme un étudiant). Migration 0027.
2. **Étape B — Suivi** (barre du haut de la leçon, « Terminer la leçon », programme repliable et tiroir sur téléphone,
   discussions de la leçon, retouches de la page du cours). Migration 0028.
3. **Étape C (facultative)** — onglet « Apprenants » d'une formation.

## 6. À valider (mes propositions entre parenthèses)

1. **Programme de la page leçon** : à gauche comme notre design (**oui**) ou à droite comme izimentor ?
2. **Leçon vidéo** : garder la règle du seuil (**oui**, le bouton « Terminer la leçon » s'active au seuil) ou laisser
   terminer à tout moment ?
3. **Nouvelle leçon en brouillon** par défaut (**oui**) ; les leçons existantes restent publiées.
4. **Discussions** : lisibles et ouvertes aux comptes qui ont accès à la leçon (**oui**) ; sur une leçon d'aperçu
   gratuit, lisibles par les comptes connectés seulement, pas par les visiteurs (**oui**).
5. **Notifications des discussions** : le formateur à chaque nouveau commentaire, l'auteur à chaque réponse (**oui**).
6. **Glisser-déposer** avec une petite bibliothèque reconnue (dnd-kit, accessible au clavier) (**oui**).
7. **Sauvegarde automatique** et historique des versions : plus tard, tâches 4.2/4.4 (**oui**).
8. **Onglet « Apprenants »** : étape C, après A et B (**oui**), ou tout de suite ?
9. **Ordre** : création d'abord (A) puis suivi (B) (**oui**), ou l'inverse ?

## 7. Tests

Règles pures (rangement, statut, droits), migrations sur la base en mémoire (visibilité des brouillons, discussions,
droits de suppression, notifications), écrans (onglet Leçons, glisser-déposer au clavier, éditeur, page leçon,
discussions, tiroir), rendus à 1440, 390 et 320 px.
