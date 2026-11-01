import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { listCatalogue, listParcoursCatalogue, getFiche } = await import("@/lib/catalogue/data");

const PARCOURS = { slug: "reussite-academique", nom: "Réussite académique", nom_court: "Académique", couleur: "academique", ordre: 1, actif: true };
const LIGNE = {
  id: "f1",
  slug: "maitriser-microsoft-excel",
  titre: "Maîtriser Microsoft Excel",
  resume: "Formules…",
  niveau: "intermediaire",
  gratuite: false,
  achat_separe: true,
  badge: "populaire",
  publiee_le: "2026-08-13T00:00:00Z",
  formations_parcours: [{ ordre: 2, parcours: PARCOURS }],
  modules: [
    { lecons: [{ duree_secondes: 370 }, { duree_secondes: 750 }] },
    { lecons: [{ duree_secondes: 800 }] },
  ],
};

describe("Lecture du catalogue", () => {
  beforeEach(() => {
    faux.vider();
  });

  it("les cartes portent la durée totale et le nombre de leçons, et seules les formations publiées sont demandées", async () => {
    faux.repondre("formations.select", { data: [LIGNE] });
    const [carte] = await listCatalogue();
    expect(carte).toMatchObject({ slug: "maitriser-microsoft-excel", dureeSecondes: 1920, nbLecons: 3, badge: "populaire" });
    expect(carte.parcours).toEqual([{ slug: "reussite-academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", ordre: 1, position: 2 }]);
    expect(faux.de("formations", "select")[0].filtres).toContainEqual(["eq", "statut", "publiee"]);
  });

  it("un parcours désactivé n'apparaît pas sur la carte", async () => {
    faux.repondre("formations.select", { data: [{ ...LIGNE, formations_parcours: [{ ordre: 1, parcours: { ...PARCOURS, actif: false } }] }] });
    const [carte] = await listCatalogue();
    expect(carte.parcours).toEqual([]);
  });

  it("les parcours du catalogue sont les parcours actifs, dans l'ordre", async () => {
    faux.repondre("parcours.select", { data: [PARCOURS] });
    expect(await listParcoursCatalogue()).toEqual([
      { slug: "reussite-academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", ordre: 1, description: "" },
    ]);
    expect(faux.de("parcours", "select")[0].filtres).toContainEqual(["eq", "actif", true]);
  });

  it("la fiche lit le programme dans l'ordre, sans jamais demander le contenu des leçons", async () => {
    faux.repondre("formations.select", {
      data: {
        ...LIGNE,
        description: "Description",
        objectifs: ["A"],
        competences: ["B"],
        formateurs: { nom: "Dr Mireille Adjovi", titre: "Enseignante", domaine: "Stats", presentation: "Bio" },
        modules: [
          { id: "m2", titre: "Formules et fonctions", ordre: 2, lecons: [{ id: "l3", titre: "SI, ET, OU", duree_secondes: 800, apercu: false, ordre: 1, accessible: false }] },
          {
            id: "m1",
            titre: "Bases d’Excel",
            ordre: 1,
            lecons: [
              { id: "l2", titre: "Saisir", duree_secondes: 750, apercu: true, ordre: 2, accessible: true },
              { id: "l1", titre: "Découvrir", duree_secondes: 370, apercu: true, ordre: 1, accessible: true },
            ],
          },
        ],
      },
    });
    const fiche = await getFiche("maitriser-microsoft-excel");
    expect(fiche?.modules.map((m) => m.titre)).toEqual(["Bases d’Excel", "Formules et fonctions"]);
    expect(fiche?.modules[0].lecons.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(fiche).toMatchObject({ dureeSecondes: 1920, nbLecons: 3, formateur: { nom: "Dr Mireille Adjovi" }, objectifs: ["A"] });
    const [appel] = faux.de("formations", "select");
    expect(String(appel.valeurs)).not.toContain("lecons_contenus");
    expect(String(appel.valeurs)).toContain("accessible");
    expect(appel.filtres).toContainEqual(["eq", "statut", "publiee"]);
    expect(appel.filtres).toContainEqual(["eq", "slug", "maitriser-microsoft-excel"]);
  });

  it("une adresse qui ne peut pas être celle d'une formation ne trouve rien, sans requête", async () => {
    expect(await getFiche("Node.js")).toBeNull();
    expect(await getFiche("../admin")).toBeNull();
    expect(faux.appels).toEqual([]);
  });

  it("les cartes et la fiche portent la note moyenne et le nombre d'avis (migration 0010)", async () => {
    faux.repondre("formations.select", { data: [{ ...LIGNE, note_moyenne: 4.8, nb_avis: 126 }] });
    const [carte] = await listCatalogue();
    expect(carte).toMatchObject({ note: 4.8, nbAvis: 126 });
    expect(String(faux.de("formations", "select")[0].valeurs)).toContain("note_moyenne, nb_avis");
    faux.repondre("formations.select", { data: [LIGNE] });
    expect(await listCatalogue()).toMatchObject([{ note: null, nbAvis: 0 }]);
  });

  it("sans la migration 0010 (colonne absente, 42703), le catalogue et la fiche se relisent sans les notes", async () => {
    const reponse = (appel: { valeurs?: unknown }) => (String(appel.valeurs).includes("note_moyenne") ? { error: { code: "42703" } } : { data: [LIGNE] });
    faux.repondre("formations.select", reponse);
    expect(await listCatalogue()).toMatchObject([{ slug: "maitriser-microsoft-excel", note: null, nbAvis: 0, couverture: null }]);
    // Avec le type des leçons (0031) et la couverture, puis la couverture (0012), puis les seules notes (0010), puis rien.
    expect(faux.de("formations", "select")).toHaveLength(4);
    faux.vider();
    faux.repondre("formations.select", (appel) => (String(appel.valeurs).includes("note_moyenne") ? { error: { code: "42703" } } : { data: LIGNE }));
    expect(await getFiche("maitriser-microsoft-excel")).toMatchObject({ slug: "maitriser-microsoft-excel", note: null, nbAvis: 0 });
  });

  it("la couverture est lue (migration 0012) ; sans elle, les notes restent", async () => {
    faux.repondre("formations.select", { data: [{ ...LIGNE, note_moyenne: 4.8, nb_avis: 126, couverture: "f1/a.jpg" }] });
    expect(await listCatalogue()).toMatchObject([{ couverture: "f1/a.jpg", note: 4.8 }]);
    expect(String(faux.de("formations", "select")[0].valeurs)).toContain("note_moyenne, nb_avis, couverture");
    faux.vider();
    faux.repondre("formations.select", (appel) =>
      String(appel.valeurs).includes("couverture") ? { error: { code: "42703" } } : { data: [{ ...LIGNE, note_moyenne: 4.8, nb_avis: 126 }] },
    );
    expect(await listCatalogue()).toMatchObject([{ couverture: null, note: 4.8, nbAvis: 126 }]);
  });

  it("les tables absentes sont signalées", async () => {
    faux.repondre("formations.select", { error: { code: "PGRST205" } });
    await expect(listCatalogue()).rejects.toMatchObject({ name: "TablesAbsentesError" });
  });
});
