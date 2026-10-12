# Étudium — application web

Plateforme de formation, de compétences digitales et d’accompagnement pour les étudiants et les jeunes diplômés.
La documentation du projet (feuille de route, specs, plans) est dans le dossier `docs/` à la racine du dépôt.

## Prérequis

- Node.js 20.9 ou plus récent (Node 24 recommandé)
- Un projet Supabase de test (`etudium-dev`)

## Démarrer en local

```bash
npm install
```

Copiez `.env.example` en `.env.local`, puis remplissez-le avec l’URL du projet Supabase et sa clé **publique**
(Project Settings › API : clé « publishable », ou « anon » pour les anciennes clés).

```bash
npm run dev
```

Ouvrez http://localhost:3000/etat : la page indique « Base connectée » quand Supabase répond.
La connexion demande ensuite quelques réglages dans Supabase (modèles d’e-mail, Resend, Google) : voir `docs/guides/brancher-la-connexion.md`.

Tant que `.env.local` n’est pas rempli, `npm run dev` tourne en **mode démonstration** : l’espace connecté (`/accueil`) s’ouvre sans compte,
avec l’utilisatrice des écrans du design. Ce mode n’existe jamais en production.
Après une modification de `.env.local`, arrêtez puis relancez `npm run dev` : le fichier n’est relu qu’au démarrage.

## Pages utiles

- `/etat` : état de la connexion à la base (ouverte sans compte)
- `/connexion`, `/inscription`, `/mot-de-passe-oublie` : écrans de compte
- `/accueil` : espace connecté (demande un compte dès que la base est branchée)
- `/profil` : mon profil (informations, photo, notifications, mot de passe, suppression du compte)
- `/vitrine` : tous les composants de l’interface (sur l’ordinateur seulement, jamais sur le site en ligne)

## Autres commandes

```bash
npm test        # tests automatiques (Vitest)
npm run lint    # vérification du code (ESLint)
npm run build   # compilation de production
```

## Sécurité

- `.env.local` ne doit **jamais** être partagé ni envoyé sur GitHub : il est ignoré par Git.
- N’y mettez jamais la clé secrète de Supabase (`sb_secret_…` ou `service_role`). L’application refuse de démarrer la connexion si elle en détecte une.
