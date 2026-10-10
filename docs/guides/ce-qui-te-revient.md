# Ce qui te revient (lot 0)

Trois manipulations que je ne peux pas faire à ta place, parce qu’elles touchent à tes comptes ou à ton ordinateur, puis la validation des tâches 0.2 à 0.4. Rien ne presse dans l’ordre, sauf Windows (voir plus bas).

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
6. Dis-moi ce qui ne te va pas : une couleur, un texte, un espacement, un comportement. Je corrige avant d’attaquer la suite.

> Pour tester sur ton téléphone pendant que l’application tourne sur l’ordinateur, les deux doivent être sur le même Wi-Fi ; dis-le-moi et je te donne la marche à suivre.
