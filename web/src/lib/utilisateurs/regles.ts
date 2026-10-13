import type { Role } from "@/lib/auth/permissions";
import type { FiltreComptes } from "./types";

// Règles de la page Utilisateurs (spec 2026-10-13-utilisateurs-roles, §1 à §3). L'interface s'en sert pour n'afficher
// que ce qui est permis ; la base les revérifie toutes (migration 0013).

export const COMPTES_PAR_PAGE = 25;
export const MOTIF_MAX = 500;

export const FILTRES_COMPTES: { value: FiltreComptes; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "etudiants", label: "Étudiants" },
  { value: "formateurs", label: "Formateurs" },
  { value: "equipe", label: "Équipe" },
  { value: "suspendus", label: "Suspendus" },
];

/** Les rôles dans l'ordre de la base (étudiant d'abord, super admin en dernier). */
export const ROLES_ORDONNES: Role[] = ["etudiant", "formateur", "moderateur", "admin", "super_admin"];

export const LIBELLES_ROLES: Record<Role, string> = {
  etudiant: "Étudiant",
  formateur: "Formateur",
  moderateur: "Modérateur",
  admin: "Admin",
  super_admin: "Super admin",
};

const EQUIPE: Role[] = ["moderateur", "admin", "super_admin"];

export const estRole = (valeur: unknown): valeur is Role => ROLES_ORDONNES.includes(valeur as Role);
export const estFiltre = (valeur: unknown): valeur is FiltreComptes => FILTRES_COMPTES.some((f) => f.value === valeur);

/** « Prénom Nom », ou « Sans nom ». */
export function nomAffiche(prenom: string, nom: string): string {
  return [prenom.trim(), nom.trim()].filter(Boolean).join(" ") || "Sans nom";
}

/** Le résumé d'un changement de rôles, pour la confirmation : « Donner : Formateur. Retirer : Admin. » */
export function resumeChangement(avant: Role[], apres: Role[]): string {
  const libelles = (roles: Role[]) => roles.map((r) => LIBELLES_ROLES[r]).join(", ");
  const donner = ROLES_ORDONNES.filter((r) => r !== "etudiant" && apres.includes(r) && !avant.includes(r));
  const retirer = ROLES_ORDONNES.filter((r) => r !== "etudiant" && avant.includes(r) && !apres.includes(r));
  const parties = [donner.length > 0 && `Donner : ${libelles(donner)}.`, retirer.length > 0 && `Retirer : ${libelles(retirer)}.`].filter(Boolean);
  return parties.length > 0 ? parties.join(" ") : "Aucun changement.";
}

const DATE_COURTE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Porto-Novo" });

/** « 12 oct. 2026 », à l'heure du Bénin. */
export const dateCourte = (iso: string) => DATE_COURTE.format(new Date(iso));

/**
 * Ce que la personne connectée peut faire sur un compte :
 * - changer les rôles : le super admin seul ;
 * - suspendre : un admin ou le super admin ; un membre de l'équipe, le super admin seul ; jamais soi-même ni un
 *   compte super admin (retirer d'abord son rôle) ;
 * - réactiver : les mêmes droits, sur un compte suspendu.
 */
export function droitsSurCompte(
  moi: { id: string; roles: Role[] },
  compte: { id: string; roles: Role[]; suspendu: boolean },
): { changerRoles: boolean; suspendre: boolean; reactiver: boolean } {
  const superAdmin = moi.roles.includes("super_admin");
  const admin = superAdmin || moi.roles.includes("admin");
  const cibleEquipe = compte.roles.some((r) => EQUIPE.includes(r));
  const peutAgir = admin && (!cibleEquipe || superAdmin);
  return {
    changerRoles: superAdmin,
    suspendre: !compte.suspendu && peutAgir && moi.id !== compte.id && !compte.roles.includes("super_admin"),
    reactiver: compte.suspendu && peutAgir,
  };
}
