# Ce qui te revient (lots 0 et 1)

Les manipulations que je ne peux pas faire à ta place, parce qu’elles touchent à tes comptes ou à ton ordinateur, puis la validation des tâches. Rien ne presse dans l’ordre, sauf Windows (voir plus bas).

---

## 1. Créer la base de test Supabase (`etudium-dev`), 10 minutes

1. Va sur https://supabase.com et connecte-toi.
2. **New project** :
   - Name : `etudium-dev`
   - Database password : clique sur **Generate a password** et garde-le dans ton gestionnaire de mots de passe. Ne me l’envoie pas, l’application n’en a pas besoin.
   - Region : **West EU (Paris)**
   - Plan : **Free**
3. Attends que le projet soit prêt (1 à 2 minutes).
4. Va dans **Project Settings → Data API** et copie la **Project URL** (`https://xxxx.supabase.co`).
5. Va dans **Project Settings → API Keys** et copie la **Publishable key** (elle commence par `sb_publishable_`).
   - **Ne copie jamais la Secret key** (`sb_secret_…`). L’application refuse de démarrer si elle en trouve une.
6. Dans le dossier `web`, copie le fichier `.env.example` sous le nom `.env.local`, ouvre-le avec le Bloc-notes et remplis :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
7. Lance l’application (voir le point 4 plus bas) et ouvre http://localhost:3000/etat. Tu dois lire **« Base connectée »**.
8. Continue avec le guide **[Brancher la connexion](brancher-la-connexion.md)** : il règle l’inscription, les e-mails et Google sur ce projet.

Tu peux m’envoyer l’URL et la clé **publique** si tu veux que je vérifie : elles ne donnent accès à rien de sensible. Rien d’autre.

> Un projet gratuit se met en pause après une semaine sans activité. La page `/etat` affiche alors « Le projet Supabase est en pause » : il suffit de cliquer **Restore project** dans le tableau de bord.

---

## 2. Créer le dépôt GitHub privé, 3 minutes

Il sert de sauvegarde : si l’ordinateur tombe en panne, tout le code est sur GitHub.

1. Va sur https://github.com et connecte-toi (compte `taofickmora0-art`, celui qui signe déjà les commits).
2. En haut à droite : **+ → New repository**.
   - Repository name : `etudium-plateforme`
   - **Private**
   - Ne coche rien d’autre (pas de README, pas de .gitignore, pas de licence) : le projet en a déjà.
3. **Create repository**.
4. Dis-moi « dépôt créé ». J’ajoute l’adresse au projet et j’envoie les deux branches (`main` et `lot-0-fondations`). Au premier envoi, une fenêtre GitHub s’ouvrira sur ton ordinateur pour te demander de te connecter : c’est normal, c’est toi qui valides.

Active aussi la **double authentification** sur GitHub (Settings → Password and authentication), si ce n’est pas déjà fait.

---

## 3. Windows : passer à Windows 11 (gratuit)

### Pourquoi c’est urgent

Ta version de Windows 10 (1903) ne reçoit plus de correctifs de sécurité depuis 2020. Windows 10 en général n’en reçoit plus depuis octobre 2025, sauf pour les ordinateurs inscrits au programme de mises à jour étendues, **qui s’arrête lui aussi le 13 octobre 2026**. Tes comptes (GitHub, Supabase, Google, paiements) passent par cet ordinateur : un système sans correctifs est la porte d’entrée la plus simple pour un vol de mots de passe. Le projet continue de tourner en attendant, mais ne laisse pas traîner.

Ton processeur (AMD Ryzen 7 3750H) fait partie de ceux que Microsoft accepte pour Windows 11, et ton disque est déjà au bon format (UEFI/GPT). Il manque très probablement deux réglages dans le BIOS.

### Étapes

