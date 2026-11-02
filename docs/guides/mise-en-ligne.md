# Mettre Étudium en ligne, pas à pas

Ce guide met la plateforme sur **https://etudium.online**, avec une base de production toute neuve. Tu fais les manipulations dans les tableaux de bord et tu saisis toi-même chaque clé secrète. Ne m'envoie jamais une clé, un mot de passe ou un jeton : je n'en ai pas besoin.

Ce qui est déjà prêt dans le code : les migrations regroupées en 5 fichiers (`web/supabase/production/`), les trois parcours de base, les en-têtes de sécurité, `robots.txt` et le plan du site, l'envoi quotidien des e-mails en attente, les vraies pages Conditions et Confidentialité, le bouton « Activer les envois ».

Ta base de test (`etudium-dev`) ne change pas : ton application locale continue de s'en servir.

Compte environ **3 heures**, en plusieurs fois si tu veux. L'ordre compte.

---

## 0. Avant de commencer

Il te faut un compte sur : **GitHub**, **Supabase**, **Vercel**, **Resend**, **Google Cloud** (pour « Continuer avec Google »), **Payiz** (compte marchand validé, clé `sk_live`), et l'accès aux **DNS** de `etudium.online` chez ton registraire (là où tu as acheté le domaine).

**Les offres gratuites, que tu as choisies pour commencer :**
- **Supabase Free** : le projet se met en pause après 7 jours sans aucune visite, et il n'a pas de sauvegarde automatique. Quotas : 500 Mo de base, 1 Go de fichiers.
- **Vercel Hobby** : ses conditions le réservent à un usage non commercial, or Étudium vend des abonnements ; et une seule tâche planifiée par jour.
- **Dès que des abonnés paient**, passe Supabase en **Pro** (sauvegardes, pas de pause) et Vercel en **Pro**. Rien à changer dans le code.

---

## 1. GitHub : le dépôt du code, 5 minutes

1. Sur github.com : **New repository** → nom `etudium` → **Private** → ne coche rien (ni README, ni .gitignore) → **Create repository**.
2. Envoie-moi l'adresse du dépôt (par exemple `https://github.com/ton-compte/etudium`). Ce n'est pas un secret.
3. J'y envoie le code : la branche de travail devient `main`. Une fenêtre GitHub peut s'ouvrir sur ton ordinateur pour autoriser l'envoi : accepte-la.

---

## 2. Supabase : la base de production, 30 minutes

### 2.1 Créer le projet
1. supabase.com → **New project** : nom `etudium`, plan **Free**, région **West EU (Paris)**.
2. **Database password** : clique sur **Generate a password** et garde-le dans ton gestionnaire de mots de passe. Il ne sert qu'à toi.
3. Attends que le projet soit prêt (2 minutes).

### 2.2 Activer les tâches planifiées
**Integrations → Cron → Enable** (ou **Database → Extensions** → `pg_cron` → activer). À faire **avant** l'étape suivante : sinon les 7 tâches planifiées (sessions live, publications programmées, abonnements, rappels…) ne sont pas créées.

### 2.3 Créer toutes les tables
**SQL Editor → New query**, puis, pour chaque fichier dans l'ordre :
1. ouvre `web/supabase/production/partie-1.sql` dans ton éditeur, sélectionne tout, copie ;
2. colle dans Supabase, clique **Run**, attends **Success** ;
3. recommence avec `partie-2.sql`, `partie-3.sql`, `partie-4.sql`, puis `partie-5.sql`.

Les messages « NOTICE » sont normaux. Un tableau affiche un `jeton_envois` après la partie 4 : **ignore-le**, les envois s'activent par un bouton (étape 9).

Si une partie s'arrête sur une **erreur** (en rouge), copie-moi seulement le message d'erreur : on corrige avant de continuer.

**Vérifier** : **Table Editor → parcours** montre 3 lignes (Réussite académique, Compétences digitales, Business), et **formules** 3 lignes (Basique, Standard, Premium).

