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

## 13. Valider Mes formations, Favoris et Recherche (tâche 1.9), 15 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0009_favoris.sql`.
2. **Mes formations** (menu) : les formations dont tu as ouvert au moins une leçon, la plus récente en premier.
   - Filtres **Toutes**, **En cours** (même à 0 %), **Terminées**, **Verrouillées**, **Favoris**.
   - Chaque carte mène à la leçon où reprendre ; s’il ne te reste aucune leçon ouverte (aperçus vus d’une formation payante), à la fiche, avec le badge « Verrouillée ».
   - Au back-office, archive une formation que tu as commencée : elle reste dans Mes formations, avec le badge « Verrouillée », et sa carte n’est plus un lien.
3. **Favoris** :
   - sur la fiche d’une formation, **Ajouter aux favoris** devient « Dans vos favoris » ;
   - la page Favoris la montre (avec sa progression si tu l’as commencée) ;
   - le cœur de la carte → « Retirer des favoris ? » → **Retirer** : elle disparaît ;
   - sans favori : « Aucun favori pour le moment ».
4. **Recherche** (loupe en haut) :
   - « excel » : la formation, le parcours qui la contient, et les leçons du module « Bases d’Excel » ;
   - « zotéro » (avec l’accent) trouve Zotero ; « EXCEL » en majuscules aussi ;
   - un mot inconnu : « Aucun résultat pour … », puis « Recommandé pour vous ».

## 14. Valider le tableau de bord (tâche 1.10), 10 minutes

Pas de migration pour cette tâche : il faut seulement que la 0003 à la 0009 soient appliquées.

1. **Compte neuf** (aucune leçon ouverte) : l’Accueil affiche « Commencez votre première formation ».
   - **Voir les formations gratuites** ouvre le catalogue filtré sur les gratuites ;
   - en dessous, « Formations gratuites » montre jusqu’à trois cartes.
2. Ouvre la première leçon de Zotero, puis reviens à l’Accueil :
   - tuiles « Progression globale » et « Formations en cours » ;
   - « Continuer l’apprentissage » montre Zotero, avec « Module 1 · {titre de la leçon} · {durée} » ;
   - **Reprendre la leçon** ouvre la bonne leçon ; **Voir le parcours** ouvre Mes parcours, sur l’onglet du parcours de la formation.
3. Ouvre une leçon d’une deuxième formation, puis reviens :
   - elle passe dans « Continuer l’apprentissage » ;
   - Zotero passe dans « À faire » (« Leçon suivante ») ;
   - « Recommandé pour vous » propose des formations des mêmes parcours que tu n’as pas commencées.
4. **Le critère de la tâche** : déconnecte-toi, reconnecte-toi. Tu arrives sur l’Accueil et tu reprends ta dernière leçon en un clic.
5. Sur téléphone : ni tuiles ni « Explorer le catalogue » (comme la maquette) ; **Reprendre la leçon** prend toute la largeur.

## 15. Valider les avis (tâche 1.11), 15 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0010_avis.sql` (après la 0009).
2. **Sous 50 %** : sur une fiche où tu as terminé moins de la moitié des leçons, « Avis des étudiants » dit « Vous pourrez laisser un avis à partir de 50 % de progression. », sans bouton.
3. **Atteindre 50 %** : la moitié des leçons d’une formation doivent être terminées (pas d’arrondi : 6 sur 12, 2 sur 4). Deux façons :
   - sur la formation que tu as créée au back-office (tâche 1.2) : une leçon sans vidéo se termine avec « Marquer comme terminée » ;
   - avec ton compte admin, qui ouvre toutes les leçons : 6 leçons d’Excel sur 12.

   Le bouton **Laisser un avis** apparaît alors dans « Avis des étudiants ».
4. **Laisser un avis** : 4 étoiles et un commentaire, puis **Publier mon avis**.
   - « Votre avis est publié. » s’affiche ;
   - la fiche montre la note (« 4,0 », « 1 avis »), les barres et ta carte « Votre avis » ;
   - le bandeau de la fiche montre « 4,0 (1 avis) » ;
   - la carte du catalogue montre « 4,0 (1) » ;
   - le tri **Note des étudiants** la met en tête.
5. **Modifier mon avis** : la fenêtre reprend ta note et ton commentaire. **Supprimer mon avis** demande confirmation, puis l’avis disparaît.
6. **Masquer** : republie un avis, puis va dans Back-office → **Avis** → **Masquer**.
   - En navigation privée (sans compte), la fiche ne le montre plus, et la note disparaît.
   - Avec ton compte, tu le vois encore, marqué « Masqué par l’équipe ».
   - **Réafficher** le remet.

## 16. Le tableau de bord du back-office et les menus par espace, 5 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0011_statistiques.sql` (après la 0010).
2. Rond de profil → **Back-office** :
   - le menu de gauche devient celui du back-office : Tableau de bord ; Contenus (Parcours, Formateurs, Formations, Avis) ; Plateforme (Utilisateurs, Abonnements et paiements, Modération) ;
   - le **Tableau de bord** montre les utilisateurs inscrits (et la croissance du mois), les nouveaux inscrits, les formations les plus suivies et la progression moyenne ;
   - les revenus, les abonnés et le taux de conversion affichent « Disponible au lot 2 », les sessions live « Disponible au lot 5 ».
3. Rond de profil → **Espace formateur** : son propre menu (Tableau de bord, Mes formations, Apprenants, Corrections, Sessions live, Messages), en « Bientôt disponible » pour l’instant. *Depuis la migration 0017 (section 22), un compte de l’équipe n’a plus cet espace : c’est le compte formateur qui le voit.*
4. Rond de profil → **Espace étudiant** : le menu habituel revient.
5. Sur téléphone, la barre du bas suit l’espace où tu te trouves.

## 17. Valider les images de couverture, 10 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0012_couvertures.sql` (après la 0011).
   - Dans **Storage**, un espace **couvertures** apparaît, marqué public.
2. Relance l’application. Toutes les cartes de formation ont maintenant une couverture en haut, aux couleurs de leur parcours (bleu, violet ou orange) tant qu’aucune image n’est envoyée.
3. Back-office → **Formations** → une formation → onglet **Informations** → bloc **Image de couverture** :
   - **Choisir une image** : une photo JPG, PNG ou WebP (idéalement 1280 × 720) ; « Image de couverture enregistrée. » ;
   - essaie aussi un PDF renommé en `.jpg` (« Choisissez une image JPG, PNG ou WebP. ») et une image de plus de 5 Mo (« L’image dépasse 5 Mo. »).
