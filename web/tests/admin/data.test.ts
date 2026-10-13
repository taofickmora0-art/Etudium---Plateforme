import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "./faux-supabase";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { getFormationAdmin, getLeconAdmin, listParcours, TablesAbsentesError } = await import("@/lib/admin/data");

describe("Lecture des contenus du back-office", () => {
  beforeEach(() => {
    faux.vider();
  });

  it("la formation porte sa couverture (0012) ; sans la colonne, le back-office s'ouvre quand même", async () => {
    const ligne = { id: "f1", slug: "excel", titre: "Excel", statut: "brouillon", niveau: "debutant", modules: [], formations_parcours: [] };
    faux.repondre("formations.select", { data: { ...ligne, couverture: "f1/a.jpg" } });
    expect(await getFormationAdmin("00000000-0000-4000-8000-000000000001")).toMatchObject({ couverture: "f1/a.jpg" });
    faux.vider();
    faux.repondre("formations.select", (appel) => (String(appel.valeurs).includes("couverture") ? { error: { code: "42703" } } : { data: ligne }));
    expect(await getFormationAdmin("00000000-0000-4000-8000-000000000001")).toMatchObject({ titre: "Excel", couverture: null });
  });

  it("une formation est lue avec son programme dans l'ordre", async () => {
    faux.repondre("formations.select", {
      data: {
        id: "f1",
        slug: "excel",
        titre: "Excel",
        statut: "brouillon",
        niveau: "debutant",
        resume: "",
        description: "",
        objectifs: ["A"],
        competences: [],
        formateur_id: null,
        gratuite: true,
        achat_separe: false,
        prix_fcfa: null,
        badge: null,
        seuil_video: 90,
        publiee_le: null,
        formations_parcours: [{ parcours_id: "p1", parcours: { nom_court: "Académique" } }],
        modules: [
          { id: "m2", titre: "Second", ordre: 2, lecons: [] },
          {
            id: "m1",
            titre: "Premier",
            ordre: 1,
            lecons: [
              { id: "l2", titre: "Deux", duree_secondes: 60, apercu: false, ordre: 2, lecons_contenus: null },
              { id: "l1", titre: "Un", duree_secondes: 370, apercu: true, ordre: 1, lecons_contenus: { video_id: "dQw4w9WgXcQ" } },
            ],
          },
        ],
      },
    });
    const formation = await getFormationAdmin("00000000-0000-4000-8000-000000000001");
    expect(formation?.modules.map((m) => m.titre)).toEqual(["Premier", "Second"]);
    expect(formation?.modules[0].lecons).toEqual([
      { id: "l1", titre: "Un", dureeSecondes: 370, apercu: true, aVideo: true },
      { id: "l2", titre: "Deux", dureeSecondes: 60, apercu: false, aVideo: false },
    ]);
    expect(formation).toMatchObject({ seuilVideo: 90, parcoursIds: ["p1"], parcours: ["Académique"], nbLecons: 2, objectifs: ["A"] });
  });

  it("une leçon est lue avec sa vidéo et ses ressources dans l'ordre", async () => {
    faux.repondre("lecons.select", {
      data: {
        id: "l1",
        module_id: "m1",
        titre: "Les tableaux croisés dynamiques",
        titre_court: null,
        duree_secondes: 760,
        apercu: false,
        resume: "",
        points_cles: [],
        modules: { formation_id: "f1", formations: { titre: "Excel" } },
        lecons_contenus: [{ video_fournisseur: "youtube", video_id: "dQw4w9WgXcQ", texte: "" }],
        ressources: [
          { id: "r2", titre: "B", fichier: "f1/b.pdf", format: "application/pdf", taille_octets: 10, telechargeable: false, ordre: 2 },
          { id: "r1", titre: "A", fichier: "f1/a.pdf", format: "application/pdf", taille_octets: 10, telechargeable: true, ordre: 1 },
        ],
      },
    });
    const lecon = await getLeconAdmin("00000000-0000-4000-8000-000000000002");
    expect(lecon).toMatchObject({ formationId: "f1", formationTitre: "Excel", dureeSecondes: 760, video: { fournisseur: "youtube", id: "dQw4w9WgXcQ" } });
    expect(lecon?.ressources.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("une adresse inventée ne trouve rien, sans interroger la base", async () => {
    expect(await getFormationAdmin("n-importe-quoi")).toBeNull();
    expect(await getLeconAdmin("123")).toBeNull();
    expect(faux.appels).toEqual([]);
  });

  it("les tables absentes sont signalées", async () => {
    faux.repondre("parcours.select", { error: { code: "PGRST205", message: "Could not find the table" } });
    await expect(listParcours()).rejects.toBeInstanceOf(TablesAbsentesError);
  });
});
