# Lot 6, partie B : engagement (tableau de bord étudiant, série, points, recommandations) — spec à valider

**Feuille de route** : tâches 6.3, 6.4 et 6.5. Chacune est validée quand :
- **6.3** : « Le tableau de bord répond aux 4 questions du design system (section 22) » ;
- **6.4** : « Une série de 3 jours d'apprentissage s'affiche correctement » ;
- **6.5** : « Après avoir terminé une formation, une suite logique t'est proposée ».

**Sources** :
- design system, §22 : les 4 questions (« Où en suis-je ? », « Que dois-je continuer ? », « Qu'est-ce que je peux apprendre ensuite ? », « Que dois-je faire maintenant ? ») ;
- design system, §46.8 : motiver sans gamification excessive ;
- cahier des charges : §22 (le tableau de bord), §25 (recommandations), §27 (objectifs), §35 (notifications), §50 (« gamification légère », pas de classement obligatoire) et §60 (récompenses avancées après le MVP) ;
- design : `NdAccueil` (tableau de bord), `NdProfil` (carte « Gamification »), `NdMobMenu`, et les pastilles de l'en-tête.

**Rédigée le 2 novembre 2026** pendant que tu te reposais, avec mes recommandations. Rien n'est codé : cette spec attend ta validation.

## Les choix (mes recommandations, à valider)

| # | Question | Ma recommandation |
|---|---|---|
| Q1 | Où vit le tableau de bord ? | **Une page « Tableau de bord »** (`/tableau-de-bord`), première entrée de « Mon espace ». L'Accueil reste le fil de la communauté (choix du 15 octobre). Les pastilles de l'en-tête (série, points) y mènent. |
| Q2 | Qu'est-ce qu'un jour d'apprentissage ? | **Un jour (heure du Bénin) avec au moins une activité** : leçon ouverte ou avancée, leçon terminée, quiz passé, exercice rendu. Une nouvelle table garde une ligne par compte et par jour, remplie par la base au moment de l'activité. |
| Q3 | L'objectif de la semaine ? | **Un nombre de jours d'apprentissage par semaine** : 3, 5 (par défaut) ou 7, choisi dans le profil. Les jours de la semaine s'affichent cochés (L à D). Le « 20 minutes par jour » du design n'est pas retenu : le temps n'est mesuré que sur les vidéos suivies, un jour de lecture ou de quiz ne compterait jamais. |
| Q4 | Les points ? | **Barème léger** : leçon terminée +10, quiz réussi +20, exercice validé +30, certificat +100, chaque jour de série +5. Les points ne se perdent pas. Chacun ne voit que les siens : pas de classement. |
| Q5 | Les niveaux ? | **Un niveau tous les 200 points** (niveau 1 de 0 à 199, niveau 2 à 200…), avec « Encore N points pour atteindre le niveau X ». |
| Q6 | Les badges ? | **8 badges fixes** : Premier pas (1re leçon terminée), Série de 3 jours, Série de 7 jours, Série de 30 jours, Premier quiz réussi, Premier exercice validé, Premier certificat, Trois certificats. |
| Q7 | Les recommandations ? | **Dans cet ordre** : 1) la formation suivante du même parcours, après une formation terminée (« Vous avez terminé X. Découvrez maintenant Y. ») ; 2) depuis une compétence digitale, la formation Business qui la valorise (lien du 31 octobre) ; 3) les formations de ses parcours non commencées, populaires puis nouvelles ; 4) le catalogue. Jamais une formation déjà commencée. |
| Q8 | Les rappels de série ? | **Une notification à 18 h** (catégorie « Rappels d’apprentissage », coupable dans le profil, donc aussi en push) : « Votre série de N jours s’arrête ce soir » à qui a une série de 2 jours ou plus et n'a rien fait ce jour-là. |
| Q9 | Et le formateur ? | **Rien de tout cela** : il n'a pas d'espace étudiant (restructuration du 20 octobre). |