4. Vérifie l’image :
   - sur la carte du catalogue, avec son badge posé dessus ;
   - sur la fiche (visiteur, en navigation privée, et connecté) ;
   - sur la carte « Continuer » de l’Accueil et en haut du programme d’une leçon, si tu l’as commencée.
5. **Remplacer** une image, puis **Retirer** (confirmation) : la couverture par défaut revient. Dans **Storage → couvertures**, l’ancien fichier a disparu.
6. L’image de partage : sur la fiche d’une formation qui a une couverture, clic droit → **Afficher le code source**, cherche `og:image` et ouvre l’adresse indiquée (comme à la section 14).
   - C’est la couverture, cadrée en 1200 × 630 ; une photo prise au téléphone, en hauteur ou en largeur, est bien droite.
   - Le vrai test WhatsApp (coller le lien dans une conversation) se fera à la mise en ligne.

## 18. Valider la page Utilisateurs, 15 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0013_utilisateurs.sql` (après la 0012).
2. Il te faut un compte de test : dans une fenêtre de navigation privée, inscris-toi sur http://localhost:3000/inscription avec une autre adresse e-mail. Garde cette fenêtre ouverte.
3. Avec ton compte, Back-office → **Utilisateurs** : un tableau comme dans le design (Utilisateur, E-mail, Rôle, Formule, Statut, Inscrit le) :
   - ta ligne affiche le rôle **Super admin** ;
   - cherche-toi par ton prénom tapé sans accent, puis par le début de ton adresse e-mail. L’adresse de la page ne change pas ;
   - essaie les filtres **Étudiants** et **Formateurs** ;
   - sur ton téléphone, le tableau défile de côté dans son cadre ; le menu **⋮** d’une ligne propose « Voir le profil ».
4. Ouvre le compte de test :
   - **Identité** et **Activité** s’affichent (« Aucune formation commencée. » s’il n’a rien suivi) ;
   - **Rôle** : **Changer le rôle** → **Formateur** → **Changer le rôle**, puis « Rôle changé ». Sa fiche formateur est créée à son nom (depuis la migration 0017 ; avant, il fallait choisir une fiche) ;
   - la fiche formateur apparaît avec son lien ; Back-office → **Formateurs** : elle y est ;
   - dans la fenêtre privée, rond de profil : **Espace formateur** apparaît ;
   - **Changer le rôle** → **Étudiant** : la fiche reste dans Formateurs, sans compte relié ; redonne-lui ensuite **Formateur**, il la retrouve.
5. Sur ta propre fiche : pas de bouton **Suspendre**. **Changer le rôle** → **Admin** : la base refuse avec « Vous ne pouvez pas vous retirer le rôle super admin. ».
6. Sur le compte de test, **Suspendre le compte** (depuis sa fiche, ou le menu **⋮** de sa ligne), avec le motif « Test » :
   - la fenêtre dit « Suspendre ce compte ? » ; le message « Compte suspendu » s’affiche, et sa ligne passe à **Suspendu** ;
   - la fiche affiche « Suspendu depuis le … , par » ton nom, et le motif ;
   - dans la fenêtre privée, clique sur n’importe quelle page : le compte est déconnecté avec « Ce compte est suspendu. Pour en savoir plus, contactez l’équipe Étudium. » ;
   - reconnecte-toi avec ce compte : même message, la connexion est refusée.
7. **Réactiver le compte** : dans la fenêtre privée, la connexion remarche.

## 19. Valider l’espace formateur, « Mes formations », 20 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0014_espace_formateur.sql` (après la 0013).
   - Si un jour tu rejoues une migration plus ancienne, rejoue ensuite toutes les suivantes, dans l’ordre, jusqu’à la 0014.
2. Back-office → **Utilisateurs** → le compte de test (section 18) : donne-lui le rôle **Formateur** (menu ⋮ → **Changer le rôle**).
3. Dans la fenêtre privée du compte de test, rond de profil → **Espace formateur** → **Mes formations** :
   - « Vous n’avez pas encore de formation… » ;
   - **Nouvelle formation** : un titre, puis l’éditeur s’ouvre.
     - Dans Informations, pas de choix du formateur, ni de gratuité, ni de prix. À la place, le bloc « Réglé par l’équipe Étudium ».
     - Remplis le résumé, choisis un parcours, ajoute une image de couverture.
   - **Programme** : un module, une leçon (une vidéo YouTube et sa durée) ;
   - **Publication** : **Envoyer en relecture**. L’état devient « En attente de validation ». Modifie encore le résumé : c’est permis.
4. Avec ton compte, Back-office → **Formations** → filtre **En attente** : la formation y est, avec « Envoyée en relecture le … par » le nom de sa fiche.
   - **Renvoyer au formateur** avec la remarque « Ajoute une description. ».
5. Dans la fenêtre privée : la formation est « À corriger », avec ta remarque. Ajoute une description, puis **Envoyer en relecture**.
6. Avec ton compte :
   - dans Informations, règle la gratuité ou un prix ;
   - **Publier** ;
   - la formation apparaît dans le catalogue.
7. Dans la fenêtre privée :
   - l’état est « Publiée », « En ligne depuis le … » ;
   - corrige un texte ;
   - au back-office, la formation affiche « Modifiée par le formateur le … », dans sa ligne et dans l’onglet Publication.
8. Dans la fenêtre privée, ouvre l’adresse d’une formation publiée d’un autre formateur sous `/formateur/formations/<identifiant>` : « page introuvable ».

## 20. Valider le suivi des étudiants et le tableau de bord du formateur, 20 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0015_suivi_etudiants.sql` (après la 0014).
2. Prépare la formation du compte de test (section 19), avec ton compte, au back-office :
   - qu’elle soit **gratuite** (onglet Informations), sinon le troisième compte ne pourra pas ouvrir ses leçons ;
   - qu’elle ait **deux leçons** : la leçon vidéo, et une leçon de texte, sans vidéo. Le formateur peut ajouter la seconde depuis son espace.
3. Il te faut un **troisième compte**, sans rôle. Ton compte (équipe) et celui du formateur ne comptent pas comme étudiants. Inscris-en un nouveau dans une autre fenêtre privée, ou un autre navigateur. Avec ce compte :
   - ouvre la leçon vidéo et regarde quelques secondes (une leçon vidéo ne se termine qu’après avoir regardé la plus grande partie de la vidéo) ;
   - ouvre la leçon de texte et clique **Marquer comme terminée**.
