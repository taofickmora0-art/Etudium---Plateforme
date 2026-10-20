# Étudium — Restructuration du projet (rôles, abonnements, parcours, replays)

- **Date :** 20 octobre 2026
- **Statut :** choix validés le 20 octobre 2026 (« C'est bon mon gars », sur les 10 choix ci-dessous)
- **Origine :** décisions prises par l'utilisateur et ses associés, expliquées le 19 octobre 2026
- **Remplace :** dans la feuille de route (`2026-10-09-feuille-de-route-design.md`), le modèle d'abonnement du lot 2 et la place du formateur

## 1. Ce qui change, en bref

1. **Un formateur n'est plus étudiant.** Il crée ses formations et suit ses étudiants. Il ne voit plus les formations des autres.
2. **Trois abonnements qui ne diffèrent que par leur durée :**
   - Basique : 3 mois ;
   - Standard : 6 mois ;
   - Premium : 1 an.
   Chacun ouvre **tous les parcours et toutes les formations**.
3. **Les lives ont des replays.** Un onglet Replays, un bouton « Voir le replay » sur un live passé. Avant l'heure, « Rejoindre » dit dans combien de temps le live commence.
4. **Les parcours restent trois, mais Business devient la suite de Digital.**
   - Compétences digitales apprend une compétence : Canva, montage vidéo…
   - Business & revenus en ligne apprend à la vendre : trouver des clients, prospecter…
   - Comme l'abonnement ouvre tout, **le parcours n'ouvre plus l'accès : il guide.**

## 2. Les choix validés

| # | Question | Décision |
|---|---|---|
| 1 | Le formateur et la communauté | Il la garde, par une entrée « Communauté » dans son menu : il publie, commente, réagit et annonce ses lives. Les nouvelles formations du fil et « Formations disponibles » lui sont masquées. |
| 2 | Un formateur qui veut apprendre | Il crée un compte étudiant séparé, avec un autre e-mail. Ses anciennes données d'étudiant restent en base, invisibles. |
| 3 | L'équipe (admins) | Elle garde la vue étudiant, pour vérifier ce que voient les étudiants. |
| 4 | Acheter une formation seule (« formation complémentaire ») | Supprimé : l'abonnement inclut tout. |
| 5 | Prendre un abonnement pendant qu'un autre court | Pas de prorata : la nouvelle durée s'ajoute à la date de fin. |
| 6 | Le compte gratuit | Inchangé : les formations gratuites, la communauté en lecture. |
| 7 | Relier Digital et Business | Un lien « compétence → monétisation » entre formations (§5.3). |
| 8 | Les replays | L'onglet « Replays » remplace « Passées » sur la page Événements. L'animateur ou l'équipe colle le lien de la vidéo après le live. Les inscrits reçoivent la notification « Le replay est disponible ». |
| 9 | Qui voit les replays | Tous les comptes jusqu'au lot 2. Ensuite, les abonnés ; les comptes gratuits voient la liste avec un cadenas. |
| 10 | « Rejoindre » avant l'heure | Le bouton est visible sur tout live à venir. Avant l'heure, il affiche : « Il n'est pas encore l'heure : le live commence dans 3 h 20. Le lien s'ouvrira 10 minutes avant. » |

## 3. Le découpage

La restructuration passe **avant** la suite de la feuille de route, en trois étapes livrées l'une après l'autre. Chacune a son plan et sa migration.

| Étape | Contenu | Migration |
|---|---|---|
| R1 | Le formateur sort de l'espace étudiant (§4) | 0036 |
| R2 | Le nouveau modèle dans les écrans, et le lien compétence → monétisation (§5) | 0037 |
| R3 | Les replays et « pas encore l'heure » (§6) | 0038 |

Les étapes B et C du lot 5 (push et e-mails, désactivation d'une formation) prennent donc les migrations 0039 et 0040, au lieu de 0036 et 0037.

## 4. R1 — Le formateur n'est plus étudiant

**Qui est concerné.** Un compte qui a le rôle formateur. Depuis la 0017, un membre de l'équipe n'est jamais formateur, et l'équipe garde la vue étudiant (choix 3). Pour l'étudiant, rien ne change.

### 4.1 Son espace

- **Après la connexion**, avec l'e-mail ou Google, il arrive sur `/formateur`. Le logo de l'en-tête y mène aussi.
- **Il garde ce qu'il a déjà :** Tableau de bord, Mes formations, Corrections, Sessions live, Étudiants, Messages.
- **Il gagne, dans son espace et avec son menu :**
  - **« Communauté »** (`/formateur/communaute`) : le fil de la communauté et ses espaces (choix 1), sans les nouvelles formations ni « Formations disponibles ». La page d'une publication devient `/formateur/communaute/publications/<id>`.
  - **« Mon profil »** (`/formateur/profil`) et **« Notifications »** (`/formateur/notifications`) : les mêmes écrans que pour l'étudiant.
  - **La page « Profil » du téléphone** (`/formateur/menu`) : celle de la barre du bas de son espace.
- **L'aperçu de ses propres leçons reste ouvert**, depuis « Voir comme un étudiant » et la page leçon de ses formations. Il n'enregistre aucune progression.
- **L'en-tête est allégé :**
  - pas de série ni de points ;
  - pas de loupe (elle cherche des formations) ;
  - dans le menu du profil, ni « Espace étudiant » ni « Mon abonnement ».

### 4.2 Ce qu'il ne voit plus

- **Les pages qu'il perd :**
  - l'Accueil étudiant et le catalogue connecté ;
  - les fiches et les leçons des formations des autres ;
  - Mes formations, Mes parcours, Exercices, Certificats, Favoris, Formations gratuites ;
  - Événements, les Messages côté étudiant, la Recherche, Mon abonnement et l'Aide. Les questions de l'Aide et l'assistance concernent les étudiants.
- **Une adresse étudiante ouverte par un formateur le renvoie ailleurs :**
  - vers son équivalent dans son espace (profil, notifications, menu, communauté, publication) ;
  - sinon, vers son tableau de bord.
  Les liens des notifications passent par ce même renvoi.
- **Les pages publiques restent publiques :** vérification d'un certificat (`/verifier`, `/c/<id>`) et pages légales. Connecté, la landing et le catalogue public le renvoient vers `/formateur`.

### 4.3 En base (0036)

- **Contenu :** un formateur n'accède qu'au contenu de ses formations (`acces_lecon`), ni aux leçons gratuites ni aux aperçus des autres.
- **Aucune action d'étudiant :**
  - pas de progression, ni sur ses propres leçons ;
  - pas de quiz passé, de travail rendu, d'avis ou de favori ;
  - pas d'inscription à une session ;
  - pas de conversation côté étudiant.
  Un appel direct est refusé.
- **Les notifications envoyées à tous les comptes ne le visent plus**, quand elles concernent l'apprentissage : nouvelle session, « C'est l'heure du live ». Celles de ses propres sessions, de ses formations, de ses messages et de la communauté restent.
- **Repasser étudiant** (`changer_role`) lui rend l'espace étudiant et ses anciennes données.

### 4.4 Tu valides quand…

- Ton compte formateur de test arrive sur son tableau de bord.
- Il ne trouve plus aucune formation d'un autre, ni par le menu ni par une adresse tapée à la main.
- Il publie dans la communauté depuis son espace, et ouvre « Voir comme un étudiant » sur l'une de ses leçons.

## 5. R2 — Le nouveau modèle

### 5.1 Le modèle d'abonnement (construit au lot 2, annoncé dès R2)

- **Trois abonnements :**
  - Basique : 3 mois ;
  - Standard : 6 mois ;
  - Premium : 12 mois.
  Les prix sont réglables au back-office (lot 2). Tant qu'ils ne sont pas fixés, la landing garde « Prix bientôt disponibles ».
- **Chacun ouvre tout :** toutes les formations, tous les parcours, toute la communauté, les lives et leurs replays, les certificats.
- **Le compte gratuit ne change pas** (choix 6) : les formations gratuites et la communauté en lecture.
- **Un abonnement pris pendant qu'un autre court** ajoute sa durée à la date de fin (choix 5). Pas de prélèvement automatique : on renouvelle quand on le décide.
- **À la fin de l'abonnement**, les formations payantes se verrouillent. Rien n'est supprimé : progression, certificats.
- **Plus de formation achetée seule** (choix 4).

### 5.2 Les écrans et les textes

**Landing :**
- Les étapes deviennent : « Basique, Standard ou Premium : 3 mois, 6 mois ou 1 an, avec accès à toutes les formations ».
- Les trois cartes de formules :
  - Basique : « 3 mois » ;
  - Standard : « 6 mois », recommandée ;
  - Premium : « 1 an ».
  Mêmes avantages pour toutes : « Toutes les formations et tous les parcours », « La communauté complète », « Les lives et leurs replays », « Les certificats vérifiables ».
- Le titre de la section : « Un abonnement de 3 mois à 1 an, sans prélèvement automatique ».

**Questions fréquentes** (landing et page Aide) :
- « Puis-je changer de parcours ? » devient « Ai-je accès à tous les parcours ? ». Réponse : « Oui. Tous les abonnements donnent accès à tous les parcours et à toutes les formations. »
- La réponse sur l'expiration ne cite plus les formations complémentaires.

**Questions sur les formules** (page Aide), à la place des quatre actuelles :
- « Quelle différence entre Basique, Standard et Premium ? » : « Seulement la durée : 3 mois, 6 mois ou 1 an. Toutes donnent accès à toutes les formations. »
- « Puis-je prolonger mon abonnement ? » : « Oui. Un nouvel abonnement pris avant la fin s'ajoute à la date de fin de l'actuel. »
- « Que se passe-t-il à la fin de mon abonnement ? » : « Les formations payantes se verrouillent, mais votre progression et vos certificats restent. Tout se rouvre dès que vous renouvelez. »
- « Quels moyens de paiement ? » : inchangée.

**Fiche d'une formation :**
- « Incluse dans les formules Basique, Standard et Premium » et « Incluse dans le parcours … » deviennent « Incluse dans tous les abonnements ».
- « Disponible aussi seule, en formation complémentaire » et le badge « Complémentaire » disparaissent.

**Mes parcours devient « Parcours »** (menu et page) :
- les trois parcours, sans étiquette « Non inclus » ni cadenas sur les onglets ;
- chaque formation avec sa progression ;
- une formation payante reste verrouillée pour un compte gratuit, avec la phrase « Un abonnement ouvre toutes les formations. ».

**Leçon verrouillée :** « Voir les formules » devient « Voir les abonnements ».

**Back-office :**
- les champs « Disponible seule » et « Prix » d'une formation disparaissent ;
- leurs colonnes (`achat_separe`, `prix_fcfa`) sont supprimées en base.

### 5.3 Le lien compétence → monétisation (choix 7)

- **Le lien :** une formation du parcours Business indique la ou les formations de Compétences digitales qu'elle apprend à monétiser. Exemple : « Trouver des clients en design graphique » est liée à « Maîtriser Canva ».
  - Une compétence peut avoir plusieurs formations Business, et une formation Business plusieurs compétences.
  - Une formation Business sans lien est « Pour toutes les compétences » : prospection, fixer ses prix, plateformes freelance…
- **Qui le règle :** celui qui range la formation dans ses parcours, c'est-à-dire le formateur de la formation ou l'équipe, au même endroit. Le choix porte sur les formations publiées de Compétences digitales.
- **Où il s'affiche :**
  - **sur la fiche d'une compétence**, un bloc « Et ensuite ? Vendre cette compétence », avec les formations Business liées ;
  - **sur la fiche d'une formation Business**, un bloc « À suivre d'abord », avec les compétences liées ;
  - **une fois la compétence terminée** (page « Validation et certificat »), une carte « Étape suivante » vers la première formation Business liée ;
  - **dans l'onglet Business de la page Parcours**, les formations rangées par compétence, puis « Pour toutes les compétences ».

### 5.4 Ce qui ne change pas encore

- **Les espaces de communauté par parcours** gardent leur règle provisoire : on y entre en commençant une formation du parcours. Au lot 2, un abonné entrera dans tous les espaces.
- **La messagerie** reste telle quelle : un étudiant écrit au formateur d'une formation qu'il suit.

### 5.5 Tu valides quand…

- La landing, la FAQ et la page Aide parlent de 3 mois, 6 mois et 1 an, et plus de parcours au choix.
- La fiche de « Maîtriser Canva » propose sa formation Business liée, et l'inverse.
- La page Parcours n'a plus de cadenas sur les onglets.

## 6. R3 — Les replays et « pas encore l'heure »

### 6.1 « Rejoindre » avant l'heure (choix 10)

- **Le bouton « Rejoindre »** est visible sur tout live à venir et non annulé, inscrit ou non : sur la page Événements, dans le bloc de la session dans la communauté, et sur « Prochaine session ».
- **Avant l'ouverture du lien** (10 minutes avant le début), le clic affiche : « Il n'est pas encore l'heure : le live commence dans 3 h 20. Le lien s'ouvrira 10 minutes avant. »
  - Le délai est calculé à l'heure du clic : « dans 2 j 5 h », « dans 3 h 20 », « dans 12 min ».
- **Pendant la fenêtre**, le bouton ouvre le lien du live, comme aujourd'hui.

### 6.2 Les replays (choix 8 et 9)

- **Ajouter un replay :** après la fin d'un live non annulé, l'animateur ou l'équipe colle le lien de la vidéo dans la fiche de la session. Les plateformes acceptées sont celles des vidéos de la communauté : YouTube, Vimeo, Google Drive…
  - On peut le changer ou le retirer.
  - Les inscrits reçoivent « Le replay de « … » est disponible », dans la catégorie Sessions live.
- **L'onglet « Replays »** de la page Événements remplace « Passées ». Il liste les lives passés qui ont un replay, du plus récent au plus ancien : le titre, l'animateur, la date et la vidéo intégrée.
  - L'onglet choisi est dans l'adresse (`/evenements?onglet=replays`).
  - Jusqu'au lot 2, tous les comptes le voient. Ensuite, seulement les abonnés : les comptes gratuits voient la liste avec un cadenas.
- **Sur un live passé** (page Événements, bloc dans la communauté) :
  - s'il a un replay, « Voir le replay » mène à l'onglet Replays, sur ce replay ;
  - sinon, l'étiquette « Terminée » et la mention « Replay bientôt disponible ».

### 6.3 Tu valides quand…

- Un clic sur « Rejoindre » trois heures avant un live dit « le live commence dans 3 h ».
- Tu ajoutes le lien YouTube d'un replay à un live passé : il apparaît dans l'onglet Replays.
- Un inscrit reçoit la notification du replay, et « Voir le replay » l'y mène.

## 7. Effets sur la feuille de route

- **Lot 2, simplifié :**
  - 2.1 : trois abonnements, réglables en prix et en durée ;
  - 2.2 : souscription sans choix de parcours ;
  - 2.3 et 2.4 : le paiement, inchangé ;
  - 2.5 : un abonnement actif ouvre tout ;
  - 2.6 : renouvellement par prolongation ;
  - 2.9 : codes promo, inchangés ;
  - 2.10 : facturation, inchangée.
  Les tâches 2.7 (formations complémentaires) et 2.8 (changement de formule au prorata) disparaissent.
- **Le nouvel ordre :**
  1. R1, R2, R3 ;
  2. les corrections que l'utilisateur listera sur l'existant ;
  3. la fin du lot 5 (push et e-mails, puis désactivation d'une formation) : les e-mails serviront aux rappels d'abonnement ;
  4. le lot 2 ;
  5. le reste du lot 4 (éditeur riche, versions d'une formation) ;
  6. le lot 6.
- **Le design de référence** ne montre ni les replays, ni l'espace communauté du formateur, ni les abonnements par durée. Ces écrans reprennent ses composants existants : cartes de session, fil de la communauté, cartes de formules.
