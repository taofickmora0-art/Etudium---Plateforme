import { describe, expect, it } from "vitest";
import {
  actionDeCarte,
  badgeDeCarte,
  dureeLisible,
  etatAcces,
  etatDeCarte,
  nombreDApprenants,
  nombreDeLecons,
  nombreDeModules,
  parcoursPrincipal,
  premiereLeconOuverte,
  programmeDeCarte,
} from "@/lib/catalogue/regles";
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

describe("Cartes du catalogue (spec du 2 novembre 2026, §4)", () => {
  it("modules et apprenants s'accordent (zéro reste au singulier)", () => {
    expect(nombreDeModules(0)).toBe("0 module");
    expect(nombreDeModules(1)).toBe("1 module");
    expect(nombreDeModules(4)).toBe("4 modules");
    expect(nombreDApprenants(0)).toBe("0 apprenant");
    expect(nombreDApprenants(1)).toBe("1 apprenant");
    expect(nombreDApprenants(34)).toBe("34 apprenants");
    expect(nombreDApprenants(1234).replace(/\s/g, " ")).toBe("1 234 apprenants");
  });

  it("la ligne du programme : « N modules • N leçons », ou les leçons seules si le nombre de modules n'est pas connu", () => {
    expect(programmeDeCarte({ nbModules: 1, nbLecons: 1 })).toBe("1 module • 1 leçon");
    expect(programmeDeCarte({ nbModules: 4, nbLecons: 12 })).toBe("4 modules • 12 leçons");
    expect(programmeDeCarte({ nbLecons: 12 })).toBe("12 leçons");
  });

  it("le bouton du bas : le pourcentage d'un inscrit, même 0 %, sinon « Voir le cours »", () => {
    expect(actionDeCarte(undefined)).toBe("Voir le cours");
    expect(actionDeCarte(0).replace(/\s/g, " ")).toBe("0 % terminé");
    expect(actionDeCarte(66.6).replace(/\s/g, " ")).toBe("67 % terminé");
    // Le nombre et « % » ne se séparent jamais en fin de ligne.
    expect(actionDeCarte(40)).toBe("40\u00a0% terminé");
  });

  it("ce que le compte ajoute à une carte : apprenants, inscription, favori", () => {
    const etats = { apprenants: { f1: 34, f2: 0 }, inscrites: { f1: 0 }, favoris: ["f2"] };
    expect(etatDeCarte(etats, "f1")).toEqual({ apprenants: 34, progression: 0, favori: false });
    expect(etatDeCarte(etats, "f2")).toEqual({ apprenants: 0, progression: undefined, favori: true });
    // Sans la 0069 : pas d'apprenants ; visiteur : pas de cœur.
    expect(etatDeCarte({ apprenants: null, inscrites: {}, favoris: null }, "f1")).toEqual({ apprenants: undefined, progression: undefined, favori: undefined });
    expect(etatDeCarte(undefined, "f1")).toEqual({ apprenants: undefined, progression: undefined, favori: undefined });
  });
});
