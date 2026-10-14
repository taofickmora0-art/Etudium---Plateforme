# Bilan : sondages, quiz et publications programmées (nuit du 14 au 15 octobre 2026)

Ta demande du 14 octobre (capture du champ de publication façon YouTube), d'après la spec que tu as validée
(`docs/superpowers/specs/2026-10-14-publication-sondages-quiz-programmation-design.md`). Une relecture indépendante à la
fin ; ses points critique et importants sont corrigés.

## En bref

- **Le champ de publication** : la rangée de la capture, **Image, Sondage avec images, Sondage avec texte, Quiz, Vidéo,
  Fichier**. Une publication porte un seul ajout ; en choisir un autre demande « Remplacer … ? » si le premier est rempli.
- **Sondage avec texte** : 2 à 10 options, « Plusieurs réponses possibles », fin à 1 jour, 3 jours, 1 semaine (par défaut),
  2 semaines ou sans fin.
  - Dans le fil, on coche et **Voter**. Ensuite viennent les pourcentages, les barres et « mon choix ».
  - **Changer mon vote** reste possible jusqu'à la fin. Après, « Sondage terminé » et les résultats seuls.
- **Sondage avec images** : 2 à 6 images (JPG, PNG, WebP, 10 Mo), libellé facultatif.
  - Dans le fil, une grille de 2 images par ligne sur téléphone et 3 sur ordinateur.
  - On vote en touchant une image, et le pourcentage s'affiche ensuite sur l'image.
- **Quiz** : 2 à 6 réponses, une seule bonne, une explication facultative.
  - **Valider** est définitif : la bonne réponse s'affiche en vert, la mienne en rouge si elle est fausse, puis l'explication.
  - La bonne réponse n'arrive jamais au navigateur avant d'avoir répondu.
- **« Publier ▾ »** : la flèche ouvre **Programmer…**, avec la date et l'heure du Bénin, de 10 minutes à 3 mois.
  - Programmée, la publication n'est visible que de son auteur et de l'équipe. Elle paraît à l'heure en haut du fil.
  - Son menu ⋮ propose « Modifier la date » et « Publier maintenant ».
- **Sous le champ, deux onglets** : **Publiées**, le fil habituel avec « Trier par », et **Programmées**, tes publications
  à venir.
- **Vérifications** :
  - 1 515 tests, dont la migration sur une vraie base Postgres en mémoire.
  - Les types, le code et la compilation de production.
  - Les rendus, vus au navigateur à 1440, 390 et 320 px.

## Corrigé après la relecture

- **Bloquant** : la limite « 5 publications en 10 minutes » comptait une publication programmée jusqu'à sa parution.
  Programmer 5 publications bloquait donc toute publication pendant des jours. Elle compte désormais au moment où on écrit.
- Une publication supprimée par l'équipe de modération laissait les images de son sondage dans le stockage.
- **Analyse IA active** : les images d'un sondage paraissaient sans être analysées. Un sondage avec images attend
  maintenant la vérification de l'équipe.
- Un refus au moment de publier (heure devenue trop proche, texte vide…) laissait les images déposées dans le stockage.
- **Rendu** :
  - la pastille « mon choix » se confondait avec une image bleue ;
  - la rangée d'options prenait 4 lignes sur un petit téléphone, elle en prend 3.

## Ce qui te revient

- **Guide « Ce qui te revient », section 31** :
  - applique `web/supabase/migrations/0026_communaute_sondages.sql`, ou **rejoue-la si tu l'as appliquée avant le 15
    octobre** (version corrigée) ;
  - puis suis les vérifications de la section.

## Décisions que j'ai prises pour toi

1. Programmée, la publication garde sa date de parution comme date de publication : le fil, les tris et les dates restent
   justes sans tout réécrire.
2. Sondage avec images à une seule réponse : toucher une image vote aussitôt. À plusieurs réponses, on sélectionne puis
   « Voter ».
3. Programmé, le bouton affiche « Programmer » et une ligne au-dessus rappelle « Programmée pour le … ». Le libellé long
   « Programmer pour le … » ne tenait pas sur téléphone.
4. « Publiées » est le fil habituel (tout le monde) et « Programmées » ne montre que les tiennes.
5. Avec l'analyse IA active, un sondage avec images passe par l'équipe. L'autre option était d'analyser chaque image, soit
   jusqu'à 6 appels à l'IA par publication. Dis-moi si tu préfères cette option.
6. À l'envoi, une heure programmée a 9 minutes de marge (comme la base) : choisie à 10 minutes, elle reste valable une
   minute de plus.

## Petits points notés pour plus tard

- Une programmée encore en attente de vérification ne montre que « Programmée pour le … ».
- Depuis l'onglet « Programmées », publier tout de suite annonce « Elle apparaît dans l'espace … » au lieu de renvoyer
  vers « Publiées ».
- L'équipe peut commenter ou aimer une programmée avant son heure (l'écran ne le propose pas). L'auteur ou l'équipe peut
  répondre à son propre quiz.
- **Modération** :
  - la file ne montre pas les options du sondage ;
  - une programmée en attente y passe en dernier ;
  - si l'équipe garde une programmée avant son heure, le message envoyé à l'auteur dit « mise en ligne ».
- La fenêtre « Programmer » dit « vous seul la voyez », alors que l'équipe la voit aussi.
