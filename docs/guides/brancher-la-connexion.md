# Brancher la connexion (tâche 0.4)

L’inscription, la connexion, le code reçu par e-mail, le mot de passe oublié et Google sont codés et testés. Il reste à régler ton projet Supabase `etudium-dev` pour qu’ils fonctionnent pour de vrai. Tout se fait dans des tableaux de bord, par toi : **aucune clé, aucun mot de passe ne passe par moi**.

Compte une heure en tout, dont une bonne partie pour Google. Tu peux t’arrêter entre deux étapes : l’application continue de fonctionner.

> **Avant de commencer** : la base `etudium-dev` doit exister et `web/.env.local` doit être rempli (guide « Ce qui te revient », point 1). Lance l’application (`npm --prefix web run dev`) et ouvre http://localhost:3000/etat : tu dois lire **« Base connectée »**.
>
> Dès que la base est branchée, l’espace connecté demande un compte : http://localhost:3000 t’envoie sur la page de connexion. C’est normal.

Les noms des menus de Supabase et de Google changent parfois un peu. Si un écran ne ressemble pas à ce qui est décrit, envoie-moi une capture : je te dis où cliquer.

---

## 1. Créer les tables des comptes, 5 minutes

1. Dans le projet, ouvre le fichier `web/supabase/migrations/0001_profils_roles.sql` avec le Bloc-notes, sélectionne tout (**Ctrl+A**) et copie (**Ctrl+C**).
2. Dans Supabase : **SQL Editor** (menu de gauche) → **New query**.
3. Colle (**Ctrl+V**), puis **Run**. Le résultat attendu est **« Success. No rows returned »**.
4. Vérifie dans **Table Editor** : deux tables, **profils** et **roles**, toutes deux vides. Dans **Storage**, un espace **photos-profil** est apparu (il servira à la photo de profil).
5. Recommence les étapes 1 à 3 avec le second fichier, `web/supabase/migrations/0002_profil.sql` (page « Mon profil », tâche 0.5) : **New query**, coller, **Run**, même résultat attendu. Il règle ce que chacun peut modifier dans son profil, rend les photos affichables et permet de supprimer son compte.

Ces tables se remplissent toutes seules : chaque nouveau compte reçoit son profil (prénom, nom) et le rôle « étudiant ».

---

## 2. Adresses autorisées, 2 minutes

**Authentication → URL Configuration** :

- **Site URL** : `http://localhost:3000`
- **Redirect URLs** → **Add URL** : `http://localhost:3000/**`

Sans cette adresse, le retour de Google et le lien « mot de passe oublié » sont refusés. On changera ces deux réglages pour l’adresse définitive quand le site sera mis en ligne.

---

## 3. Inscription par e-mail, 3 minutes

**Authentication → Sign In / Providers** :

1. Dans la partie des inscriptions (*User Signups*) : **Allow new users to sign up** activé, **Confirm email** activé.
2. Ouvre le fournisseur **Email** :
   - **Minimum password length** : `8`
   - **Email OTP Expiration** : `600` (secondes, soit 10 minutes ; ce réglage vaut aussi pour le lien « mot de passe oublié »)
   - **Email OTP Length** : `6` (l’écran de l’application attend un code à 6 chiffres)
   - **Secure password change** : activé (pour changer de mot de passe hors du lien « mot de passe oublié », Supabase exigera une connexion récente)
3. **Save**.

---

## 4. Les e-mails en français, 5 minutes

**Authentication → Emails**, onglet des modèles (*Templates*). Remplace deux modèles. Copie les textes ci-dessous **tels quels**, accolades comprises.

### « Confirm sign up » (le code d’inscription)

Sujet :

```
Votre code Étudium
```

Contenu :

```html
<h2>Bienvenue sur Étudium</h2>
<p>Voici votre code pour activer votre compte :</p>
<p style="font-size:30px;font-weight:600;letter-spacing:6px;margin:24px 0">{{ .Token }}</p>
<p>Ce code expire dans 10 minutes.</p>
<p>Si vous n’avez pas créé de compte sur Étudium, ignorez cet e-mail.</p>
```

### « Reset password » (le lien « mot de passe oublié »)

Sujet :

```
Choisir un nouveau mot de passe Étudium
```

Contenu :

```html
<h2>Nouveau mot de passe</h2>
<p>Vous avez demandé à changer le mot de passe de votre compte Étudium.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nouveau-mot-de-passe">Choisir un nouveau mot de passe</a></p>
<p>Ce lien expire dans 10 minutes et ne sert qu’une fois.</p>
<p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe ne change pas.</p>
```

