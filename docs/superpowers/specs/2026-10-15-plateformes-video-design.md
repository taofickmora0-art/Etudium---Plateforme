# Vidéos des leçons : TikTok, Tella, Loom, ScreenPal et Google Drive

- **Origine :** demande du 15 octobre 2026 (« ce n'est pas forcément YouTube et Vimeo seuls… TikTok, Tella, Drive »),
  puis le choix de l'utilisateur : **Loom, ScreenPal, TikTok, Tella, Google Drive (sans mesure)**.
- **Consigne en vigueur :** avancer avec mes recommandations sans confirmation ; décisions présentées à la fin.

## 1. Deux familles de plateformes

La règle du seuil (« Terminer la leçon » quand 90 % de la vidéo est réellement regardé) demande que le lecteur de la
plateforme donne à notre page la position de lecture et la durée. Vérifié dans les documentations officielles :

| Plateforme | Ce que le lecteur donne | Famille |
|---|---|---|
| YouTube, Vimeo (déjà là) | position, durée, état | **mesurée** |
| TikTok (`tiktok.com/player/v1`, messages `x-tiktok-player`) | `onCurrentTime` (position, durée), `onStateChange` | **mesurée** |
| Tella (`tella.tv/video/…/embed`, messages) | `timeUpdate`, `playbackState` (position, durée, état) | **mesurée** |
| Loom, ScreenPal | rien de documenté | **sans mesure** |
| Google Drive (`/preview`) | rien | **sans mesure** |

- **Mesurée :** le lecteur Étudium (commandes, temps réellement regardé, seuil), la durée lue toute seule dans
  l'éditeur, « Terminer la leçon » grisé jusqu'au seuil.
- **Sans mesure :** le lecteur officiel de la plateforme, intégré tel quel ; la leçon se termine d'un clic (« Terminer
  la leçon », comme une leçon sans vidéo) ; la durée est facultative, saisie à la main (elle s'affiche aux étudiants).
  L'éditeur le dit : « Cette plateforme ne permet pas de mesurer le temps regardé : la leçon se terminera d'un clic. »
- **Google Drive :** l'éditeur rappelle de partager la vidéo avec « Tous les utilisateurs disposant du lien », et que
  Drive peut bloquer une vidéo trop regardée.

## 2. Les liens reconnus

| Plateforme | Liens acceptés | Identifiant gardé |
|---|---|---|
| TikTok | `tiktok.com/@nom/video/{n}`, `tiktok.com/player/v1/{n}`, `tiktok.com/embed/v2/{n}` | 15 à 21 chiffres |
| Tella | `tella.tv/video/{code}`, `…/embed` | lettres, chiffres, tirets (4 à 120) |
| Loom | `loom.com/share/{id}`, `loom.com/embed/{id}` | 32 caractères hexadécimaux |
| ScreenPal | `screenpal.com/watch/{id}`, `go.screenpal.com/watch|player/{id}`, `screencast-o-matic.com/watch/{id}` | 6 à 20 lettres et chiffres |
| Google Drive | `drive.google.com/file/d/{id}/…`, `drive.google.com/open?id={id}` | 20 à 80 caractères (lettres, chiffres, `-`, `_`) |

- Un lien court TikTok (`vm.tiktok.com/…`, `tiktok.com/t/…`) ne contient pas l'identifiant : « Lien court TikTok :
  ouvrez-le, puis copiez le lien complet de la vidéo (…/video/123…). »
- La base garde toujours le fournisseur et l'identifiant, jamais le lien collé (comme aujourd'hui).
- Les vidéos de la **communauté** (publications) ne changent pas.

## 3. Affichage

- TikTok est vertical : la vidéo garde son format (9:16), centrée, sans dépasser la hauteur de l'écran.
- Le lecteur Étudium cache les commandes de TikTok (paramètres `controls=0`…) ; Tella garde les siennes sous les nôtres.

## 4. La base (migration 0030)

- Le type `fournisseur_video` reçoit `tiktok`, `tella`, `loom`, `screenpal`, `drive` ; la contrainte
  `lecons_contenus_video` vérifie le format de chaque identifiant (tableau du §2).
- `terminer_lecon` accepte une leçon dont la vidéo est **sans mesure** ; `commencer_visionnage` et
  `enregistrer_visionnage` la refusent (rien à mesurer).

## 5. Hors champ

La durée des vidéos Loom ou ScreenPal lue automatiquement (aucune source documentée) ; les vidéos importées
directement sur Étudium (hébergement propre, lot ultérieur).