4. Avec le compte de test (formateur), **Espace formateur** :
   - le tableau de bord du design : « Bonjour … », les chiffres (Formations, Étudiants « +1 ce mois », Progression moyenne 50 %) ;
   - le tableau « Mes formations » : Inscrits 1, progression 50 %, taux de complétion 0 %, statut, Modifier ;
   - « Étudiants à risque » : « Aucun étudiant à risque. » (il faut plus de 10 jours sans activité).
5. **Étudiants** (menu) : la ligne du troisième compte, avec sa formation, « 1 / 2 », la date et l’état « En cours ».
   - Essaie le filtre « Terminés » (vide) et la recherche par son prénom. L’adresse de la page ne change pas.
6. Clique sur son nom : ses leçons (« Terminée le … » pour la leçon de texte, « Ouverte » pour la vidéo), le temps de vidéo, la mention du lot 3.
   - Écris une **remarque privée**, **Enregistrer** : « Remarque enregistrée ». Recharge : elle est là, avec sa date.
7. Avec ton compte : Back-office → **Utilisateurs** → le troisième compte : la section « Remarques des formateurs » montre la remarque, avec le nom de la fiche formateur.
8. Avec le troisième compte : rien de cette remarque n’apparaît nulle part.

## 21. Valider les notifications et les annonces, 20 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0016_notifications.sql` (après la 0015).
2. **Nouvelle formation.** Le troisième compte (section 20) suit la formation du compte de test : il en a ouvert une leçon.
   - Avec ton compte, au back-office : crée une autre formation dans **le même parcours**, ajoute-lui une leçon, puis publie-la.
   - Avec le troisième compte : la cloche porte un point bleu. Ouvre-la : « Nouvelle formation : … », « Dans le parcours … ». Clique : la fiche de la formation s’ouvre et le point disparaît.
3. **Nouvelle leçon.** Ajoute une leçon à la formation que suit le troisième compte (avec ton compte ou celui du formateur). Le troisième compte reçoit « Nouvelle leçon dans … » ; le clic ouvre la leçon.
4. **Relecture.** Avec le compte de test (formateur), envoie un brouillon en relecture.
   - Ton compte reçoit « Formation à valider » ; le clic ouvre l’onglet Publication de la formation au back-office.
   - Renvoie-la au formateur avec une remarque : le compte de test reçoit « Votre formation est à corriger », avec le début de ta remarque.
5. **Annonce.** Back-office → **Annonces** : un titre, un texte, le lien `/formations`, **Envoyer l’annonce**, puis confirme.
   - « Annonce envoyée à N comptes. » : tous les comptes sauf le tien. Elle apparaît dans la liste « Annonces envoyées ».
   - Le troisième compte et le compte de test la reçoivent ; ton compte non.
6. **Préférences.** Avec le troisième compte : cloche → **Voir toutes les notifications**.
   - La page : les filtres « Toutes » et « Non lues », les groupes « Aujourd’hui », **Tout marquer comme lu**.
   - **Préférences** ouvre l’onglet Notifications du profil : coupe « Annonces ». Envoie une deuxième annonce avec ton compte : le troisième compte ne la reçoit pas.
7. **Avis masqué.** Avec le troisième compte, laisse un avis sur la formation du compte de test (il en a terminé la moitié, section 20). Le compte de test reçoit « Nouvel avis sur … ».
   - Avec ton compte : Back-office → **Avis** → **Masquer** cet avis. Personne ne reçoit de notification.
   - Avec le troisième compte : la fiche de la formation montre toujours son avis, avec « Votre avis » et aucune autre mention ; la note et le nombre d’avis de la fiche ne changent pas pour lui.
   - Dans une fenêtre privée, sans compte : l’avis n’apparaît pas.

## 22. Valider la règle « un seul rôle », 10 minutes

Un compte a l’espace étudiant, plus soit l’espace formateur, soit le back-office, jamais les deux. Donner le rôle Formateur crée sa fiche formateur : il n’y a plus de fiche à choisir.

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0017_role_unique.sql` (après la 0016).
   - Un compte qui avait Formateur et un rôle de l’équipe perd Formateur ; ses formations restent sur sa fiche.
   - Un compte qui avait plusieurs rôles de l’équipe garde le plus élevé.
2. Avec ton compte, rond de profil : **Espace étudiant** et **Back-office** seulement. L’espace formateur et son message « pas encore relié à une fiche formateur » ont disparu.
3. Back-office → **Utilisateurs** → menu **⋮** du troisième compte (section 20) → **Changer le rôle** :
   - la fenêtre propose un seul choix parmi Étudiant, Formateur, Modérateur, Admin et Super admin, chacun avec ses espaces ;
   - choisis **Formateur**, puis **Changer le rôle** : « Rôle changé », et la colonne Rôle dit « Formateur ».
4. Avec le troisième compte : la cloche dit « Vous êtes formateur ». Rond de profil → **Espace formateur** → **Mes formations** : crée une formation tout de suite, sans aucun message de fiche. Back-office → **Formateurs** : sa fiche est là, à son nom.
5. Remets-lui le rôle **Étudiant** : l’espace formateur disparaît de son rond de profil, et sa formation reste (Back-office → Formations). S’il redevient formateur, il retrouve sa fiche et sa formation.
6. Sur ta propre fiche (Utilisateurs → ton compte), choisis **Admin** : la base refuse, « Vous ne pouvez pas vous retirer le rôle super admin. ».

## 23. Valider les sessions live, 20 minutes

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0018_sessions_live.sql` (après la 0017).
2. **Programmer.** Avec le compte formateur : **Espace formateur** → **Sessions live** → **Nouvelle session**.
   - Programme une session qui commence **dans 15 minutes**, avec un vrai lien Google Meet (crée-le dans Google Meet, « Nouvelle réunion »).
   - Programme une deuxième session pour **demain**.
   - Les autres comptes reçoivent « Nouvelle session live : … » dans la cloche ; le formateur, non.
3. **S’inscrire.** Avec le compte étudiant : menu **Événements**.
   - Les deux sessions, avec leur date, « Google Meet » et le formateur.
   - **Je m’inscris** sur celle de demain : la fenêtre « Inscription confirmée » ; **Ajouter à mon agenda** télécharge un fichier à ouvrir dans ton agenda.
   - L’**Accueil** montre la carte « Prochaine session live ».
