# Inscription aux formations, cartes du catalogue, fiche et profil du formateur

Date : 2026-11-02. Demande de l'utilisateur, avec captures d'une autre plateforme (catalogue en cartes, page d'un cours, carte du formateur au survol) et de trois blocs d'Étudium. Il est absent et a demandé d'aller jusqu'au bout : les décisions prises pour lui sont listées à la fin (§9).

## 1. Ce qui est demandé (reformulé)

1. **Messagerie** : l'étudiant ne voit, comme formateurs à qui écrire, que ceux des formations où il est **inscrit** ; il peut **rechercher un formateur** par son nom.
2. **Cartes du catalogue** au style des captures, en gardant le nombre de colonnes déjà défini : couverture, titre, « N modules • N leçons », « N apprenants », résumé, puis en bas « N % terminé » (formation où l'on est inscrit) ou « Voir le cours ».
3. **Favoris dans le catalogue** : un cœur vide sur chaque carte ; en favori, il devient rouge et plein (comme les « J'aime » de la communauté).
4. **Inscription** : sur la fiche, un bouton « S'inscrire à ce cours ». Tant qu'on n'est pas inscrit, les leçons ont un cadenas (sauf les leçons d'aperçu).
5. **Formateur à côté du programme** : nom, avatar, titre, présentation, réseaux. Au survol du nom : une carte avec « Voir le profil » et « Message ». Le profil du formateur permet aussi de lui écrire.
6. **Dans une leçon ouverte** : pas de bloc formateur, la page reste comme aujourd'hui.
7. **Supprimer les formations d'exemple** (créées pour que le catalogue ne soit pas vide).
8. **Harmoniser** : les blocs « Continuer l'apprentissage » (bouton plein « Explorer le catalogue ») et la rangée « Mes formations » (lien « Voir plus › ») prennent la structure simple du bloc « Prochaine session » : un titre, une phrase, un lien bleu sans flèche. La structure des formations (modules et leçons) s'affiche de la même façon partout : « Module N - Titre », « N leçons • durée ».

## 2. L'inscription (migration 0069)

- Table `inscriptions_formations (profil_id, formation_id, inscrit_le)`, clé (profil, formation). Lecture : ses propres lignes (et l'équipe des contenus). Aucune écriture directe.
- `s_inscrire_formation(p_formation uuid)` (security definer) : compte connecté, non suspendu, sans le rôle formateur ; formation publiée ; formation **ouverte** à ce compte (gratuite, ou abonnement actif). Rejouable (déjà inscrit : rien ne change). Erreurs en français.
- `formation_ouverte(p_formation uuid)` : la règle d'avant (équipe des contenus, formateur de la formation, ou : publiée et (gratuite et connecté, ou abonné)), sans l'inscription. Sert au bouton « S'inscrire » / « Voir les abonnements ».
- `acces_lecon` : pour un étudiant, une leçon non d'aperçu exige en plus l'**inscription** à sa formation. Les leçons d'aperçu restent ouvertes comme aujourd'hui. L'équipe des contenus et le formateur de la formation ne sont pas concernés.
- **Rattrapage** : chaque compte qui a déjà une progression (ou un certificat) dans une formation y est inscrit, à la date de sa première leçon ouverte. Personne ne perd l'accès.
- `apprenants_formations()` (lisible par tous, visiteurs compris) : pour chaque formation publiée, le nombre d'inscrits.
- Messagerie : `suit_formation_de` lit les inscriptions (au lieu de la progression).
- « Mes formations » et les cartes : une formation où l'on est inscrit est « à moi », même à 0 %.
- À la fin d'un abonnement, l'inscription reste ; les leçons payantes se verrouillent comme aujourd'hui.

## 3. Le formateur public (migration 0070)

- `formateurs.reseaux jsonb not null default '{}'` : clés permises `instagram`, `youtube`, `linkedin`, `facebook`, `telegram`, `tiktok` ; valeurs en `https://…`, 300 caractères au plus (contrainte SQL). Formulaire de la fiche formateur au back-office : six champs facultatifs.
- `formateur_public(p_formateur uuid)` (lisible par tous) : nom, titre, domaine, présentation, réseaux, photo du compte relié s'il en a une, date d'arrivée (`cree_le`), formations publiées (id, slug, titre, résumé, couverture, parcours), leur nombre, et `peut_ecrire` (le compte connecté est inscrit à une de ses formations et la fiche est reliée à un compte formateur).
- Pour la fiche d'une formation, les mêmes informations sur son formateur (sans la liste des formations, avec leur nombre).

## 4. Les cartes du catalogue

- Couverture comme aujourd'hui (parcours et badge posés dessus). Titre. Ligne « N modules • N leçons » et « N apprenants » (icône). Résumé sur deux lignes. Ligne note ★ · durée · niveau (déjà définie, gardée).
- En bas, à gauche, un bouton doux pleine largeur : « N % terminé » si inscrit, sinon « Voir le cours ». À droite (compte connecté seulement), le cœur favori : vide (gris) ou plein rouge (`text-erreur-vif`). Le clic sur le cœur n'ouvre pas la fiche ; il bascule sans confirmation ; une erreur s'annonce par un message.
- Colonnes : `GRILLE_CONNECTEE` et `GRILLE_PUBLIQUE` inchangées.
- Sans la 0069 : pas de nombre d'apprenants ; tout le reste s'affiche.

## 5. La fiche d'une formation

- **En haut** : le fil (« Formations / Titre ») et, à droite, l'action : « S'inscrire à ce cours » (non inscrit, formation ouverte) ; « Commencer le cours » ou « Poursuivre le cours » (inscrit) ; « Voir les abonnements » (formation payante sans abonnement) ; visiteur : « S'inscrire à ce cours » mène à la création de compte puis revient à la fiche.
- **Colonne principale** : titre, « N modules • N leçons », puis **« Contenus du cours »** : un accordéon par module, « Module N - Titre » et « N leçons • durée » ; chaque leçon : rond vide (non vue), coche (terminée) ou cadenas (fermée), titre, et la durée avec une icône lecture. Une leçon fermée n'est pas un lien. Puis, comme aujourd'hui : ce que vous allez apprendre, compétences, monétisation, avis.
- **Colonne de droite** : « Formateur du cours » (avatar ou photo, nom, étiquette « Formateur », « N formations », présentation, icônes des réseaux renseignés), puis la carte d'accès (progression, prochaine leçon, favori, certificat), puis « Inclus dans la formation ». La couverture n'est plus répétée sur la fiche.
- **Au survol du nom** (ordinateur) : une carte avec la photo, le nom, l'étiquette, la présentation, « A rejoint : il y a … », « Voir le profil », « Message » (seulement si `peut_ecrire`), les réseaux. Au toucher, le nom mène au profil.
- **« Message »** ouvre (ou crée) la conversation avec le formateur et mène à `/messages?c=…`.
- **Leçon fermée faute d'inscription** : la page de la leçon montre « Inscrivez-vous à cette formation pour suivre cette leçon » et le bouton « S'inscrire à ce cours ».
- La page d'une leçon ouverte ne change pas (pas de bloc formateur).

## 6. Le profil d'un formateur (`/formateurs/[id]`)

- Page publique, dans le cadre du catalogue. En-tête : photo ou initiales, nom, étiquette « Formateur », titre, « A rejoint : il y a … », présentation, réseaux, bouton « Message » (si `peut_ecrire`). Puis « Ses formations » : les cartes du catalogue.
- Formateur introuvable : 404.

## 7. La messagerie

- « Nouveau message » côté étudiant : la recherche par nom est affichée (elle existe en SQL) ; la liste ne contient que les formateurs des formations où il est inscrit, plus l'Équipe Étudium.

## 8. Les formations d'exemple

- Script `supabase/exemples/retirer-lot-1.sql`, à lancer une fois dans l'éditeur SQL : supprime les 10 formations d'exemple (par leur adresse) et tout ce qui en dépend, puis la fiche « Dr Mireille Adjovi » si elle n'a plus de formation et pas de compte. Les trois parcours restent. Rejouable.
- `lot-1.sql` reçoit un en-tête « Ne plus appliquer ».
- Le bilan explique pourquoi les modifications semblaient ne pas passer : sur une formation publiée, elles vont dans un brouillon jusqu'à « Publier les modifications ».

## 9. Décisions prises pour l'utilisateur (absent)

1. « Le nombre qu'on avait défini » = le nombre de colonnes du catalogue : gardé tel quel.
2. La note, la durée et le niveau restent sur la carte, sous le résumé.
3. « Voir le cours » / « N % terminé » : un inscrit voit son pourcentage, même 0 %.
4. Les leçons d'aperçu restent ouvertes sans inscription.
5. On ne peut s'inscrire qu'à une formation ouverte (gratuite, ou avec un abonnement) ; sinon le bouton est « Voir les abonnements ».
6. Les apprenants comptés = les inscrits.
7. Six réseaux (Instagram, YouTube, LinkedIn, Facebook, Telegram, TikTok) ; la photo du formateur est celle de son compte.
8. « Message » n'apparaît que si l'étudiant peut écrire (inscrit à une de ses formations, fiche reliée à un compte).
9. La couverture n'est plus répétée sur la fiche (elle reste sur la carte du catalogue).
10. L'« harmonisation » (§1.8) : interprétée comme « même structure simple que le bloc Prochaine session » pour les blocs montrés, et un seul format de module partout.
11. Les parcours d'exemple ne sont pas supprimés : ce sont les trois vrais parcours.
