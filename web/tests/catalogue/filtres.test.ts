import { describe, expect, it } from "vitest";
import { appliquerFiltres, ecrireFiltres, FILTRES_PAR_DEFAUT, lireFiltres, type Filtres } from "@/lib/catalogue/filtres";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "./cartes-design";

const CONNUS = PARCOURS_DESIGN.map((p) => p.slug);
const titres = (f: Partial<Filtres>) => appliquerFiltres(CARTES_DESIGN, { ...FILTRES_PAR_DEFAUT, ...f }).map((c) => c.slug);

describe("Filtres du catalogue", () => {
  it("une valeur inconnue dans l'adresse est ignorée", () => {
    expect(lireFiltres({ parcours: "inconnu", tri: "meilleures", niveau: "expert", acces: "tout-et-rien" }, CONNUS)).toEqual(FILTRES_PAR_DEFAUT);
    expect(lireFiltres({ parcours: ["competences-digitales", "autre"] }, CONNUS).parcours).toBe("competences-digitales");
  });

  it("les filtres font l'aller-retour par l'adresse", () => {
    const f: Filtres = { q: "excel", parcours: "competences-digitales", acces: "gratuites", niveau: "debutant", tri: "recentes" };
    const query = ecrireFiltres(f);
    expect(query).toBe("?q=excel&parcours=competences-digitales&acces=gratuites&niveau=debutant&tri=recentes");
    expect(lireFiltres(Object.fromEntries(new URLSearchParams(query)), CONNUS)).toEqual(f);
    expect(ecrireFiltres(FILTRES_PAR_DEFAUT)).toBe("");
  });

  it("la recherche ignore accents et majuscules, dans le titre et le résumé", () => {
    expect(titres({ q: "zotéro" })).toEqual(["zotero-gerer-ses-references"]);
    expect(titres({ q: "  CANVA " })).toEqual(["canva-debutant-a-expert"]);
    expect(titres({ q: "soutenance" })).toEqual(["powerpoint-reussir-sa-soutenance"]);
  });

  it("parcours, accès et niveau se combinent", () => {
    expect(titres({ parcours: "business-revenus-en-ligne", acces: "gratuites" })).toEqual([]);
    expect(titres({ acces: "gratuites" })).toEqual(["zotero-gerer-ses-references", "canva-debutant-a-expert"]);
    expect(titres({ acces: "incluses" })).toHaveLength(8);
    expect(titres({ parcours: "competences-digitales", niveau: "intermediaire" })).toEqual(["montage-video-smartphone"]);
  });

  it("trois tris : par parcours, les plus récentes, par durée", () => {
    expect(titres({}).slice(0, 3)).toEqual(["microsoft-word-travaux-universitaires", "maitriser-microsoft-excel", "powerpoint-reussir-sa-soutenance"]);
    expect(titres({}).slice(5, 6)).toEqual(["canva-debutant-a-expert"]);
    expect(titres({ tri: "recentes" })[0]).toBe("intelligence-artificielle-etudes");
    expect(titres({ tri: "duree" })[0]).toBe("zotero-gerer-ses-references");
    expect(titres({ tri: "duree" }).at(-1)).toBe("marketing-digital-debutants");
  });

  it("tri « Note des étudiants » : la meilleure moyenne d'abord, puis le plus d'avis ; sans avis en dernier", () => {
    const notes: Record<string, [number | null, number]> = {
      "canva-debutant-a-expert": [4.9, 10],
      "zotero-gerer-ses-references": [4.9, 20],
      "maitriser-microsoft-excel": [4.2, 50],
    };
    const cartes = CARTES_DESIGN.map((c) => ({ ...c, note: notes[c.slug]?.[0] ?? null, nbAvis: notes[c.slug]?.[1] ?? 0 }));
    const tries = appliquerFiltres(cartes, { ...FILTRES_PAR_DEFAUT, tri: "note" }).map((c) => c.slug);
    expect(tries.slice(0, 3)).toEqual(["zotero-gerer-ses-references", "canva-debutant-a-expert", "maitriser-microsoft-excel"]);
    expect(tries).toHaveLength(10);
    expect(lireFiltres({ tri: "note" }, CONNUS).tri).toBe("note");
  });
});