**Save** après chaque modèle. Les autres modèles ne servent pas pour l’instant.

---

## 5. Envoyer les e-mails avec Resend, 15 minutes

Le service d’e-mails inclus dans Supabase n’écrit **qu’aux membres de ton équipe Supabase**, et seulement deux fois par heure. Pour tes premiers essais avec ta propre adresse, il suffit. Pour que n’importe qui puisse s’inscrire, il faut Resend.

### Côté Resend

1. Crée un compte sur https://resend.com (active la double authentification).
2. **Domains → Add domain** : ton domaine (par exemple `etudium.com`, ou un sous-domaine comme `mail.etudium.com`). Resend affiche des enregistrements DNS à ajouter chez l’hébergeur de ton domaine, puis **Verify**. La vérification peut prendre de quelques minutes à quelques heures.
   - Pas encore de domaine ? Saute cette étape : Resend permet d’écrire depuis `onboarding@resend.dev`, mais **seulement à l’adresse de ton compte Resend**. C’est suffisant pour tester.
3. **API Keys → Create API Key** : nom `supabase-etudium-dev`, permission **Sending access**. Copie la clé (elle commence par `re_`). Elle ne s’affiche qu’une fois.

### Côté Supabase

**Authentication → Emails**, onglet **SMTP Settings** → **Enable Custom SMTP** :

| Champ | Valeur |
| --- | --- |
| Sender email | `no-reply@ton-domaine` (ou `onboarding@resend.dev` pour tester) |
| Sender name | `Étudium` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la clé `re_…` que tu viens de copier |

**Save**. La clé reste dans Supabase : ne me l’envoie pas et ne la colle nulle part ailleurs.

---

## 6. Délai entre deux e-mails, 1 minute

L’écran du code propose « Renvoyer le code » au bout de **45 secondes**. Supabase doit accepter ce délai.

**Authentication → Rate Limits** : règle l’intervalle minimum entre deux e-mails envoyés à la même personne sur **45 secondes**. Selon la version du tableau de bord, ce réglage s’appelle aussi *Minimum interval between emails* et peut se trouver dans **SMTP Settings**. Profites-en pour regarder le nombre d’e-mails par heure : 30 par défaut, c’est assez pour les essais.

Si tu ne trouves pas ce réglage, laisse 60 secondes et dis-le-moi : je règle l’écran sur 60.

---

## 7. Se connecter avec Google, 20 minutes

### Côté Google

1. Va sur https://console.cloud.google.com avec ton compte Google, et crée un projet `Etudium`.
2. Ouvre **Google Auth Platform** (cherche-le dans la barre de recherche en haut), puis **Get started** :
   - **Branding** : nom de l’application `Étudium`, ton adresse comme e-mail d’assistance et comme contact.
   - **Audience** : **External**. Tant que l’application est « en test », seules les adresses ajoutées dans **Test users** peuvent se connecter : ajoute la tienne.
   - **Data Access** : ajoute le champ d’accès `openid` (e-mail et profil y sont déjà).
3. **Clients → Create client** :
   - Type : **Web application**, nom `Étudium (local)`.
   - **Authorized JavaScript origins** : `http://localhost:3000`
   - **Authorized redirect URIs** : l’adresse de retour de Supabase. Tu la trouves dans Supabase, **Authentication → Sign In / Providers → Google**, champ **Callback URL**. Elle ressemble à `https://xxxx.supabase.co/auth/v1/callback`.
   - **Create**. Google affiche un **Client ID** et un **Client secret**.

### Côté Supabase

**Authentication → Sign In / Providers → Google** : active le fournisseur, colle le **Client ID** et le **Client secret**, puis **Save**.

Le secret reste dans Supabase : ne me l’envoie pas.

---

## 8. Vérifier que tout marche, 10 minutes

Relance l’application si elle tournait déjà (**Ctrl+C**, puis `npm --prefix web run dev`).

