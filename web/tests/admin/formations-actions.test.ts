import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "./faux-supabase";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { createFormation, saveFormationInfos, setStatutFormation, deleteFormation } = await import("@/lib/admin/actions");
const { IDLE } = await import("@/lib/auth/schemas");

const F = "11111111-1111-4111-8111-111111111111";
const P1 = "22222222-2222-4222-8222-222222222222";
const P2 = "33333333-3333-4333-8333-333333333333";

const form = (valeurs: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(valeurs)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
};
const INFOS = {
  id: F,
  titre: "Maîtriser Excel",
  slug: "maitriser-excel",
  resume: "Résumé",
  description: "",
  objectifs: "A\n\n  B  \n",
  competences: "Formules",
  niveau: "intermediaire",
  formateur_id: "",
  gratuite: "on",
  badge: "",
  seuil_video: "90",
  parcours: [P1, P2],
};

describe("Back-office : formations", () => {
  beforeEach(() => {
    faux.vider();
    refresh.mockReset();
    getShellUser.mockReset();
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
  });

  it("deux formations au même titre reçoivent des adresses distinctes", async () => {
    faux.repondre("formations.select", { data: [{ slug: "maitriser-excel" }, { slug: "maitriser-excel-avance" }] });
    faux.repondre("formations.insert", { data: { id: F } });
    const state = await createFormation(IDLE, form({ titre: "Maîtriser Excel" }));
    expect(faux.de("formations", "insert")[0].valeurs).toEqual({ titre: "Maîtriser Excel", slug: "maitriser-excel-2" });
    expect(state).toEqual({ status: "success", redirection: `/admin/formations/${F}` });
  });

  it("un titre très long déjà pris reçoit un suffixe sans dépasser 80 caractères", async () => {
    // Une adresse de 79 caractères (le maximum est 80) : le suffixe oblige à la raccourcir.
    const titre = "Anticonstitutionnellement".repeat(3) + "abcd";
    const { slugify } = await import("@/lib/admin/slug");
    const base = slugify(titre);
    const coupe = (suffixe: string) => base.slice(0, 80 - suffixe.length).replace(/-+$/, "") + suffixe;
    faux.repondre("formations.select", { data: [{ slug: base }, { slug: coupe("-2") }] });
    faux.repondre("formations.insert", { data: { id: F } });
    await createFormation(IDLE, form({ titre }));
    const { slug } = faux.de("formations", "insert")[0].valeurs as { slug: string };
    expect(slug).toBe(coupe("-3"));
    expect(slug.length).toBeLessThanOrEqual(80);
    // La recherche des adresses prises couvre aussi les versions raccourcies.
    const [, motif] = faux.de("formations", "select")[0].filtres.find((f) => f[0] === "like")!.slice(1) as [string, string];
    expect(coupe("-3").startsWith(motif.replace(/%$/, ""))).toBe(true);
  });

  it("une adresse prise entre-temps est expliquée sous le titre", async () => {
    faux.repondre("formations.select", { data: [] });
    faux.repondre("formations.insert", { error: { code: "23505", message: "duplicate key" } });
    const state = await createFormation(IDLE, form({ titre: "Excel" }));
    expect(state.fieldErrors?.titre).toBe("Une autre formation vient de prendre cette adresse : réessayez.");
  });

  it("une formation sans titre n'est pas créée", async () => {
    const state = await createFormation(IDLE, form({ titre: "  " }));
    expect(state.fieldErrors?.titre).toBe("Entrez le titre de la formation.");
    expect(faux.appels).toEqual([]);
  });

  it("les réglages s'enregistrent ; le contenu (titre, résumé, description, listes, niveau) n'en fait plus partie (fin du lot 4)", async () => {
    const state = await saveFormationInfos(IDLE, form(INFOS));
    expect(state.status).toBe("success");
    const [maj] = faux.de("formations", "update");
    expect(maj.valeurs).toEqual({
      slug: "maitriser-excel",
      formateur_id: null,
      gratuite: true,
      badge: null,
      seuil_video: 90,
    });
    expect(maj.filtres).toContainEqual(["eq", "id", F]);
    expect(refresh).toHaveBeenCalled();
  });

  describe("Les compétences qu'une formation Business apprend à vendre (0048 ; restructuration, §5.3)", () => {
    const C1 = "55555555-5555-4555-8555-555555555555";
    const C2 = "66666666-6666-4666-8666-666666666666";
    const C3 = "77777777-7777-4777-8777-777777777777";
    const parcoursExistants = () =>
      faux.repondre("formations_parcours.select", (appel) => (appel.valeurs === "ordre" ? { data: { ordre: 0 } } : { data: [{ parcours_id: P1 }, { parcours_id: P2 }] }));

    it("dans le parcours Business : les compétences cochées sont liées, les décochées déliées", async () => {
      parcoursExistants();
      faux.repondre("parcours.select", { data: [{ id: P2 }] });
      faux.repondre("formations_monetisation.select", { data: [{ competence_id: C1 }, { competence_id: C3 }] });
      const state = await saveFormationInfos(IDLE, form({ ...INFOS, monetisation: "1", competences_vendues: [C1, C2] }));
      expect(state.status).toBe("success");
      expect(faux.de("parcours", "select")[0].filtres).toEqual([
        ["in", "id", [P1, P2]],
        ["eq", "couleur", "business"],
      ]);
      expect(faux.de("formations_monetisation", "delete")[0].filtres).toEqual([
        ["eq", "business_id", F],
        ["in", "competence_id", [C3]],
      ]);
      expect(faux.de("formations_monetisation", "insert")[0].valeurs).toEqual([{ business_id: F, competence_id: C2 }]);
    });

    it("plus dans le parcours Business : tous ses liens sont retirés", async () => {
      parcoursExistants();
      faux.repondre("parcours.select", { data: [] });
      faux.repondre("formations_monetisation.select", { data: [{ competence_id: C1 }] });
      await saveFormationInfos(IDLE, form({ ...INFOS, monetisation: "1", competences_vendues: [C1] }));
      expect(faux.de("formations_monetisation", "delete")[0].filtres).toEqual([
        ["eq", "business_id", F],
        ["in", "competence_id", [C1]],
      ]);
      expect(faux.de("formations_monetisation", "insert")).toEqual([]);
    });

    it("un refus de la base s'affiche sous la rubrique ; sans la rubrique, rien n'est touché", async () => {
      parcoursExistants();
      faux.repondre("parcours.select", { data: [{ id: P2 }] });
      faux.repondre("formations_monetisation.select", { data: [] });
      faux.repondre("formations_monetisation.insert", { error: { code: "P0001", message: "Choisissez une formation publiée du parcours Compétences digitales." } });
      const refus = await saveFormationInfos(IDLE, form({ ...INFOS, monetisation: "1", competences_vendues: [C1] }));
      expect(refus).toMatchObject({ status: "error", fieldErrors: { competences_vendues: "Choisissez une formation publiée du parcours Compétences digitales." } });
      faux.vider();
      parcoursExistants();
      await saveFormationInfos(IDLE, form(INFOS));
      expect(faux.de("formations_monetisation")).toEqual([]);
    });
  });

  it("un parcours coché s'ajoute à la fin de sa liste, un décoché se retire, les autres gardent leur place", async () => {
    const P3 = "44444444-4444-4444-8444-444444444444";
    // Liens existants : P1 (gardé) et P3 (décoché) ; P2 est nouveau et compte déjà 4 formations.
    faux.repondre("formations_parcours.select", (appel) =>
      appel.valeurs === "ordre" ? { data: { ordre: 4 } } : { data: [{ parcours_id: P1 }, { parcours_id: P3 }] },
    );
    await saveFormationInfos(IDLE, form(INFOS));
    const [suppression] = faux.de("formations_parcours", "delete");
    expect(suppression.filtres).toEqual([
      ["eq", "formation_id", F],
      ["in", "parcours_id", [P3]],
    ]);
    const ajouts = faux.de("formations_parcours", "insert").map((a) => a.valeurs);
    expect(ajouts).toEqual([{ formation_id: F, parcours_id: P2, ordre: 5 }]);
  });

  it("une adresse figée par la publication est expliquée sur son champ", async () => {
    faux.repondre("formations.update", { error: { code: "P0001", message: "L'adresse d'une formation publiée ne change plus." } });
    const state = await saveFormationInfos(IDLE, form({ ...INFOS, slug: "autre-adresse" }));
    expect(state.fieldErrors?.slug).toBe("L’adresse d’une formation publiée ne change plus.");
    expect(faux.de("formations_parcours")).toEqual([]);
  });

  it("un seuil invalide est refusé avant la base", async () => {
    const state = await saveFormationInfos(IDLE, form({ ...INFOS, seuil_video: "30" }));
    expect(state.fieldErrors).toMatchObject({ seuil_video: "Entre 50 et 100 %." });
    expect(faux.appels).toEqual([]);
  });

  it("on ne publie pas une formation vide", async () => {
    faux.repondre("modules.select", { data: [{ id: "m1", lecons: [] }] });
    expect(await setStatutFormation(F, "publiee")).toEqual({ ok: false, message: "Publiez au moins une leçon avant de publier la formation." });
    expect(faux.de("formations", "update")).toEqual([]);
  });

  it("une formation avec des leçons se publie, puis s'archive", async () => {
    faux.repondre("modules.select", { data: [{ id: "m1", lecons: [{ id: "l1" }] }] });
    expect(await setStatutFormation(F, "publiee")).toEqual({ ok: true });
    expect(faux.de("formations", "update")[0].valeurs).toEqual({ statut: "publiee" });
    expect(await setStatutFormation(F, "archivee")).toEqual({ ok: true });
    expect(faux.de("formations", "update")[1].valeurs).toEqual({ statut: "archivee" });
  });

  it("seul un brouillon s'efface, avec ses fichiers", async () => {
    faux.repondre("formations.select", { data: { statut: "archivee", publiee_le: "2026-10-01T00:00:00Z" } });
    expect(await deleteFormation(F)).toEqual({ ok: false, message: "Une formation publiée s’archive, elle ne s’efface pas." });
    expect(faux.de("formations", "delete")).toEqual([]);

    faux.vider();
    faux.repondre("formations.select", { data: { statut: "brouillon", publiee_le: null } });
    faux.repondre("storage.ressources.list", { data: [{ name: "a.pdf" }, { name: "b.png" }] });
    expect(await deleteFormation(F)).toEqual({ ok: true, redirection: "/admin/formations" });
    expect(faux.de("storage.ressources", "remove")[0].valeurs).toEqual([[`${F}/a.pdf`, `${F}/b.png`]]);
    expect(faux.de("formations", "delete")[0].filtres).toContainEqual(["eq", "id", F]);
  });

  it("un étudiant ne publie ni n'efface rien", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    expect(await setStatutFormation(F, "publiee")).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect(await deleteFormation(F)).toEqual({ ok: false, message: "Accès réservé aux formateurs et à l’équipe." });
    expect(faux.appels).toEqual([]);
  });
});
