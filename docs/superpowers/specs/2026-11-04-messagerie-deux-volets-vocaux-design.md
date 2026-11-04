# Messages et Groupes « comme WhatsApp », et les notes vocales

Date : 4 novembre 2026. Demande de l'utilisateur, captures à l'appui (la page Groupes, WhatsApp Web) :
- à gauche, la liste des conversations (ou des groupes) ;
- à droite, la conversation ouverte ;
- et la possibilité d'enregistrer et d'envoyer des **notes vocales**, dans les messages comme dans les groupes.

Fait en son absence (il est en cours) : les choix ci-dessous sont les miens, à corriger à son retour.

## 1. La mise en page en deux volets (Messages et Groupes, tous les espaces)
- **Sur ordinateur et tablette** : un seul grand panneau, à la hauteur de l'écran.
  - **Volet de gauche** (environ 360 px) : le titre (« Messages » ou « Groupes »), « Nouveau message » (Messages), une recherche par nom, puis la liste. La conversation ouverte y est surlignée.
  - **Volet de droite** : la conversation ouverte. Sinon, « Choisissez une conversation » (ou « un groupe »).
  - Chaque volet défile seul. Les messages s'affichent sur un fond légèrement teinté, les bulles des autres en blanc, les miennes en bleu.
- **Sur téléphone** (moins de 768 px) : la liste seule. Toucher une conversation l'ouvre en plein écran, avec une flèche de retour, comme WhatsApp. Le champ de saisie reste au-dessus du clavier.
- Les adresses ne changent pas (`/messages?c=…`, `/groupes/<groupe>`) : les notifications existantes mènent toujours au bon endroit.
- Dans les Groupes, la liste reste en place quand on passe d'un groupe à l'autre. C'est la mise en page commune aux deux routes (`layout`).

## 2. Les notes vocales
- **Enregistrer** :
  - quand le champ est vide, le bouton « Envoyer » devient un **micro** ;
  - un appui lance l'enregistrement (le navigateur demande la permission du micro la première fois) ;
  - pendant l'enregistrement : un point rouge, la durée, l'onde du son en direct, puis trois boutons, **Supprimer**, **Arrêter** (pour réécouter avant d'envoyer) et **Envoyer** ;
  - au bout de **5 minutes**, l'enregistrement s'arrête seul et attend « Envoyer ».
- **Écouter** : une bulle avec lecture/pause, l'onde de la note (sa partie lue en couleur), la durée, et la vitesse 1×, 1,5× ou 2×.
- **Ailleurs** :
  - la liste montre « 🎤 Note vocale (0:12) » ;
  - la réponse à une note la cite comme « Note vocale » ;
  - la notification d'un message privé dit « Note vocale ».
- **Règles** :
  - une note vocale ne porte pas de texte et ne se modifie pas ;
  - dans un groupe, elle se supprime, se signale et s'épingle comme un message ;
  - **10 Mo** et **5 minutes** au plus.
  - Le micro refusé ou absent : un message clair, et le reste fonctionne.
- **Formats** :
  - le navigateur enregistre en MP4/AAC s'il le sait (Safari, Chrome et Edge récents : lisible partout, iPhone compris) ;
  - sinon en WebM/Opus (Firefox) ;
  - la base n'accepte que des fichiers audio pour une note.
- **Modération** :
  - une note vocale n'est pas analysée par l'IA, qui ne lit que le texte et les images ;
  - un membre peut la signaler ;
  - l'équipe l'écoute depuis la file de modération (lien vers le fichier).

## 3. Technique
- **Migration 0076** :
  - messages privés : la note vocale est une pièce jointe audio (colonne `fichier`), plus sa durée et son onde (`duree_ms`, `ondes`) ;
  - groupes : même principe, dans les colonnes de la pièce jointe (l'actuelle `image`), avec les mêmes règles de lecture, de suppression et de retrait ;
  - `envoyer_message` et `envoyer_message_groupe` reçoivent la durée et l'onde ;
  - les espaces de fichiers « messages » et « groupes » acceptent les formats audio ;
  - guide « Ce qui te revient », section 75.
- Rien n'est mis en ligne avant que l'utilisateur ait appliqué la 0076.

## 4. Décisions prises pour l'utilisateur (à corriger s'il le souhaite)
1. Deux volets dès 768 px ; en dessous, une chose à la fois (liste ou conversation).
2. Micro à la place d'« Envoyer » quand le champ est vide (comme WhatsApp) ; un appui pour commencer, pas « maintenir appuyé ».
3. 5 minutes au plus par note ; réécoute possible avant l'envoi ; vitesses 1×, 1,5×, 2×.
4. Pas de texte avec une note vocale ; une note ne se modifie pas.
5. Pas d'analyse automatique des notes ; signalement possible.
