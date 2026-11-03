// Les groupes de discussion (migration 0075, spec du 3 novembre 2026) : le Général, un groupe par parcours, un groupe par
// formation (activé par son formateur ou l'équipe des contenus).

/** Les six réactions, dans leur ordre d'affichage (reactions_groupes, en base). */
export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
export type Reaction = (typeof REACTIONS)[number];

export type TypeGroupe = "general" | "parcours" | "formation";
export type CouleurGroupe = "academique" | "digital" | "business" | null;
/** Le badge d'un auteur : « Formateur », « Équipe », ou rien. */
export type Badge = "formateur" | "equipe" | null;

/** Les groupes de l'étudiant (avec l'équipe) ou du formateur, dans son espace. */
export type EspaceGroupes = "etudiant" | "formateur";

/** Le dernier message d'un groupe, dans la liste. */
export type DernierMessage = {
  id: string;
  auteur: { prenom: string; nom: string };
  deMoi: boolean;
  texte: string;
  image: boolean;
  supprime: boolean;
  retire: boolean;
  creeLe: string;
};

/** Un groupe dans la liste « Groupes ». */
export type ResumeGroupe = {
  id: string;
  slug: string;
  nom: string;
  type: TypeGroupe;
  couleur: CouleurGroupe;
  /** Faux : le groupe d'une formation désactivé (vu par l'équipe et son formateur seulement). */
  actif: boolean;
  nonLus: number;
  coupe: boolean;
  dernier: DernierMessage | null;
};

export type ReactionMessage = { emoji: string; nombre: number; moi: boolean };

/** Le message cité par une réponse. */
export type Citation = { id: string; auteur: { prenom: string; nom: string }; texte: string; image: boolean; supprime: boolean };

export type MessageGroupe = {
  id: string;
  groupeId: string;
  auteur: { id: string; prenom: string; nom: string; photoUrl: string | null; badge: Badge };
  deMoi: boolean;
  texte: string;
  /** L'image (espace privé « groupes »), avec un lien temporaire ; null sans image (ou message supprimé, retiré). */
  image: { chemin: string; type: string; url: string | null } | null;
  reponse: Citation | null;
  creeLe: string;
  modifieLe: string | null;
  /** Supprimé par son auteur, le formateur ou l'équipe : « Message supprimé ». */
  supprime: boolean;
  /** Retiré par la modération (l'analyse automatique ou l'équipe) : « Message retiré par la modération ». */
  retire: boolean;
  reactions: ReactionMessage[];
  epingle: boolean;
};

export type FilGroupe = { messages: MessageGroupe[]; plusAnciens: boolean };

type Commun = {
  id: string;
  slug: string;
  nom: string;
  type: TypeGroupe;
  couleur: CouleurGroupe;
  actif: boolean;
  parcours: { nom: string; slug: string } | null;
  formation: { titre: string; slug: string } | null;
};

/** Pourquoi un groupe est fermé au compte : il faut un abonnement ou une inscription, ou il est désactivé. */
export type RaisonFermeture = "abonnement" | "formateur" | "inscription" | "desactive";

export type GroupeFerme = Commun & { ouvert: false; raison: RaisonFermeture };

export type GroupeOuvert = Commun & {
  ouvert: true;
  membres: number;
  coupe: boolean;
  /** Supprimer n'importe quel message et épingler : le formateur du groupe et l'équipe. */
  peutModerer: boolean;
  /** L'équipe modère depuis la file : elle ne signale pas. */
  equipe: boolean;
  /** Faux : groupe désactivé (lu par l'équipe et le formateur, personne n'y écrit). */
  peutEcrire: boolean;
  nonLus: number;
  epingle: MessageGroupe | null;
};

export type Groupe = GroupeOuvert | GroupeFerme;

/** Le groupe d'une formation, pour sa fiche, ses leçons et son réglage. */
export type GroupeDeFormation = { actif: boolean; slug: string | null; ouvert: boolean; peutRegler: boolean };
