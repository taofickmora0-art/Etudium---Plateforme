import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Actions de la page Utilisateurs (spec des utilisateurs, §2 à §4) : la base revérifie tout (migration 0013).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { chercherComptes, changerRole, suspendreCompte, reactiverCompte } = await import("@/lib/utilisateurs/actions");

const ID = "11111111-1111-4111-8111-111111111111";

describe("Actions de la page Utilisateurs", () => {
  beforeEach(() => {
    faux.vider();
    refresh.mockReset();
    getShellUser.mockResolvedValue({ roles: ["etudiant", "super_admin"] });
  });

  it("refusées hors de l'équipe, sans appel à la base", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
    expect(await chercherComptes("", "tous", 1)).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect(await changerRole(ID, "formateur")).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
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

  it("changerRole transmet le rôle choisi, un seul (migration 0017) ; la page est relue", async () => {
    expect(await changerRole(ID, "formateur")).toEqual({ ok: true });
    expect(await changerRole(ID, "etudiant")).toEqual({ ok: true });
    expect(faux.de("rpc", "changer_role").map((a) => a.valeurs)).toEqual([
      { p_compte: ID, p_role: "formateur" },
      { p_compte: ID, p_role: "etudiant" },
    ]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("avant la migration 0017 : le message dit laquelle appliquer", async () => {
    faux.repondre("rpc.changer_role", { error: { code: "PGRST202" } });
    expect(await changerRole(ID, "formateur")).toEqual({ ok: false, message: "Appliquez la migration 0017 (guide « Ce qui te revient », section 22)." });
  });

  it("un rôle inconnu ou un identifiant mal formé est refusé sans appel", async () => {
    expect(await changerRole(ID, "pirate" as never)).toMatchObject({ ok: false });
    expect(await changerRole("abc", "admin")).toMatchObject({ ok: false });
    expect(await suspendreCompte("abc", "")).toMatchObject({ ok: false });
    expect(faux.appels).toEqual([]);
  });

  it("le message de la base (P0001) est rendu tel quel ; 42501 donne l'accès réservé ; le reste un message générique", async () => {
    faux.repondre("rpc.changer_role", { error: { code: "P0001", message: "Réactivez le compte avant de lui donner un rôle." } });
    expect(await changerRole(ID, "formateur")).toEqual({ ok: false, message: "Réactivez le compte avant de lui donner un rôle." });
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
