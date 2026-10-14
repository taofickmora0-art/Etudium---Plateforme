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
