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

const { saveParcours, saveFormateur, deplacer, rangerParcours, rangerFormationParcours, changerParcoursFormation, ajouterFormationParcours } = await import("@/lib/admin/actions");
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
    expect(await deplacer("lecons", "x", -1)).toEqual({ ok: false, message: "Accès réservé aux formateurs et à l’équipe." });
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
    expect(faux.de("formateurs", "insert")[0].valeurs).toEqual({ nom: "Dr Mireille Adjovi", titre: "Enseignante", domaine: "Statistiques", presentation: "Bio", reseaux: {} });
  });

  it("0070 : les réseaux renseignés sont enregistrés (sans espaces autour) ; un champ vidé retire le réseau", async () => {
    const saisie = { id: "fo1", nom: "Koffi Mensah", titre: "", domaine: "", presentation: "", instagram: "  https://instagram.com/koffi ", youtube: "", tiktok: "https://tiktok.com/@koffi" };
    expect((await saveFormateur(IDLE, form(saisie))).status).toBe("success");
    const [maj] = faux.de("formateurs", "update");
    expect(maj.valeurs).toEqual({
      nom: "Koffi Mensah",
      titre: "",
      domaine: "",
      presentation: "",
      reseaux: { instagram: "https://instagram.com/koffi", tiktok: "https://tiktok.com/@koffi" },
    });
    expect(maj.filtres).toContainEqual(["eq", "id", "fo1"]);
  });

  it("0070 : une adresse de réseau invalide est signalée sur son champ, sans rien écrire", async () => {
    const state = await saveFormateur(
      IDLE,
      form({
        nom: "Koffi Mensah",
        instagram: "http://instagram.com/koffi",
        youtube: "youtube.com/@koffi",
        linkedin: "https://linkedin.com/in/koffi mensah",
        facebook: `https://facebook.com/${"a".repeat(290)}`,
        telegram: "https://",
        tiktok: "https://tiktok.com/@koffi",
      }),
    );
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toEqual({
      instagram: "L’adresse doit commencer par https://.",
      youtube: "L’adresse doit commencer par https://.",
      linkedin: "L’adresse ne doit pas contenir d’espace.",
      facebook: "300 caractères au maximum.",
      telegram: "Complétez l’adresse après https://.",
    });
    expect(state.values).toMatchObject({ instagram: "http://instagram.com/koffi", tiktok: "https://tiktok.com/@koffi" });
    expect(faux.appels).toEqual([]);
  });

  it("0070 absente : la fiche s'enregistre sans les réseaux ; des réseaux saisis demandent la migration", async () => {
    // La colonne n'existe pas : PostgREST répond PGRST204 à l'écriture.
    faux.repondre("formateurs.update", (appel) =>
      appel.valeurs && typeof appel.valeurs === "object" && "reseaux" in appel.valeurs ? { error: { code: "PGRST204", message: "Could not find the 'reseaux' column" } } : {},
    );
    expect((await saveFormateur(IDLE, form({ id: "fo1", nom: "Koffi Mensah" }))).status).toBe("success");
    expect(faux.de("formateurs", "update").map((a) => a.valeurs)).toEqual([
      { nom: "Koffi Mensah", titre: "", domaine: "", presentation: "", reseaux: {} },
      { nom: "Koffi Mensah", titre: "", domaine: "", presentation: "" },
    ]);

    faux.vider();
    faux.repondre("formateurs.insert", (appel) =>
      appel.valeurs && typeof appel.valeurs === "object" && "reseaux" in appel.valeurs ? { error: { code: "42703", message: "column \"reseaux\" does not exist" } } : {},
    );
    const state = await saveFormateur(IDLE, form({ nom: "Koffi Mensah", instagram: "https://instagram.com/koffi" }));
    expect(state).toMatchObject({ status: "error", message: "Les réseaux ne peuvent pas encore être enregistrés : appliquez la migration 0070, ou videz ces champs." });
    expect(state.values?.instagram).toBe("https://instagram.com/koffi");
    expect(faux.de("formateurs", "insert")).toHaveLength(1);
  });

  it("ranger un parcours (glisser-déposer) : autant de crans que nécessaire, dans le bon sens", async () => {
    const [P1, P2, P3] = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
    faux.repondre("parcours.select", { data: [{ id: P1 }, { id: P2 }, { id: P3 }] });
    expect(await rangerParcours(P3, 1)).toEqual({ ok: true });
    expect(faux.de("rpc", "deplacer").map((a) => a.valeurs)).toEqual([
      { p_table: "parcours", p_id: P3, p_sens: -1 },
      { p_table: "parcours", p_id: P3, p_sens: -1 },
    ]);
    faux.vider();
    faux.repondre("parcours.select", { data: [{ id: P1 }, { id: P2 }, { id: P3 }] });
    expect(await rangerParcours(P1, 9)).toEqual({ ok: true });
    expect(faux.de("rpc", "deplacer").map((a) => (a.valeurs as { p_sens: number }).p_sens)).toEqual([1, 1]);
    getShellUser.mockResolvedValue(compte(["etudiant", "formateur"]));
    expect((await rangerParcours(P1, 2)).ok).toBe(false);
    expect((await rangerParcours("pas-un-uuid", 1)).ok).toBe(false);
  });

  it("la fiche d'un parcours : ranger, changer de parcours, ajouter une formation (0066)", async () => {
    const [P1, P2, F] = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
    expect(await rangerFormationParcours(P1, F, 2)).toEqual({ ok: true });
    expect(faux.de("rpc", "ranger_formation_parcours")[0].valeurs).toEqual({ p_parcours: P1, p_formation: F, p_position: 2 });
    expect(await changerParcoursFormation(F, P1, P2)).toEqual({ ok: true });
    expect(faux.de("rpc", "changer_parcours_formation")[0].valeurs).toEqual({ p_formation: F, p_depuis: P1, p_vers: P2 });
    expect(await ajouterFormationParcours(P2, F)).toEqual({ ok: true });
    expect(faux.de("rpc", "ajouter_formation_parcours")[0].valeurs).toEqual({ p_parcours: P2, p_formation: F });
    expect(refresh).toHaveBeenCalled();
    // Le refus de la base est rendu tel quel ; sans la 0066, on le dit.
    faux.repondre("rpc.changer_parcours_formation", { error: { code: "P0001", message: "Cette formation est liée à la monétisation : retirez d'abord ce lien dans sa fiche." } });
    expect(await changerParcoursFormation(F, P1, P2)).toEqual({ ok: false, message: "Cette formation est liée à la monétisation : retirez d’abord ce lien dans sa fiche." });
    faux.repondre("rpc.ajouter_formation_parcours", { error: { code: "PGRST202" } });
    expect(await ajouterFormationParcours(P2, F)).toEqual({ ok: false, message: "Appliquez la migration 0066 (guide « Ce qui te revient », section 65)." });
    expect((await rangerFormationParcours("x", F, 1)).ok).toBe(false);
    getShellUser.mockResolvedValue(compte(["etudiant", "formateur"]));
    expect((await ajouterFormationParcours(P2, F)).ok).toBe(false);
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
