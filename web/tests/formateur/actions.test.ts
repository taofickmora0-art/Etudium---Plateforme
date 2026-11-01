import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Les actions de contenu du back-office s'ouvrent au formateur, sur ses formations (spec de l'espace formateur, §6) ;
// la base vérifie que la formation est la sienne (migration 0014).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { createFormation, saveFormationInfos, addLecon, addModule, deplacer, deleteFormation, envoyerEnRelecture, renvoyerAuFormateur } = await import(
  "@/lib/admin/actions"
);
const { IDLE } = await import("@/lib/auth/schemas");

const F = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";
const L = "33333333-3333-4333-8333-333333333333";
const FORMATEUR = { roles: ["etudiant", "formateur"] };
const ADMIN = { roles: ["etudiant", "admin"] };
const ACCES_EDITEUR = "Accès réservé aux formateurs et à l’équipe.";

const form = (valeurs: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(valeurs)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
};

describe("Actions du formateur", () => {
  beforeEach(() => {
    faux.vider();
    refresh.mockReset();
    getShellUser.mockResolvedValue(FORMATEUR);
  });

  it("le formateur crée une formation, puis va à son éditeur dans l'espace formateur", async () => {
    faux.repondre("formations.select", { data: [] });
    faux.repondre("formations.insert", { data: { id: F } });
    expect(await createFormation(IDLE, form({ titre: "Excel", espace: "formateur" }))).toEqual({ status: "success", redirection: `/formateur/formations/${F}` });
    // Sans espace (ou une valeur inconnue) : le back-office, comme avant.
    getShellUser.mockResolvedValue(ADMIN);
    expect(await createFormation(IDLE, form({ titre: "Excel", espace: "pirate" }))).toEqual({ status: "success", redirection: `/admin/formations/${F}` });
  });

  it("une adresse prise par un brouillon qu'il ne voit pas : la création réessaie avec -2", async () => {
    faux.repondre("formations.select", { data: [] });
    let essais = 0;
    faux.repondre("formations.insert", () => (++essais === 1 ? { error: { code: "23505", message: "duplicate key" } } : { data: { id: F } }));
    expect(await createFormation(IDLE, form({ titre: "Excel", espace: "formateur" }))).toEqual({ status: "success", redirection: `/formateur/formations/${F}` });
    expect(faux.de("formations", "insert").map((a) => (a.valeurs as { slug: string }).slug)).toEqual(["excel", "excel-2"]);
  });

  it("enregistrer les Informations en formateur n'envoie aucun réglage de l'équipe", async () => {
    faux.repondre("formations_parcours.select", { data: [] });
    const state = await saveFormationInfos(
      IDLE,
      form({
        id: F,
        titre: "Excel",
        slug: "excel",
        resume: "Résumé",
        description: "",
        objectifs: "A",
        competences: "",
        niveau: "debutant",
        formateur_id: M,
        gratuite: "on",
        achat_separe: "on",
        prix_fcfa: "5000",
        badge: "populaire",
        seuil_video: "60",
      }),
    );
    expect(state.status).toBe("success");
    const [maj] = faux.de("formations", "update");
    // Le contenu s'enregistre seul, à part (fin du lot 4) : il reste l'adresse.
    expect(Object.keys(maj.valeurs as object).sort()).toEqual(["slug"]);
  });

  it("l'équipe, elle, enregistre toujours les réglages", async () => {
    getShellUser.mockResolvedValue(ADMIN);
    faux.repondre("formations_parcours.select", { data: [] });
    await saveFormationInfos(IDLE, form({ id: F, titre: "Excel", slug: "excel", niveau: "debutant", gratuite: "on", seuil_video: "90" }));
    expect(faux.de("formations", "update")[0].valeurs).toMatchObject({ gratuite: true, seuil_video: 90 });
  });

  it("ajouter une leçon en formateur mène à la leçon dans l'espace formateur", async () => {
    faux.repondre("modules.select", { data: { formation_id: F } });
    faux.repondre("lecons.insert", { data: { id: L } });
    expect(await addLecon(IDLE, form({ module_id: M, titre: "Leçon", espace: "formateur" }))).toEqual({
      status: "success",
      redirection: `/formateur/formations/${F}/lecons/${L}`,
    });
  });

  it("supprimer un brouillon en formateur ramène à Mes formations", async () => {
    faux.repondre("formations.select", { data: { statut: "brouillon", publiee_le: null } });
    expect(await deleteFormation(F, "formateur")).toEqual({ ok: true, redirection: "/formateur/formations" });
  });

  it("supprimer un brouillon retire ses fichiers et sa couverture avant la formation (ensuite, ils ne seraient plus à lui)", async () => {
    faux.repondre("formations.select", { data: { statut: "brouillon", publiee_le: null } });
    faux.repondre("storage.ressources.list", { data: [{ name: "a.pdf" }] });
    faux.repondre("storage.couvertures.list", { data: [{ name: "c.jpg" }] });
    expect(await deleteFormation(F, "formateur")).toMatchObject({ ok: true });
    const ordre = faux.appels.map((a) => `${a.table}.${a.op}`).filter((c) => c.endsWith(".remove") || c === "formations.delete");
    expect(ordre).toEqual(["storage.ressources.remove", "storage.couvertures.remove", "formations.delete"]);
    expect(faux.de("storage.ressources", "remove")[0].valeurs).toEqual([[`${F}/a.pdf`]]);
    expect(faux.de("storage.couvertures", "remove")[0].valeurs).toEqual([[`${F}/c.jpg`]]);
  });

  it("un compte de l'équipe qui est aussi formateur enregistre les Informations depuis l'espace formateur (contenu seulement)", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur", "admin"] });
    faux.repondre("formations_parcours.select", { data: [] });
    const state = await saveFormationInfos(IDLE, form({ id: F, espace: "formateur", titre: "Excel", slug: "excel", resume: "", description: "", objectifs: "", competences: "", niveau: "debutant" }));
    expect(state.status).toBe("success");
    expect(Object.keys(faux.de("formations", "update")[0].valeurs as object).sort()).toEqual(["slug"]);
  });

  it("le formateur réordonne modules, leçons et ressources, pas les parcours", async () => {
    expect(await deplacer("modules", M, 1)).toEqual({ ok: true });
    expect(await deplacer("parcours", M, 1)).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect(faux.de("rpc", "deplacer")).toHaveLength(1);
  });

  it("envoyer en relecture : la fonction de la base ; son refus est affiché", async () => {
    expect(await envoyerEnRelecture(F)).toEqual({ ok: true });
    expect(faux.de("rpc", "envoyer_en_relecture")[0].valeurs).toEqual({ p_formation: F });
    expect(refresh).toHaveBeenCalled();
    faux.repondre("rpc.envoyer_en_relecture", { error: { code: "P0001", message: "Ajoutez au moins une leçon avant d'envoyer la formation en relecture." } });
    expect(await envoyerEnRelecture(F)).toEqual({ ok: false, message: "Ajoutez au moins une leçon avant d’envoyer la formation en relecture." });
    expect(await envoyerEnRelecture("abc")).toMatchObject({ ok: false });
  });

  it("renvoyer au formateur : l'équipe seulement, remarque transmise (coupée à 1 000 caractères)", async () => {
    expect(await renvoyerAuFormateur(F, "Ajoutez une vidéo.")).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect(faux.de("rpc", "renvoyer_au_formateur")).toEqual([]);
    getShellUser.mockResolvedValue(ADMIN);
    expect(await renvoyerAuFormateur(F, `  ${"x".repeat(1200)}  `)).toEqual({ ok: true });
    expect(faux.de("rpc", "renvoyer_au_formateur")[0].valeurs).toEqual({ p_formation: F, p_remarque: "x".repeat(1000) });
    faux.repondre("rpc.renvoyer_au_formateur", { error: { code: "P0001", message: "Cette formation n’attend pas de validation." } });
    expect(await renvoyerAuFormateur(F, "Non")).toEqual({ ok: false, message: "Cette formation n’attend pas de validation." });
  });

  it("un étudiant est refusé, sans appel à la base", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    expect((await createFormation(IDLE, form({ titre: "Excel" }))).message).toBe(ACCES_EDITEUR);
    expect((await addModule(IDLE, form({ formation_id: F, titre: "Module" }))).message).toBe(ACCES_EDITEUR);
    expect(await envoyerEnRelecture(F)).toEqual({ ok: false, message: ACCES_EDITEUR });
    expect(await deplacer("lecons", L, -1)).toEqual({ ok: false, message: ACCES_EDITEUR });
    expect(faux.appels).toEqual([]);
  });
});
