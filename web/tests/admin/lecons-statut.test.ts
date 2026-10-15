import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase, type Appel } from "./faux-supabase";

// Refonte des formations, étape A : le statut d'une leçon, le rangement, et les lectures de l'éditeur (migration 0027).
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { addLecon, changerStatutLecon, ranger, saveLecon, setStatutFormation } = await import("@/lib/admin/actions");
const { getFormationAdmin, getLeconAdmin } = await import("@/lib/admin/data");
const { IDLE } = await import("@/lib/auth/schemas");

const F = "11111111-1111-4111-8111-111111111111";
const M1 = "22222222-2222-4222-8222-222222222221";
const M2 = "22222222-2222-4222-8222-222222222222";
const L = "33333333-3333-4333-8333-333333333333";
const MIGRATION = "Appliquez la migration 0027 (guide « Ce qui te revient », section 33).";
const COLONNE_ABSENTE = { code: "42703", message: "column lecons.publiee does not exist" };
const form = (valeurs: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(valeurs)) fd.set(k, v);
  return fd;
};
const avecColonne = (colonne: string) => (appel: Appel) => JSON.stringify(appel.valeurs ?? "").includes(colonne);

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockReset().mockResolvedValue({ roles: ["admin"] });
});

describe("Le statut d'une leçon", () => {
  it("publier ou mettre en brouillon ; hors équipe et formateur, refusé ; avant la 0027, le message", async () => {
    expect(await changerStatutLecon(L, true)).toEqual({ ok: true });
    expect(faux.de("lecons", "update")[0]).toMatchObject({ valeurs: { publiee: true }, filtres: [["eq", "id", L]] });
    expect(refresh).toHaveBeenCalled();
    expect(await changerStatutLecon("abc", false)).toMatchObject({ ok: false });
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    expect(await changerStatutLecon(L, false)).toMatchObject({ ok: false });
    getShellUser.mockResolvedValue({ roles: ["admin"] });
    faux.repondre("lecons.update", { error: COLONNE_ABSENTE });
    expect(await changerStatutLecon(L, false)).toEqual({ ok: false, message: MIGRATION });
  });

  it("une nouvelle leçon : publiée dans une formation jamais publiée, brouillon sinon ; avant la 0027, sans la colonne", async () => {
    faux.repondre("lecons.insert", { data: { id: L } });
    faux.repondre("modules.select", { data: { formation_id: F, formations: { publiee_le: null } } });
    expect(await addLecon(IDLE, form({ module_id: M1, titre: "Nouvelle" }))).toMatchObject({ status: "success" });
    expect(faux.de("lecons", "insert")[0].valeurs).toMatchObject({ module_id: M1, titre: "Nouvelle", publiee: true });
    faux.vider();
    faux.repondre("lecons.insert", { data: { id: L } });
    faux.repondre("modules.select", { data: { formation_id: F, formations: { publiee_le: "2026-10-01T10:00:00Z" } } });
    await addLecon(IDLE, form({ module_id: M1, titre: "Nouvelle" }));
    expect(faux.de("lecons", "insert")[0].valeurs).toMatchObject({ publiee: false });
    // Avant la 0027 : la colonne manque, la leçon est ajoutée sans elle.
    faux.vider();
    faux.repondre("modules.select", { data: { formation_id: F, formations: { publiee_le: "2026-10-01T10:00:00Z" } } });
    faux.repondre("lecons.insert", (appel) => (avecColonne("publiee")(appel) ? { error: COLONNE_ABSENTE } : { data: { id: L } }));
    expect(await addLecon(IDLE, form({ module_id: M1, titre: "Nouvelle" }))).toMatchObject({ status: "success" });
    expect(faux.de("lecons", "insert").map((a) => a.valeurs)).toEqual([expect.objectContaining({ publiee: false }), expect.not.objectContaining({ publiee: expect.anything() })]);
  });

  it("enregistrer une leçon : « Activer les commentaires » transmis ; avant la 0027, enregistrée sans", async () => {
    const saisie = { id: L, titre: "Titre", titre_court: "", duree: "0:00", video: "", resume: "", points_cles: "", texte: "**Gras**" };
    expect(await saveLecon(IDLE, form({ ...saisie, commentaires_actifs: "on" }))).toMatchObject({ status: "success" });
    expect(faux.de("lecons", "update")[0].valeurs).toMatchObject({ commentaires_actifs: true });
    faux.vider();
    await saveLecon(IDLE, form(saisie));
    expect(faux.de("lecons", "update")[0].valeurs).toMatchObject({ commentaires_actifs: false });
    faux.vider();
    faux.repondre("lecons.update", (appel) => (avecColonne("commentaires_actifs")(appel) ? { error: { code: "PGRST204", message: "Could not find the 'commentaires_actifs' column" } } : {}));
    expect(await saveLecon(IDLE, form(saisie))).toMatchObject({ status: "success" });
    expect(faux.de("lecons", "update")).toHaveLength(2);
  });

  it("publier une formation : au moins une leçon publiée ; avant la 0027, toutes comptent", async () => {
    faux.repondre("modules.select", (appel) =>
      avecColonne("publiee")(appel) ? { data: [{ id: M1, lecons: [{ id: L, publiee: false }] }] } : { data: [{ id: M1, lecons: [{ id: L }] }] },
    );
    expect(await setStatutFormation(F, "publiee")).toEqual({ ok: false, message: "Publiez au moins une leçon avant de publier la formation." });
    expect(faux.de("formations", "update")).toEqual([]);
    faux.vider();
    faux.repondre("modules.select", (appel) => (avecColonne("publiee")(appel) ? { error: COLONNE_ABSENTE } : { data: [{ id: M1, lecons: [{ id: L }] }] }));
    expect(await setStatutFormation(F, "publiee")).toEqual({ ok: true });
  });
});

