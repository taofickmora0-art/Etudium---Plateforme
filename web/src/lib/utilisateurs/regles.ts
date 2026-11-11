import type { Role } from "@/lib/auth/permissions";
import type { FiltreComptes } from "./types";

// Règles de la page Utilisateurs (spec 2026-10-13-utilisateurs-roles, §1 à §3). L'interface s'en sert pour n'afficher
// que ce qui est permis ; la base les revérifie toutes (migration 0013).

export const COMPTES_PAR_PAGE = 25;
export const MOTIF_MAX = 500;

/** Les filtres du design (NdAdminUtilisateurs) ; l'équipe apparaît dans « Tous ». */
export const FILTRES_COMPTES: { value: FiltreComptes; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "etudiants", label: "Étudiants" },
  { value: "formateurs", label: "Formateurs" },
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

/** Les rôles de l'équipe : un seul à la fois (0079). */
export const ROLES_EQUIPE: Role[] = ["moderateur", "admin", "super_admin"];
const EQUIPE = ROLES_EQUIPE;

/** Les rôles sans doublon, dans l'ordre de la base. */
export const rolesOrdonnes = (roles: Role[]): Role[] => ROLES_ORDONNES.filter((r) => roles.includes(r));

/** Ce que la base refuserait (0079) : un compte est étudiant, formateur, ou les deux ; un seul rôle de l'équipe. */
export function refusRoles(roles: Role[]): string | null {
  if (!roles.includes("etudiant") && !roles.includes("formateur")) return "Un compte est étudiant, formateur, ou les deux.";
  if (roles.filter((r) => ROLES_EQUIPE.includes(r)).length > 1) return "Un seul rôle de l’équipe à la fois.";
  return null;
}

/** « Étudiant · Formateur · Admin ». */
export const libelleRoles = (roles: Role[]): string => rolesOrdonnes(roles).map((r) => LIBELLES_ROLES[r]).join(" · ") || LIBELLES_ROLES.etudiant;

/** « Espace étudiant, espace formateur et back-office. » : les espaces qu'ouvrent les rôles d'un compte. */
export function espacesDesRoles(roles: Role[]): string {
  const espaces = [
    ...(roles.includes("etudiant") ? ["espace étudiant"] : []),
    ...(roles.includes("formateur") ? ["espace formateur"] : []),
    ...(roles.some((r) => ROLES_EQUIPE.includes(r)) ? [roles.includes("super_admin") ? "back-office, avec le choix des rôles" : "back-office"] : []),
  ];
  const texte = espaces.length > 1 ? `${espaces.slice(0, -1).join(", ")} et ${espaces.at(-1)}` : (espaces[0] ?? "aucun espace");
  return `${texte[0].toUpperCase()}${texte.slice(1)}.`;
}

export const estRole = (valeur: unknown): valeur is Role => ROLES_ORDONNES.includes(valeur as Role);
export const estFiltre = (valeur: unknown): valeur is FiltreComptes => FILTRES_COMPTES.some((f) => f.value === valeur);

/** « Prénom Nom », ou « Sans nom ». */
export function nomAffiche(prenom: string, nom: string): string {
  return [prenom.trim(), nom.trim()].filter(Boolean).join(" ") || "Sans nom";
}

/** « Koffi D. » (fenêtres et messages du design) ; le prénom ou le nom seul ; sinon l'adresse. */
export function nomCourt(prenom: string, nom: string, email: string): string {
  const p = prenom.trim();
  const n = nom.trim();
  if (p && n) return `${p} ${n[0].toUpperCase()}.`;
  return p || n || email;
}

/** Le rôle affiché dans le tableau : le plus élevé du compte. */
export const rolePrincipal = (roles: Role[]): Role => [...ROLES_ORDONNES].reverse().find((r) => roles.includes(r)) ?? "etudiant";

/** La formule du tableau : celle de l'abonnement en cours (lot 2), « Gratuit » pour un étudiant sans abonnement, « — » sinon. */
export const formuleAffichee = (roles: Role[], formule: string | null | undefined): string =>
  rolePrincipal(roles) !== "etudiant" ? "—" : formule || "Gratuit";

const DATE_NUMERIQUE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Porto-Novo" });

/** « 12/09/2026 » (colonne « Inscrit le » du design), à l'heure du Bénin. */
export const dateNumerique = (iso: string) => DATE_NUMERIQUE.format(new Date(iso));

/** Initiales de l'avatar : prénom et nom (« FA »), sinon la première lettre de l'adresse. */
export function initialesCompte(prenom: string, nom: string, email: string): string {
  const mots = `${prenom} ${nom}`.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return (email.trim()[0] ?? "?").toUpperCase();
  return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : "")).toUpperCase();
}

const DATE_COURTE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Porto-Novo" });

/** « 12 oct. 2026 », à l'heure du Bénin. */
export const dateCourte = (iso: string) => DATE_COURTE.format(new Date(iso));

/**
 * Ce que la personne connectée peut faire sur un compte :
 * - changer le rôle : le super admin seul ;
 * - suspendre : un admin ou le super admin ; un membre de l'équipe, le super admin seul ; jamais soi-même ni un
 *   compte super admin (retirer d'abord son rôle) ;
 * - réactiver : les mêmes droits, sur un compte suspendu ;
 * - renommer : un admin ou le super admin ; un membre de l'équipe, le super admin seul (lot 6 A) ;
 * - supprimer : le super admin seul ; jamais soi-même ni un compte super admin (lot 6 A).
 */
export function droitsSurCompte(
  moi: { id: string; roles: Role[] },
  compte: { id: string; roles: Role[]; suspendu: boolean },
): { changerRole: boolean; suspendre: boolean; reactiver: boolean; renommer: boolean; supprimer: boolean } {
  const superAdmin = moi.roles.includes("super_admin");
  const admin = superAdmin || moi.roles.includes("admin");
  const cibleEquipe = compte.roles.some((r) => EQUIPE.includes(r));
  const peutAgir = admin && (!cibleEquipe || superAdmin);
  return {
    changerRole: superAdmin,
    suspendre: !compte.suspendu && peutAgir && moi.id !== compte.id && !compte.roles.includes("super_admin"),
    reactiver: compte.suspendu && peutAgir,
    renommer: peutAgir,
    supprimer: superAdmin && moi.id !== compte.id && !compte.roles.includes("super_admin"),
  };
}