4. **Rejoindre.** Reste sur la page Événements : 10 minutes avant le début de la première session, **Rejoindre** apparaît sans recharger la page, même pour un compte qui ne s’est pas inscrit. Le bouton ouvre Google Meet.
5. **Le rappel.** Une inscription faite trop près du début ne déclenche pas de rappel : le moment est déjà passé.
   - Avec le formateur, programme une troisième session qui commence **dans 1 h 10** ; avec le compte étudiant, inscris-toi tout de suite.
   - Une dizaine de minutes plus tard, change de page (ou recharge) : la cloche montre « Session live dans moins d’une heure ».
   - Le rappel de la veille suit la même règle : il faut s’être inscrit plus de 24 h avant, puis ouvrir l’application à moins de 24 h du début. Il ne se vérifie donc pas en 20 minutes.
6. **Modifier et annuler.** Avec le formateur : ouvre la session de demain (Sessions live → son titre).
   - La liste « Inscriptions » montre le compte étudiant (prénom et nom, sans adresse e-mail).
   - **Modifier** : change l’heure, **Enregistrer** ; l’étudiant reçoit « Session live modifiée ».
   - **Annuler la session**, puis confirme : l’étudiant reçoit « Session live annulée » ; dans **Mes inscriptions**, la session est marquée « Annulée ».
   - Le **tableau de bord** du formateur montre sa prochaine session live.
7. **Back-office.** Avec ton compte : **Sessions live** (groupe Contenus) liste toutes les sessions. **Nouvelle session** : choisis « Équipe Étudium » comme animateur. Le **tableau de bord** du back-office compte les sessions à venir.
8. **Sur ton téléphone** (`http://192.168.0.3:3000`) : la page Événements et la carte de l’accueil.

## 24. Valider la communauté, 20 minutes

> Depuis le fil « Actualités » (section 26), quelques libellés ont changé : l’onglet **Actualités** s’ouvre d’abord, le champ est fermé (« Quoi de neuf, … ? »), « Répondre… » devient « Écrire un commentaire… », et « Membres actifs » laisse la place à « Activités récentes ».

L’espace général est ouvert à tout compte connecté. L’espace d’un parcours est ouvert à qui a commencé une formation de ce parcours (il en a ouvert une leçon), au formateur d’une formation du parcours et à l’équipe. Le signalement et la vérification automatique des publications arrivent avec la partie Modération.

1. Dans l’éditeur SQL de Supabase, applique `web/supabase/migrations/0019_communaute.sql` (après la 0018). Elle crée aussi l’espace de stockage privé « communaute » des fichiers joints : rien à faire dans le tableau de bord.
2. **Publier.** Avec le compte étudiant : menu **Communauté**.
   - Les onglets : **Général**, puis un par parcours ; un cadenas sur ceux dont il n’a commencé aucune formation.
   - Dans **Général** : clique dans le champ (le titre facultatif apparaît), écris un titre et un texte, **Image** → une photo (JPEG, PNG ou WebP, 10 Mo au plus), puis **Publier**.
   - « Publication en ligne » : elle apparaît en haut du fil, avec « Vous » et « Espace général · à l’instant ». Recharge la page : l’image est toujours là.
   - Ouvre l’onglet du parcours de la formation qu’il suit, et publie avec **Fichier** → un PDF : le nom et la taille s’affichent, le bouton à droite l’ouvre dans un nouvel onglet.
3. **Un espace fermé.** Clique un onglet à cadenas : « Espace … verrouillé », « Commencez une formation du parcours … ». **Voir les formations du parcours** ouvre Mes parcours sur ce parcours.
4. **Répondre.** Avec le compte formateur : **Communauté** → la publication de l’étudiant → écris dans « Répondre… », puis Entrée.
   - Le compte étudiant reçoit « Nouvelle réponse » dans la cloche ; le clic ouvre la page de la publication, avec toutes ses réponses.
   - Au-delà de deux réponses, le fil n’en montre que les deux dernières : **Voir les N réponses** les déplie toutes.
5. **Les actions.** Avec le compte étudiant, sur sa publication :
   - **J’aime** : le compteur passe à 1 et devient bleu ; un second clic le retire ;
   - **⋮** → **Copier le lien** : « Lien copié ». Colle l’adresse dans un nouvel onglet : la page de la publication s’ouvre ;
   - **⋮** → **Modifier** : change le texte, **Enregistrer** ; la publication porte « modifiée » ;
   - **⋮** → **Supprimer**, puis confirme : « Publication supprimée », avec son fichier et ses réponses.
6. **L’équipe.** Avec ton compte : tous les onglets sont ouverts. Sur la publication d’un autre compte, **⋮** propose **Supprimer** (pas Modifier) ; la corbeille d’une réponse la supprime aussi.
7. **La colonne de droite** (sur un grand écran ; sous le fil sinon) : « Prochaine session » avec **Voir la session**, et « Membres actifs », les trois comptes qui ont le plus écrit cette semaine.
8. **Sur ton téléphone** (`http://192.168.0.3:3000`) : publie avec une photo prise sur le moment. **Copier le lien** peut y dire « Le lien n’a pas pu être copié. » : sur une adresse en `http://` autre que `localhost`, le navigateur bloque le presse-papiers ; en ligne (`https://`), il fonctionnera.

## 25. Valider la modération, 30 minutes

L'analyse automatique envoie chaque nouvelle publication à une IA (Claude, d'Anthropic), qui l'autorise, la signale à l'équipe ou la bloque. Les membres signalent aussi publications et réponses. Tout arrive au back-office, dans **Modération**.

1. Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0020_moderation.sql` (après la 0019). Si tu rejoues un jour la 0019, rejoue la 0020 juste après.
2. **La clé et le jeton** (toi seul les vois ; ne me les envoie jamais) :
   - sur console.anthropic.com, crée un compte, ajoute un peu de crédit, puis **API Keys** → **Create Key** ;
   - dans l'éditeur SQL de Supabase : `select jeton from public.reglages_moderation;` ;
   - dans `web/.env.local`, ajoute deux lignes : `ANTHROPIC_API_KEY=` suivi de la clé, et `MODERATION_JETON=` suivi du jeton (voir `web/.env.example`) ;
   - arrête puis relance l'application.
3. **Activer.** Avec ton compte : Back-office → **Modération**. Le bloc « Analyse automatique » dit « Clé de l’IA : présente » et « Jeton de modération : reconnu ». Clique **Activer l’analyse automatique**. Dans la Communauté, le champ dit désormais « Les publications sont vérifiées automatiquement. ».
4. **Trois publications de test**, avec le compte étudiant :
   - une normale (« Quelqu’un a un conseil pour le plan de mon mémoire ? ») : elle paraît ;
   - une arnaque (« Envoyez 5 000 F par Mobile Money à ce numéro pour recevoir 50 000 F demain ») : elle est refusée, avec la catégorie dans le message ; elle apparaît dans l'onglet **Bloquées** de la file ;
   - une douteuse (un lien vers un site inconnu et une promotion insistante) : elle paraît, et arrive dans **À examiner** avec la raison de l'IA. Ta cloche affiche « À modérer ».
   - L'IA peut juger autrement d'une fois à l'autre : si la douteuse passe, essaie une formulation plus appuyée.
5. **Signaler.** Avec le compte formateur, sur une publication du compte étudiant : **⋮** → **Signaler** → « Spam ou publicité » → **Envoyer le signalement** ; puis le drapeau d'une réponse. Un second signalement du même contenu est refusé. Ta cloche n'affiche « À modérer » qu'au premier signalement de chaque contenu.
6. **La file.** Back-office → Modération :
   - **Garder** : le contenu quitte la file ;
   - **Supprimer**, puis confirme : il disparaît de la Communauté, et son auteur reçoit « Publication retirée » (ou « Réponse retirée ») ;
   - onglet **Bloquées** → **Rétablir** : l'arnaque de test paraît, et son auteur reçoit « Publication en ligne ». Supprime-la ensuite.
   - Le **tableau de bord** du back-office montre « Contenus à examiner » et le lien vers la file.
7. **Sans la clé.** Retire `ANTHROPIC_API_KEY` de `web/.env.local` et relance : une nouvelle publication affiche « Publication envoyée » et attend l'équipe (« En attente de vérification » pour son auteur seul) ; le bloc de la file le signale. **Garder** la met en ligne. Remets la clé et relance.
8. **Désactiver** (bloc « Analyse automatique ») : les publications paraissent de nouveau sans vérification. Réactive-la ensuite.
9. **Politique de confidentialité** : quand tu la rédigeras, indique que les publications de la communauté sont analysées par un service d'IA (Anthropic) pour la modération.

## 26. Valider le fil « Actualités », 30 minutes

La communauté prend la forme des captures « izimentor » : l'onglet **Actualités** rassemble tous les espaces, une annonce épinglée (vidéo ou affiche) s'affiche en haut, les liens donnent un aperçu, et la colonne de droite montre les publications tendances et les activités récentes.

1. **La migration.** D'abord, rejoue la **0020 actuelle** (`web/supabase/migrations/0020_moderation.sql`) : celle de ta base est une version précédente. Puis applique `web/supabase/migrations/0021_communaute_actualites.sql`. Si tu rejoues un jour la 0019 ou la 0020, rejoue la 0021 juste après.
2. **L'annonce.** Avec ton compte : Back-office → **Communauté** (groupe Plateforme).
   - Allume **Afficher l’annonce**, écris un titre et un texte, laisse **Vidéo YouTube** et colle l'adresse d'une vidéo (par exemple une vidéo de la chaîne Étudium). L'aperçu à droite suit ta saisie. **Enregistrer** : « Annonce enregistrée ».
   - Avec le compte étudiant : **Communauté**. L'annonce est en haut des **Actualités**, avec « Annonce épinglée ». Le bouton Lecture charge la vidéo. Elle n'est pas dans l'onglet **Général**.
   - De retour au back-office : **Affiche** → une image (JPEG, PNG ou WebP, 10 Mo au plus) → **Enregistrer**. Dans la Communauté, l'affiche remplace la vidéo.
   - **Qui la voit** → « Les membres d’un parcours » → un parcours que l'étudiant n'a pas commencé → **Enregistrer** : l'étudiant ne la voit plus. Le formateur de ce parcours, lui, la voit.
   - Pour toi (l'équipe), la carte de l'annonce porte **⋯** « Gérer l’annonce », qui ramène à cette page.
   - **Retirer l’annonce**, puis confirme : elle disparaît du fil.
3. **Les liens.** Avec le compte étudiant, dans **Actualités** : clique « Quoi de neuf, … ? », puis publie trois messages :
   - un lien Google Meet (`https://meet.google.com/…`) : le lien est cliquable, et une carte « meet.google.com » s'affiche avec une caméra ;
   - un lien YouTube : l'image de la vidéo et le bouton Lecture ; la vidéo se lit dans la publication, et **Regarder sur YouTube** l'ouvre sur YouTube ;
   - un site quelconque (un article de presse, par exemple) : sa carte avec image, domaine, titre et description. Un site qui ne répond pas donne une publication sans carte.
   - La carte apparaît aussitôt. Si tu modifies le texte (⋮ → **Modifier**), la carte suit le nouveau lien.
4. **Commenter.** Avec le compte formateur, sur une de ces publications : la bulle **Commenter** amène au champ « Écrire un commentaire… ». Les deux derniers commentaires s'affichent en bulles sous la publication ; au-delà, **Voir les N commentaires**. Sous chaque bulle : **Signaler** et **Supprimer** (selon les droits).
5. **J’aime et les initiales.** Le cœur devient bleu ; à droite du pied de la publication, les initiales des trois derniers qui aiment et « 1 J’aime · 2 commentaires ».
6. **Trier et enregistrer.** « Trier par : » → **Les plus populaires** (les plus aimées et commentées du mois) ; puis le signet d'une publication (« Publication enregistrée ») et **Mes enregistrements** : elle s'y trouve. Un second clic sur le signet la retire.
7. **La colonne de droite** (grand écran ; sous le fil sinon) : **Publications tendances** (les plus aimées et commentées de la semaine), **Activités récentes** (« Koffi D. a publié « … » », « … a commenté « … » », le moment en bleu), puis **Prochaine session**. Chaque ligne ouvre la publication.
8. **Sur ton téléphone** (`http://192.168.0.3:3000`) : les onglets défilent du doigt. Le bouton **≡** ouvre le menu, avec le groupe **Espaces de la communauté** (Actualités, Général, les parcours, un cadenas sur ceux qui sont fermés) : chaque entrée ouvre son onglet.
9. **Hors communauté**, le menu ≡ ne montre pas ce groupe. Sur ordinateur, le bouton à gauche du logo réduit toujours la barre latérale à ses icônes.

## 27. Valider la mise en forme et les vidéos, 15 minutes

Le texte d'une publication se met en forme comme dans un traitement de texte, et une vidéo (YouTube, Vimeo, TikTok, Facebook, Instagram, Dailymotion, Loom, Google Drive ou un fichier .mp4) peut l'accompagner.

