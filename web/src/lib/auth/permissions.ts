import type { Role } from "@/components/ui/ProfileMenu";

// Qui entre dans quel espace (spec §4 et §7, feuille de route 0.6). Écrit une seule fois : les menus et la
// vérification des pages (requireSpace) s'en servent. Le lot 6 affinera ce que chacun voit dans le back-office.

export type Espace = "etudiant" | "formateur" | "admin";

export const ACCES: Record<Espace, Role[] | "tous"> = {
  etudiant: "tous",
  // Le super-administrateur passe partout, pour pouvoir tout vérifier.
  formateur: ["formateur", "super_admin"],
  admin: ["moderateur", "admin", "super_admin"],
};

export function canAccess(espace: Espace, roles: Role[]): boolean {
  const autorises = ACCES[espace];
  return autorises === "tous" || roles.some((r) => autorises.includes(r));
}

/** Espace où l'on se trouve, d'après l'adresse (coché dans le menu du profil). */
export function spaceOf(pathname: string | null): Espace {
  if (!pathname) return "etudiant";
  if (pathname === "/formateur" || pathname.startsWith("/formateur/")) return "formateur";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  return "etudiant";
}
