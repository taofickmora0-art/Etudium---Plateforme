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
    // Restructuration (§5.2) : chaque abonnement ouvre tous les parcours ; il n'y a plus de parcours au choix.
    question: "Ai-je accès à tous les parcours ?",
    reponse: "Oui. Tous les abonnements donnent accès à tous les parcours et à toutes les formations.",
  },
  {
    question: "Que se passe-t-il quand mon abonnement expire ?",
    reponse:
      "Vos formations sont verrouillées mais rien n’est supprimé : votre progression et vos certificats restent sur votre compte. Tout redevient accessible dès que vous renouvelez.",
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

// Questions sur les formules (NdAide, page Aide de l'espace connecté) : le nouveau modèle (restructuration, §5.2), trois
// abonnements qui ne diffèrent que par leur durée ; plus de changement au prorata ni de formation complémentaire.
export const QUESTIONS_FORMULES: { question: string; reponse: string }[] = [
  {
    question: "Quelle différence entre Basique, Standard et Premium ?",
    reponse: "Seulement la durée : 3 mois, 6 mois ou 1 an. Toutes donnent accès à toutes les formations.",
  },
  {
    question: "Puis-je prolonger mon abonnement ?",
    reponse: "Oui. Un nouvel abonnement pris avant la fin s’ajoute à la date de fin de l’actuel.",
  },
  {
    question: "Que se passe-t-il à la fin de mon abonnement ?",
    reponse: "Les formations payantes se verrouillent, mais votre progression et vos certificats restent. Tout se rouvre dès que vous renouvelez.",
  },
  {
    question: "Quels moyens de paiement ?",
    reponse: "Le Mobile Money. Votre accès est activé automatiquement dès la confirmation du paiement, et vous recevez un reçu.",
  },
];