1. **La migration.** Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0022_communaute_video.sql` (après la 0021). Si tu rejoues un jour la 0019, la 0020 ou la 0021, rejoue la 0022 juste après.
2. **La mise en forme.** Avec le compte étudiant : **Communauté** → « Quoi de neuf, … ? ».
   - Au-dessus du texte, la barre : Titre 1, Titre 2, Titre 3, Gras, Italique, Souligné, Barré, Liste à puces, Liste numérotée, Citation. Le bouton d'un style actif est bleu.
   - Écris une ligne, sélectionne-la, clique **Titre 1** ; écris une phrase et mets un mot en **gras**, un autre en italique, souligné, barré ; fais une liste. Les raccourcis marchent aussi (Ctrl+B, Ctrl+I, Ctrl+U).
   - **Publier** : la publication s'affiche comme dans l'éditeur. **⋮ → Modifier** rouvre l'éditeur avec la mise en forme. Les listes restent sur un seul niveau (Tab ne crée pas de sous-liste) et un titre tient sur une ligne.
   - Sur téléphone, la barre défile du doigt.
3. **La vidéo.** Dans le champ ouvert, **Vidéo** (ou l'icône caméra du champ fermé, sur ordinateur) :
   - colle un lien YouTube : l'aperçu s'affiche aussitôt ; **Publier** : la vidéo se lit dans la publication au clic ;
   - essaie un lien Vimeo, TikTok, Facebook ou Instagram ;
   - un lien d'un autre site (Twitch, par exemple) donne une carte « Regarder sur … » ;
   - un texte qui n'est pas une adresse : « Collez l’adresse complète de la vidéo (https://…). » ; la croix **Retirer la vidéo** l'enlève.
4. **Avec l'analyse automatique** (section 25) : l'adresse de la vidéo et l'aperçu d'un lien (titre, description) sont jugés avec le texte ; l'image de la vidéo n'est pas analysée.


## 28. Valider l'onglet Formations et les rappels des sessions live, 20 minutes

Un seul onglet **Formations** (juste après Accueil), « Ajouter à mon agenda » qui ouvre Google Agenda, un rappel 10 min avant, et une notification à tout le monde quand le live commence.

1. **La migration.** Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0023_sessions_rappels.sql` (après la 0022). Si tu rejoues un jour la 0018, rejoue la 0023 juste après.
   - La fin du fichier crée une **tâche planifiée** (pg_cron) qui envoie rappels et annonces **toutes les minutes**, même si personne n'est connecté.
   - Si le résultat affiche « pg_cron indisponible » : Supabase → **Integrations** → **Cron** → **Enable**, puis relance seulement le dernier bloc du fichier (de `do $cron$` à la fin).
   - Pour vérifier : **Integrations** → **Cron** → la tâche `etudium-sessions-live` (toutes les minutes) apparaît, et son historique se remplit. Une seconde tâche, `etudium-purge-cron`, efface chaque nuit l'historique de plus de 7 jours.
   - Si le résultat affiche « Tâche planifiée non créée », la migration est quand même appliquée : envoie-moi le message.
2. **Le menu.** Avec le compte étudiant, la barre latérale : Accueil, **Formations**, Communauté, Messages, Événements. « Mes formations » et « Toutes les formations » ne sont plus dans « Mon espace ». Communauté disparaîtra du menu quand l'Accueil deviendra le fil de la communauté.
3. **La page Formations.**
   - En haut, **Mes formations** : tes formations commencées sur une seule ligne (6 au plus), en petites cartes avec la progression ; **Voir plus** ouvre la liste complète.
   - Dessous, **Toutes les formations** : la recherche, le tri, les parcours et « Gratuites », puis les cartes, 4 à 5 par ligne sur ordinateur.
   - Sur téléphone, la rangée « Mes formations » défile du doigt ; l'onglet **Formations** de la barre du bas ouvre cette page.
4. **Ajouter à mon agenda.** Page **Événements** → **Je m’inscris** → **Ajouter à mon agenda** : Google Agenda s'ouvre dans un nouvel onglet avec la session pré-remplie ; **Enregistrer** l'ajoute. Google y met le rappel par défaut de ton agenda (réglable dans Google Agenda). Le lien **Autre agenda (.ics)** sert pour Apple Calendar et Outlook, avec une alerte 10 min avant. Le bouton est aussi sur la carte d'une session où tu es inscrit.
5. **Les rappels et l'annonce.** Au back-office, programme une session dans 15 minutes et inscris-y le compte étudiant.
   - Vers 10 min avant : l'étudiant reçoit « Session live dans 10 minutes » (cloche). La cloche se met à jour seule toutes les minutes ; un message apparaît aussi en bas de l'écran.
   - À l'heure du début : **tous les comptes** (étudiant non inscrit, formateur, admin) reçoivent « C’est l’heure du live : … ».
   - Un compte qui a coupé « Sessions live » dans ses préférences de notification ne reçoit rien.

## 29. Valider la promotion des sessions live, 15 minutes

Une session programmée paraît dans la communauté, avec son affiche ou sa vidéo, et un bouton « Sessions live programmées » signale les nouvelles sessions par une pastille rouge.

1. **La migration.** Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0024_sessions_promotion.sql` (après la 0023). Si tu rejoues un jour la 0018, la 0022 ou la 0023, rejoue la 0024 juste après.
2. **Le formulaire.** Au back-office : **Sessions live** → **Nouvelle session**.
   - Remplis le titre, la description, la date et le lien Google Meet.
   - Rubrique **Visuel de promotion** : **Ajouter une affiche** (une image) ou **Ajouter une vidéo** (un lien YouTube). La croix retire le visuel.
   - À droite (en dessous sur téléphone), **Aperçu dans la communauté** montre la publication telle qu'elle paraîtra, avec « Google Meet » bien visible.
3. **La publication.** **Programmer la session**, puis ouvre **Communauté** : la publication est en haut du fil (dans l'espace du parcours choisi, ou Général), avec le bloc de la session et **Voir la session**. Le lien du live n'y figure jamais.
   - **Modifier** la session met la publication à jour ; l'**annuler** affiche « Annulée » dans le bloc.
4. **La pastille.** Avec le compte étudiant, après une nouvelle session :
   - dans **Communauté**, le bouton **Sessions live programmées** porte une pastille rouge « 1 » ;
   - l'entrée **Événements** du menu porte la même pastille ;
   - ouvre **Événements** : les pastilles disparaissent.

## 30. Valider les commentaires de la communauté, 10 minutes

Sous chaque commentaire : Répondre, J’aime et un menu ⋮ (copier le lien, signaler, modifier, supprimer).

1. **La migration.** Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0025_communaute_commentaires.sql` (après la 0024). Si tu rejoues un jour la 0019, la 0020 ou la 0024, rejoue la 0025 juste après.
2. **Répondre.** Avec deux comptes : le premier commente une publication ; le second clique **Répondre** sous ce commentaire et envoie. La réponse s'affiche décalée sous le commentaire, et le premier compte reçoit « Nouvelle réponse à votre commentaire ». Répondre à une réponse la range sous le même commentaire, en citant son auteur.
3. **J’aime** sous un commentaire : le nombre s'affiche ; un second clic le retire.
4. **Le menu ⋮** d'un commentaire :
   - **Copier le lien** : l'adresse ouvre la publication et descend jusqu'au commentaire ;
   - **Signaler** : pour les commentaires des autres ;
   - **Modifier** et **Supprimer** : pour ton commentaire, et pour tous au compte de l'équipe. Un commentaire modifié porte « modifié » ; supprimé, ses réponses disparaissent avec lui.
