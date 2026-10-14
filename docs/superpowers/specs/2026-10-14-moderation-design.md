# Modération — spec

- **Date :** 14 octobre 2026
- **Statut :** écrite sans validation intermédiaire, à la demande de l'utilisateur (« continue avec tes recommandations, je te dirai s'il y a quelque chose à modifier »). Chaque décision prise pour lui est listée au §9.
- **Origine :** lot 5, quatrième partie, après la communauté. Feuille de route, tâche 5.3 : modération automatique des publications par IA, signalements, file de modération dans l'admin. Critère : « Une publication d'arnaque de test est bloquée ; une publication douteuse arrive dans la file. »
- **Cahier des charges :** §30 (signaler du contenu), §31 (modération communautaire : analyse automatique, autoriser / signaler / bloquer ; les commentaires ne sont pas analysés au lancement mais peuvent être signalés).
- **Design de référence :**
  - `NdCommunaute` : « Signaler » dans le menu ⋮, la fenêtre « Signaler cette publication », les messages « Signalement envoyé » et « Les publications sont vérifiées automatiquement. » ;
  - `NdAdmin` : « Modération » dans le menu du back-office, le bloc « À traiter » (« 2 publications signalées », « Jules K., arnaque probable · Brice L., signalée par 3 membres »).
  - Le design n'a pas d'écran de file de modération : il se compose avec les planches de composants et les pages voisines du back-office (Avis, Utilisateurs).

## 1. Ce qui est décidé

| Question | Décision |
|---|---|
| L'analyse automatique | Le titre, le texte et le fichier joint de chaque publication sont analysés par une IA (Claude, d'Anthropic, modèle Haiku) au moment de publier ou de modifier. Elle rend un verdict : autoriser, signaler ou bloquer, avec une catégorie et une raison courte |
| Ce que fait chaque verdict | **Autoriser** : en ligne. **Signaler** : en ligne et dans la file de l'équipe. **Bloquer** : refusée ; l'auteur lit pourquoi, l'équipe peut la rétablir. **Analyse impossible** (panne, délai dépassé, fichier trop lourd) : en ligne et dans la file |
| Les catégories | Spam, harcèlement, haine, contenu sexuel ou inapproprié, arnaque, hameçonnage, publicité abusive, contenu illégal, hors sujet, autre violation des règles |
| Les réponses | Pas analysées (cahier des charges) ; elles se signalent et se suppriment |
| La clé de l'IA | Saisie par l'utilisateur dans `web/.env.local` (`ANTHROPIC_API_KEY`), lue seulement par le serveur de l'application ; jamais dans le navigateur, jamais dans le dépôt |
| La confiance de la base | La base n'applique un verdict que s'il porte le **jeton de modération**, créé par la migration et recopié par l'utilisateur dans `web/.env.local` (`MODERATION_JETON`). Un appel direct à la base, sans passer par l'application, ne peut donc pas se dispenser de l'analyse |
| Activer l'analyse | Au back-office, bouton **Activer l'analyse automatique**, possible seulement quand la clé et le jeton sont en place. **Désactiver** la coupe : on publie alors sans vérification, comme avant |
| Sans verdict, analyse active | La publication attend l'équipe (« En attente de vérification ») : visible de son auteur et de l'équipe seulement |
| Signaler | Toute personne qui lit l'espace, sauf l'auteur et l'équipe, signale une publication ou une réponse : un motif (« Contenu inapproprié », « Spam ou publicité », « Harcèlement », « Autre ») et des précisions facultatives (obligatoires pour « Autre »). Un signalement par compte et par contenu. L'auteur ne sait jamais qui l'a signalé |
| La file de l'équipe | `/admin/moderation`, pour le modérateur, l'admin et le super admin : « À examiner » et « Bloquées » ; **Garder**, **Supprimer**, **Rétablir** |
| Notifications | À l'équipe : « À modérer » quand un contenu entre dans « À examiner » (une fois par contenu, pas à chaque signalement suivant ; rien pour une publication bloquée). À l'auteur : « Publication retirée » ou « Réponse retirée » quand l'équipe supprime ; « Publication en ligne » quand l'équipe publie une publication en attente ou bloquée. Toutes en catégorie « service » (toujours envoyées) |
| Publier trop vite | 5 publications et 30 réponses par compte toutes les 10 minutes au plus : « Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes. » |
| Le fichier joint | La base vérifie le type et la taille réels du fichier, ceux que le stockage a enregistrés, et non ceux qu'annonce le navigateur ; à l'analyse, le serveur relit ses premiers octets |

## 2. Qui peut quoi

