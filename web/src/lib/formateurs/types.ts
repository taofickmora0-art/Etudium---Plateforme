import type { CarteCatalogue } from "@/lib/catalogue/types";
import type { Reseaux } from "./reseaux";

// Ce que l'appli lit d'un formateur public (migration 0070, formateur_public).

/** Une formation publiée du formateur : la carte du catalogue, avec son nombre de modules. */
export type FormationDuFormateur = CarteCatalogue & { nbModules: number };

export type FormateurPublic = {
  /** Identifiant de la fiche (formateurs.id), celui de l'adresse /formateurs/[id]. */
  id: string;
  nom: string;
  titre: string;
  domaine: string;
  presentation: string;
  /** Les réseaux renseignés (adresses en https://). */
  reseaux: Reseaux;
  /** Adresse publique de la photo du compte relié ; null : les initiales. */
  photoUrl: string | null;
  /** Date de création de la fiche (« A rejoint : il y a … ») ; vide si inconnue. */
  rejointLe: string;
  /** Ses formations publiées, la plus récemment publiée d'abord. */
  formations: FormationDuFormateur[];
  nbFormations: number;
  /** Le compte connecté peut lui écrire (bouton « Message ») : inscrit à une de ses formations, fiche reliée à un compte formateur. */
  peutEcrire: boolean;
};

/**
 * Le formateur d'une formation, pour sa fiche (bloc « Formateur du cours », carte au survol) : sa fiche publique sans la
 * liste de ses formations, leur nombre suffit. Données simples : elles passent du serveur aux composants du navigateur.
 */
export type ApercuFormateur = Omit<FormateurPublic, "formations">;
