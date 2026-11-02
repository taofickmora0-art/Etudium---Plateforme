import { describe, expect, it } from "vitest";
import {
  actionDeCarte,
  actionFiche,
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
  titreModule,
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

describe("La fiche d'une formation (spec du 2 novembre 2026, §5)", () => {
  const ouverte = (f: FicheFormation): FicheFormation => ({ ...f, modules: f.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, accessible: true })) })) });
  const NON_COMMENCEE = { commencee: false, aReprendre: null, terminee: false };

  it("un seul format de module partout : « Module N - Titre »", () => {
    expect(titreModule(1, "Bases d’Excel")).toBe("Module 1 - Bases d’Excel");
    expect(titreModule(12, "Automatisation")).toBe("Module 12 - Automatisation");
  });

  it("non inscrit, formation ouverte : « S'inscrire à ce cours », puis la première leçon du programme", () => {
    const action = actionFiche(fiche({ gratuite: true }), null, { inscrit: false, ouverte: true });
    expect(action).toEqual({ type: "inscrire", apres: expect.objectContaining({ id: "l1" }) });
    // Une progression d'aperçu ne dispense pas de s'inscrire.
    expect(actionFiche(fiche({ gratuite: true }), { commencee: true, aReprendre: null, terminee: false }, { inscrit: false, ouverte: true })?.type).toBe("inscrire");
  });

  it("inscrit : « Commencer le cours », « Poursuivre le cours » ou « Revoir la formation », vers la bonne leçon", () => {
    const f = ouverte(fiche({ gratuite: true }));
    const [l1, l2] = f.modules[0].lecons;
    const inscrit = { inscrit: true, ouverte: true };
    expect(actionFiche(f, null, inscrit)).toEqual({ type: "lecon", libelle: "Commencer le cours", lecon: l1 });
    expect(actionFiche(f, NON_COMMENCEE, inscrit)).toEqual({ type: "lecon", libelle: "Commencer le cours", lecon: l1 });
    expect(actionFiche(f, { commencee: true, aReprendre: l2, terminee: false }, inscrit)).toEqual({ type: "lecon", libelle: "Poursuivre le cours", lecon: l2 });
    expect(actionFiche(f, { commencee: true, aReprendre: null, terminee: true }, inscrit)).toEqual({ type: "lecon", libelle: "Revoir la formation", lecon: l1 });
    // Sans leçon : pas de bouton.
    expect(actionFiche({ ...f, modules: [] }, null, inscrit)).toBeNull();
  });

  it("formation payante sans abonnement : « Voir les abonnements », inscrit ou non ; gratuite fermée (compte suspendu) : rien", () => {
    expect(actionFiche(fiche({ gratuite: false }), null, { inscrit: false, ouverte: false })).toEqual({ type: "abonnements" });
    expect(actionFiche(fiche({ gratuite: false }), { commencee: true, aReprendre: null, terminee: false }, { inscrit: true, ouverte: false })).toEqual({ type: "abonnements" });
    expect(actionFiche(fiche({ gratuite: true }), null, { inscrit: false, ouverte: false })).toBeNull();
  });

  it("sans la 0069 : pas d'inscription, les boutons d'avant", () => {
    const gratuite = ouverte(fiche({ gratuite: true }));
    expect(actionFiche(gratuite, null, null)).toEqual({ type: "lecon", libelle: "Commencer le cours", lecon: gratuite.modules[0].lecons[0] });
    const l1 = fiche({}).modules[0].lecons[0];
    expect(actionFiche(fiche({ gratuite: false }), { commencee: true, aReprendre: l1, terminee: false }, null)).toEqual({ type: "lecon", libelle: "Poursuivre le cours", lecon: l1 });
    expect(actionFiche(fiche({ gratuite: false }), null, null)).toEqual({ type: "abonnements" });
  });
});
