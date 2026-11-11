import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Actions de la page Utilisateurs (spec des utilisateurs, §2 à §4) : la base revérifie tout (migration 0013).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { chercherComptes, changerRoles, suspendreCompte, reactiverCompte } = await import("@/lib/utilisateurs/actions");

const ID = "11111111-1111-4111-8111-111111111111";

describe("Actions de la page Utilisateurs", () => {
  beforeEach(() => {
    faux.vider();
    refresh.mockReset();
    getShellUser.mockResolvedValue({ roles: ["etudiant", "super_admin"] });
  });

  it("point reporté du lot 6 A : un admin ne change pas un rôle (le super admin seul), sans appel à la base", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    expect(await changerRoles(ID, ["formateur"])).toEqual({ ok: false, message: "Vous n’avez pas accès à cette partie du back-office." });
    expect(faux.appels).toEqual([]);
  });

  it("refusées hors de l'équipe, sans appel à la base", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
    expect(await chercherComptes("", "tous", 1)).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect(await changerRoles(ID, ["formateur"])).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect(await suspendreCompte(ID, "")).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect(await reactiverCompte(ID)).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    getShellUser.mockResolvedValue(null);
    expect(await reactiverCompte(ID)).toEqual({ ok: false, message: "Votre session a expiré. Reconnectez-vous." });
    expect(faux.appels).toEqual([]);
  });

  it("chercherComptes rend une page ; une page < 1 vaut 1 ; la recherche est nettoyée", async () => {
    faux.repondre("rpc.comptes_equipe", { data: { total: 0, comptes: [] } });
    expect(await chercherComptes("  fifa ", "nimporte" as never, 0)).toEqual({ ok: true, page: { total: 0, comptes: [] } });
    expect(faux.de("rpc", "comptes_equipe")[0].valeurs).toEqual({ p_recherche: "fifa", p_filtre: "tous", p_page: 1 });
  });

  it("chercherComptes : un échec donne un message", async () => {
    faux.repondre("rpc.comptes_equipe", { error: { code: "500", message: "panne" } });
    expect(await chercherComptes("", "tous", 1)).toEqual({ ok: false, message: "La liste n’a pas pu être chargée. Réessayez." });
  });

  it("changerRoles transmet les rôles choisis, dans l'ordre de la base (migration 0079) ; la page est relue", async () => {
    expect(await changerRoles(ID, ["formateur", "etudiant"])).toEqual({ ok: true });
    expect(await changerRoles(ID, ["etudiant", "admin"])).toEqual({ ok: true });
    expect(faux.de("rpc", "changer_roles").map((a) => a.valeurs)).toEqual([
      { p_compte: ID, p_roles: ["etudiant", "formateur"] },
      { p_compte: ID, p_roles: ["etudiant", "admin"] },
    ]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("changerRoles refuse sans appel à la base : ni étudiant ni formateur, deux rôles de l'équipe", async () => {
    expect(await changerRoles(ID, ["admin"])).toEqual({ ok: false, message: "Un compte est étudiant, formateur, ou les deux." });
    expect(await changerRoles(ID, ["etudiant", "admin", "moderateur"])).toEqual({ ok: false, message: "Un seul rôle de l’équipe à la fois." });
    expect(faux.appels).toEqual([]);
  });

  it("avant la migration 0079 : un message neutre", async () => {
    faux.repondre("rpc.changer_roles", { error: { code: "PGRST202" } });
    expect(await changerRoles(ID, ["formateur"])).toEqual({ ok: false, message: "Cette fonction n’est pas disponible pour le moment." });
  });

  it("un rôle inconnu ou un identifiant mal formé est refusé sans appel", async () => {
    expect(await changerRoles(ID, ["pirate" as never])).toMatchObject({ ok: false });
    expect(await changerRoles("abc", ["etudiant"])).toMatchObject({ ok: false });
    expect(await suspendreCompte("abc", "")).toMatchObject({ ok: false });
    expect(faux.appels).toEqual([]);
  });

  it("le message de la base (P0001) est rendu tel quel ; 42501 donne l'accès réservé ; le reste un message générique", async () => {
    faux.repondre("rpc.changer_roles", { error: { code: "P0001", message: "Réactivez le compte avant de lui donner un rôle." } });
    expect(await changerRoles(ID, ["formateur"])).toEqual({ ok: false, message: "Réactivez le compte avant de lui donner un rôle." });
    faux.repondre("rpc.suspendre_compte", { error: { code: "42501", message: "Seuls un admin ou le super admin suspendent un compte." } });
    expect(await suspendreCompte(ID, "")).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    faux.repondre("rpc.reactiver_compte", { error: { code: "500", message: "panne" } });
    expect(await reactiverCompte(ID)).toEqual({ ok: false, message: "L’opération n’a pas abouti. Réessayez." });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("le motif de suspension est nettoyé des espaces et coupé à 500 caractères", async () => {
    expect(await suspendreCompte(ID, `  ${"x".repeat(600)}  `)).toEqual({ ok: true });
    expect(await reactiverCompte(ID)).toEqual({ ok: true });
    expect(faux.de("rpc", "suspendre_compte")[0].valeurs).toEqual({ p_compte: ID, p_motif: "x".repeat(500) });
    expect(faux.de("rpc", "reactiver_compte")[0].valeurs).toEqual({ p_compte: ID });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
