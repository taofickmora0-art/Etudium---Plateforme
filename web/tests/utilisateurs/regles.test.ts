import { describe, expect, it } from "vitest";
import {
  COMPTES_PAR_PAGE,
  dateCourte,
  dateNumerique,
  droitsSurCompte,
  FILTRES_COMPTES,
  formuleAffichee,
  LIBELLES_ROLES,
  nomAffiche,
  nomCourt,
  resumeChangement,
  rolePrincipal,
} from "@/lib/utilisateurs/regles";
import type { Role } from "@/lib/auth/permissions";

// Règles de la page Utilisateurs (spec 2026-10-13-utilisateurs-roles, §1 à §3). L'interface les applique pour
// n'afficher que ce qui est permis ; la base les revérifie (migration 0013).

const moi = (roles: Role[], id = "moi") => ({ id, roles: ["etudiant", ...roles] as Role[] });
const compte = (roles: Role[], suspendu = false, id = "autre") => ({ id, roles: ["etudiant", ...roles] as Role[], suspendu });

describe("Règles de la page Utilisateurs", () => {
  it("25 comptes par page ; les filtres et les rôles de la spec", () => {
    expect(COMPTES_PAR_PAGE).toBe(25);
    // Les filtres du design (NdAdminUtilisateurs) ; l'équipe apparaît dans « Tous ».
    expect(FILTRES_COMPTES.map((f) => f.label)).toEqual(["Tous", "Étudiants", "Formateurs", "Suspendus"]);
    expect(FILTRES_COMPTES.map((f) => f.value)).toEqual(["tous", "etudiants", "formateurs", "suspendus"]);
    expect(LIBELLES_ROLES).toEqual({ etudiant: "Étudiant", formateur: "Formateur", moderateur: "Modérateur", admin: "Admin", super_admin: "Super admin" });
  });

  it("le nom affiché, ou « Sans nom »", () => {
    expect(nomAffiche(" Fifamè ", "Adjovi ")).toBe("Fifamè Adjovi");
    expect(nomAffiche("", "Adjovi")).toBe("Adjovi");
    expect(nomAffiche("", "")).toBe("Sans nom");
    expect(nomAffiche("  ", " ")).toBe("Sans nom");
  });

  it("le résumé d'un changement de rôles, sans Étudiant", () => {
    expect(resumeChangement(["etudiant", "admin"], ["etudiant", "formateur"])).toBe("Donner : Formateur. Retirer : Admin.");
    expect(resumeChangement(["etudiant"], ["etudiant", "super_admin", "formateur"])).toBe("Donner : Formateur, Super admin.");
    expect(resumeChangement(["etudiant", "moderateur"], ["etudiant"])).toBe("Retirer : Modérateur.");
    expect(resumeChangement(["etudiant", "admin"], ["admin", "etudiant"])).toBe("Aucun changement.");
  });

  it("le tableau : rôle principal, formule (lot 2 : gratuit pour les étudiants), date du design, nom court", () => {
    expect(rolePrincipal(["etudiant"])).toBe("etudiant");
    expect(rolePrincipal(["etudiant", "formateur", "admin"])).toBe("admin");
    expect(rolePrincipal(["etudiant", "moderateur", "super_admin"])).toBe("super_admin");
    expect(formuleAffichee(["etudiant"])).toBe("Gratuit");
    expect(formuleAffichee(["etudiant", "formateur"])).toBe("—");
    expect(formuleAffichee(["etudiant", "moderateur"])).toBe("—");
    expect(dateNumerique("2026-09-12T09:00:00Z")).toBe("12/09/2026");
    expect(dateNumerique("2026-09-12T23:30:00Z")).toBe("13/09/2026");
    expect(nomCourt("Koffi", "Dossou", "k@exemple.com")).toBe("Koffi D.");
    expect(nomCourt("Koffi", "", "k@exemple.com")).toBe("Koffi");
    expect(nomCourt("", "Dossou", "k@exemple.com")).toBe("Dossou");
    expect(nomCourt(" ", "", "k@exemple.com")).toBe("k@exemple.com");
  });

  it("une date courte, à l'heure du Bénin", () => {
    expect(dateCourte("2026-10-12T09:00:00Z")).toBe("12 oct. 2026");
    // 23 h 30 à Greenwich : déjà le lendemain à Cotonou (UTC+1).
    expect(dateCourte("2026-10-12T23:30:00Z")).toBe("13 oct. 2026");
  });

  it("un modérateur voit, sans rien changer", () => {
    expect(droitsSurCompte(moi(["moderateur"]), compte([]))).toEqual({ changerRoles: false, suspendre: false, reactiver: false });
    expect(droitsSurCompte(moi(["moderateur"]), compte([], true))).toEqual({ changerRoles: false, suspendre: false, reactiver: false });
  });

  it("un admin suspend un étudiant ou un formateur, pas l'équipe ; il ne change pas les rôles", () => {
    expect(droitsSurCompte(moi(["admin"]), compte([]))).toEqual({ changerRoles: false, suspendre: true, reactiver: false });
    expect(droitsSurCompte(moi(["admin"]), compte(["formateur"]))).toMatchObject({ suspendre: true });
    expect(droitsSurCompte(moi(["admin"]), compte(["admin"]))).toMatchObject({ suspendre: false });
    expect(droitsSurCompte(moi(["admin"]), compte(["moderateur"]))).toMatchObject({ suspendre: false });
    expect(droitsSurCompte(moi(["admin"]), compte([], true))).toEqual({ changerRoles: false, suspendre: false, reactiver: true });
    expect(droitsSurCompte(moi(["admin"]), compte(["moderateur"], true))).toMatchObject({ reactiver: false });
  });

  it("le super admin change les rôles et suspend l'équipe, jamais lui-même ni un super admin", () => {
    expect(droitsSurCompte(moi(["super_admin"]), compte(["admin"]))).toEqual({ changerRoles: true, suspendre: true, reactiver: false });
    expect(droitsSurCompte(moi(["super_admin"], "moi"), compte(["super_admin"], false, "moi"))).toEqual({ changerRoles: true, suspendre: false, reactiver: false });
    expect(droitsSurCompte(moi(["super_admin"]), compte(["super_admin"]))).toMatchObject({ suspendre: false });
    expect(droitsSurCompte(moi(["super_admin"]), compte(["admin"], true))).toMatchObject({ suspendre: false, reactiver: true });
  });
});
