# Bilan : modération (14 octobre 2026)

Quatrième partie du lot 5, après la communauté. Écrite sans validation intermédiaire, à ta demande : les décisions prises pour toi sont listées plus bas.

## En bref

- **L'analyse automatique :**
  - chaque publication est vérifiée par une IA (Claude Haiku, d'Anthropic) au moment de publier ou de modifier : son titre, son texte et son fichier (l'image réduite, le PDF jusqu'à 5 Mo) ;
  - **autorisée**, elle paraît ; **signalée**, elle paraît et entre dans la file de l'équipe ; **bloquée**, elle est refusée, avec la catégorie dans le message (« Arnaque »…), et l'équipe peut la rétablir ;
  - une **analyse impossible** (panne, délai de 20 s dépassé, PDF trop lourd) publie quand même, et met la publication dans la file ;
  - une **clé fausse**, un crédit épuisé ou un refus de l'IA de juger le contenu : la publication attend l'équipe (« En attente de vérification », visible de son auteur seul).
- **La sécurité de l'analyse :**
  - la clé de l'IA et le **jeton de modération** restent sur le serveur, dans `web/.env.local` ;
  - la base n'applique un verdict que s'il porte le jeton : un appel direct, sans passer par l'application, ne peut pas se dispenser de l'analyse ;
  - le verdict est lié au fichier analysé : un fichier échangé pendant l'analyse est refusé ;
  - le texte de l'auteur est présenté à l'IA comme une donnée, jamais comme des consignes.
- **Le coût de l'IA est borné** : la base refuse tout ce qu'elle refuserait avant d'appeler l'IA, et compte 10 analyses par compte en 10 minutes, même si les publications sont supprimées ensuite.
- **Publier trop vite** : 5 publications et 30 réponses par compte toutes les 10 minutes.
- **Signaler** (design `NdCommunaute`) :
  - **⋮** → **Signaler** sur une publication, le drapeau sur une réponse ;
  - le motif (« Contenu inapproprié », « Spam ou publicité », « Harcèlement », « Autre »), des précisions, puis « Signalement envoyé » ;
  - un seul signalement par compte et par contenu ; l'auteur ne sait jamais qui l'a signalé.
- **La file de l'équipe** (`/admin/moderation`) :
  - le bloc « Analyse automatique » : active ou non, la clé et le jeton du serveur (présents, reconnus, jamais affichés), **Activer** et **Désactiver** ;
  - « À examiner » et « Bloquées », avec les raisons (verdict de l'IA, signalements comptés, précisions et nom court de qui a signalé) ;
  - **Garder**, **Supprimer** (l'auteur est prévenu), **Rétablir** ; un lien vers la fiche de l'auteur, pour le suspendre au besoin ;
  - la tuile « Contenus à examiner » au tableau de bord du back-office, et « À modérer » dans la cloche de l'équipe.
- **Migration 0020**, rejouable ; le jeton est conservé. Avant elle, la communauté marche comme avant.
- **Vérifications :**
  - 1 252 tests, dont les droits, les statuts et la file sur une vraie base Postgres en mémoire, et l'appel à l'IA simulé (aucun appel réel) ;
  - vérification des types et du code, compilation de production ;
  - rendu mesuré à 1440, 390 et 320 px : aucun débordement.

## Corrigé après la relecture

La relecture finale (opus) a trouvé deux problèmes critiques et quatre importants. Tous sont corrigés et couverts par des tests.

- **Toutes les analyses auraient échoué** : la requête fixait une « température » que Haiku 5.5 refuse. Rien n'aurait jamais été bloqué.
- **Modifier une publication en attente la mettait en ligne**, avec un fichier jamais analysé. Elle reste désormais en attente : seule l'équipe la publie.
- **Un fichier pouvait être échangé** pendant l'analyse. Le verdict nomme maintenant le fichier précis.
- **Le coût de l'IA n'était pas borné** : quelqu'un pouvait la faire travailler en boucle et vider ton crédit.
- **Une clé fausse faisait tout publier**, sans que le back-office le dise. Les publications attendent désormais l'équipe, et le bloc le signale.
- **Le texte de l'auteur pouvait imiter les balises** qui l'encadrent pour l'IA.

En vérifiant le rendu, j'ai aussi retiré un cadenas qui s'affichait à tort dans les étiquettes « Vous » et « Général » de la communauté.

## Décisions que j'ai prises pour toi

- **L'IA est Claude Haiku d'Anthropic** : peu coûteuse, à l'aise en français, elle lit les images et les PDF. Il te faut un compte Anthropic avec du crédit.
- **Les publications partent chez Anthropic** pour l'analyse : à mentionner dans ta politique de confidentialité.
- **Une analyse impossible publie quand même** et met la publication dans la file, plutôt que de la bloquer.
- **L'analyse s'active à la main**, au back-office, une fois la clé et le jeton en place.
- **Une publication bloquée est gardée**, cachée, pour que l'équipe puisse la rétablir.
- **Une modification est réanalysée** ; bloquée, l'ancienne version reste en ligne.
- **Signaler** :
  - « Autre » demande des précisions ;
  - l'équipe voit qui a signalé, pas l'auteur ;
  - l'équipe ne signale pas : elle modère directement.
- **L'équipe est prévenue** dans la cloche au premier signalement de chaque contenu. L'auteur est prévenu quand l'équipe retire ou publie son contenu, mais pas quand elle supprime une publication bloquée, qu'il n'a jamais vue en ligne.
- **Les limites** : 5 publications et 30 réponses par tranche de 10 minutes, et 10 analyses.
- **Pas de compteur dans le menu du back-office** pour l'instant : la tuile du tableau de bord et la cloche suffisent.
- **La file a été composée sans écran de design** (il n'y en a pas), avec les planches de composants et les pages Avis et Utilisateurs.

## Points mineurs mis de côté

- Une image que le serveur n'arrive pas à lire est publiée et mise dans la file, au lieu d'être refusée.
- Quand une publication repasse en attente, ses réponses ne peuvent plus être supprimées par leur auteur.
- L'équipe peut répondre à une publication bloquée : son auteur reçoit alors une notification vers une page qu'il ne peut pas ouvrir.
- Dans « Bloquées », la confirmation de suppression dit que l'auteur sera prévenu, ce qui n'est pas le cas.
- Avec `MODERATION_MODELE` réglé sur Opus ou Sonnet, l'analyse échouerait : garde le modèle par défaut.
- Quelques détails sans effet pour l'utilisateur :
  - un commentaire trop optimiste sur le type du fichier ;
  - la file relit toutes les publications ;
  - une relecture des variables d'environnement en double ;
  - rejouer la 0019 demande de rejouer la 0020 (c'est écrit dans le guide).

## Ce qui te revient

1. Dans l'éditeur SQL de Supabase, applique `0019_communaute.sql` puis `0020_moderation.sql`, si ce n'est pas déjà fait.
2. Suis la section 25 du guide `docs/guides/ce-qui-te-revient.md`. Elle t'explique comment créer la clé, lire le jeton et les ranger dans `web/.env.local`. Ne me les envoie jamais.
