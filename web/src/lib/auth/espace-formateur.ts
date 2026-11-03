import type { Role } from "./permissions";

// Restructuration du 20 octobre 2026 (R1) : un formateur n'a plus l'espace étudiant. Une adresse étudiante le mène à
// l'équivalent de son espace (ses pages de compte, sa communauté), sinon à son tableau de bord. Les liens des
// notifications passent par ce même renvoi.

const EQUIVALENTS: Record<string, string> = {
  "/profil": "/formateur/profil",
  "/notifications": "/formateur/notifications",
  "/menu": "/formateur/menu",
  "/messages": "/formateur/messages",
};

const PUBLICATION = /^\/communaute\/publications\/([^/?#]+)$/;
// Un groupe de discussion (0075) : le sien est dans son espace, avec le message visé (« ?message=… »).
const GROUPE = /^\/groupes(\/[^/?#]+)?$/;

/** Où va un formateur qui demande `chemin` (la recherche et l'ancre d'une adresse étudiante sont laissées). */
export function cheminFormateur(chemin: string): string {
  if (chemin === "/formateur" || chemin.startsWith("/formateur/") || chemin.startsWith("/formateur?")) return chemin;
  const page = chemin.split(/[?#]/)[0];
  const publication = PUBLICATION.exec(page);
  if (publication) return `/formateur/communaute/publications/${publication[1]}`;
  const groupe = GROUPE.exec(page);
  if (groupe) return `/formateur/groupes${groupe[1] ?? ""}${groupe[1] ? chemin.slice(page.length) : ""}`;
  return EQUIVALENTS[page] ?? "/formateur";
}

/** L'accueil d'un compte : le tableau de bord pour un formateur, l'Accueil (la communauté) pour les autres. */
export function accueilDe(roles: Role[]): string {
  return roles.includes("formateur") ? "/formateur" : "/accueil";
}

type ClientRpc = { rpc: (nom: "a_role", args: { r: "formateur" }) => PromiseLike<{ data: unknown; error: unknown }> };

/** Le compte qui vient de se connecter est-il formateur ? La base le dit (a_role) ; non en cas de doute. */
export async function estFormateurConnecte(supabase: ClientRpc): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("a_role", { r: "formateur" });
    return !error && data === true;
  } catch {
    return false;
  }
}
