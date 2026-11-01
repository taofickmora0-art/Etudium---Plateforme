# Lot 5, étape B : notifications push et e-mails importants — spec (mise à jour)

- **Origine :** étape B de la spec `2026-10-15-lot-5-fin-messagerie-push-desactivation-design.md`, validée le 15 octobre 2026 (« C'est bon », 13 choix). Elle a été repoussée par la restructuration et le lot 2.
- **Décision du 1er novembre 2026 :** l'utilisateur, absent, a demandé d'enchaîner seul (« vas seul et après tu me fais le point »). Cette mise à jour garde les choix validés et ajoute ce que le lot 2 a fait naître :
  - le reçu de paiement et les rappels d'abonnement, « par le même système » (Q10) ;
  - les numéros de migration à jour.
- **Prochaine migration :** 0058 (l'étape C prendra 0059).

## 1. Ce qui ne change pas (spec du 15 octobre)

- **Push :**
  - service worker `public/sw.js` ;
  - interrupteur « Notifications push » du profil, avec autorisation du navigateur et enregistrement de l'appareil ;
  - appareils dans `appareils_push`, retirés tout seuls quand le service de push les déclare disparus ;
  - marche sur ordinateur en local, et sur téléphone une fois le site en https.
- **E-mails importants :** aux couleurs d'Étudium (titre, texte court, bouton vers la page, raison de l'envoi en pied de page), toujours envoyés (« Toujours actif » dans le profil), par Resend.
- **File d'envoi en base :** 3 essais, jamais deux serveurs sur le même envoi, abandon après 24 heures. Le serveur de l'appli vide la file après les actions et à chaque rafraîchissement de la cloche.
- **Sans les clés,** l'appli marche comme aujourd'hui ; le profil dit « Bientôt disponible » pour le push.

## 2. Ce qui est précisé

### 2.1 Quels e-mails

- **Abonnement et paiement** :
  - toute notification de la catégorie `expiration_renouvellement` (rappels 7 jours, veille, expiré) ;
  - toute notification de service qui mène à `/abonnement…` (abonnement attribué, annulé, résilié, paiement reçu).
- **Nouveau, « Paiement reçu »** : un paiement en ligne confirmé (ou un abonnement offert par un code à 100 %) crée maintenant une notification, donc un e-mail :
  - « Paiement reçu : votre abonnement Standard est actif » ;
  - texte « Jusqu’au 1er mai 2027. Votre reçu : ET-R-2026-000123. » ;
  - lien vers le reçu.
- **Compte suspendu :** un e-mail, car le compte ne voit plus l'appli. **Compte réactivé :** un e-mail (la notification existe déjà).
- **L'e-mail part même si la personne a coupé les notifications dans l'appli** : c'est le sens de « Toujours actif ».

### 2.2 Le push

- Le push suit les notifications de l'appli : chaque notification écrite pour un compte qui a un appareil enregistré (et qui n'a pas coupé « Notifications push ») part en push. Une catégorie coupée ou « Notifications dans l'appli » coupé : ni notification, ni push.
- **Contenu :** titre et texte de la notification, icône Étudium. Un clic ouvre la page de la notification ; si l'appli est déjà ouverte dans un onglet, elle y va.
- **Interrupteur du profil :**
  - activé : demande l'autorisation, abonne l'appareil, l'enregistre ;
  - désactivé : désabonne l'appareil et le retire ;
  - il dit pourquoi ça ne marche pas : autorisation refusée (« Autorisez les notifications pour Étudium dans les réglages du navigateur »), navigateur sans push, iPhone sans l'appli installée (« Sur iPhone, ajoutez d'abord Étudium à l'écran d'accueil ») ;
  - sans clé publique VAPID : « Bientôt disponible », interrupteur désactivé.

### 2.3 Le jeton de la file

- Comme pour la modération : **la migration 0058 génère un jeton et l'affiche une fois** dans l'éditeur SQL. La base n'en garde que l'empreinte SHA-256. Tu le recopies dans `web/.env.local` (`ENVOIS_JETON`).
- Perdu : `select public.nouveau_jeton_envois();` dans l'éditeur SQL en génère un autre (l'ancien ne marche plus).

### 2.4 Côté base (migration 0058)