5. **Voir plus de commentaires** : la carte du fil montre les 2 derniers commentaires ; le bouton affiche tous les autres et leurs réponses.

## 31. Valider les sondages, les quiz et les publications programmées, 20 minutes

Le champ de publication propose Image, Sondage avec images, Sondage avec texte, Quiz, Vidéo et Fichier ; « Publier » a une flèche pour programmer.

1. **La migration.** Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0026_communaute_sondages.sql` (après la 0025). Si tu rejoues un jour une migration de la communauté (0019 à 0025), rejoue la 0026 juste après. **Si tu l'as appliquée avant le 15 octobre, rejoue-la** : la version corrigée compte une publication programmée dans la limite « 5 publications en 10 minutes » au moment où on l'écrit, et non jusqu'à sa parution.
   - Avec l'analyse IA active, un **sondage avec images** attend la vérification de l'équipe (`/admin/moderation`) avant de paraître : l'IA ne juge que le texte.
2. **Sondage avec texte.** Accueil → « Quoi de neuf… » → **Sondage avec texte** : la question dans le texte, 2 options ou plus, « Plusieurs réponses possibles », la fin du sondage. **Publier**. Avec un autre compte : coche une option, **Voter** : les pourcentages s'affichent ; **Changer mon vote** reste possible jusqu'à la fin.
3. **Sondage avec images.** Même chose avec une image par option (2 à 6) ; on vote en touchant une image.
4. **Quiz.** La question, 2 à 6 réponses, coche **Bonne réponse** sur l'une, une explication si tu veux. Avec un autre compte : choisis une réponse, **Valider** : la bonne réponse s'affiche en vert (la tienne en rouge si elle est fausse), puis l'explication. On ne répond qu'une fois.
5. **Programmer.** Écris une publication, clique la **flèche** à côté de « Publier » → **Programmer…**, choisis la date et l'heure (au moins 10 minutes plus tard) → le bouton devient « Programmer » et une ligne au-dessus rappelle « Programmée pour le … » (la croix revient à « Publier »).
   - Sous le champ, l'onglet **Programmées** la montre, avec « Modifier la date » et « Publier maintenant » dans son menu ⋮ ;
   - les autres comptes ne la voient pas avant l'heure ; à l'heure, elle paraît en haut du fil.

## 32. Valider le nouvel Accueil, 10 minutes

Aucune migration. L'Accueil est maintenant la communauté : « Communauté » a quitté le menu.

1. **Le menu.** À gauche : Accueil, Formations, Messages, Événements. Sur téléphone, la barre du bas : Accueil, Formations, Événements, Certificats, Profil.
2. **L'en-tête.** Accueil affiche « Bonjour, ton prénom », puis tout ce qu'avait la communauté : les espaces (Actualités, Général, parcours), le champ de publication, « Publiées / Programmées » et la colonne de droite.
3. **Les nouvelles formations.** Dans Actualités, « Les plus récentes », une formation mise en ligne depuis moins de 30 jours apparaît dans le fil, à sa date, avec « Découvrir la formation ». Dans Général, un parcours ou un autre tri, elle n'y est pas.
4. **Formations disponibles.** Sous le fil, les 4 formations les plus récentes et « Voir toutes les formations ». Sur téléphone, elles défilent en largeur.
5. **Les anciens liens.** Ouvre `/communaute` : tu arrives sur l'Accueil ; `/communaute?espace=general` ouvre l'onglet Général. Une notification de commentaire ouvre toujours la page de la publication, dont le fil d'Ariane ramène à l'Accueil.

## 33. Valider la nouvelle création des formations (étape A), 20 minutes

L'onglet « Programme » devient « Leçons » (sections et leçons au glisser-déposer, statut par leçon) et la page d'une leçon devient un éditeur en deux colonnes.

1. **La migration.** Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0027_lecons_statut.sql` (après la 0026). Tes leçons actuelles restent publiées.
2. **L'onglet Leçons.** Back-office → une formation → **Leçons** : « n sections · n leçons », chaque section repliable (pastille « n leçons »), **+ Ajouter une section**, **Ajouter** (une leçon).
   - Attrape la poignée ⠿ d'une leçon et glisse-la, y compris dans une autre section ; au clavier : Tab jusqu'à la poignée, Espace, flèches, Espace.
   - Le menu ⋮ d'une leçon : Modifier, Voir comme un étudiant, Monter, Descendre, « Déplacer vers… », Supprimer.
3. **Le statut.** Clique « Publiée ▾ » ou « Brouillon ▾ » sur une leçon. Avec un compte étudiant, une leçon en brouillon n'apparaît pas dans la formation ; la publier envoie « Nouvelle leçon » à ceux qui suivent la formation.
   - Dans une formation déjà publiée, une nouvelle leçon naît en **brouillon** ; dans une formation jamais publiée, elle naît publiée (tout reste caché tant que la formation ne l'est pas).
   - Publier une formation demande au moins une leçon publiée.
4. **L'éditeur de leçon.** Ouvre une leçon : en haut, « Retour aux leçons », « Leçon 2 sur 5 · Module 1 », les flèches ‹ ›, le statut, **Enregistrer** et l'œil **Voir comme un étudiant** (nouvel onglet).
   - À gauche, les **Réglages** : lien de la vidéo (l'aperçu s'affiche), durée en minutes et secondes, « Activer les commentaires », « Leçon d'aperçu gratuite », documents.
   - À droite, le titre et le texte **mis en forme** (titres, gras, listes, liens) ; « Dans cette leçon » se déplie.
   - Modifie quelque chose, puis clique « Retour aux leçons » : « Quitter sans enregistrer ? ».
5. **Voir comme un étudiant.** Sur une formation en brouillon, l'œil ouvre la vraie page de la leçon avec le bandeau « Aperçu : pas encore visible des étudiants » (ta progression n'y est pas enregistrée). Un compte étudiant, lui, a « page introuvable ».

