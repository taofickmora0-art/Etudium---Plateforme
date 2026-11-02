import type { Role } from "./permissions";

// Les domaines du back-office par rôle (lot 6, partie A ; spec du 2 novembre 2026, §1). Rôles fixes : le modérateur
// gère la communauté ; l'admin, tout sauf les rôles et le journal ; le super admin, tout. La même table est en base
// (domaines_role, migration 0060), qui refuse de son côté ; un test compare les deux.

export type Domaine = "communaute" | "contenus" | "utilisateurs" | "paiements" | "statistiques" | "roles" | "journal";

const ADMIN: Domaine[] = ["communaute", "contenus", "utilisateurs", "paiements", "statistiques"];

export const DOMAINES_PAR_ROLE: Record<Role, Domaine[]> = {
  etudiant: [],
  formateur: [],
  moderateur: ["communaute"],
  admin: ADMIN,
  super_admin: [...ADMIN, "roles", "journal"],
};

/** Les domaines d'un compte : ceux de ses rôles, dans l'ordre de la table, sans doublon. */
export function domainesDe(roles: Role[]): Domaine[] {
  const tous = new Set(roles.flatMap((r) => DOMAINES_PAR_ROLE[r] ?? []));
  return DOMAINES_PAR_ROLE.super_admin.filter((d) => tous.has(d));
}

export function aDomaine(roles: Role[], domaine: Domaine): boolean {
  return roles.some((r) => (DOMAINES_PAR_ROLE[r] ?? []).includes(domaine));
}