1. **Sauvegarde d’abord.** Copie tes documents sur un disque externe ou une clé USB (ou OneDrive). Le code du projet sera sur GitHub après le point 2. La mise à jour garde normalement tous tes fichiers et logiciels, mais on ne prend pas de risque.
2. **Vérifie la compatibilité.** Télécharge « Contrôle d’intégrité du PC » (PC Health Check) sur le site de Microsoft, puis clique **Vérifier maintenant**.
   - Si tout est vert : passe à l’étape 4.
   - S’il parle de **TPM 2.0** ou de **démarrage sécurisé** : étape 3.
3. **Active le TPM et le démarrage sécurisé dans le BIOS** (ordinateur ASUS) :
   - Redémarre et appuie plusieurs fois sur **F2** dès le logo ASUS.
   - Passe en mode avancé (**F7**) si besoin.
   - Cherche **AMD fTPM** (parfois « TPM », « Security Device Support », dans *Advanced* ou *Security*) et mets-le sur **Enabled**.
   - Cherche **Secure Boot** (dans *Boot* ou *Security*) et mets-le sur **Enabled**.
   - Au passage, mets **SVM Mode** (virtualisation, dans *Advanced → CPU Configuration*) sur **Enabled** : cela permettra plus tard de faire tourner une base de données directement sur ton ordinateur.
   - **F10** pour enregistrer et redémarrer. Relance « Contrôle d’intégrité du PC » : tout doit être vert.
   - Les noms exacts varient selon le modèle. Si tu ne trouves pas, envoie-moi une photo de l’écran du BIOS.
4. **Mets d’abord Windows 10 à jour** : Paramètres → Mise à jour et sécurité → Windows Update → **Rechercher des mises à jour**, jusqu’à arriver à la version **22H2**. Depuis la 1903, l’outil de Windows 11 ne s’installe pas directement : c’est une étape obligatoire. Si Windows Update ne la propose pas, utilise l’**Assistant Mise à jour Windows 10** sur la page de téléchargement de Windows 10 de Microsoft.
5. **Installe Windows 11** avec l’**Assistant d’installation de Windows 11**, sur la page de téléchargement de Windows 11 de Microsoft. Choisis de **conserver les fichiers et les applications**. Compte une à deux heures, ordinateur branché sur le secteur.

### En attendant

- Double authentification sur GitHub, Google et Supabase.
- Un gestionnaire de mots de passe (Bitwarden est gratuit) au lieu de mots de passe notés ou réutilisés.

---

## 4. Valider les tâches 0.2, 0.3 et 0.4

1. Dans un terminal ouvert sur le dossier du projet :
   ```
   npm --prefix web run dev
   ```