- **`appareils_push`** : compte, adresse du service de push (unique), clés de chiffrement, créé le, vu le. Le compte enregistre ou retire ses appareils par fonctions (10 appareils au plus par compte).
- **`envois`** :
  - canal (`push` ou `email`), destinataire, titre, texte, lien ;
  - statut (`a_envoyer`, `envoye`, `abandonne`), essais, prochain essai, pris le, erreur, créé le.
- **`reglages_envois`** : l'empreinte du jeton.
- **`notifier` (définition de 0036) :** met aussi l'e-mail dans la file pour une notification importante (§2.1), avant les filtres de préférences.
- **Un déclencheur après chaque ajout dans `notifications`** met le push dans la file (§2.2).
- **Déclencheurs :**
  - sur `abonnements` (paiement en ligne ou code), la notification « Paiement reçu » ;
  - sur `suspensions` (suspension, réactivation), les e-mails.
- **Fonctions du serveur, avec le jeton :**
  - `prendre_envois(jeton, limite)` :
    - abandonne d'abord ce qui a plus de 24 heures ;
    - prend ensuite au plus `limite` envois prêts, `for update skip locked`, réservés 2 minutes ;
    - rend pour chacun l'adresse e-mail du compte ou ses appareils ;
  - `terminer_envoi(jeton, id, reussi, erreur, appareils_disparus)` : envoyé, ou nouvel essai dans 1, 5 puis 15 minutes, puis abandonné après 3 essais ; les appareils disparus sont retirés.
- **Purge :** une tâche pg_cron quotidienne efface les envois de plus de 7 jours.

### 2.5 Côté application

- **`src/lib/envois/`** :
  - `config` : lit les clés, dont aucune n'est préfixée `NEXT_PUBLIC_` sauf la clé publique VAPID ;
  - `email` : le modèle HTML et le texte brut, avec échappement de tout ce qui vient de la base, et un lien absolu (`NEXT_PUBLIC_SITE_URL`) ;
  - `push` : l'envoi chiffré, avec la bibliothèque `web-push` ;
  - `resend` : un appel `fetch` à l'API Resend, sans bibliothèque ;
  - `file` : `viderFile()`, qui prend, envoie et termine ; il ne fait rien sans jeton, et laisse de côté le canal dont les clés manquent.
- **Quand la file se vide :**
  - après la réponse (`after()` de Next.js) au chargement de la cloche (chaque minute pour un compte connecté) ;
  - après l'envoi d'un message ;
  - après une publication de l'équipe (annonce).
- **`public/sw.js`**, et `src/lib/envois/abonnement-push.ts` côté navigateur (s'abonner, se désabonner).

## 3. Ce qui te revient

1. Appliquer la migration **0058** et **recopier le jeton affiché** dans `web/.env.local` : `ENVOIS_JETON=…`.
2. **Push :**
   - générer les clés avec `npx web-push generate-vapid-keys` (dans `web/`) ;
   - recopier `NEXT_PUBLIC_VAPID_PUBLIC_KEY=…`, `VAPID_PRIVATE_KEY=…` et `VAPID_SUJET=mailto:ton-adresse`.
3. **E-mails :**
   - créer une clé d'API Resend (ton compte sert déjà au SMTP de Supabase) ;
   - recopier `RESEND_API_KEY=…` et `EMAIL_EXPEDITEUR=Étudium <onboarding@resend.dev>` ;
   - sans domaine vérifié, Resend n'envoie qu'à ton adresse : assez pour tester.
4. Redémarrer le serveur, puis tester :
   - activer le push dans le profil ;
   - recevoir une notification (un message, une annonce) ;
   - attribuer un abonnement à ton compte de test : l'e-mail arrive.

## 4. Tests

- **Base :**
  - la file : e-mail pour une notification importante même si l'appli est coupée ; push seulement avec un appareil ;
  - le jeton ;
  - `skip locked` et la réservation ;
  - les nouveaux essais puis l'abandon ;
  - les appareils disparus ;
  - « Paiement reçu » ;
  - les e-mails de suspension et de réactivation ;
  - les droits sur les appareils.
- **Application :**
  - le modèle d'e-mail (échappement, lien absolu) ;
  - `viderFile` (clés absentes, réussite, échec, appareil disparu) ;
  - l'interrupteur push (« Bientôt disponible », refus, abonnement, désabonnement) ;
  - le service worker (affichage et clic, testés comme module).
