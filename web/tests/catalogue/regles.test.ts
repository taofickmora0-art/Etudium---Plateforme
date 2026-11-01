import { describe, expect, it } from "vitest";
import { badgeDeCarte, dureeLisible, etatAcces, nombreDeLecons, parcoursPrincipal, premiereLeconOuverte } from "@/lib/catalogue/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import { parSlug } from "./cartes-design";

const fiche = (champs: Partial<FicheFormation>): FicheFormation => ({
  ...parSlug("maitriser-microsoft-excel"),
  description: "",
  seuilVideo: 90,
  objectifs: [],
  competences: [],
  formateur: null,
  modules: [
    {
      id: "m1",
      titre: "Bases d’Excel",
      lecons: [
        { id: "l1", titre: "Découvrir l’interface", dureeSecondes: 370, apercu: true, accessible: true },
        { id: "l2", titre: "Les formules essentielles", dureeSecondes: 845, apercu: false, accessible: false },
      ],
    },
  ],
  ...champs,
});

describe("Règles d'affichage du catalogue", () => {
  it("les durées s'écrivent comme dans le design", () => {
    expect(dureeLisible(0)).toBe("");
    expect(dureeLisible(2700)).toBe("45 min");
    expect(dureeLisible(22800)).toBe("6 h 20");
    expect(dureeLisible(21600)).toBe("6 h 00");
    expect(dureeLisible(8407)).toBe("2 h 20");
    expect(dureeLisible(29)).toBe("1 min");
  });

  it("le nombre de leçons s'accorde", () => {
    expect(nombreDeLecons(1)).toBe("1 leçon");
    expect(nombreDeLecons(12)).toBe("12 leçons");
    expect(nombreDeLecons(0)).toBe("0 leçon");
  });

  it("une carte porte un seul badge : gratuit, puis le badge saisi ; plus de « Complémentaire » (restructuration, §5.2)", () => {
    expect(badgeDeCarte(parSlug("zotero-gerer-ses-references"))).toEqual({ tone: "gratuit", label: "Gratuit" });
    expect(badgeDeCarte(parSlug("maitriser-microsoft-excel"))).toEqual({ tone: "populaire", label: "Populaire" });
    expect(badgeDeCarte(parSlug("intelligence-artificielle-etudes"))).toEqual({ tone: "nouveau", label: "Nouveau" });
    expect(badgeDeCarte(parSlug("marketing-digital-debutants"))).toBeUndefined();
    expect(badgeDeCarte(parSlug("microsoft-word-travaux-universitaires"))).toBeUndefined();
  });

  it("la couleur de l'illustration vient du premier parcours", () => {
    expect(parcoursPrincipal(parSlug("canva-debutant-a-expert"))).toBe("digital");
    expect(parcoursPrincipal({ ...parSlug("canva-debutant-a-expert"), parcours: [] })).toBe("academique");
  });

  it("l'état d'accès suit la règle de la spec (§3, lot 1)", () => {
    expect(etatAcces(fiche({ gratuite: true }), true)).toBe("gratuite");
    expect(etatAcces(fiche({ gratuite: true }), false)).toBe("apercu");
    expect(etatAcces(fiche({ gratuite: false }), true)).toBe("apercu");
    const sansApercu = fiche({ modules: [{ id: "m1", titre: "M", lecons: [{ id: "l", titre: "L", dureeSecondes: 1, apercu: false, accessible: false }] }] });
    expect(etatAcces(sansApercu, true)).toBe("verrouillee");
    expect(etatAcces({ ...sansApercu, gratuite: true }, false)).toBe("verrouillee");
  });

  it("la première leçon ouverte est celle que l'on peut suivre", () => {
    expect(premiereLeconOuverte(fiche({}))?.id).toBe("l1");
    expect(premiereLeconOuverte(fiche({ modules: [] }))).toBeNull();
  });
});