## 34. Valider le suivi des formations (étape B), 20 minutes

La page d'une leçon prend une barre du haut et des discussions, le programme se replie, et la page du cours est retouchée.

1. **La migration.** Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0028_discussions_lecons.sql` (après la 0027).
2. **La barre du haut** (ordinateur). Ouvre une leçon avec un compte étudiant : à gauche « ‹ Titre de la formation » (retour à la page du cours) ; à droite **Mode lecture** (le programme s'efface, reclique pour le remettre) et **Terminer la leçon ›**.
   - Leçon sans vidéo : « Terminer la leçon » la termine et ouvre la suivante.
   - Leçon avec vidéo : le bouton reste grisé avec « Regardez au moins 90 % de la vidéo » ; au seuil, il devient « Leçon suivante › ».
   - Sur la dernière leçon : « Dernière leçon terminée ! » et « Voir la formation ».
   - La barre reste en haut quand tu fais défiler la leçon ; le programme, à gauche, défile de son côté.
3. **Au-dessus du titre** : « Leçon 6 sur 12 » et les flèches ‹ ›. Avec ton compte de l'équipe (ou celui du formateur de la formation), le lien **Modifier la leçon** ouvre l'éditeur ; un compte étudiant ne le voit pas.
4. **Le programme** (à gauche) : les modules se replient (celui de la leçon ouverte est déplié), chaque leçon a sa durée, la progression (barre, %, temps restant) est en bas.
5. **Sur téléphone** : le bouton **Leçons** en haut à droite ouvre le programme dans un tiroir ; choisir une leçon le referme. L'onglet « Programme » sous la leçon a disparu.
6. **Les discussions**, sous la leçon : « Discussions de la leçon », écris un commentaire puis clique la flèche d'envoi, à droite du champ (son nom pour les lecteurs d'écran : « Publier le commentaire »).
   - Avec un deuxième compte : Répondre, J'aime, le menu ⋮ (Copier le lien, Signaler). Ton compte formateur porte l'étiquette « Formateur ».
   - Notifications : le formateur reçoit « Nouveau commentaire sur votre leçon », l'auteur reçoit « Nouvelle réponse à votre commentaire ». Clique la notification : la leçon s'ouvre et descend jusqu'au commentaire, même ancien.
   - Signale un commentaire : il arrive dans la file de modération du back-office comme « Commentaire de leçon » (Garder ou Supprimer ; « Ouvrir la leçon »).
   - Dans l'éditeur de leçon, décoche « Activer les commentaires » : la section disparaît de la leçon.
   - Un visiteur sans compte ne voit pas les discussions, même sur une leçon d'aperçu gratuit ; en aperçu (bandeau jaune), l'équipe et le formateur non plus.
7. **La page du cours** (compte qui a commencé la formation) : **Poursuivre le cours** en haut à droite, la carte « Progression du cours » (« Terminé 3 sur 12 », %), **Tout déplier / Tout replier** au-dessus du programme. Avec ton compte de l'équipe : **Modifier les leçons** mène à l'onglet Leçons de l'éditeur.

## 35. Valider l'onglet « Apprenants » d'une formation (étape C), 10 minutes

1. **La migration.** Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0029_apprenants_formation.sql` (après la 0028).
2. **Au back-office.** Ouvre une formation → onglet **Apprenants** : quatre chiffres (apprenants, progression moyenne, « Formation terminée », « À risque »), puis le tableau : apprenant, progression « 3 / 12 », commencée le, dernière activité, état.
   - Les filtres Tous · À risque · Terminés et la recherche par nom changent la liste, pas les quatre chiffres.
   - Le nom d'un apprenant ouvre sa fiche dans « Utilisateurs ».
   - Ton compte de l'équipe et celui du formateur n'apparaissent pas, même s'ils ont ouvert des leçons.
3. **Dans l'espace formateur.** Avec le compte du formateur : Mes formations → une formation → **Apprenants**. Le nom d'un apprenant ouvre sa fiche dans « Étudiants ».
4. **Une formation que personne n'a commencée** : « Personne n'a encore commencé cette formation. »

## 36. Valider les vidéos TikTok, Tella, Loom, ScreenPal et Google Drive, 15 minutes

1. **La migration.** Dans l'éditeur SQL de Supabase, applique `web/supabase/migrations/0030_plateformes_video.sql` (après la 0029).
2. **La durée exacte.** Dans l'éditeur d'une leçon, colle un lien YouTube ou Vimeo : « Lecture de la durée de la vidéo… », puis la durée exacte s'inscrit toute seule (« Durée lue sur la vidéo. »). Une leçon déjà enregistrée avec une durée fausse affiche « La vidéo dure 2:09 ; la durée saisie est 10:00. » et le bouton **Utiliser 2:09**.
3. **TikTok et Tella** (le temps regardé se mesure, comme YouTube) :
   - colle le lien complet d'une vidéo TikTok (`tiktok.com/@nom/video/123…`) ; un lien court (`vm.tiktok.com/…`) affiche « Lien court TikTok : ouvrez-le, puis copiez le lien complet » ;
   - la durée se lit toute seule ; enregistre, puis ouvre la leçon avec un compte étudiant : la vidéo TikTok s'affiche en vertical, avec les commandes Étudium ;
   - regarde-la jusqu'au bout : « Temps réellement regardé » monte, puis « Terminer la leçon » devient « Leçon suivante ».
   - **Important :** dis-moi si une vidéo TikTok ou Tella reste sur « Le temps regardé ne peut pas être mesuré avec ce lecteur » : je n'ai pas pu essayer leurs lecteurs dans mon navigateur.
4. **Loom, ScreenPal, Google Drive** (sans mesure) : colle le lien ; l'éditeur dit « la leçon se terminera d'un clic sur « Terminer la leçon » » et la durée devient facultative. Côté étudiant, le lecteur de la plateforme s'affiche, et « Terminer la leçon » marche tout de suite.
   - Google Drive : partage la vidéo avec « Tous les utilisateurs disposant du lien », sinon l'étudiant voit « Accès refusé ».
