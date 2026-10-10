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

Ouvrez http://localhost:3000. La page indique « Base connectée » quand Supabase répond.
Après une modification de `.env.local`, arrêtez puis relancez `npm run dev` : le fichier n’est relu qu’au démarrage.

## Autres commandes

```bash
npm test        # tests automatiques (Vitest)
npm run lint    # vérification du code (ESLint)
npm run build   # compilation de production
```

## Sécurité

- `.env.local` ne doit **jamais** être partagé ni envoyé sur GitHub : il est ignoré par Git.
- N’y mettez jamais la clé secrète de Supabase (`sb_secret_…` ou `service_role`). L’application refuse de démarrer la connexion si elle en détecte une.
