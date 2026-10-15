import { describe, expect, it } from "vitest";
import type { CarteCatalogue, ParcoursCatalogue } from "@/lib/catalogue/types";
import { formationsPourBienCommencer } from "@/lib/landing/selection";

const ACA: ParcoursCatalogue = { slug: "reussite-academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", ordre: 1 };
const DIG: ParcoursCatalogue = { slug: "competences-digitales", nom: "Compétences digitales", nomCourt: "Digital", couleur: "digital", ordre: 2 };
const BUS: ParcoursCatalogue = { slug: "business-revenus-en-ligne", nom: "Business & revenus en ligne", nomCourt: "Business", couleur: "business", ordre: 3 };

/** Publiée il y a `jours` jours. */
const carte = (slug: string, parcours: ParcoursCatalogue, jours: number, champs: Partial<CarteCatalogue> = {}): CarteCatalogue => ({
  id: slug,
  slug,
  titre: slug,
  resume: "",
  niveau: "debutant",
  gratuite: false,
  achatSepare: false,
  badge: null,
  publieeLe: new Date(Date.UTC(2026, 9, 15) - jours * 86_400_000).toISOString(),
  dureeSecondes: 0,
  nbLecons: 0,
  parcours: [{ ...parcours, position: 1 }],
  note: null,
  nbAvis: 0,
  couverture: null,
  ...champs,
});

const slugs = (cartes: CarteCatalogue[]) => cartes.map((c) => c.slug);

describe("Formations « Pour bien commencer » (annexe §19, Q1)", () => {
  it("reproduit la maquette avec les données d'exemple", () => {
    const cartes = [
      carte("excel", ACA, 60, { badge: "populaire" }),
      carte("canva", DIG, 30, { gratuite: true }),
      carte("freelance", BUS, 15, { badge: "populaire" }),
      carte("zotero", ACA, 20, { gratuite: true }),
      carte("methodologie", ACA, 40, { badge: "populaire" }),
      carte("ia", DIG, 5),
    ];
    expect(slugs(formationsPourBienCommencer(cartes))).toEqual(["zotero", "canva", "methodologie", "freelance"]);
  });

  it("complète avec les plus récentes quand il manque des populaires", () => {
    const cartes = [carte("a", BUS, 50), carte("b", ACA, 10), carte("gratuite", DIG, 90, { gratuite: true }), carte("c", DIG, 20), carte("d", ACA, 30)];
    const choix = formationsPourBienCommencer(cartes);
    expect(choix).toHaveLength(4);
    expect(choix[0].slug).toBe("gratuite");
    // Les trois plus récentes (b, c, d), rangées par ordre du parcours.
    expect(slugs(choix.slice(1))).toEqual(["b", "d", "c"]);
  });

  it("jamais plus de 2 formations gratuites", () => {
    const cartes = [
      ...[1, 2, 3, 4, 5].map((n) => carte(`g${n}`, ACA, n, { gratuite: true })),
      carte("p1", BUS, 40, { badge: "populaire" }),
      carte("p2", DIG, 50, { badge: "populaire" }),
    ];
    expect(slugs(formationsPourBienCommencer(cartes))).toEqual(["g1", "g2", "p2", "p1"]);
  });

  it("une liste vide reste vide ; moins de 4 formations : toutes", () => {
    expect(formationsPourBienCommencer([])).toEqual([]);
    expect(formationsPourBienCommencer([carte("a", ACA, 1), carte("b", DIG, 2)])).toHaveLength(2);
  });
});
