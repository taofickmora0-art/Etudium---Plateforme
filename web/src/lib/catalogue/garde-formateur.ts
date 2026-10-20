import { redirect } from "next/navigation";
import type { ShellUser } from "@/lib/auth/current-user";
import { canAccess } from "@/lib/auth/permissions";
import { editeurFormation } from "./apercu";

// Restructuration R1 : un formateur ne lit que ses formations. Les pages du catalogue et de la leçon, ouvertes aux
// visiteurs, ne passent pas par la garde de l'espace étudiant : elles appliquent cette règle elles-mêmes.

const estFormateur = (compte: ShellUser | null) => compte !== null && !canAccess("etudiant", compte.roles);

/**
 * Catalogue : un formateur va à son tableau de bord. Fiche ou validation d'une formation (`formationId`) : à son
 * éditeur si c'est la sienne, sinon à son tableau de bord. Rien pour les autres comptes ni pour un visiteur.
 */
export async function renvoyerFormateur(compte: ShellUser | null, formationId?: string): Promise<void> {
  if (!estFormateur(compte)) return;
  redirect((formationId ? await editeurFormation(formationId) : null) ?? "/formateur");
}

/**
 * Page leçon : un formateur, sur une leçon de sa formation (`lienModifier` connu), la regarde en aperçu (vrai) ; sur
 * celle d'un autre, il va à son tableau de bord. Faux pour tout autre compte.
 */
export function apercuFormateur(compte: ShellUser | null, lienModifier: string | null): boolean {
  if (!estFormateur(compte)) return false;
  if (!lienModifier) redirect("/formateur");
  return true;
}