### 2.4 Temps réel
**Project Settings → Realtime** (ou **Realtime → Settings**) : **désactive « Allow public access »** (guide « Ce qui te revient », §49.2).

### 2.5 Noter l'adresse et la clé publique
**Project Settings → API Keys** (et **Data API** pour l'URL) : note l'**URL du projet** (`https://xxxx.supabase.co`) et la **clé publique** (« publishable key », qui commence par `sb_publishable_`). Elles iront dans Vercel (étape 4). **Ne prends jamais la clé secrète** (`sb_secret_…`) : l'application refuse de démarrer avec.

### 2.6 Authentification
Suis le guide `brancher-la-connexion.md`, sections **2 à 6**, sur ce nouveau projet, avec ces valeurs :
- **§2 Adresses** : **Site URL** = `https://etudium.online` ; **Redirect URLs** = `https://etudium.online/**`. Pas de `localhost` sur ce projet.
- **§3 Inscription** : comme dans le guide (confirmation par e-mail, code à 6 chiffres valable 600 s, mot de passe de 8 caractères au moins, « Secure password change »).
- **§4 Modèles d'e-mails** : « Confirm sign up » et « Reset password », depuis `web/supabase/templates/`.
- **§5 SMTP Resend** : après l'étape 3 ci-dessous (il faut la clé Resend). Expéditeur : `no-reply@etudium.online`, nom « Étudium ».
- **§6 Limites** : relève **« Rate limit for sending emails »** à **100 par heure** au moins (le défaut de 30 suffit pour des essais, pas pour une ouverture).
- **Google (§7)** : à l'étape 6.

---

## 3. Resend : les e-mails depuis etudium.online, 20 minutes (+ délai DNS)

1. resend.com → **Domains → Add domain** → `etudium.online` → région **Ireland (eu-west-1)**.
2. Resend affiche des enregistrements DNS (TXT pour SPF et DKIM, MX pour les retours) : ajoute-les **exactement** chez ton registraire (étape 5 si tu préfères tout faire d'un coup). Clique **Verify** ; la vérification prend de quelques minutes à quelques heures.
3. **API Keys → Create API Key** : nom « Étudium production », permission **Sending access**, domaine `etudium.online`. Copie-la (elle ne s'affiche qu'une fois).
4. Cette même clé sert deux fois : dans Supabase (§2.6, SMTP, comme mot de passe) et dans Vercel (`RESEND_API_KEY`).

Tant que le domaine n'est pas vérifié, les e-mails ne partent que vers l'adresse de ton compte Resend.

---

## 4. Vercel : le site, 30 minutes

### 4.1 Importer le projet
1. vercel.com → **Add New → Project** → relie ton compte GitHub → choisis le dépôt `etudium` → **Import**.
2. **Root Directory** : clique **Edit** → choisis **`web`**. Framework : **Next.js** (détecté seul).
3. **Node.js Version** (Settings → General, après l'import si l'écran ne la propose pas) : **24.x**.

### 4.2 Les variables
Avant le premier déploiement, ouvre **Environment Variables** et ajoute, une par une. Colonne « Où » : **P** = Production seulement ; **P+A** = Production et Preview.

| Variable | Valeur | Où |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | l'URL du projet de production (§2.5) | P+A |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la clé publique `sb_publishable_…` (§2.5) | P+A |
| `NEXT_PUBLIC_SITE_URL` | `https://etudium.online` | P |
| `RESEND_API_KEY` | la clé Resend (§3) | P |
| `EMAIL_EXPEDITEUR` | `Étudium <equipe@etudium.online>` | P |
| `EMAIL_REPONSE` | `contact@etudium.online` | P |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | clé publique VAPID (voir ci-dessous) | P |
| `VAPID_PRIVATE_KEY` | clé privée VAPID | P |
| `VAPID_SUJET` | `mailto:contact@etudium.online` | P |
| `PAYIZ_CLE_SECRETE` | ta clé Payiz `sk_live_…` | P |
| `PAYIZ_SECRET_WEBHOOK` | à l'étape 8 (laisse vide pour l'instant) | P |
| `CRON_SECRET` | une longue suite au hasard (voir ci-dessous) | P |

**Les clés VAPID** (notifications push), à générer une seule fois sur ton ordinateur, dans un terminal ouvert dans le dossier `web` :
```bash
npx web-push generate-vapid-keys
```
Copie « Public Key » dans `NEXT_PUBLIC_VAPID_PUBLIC_KEY` et « Private Key » dans `VAPID_PRIVATE_KEY`. Ne les change plus ensuite : changer de clés désabonne tous les téléphones.

**`CRON_SECRET`** (protège l'envoi quotidien des e-mails en attente), à générer de la même façon :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Les secrets restent en **Production seulement** : ainsi, une version de prévisualisation n'utilise jamais la vraie clé Payiz. La modération (`ANTHROPIC_API_KEY`, `MODERATION_JETON`) viendra après l'ouverture (guide « Ce qui te revient », §25).

### 4.3 Premier déploiement
Clique **Deploy**. Le build prend 3 à 5 minutes. S'il échoue, copie-moi les dernières lignes rouges du journal (Deployments → le déploiement → Building). Un message qui parle de `NEXT_PUBLIC_SITE_URL` veut dire que la variable manque ou ne commence pas par `https://`.

### 4.4 Le domaine
**Settings → Domains → Add** → `etudium.online`, puis ajoute aussi `www.etudium.online` en le **redirigeant** vers `etudium.online`. Vercel affiche les enregistrements DNS à créer : recopie **exactement ceux qu'il affiche** chez ton registraire (étape 5). Le cadenas HTTPS arrive seul quelques minutes après.

Le calculateur (`calculateur.etudium.online`) n'est pas touché : ne supprime pas son enregistrement DNS.

---

## 5. Chez ton registraire : les DNS, 15 minutes (+ délai de propagation)

Dans la zone DNS de `etudium.online`, ajoute :
- les enregistrements demandés par **Vercel** (§4.4) pour `etudium.online` et `www` ;
- ceux demandés par **Resend** (§3).

Garde ceux qui existent déjà (calculateur, messagerie de `contact@etudium.online`). La propagation prend de quelques minutes à 24 heures. Quand Vercel affiche « Valid Configuration » et Resend « Verified », tu peux continuer.

**`contact@etudium.online`** : les pages Conditions et Confidentialité l'affichent. Crée cette boîte (ou une redirection vers ta messagerie) chez ton fournisseur de messagerie, si ce n'est pas déjà fait.

---

## 6. Google : « Continuer avec Google », 20 minutes

Suis `brancher-la-connexion.md` §7, avec ces valeurs :
- **Authorized JavaScript origins** : `https://etudium.online`.
- **Authorized redirect URIs** : la **Callback URL** du **nouveau** projet Supabase (Authentication → Sign In / Providers → Google, elle finit par `/auth/v1/callback`).
- Colle le **Client ID** et le **Client secret** dans Supabase (Google → Enable).
- **OAuth consent screen** : nom « Étudium », e-mail d'assistance, logo, domaine autorisé `etudium.online`, page d'accueil `https://etudium.online`, confidentialité `https://etudium.online/confidentialite`, conditions `https://etudium.online/conditions`. Puis **Publish app** (« In production ») : sinon seuls les comptes de test peuvent se connecter avec Google.

Tu peux utiliser le même projet Google que pour les essais, en ajoutant ces adresses, ou en créer un nouveau.

---

## 7. Ton compte super admin, 5 minutes

1. Ouvre **https://etudium.online/inscription** et crée ton compte (e-mail ou Google). Avec l'e-mail, le code à 6 chiffres doit arriver (sinon : Resend pas encore vérifié, ou SMTP mal saisi).
2. Dans Supabase (production) → **SQL Editor** : la requête « Devenir super-administrateur » de `brancher-la-connexion.md` §8, avec ton adresse.
3. Recharge le site : le menu montre le **Back-office**.

Ensuite, au back-office › Utilisateurs, donne leurs rôles aux autres membres de l'équipe et aux formateurs (après leur inscription).

---

## 8. Payiz : les paiements réels, 20 minutes

1. Dans ton compte Payiz : active le **paiement direct**, et vérifie que tu es bien en clé **`sk_live_`** (compte marchand validé).
2. **Webhook** : adresse `https://etudium.online/api/paiements/payiz`, événements `payment.succeeded`, `payment.attempt_failed`, `payment.expired`, `payment.canceled`. Copie son **secret** dans Vercel (`PAYIZ_SECRET_WEBHOOK`, Production), puis **Deployments → ⋯ → Redeploy**.
3. Back-office › **Abonnements et paiements** : fixe le **prix** des trois formules (1 000 FCFA au moins), puis **Activer les paiements**.
4. **Essai réel** avec ton propre numéro sur la formule la moins chère : le paiement passe, l'abonnement s'ouvre, le reçu apparaît. Rembourse-toi ensuite depuis Payiz si tu veux, puis annule l'abonnement au back-office (Utilisateurs → ton compte).

Les détails (unité du montant, codes promo) sont dans « Ce qui te revient », §56.

---

## 9. Les envois : e-mails et notifications, 5 minutes

Les variables Resend et VAPID sont dans Vercel (§4.2) et le site a été redéployé depuis.
1. Back-office › **Abonnements et paiements** : le bloc **« Envois (e-mails et notifications push) »** dit « À activer ».
2. Clique **Activer les envois** : il passe à **« Actifs »**. Aucun jeton à recopier.
3. Si tu changes un jour la clé Resend, le bloc repasse à « À activer » : reclique.

---

## 10. Le contenu, à ton rythme

Back-office › **Formateurs** (fiches, réseaux), **Formations** (création, modules, leçons, quiz, exercices, couverture), **Publier**. Les trois parcours existent déjà. L'annonce de la communauté se règle dans back-office › Communauté.

---

## 11. Les vérifications d'ouverture, 30 minutes

Sur ordinateur **et** sur téléphone :
- [ ] https://etudium.online s'ouvre avec le cadenas ; `www.etudium.online` y redirige.
- [ ] Inscription par e-mail : le code arrive, depuis `no-reply@etudium.online`.
- [ ] « Mot de passe oublié » : le lien arrive et mène à « Nouveau mot de passe » sur etudium.online.
- [ ] « Continuer avec Google » fonctionne avec un compte qui n'est pas de test.
- [ ] Catalogue, fiche d'une formation, « S'inscrire à ce cours », une leçon, un quiz.
- [ ] Un paiement réel (étape 8) ouvre l'abonnement.
- [ ] Un certificat : son QR Code mène à `https://etudium.online/…` (et pas à localhost).
- [ ] Profil → notifications push activées sur ton téléphone, puis une notification reçue.
- [ ] Sur téléphone : « Ajouter à l'écran d'accueil » installe l'application.
- [ ] https://etudium.online/robots.txt et https://etudium.online/sitemap.xml s'affichent.
- [ ] Les pages Conditions et Confidentialité (relis-les : voir « À relire » dans le bilan).

---

## 12. Après l'ouverture

- **Modération IA** : « Ce qui te revient », §25, avec ces deux variables dans Vercel (Production), puis Redeploy.
- **Offres payantes** Supabase Pro et Vercel Pro dès les premiers abonnés.
- **Sauvegardes** : l'offre Free n'en fait aucune. Tant que tu y es, demande-moi de temps en temps un export de la base (je te donne la marche à suivre) ; l'offre Pro les fait chaque jour.
- **Mises à jour** : chaque fois que j'envoie du code sur `main`, Vercel redéploie seul. Quand une mise à jour contient une **nouvelle migration**, je te le dis : tu colles alors **ce seul fichier** (`web/supabase/migrations/00xx_….sql`) dans l'éditeur SQL de la production, avant ou juste après le déploiement selon ce que j'indique.
