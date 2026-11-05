// Textes fixes de la landing (NdLanding, annexe 1.12 §4 à §10) : ceux du design, tels quels (spec du lot 1, §9).

import type { CouleurParcours } from "@/lib/contenus/libelles";

type Bloc = { titre: string; texte: string };

/** « Vous vous reconnaissez ? » (§4). */
export const PROBLEMES: Bloc[] = [
  { titre: "Votre mémoire avance lentement", texte: "Faute de méthode pour chercher, citer et rédiger, chaque chapitre prend des semaines." },
  { titre: "Word, Excel et PowerPoint vous font perdre du temps", texte: "Mises en page, tableaux, présentations de soutenance : vous bricolez au lieu de maîtriser." },
  { titre: "Les employeurs attendent des compétences digitales", texte: "Canva, IA, réseaux sociaux, outils no-code : on vous les demande, personne ne vous les a appris." },
  { titre: "Vous voulez créer vos propres revenus", texte: "Freelance, produits digitaux, vente en ligne : vous ne savez pas par où commencer." },
];

/** « Comment ça marche » (§7). */
export const ETAPES: Bloc[] = [
  { titre: "Créez votre compte gratuit", texte: "Accédez tout de suite aux formations gratuites et au catalogue complet." },
  { titre: "Choisissez votre formule", texte: "Basique, Standard ou Premium : 3 mois, 6 mois ou 1 an, avec accès à toutes les formations. Paiement par Mobile Money." },
  { titre: "Apprenez et pratiquez", texte: "Vidéos, quiz, exercices corrigés et sessions live, à votre rythme, sur téléphone ou ordinateur." },
  { titre: "Obtenez vos certificats", texte: "Une formation validée, c’est un certificat en PDF avec un QR Code de vérification." },
];

/** Ce que chaque abonnement ouvre : tout (restructuration, §5.1). */
const TOUT: string[] = ["Toutes les formations et tous les parcours", "La communauté complète", "Les lives et leurs replays", "Les certificats vérifiables"];

/**
 * Formules (§9) : trois abonnements qui ne diffèrent que par leur durée (restructuration validée le 20 octobre 2026,
 * §5.2). Sans prix tant que le back-office ne les fixe pas (lot 2).
 */
export const FORMULES: { nom: string; description: string; points: string[]; recommandee: boolean }[] = [
  { nom: "Basique", description: "3 mois", points: TOUT, recommandee: false },
  { nom: "Standard", description: "6 mois", points: TOUT, recommandee: true },
  { nom: "Premium", description: "1 an", points: TOUT, recommandee: false },
];

/** Texte qui remplace le prix des formules (spec du lot 1, Q10). */
export const PRIX_A_VENIR = "Prix annoncés au lancement";

/** « Vous n’apprenez jamais seul » (§10). */
export const ATOUTS: Bloc[] = [
  { titre: "Sessions live", texte: "Avec Google Meet ou Zoom, programmées dans votre tableau de bord." },
  { titre: "Exercices corrigés", texte: "Vous déposez votre travail, le formateur valide ou vous guide." },
  { titre: "Messagerie", texte: "Une question sur une leçon ? Écrivez directement à votre formateur." },
  { titre: "Suivi de progression", texte: "Objectifs, séries d’apprentissage et rappels pour garder le rythme." },
];

/**
 * Les 6 points de chaque parcours (§6) : aucun champ en base, rangés par adresse du parcours. Un parcours ajouté plus
 * tard n'a pas de liste (sa carte garde son nom et sa description).
 */
export const POINTS_PARCOURS: Record<string, string[]> = {
  "reussite-academique": [
    "Microsoft Word, Excel et PowerPoint",
    "Zotero et la recherche documentaire",
    "Rédaction scientifique",
    "Méthodologie du mémoire",
    "Présentation et soutenance",
    "Productivité académique",
  ],
  "competences-digitales": [
    "Canva et design",
    "Intelligence artificielle",
    "Création de contenu et montage vidéo",
    "Marketing digital et automatisation",
    "Freelancing",
    "Vente en ligne",
  ],
  entrepreneuriat: ["Trouver une idée", "Bâtir son projet", "Financer son projet", "Statut juridique", "Gestion et comptabilité", "Premiers clients"],
};

/**
 * Les trois parcours du lancement (§6), avec les textes de la maquette. Fixes comme « Trois parcours au lancement » :
 * rien à lire en base, donc rien qui arrive après coup au-dessus des ancres « Tarifs » et « Questions fréquentes ».
 * Les adresses (slugs) sont celles de la table `parcours`, pour le filtre du catalogue.
 */
export const PARCOURS_LANCEMENT: { slug: string; nom: string; couleur: CouleurParcours; description: string }[] = [
  {
    slug: "reussite-academique",
    nom: "Réussite académique",
    couleur: "academique",
    description: "Les outils et méthodes pour réussir à l’université : bureautique, recherche documentaire, rédaction scientifique, mémoire et soutenance.",
  },
  {
    slug: "competences-digitales",
    nom: "Compétences digitales",
    couleur: "digital",
    description: "Les compétences numériques recherchées, et comment en vivre : design, intelligence artificielle, contenu, freelance et vente en ligne.",
  },
  {
    slug: "entrepreneuriat",
    nom: "Entrepreneuriat",
    couleur: "business",
    description: "De l’idée à l’entreprise : trouver une idée, bâtir son projet, le financer et le gérer, pendant ses études et après.",
  },
];
