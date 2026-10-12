import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "./faux-supabase";

// ─── Doublures : Supabase, compte connecté, rafraîchissement et redirection de Next ───
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { saveParcours, saveFormateur, deplacer } = await import("@/lib/admin/actions");
const { IDLE } = await import("@/lib/auth/schemas");

const form = (valeurs: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(valeurs)) fd.set(k, v);
  return fd;
};
const PARCOURS = { nom: "Santé & bien-être", nom_court: "Santé", slug: "", description: "", couleur: "digital", actif: "on" };
const compte = (roles: string[]) => ({ prenom: "A", nom: "B", roles });

describe("Back-office : garde de l'équipe, parcours et formateurs", () => {
  beforeEach(() => {
    faux.vider();
    refresh.mockReset();
    getShellUser.mockReset();
    getShellUser.mockResolvedValue(compte(["etudiant", "admin"]));
  });

  it("un étudiant ne peut rien enregistrer", async () => {
    getShellUser.mockResolvedValue(compte(["etudiant"]));
    const state = await saveParcours(IDLE, form(PARCOURS));
    expect(state).toMatchObject({ status: "error", message: "Accès réservé à l’équipe." });
    expect(faux.de("parcours", "insert")).toEqual([]);
    expect(await deplacer("lecons", "x", -1)).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect(faux.de("rpc")).toEqual([]);
  });

  it("une session expirée est annoncée", async () => {
    getShellUser.mockResolvedValue(null);
    expect(await saveParcours(IDLE, form(PARCOURS))).toMatchObject({ status: "error", message: "Votre session a expiré. Reconnectez-vous." });
  });

  it("un parcours est créé avec une adresse tirée du nom, à la fin de la liste", async () => {
    faux.repondre("parcours.select", { data: { ordre: 3 } });
    expect(await saveParcours(IDLE, form(PARCOURS))).toEqual({ status: "success", redirection: "/admin/parcours" });
    expect(faux.de("parcours", "insert")[0].valeurs).toMatchObject({
      nom: "Santé & bien-être",
      nom_court: "Santé",
      slug: "sante-bien-etre",
      couleur: "digital",
      actif: true,
      ordre: 4,
    });
  });

  it("un parcours existant est mis à jour", async () => {
    const state = await saveParcours(IDLE, form({ ...PARCOURS, id: "p1", slug: "sante", actif: "" }));
    expect(state.status).toBe("success");
    const [maj] = faux.de("parcours", "update");
    expect(maj.valeurs).toMatchObject({ slug: "sante", actif: false });
    expect(maj.filtres).toContainEqual(["eq", "id", "p1"]);
    expect(refresh).toHaveBeenCalled();
  });

  it("une adresse déjà prise est signalée sur son champ", async () => {
    faux.repondre("parcours.update", { error: { code: "23505", message: "duplicate key" } });
    const state = await saveParcours(IDLE, form({ ...PARCOURS, id: "p1", slug: "reussite-academique" }));
    expect(state.fieldErrors?.slug).toBe("Cette adresse est déjà prise.");
    expect(state.values?.slug).toBe("reussite-academique");
  });

  it("une saisie invalide n'atteint pas la base", async () => {
    const state = await saveParcours(IDLE, form({ ...PARCOURS, nom: "" }));
    expect(state.fieldErrors?.nom).toBe("Entrez le nom du parcours.");
    expect(faux.appels).toEqual([]);
  });

  it("une fiche formateur est créée", async () => {
    expect(await saveFormateur(IDLE, form({ nom: "Dr Mireille Adjovi", titre: "Enseignante", domaine: "Statistiques", presentation: "Bio" }))).toEqual({
      status: "success",
      redirection: "/admin/formateurs",
    });
    expect(faux.de("formateurs", "insert")[0].valeurs).toEqual({ nom: "Dr Mireille Adjovi", titre: "Enseignante", domaine: "Statistiques", presentation: "Bio" });
  });

  it("déplacer appelle la fonction de la base", async () => {
    expect(await deplacer("lecons", "x", -1)).toEqual({ ok: true });
    expect(faux.de("rpc", "deplacer")[0].valeurs).toEqual({ p_table: "lecons", p_id: "x", p_sens: -1 });
    expect(refresh).toHaveBeenCalled();
  });

  it("un déplacement refusé par la base est signalé", async () => {
    faux.repondre("rpc.deplacer", { error: { message: "Table non prévue" } });
    expect(await deplacer("lecons", "x", 1)).toEqual({ ok: false, message: "Le déplacement n’a pas abouti." });
  });
});
