# Point du 1er novembre 2026 : fin du lot 4, lot 5 étapes B et C

Travail fait seul, comme demandé (« enchaîne… après tu me fais le point »), sur la branche `lot-0-fondations`. Chaque partie a eu une relecture indépendante à la fin ; tous les points critiques et importants sont corrigés, chacun avec un test qui échouait avant la correction.

## 1. Ce qui est fait

| Partie | Migrations | Guide | Relecture |
|---|---|---|---|
| Lot 4 : éditeur riche, brouillons, historique des versions | 0055, 0056, 0057 | §58 | 1 critique et 8 importants corrigés |
| Lot 5 B : notifications push et e-mails importants (finit aussi le lot 2 : reçu et rappels par e-mail) | 0058 | §59 | 5 importants corrigés, 3 mineurs remontés en importants et corrigés |
| Lot 5 C : désactiver une formation | 0059 | §60 | 3 importants corrigés |

Vérifications finales : types et lint propres ; suite complète 2 404 tests sur 2 405. Le seul échec, `tests/db/finitions-paiement.test.ts`, vient d'un jeu d'essai sensible à l'heure (il passe seul, 7 sur 7, et ne charge que les migrations jusqu'à 0053) : une tâche à part est proposée pour le stabiliser.

## 2. Ce qui te revient

1. **Migrations**, dans l'éditeur SQL de Supabase, dans l'ordre : 0055, 0056, 0057, 0058, 0059.
2. **À la fin de la 0058**, recopie la ligne `jeton_envois` dans `web/.env.local` : `ENVOIS_JETON=…` (affichée une seule fois).
3. **Clés** dans `web/.env.local` (guide §59) : `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUJET`, `RESEND_API_KEY`, `EMAIL_EXPEDITEUR`, et `EMAIL_REPONSE` (facultatif).
4. **Redémarrer** le serveur, puis suivre les tests des guides §58, §59 et §60.
5. **Payiz en réel** : refais un essai de paiement ; l'erreur exacte de Payiz est maintenant journalisée et je pourrai la lire.

## 3. Décisions prises seul

Chacune avec ce qu'elle coûte si elle est mauvaise.

### Lot 4

- La consigne d'un exercice est renvoyée par `rendu_a_corriger` (écran de correction) ; la page étudiant la lit avec la leçon. Coût : nul.
- Les vues de l'image et de la vidéo sont dans un seul fichier ; le bloc d'information est stylé par un attribut. Coût : nul.
- Les menus du tableau et du bloc d'information sont des barres sous la barre principale plutôt que des menus flottants : accessibles au clavier et testables. Coût : un choix d'ergonomie.
- Le format d'une image est lu dans ses octets, pas dans son nom (photos de téléphone sans extension). Coût : nul.
- Le validateur retire `title` (lien) et `align` (cellule), ajoutés par Tiptap 3, qui sinon produirait des documents refusés. Coût : nul.
- Un enregistrement sans document laisse le contenu tel quel ; avant la 0055, il est refusé avec le message de migration. Coût : nul.
- Ajout de colonnes `revise_par`, pour nommer l'auteur d'un conflit. Coût : nul.
- La liste « Modifications non publiées » donne aussi la position (« Leçon N : titre »). Coût : nul.
- Erreurs de la base :
  - un refus ou un compte sans droit est « invalide », sans nouvel essai ;
  - une panne ou une migration absente est retentée.
  - Coût : nul.
- « Modifié » est déduit de la valeur plutôt que posé dans un effet (règle React).
  - La copie de l'appareil est proposée à l'ouverture, même ancienne.
  - Quitter l'éditeur par un lien envoie la dernière valeur.
  - Coût : un envoi de plus.
- `saveLecon` est supprimée : l'éditeur s'enregistre seul. Ses cas sont repris dans les nouveaux tests. Coût : nul.
- L'éditeur se recharge seulement quand la base a une révision plus récente. Coût : nul.
- Les informations générales sont affichées dans la page des réglages de la formation (aucune page à changer). Coût : nul.
- Le brouillon se lit par la règle d'accès des tables ; sur la fiche, un bandeau « Brouillon ». Coût : nul.
- Une restauration n'écrit que ce qui diffère. Une leçon supprimée revient non publiée, avec sa provenance. Coût : nul.
- Les libellés de l'historique sont à l'heure du Bénin. Coût : nul.
- Choix de la spec gardés malgré la relecture :
  - les images sont lisibles par qui a accès à une leçon de la formation ;
  - le formateur publie seul ;
  - pas de version pour l'ajout ou la suppression d'une leçon ;
  - l'aperçu montre le brouillon aux éditeurs.

### Lot 5 B : push et e-mails