- **Publier, modifier :** comme avant (communauté). Quand l'analyse est active, tout passe par elle.
- **Signaler :** qui lit l'espace du contenu, sauf son auteur et l'équipe.
- **La file, Garder, Supprimer, Rétablir, activer ou désactiver l'analyse :** l'équipe (modérateur, admin, super admin).
- **Voir une publication en attente :** son auteur et l'équipe. **Une publication bloquée :** l'équipe seule.
- **Un compte suspendu :** rien, comme partout.

## 3. L'analyse automatique

- **Quand :** à chaque publication et à chaque modification d'une publication (la modification n'analyse que le titre et le texte : le fichier ne change pas).
- **Ce qui part à l'IA :**
  - le titre et le texte, présentés comme des données à juger, jamais comme des consignes ;
  - l'espace (général ou parcours), pour juger le hors-sujet ;
  - l'image, réduite par le serveur à 1 568 px de côté au plus ;
  - le PDF, s'il fait 5 Mo au plus ; au-delà, l'analyse est « impossible » (en ligne et dans la file).
- **Le modèle :** Claude Haiku (`claude-haiku-5-5`, réglable par `MODERATION_MODELE`), température 0, réponse imposée par un outil `rendre_verdict` ({ decision, categorie, raison }), vérifiée par le serveur.
- **Délai :** 20 secondes au plus ; au-delà, « analyse impossible ».
- **Le fichier :** le serveur le relit depuis le stockage avec la session de l'auteur et vérifie ses premiers octets. Un faux PDF ou une fausse image est refusé : « Ce fichier n’est pas une image ou un PDF valide. », et le fichier est retiré.
- **Ce que voit l'auteur :**
  - autorisée ou signalée : « Publication en ligne » · « Elle apparaît en haut du fil. » (un signalement de l'IA ne se voit pas) ;
  - en attente : « Publication envoyée » · « Elle paraîtra après vérification par l’équipe Étudium. » ; sa carte porte « En attente de vérification » ;
  - bloquée : « Votre publication n’a pas été publiée : elle semble enfreindre les règles de la communauté (<catégorie>). Si c’est une erreur, l’équipe Étudium pourra la rétablir. » Le texte reste dans le champ ;
  - modification bloquée : le même message, et l'ancienne version reste en ligne.
- **Le champ de publication** dit « Les publications sont vérifiées automatiquement. » quand l'analyse est active, et « Soyez bienveillant : l’équipe Étudium veille aux échanges. » sinon.

## 4. Signaler

- **Où :**
  - publication : le menu ⋮ → **Signaler** ;
  - réponse : une icône drapeau, « Signaler la réponse de <Prénom N.> ».
- **La fenêtre** (design `NdCommunaute`) :
  - « Signaler cette publication » (ou « Signaler cette réponse ») ;
  - « L’équipe Étudium examinera votre signalement. L’auteur ne saura pas qui l’a envoyé. » ;
  - les motifs « Contenu inapproprié », « Spam ou publicité », « Harcèlement », « Autre » ;
  - « Précisions » (500 caractères au plus ; obligatoires pour « Autre » : « Précisez le motif du signalement. ») ;
  - **Annuler** et **Envoyer le signalement**.
- **Ensuite :** « Signalement envoyé » · « Merci, la publication a été signalée à la modération. » (« la réponse » pour une réponse). Un second signalement du même contenu : « Vous avez déjà signalé ce contenu. ».

## 5. La file de modération (`/admin/moderation`)

- **En-tête :** « Modération » · « Examinez les publications signalées par l’analyse automatique ou par les membres. ».
- **Le bloc « Analyse automatique » :**
  - active : « Active » et **Désactiver** (avec confirmation) ;
  - inactive : « Inactive : les publications paraissent sans vérification. » ; l'état de la clé (« présente » ou « absente ») et du jeton (« reconnu », « non reconnu » ou « absent ») sur le serveur ; **Activer l'analyse automatique** quand les deux sont en place ; sinon, renvoi à la section 25 du guide ;
  - publications en attente alors que l'analyse est active : « N publications attendent : l’analyse n’a pas pu les vérifier. Vérifiez la clé de l’IA. ».
- **Les onglets :** « À examiner » (avec leur nombre) et « Bloquées ».
- **Un élément** (le plus ancien d'abord, 50 au plus) :
  - « Publication » ou « Réponse », l'espace, l'auteur (lien vers sa fiche au back-office, pour le suspendre au besoin), le moment ;
  - le titre, le texte entier, le fichier (lien temporaire) ; pour une réponse, le début de la publication ;
  - les raisons : « Analyse automatique : Arnaque — <raison> », « Analyse impossible », « En attente : non analysée », « Signalée par 3 membres : Spam ou publicité (2), Harcèlement (1) », avec les précisions et le nom court des signaleurs ;
  - **Garder** : les signalements sont classés, l'élément quitte la file ; une publication en attente est publiée ;
  - **Supprimer** (confirmation « Supprimer ce contenu ? ») : il disparaît, son fichier aussi, et l'auteur est prévenu ;
  - **Rétablir** (onglet « Bloquées ») : la publication est mise en ligne, l'auteur est prévenu ;
  - **Ouvrir la publication** (sa page).
- **Vide :** « Rien à examiner » · « Les publications signalées par l’analyse ou par les membres apparaîtront ici. » ; « Aucune publication bloquée » · « Les publications refusées par l’analyse automatique apparaîtront ici. ».
- **Le tableau de bord du back-office :** une tuile « Contenus à examiner » (leur nombre, lien vers la file).

## 6. Base de données (migration 0020)

- **`publications`** gagne :
  - `statut` (`publiee`, `en_attente`, `bloquee`), `publiee` par défaut : les publications existantes restent en ligne ;
  - `analyse` (jsonb : decision, categorie, raison, le) ;
  - `a_examiner` (booléen) : signalée par l'analyse, ou analyse impossible.
- **`signalements`** : une publication ou une réponse, le compte qui signale, le motif, les précisions, la date, la date de traitement. Un seul par compte et par contenu.
- **`reglages_moderation`** (une ligne) : le jeton, `analyse_active`, la dernière analyse. Fermée à tous : seules des fonctions la lisent.
- **Fonctions :**
  - `moderation_active()` ; `jeton_moderation_valide(p_jeton)` (équipe) ; `regler_analyse(p_active, p_jeton)` (équipe ; activer demande le jeton) ;
  - `publier(…, p_analyse)` et `modifier_publication(…, p_analyse)` : appliquent le verdict s'il porte le bon jeton ; sinon, publication directe (analyse inactive) ou en attente (analyse active) ; la limite de débit ;
  - `signaler(p_publication, p_commentaire, p_motif, p_precisions)` ;
  - `file_moderation(p_onglet)`, `nombre_a_examiner()` ;
  - `garder_contenu`, `supprimer_contenu` (rend le chemin du fichier), `retablir_publication` ;
  - toutes les lectures de la communauté (fil, page, réponses, J’aime, membres actifs, fichiers) ne montrent que les publications en ligne, plus les siennes en attente.
- **`verifier_piece`** lit le type et la taille dans les métadonnées du stockage.
- Rejouable, comme les précédentes ; le jeton existant est conservé.

## 7. Erreurs et cas limites

- **Avant la 0020 :** la communauté marche comme avant (pas d'analyse, pas de « Signaler ») ; la page Modération affiche le bandeau « Appliquez la migration 0020 (guide « Ce qui te revient », section 25). ».
- **Clé absente ou fausse, analyse active :** les publications attendent l'équipe ; le bloc « Analyse automatique » le dit.
- **Une IA qui répond mal** (format inattendu) : « analyse impossible ».
- **Publication supprimée pendant son examen :** l'action de l'équipe répond « Ce contenu n’existe plus. ».

## 8. Tests

- **Base (banc PGlite) :** jeton, statuts, visibilité dans le fil et la page, fichiers d'une publication en attente ou bloquée, signalements (unicité, droits), file, Garder, Supprimer, Rétablir, notifications, limite de débit, métadonnées du fichier, rejouable.
- **Serveur :** l'appel à l'IA (requête, image réduite, PDF, délai, réponse invalide), les actions (verdict transmis avec le jeton, refus, faux fichier).
- **Écrans :** la fenêtre Signaler, la carte en attente, la mention du champ, la file (onglets, actions, bloc d'analyse), la tuile du tableau de bord.
- **Rendu** à 1440, 390 et 320 px : la file avec un texte de 3 000 caractères sans espace.

## 9. Décisions prises pour l'utilisateur (à corriger s'il le souhaite)

1. L'IA est Claude Haiku d'Anthropic : peu coûteuse, à l'aise en français, et elle lit les images et les PDF. Il faudra un compte Anthropic avec du crédit.
2. Les publications partent chez Anthropic pour l'analyse : à mentionner dans la politique de confidentialité.
3. Une analyse impossible publie quand même, et met la publication dans la file, plutôt que de la bloquer.
4. L'analyse s'active à la main, au back-office, une fois la clé et le jeton en place.
5. Une publication bloquée est gardée, cachée, pour que l'équipe puisse la rétablir en cas d'erreur.
6. Une modification est réanalysée ; si elle est bloquée, l'ancienne version reste en ligne.
7. « Autre » demande des précisions ; un seul signalement par compte et par contenu ; l'équipe voit qui a signalé.
8. L'équipe est prévenue dans la cloche de chaque contenu qui entre dans la file ; l'auteur, quand l'équipe retire ou publie son contenu.
9. Une limite de débit : 5 publications et 30 réponses par tranche de 10 minutes.
10. Pas de compteur dans le menu du back-office pour l'instant : la tuile du tableau de bord et la cloche suffisent.