describe("Ranger", () => {
  it("une leçon vers une section, à un rang ; une section ; refus d'une demande mal formée ; avant la 0027, le message", async () => {
    expect(await ranger("lecons", L, M2, 1)).toEqual({ ok: true });
    expect(faux.de("rpc", "ranger")[0].valeurs).toEqual({ p_table: "lecons", p_id: L, p_parent: M2, p_position: 1 });
    expect(await ranger("modules", M1, null, 2)).toEqual({ ok: true });
    expect(faux.de("rpc", "ranger")[1].valeurs).toEqual({ p_table: "modules", p_id: M1, p_parent: null, p_position: 2 });
    expect(await ranger("lecons", L, "abc", 1)).toMatchObject({ ok: false });
    expect(await ranger("lecons", L, M2, 0)).toMatchObject({ ok: false });
    expect(await ranger("ressources" as "lecons", L, null, 1)).toMatchObject({ ok: false });
    expect(faux.de("rpc", "ranger")).toHaveLength(2);
    faux.repondre("rpc.ranger", { error: { code: "PGRST202" } });
    expect(await ranger("lecons", L, M2, 1)).toEqual({ ok: false, message: MIGRATION });
    faux.repondre("rpc.ranger", { error: { code: "P0001", message: "Cette section n'est pas dans la même formation." } });
    expect(await ranger("lecons", L, M2, 1)).toEqual({ ok: false, message: "Cette section n’est pas dans la même formation." });
  });
});

describe("Les lectures de l'éditeur", () => {
  const PROGRAMME = {
    id: F,
    titre: "Excel",
    slug: "excel",
    modules: [
      { id: M2, titre: "Aller plus loin", ordre: 2, lecons: [{ id: "l3", ordre: 1 }] },
      { id: M1, titre: "Les bases", ordre: 1, lecons: [{ id: "l2", ordre: 2 }, { id: L, ordre: 1 }] },
    ],
  };
  const LECON = {
    id: L,
    module_id: M1,
    titre: "Première",
    titre_court: null,
    duree_secondes: 0,
    apercu: false,
    resume: "",
    points_cles: [],
    publiee: false,
    commentaires_actifs: true,
    modules: { formation_id: F, formations: PROGRAMME },
    lecons_contenus: { video_fournisseur: null, video_id: null, texte: "" },
    ressources: [],
  };

  it("une leçon : statut, commentaires, « Leçon 1 sur 3 · Module 1 », voisines dans l'ordre de la formation", async () => {
    faux.repondre("lecons.select", { data: LECON });
    expect(await getLeconAdmin(L)).toMatchObject({
      publiee: false,
      commentairesActifs: true,
      formationSlug: "excel",
      position: { rang: 1, total: 3, module: { rang: 1, titre: "Les bases" } },
      voisines: { precedente: null, suivante: "l2" },
    });
  });

  it("avant la 0027 : publiée et commentaires actifs par défaut", async () => {
    faux.repondre("lecons.select", (appel) => (avecColonne("commentaires_actifs")(appel) ? { error: COLONNE_ABSENTE } : { data: { ...LECON, publiee: undefined, commentaires_actifs: undefined } }));
    expect(await getLeconAdmin(L)).toMatchObject({ publiee: true, commentairesActifs: true });
  });

  it("le programme d'une formation : le statut de chaque leçon (publiée sans la 0027)", async () => {
    const formation = (lecons: Record<string, unknown>[]) => ({ id: F, slug: "excel", titre: "Excel", statut: "brouillon", niveau: "debutant", modules: [{ id: M1, titre: "Les bases", ordre: 1, lecons }] });
    faux.repondre("formations.select", { data: formation([{ id: L, titre: "Première", duree_secondes: 0, apercu: false, ordre: 1, publiee: false }]) });
    expect((await getFormationAdmin(F))?.modules[0].lecons[0]).toMatchObject({ id: L, publiee: false });
    faux.vider();
    faux.repondre("formations.select", (appel) => (avecColonne("ordre, publiee")(appel) ? { error: COLONNE_ABSENTE } : { data: formation([{ id: L, titre: "Première", duree_secondes: 0, apercu: false, ordre: 1 }]) }));
    expect((await getFormationAdmin(F))?.modules[0].lecons[0]).toMatchObject({ publiee: true });
  });
});
