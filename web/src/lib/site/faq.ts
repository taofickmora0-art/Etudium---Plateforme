// Questions fréquentes (NdLanding, annexe 1.12 §14.3) : sur la landing et sur la page Aide, textes du design tels quels.

export const QUESTIONS_FREQUENTES: { question: string; reponse: string }[] = [
  {
    question: "Le compte gratuit est-il vraiment gratuit ?",
    reponse:
      "Oui. Il donne accès aux formations gratuites, au catalogue, à votre progression, à vos certificats et à la communauté générale en lecture. Vous choisissez une formule payante seulement si vous le souhaitez.",
  },
  {
    question: "Comment payer mon abonnement ?",
    reponse: "Par Mobile Money, depuis votre téléphone. Votre accès est activé automatiquement dès que le paiement est confirmé.",
  },
  {
    question: "Le renouvellement est-il automatique ?",
    reponse: "Non. Vous recevez des rappels avant l’expiration et vous renouvelez quand vous le décidez. Aucun prélèvement automatique.",
  },
  {
    question: "Puis-je changer de parcours ?",
    reponse: "Vos parcours restent les mêmes pendant la période d’abonnement. À chaque renouvellement, vous pouvez en choisir de nouveaux.",
  },
  {
    question: "Que se passe-t-il quand mon abonnement expire ?",
    reponse:
      "Vos formations sont verrouillées mais rien n’est supprimé : votre progression, vos formations complémentaires et vos certificats restent sur votre compte. Tout redevient accessible dès que vous renouvelez.",
  },
  {
    question: "Comment un recruteur vérifie-t-il mon certificat ?",
    reponse:
      "Chaque certificat porte un identifiant unique et un QR Code. En le scannant, n’importe qui accède à une page publique de vérification, sans créer de compte.",
  },
  {
    question: "Puis-je suivre les formations sur mon téléphone ?",
    reponse: "Oui. Étudium s’installe sur votre téléphone comme une application, depuis le navigateur.",
  },
];

// Questions sur les formules (NdAide, page Aide de l'espace connecté) : textes du design, tels quels.
export const QUESTIONS_FORMULES: { question: string; reponse: string }[] = [
  {
    question: "Puis-je passer à une formule supérieure en cours de mois ?",
    reponse: "Oui. Le changement est immédiat : vous payez seulement la différence, calculée au prorata des jours restants.",
  },
  {
    question: "Et pour une formule inférieure ?",
    reponse: "Le changement est programmé au prochain renouvellement. Vous gardez vos avantages actuels jusqu’à l’expiration.",
  },
  {
    question: "Qu’est-ce qu’une formation complémentaire ?",
    reponse: "Une formation hors de vos parcours, achetée une seule fois. Elle reste liée à votre compte et reste accessible tant que votre abonnement est actif.",
  },
  {
    question: "Quels moyens de paiement ?",
    reponse: "Le Mobile Money. Votre accès est activé automatiquement dès la confirmation du paiement, et vous recevez un reçu.",
  },
];
