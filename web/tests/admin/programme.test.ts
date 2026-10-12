import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "./faux-supabase";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { addModule, renameModule, deleteModule, addLecon, deleteLecon } = await import("@/lib/admin/actions");
const { IDLE } = await import("@/lib/auth/schemas");

const F = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";
const L = "33333333-3333-4333-8333-333333333333";
const form = (valeurs: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(valeurs)) fd.set(k, v);
  return fd;
};

describe("Back-office : programme d'une formation", () => {
  beforeEach(() => {
    faux.vider();
    refresh.mockReset();
    getShellUser.mockReset();
    getShellUser.mockResolvedValue({ roles: ["moderateur"] });
  });

  it("un module s'ajoute à la fin de la formation", async () => {
    faux.repondre("modules.select", { data: { ordre: 2 } });
    const state = await addModule(IDLE, form({ formation_id: F, titre: "Automatisation" }));
    expect(state.status).toBe("success");
    expect(faux.de("modules", "select")[0].filtres).toContainEqual(["eq", "formation_id", F]);
    expect(faux.de("modules", "insert")[0].valeurs).toEqual({ formation_id: F, titre: "Automatisation", ordre: 3 });
    expect(refresh).toHaveBeenCalled();
  });

  it("un module sans titre est refusé", async () => {
    const state = await addModule(IDLE, form({ formation_id: F, titre: "" }));
    expect(state.fieldErrors?.titre).toBe("Entrez le titre du module.");
    expect(faux.appels).toEqual([]);
  });

  it("un module se renomme", async () => {
    await renameModule(IDLE, form({ id: M, titre: "Bases d’Excel" }));
    const [maj] = faux.de("modules", "update");
    expect(maj.valeurs).toEqual({ titre: "Bases d’Excel" });
    expect(maj.filtres).toContainEqual(["eq", "id", M]);
  });

  it("supprimer un module retire aussi les fichiers de ses leçons", async () => {
    faux.repondre("ressources.select", { data: [{ fichier: `${F}/a.pdf` }, { fichier: `${F}/b.png` }] });
    expect(await deleteModule(M)).toEqual({ ok: true });
    expect(faux.de("modules", "delete")[0].filtres).toContainEqual(["eq", "id", M]);
    expect(faux.de("storage.ressources", "remove")[0].valeurs).toEqual([[`${F}/a.pdf`, `${F}/b.png`]]);
    // La ligne d'abord, puis les fichiers (un fichier orphelin vaut mieux qu'une ressource sans fichier).
    const ordre = faux.appels.map((a) => `${a.table}.${a.op}`);
    expect(ordre.indexOf("modules.delete")).toBeLessThan(ordre.indexOf("storage.ressources.remove"));
  });

  it("une leçon naît avec un contenu vide et ouvre sa page", async () => {
    faux.repondre("modules.select", { data: { formation_id: F } });
    faux.repondre("lecons.select", { data: { ordre: 4 } });
    faux.repondre("lecons.insert", { data: { id: L } });
    const state = await addLecon(IDLE, form({ module_id: M, titre: "Introduction aux macros" }));
    expect(faux.de("lecons", "insert")[0].valeurs).toEqual({ module_id: M, titre: "Introduction aux macros", ordre: 5 });
    expect(faux.de("lecons_contenus", "insert")[0].valeurs).toEqual({ lecon_id: L });
    expect(state).toEqual({ status: "success", redirection: `/admin/formations/${F}/lecons/${L}` });
  });

  it("supprimer une leçon retire aussi ses fichiers", async () => {
    faux.repondre("ressources.select", { data: [{ fichier: `${F}/c.pdf` }] });
    expect(await deleteLecon(L)).toEqual({ ok: true });
    expect(faux.de("lecons", "delete")[0].filtres).toContainEqual(["eq", "id", L]);
    expect(faux.de("storage.ressources", "remove")[0].valeurs).toEqual([[`${F}/c.pdf`]]);
  });

  it("un étudiant ne supprime rien", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    expect(await deleteModule(M)).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect(await deleteLecon(L)).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect((await addModule(IDLE, form({ formation_id: F, titre: "Pirate" }))).message).toBe("Accès réservé à l’équipe.");
    expect(faux.appels).toEqual([]);
  });
});
