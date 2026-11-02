# Point du 2 novembre 2026 : les points mineurs reportés

Tu as choisi : « s'il y a quelque chose à faire, on en finit avec en même temps ». Tous les points reportés des lots 4, 5, 6 A et 6 B sont donc traités, optimisations comprises, puis relus par un relecteur indépendant et corrigés. Tout est commité sur `lot-0-fondations`.

## 1. Ce qui est fait

| Domaine | Ce qui change pour toi ou tes utilisateurs |
|---|---|
| **Tableau de bord, série, points (0063, avant application)** | Une correction faite à la main dans Supabase ne compte plus comme un jour d'apprentissage. Un parcours désactivé ne sert plus de suite. La popularité des formations est calculée chaque nuit (au lieu de tout relire à chaque affichage). |
| **Recommandations (ta décision 12)** | Une formation payante qu'un étudiant sans abonnement a seulement entrevue (aperçus) lui reste proposée. |
| **Tableau de bord (appli)** | « Aucune formation n'est encore publiée » au lieu de « tout commencé » quand le catalogue est vide. Le message de suite n'apparaît qu'avec sa carte. « Terminez une leçon pour obtenir « Premier pas ». » |
| **Journal (0064)** | Supprimer un parcours donne une ligne, pas une ligne par publication. Résilier donne une ligne « résiliés ». Un membre supprimé reste dans le filtre « Auteur ». |
| **Versions (0064)** | Pas de version en double quand rien n'a changé. « En ligne » disparaît pour une formation repassée en brouillon. Publier des brouillons identiques ne dit plus « version N ». |
| **Désactivation (0064)** | Une formation ne peut plus être créée « désactivée ». Créée « publiée », elle a sa version. |
| **Éditeur** | La limite de 300 Ko est la même à l'écran et à l'enregistrement. Une vidéo collée d'ailleurs est revérifiée. La saisie dans un très gros document est plus légère. Plus de copie périmée qui propose de « récupérer » à tort. Les images se rafraîchissent après une heure. |
| **Leçons** | Un étudiant ne lit plus de brouillon : moins de requêtes. Les images d'une page restée ouverte plus d'une heure se rechargent. |
| **Push** | L'appareil est rattaché au compte à chaque visite, et compte par compte. L'interrupteur dit enfin ce qu'il fait : « À allumer sur chaque appareil ; l’éteindre les coupe partout. » |
| **Vue d'ensemble** | Des index pour ses comptages. |
| **Lint** | Plus aucun avertissement (la carte de formation n'a plus de réglage inutile). |

Cinq points de la liste étaient déjà réglés cette nuit (interrupteur push bloqué, tests manquants du push, file vidée à chaque cloche, description des formations désactivées, et une partie du journal) : je les ai vérifiés, rien à refaire.

**Vérification finale** :
- les types et le lint sont propres, sans aucun avertissement ;
- la suite complète est verte : 370 fichiers et 2 574 tests ;
- la compilation de production réussit.

## 2. La relecture indépendante, et ce que j'ai corrigé

Aucun problème critique. Corrigé, chaque fois avec un test qui échouait avant :

1. **Une copie périmée sur l'appareil** : en quittant l'éditeur alors que tout était enregistré, elle pouvait proposer de « récupérer », et donc écraser le travail d'un collègue.
2. **L'ordre des verrous** : ma première correction déplaçait le risque d'attente entre une sauvegarde et une publication. La sauvegarde garde maintenant son ordre d'origine, et c'est la publication qui s'aligne dessus.
3. **Les images de l'éditeur, le push compte par compte, la copie écrite à la fermeture de l'onglet, le message « version N »** : faits aussi.

## 3. Ce qui te revient

1. **Appliquer, dans l'ordre, la 0063 puis la 0064** : guide, sections 62 et 63. La section 63 contient aussi une requête de contrôle des vidéos déjà collées.
2. **Régénérer le jeton d'envoi**, si ce n'est pas fait (section 59).
3. **La recette**, avec la liste `docs/guides/recette-avant-mise-en-ligne.md`.

## 4. Décisions prises seul

Chaque décision avec ce qu'elle coûte si elle est fausse.

1. **Le renouvellement du push** se fait à chaque visite, et non dans le service worker : l'événement prévu par les navigateurs est mal pris en charge par Chrome. Coût : entre le renouvellement et la visite suivante, les notifications push ne partent pas (celles de l'appli, si).
2. **La popularité** a jusqu'à 24 h de retard. Coût : une recommandation un peu en retard.
3. **« En ligne » reste vrai pour une formation archivée ou désactivée** : c'est sa version courante. Coût : un libellé.
4. **Une formation créée directement « publiée »** (seul le fichier d'exemples le fait) reçoit une version « Mise en ligne » encore sans programme. Coût : une version vide dans l'historique.
5. **Le contrôle des vidéos s'applique aussi à la lecture** : une vidéo déjà collée avec un lien invalide afficherait sa leçon en texte simple. C'est improbable, et la requête de la section 63 le vérifie. Coût : une leçon à réparer à la main.
6. **Un formateur qui enregistre pendant qu'un admin publie la même formation** peut encore se faire refuser une sauvegarde, qui se réessaie seule. C'est un cas ancien et très rare. Coût : un échec passager affiché.

## 5. Ensuite

Ta recette, avec la liste. Envoie-moi tes remarques au fil de l'eau : je corrige une par une, puis on passe à la mise en ligne.
