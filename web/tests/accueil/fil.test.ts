import { describe, expect, it } from "vitest";
import { entrelacer, formationsDisponibles, nouvellesFormations } from "@/lib/accueil/fil";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import type { Publication } from "@/lib/communaute/types";

// Le fil de l'Accueil (spec du nouvel Accueil, §2 et §3) : les nouvelles formations à leur date parmi les publications.

const MAINTENANT = new Date("2026-10-15T12:00:00Z");
const formation = (id: string, publieeLe: string): CarteCatalogue => ({
  id,
  slug: id,
  titre: `Formation ${id}`,
  resume: "",
  niveau: "debutant",
  gratuite: false,
  badge: null,
  publieeLe,
  dureeSecondes: 0,
  nbLecons: 0,
  parcours: [],
  note: null,
  nbAvis: 0,
  couverture: null,
});
const publication = (id: string, creeLe: string) => ({ id, creeLe }) as Publication;
const ordre = (fil: ReturnType<typeof entrelacer>) => fil.map((e) => (e.type === "publication" ? `p:${e.publication.id}` : `f:${e.formation.id}`));

describe("Les nouvelles formations", () => {
  it("30 jours, futures écartées, de la plus récente à la plus ancienne", () => {
    const cartes = [
      formation("vieille", "2026-09-10T12:00:00Z"),
      formation("limite", "2026-09-15T12:00:00Z"),
      formation("recente", "2026-10-14T12:00:00Z"),
      formation("future", "2026-10-16T12:00:00Z"),
      formation("moyenne", "2026-10-01T12:00:00Z"),
    ];
    expect(nouvellesFormations(cartes, MAINTENANT).map((f) => f.id)).toEqual(["recente", "moyenne", "limite"]);
  });

  it("au plus 3 dans le fil : au lancement, le catalogue ne noie pas la communauté (revue finale)", () => {
    const cartes = ["a", "b", "c", "d", "e"].map((id, i) => formation(id, `2026-10-1${i}T12:00:00Z`));
    expect(nouvellesFormations(cartes, MAINTENANT).map((f) => f.id)).toEqual(["e", "d", "c"]);
  });

  it("formationsDisponibles : les 4 plus récentes", () => {
    const cartes = ["a", "b", "c", "d", "e"].map((id, i) => formation(id, `2026-0${i + 1}-01T00:00:00Z`));
    expect(formationsDisponibles(cartes).map((f) => f.id)).toEqual(["e", "d", "c", "b"]);
  });
});

describe("Entrelacer", () => {
  const formations = [formation("f1", "2026-10-14T10:00:00Z"), formation("f2", "2026-10-12T10:00:00Z")];

  it("chaque formation à sa date ; à égalité, après la publication", () => {
    const pubs = [publication("p1", "2026-10-15T09:00:00Z"), publication("p2", "2026-10-14T10:00:00Z"), publication("p3", "2026-10-11T10:00:00Z")];
    expect(ordre(entrelacer(pubs, formations, false))).toEqual(["p:p1", "p:p2", "f:f1", "f:f2", "p:p3"]);
  });

  it("une formation plus ancienne que la dernière publication attend ; à la fin du fil, elle vient", () => {
    const pubs = [publication("p1", "2026-10-15T09:00:00Z"), publication("p2", "2026-10-13T10:00:00Z")];
    expect(ordre(entrelacer(pubs, formations, false))).toEqual(["p:p1", "f:f1", "p:p2"]);
    expect(ordre(entrelacer(pubs, formations, true))).toEqual(["p:p1", "f:f1", "p:p2", "f:f2"]);
  });

  it("aucune publication : à la fin, les formations ; sinon, rien", () => {
    expect(ordre(entrelacer([], formations, true))).toEqual(["f:f1", "f:f2"]);
    expect(entrelacer([], formations, false)).toEqual([]);
  });

  it("recalculé sur tout le lot après « Voir plus » : chaque formation une seule fois", () => {
    const page1 = [publication("p1", "2026-10-15T09:00:00Z"), publication("p2", "2026-10-13T10:00:00Z")];
    const page2 = [publication("p3", "2026-10-12T09:00:00Z"), publication("p4", "2026-10-01T09:00:00Z")];
    const fil = ordre(entrelacer([...page1, ...page2], formations, false));
    expect(fil).toEqual(["p:p1", "f:f1", "p:p2", "f:f2", "p:p3", "p:p4"]);
    expect(fil.filter((x) => x.startsWith("f:"))).toHaveLength(2);
  });

  it("une publication qu'on vient d'ajouter en tête ne déplace pas les formations", () => {
    const pubs = [publication("neuve", "2026-10-15T11:59:00Z"), publication("p1", "2026-10-15T09:00:00Z"), publication("p2", "2026-10-11T10:00:00Z")];
    expect(ordre(entrelacer(pubs, formations, false))).toEqual(["p:neuve", "p:p1", "f:f1", "f:f2", "p:p2"]);
  });
});