2. **Composants (0.2)** : ouvre http://localhost:3000/vitrine. Pour chaque section (Fondations, Boutons, Formulaires, Cartes, Navigation, Messages, Menus, Modales), compare avec la planche correspondante de l’artefact design.
3. **Coque de l’application (0.3)** : ouvre http://localhost:3000/accueil.
   - Tant que la base n’est pas branchée, l’application tourne en **mode démonstration** : l’espace connecté s’ouvre sans compte, avec Aïcha Kpadé, l’utilisatrice des écrans du design. Une fois la base branchée, il faut un compte (point 5).
   - Passe par toutes les entrées de la barre latérale : chacune ouvre sa page, ou une page « Bientôt disponible » qui dit à quel lot elle arrive.
   - Ouvre la cloche, puis le rond de profil, puis « Se déconnecter » : cela mène à la page de connexion.
   - Tape une adresse inventée (par exemple http://localhost:3000/nimporte-quoi) : la page « Page introuvable » s’affiche.
   - Refais le tour en réduisant la fenêtre, ou sur ton téléphone : la barre du bas remplace la barre latérale, et l’onglet « Profil » ouvre le menu du téléphone.
4. **Écrans de compte (0.4)**, même sans base : http://localhost:3000/connexion, `/inscription`, `/mot-de-passe-oublie`, `/nouveau-mot-de-passe`. Compare-les avec les écrans du design (connexion, inscription, code, mot de passe). Les pages `/conditions` et `/confidentialite` ont un texte provisoire : dis-moi s’il te convient en attendant le texte définitif.
5. **Connexion pour de vrai (0.4)** : suis le guide [Brancher la connexion](brancher-la-connexion.md) jusqu’à sa vérification finale.
   - **Rôles (0.6)** : à la fin de ce guide, la section « Devenir super-administrateur » donne ton rôle et explique comment vérifier qu’un compte étudiant ne peut pas ouvrir `/admin`. Sans base, en mode démonstration, `/admin` et `/formateur` s’ouvrent déjà : l’utilisatrice de démonstration a ces rôles.
   - **Mon profil (0.5)** : sans base, http://localhost:3000/profil montre déjà les trois onglets avec les données d’Aïcha (les enregistrements répondent « Une erreur est survenue… »). Une fois la base branchée, avec les trois fichiers SQL appliqués (étape 1 du guide : 0001, 0002 et 0003) :
     1. Modifie tes informations, recharge la page : elles restent.
     2. Change ta photo : elle apparaît dans l’en-tête et dans le menu du profil.
     3. Change deux interrupteurs de l’onglet Notifications, recharge : ils restent.
     4. Connecte-toi dans deux navigateurs (Chrome et Edge). Change ton mot de passe dans le premier (onglet Sécurité). Dans le second, clique sur n’importe quelle page : la connexion s’ouvre avec « Votre session a expiré ».
     5. Avec un compte de test (créé avec une autre adresse), onglet Sécurité → « Supprimer mon compte », saisis SUPPRIMER : la connexion s’ouvre avec « Votre compte a été supprimé », et le compte a disparu de **Table Editor → profils**.
   - **Appli installable (0.7)** :
     1. Ouvre http://localhost:3000 dans **Chrome**, sur l’ordinateur. À droite de la barre d’adresse apparaît l’icône **« Installer Étudium »** (un petit écran avec une flèche).
     2. Clique dessus, puis sur **Installer** : Étudium s’ouvre dans sa propre fenêtre, avec son logo dans la barre des tâches. L’onglet du navigateur montre aussi le logo Étudium.
        - Si l’icône n’apparaît pas : menu **⋮** de Chrome (en haut à droite) → **« Caster, enregistrer et partager »** → **« Installer la page en tant qu’appli… »** (ou **« Installer Étudium… »**).
     3. Sur téléphone, l’installation demande une adresse en `https` : on la vérifiera à la mise en ligne.
6. Dis-moi ce qui ne te va pas : une couleur, un texte, un espacement, un comportement. Je corrige avant d’attaquer la suite.

> Pour tester sur ton téléphone pendant que l’application tourne sur l’ordinateur, les deux doivent être sur le même Wi-Fi ; dis-le-moi et je te donne la marche à suivre.

---

## 5. Lot 1 : la base des contenus (tâches 1.1 et 1.2), 5 minutes

Les formations, leur programme et la règle « qui voit quoi » vivent dans la base. Dans Supabase, **SQL Editor → New query**, comme pour les fichiers précédents, et dans cet ordre :

1. Colle `web/supabase/migrations/0004_contenus.sql`, puis **Run**. Résultat attendu : **« Success. No rows returned »**.
2. Colle `web/supabase/migrations/0005_back_office.sql`, puis **Run**. Même résultat attendu. Il sert au back-office : ranger les éléments (monter, descendre) et n’accepter que les fichiers prévus.
3. Colle `web/supabase/exemples/lot-1.sql`, puis **Run**. Ce fichier ajoute les 3 parcours et les 10 formations du design, avec le programme d’Excel. **Seulement sur la base de test** `etudium-dev`, jamais sur celle du site en ligne.
4. Vérifie dans **Table Editor** :
   - `parcours` : 3 lignes ;
   - `formations` : 10 lignes ;
   - `modules` : 4 lignes ;
   - `lecons` : 12 lignes.
5. Dans **Storage**, un espace **ressources** est apparu. Il est privé : il recevra les fichiers des leçons.

> Applique toujours les fichiers SQL dans l’ordre de leur numéro, et ne recolle jamais un ancien fichier après un plus récent : il pourrait défaire ce que le plus récent a changé.

---

## 6. Valider le back-office (tâche 1.2), 20 minutes

Il faut ton compte **super-administrateur** (section « Devenir super-administrateur » du guide [Brancher la connexion](brancher-la-connexion.md)) et la section 5 ci-dessus.

1. Connecte-toi, puis ouvre http://localhost:3000/admin (ou rond de profil → **Back-office**). Tu vois trois rubriques : Parcours (3), Formateurs (1), Formations (10 publiées).
2. **Formations → Nouvelle formation** : donne un titre, puis **Créer le brouillon**. La fiche de la formation s’ouvre.
3. Onglet **Informations** : coche un parcours, active **Formation gratuite**, remplis le résumé et quelques objectifs (un par ligne), puis **Enregistrer**.
4. Onglet **Programme** : ajoute **2 modules**, puis **2 leçons** dans chacun (« Ajouter la leçon » ouvre la page de la leçon).
5. Sur chaque page de leçon :
   - colle le lien d’une vidéo YouTube (le champ affiche « Reconnu : YouTube · … ») ;
   - saisis sa durée (par exemple 12:40) ;
   - sur la première leçon, active **Leçon d’aperçu** ;
   - **Enregistrer**, puis **Retour au programme**.
6. Sur une leçon, dépose un **PDF** dans « Ressources », puis active **Consultation seule**. Essaie aussi un fichier qui n’est pas accepté (un .exe, par exemple) : il est refusé avec un message.
7. Dans le programme, range une leçon avec la flèche **Monter**.
8. Onglet **Publication** → **Publier**. La formation passe en « Publiée » ; son adresse ne peut plus changer.
9. Vérifie dans **Table Editor → formations** que ta formation a le statut `publiee`, et dans **Storage → ressources** que ton PDF est rangé dans le dossier de la formation.

Dis-moi ce qui coince ou ce qui manque : c’est le moment, avant d’afficher le catalogue (tâche 1.3).

---

## 7. Valider le catalogue et la fiche formation (tâche 1.3), 10 minutes

Il faut la section 5 (tables et exemples du lot 1). Sans elles, le catalogue affiche l’avertissement « Les tables du lot 1 ne sont pas encore dans la base ».

1. Ouvre une **fenêtre de navigation privée** (sans compte), puis http://localhost:3000/formations :
   - le bandeau bleu « Toutes les formations », la recherche, le niveau et les puces de filtre ;
   - 10 formations, chacune avec la puce de son parcours ;
   - filtre **Business** puis **Gratuites** : « Aucune formation ne correspond » ; **Effacer les filtres** les ramène ;
   - tape « zotéro » dans la recherche : Zotero apparaît ;
   - recharge la page : les filtres sont gardés.
2. Ouvre **Maîtriser Microsoft Excel** :
   - fiche publique, avec la carte d’offre « Incluse dans le parcours » ;
   - dans le programme, les 2 premières leçons portent le lien **Aperçu** ;
   - la page de leçon elle-même arrive avec la tâche 1.5 : pour l’instant, ce lien mène à « Page introuvable ».
3. Connecte-toi (fenêtre normale) :
   - **Toutes les formations** : le même catalogue dans l’appli, avec « Trier : … » ;
   - **Formations gratuites** : Zotero et Canva ;
   - une fiche payante : leçons fermées par un cadenas, sauf l’aperçu ;
   - une fiche gratuite (Zotero, Canva, ou celle que tu as créée en 1.2) : bouton **Commencer**.
4. Ouvre http://localhost:3000/formations/maitriser-microsoft-excel puis, dans un autre onglet, l’adresse de son image de partage : clic droit sur la page → **Afficher le code source**, cherche `og:image`, et ouvre l’adresse indiquée. L’image bleue avec le titre s’affiche.
5. Le vrai test WhatsApp (coller le lien dans une conversation) demande l’adresse en ligne : on le fera à la mise en production.

## 8. Valider Mes parcours (tâche 1.4), 5 minutes

Il faut la section 5 (tables et exemples du lot 1). Connecte-toi, puis ouvre **Mes parcours** dans le menu :

1. Un onglet par parcours (Académique, Digital, Business), chacun avec un petit cadenas : au lot 1, personne n’a encore de formule.
2. Chaque parcours affiche sa couleur, sa description, le badge « Non inclus », puis le bloc « Ce parcours n’est pas inclus dans votre compte gratuit » avec le bouton **Voir les formules** (la page des formules arrive au lot 2).
3. Dessous, les formations du parcours, numérotées 01, 02… dans l’ordre du back-office :
   - Zotero (Académique) et Canva (Digital) portent « Gratuite », les autres « Verrouillée » ;
   - chaque ligne ouvre la fiche de la formation.
4. Au back-office, ajoute une formation publiée à un parcours (onglet Informations de la formation), puis recharge Mes parcours : elle apparaît en dernier dans ce parcours. Pour l’instant, on ne peut pas changer cet ordre au back-office.
5. La progression (« 0 % du parcours », barres vides) se remplira avec la tâche 1.7.

## 9. Valider la page leçon (tâche 1.5), 15 minutes

Il faut la section 5 (tables et exemples du lot 1).

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0006_notes.sql` (notes privées), comme les précédents.
2. Au back-office, ouvre **Maîtriser Microsoft Excel** → onglet Programme → leçon **Découvrir l’interface** (aperçu), colle le lien d’une vidéo YouTube et saisis sa durée exacte (par exemple 6:10) : le temps regardé se mesure par rapport à elle (tâche 1.6).
3. Dans une **fenêtre de navigation privée** (sans compte), ouvre cette leçon depuis la fiche (lien **Aperçu**) :
   - la vidéo se lit ; un bandeau « Vous regardez un aperçu gratuit » propose de créer un compte ;
   - dans le programme à gauche, les leçons non-aperçu ont un cadenas ;
   - **Leçon suivante** jusqu’à « Les formules essentielles » : un verrou remplace la vidéo, avec « Créer un compte gratuit » et « Voir l’aperçu gratuit ».
4. Connecte-toi (fenêtre normale) et ouvre une leçon de la formation que tu as créée en 1.2 (en tant qu’admin, toutes les leçons te sont ouvertes) :
   - le programme, **Leçon précédente / suivante** ;
   - onglet **Ressources** : **Télécharger** ouvre le fichier ; **Consulter** reste grisé jusqu’à la tâche 1.8 ;
   - onglet **Notes** : écris une note, **Enregistrer la note**, recharge la page : elle est toujours là.
5. Sur ton téléphone (ou en rétrécissant la fenêtre) : en haut, la flèche de retour et le titre de la formation ; sous la vidéo, les onglets **Programme**, **Ressources** et **Notes** ; en bas, la barre **Leçon précédente / Leçon suivante**.
6. Ce qui arrive ensuite : le lecteur aux couleurs d’Étudium et le temps réellement regardé (1.6), « Marquer comme terminée » et la progression (1.7), le visualiseur de fichiers (1.8).

## 10. Valider le lecteur vidéo (tâche 1.6), 15 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0007_visionnage.sql` (temps regardé).
2. Connecté, ouvre une leçon qui a une vidéo YouTube (celle de la section 9) :
   - les commandes Étudium : bouton central, barre de lecture, son, vitesse (1× → 1,25× → 1,5× → 2× → 0,75×), plein écran, sous-titres si la vidéo en a ;
   - sous la vidéo : « Temps réellement regardé : 0 % » • « Seuil de validation fixé par la formatrice : 90 % » • « Avancer dans la barre ne compte pas ».
3. **Le test de la tâche** : fais glisser la barre jusqu’à la fin. Le pourcentage ne bouge pas.
4. Regarde la vidéo (la vitesse 2× est permise). Le pourcentage monte toutes les 10 secondes environ. Au seuil, « Leçon validée » s’affiche avec le message « Leçon terminée. ».
5. Recharge la page en cours de route : le pourcentage est gardé.
6. **Vimeo** : colle au back-office le lien d’une vidéo Vimeo publique dans une autre leçon, et refais le point 2. Sans compte Vimeo payant, les commandes de Vimeo peuvent rester visibles sous celles d’Étudium (sans être cliquables) ; ce sera réglé avec le compte Vimeo (lot 2).
7. Sans compte (fenêtre privée), une leçon d’aperçu se lit avec les mêmes commandes, mais rien n’est mesuré.
8. Ce qui arrive ensuite (1.7) : reprendre la vidéo là où on l’a laissée, « Marquer comme terminée » pour les leçons sans vidéo, et la progression dans le programme et dans « Mes parcours ».

## 11. Valider la progression (tâche 1.7), 15 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0008_progression.sql`.
2. Connecté, termine quelques leçons d’une même formation :
   - une leçon **avec vidéo** : regarde-la jusqu’au seuil (le bouton « Marquer comme terminée » reste grisé, avec « Regardez au moins 90 % de la vidéo », puis passe à « Leçon terminée ») ;
   - une leçon **sans vidéo** : clique « Marquer comme terminée ».
3. Vérifie que le même pourcentage s’affiche partout (par exemple 3 leçons sur 12 = 25 %) :
   - dans le programme à gauche de la page leçon (barre, « 25 % terminé », temps restant) ;
   - sur la fiche de la formation : « Votre progression », « Prochaine leçon », bouton **Continuer**, coches vertes et « Vous êtes ici » dans le programme ;
   - dans **Mes parcours**, sur la ligne de la formation.
4. Arrête une vidéo vers 4:00, ouvre une autre page, puis reviens : la vidéo reprend à 4:00.
5. Sur téléphone : une fois la leçon terminée, le bouton du bas devient **Leçon suivante**.

## 12. Valider le visualiseur de documents (tâche 1.8), 10 minutes

1. Au back-office, dans une leçon ouverte (par exemple une leçon d’aperçu d’Excel), ajoute deux ressources **en consultation seule** : un PDF de plusieurs pages, et une image (JPG ou PNG).
2. Sur la page de la leçon, onglet **Ressources**, clique **Consulter** sur le PDF :
   - le document s’ouvre en grand, page par page ;
   - il n’y a ni bouton de téléchargement ni bouton d’impression ;
   - **Agrandir** / **Réduire** change la taille (de 75 % à 200 %) ;
   - « Document en consultation seule. » en bas.
3. Fais de même avec l’image.
4. Avec le document ouvert, appuie sur **Ctrl + P** : l’aperçu d’impression montre la page de la leçon derrière, mais pas le document (à sa place, une phrase).
5. Essaie aussi : un PDF **scanné en noir et blanc** (il doit s’afficher, pas rester blanc), une présentation en **paysage**, un PDF de **plus de 100 pages** sur ton téléphone (le défilement reste fluide), et le défilement au clavier (Tab jusqu’au document, puis les flèches).
6. Sur ton téléphone (Android surtout) : le document s’ouvre en plein écran, sans téléchargement, et défile avec le doigt. **C’est le test le plus important** : sur Android, Chrome ne sait pas afficher un PDF dans une page ; le visualiseur le fait.
7. Rappel honnête : une capture d’écran reste possible. Le visualiseur ne prétend pas l’empêcher.