- **Le jeton du serveur** est créé et affiché par la migration, pas par un bouton du back-office : aucune page technique de plus. Coût : nul.
- **Les essais** : 4 en tout (1, puis 5, puis 15 minutes), soit les « 3 nouveaux essais » de la spec. Coût : nul.
- **La clé d'idempotence Resend**, propre à chaque base : un reçu ne part jamais en double. Coût : nul.
- **Le client sans session** pour vider la file : les fonctions sont protégées par le jeton. Coût : nul.
- **Quand la file se vide** : après la cloche, un message, une annonce, mais aussi une suspension, une réactivation et la confirmation d'un paiement. Ainsi, le reçu et l'e-mail de suspension partent tout de suite. Coût : un appel de plus par action.
- **« Notifications push »** est un réglage du compte. L'interrupteur est allumé quand ce réglage est actif et que cet appareil est abonné, et l'éteindre coupe le push partout. Coût : un réglage par appareil, à ajouter plus tard si besoin.
- **Un appareil** dont l'enregistrement échoue est désabonné (sinon l'interrupteur mentirait). Coût : nul.
- **Pas de vidage planifié de la file** pour l'instant. Coût : des e-mails retardés jusqu'à la prochaine visite. C'est à prévoir avant la mise en ligne.

### Lot 5 C : désactivation

- **Qui est prévenu** : « les étudiants qui la suivent » sont ceux qui ont ouvert une leçon, sans les comptes suspendus, l'équipe et les formateurs. Coût : nul.
- **Le formateur est prévenu** aussi (la spec n'en parlait pas). Coût : une notification de plus.
- **Réactiver ne crée pas de version** dans l'historique. Coût : nul.
- **Sur la carte de « Mes formations »**, l'explication est courte (« Momentanément indisponible »), pour le téléphone. Coût : un libellé.
- **Gardés comme pour une formation archivée** : la messagerie avec le formateur, l'espace du parcours, l'édition par le formateur, l'élève « à risque » au tableau de bord et les favoris. Coût : faible.

## 4. Points mineurs reportés

### Lot 4

- Revenir à la valeur enregistrée laisse l'état d'échec et la copie de l'appareil.
- Supprimer une leçon ouverte par quelqu'un d'autre fait échouer ses enregistrements, sans message clair.
- Interblocage rare possible entre enregistrer, publier et la version.
- La limite de 300 Ko est mesurée différemment côté appli et côté base.
- Chaque version garde un instantané complet.
- « En ligne » reste vrai si la formation repasse en brouillon.
- L'identifiant d'une vidéo intégrée est vérifié de façon lâche.
- Les brouillons sont lus pour chaque étudiant (requêtes en plus).
- Taper dans un très gros document coûte plus (JSON répété).
- Pas de « Recharger » sur le conflit des informations générales.
- Publier pendant qu'un enregistrement échoue publie le brouillon précédent sans le dire.
- Le message de restauration dit « dans le brouillon » même quand l'écriture est directe.
- Les liens d'images valent une heure sur une page restée ouverte.
- Pas de version de départ pour les formations déjà en ligne au moment de la 0057.
- Un enregistrement suspendu bloque les suivants.

### Lot 5 B

- Un compte sans adresse e-mail est retenté 4 fois avant l'abandon.
- Le service worker accepte un lien « /\t/… » (les liens en base sont déjà contrôlés).
- Plusieurs push de messages s'empilent au lieu de se remplacer.
- Un abonnement renouvelé par le navigateur n'est pas repris : il faut rallumer l'interrupteur.
- L'interrupteur reste bloqué si le service worker ne s'active jamais.
- La file est vidée à chaque chargement de la cloche.
- Un paiement à 100 % par code promo attend la cloche suivante pour son e-mail.
- « Sur cet appareil » alors qu'éteindre coupe le push partout (le guide l'explique).
- Tests manquants :
  - le push seul ;
  - le jeton sans aucune clé ;
  - la réponse 404 du push.

### Lot 5 C

- Tests manquants :
  - le formateur qui réactive ;
  - une formation archivée qu'on désactive ;
  - « Nouvelle formation » quand la formation a un parcours ;
  - le certificat vérifié par son identifiant.
- `nombre_suiveurs_formation` peut être appelée sans compte, mais la vérification interne refuse.
- Avant la 0059, « Désactiver » donne le message générique au lieu de « Appliquez la migration 0059 ».
- Une formation créée directement « désactivée » (API ou SQL) : sa réactivation ne note pas de version.
- La description de la liste des formations ne cite pas les formations désactivées.

## 5. Ensuite

Le **lot 6**. C'est un lot entier : sa spec sera à valider avec toi avant de coder.
