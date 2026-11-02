# Mise en ligne d'Étudium

Date : 2026-11-02. Choix de l'utilisateur : adresse `etudium.online` ; offres gratuites pour commencer (Supabase Free, Vercel Hobby) ; base de production vide ; paiements Payiz réels dès l'ouverture ; modération IA branchée après. Déjà décidé (feuille de route) : Vercel, un projet Supabase séparé, Resend, GitHub.

Principe : je prépare le code, les fichiers SQL et un guide pas à pas (`docs/guides/mise-en-ligne.md`) ; l'utilisateur crée les comptes, saisit les secrets et fait les manipulations dans les tableaux de bord. Je ne vois jamais un secret.

## 1. Ce que le code doit faire avant l'ouverture

### 1.1 Migration 0071 « production »
- **Les trois parcours de base**, insérés s'ils n'existent pas (par adresse) : `reussite-academique` (académique), `competences-digitales` (digital), `business-revenus-en-ligne` (business), avec les textes et l'ordre de `exemples/lot-1.sql`. Rien n'est modifié s'ils existent déjà (base de test).
- **Le jeton des envois sans manipulation** (comme le paiement) : l'appli tire le jeton d'une clé qu'elle a déjà (HMAC-SHA256 de `RESEND_API_KEY`, à défaut de `VAPID_PRIVATE_KEY`, avec l'étiquette « etudium:jeton-des-envois ») ; un admin clique « Activer les envois » au back-office, ce qui enregistre l'empreinte en base ; un bloc dit si les envois sont « actifs », « à activer » ou « sans clé ». `ENVOIS_JETON` n'est plus lue. Fonctions : `enregistrer_jeton_envois(p_jeton)` (admin actif), `etat_envois(p_jeton)`.

### 1.2 Réglages de production
- `NEXT_PUBLIC_SITE_URL` exigée pour un build de production Vercel (`VERCEL_ENV=production`) : le build échoue avec un message clair si elle manque.
- En-têtes de sécurité sur toutes les pages : `X-Frame-Options: DENY` (et `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (caméra, micro, géolocalisation refusés), `Strict-Transport-Security` ; `poweredByHeader: false`. Pas de CSP complète au lancement (lecteurs vidéo, pdf.js, Supabase temps réel : à faire ensuite, en mode rapport d'abord).
- Cookies de session Supabase `secure` en production.
- `engines.node` ≥ 20.9 (Node 24 recommandé) ; `vercel.json` : fonctions à Paris (`cdg1`, près de la base) et une tâche planifiée quotidienne qui vide la file des envois (`/api/envois/vider`, protégée par `CRON_SECRET`), pour que les e-mails produits la nuit (rappels d'abonnement, séries) partent sans attendre une visite.
- `robots.txt` (tout permis sauf l'espace connecté, le back-office, l'espace formateur et les routes d'API) et `sitemap.xml` (accueil, formations, parcours, tarifs, fiches des formations publiées, profils des formateurs).
- `.env.example` complet et commenté (toutes les variables, publiques et secrètes, et où les mettre).

### 1.3 Les fichiers SQL de la production
- Un script `web/scripts/assembler-migrations.mjs` produit `web/supabase/production/` : les migrations 0001 à la dernière, regroupées en quelques fichiers à coller dans l'éditeur SQL dans l'ordre, chacun de taille raisonnable. Les exemples n'en font jamais partie.

### 1.4 Conditions et confidentialité
- Textes réels de `/conditions` et `/confidentialite`, à partir de ce que fait la plateforme : comptes, abonnements et paiements (Payiz, Mobile Money), données traitées et prestataires (Supabase, Vercel, Resend, Google pour la connexion, Anthropic pour la modération), cookies, durée de conservation, droits et contact. Les informations que seul l'utilisateur connaît (nom de la structure, adresse, e-mail de contact) sont demandées ; tant qu'il ne les a pas données, elles restent des champs visibles à compléter et le guide le rappelle avant l'ouverture.

## 2. Ce que fait l'utilisateur (guide pas à pas)

1. **GitHub** : créer un dépôt privé, y envoyer le code (`main` reçoit la branche de travail).
2. **Supabase** : nouveau projet `etudium` (Free, région Paris) ; activer Cron ; coller les fichiers de `supabase/production/` dans l'ordre ; Realtime sans accès public ; Authentication (Site URL `https://etudium.online`, Redirect URLs, inscription, modèles d'e-mails, SMTP Resend, limites relevées, Google) ; noter l'URL et la clé publique.
3. **Resend** : vérifier le domaine `etudium.online` (DNS), créer la clé API.
4. **Vercel** : importer le dépôt, dossier racine `web`, Node 24 ; variables (publiques et secrètes, secrets en Production seulement) ; premier déploiement ; ajouter le domaine `etudium.online` (DNS chez le registraire).
5. **Google** : origines et redirection du nouveau projet ; passer l'application en production (pages conditions et confidentialité).
6. **Premier compte** : s'inscrire, devenir super admin (requête SQL), créer les formateurs et les formations.
7. **Payiz** : clé `sk_live`, webhook `https://etudium.online/api/paiements/payiz` et son secret, prix des formules, « Activer les paiements ».
8. **Envois** : clés VAPID et Resend dans Vercel, redéployer, « Activer les envois ».
9. **Vérifications d'ouverture** (liste courte).

## 3. Limites connues des offres gratuites (rappelées dans le guide)
- Supabase Free : pause après 7 jours sans activité, pas de sauvegarde automatique ; quotas (base 500 Mo, fichiers 1 Go). → passer en Pro dès que des abonnés paient.
- Vercel Hobby : réservé à l'usage non commercial ; tâches planifiées une fois par jour au plus. → passer en Pro.

## 4. Hors de cette étape
- Modération IA (après l'ouverture, guide §25).
- CSP complète, déploiement automatique des migrations depuis GitHub, sauvegardes : après l'ouverture.
