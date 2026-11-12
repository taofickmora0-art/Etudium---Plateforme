# SasPay en secours de Payiz

Date : 2026-11-12. Demande : « payiz ne prend pas en compte plusieurs pays d'Afrique, on va associer saspay.me pour
supporter les autres pays […] regarde le projet flashSMS ». Reprise de la conception de flashSMS
(`flashsms-projet/docs/superpowers/specs/2026-11-12-routage-paiement-design.md`), adaptée à Étudium.

## Objectif

- L'étudiant voit **une seule liste** de pays et d'opérateurs : l'union de Payiz et de SasPay.
- Un opérateur que Payiz encaisse part **chez Payiz** ; les autres, **chez SasPay**.
- **Invisible pour l'étudiant** : aucun écran, message ou donnée envoyée au navigateur ne nomme SasPay (ni Payiz).

Réussite : un étudiant d'un pays ou d'un opérateur que Payiz n'encaisse pas paie sans quitter Étudium (ou, pour Wave
et Orange Money, en validant sur la page de l'opérateur), et son abonnement s'active comme pour un paiement Payiz.

## Décisions

| Question | Décision |
|---|---|
| Granularité | Par opérateur (pays + opérateur), comme flashSMS. |
| Même opérateur chez les deux | Payiz d'abord ; même marque (`mtn` / `mtn_bj`) ou alias connu (Togocel/Yas…). |
| SasPay ne répond pas, clé absente, clé d'un autre mode que Payiz | Il ne contribue rien : la liste reste celle de Payiz. |
| Payiz ne répond pas | Liste = SasPay seul (s'il répond), sinon le repli d'aujourd'hui (Bénin, MTN, Moov). |
| Refus au lancement | L'erreur est affichée ; pas de relais automatique vers l'autre prestataire. |
| Wave, Orange Money (via SasPay) | Validation sur la page de l'opérateur : l'étudiant y est envoyé, puis revient sur « Mon abonnement ». |
| Orange Côte d'Ivoire, Orange Burkina (via SasPay) | Code de paiement généré d'avance (USSD) : un champ « Code de paiement », avec l'instruction. |
| Réseaux à code reçu APRÈS la demande (Wizall, Coris) | Pas proposés (étape non gérée), comme flashSMS. |
| Identifiant chez SasPay | Gardé dans `payiz_id` avec le préfixe `softpay:` (comme flashSMS) : pas de nom de prestataire dans les données. |
| Réessayer | Payiz → Payiz : nouvel essai sur le même paiement (inchangé). Sinon : nouvelle demande, autorisée seulement après un échec. |
| Notifications SasPay | `/api/paiements/saspay`, signature HMAC (`X-Webhook-Signature`, `X-Webhook-Timestamp`) ; elles déclenchent la relecture des paiements SasPay en attente. |
| Textes visibles | « Paiement sécurisé par Payiz » et « traité par Payiz » deviennent neutres ; CGU et confidentialité : « nos prestataires de paiement ». |

## Architecture

- `lib/paiements/saspay.ts` : client de l'API (softpay, verify, transactions, countries, networks, my-rates), catalogue
  écrit de flashSMS (réseaux par pays), signature des notifications. Clé : `SASPAY_CLE_SECRETE` ; secret des
  notifications : `SASPAY_SECRET_WEBHOOK` (facultatif).
- `lib/paiements/aiguillage.ts` (pur) : marque, alias, fusion des deux listes ; rend aussi le prestataire de chaque
  opérateur, gardé sur le serveur.
- `lib/paiements/moyens.ts` : `lireMoyensRoutes()` (liste + prestataire par opérateur, serveur seulement) ;
  `lireMoyensDePaiement()` n'en rend que la liste. SasPay gardé 1 h (10 min sans réponse).
- `lib/abonnement/actions.ts` : `payer` et `reessayer` aiguillent ; `suivrePaiement` et la resynchronisation relisent
  chez le bon prestataire (préfixe `softpay:`).
- Migration 0081 : `noter_essai` accepte un nouvel identifiant après un échec ; `paiements_softpay_en_attente(jeton)`
  pour les notifications.
- Back-office : « Encaissé par SasPay » et sa référence ; le réglage montre l'état de SasPay (clé, mode, pays).
- Guide §79 : clés dans Vercel, notification dans SasPay, nom du compte SasPay « Étudium ».

## Après la relecture (même jour)

- `noter_echec` reçoit la référence du paiement qui a échoué (0081) : un échec Payiz qui arrive en retard, après un
  réessai chez SasPay, ne touche plus la demande en cours (sinon : argent pris, abonnement jamais ouvert).
- Un réessai ne crée une nouvelle demande que si le paiement est « échoué » (jamais expiré ni annulé).
- Clés d'idempotence stables : empreinte de (essai d'avant, opérateur, numéro, code). Double clic, deux onglets ou
  nouveau « Payer » après une réponse perdue : SasPay rend la même demande, sans second débit.
- Pas de réponse de SasPay à temps : « La demande a peut-être été envoyée sur votre téléphone… ».
- Pays où les deux encaissent, sans opérateur choisi : il faut le choisir.
- Notifications : 500 si une relecture échoue (SasPay relance), sauf refus définitif de la base.
- Catalogue : 5 s par appel, réseaux et codes lus en même temps ; statuts EXPIRED, SKIPPED, REJECTED, DECLINED = échec.
- Accepté : la référence « softpay:… » part au navigateur (elle ne nomme pas SasPay) ; Payiz muet → ses pays passent
  chez SasPay le temps du repli (choix de flashSMS) ; un paiement repris dans les 3 minutes ne rouvre pas la page Wave.

## Tests

Aiguillage (fusion, alias, ordre, prestataire jamais dans la liste envoyée), client SasPay (corps envoyé, idempotence,
verdicts, signature), actions (aiguillage, code de paiement, redirection, réessai), route des notifications, migration
0081 sur le banc, écran (champ du code, redirection, textes neutres).