1. http://localhost:3000/etat → **« Base connectée »**.
2. http://localhost:3000 → la page **Connexion** s’ouvre.
3. **Créer un compte** avec ton e-mail : prénom, nom, mot de passe d’au moins 8 caractères, conditions cochées.
4. Tu reçois **un code à 6 chiffres** : saisis-le. Tu arrives sur l’accueil, qui dit **« Bonjour, [ton prénom] »**.
5. Dans Supabase, **Table Editor → profils** : ta ligne, avec ton prénom et ton nom. **roles** : une ligne `etudiant`.
6. Rond de profil (ou onglet « Profil » sur téléphone) → **Se déconnecter** → tu reviens sur la connexion.
7. **Mot de passe oublié ?** → ton e-mail → tu reçois un lien → il ouvre « Nouveau mot de passe » → enregistre → tu arrives sur l’accueil. Déconnecte-toi, puis reconnecte-toi avec le nouveau mot de passe.
8. **Continuer avec Google** → choisis ton compte → tu arrives sur l’accueil.
9. Connecte-toi en **décochant** « Se souvenir de moi », ferme complètement le navigateur et rouvre http://localhost:3000/accueil : il faut se reconnecter. (Si ton navigateur est réglé pour rouvrir les onglets là où tu les avais laissés, il garde la session : c’est un réglage du navigateur, pas de l’application.)

### Devenir super-administrateur (tâche 0.6)

Ton compte doit avoir été créé (étape 8). Ensuite : **SQL Editor → New query**, remplace l’adresse par la tienne (majuscules ou minuscules, peu importe), puis **Run** :

```sql
insert into public.roles (profil_id, role)
select id, 'super_admin'::public.role_etudium
from auth.users
where lower(email) = lower('ton.adresse@exemple.com')
on conflict do nothing
returning profil_id, role;
```

**Ce que tu dois voir :** une ligne dans le tableau des résultats, avec `super_admin` dans la colonne `role`.

Si Supabase répond **« Success. No rows returned »**, rien n’a été ajouté : soit l’adresse ne correspond à aucun compte (vérifie-la), soit tu avais déjà ce rôle. Pour en avoir le cœur net, cette requête liste tous les rôles donnés :

```sql
select u.email, r.role
from public.roles r
join auth.users u on u.id = r.profil_id
order by 1;
```

Recharge ensuite la page de l’application : le menu du profil montre **« Espace formateur »** et **« Back-office »**.

Jusqu’au back-office (lot 6), les rôles se donnent ici, dans l’éditeur SQL. Depuis l’application, la base refuse à quiconque n’est pas super-administrateur d’attribuer ou de retirer un rôle.

**Valider la tâche 0.6 :**

1. Déconnecte-toi (ou ouvre une fenêtre de navigation privée), puis crée un second compte, étudiant, avec une autre adresse (une adresse de ton équipe Supabase tant que Resend n’est pas branché).
2. Avec ce compte, tape http://localhost:3000/admin : après un court instant, tu reviens sur l’accueil, et le menu du profil ne montre ni « Espace formateur » ni « Back-office ».
3. Avec ton compte : `/admin` et `/formateur` s’ouvrent, et le menu du profil coche l’espace où tu te trouves.

---

## Si quelque chose coince

| Ce que tu vois | Ce qu’il faut faire |
| --- | --- |
| « Email address not authorized » dans les journaux de Supabase, pas d’e-mail reçu | Le service d’e-mails inclus n’écrit qu’aux membres de l’équipe : termine l’étape 5 (Resend). |
| Le code reçu a 8 chiffres | Étape 3 : **Email OTP Length** sur `6`. |
| L’e-mail d’inscription contient un lien au lieu d’un code | Étape 4 : le modèle « Confirm sign up » n’a pas été enregistré. |
| Le lien « mot de passe oublié » mène à « Ce lien a expiré » | Le lien a plus de 10 minutes ou a déjà servi, ou tu as mis plus de 15 minutes à choisir le nouveau mot de passe : redemande-le. Si ça se répète, vérifie le modèle « Reset password » (étape 4) et la **Site URL** (étape 2). |
| « Trop de demandes. Patientez une minute, puis réessayez. » | La limite d’envoi de Supabase est atteinte : attends un peu (étape 6). |
| Google affiche « redirect_uri_mismatch » | L’adresse de retour copiée dans Google (étape 7) doit être **exactement** la *Callback URL* de Supabase. |
| Retour sur la connexion avec « La connexion avec Google n’a pas abouti » | Vérifie `http://localhost:3000/**` dans les **Redirect URLs** (étape 2). Si tu as fermé la fenêtre Google, recommence simplement. |
| Google refuse ton compte (« accès bloqué ») | Ajoute ton adresse dans **Audience → Test users** (étape 7). |
| La page `/etat` dit « Base non connectée » | Le projet est peut-être en pause (Supabase met en pause un projet gratuit inactif une semaine) : **Restore project** dans le tableau de bord. |

Quand tout passe, dis-le-moi : c’est la validation de la tâche 0.4.
