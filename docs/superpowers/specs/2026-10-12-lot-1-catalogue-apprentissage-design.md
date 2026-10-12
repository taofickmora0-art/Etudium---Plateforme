# Lot 1 — Catalogue + apprentissage : spec technique

- **Date :** 12 octobre 2026
- **Statut :** **brouillon, à relire** (tâche 1.0). Rien n'est codé tant que tu ne l'as pas validé.
- **Références :** [feuille de route](2026-10-09-feuille-de-route-design.md) · [spec du lot 0](2026-10-10-lot-0-fondations-design.md) · design « Étudium — Nouveau design » (https://claude.ai/artifact/9Ei2bCdhG75Nr3KnFZQxfg) · cahier des charges V1 (cité « CDC §n »)

À la fin du lot 1, **un visiteur découvre Étudium, parcourt le catalogue, regarde un aperçu, crée son compte et suit une formation gratuite de bout en bout** : vidéo, ressources, progression, reprise, favoris, recherche, avis. Sur ordinateur et sur téléphone, avec le rendu du design.

Les abonnements et le paiement arrivent au lot 2. Le lot 1 prépare quand même la place des formations payantes : elles s'affichent, verrouillées, avec leur parcours.

---

## 1. Ce que tu dois trancher

Le cahier des charges ne répond pas à ces questions. Pour chacune, je te fais une proposition : si elle te va, réponds simplement « OK pour tout » ; sinon, donne-moi le numéro et ta décision.

| # | Question | Ma proposition |
|---|---|---|
| Q1 | L'aperçu gratuit est-il visible **sans compte** ? | **Oui.** Le CDC décrit « Accueil → Catalogue → Formation → Aperçu → Création de compte » (§62). Le visiteur regarde les leçons d'aperçu ; un bandeau l'invite à créer son compte pour enregistrer sa progression. |
| Q2 | Comment calculer le **pourcentage** d'une formation ? | **Leçons terminées ÷ leçons de la formation.** Chaque leçon compte pareil, quelle que soit sa durée. Le temps restant affiché (« 2 h restantes ») est la somme des durées des leçons non terminées. Les quiz et exercices (lot 3) ne comptent pas dans le pourcentage (règle R17). |
| Q3 | Quand une leçon est-elle **terminée** ? | **Leçon avec vidéo :** automatiquement, dès que le temps réellement regardé atteint le seuil. Le bouton « Marquer comme terminée » reste grisé avant, avec « Regardez au moins 90 % de la vidéo ». **Leçon sans vidéo :** quand on clique « Marquer comme terminée ». |
| Q4 | Le **seuil de validation** des vidéos se règle où ? | **Par formation**, 90 % par défaut (la valeur du design). Une seule valeur pour toutes ses vidéos : plus simple à régler. |
| Q5 | Quels **niveaux** ? | **Débutant, Intermédiaire, Avancé.** Les filtres n'affichent que les niveaux qui ont au moins une formation. |
| Q6 | Durée et nombre de leçons : saisis ou calculés ? | **Calculés** à partir des leçons. Les chiffres sont toujours justes, et l'incohérence du design (« 6 leçons » pour 5 lignes) disparaît. |
| Q7 | Le **formateur** affiché sur la fiche, avant l'espace formateur (lot 4) ? | Une **fiche formateur** saisie dans le back-office : nom, titre (« Enseignante en statistiques appliquées »), domaine, courte présentation, photo. Un formateur principal par formation. Au lot 4, la fiche sera reliée à son compte. |
| Q8 | **Avis** : commentaire obligatoire ? suppression ? modération ? | Note de 1 à 5 **obligatoire**, commentaire **facultatif** (1 000 caractères au plus). L'auteur peut modifier ou supprimer son avis. Il est affiché avec le prénom et l'initiale du nom (« Fifamè A. »). L'équipe peut **masquer** un avis depuis le back-office. Un avis reste en place si l'accès à la formation est perdu. |
| Q9 | Onglet **« Questions »** sous la vidéo et bouton « Écrire à la formatrice » ? | Ils dépendent de la communauté et de la messagerie (lot 5). **Masqués jusqu'au lot 5.** L'onglet **« Notes »** (notes privées) arrive dès le lot 1. |
| Q10 | **Tarifs** sur la landing, alors que les prix arrivent au lot 2 ? | La section « Formules » montre les trois formules et leur contenu, **sans prix** : « Prix annoncés au lancement ». Au lot 2, les prix viennent du back-office. |
| Q11 | **Témoignages** et **chiffres** de la landing (« [NOMBRE] étudiants inscrits »…) ? | **Masqués** tant qu'on n'a pas de vrais témoignages et des chiffres parlants. Tu les ajouteras depuis le back-office. Pas de faux témoignages. |
| Q12 | Les **vidéos de test** ? | Je crée les 3 parcours et les 10 formations du design (titres, descriptions, programme d'Excel). **Toi**, tu choisis quelques vidéos YouTube et tu colles leurs liens dans le back-office (tâche 1.2) : c'est aussi ta validation du back-office. |

---

## 2. Écrans du lot 1

Une seule adresse par formation, pour le visiteur comme pour l'étudiant : le lien partagé sur WhatsApp fonctionne pour tout le monde. La page s'adapte à la personne (vue publique ou vue inscrite).

| Adresse | Écran du design | Ce qui fonctionne |
|---|---|---|
| `/` | `NdLanding` | Landing page (visiteur). Un compte connecté va directement à `/accueil`. |
| `/formations` | `NdCataloguePublic` (visiteur), `NdCatalogue` (connecté), `NdMobCatalogue` | Recherche, filtres parcours, accès (gratuites / incluses dans un abonnement), niveau, tri (parcours, plus récentes, note, durée), compteur, état vide « Aucune formation ne correspond » |
| `/formations/[nom-de-la-formation]` | `NdFormationPublic` (visiteur), `NdFormation` (connecté) | Fiche complète, programme en accordéon, aperçu gratuit, avis, favori, « Continuer » ; aperçu du lien au partage (titre + image) |
| `/formations/[…]/lecons/[…]` | `NdLecon`, `NdMobLecon` | Programme à gauche, lecteur vidéo, « Dans cette leçon », onglets Ressources et Notes, leçon précédente / suivante, « Marquer comme terminée ». Sur téléphone : onglets Programme, Ressources et Notes (Notes ajouté au design mobile, Q9). |
| `/parcours` | `NdParcours` | Mes parcours : un onglet par parcours, progression du parcours, liste des formations avec leur progression. Au lot 1, sans abonnement, les parcours s'affichent « Non inclus » avec un bouton vers les formules (lot 2). |
| `/mes-formations` | `NdMesFormations`, `NdMobFormations` | Formations commencées ; filtres Toutes, En cours, Terminées, Verrouillées, Favoris |
| `/favoris` | `NdFavoris`, `NdFavorisVide` | Retirer un favori (avec confirmation), état vide |
| `/recherche?q=…` | `NdRecherche`, `NdRechercheVide` | Formations, parcours et leçons ; sans accents ni majuscules (« zotéro » trouve « Zotero ») ; état vide avec « Recommandé pour vous » |
| `/accueil` | `NdAccueil` (version de base) | Voir §8 |
| `/admin/…` | aucun (pas d'écran de back-office dans le design) | Voir §10 |

Le menu « Formations gratuites » ouvre `/formations` filtré sur les formations gratuites. Le bouton d'en-tête « + Ajouter une formation » ouvre le catalogue.

**En-tête public** : « Parcours » (ancre de la landing), « Formations », « Tarifs » (ancre « Formules » de la landing jusqu'au lot 2), « Communauté » (ancre). « Vérifier un certificat » apparaît au lot 3, quand la page existe.

---

## 3. Qui voit quoi : la règle d'accès

Le CDC impose que l'accès soit décidé à un seul endroit (§37, R1 à R15). Je l'écris dès maintenant, **une fois, dans la base** (une fonction utilisée par toutes les règles d'accès), et l'application l'interroge pour afficher les cadenas. Le lot 2 ajoutera simplement les abonnements et les achats.

| État | Quand | Ce que la personne voit |
|---|---|---|
| **Gratuite** | La formation est gratuite | Tout, avec un compte gratuit |
| **Aperçu** | La leçon est marquée « aperçu » | La leçon, même sans compte (Q1) |
| **Incluse** (lot 2) | La formation est dans un parcours de son abonnement actif | Tout |
| **Complémentaire** (lot 2) | Formation achetée seule, abonnement actif (R9, R10) | Tout |
| **Verrouillée** | Aucun des cas ci-dessus | La fiche, le programme et les avis ; les leçons ont un cadenas |
| **Équipe** | Rôle admin ou super_admin | Tout, pour vérifier les contenus |

**Une formation archivée** disparaît du catalogue et de la recherche, et ses leçons se ferment (R24). Ceux qui l'avaient commencée la voient encore dans « Mes formations », verrouillée, avec leur progression intacte. La notification des étudiants concernés (R25) arrivera avec les notifications (lot 5).

**Protection des vidéos** (CDC §55) : l'identifiant d'une vidéo n'est envoyé au navigateur que si la personne a accès à la leçon. Une protection absolue n'existe pas ; on applique ce que YouTube et Vimeo permettent.

---

## 4. Base de données

Comme au lot 0 : des fichiers SQL dans `web/supabase/migrations/`, que tu appliques dans l'éditeur SQL de Supabase, et des règles d'accès vérifiées par la base.

| Table | Contenu |
|---|---|
| `parcours` | nom (« Réussite académique »), nom court (« Académique »), description, couleur (académique, digital, business : les teintes du design), ordre, actif |
| `formateurs` | nom, titre, domaine, présentation, photo ; lien vers un compte au lot 4 |
| `formations` | adresse (`maitriser-microsoft-excel`), titre, résumé de carte (2 lignes), description, « Ce que vous allez apprendre » (liste), compétences acquises (liste), niveau, formateur, gratuite oui/non, disponible seule oui/non, prix (utilisé au lot 2), badge (Populaire, Nouveau), seuil vidéo (90 %), statut (**brouillon**, **publiée**, **archivée**), date de publication, note moyenne et nombre d'avis (tenus à jour par la base) |
| `formations_parcours` | une formation dans un ou plusieurs parcours (CDC §7), avec son ordre dans chacun |
| `modules` | formation, titre, ordre |
| `lecons` | module, titre, titre court (programme de gauche), durée, aperçu oui/non, résumé et points clés (« Dans cette leçon »), ordre |
| `lecons_contenus` | vidéo (YouTube ou Vimeo + identifiant), texte de la leçon. **Séparée** : lisible seulement avec l'accès à la leçon. |
| `ressources` | leçon, titre, fichier, format, taille, téléchargeable oui/non, ordre |
| `progression_lecons` | compte, leçon, position de reprise, passages réellement regardés, terminée le, dernière visite |
| `suivi_formations` | compte, formation, commencée le, dernière leçon ouverte, terminée le (pour « Mes formations » et « Continuer ») |
| `favoris` | compte, formation |
| `avis` | compte, formation, note, commentaire, masqué oui/non ; un seul par compte et par formation |
| `notes_lecons` | compte, leçon, texte (privé) |

**Fichiers** : un espace privé `ressources` (50 Mo par fichier au plus, la limite du plan gratuit de Supabase). Les fichiers ne sont jamais publics : chaque ouverture passe par un lien temporaire (1 minute), donné seulement à qui a accès à la leçon.

**Règles d'accès** : catalogue lisible par tous (formations publiées seulement) ; contenus des leçons selon §3 ; progression, favoris, notes : chacun les siens ; avis : lisibles par tous (sauf masqués), écrits par leur auteur à partir de 50 % ; saisie des contenus : rôles admin, moderateur et super_admin (CDC §47).

---

## 5. Vidéo et progression

**Lecteur** (CDC §14) : lecteur aux couleurs d'Étudium posé sur le lecteur officiel de YouTube ou de Vimeo. Lecture/pause, volume, avancer dans la vidéo, vitesse, plein écran, sous-titres quand la vidéo en a. **Pas de choix de la qualité** : YouTube ne le permet plus dans un lecteur intégré ; la qualité s'adapte seule à la connexion.

**Temps réellement regardé** :
- on enregistre les **passages réellement lus** (de 2:10 à 4:35…), pas la position atteinte ;
- un passage lu deux fois ne compte qu'une fois ; un saut dans la barre ne compte pas (« Avancer dans la barre ne compte pas », écrit sous la vidéo comme dans le design) ;
- envoi toutes les 10 secondes, à la pause et en quittant la page ; la base refuse un passage plus long que le temps réellement écoulé ;
- la leçon est terminée quand le total atteint le seuil de la formation (Q3, Q4).

**Reprise** : la vidéo reprend là où on l'avait laissée ; « Continuer » ouvre la dernière leçon ouverte.

**YouTube et Vimeo** : YouTube (vidéos « non répertoriées ») pour les formations gratuites, Vimeo pour les payantes (décision de la feuille de route). Au lot 1, je branche les deux lecteurs ; Vimeo se teste avec une vidéo publique. La restriction « lecture seulement sur Étudium » demande l'offre payante de Vimeo et l'adresse du site en ligne : **(toi)** ouvrir le compte Vimeo, au plus tard avant le lancement des formations payantes (lot 2).

---

## 6. Ressources

- **Téléchargeable** : bouton « Télécharger ».
- **Consultation seule** (CDC §15) : bouton « Consulter », qui ouvre le **visualiseur intégré** : un PDF y est affiché page par page, sans bouton de téléchargement ni d'impression ; une image s'y affiche aussi. Ce n'est pas une garantie absolue (une capture d'écran reste possible), et l'interface ne le prétend pas.
- **Formats** : PDF, JPG, PNG et WebP peuvent être en consultation seule ; les autres (Excel, Word, ZIP…) sont seulement téléchargeables. Le back-office l'empêche à la saisie.
- **Contrôle à l'envoi** : le vrai format du fichier est vérifié (comme pour la photo de profil), pas seulement son nom.

---

## 7. Avis

- Bouton « Laisser un avis » sur la fiche **à partir de 50 % de progression** (CDC §41) ; en dessous, la phrase du design « Vous pourrez laisser un avis à partir de 50 % de progression ». La base vérifie elle aussi la règle.
- Un avis par formation, modifiable et supprimable (Q8). Note moyenne, nombre d'avis et répartition par étoiles sur la fiche, et note sur les cartes.
- Sans avis : la fiche affiche « Pas encore d'avis » au lieu d'une note à 0.

---

## 8. Mes formations, favoris, recherche, tableau de bord

**Mes formations** : les formations commencées (au moins une leçon ouverte). Les filtres « incluses dans les parcours » et « complémentaires » du CDC (§23) prennent sens au lot 2 ; « Verrouillées » regroupe déjà les formations archivées commencées. Badge « Verrouillée » sur les cartes concernées, sur téléphone **et** sur ordinateur.

**Favoris** : des formations seulement (CDC §24). Le cœur se trouve sur la fiche et sur la carte des favoris.

**Recherche** : formations, parcours et leçons (les sessions live du design arrivent au lot 5, les publications et formateurs aux lots 4 et 5). Une recherche ne renvoie que ce qui est publié.

**Tableau de bord, version de base** (`/accueil`) : seulement les blocs qui ont de vraies données au lot 1.

| Bloc du design | Au lot 1 |
|---|---|
| « Bonjour, [prénom] », « Explorer le catalogue » | Oui |
| Tuiles « Progression globale » et « Formations en cours » | Oui. Progression globale = moyenne des formations commencées. Pas de « +12 % ce mois » tant qu'on n'a pas l'historique. |
| « Continuer l'apprentissage » | Oui : dernière leçon ouverte, en un clic |
| « À faire » | Oui, avec la « Leçon suivante » de chaque formation en cours ; quiz et exercices au lot 3 |
| « Recommandé pour vous » | Oui, version simple : formations du même parcours, pas encore commencées. Les recommandations personnalisées viennent au lot 6. |
| Alerte d'expiration, tuile Certificats, session live, objectif de la semaine, série, activité récente | Avec leur lot (2, 3, 5 et 6) |

Un compte qui n'a rien commencé voit un état vide qui l'oriente vers les formations gratuites.

---

## 9. Landing page et FAQ

- Les sections du design `NdLanding`, dans l'ordre : hero, « Vous vous reconnaissez ? », la solution, les trois parcours, « Comment ça marche », formations, formules (sans prix, Q10), accompagnement, communauté, témoignages et chiffres (masqués, Q11), FAQ, appel à l'action final, pied de page.
- Textes : ceux du design, tels quels. Les 7 questions de la FAQ du design sont cohérentes avec le CDC et la feuille de route ; je les reprends. Tu pourras les modifier ensuite.
- Bouton principal partout : « Créer mon compte gratuit » (CDC §51).
- Pied de page : « Contact » demande une adresse e-mail de contact (**(toi)** : laquelle ?).
- Aperçu au partage (Open Graph) : titre, description et une **image générée automatiquement** pour chaque formation (titre, couleur et illustration du parcours, logo). Aucune image à fournir.

---

## 10. Back-office minimal (tâche 1.2)

Le design n'a pas d'écran de back-office. Je le construis avec les composants déjà en place (cartes, champs, boutons, listes), sobre et sans nouveaux éléments visuels. L'éditeur riche, la sauvegarde automatique et l'historique des versions (CDC §11-12) arrivent au lot 4, avec l'espace formateur.

| Page | Ce qu'on y fait |
|---|---|
| `/admin` | Raccourcis vers les pages ci-dessous |
| `/admin/parcours` | Créer, modifier, ordonner, désactiver un parcours |
| `/admin/formateurs` | Fiches formateurs |
| `/admin/formations` | Liste (brouillons, publiées, archivées), création |
| `/admin/formations/[…]` | Informations ; parcours ; programme (modules et leçons, ordre par boutons « monter » / « descendre ») ; lien de la vidéo (YouTube ou Vimeo, vérifié à la saisie) ; ressources (envoi de fichiers) ; publier, archiver, restaurer |
| `/admin/avis` | Masquer ou réafficher un avis |

On n'efface jamais une formation publiée : on l'archive (CDC §39). Un brouillon peut être supprimé.

---

## 11. Incohérences du design : ce que je propose

| Incohérence | Proposition |
|---|---|
| Badge « À corriger » ambre sur la fiche, bleu dans le programme de la leçon | **Ambre partout** (en attente d'une action). Il apparaît au lot 3, avec les exercices. |
| Nombre de leçons annoncé ≠ lignes listées | Calculé à partir des données (Q6) |
| Badge « Verrouillée » présent sur téléphone, absent sur ordinateur | Présent sur les deux |
| Catalogue mobile qui renvoie vers la fiche ordinateur ; « Formations gratuites » sans filtre | Une seule adresse par fiche, qui s'adapte à l'écran ; menu filtré sur les gratuites |
| Contenus de remplacement « [PRIX] », « [NOMBRE] », témoignages | Q10 et Q11 |

---

## 12. Les tâches du lot 1

| # | Tâche | Ce que tu fais | Tu valides quand… |
|---|---|---|---|
| 1.1 | Structure des contenus, règle d'accès (§3), données d'exemple (3 parcours, 10 formations du design) | Appliquer la migration | Les données d'exemple sont visibles dans Supabase |
| 1.2 | Back-office minimal | Coller les liens de quelques vidéos YouTube (Q12) | Tu crées toi-même une formation complète (2 modules, 4 leçons) |
| 1.3 | Catalogue et fiche formation (visiteur et connecté), aperçu, image de partage | — | Le catalogue filtre comme le design ; la fiche affiche son aperçu. **Le test WhatsApp** demande l'adresse en ligne : en local, je te montre l'image de partage et on fera le test au passage en production. |
| 1.4 | Mes parcours | — | La page correspond au design |
| 1.5 | Interface de cours (ordinateur et téléphone), notes privées | — | Tu suis une leçon de bout en bout, sur téléphone et sur ordinateur |
| 1.6 | Lecteur vidéo YouTube et Vimeo, temps réellement regardé, seuil | Compte Vimeo (peut attendre le lot 2) | Une vidéo sautée jusqu'à la fin n'est **pas** validée ; une vidéo regardée l'est |
| 1.7 | Progression : pourcentage, leçons terminées, reprise | — | Après quelques leçons, le pourcentage affiché est juste |
| 1.8 | Ressources et visualiseur intégré | — | Un PDF en consultation seule s'affiche sans bouton de téléchargement |
| 1.9 | Mes formations, favoris, recherche | — | Tu retrouves une formation par la recherche et dans tes favoris |
| 1.10 | Tableau de bord, version de base | — | En te connectant, tu reprends ta dernière leçon en un clic |
| 1.11 | Avis et notes | — | Sous 50 %, tu ne peux pas noter ; au-dessus, ta note apparaît sur la fiche |
| 1.12 | Landing page et FAQ | Adresse e-mail de contact | Tu as relu textes et mise en page, sur téléphone et sur ordinateur |

Ordre de travail : 1.1 et 1.2 d'abord (il faut des contenus), puis 1.3 → 1.12 dans l'ordre. Comme au lot 0 : une tâche à la fois, ton OK avant la suivante.

---

## 13. Hors du lot 1 (pour mémoire)

- Abonnements, paiement, achat de formations complémentaires, page Tarifs avec prix : lot 2.
- Quiz, exercices, certificats, page de vérification : lot 3.
- Éditeur riche, sauvegarde automatique, historique des versions, espace formateur : lot 4.
- Questions sous les leçons, messagerie, sessions live, notifications (dont l'archivage d'une formation) : lot 5.
- Statistiques, recommandations personnalisées, série, points, objectifs : lot 6.
- Hébergement vidéo propre, téléchargement hors connexion : après le lancement (CDC §60).