## 1. Le tableau de bord (`NdAccueil`, version de bureau ; sur téléphone, les mêmes blocs les uns sous les autres)

Les blocs répondent aux quatre questions :

| Question | Blocs |
|---|---|
| Où en suis-je ? | « Bonjour, [Prénom] » ; quatre indicateurs : progression globale (« +N % ce mois »), formations en cours (« Sur N formations »), certificats obtenus, série d'apprentissage (« N jours ») |
| Que dois-je continuer ? | « Continuer l'apprentissage » : la dernière formation ouverte, sa leçon où reprendre, sa progression, « Reprendre la leçon », « Voir le parcours » |
| Que dois-je faire maintenant ? | « À faire » : exercices à corriger, quiz à repasser, leçon suivante ; « Prochaine session live » (inscription d'un clic) |
| Qu'est-ce que je peux apprendre ensuite ? | « Recommandé pour vous » (Q7), 3 formations ; « Activité récente » : *ses* derniers événements (exercice validé, nouveau certificat, quiz réussi, badge) |

**Le bloc « Objectif de la semaine »** (Q3) :
- « 3 / 5 jours » ;
- les sept jours de la semaine ;
- « Points gagnés cette semaine : N » et « Niveau N ».

**Les cas vides** : un compte sans formation commencée voit « Commencez votre première formation » et les recommandations.

## 2. La base (une migration)

- **`activite_jours`** : compte, jour, nombre d'activités, secondes de vidéo vues ce jour-là. Elle est remplie par déclencheurs sur `progression_lecons`, `tentatives_quiz` et `rendus_exercices`.
- **`points_gagnes`** : compte, raison, référence, points, date. Une seule ligne par raison et par référence, pour que les points ne se comptent jamais deux fois. Elle est remplie par déclencheurs : leçon terminée, quiz réussi, exercice validé, certificat, jour de série.
- **`badges_obtenus`** : compte, badge, date ; les 8 badges sont décrits dans l'appli.
- **Fonctions** :
  - `mon_tableau_de_bord()` rend tout le tableau de bord en une lecture ;
  - `ma_progression_jeu()` rend la série, les points, le niveau et les badges (en-tête, profil, menu du téléphone) ;
  - `recommandations_pour_moi(nombre)` applique la règle Q7.
- **Le rappel de série** : une tâche planifiée chaque jour à 18 h (heure du Bénin), comme les rappels des sessions.
- **Le profil** : `objectif_jours` (3, 5 ou 7) s'ajoute aux préférences.

## 3. L'appli

- La page « Tableau de bord » et ses blocs.
- Les pastilles de l'en-tête : la série et les points de la semaine, réels (aujourd'hui elles affichent 0).
- La carte « Gamification » du profil (`NdProfil`) : niveau, série, badges, « Encore N points… ».
- Le choix de l'objectif dans l'onglet Notifications du profil.
- Les tuiles de `NdMobMenu`.

## 4. Ce qui n'est pas fait

- Pas de classement entre étudiants (cahier des charges §50).
- Pas de récompenses échangeables (§60, après le MVP).
- Les « domaines consultés » du §25 : aucune donnée ne les enregistre aujourd'hui, ils sont ajoutables plus tard.
- Le passé ne se reconstruit pas : la série et les points commencent à l'application de la migration. Une seule exception : les certificats déjà obtenus donnent leurs points et leurs badges.

## 5. Tests

- Une série de 3 jours : 3 jours consécutifs avec une activité, puis un jour sans activité qui la remet à 0.
- Le barème des points, sans double compte.
- Les seuils de niveau.
- Chaque badge.
- Les recommandations, cas par cas.
- Le rappel de 18 h : il part seulement pour une série d'au moins 2 jours sans activité ce jour-là, et pas si la préférence est coupée.
- Le tableau de bord vide et plein.
- Les pastilles de l'en-tête.
