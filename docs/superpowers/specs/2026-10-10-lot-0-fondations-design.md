# Lot 0 — Fondations : spec technique

- **Date :** 10 octobre 2026
- **Statut :** validée le 10 octobre 2026 (tâche 0.0)
- **Références :** [feuille de route](2026-10-09-feuille-de-route-design.md) · design « Étudium — Nouveau design » (https://claude.ai/artifact/9Ei2bCdhG75Nr3KnFZQxfg) · cahier des charges V1

À la fin du lot 0, on peut **créer un compte, le vérifier, se connecter (e-mail ou Google), naviguer dans l'application, modifier son profil et se déconnecter**, sur ordinateur et sur téléphone, avec exactement le rendu du design.

---

## 1. Ce que tu as décidé

| Sujet | Décision |
|---|---|
| Mode de travail | **Tout en local d'abord.** L'application tourne sur ton ordinateur (`http://localhost:3000`). La mise en production viendra plus tard, comme une étape à part. |
| Base de données en local | Un projet Supabase gratuit **réservé aux tests** (`etudium-dev`). Il n'est visible par personne d'autre. Docker n'est pas possible sur ton Windows. La production aura son propre projet Supabase, vide et propre. |
| Design | L'artefact « Nouveau design » est la seule référence visuelle. Chaque écran du lot 0 reproduit son fichier `Nd….dc.html`. |
| Connexion | E-mail + mot de passe, vérification de l'adresse par **code à 6 chiffres**, et Google. |

---

## 2. Outils et versions

| Rôle | Outil | Pourquoi |
|---|---|---|
| Application | **Next.js 16** (App Router) + **React 19** + **TypeScript** | Pages publiques bien référencées, logique serveur intégrée, standard du marché |
| Styles | **Tailwind CSS 4**, avec les couleurs, arrondis et tailles du design déclarés comme variables | Le code reprend les valeurs exactes de la planche « Fondations » |
| Icônes | **Hugeicons** (`@hugeicons/react` + jeu gratuit) | Les 49 icônes du design existent toutes dans la version gratuite |
| Police | Inter (Google Fonts, chargée par Next.js) | Celle du design |
| Comptes, base, fichiers | **Supabase** (`@supabase/ssr`) | Inscription, connexion, Google, codes par e-mail, stockage des photos de profil |
| Validation des formulaires | **Zod** | Mêmes règles côté navigateur et côté serveur, messages en français |
| Tests | **Vitest** pour la logique ; vérification à l'écran dans le navigateur intégré pour chaque tâche | Tes vérifications de la colonne « Tu valides quand… » restent la validation finale |
| Appli installable | Manifeste natif de **Next.js** (décidé à la tâche 0.7 ; **Serwist** seulement si l’on veut un jour le hors-connexion) | Icône, écran de lancement, installation sur téléphone |
| Historique du code | **Git** dès la tâche 0.1, avec un dépôt GitHub **privé** servant de sauvegarde | Chaque tâche validée = un enregistrement, envoyé sur GitHub. Le site, lui, n'est pas mis en ligne. |

Ton ordinateur a déjà ce qu'il faut : Node 24, npm et Git.

---

## 3. Organisation du dossier

```
Etudium - Plateforme/
├── docs/                         specs et feuille de route
├── Projet Claude Code/doc/       cahier des charges (PDF)
└── web/                          l'application
    ├── src/app/
    │   ├── (auth)/               connexion, inscription, vérification, mot de passe
    │   ├── (app)/                espace connecté : accueil, profil, pages « à venir »
    │   ├── auth/                 retours de Google et des liens reçus par e-mail
    │   └── not-found.tsx         page 404
    ├── src/components/ui/        composants du design (bouton, champ, carte, menu, modale…)
    ├── src/components/layout/    en-tête, barre latérale, menu bas mobile, mise en page des écrans de compte
    ├── src/lib/supabase/         connexion à Supabase (navigateur, serveur, middleware)
    ├── src/lib/auth/             actions serveur et règles de validation
    ├── supabase/migrations/      structure de la base, en fichiers SQL numérotés
    └── tests/
```

---

## 4. Écrans du lot 0

| Adresse | Écran du design | Ce qui fonctionne |
|---|---|---|
| `/inscription` | `NdInscription` | Prénom, nom, e-mail, mot de passe (8 caractères minimum), acceptation des conditions, bouton Google |
| `/verification-email` | `NdCodeVerification` | Saisie du code à 6 chiffres, expiration après 10 minutes, « Renvoyer le code » avec compte à rebours, « Modifier mon adresse » |
| `/connexion` | `NdConnexion`, `NdConnexionErreur` | E-mail + mot de passe, « Se souvenir de moi », message « E-mail ou mot de passe incorrect », Google |
| `/connexion?session=expiree` | `NdSessionExpiree` | Fenêtre « Votre session a expiré » par-dessus la connexion |
| `/mot-de-passe-oublie` | `NdMotDePasse`, `NdMotDePasseEnvoye` | Envoi du lien. Le message est le même que le compte existe ou non (sécurité). |
| `/nouveau-mot-de-passe` | `NdReinitialisation` | Ouvert depuis le lien reçu par e-mail : nouveau mot de passe + confirmation |
| `/accueil` | coque de `NdAccueil` | En-tête, barre latérale, « Bonjour, [prénom] ». Le contenu du tableau de bord arrive au lot 1. |
| `/profil` | `NdProfil`, `NdProfilEnregistre`, `NdMotDePasseModifie`, `NdProfilSuppression` | Onglets Informations, Notifications et Sécurité ; photo de profil ; changement de mot de passe (les autres appareils sont déconnectés) ; suppression du compte (saisir « SUPPRIMER ») |
| menu du profil | `NdMesFormationsMenu` | Mon profil, Mon abonnement, Espace étudiant / formateur / back-office selon le rôle, Se déconnecter |
| déconnexion | `NdDeconnexion` | Fenêtre de confirmation, puis retour à la connexion |
| notifications | `NdNotificationsOuvertes` | Le panneau s'ouvre ; état vide tant que les notifications n'existent pas (lot 5) |
| autres entrées du menu | — | Page « Bientôt disponible » qui dit à quel lot l'écran arrive |
| `/formateur`, `/admin` | — | Pages réservées aux rôles concernés (vides pour l'instant) : un étudiant est renvoyé vers l'accueil |
| adresse inconnue | `Nd404` | Page « Page introuvable » |
| téléphone | `NdMobConnexion`, `NdMobMenu`, `NdMobDeconnexion` | Mêmes écrans en version mobile, menu bas |

Tant que la landing page n'existe pas (lot 1, tâche 1.12), l'adresse `/` envoie vers `/accueil` si l'on est connecté, sinon vers `/connexion`.

---

## 5. Charte en code (planche « Fondations »)

| Nom dans le code | Valeur | Usage |
|---|---|---|
| `page` | `#F2F6FD` | Fond derrière tout |
| `coque` | `#E9EFFB` | Barre latérale, boutons gris, cadre des écrans de compte |
| `panneau` | `#FFFFFF` | Contenu, cartes |
| `encre` | `#1D1D1F` | Titres |
| `texte` | `#232326` | Texte courant |
| `discret` | `#667085` | Descriptions, métadonnées |
| `bleu` | `#0B18C9` (survol `#08149F`) | Boutons, liens, progression, sélection |
| états | info `#DDE1FF`/`#0B18C9` · réussite `#DDF3E4`/`#17663A` · attention `#FBEFD0`/`#8A5A00` · erreur `#FBE3E1`/`#B42318` · premium `#EDE9FE`/`#6D28D9` | Fond + texte de chaque message |
| arrondis | 4 · 12 · 14 · 16 · 28 · 32 px | Étiquettes · champs · boutons · cartes · panneau · coque |
| typographie | titre de page 32/40 poids 500 · section 20/28 600 · carte 16/24 600 · texte 14/22 · description 12/18 | Inter |

Les autres valeurs (bordures, champs, ombres) sont relevées sur les planches au moment de la tâche 0.2.

---

## 6. Base de données

Tout est en fichiers SQL dans `web/supabase/migrations/`, appliqués dans l'ordre.

**`profils`** : une ligne par compte, créée automatiquement à l'inscription.
`id` (le compte), `prenom`, `nom`, `telephone`, `pays`, `niveau_etudes`, `etablissement`, `filiere`, `objectifs`, `photo_url`, `preferences_notifications` (les 8 catégories de l'onglet Notifications, activées ou non), `cree_le`, `modifie_le`.

**`roles`** : `profil_id`, `role` (`etudiant`, `formateur`, `moderateur`, `admin`, `super_admin`). Un compte peut avoir plusieurs rôles : un formateur est aussi étudiant. Tout nouveau compte reçoit `etudiant`.

**Photos** : un espace de stockage `photos-profil` (JPG ou PNG, 2 Mo maximum).

**Règles d'accès** (appliquées par la base elle-même, pas seulement par l'interface) :
- chacun lit et modifie uniquement son propre profil ;
- chacun lit ses propres rôles ; seul un `super_admin` peut attribuer ou retirer un rôle ;
- les administrateurs pourront lire tous les profils (utile au lot 6).

**Ton compte** : à la fin de la tâche 0.6, tu reçois le rôle `super_admin`.

---

## 7. Fonctionnement de la connexion

- **Inscription :** le compte est créé, Supabase envoie un e-mail avec un code à 6 chiffres (valable 10 minutes). Tant que le code n'est pas saisi, on ne peut pas se connecter.
- **Renvoyer le code :** le délai minimum entre deux envois est réglé dans Supabase (60 secondes par défaut). Le compte à rebours de l'écran suit ce réglage. Le design montre 0:45 : on peut régler Supabase sur 45 secondes.
- **Se souvenir de moi :** coché, la session dure 30 jours ; décoché, elle s'arrête à la fermeture du navigateur.
- **Mot de passe oublié :** lien par e-mail, qui ouvre `/nouveau-mot-de-passe`.
- **Changer de mot de passe (profil) :** on vérifie d'abord le mot de passe actuel, puis on déconnecte les autres appareils.
- **Google :** bouton « Continuer avec Google ». Un compte Google sans profil Étudium en crée un automatiquement.
- **Session expirée :** si la session n'est plus valable, retour à `/connexion` avec la fenêtre « Votre session a expiré ».
- **Pages protégées :** tout l'espace connecté est réservé aux comptes connectés ; `/formateur` et `/admin` en plus aux rôles concernés.

**E-mails en local :** l'envoi par défaut de Supabase est limité à quelques e-mails par heure et à ta propre adresse. Pour tester sans blocage, on branche **Resend** sur le projet de test (tu l'utilises déjà pour le calculateur). Tu colles toi-même la clé Resend dans Supabase ; je ne la vois pas.

---

## 8. Les tâches du lot 0, version locale

| # | Tâche | Ce que tu fais | Tu valides quand… |
|---|---|---|---|
| 0.1 | Mise en place locale : projet Next.js dans `web/`, Git + dépôt GitHub privé, connexion au projet Supabase de test, page d'accueil provisoire | Créer le projet Supabase `etudium-dev` et le dépôt GitHub privé ; coller l'URL et la clé publique dans le fichier `.env.local` que je te prépare (guide pas à pas) | `npm run dev` affiche une page Étudium sur `http://localhost:3000`, avec la mention « Base connectée » |
| 0.2 | Composants du design en code + page vitrine `/vitrine` | — | La vitrine ressemble aux planches Fondations, Boutons, Formulaires, Cartes, Navigation, Messages, Menus et Modales |
| 0.3 | Coque de l'application : en-tête, barre latérale, menu bas mobile, menus déroulants, pages « Bientôt disponible », page 404 | — | Sur ordinateur et sur téléphone, tu navigues dans toutes les entrées du menu |
| 0.4 | Inscription, code de vérification, connexion, mot de passe oublié, session expirée, Google, déconnexion | Brancher Resend sur Supabase ; créer l'identifiant Google (guide pas à pas) | Tu crées un compte avec ton e-mail, tu reçois le code, tu te connectes, tu réinitialises ton mot de passe, tu te connectes avec Google |
| 0.5 | Profil : informations, photo, préférences de notification, sécurité, suppression du compte | — | Tes modifications restent après rechargement ; le changement de mot de passe déconnecte un autre navigateur |
| 0.6 | Rôles et pages protégées ; ton compte devient `super_admin` | — | Un compte étudiant ne peut pas ouvrir `/admin` ; le tien, si |
| 0.7 | Appli installable (PWA) : icône (le logo hexagonal du design), écran de lancement, installation | — | Dans Chrome sur ton ordinateur, le bouton « Installer Étudium » apparaît et l'appli s'ouvre dans sa propre fenêtre. Sur téléphone, l'installation exige une adresse en `https` : on la vérifiera au passage en production. |

---

## 9. Décisions prises pendant la relecture

1. **Suppression du compte et certificats (décidé).** À la suppression, on efface les données personnelles mais on garde une trace minimale de chaque certificat délivré (identifiant, nom affiché, formation, date), pour que la page de vérification publique continue de fonctionner. Le texte de la fenêtre de suppression (`NdProfilSuppression`) sera ajusté en conséquence. À mettre en place au lot 3, quand les certificats existeront.
2. **Dépôt GitHub privé (décidé).** Créé à la tâche 0.1, uniquement comme sauvegarde du code.
3. **Mise à jour de Windows (conseil, pas une tâche du projet).** Ta version (1903) ne reçoit plus de correctifs de sécurité. Passage à Windows 11 recommandé, voir le guide donné dans la conversation du 10 octobre.

---

## 10. Passage en production (plus tard, pour mémoire)

Quand tu le décideras : création du projet Supabase `etudium-prod`, application des mêmes fichiers SQL, dépôt GitHub, branchement de Vercel, adresse `etudium.online`, configuration de Google et des e-mails pour cette adresse. Ce sera une tâche dédiée, avec son propre guide.
