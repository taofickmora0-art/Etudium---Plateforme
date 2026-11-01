import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "./faux-supabase";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { getFormationAdmin, getLeconAdmin, listFormations, listParcours, TablesAbsentesError } = await import("@/lib/admin/data");

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

  it("relecture (0014) : la formation porte ses dates et sa remarque ; nulles avant la migration", async () => {
    const ligne = { id: "f1", slug: "excel", titre: "Excel", statut: "brouillon", niveau: "debutant", modules: [], formations_parcours: [] };
    const relecture = { envoyee_le: null, renvoyee_le: "2026-10-13T08:00:00Z", remarque_relecture: "Ajoutez une vidéo.", modifiee_par_formateur_le: null };
    faux.repondre("formations.select", { data: { ...ligne, couverture: null, ...relecture } });
    expect(await getFormationAdmin("00000000-0000-4000-8000-000000000001")).toMatchObject({
      etat: "a_corriger",
      envoyeeLe: null,
      renvoyeeLe: "2026-10-13T08:00:00Z",
      remarqueRelecture: "Ajoutez une vidéo.",
      modifieeParFormateurLe: null,
    });
    faux.vider();
    faux.repondre("formations.select", (appel) => (String(appel.valeurs).includes("envoyee_le") ? { error: { code: "42703" } } : { data: { ...ligne, couverture: "f1/a.jpg" } }));
    expect(await getFormationAdmin("00000000-0000-4000-8000-000000000001")).toMatchObject({ couverture: "f1/a.jpg", etat: "brouillon", envoyeeLe: null, remarqueRelecture: null });
  });

  it("la liste des formations : états de relecture, et lisible avant la 0014", async () => {
    const lignes = [
      { id: "f1", slug: "a", titre: "A", statut: "brouillon", niveau: "debutant", envoyee_le: "2026-10-13T08:00:00Z", renvoyee_le: null, modifiee_par_formateur_le: null, modules: [], formations_parcours: [] },
      { id: "f2", slug: "b", titre: "B", statut: "publiee", niveau: "debutant", envoyee_le: null, renvoyee_le: null, modifiee_par_formateur_le: "2026-10-12T08:00:00Z", modules: [], formations_parcours: [] },
    ];
    faux.repondre("formations.select", { data: lignes });
    expect((await listFormations()).map((f) => [f.etat, f.modifieeParFormateurLe])).toEqual([
      ["en_attente", null],
      ["publiee", "2026-10-12T08:00:00Z"],
    ]);
    expect(faux.de("formations", "select")[0].filtres).toContainEqual(["order", "titre"]);
    faux.vider();
    faux.repondre("formations.select", (appel) => (String(appel.valeurs).includes("envoyee_le") ? { error: { code: "42703" } } : { data: [{ ...lignes[0], envoyee_le: undefined }] }));
    expect((await listFormations()).map((f) => f.etat)).toEqual(["brouillon"]);
  });

  it("la liste d'un formateur : filtrée sur sa fiche, les plus récemment modifiées d'abord", async () => {
    faux.repondre("formations.select", { data: [] });
    await listFormations({ formateurId: "fa" });
    const [appel] = faux.de("formations", "select");
    expect(appel.filtres).toContainEqual(["eq", "formateur_id", "fa"]);
    expect(appel.filtres).toContainEqual(["order", "modifie_le", { ascending: false }]);
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
      { id: "l1", titre: "Un", dureeSecondes: 370, apercu: true, aVideo: true, publiee: true, type: "lecon", genreExercice: null },
      { id: "l2", titre: "Deux", dureeSecondes: 60, apercu: false, aVideo: false, publiee: true, type: "lecon", genreExercice: null },
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

  it("une leçon ancienne (Markdown, sans document) s'ouvre convertie en document riche (fin du lot 4)", async () => {
    faux.repondre("lecons.select", {
      data: {
        id: "l1",
        module_id: "m1",
        titre: "Les tableaux",
        modules: { formation_id: "f1", formations: { titre: "Excel" } },
        lecons_contenus: [{ video_fournisseur: null, video_id: null, texte: "# Étapes\n\n**Ouvrir** le fichier", document: null }],
        ressources: [],
      },
    });
    const lecon = await getLeconAdmin("00000000-0000-4000-8000-000000000002");
    expect(lecon?.document).toEqual({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Étapes" }] },
        { type: "paragraph", content: [{ type: "text", text: "Ouvrir", marks: [{ type: "bold" }] }, { type: "text", text: " le fichier" }] },
      ],
    });
    expect(lecon?.images).toEqual({});
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
