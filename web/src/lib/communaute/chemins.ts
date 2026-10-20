// Les adresses de la communauté selon l'espace (restructuration R1) : l'étudiant la trouve sur l'Accueil, le formateur
// dans son espace (`/formateur/communaute`), sans la page Événements (il anime ses sessions depuis « Sessions live »).

export type EspaceCommunaute = "etudiant" | "formateur";

export type CheminsCommunaute = {
  /** La page du fil, et ses onglets (`?espace=…`). */
  accueil: string;
  /** Son nom dans le fil d'Ariane d'une publication. */
  libelleAccueil: string;
  publication: (id: string) => string;
  /** La page des sessions live ; null : pas de lien (le formateur n'a pas la page Événements). */
  evenements: string | null;
};

export const CHEMINS_COMMUNAUTE: Record<EspaceCommunaute, CheminsCommunaute> = {
  etudiant: {
    accueil: "/accueil",
    libelleAccueil: "Accueil",
    publication: (id) => `/communaute/publications/${id}`,
    evenements: "/evenements",
  },
  formateur: {
    accueil: "/formateur/communaute",
    libelleAccueil: "Communauté",
    publication: (id) => `/formateur/communaute/publications/${id}`,
    evenements: null,
  },
};

/** L'espace d'après l'adresse : la communauté du formateur, sinon celle de l'étudiant. */
export function espaceCommunauteDe(pathname: string | null): EspaceCommunaute {
  return pathname === "/formateur" || pathname?.startsWith("/formateur/") ? "formateur" : "etudiant";
}
