import { redirect } from "next/navigation";
import type { ShellUser } from "./current-user";
import { aDomaine, type Domaine } from "./domaines";
import { requireSpace } from "./require-space";

/**
 * En tête de chaque page du back-office qui relève d'un domaine (lot 6 A, spec §1.2) : sans ce domaine, retour à la
 * vue d'ensemble (une adresse gardée en favori, un lien partagé). La base refuse de son côté (0060).
 */
export async function requireDomaine(domaine: Domaine): Promise<ShellUser> {
  const user = await requireSpace("admin");
  if (!aDomaine(user.roles, domaine)) redirect("/admin");
  return user;
}
