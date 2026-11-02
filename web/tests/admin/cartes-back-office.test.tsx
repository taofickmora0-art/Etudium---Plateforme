// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FormateurAdmin, FormationResume } from "@/lib/admin/types";

// Les pages Formations et Formateurs du back-office, au style de l'espace étudiant (demande du 2 novembre 2026) : des
// cartes avec couverture, statut, parcours et chiffres ; des chiffres clés en haut.

const { GrilleFormationsAdmin, chiffresDesEtats } = await import("@/components/admin/formations/GrilleFormationsAdmin");
const { GrilleFormateurs } = await import("@/components/admin/formateurs/GrilleFormateurs");
const { versChiffresFormations, versChiffresFormateurs } = await import("@/lib/admin/cartes-chiffres");

const formation = (id: string, titre: string, plus: Partial<FormationResume> = {}): FormationResume => ({
  id,
  slug: id,
  titre,
  statut: "publiee",
  niveau: "intermediaire",
  nbLecons: 12,
  parcours: ["Académique"],
  etat: "publiee",
  modifieeParFormateurLe: null,
  modificationsNonPubliees: false,
  resume: `Résumé de ${titre}`,
  couverture: null,
  note: 4.8,
  nbAvis: 96,
  formateur: "Dr Mireille Adjovi",
  couleur: "academique",
  ...plus,
});
const FORMATIONS = [
  formation("f1", "Maîtriser Microsoft Excel", { modificationsNonPubliees: true }),
  formation("f2", "Canva", { statut: "brouillon", etat: "brouillon", parcours: [], couleur: undefined, note: null, nbAvis: 0, formateur: null, nbLecons: 1 }),
  formation("f3", "Word", { etat: "en_attente" as FormationResume["etat"], statut: "brouillon" }),
];
const CHIFFRES = versChiffresFormations({
  apprenants_total: 230,
  formations: [
    { id: "f1", apprenants: 205, certificats: 54, a_corriger: 3 },
    { id: "f2", apprenants: 1, certificats: 0, a_corriger: 0 },
  ],
});

describe("La lecture des chiffres des cartes", () => {
  it("les formations et les formateurs, par identifiant ; une ligne sans identifiant écartée", () => {
    expect(CHIFFRES.apprenantsTotal).toBe(230);
    expect(CHIFFRES.parFormation.f1).toEqual({ apprenants: 205, certificats: 54, aCorriger: 3 });
    expect(versChiffresFormations(null)).toEqual({ apprenantsTotal: 0, parFormation: {} });
    const formateurs = versChiffresFormateurs({
      totaux: { formateurs: 3, formations_publiees: 12, a_corriger: 5, note_moyenne: 4.7 },
      formateurs: [{ id: "t1", formations_publiees: 6, formations_total: 7, apprenants: 212, note: 4.8, avis: 96, a_corriger: 3, compte_relie: true }, { formations_publiees: 1 }],
    });
    expect(formateurs.totaux).toEqual({ formateurs: 3, formationsPubliees: 12, aCorriger: 5, noteMoyenne: 4.7 });
    expect(formateurs.parFormateur).toEqual({ t1: { formationsPubliees: 6, formationsTotal: 7, apprenants: 212, note: 4.8, avis: 96, aCorriger: 3, compteRelie: true } });
  });
});

describe("La grille des formations", () => {
  it("les chiffres du haut : par état", () => {
    expect(chiffresDesEtats(FORMATIONS)).toEqual({ publiees: 1, enAttente: 1, brouillons: 1 });
  });

  it("une carte par formation : son lien, son parcours et son état sur la couverture, ses chiffres, son formateur, ce qui l'attend", () => {
    render(<GrilleFormationsAdmin formations={FORMATIONS} chiffres={CHIFFRES} />);
    const cartes = screen.getAllByRole("listitem");
    expect(cartes).toHaveLength(3);
    const excel = within(cartes[0]);
    expect(excel.getByRole("link", { name: /Maîtriser Microsoft Excel/ })).toHaveAttribute("href", "/admin/formations/f1");
    expect(excel.getByText("Académique")).toBeInTheDocument();
    expect(excel.getByText("Publiée")).toBeInTheDocument();
    expect(excel.getByTestId("meta-formation").textContent).toBe("12 leçons · 205 apprenants · 54 certificats");
    expect(excel.getByText("4,8 (96)")).toBeInTheDocument();
    expect(excel.getByText("Dr Mireille Adjovi")).toBeInTheDocument();
    expect(excel.getByText("Modifications non publiées")).toBeInTheDocument();
    expect(excel.getByText("3 exercices à corriger")).toBeInTheDocument();
    const canva = within(cartes[1]);
    expect(canva.getByText("Sans parcours")).toBeInTheDocument();
    expect(canva.getByText("Sans formateur")).toBeInTheDocument();
    expect(canva.getByTestId("meta-formation").textContent).toBe("1 leçon · 1 apprenant · 0 certificat");
  });

  it("sans les chiffres (0068 absente) : les cartes, avec leurs leçons seulement", () => {
    render(<GrilleFormationsAdmin formations={FORMATIONS} chiffres={null} />);
    expect(within(screen.getAllByRole("listitem")[0]).getByTestId("meta-formation").textContent).toBe("12 leçons");
  });
});

describe("La grille des formateurs", () => {
  const FORMATEURS: FormateurAdmin[] = [
    { id: "t1", nom: "Dr Mireille Adjovi", titre: "Enseignante en statistiques appliquées", domaine: "Statistiques", presentation: "" },
    { id: "t2", nom: "Naïmath Seïdou", titre: "", domaine: "", presentation: "" },
  ];
  const STATS = versChiffresFormateurs({
    totaux: { formateurs: 2, formations_publiees: 8, a_corriger: 3, note_moyenne: 4.8 },
    formateurs: [
      { id: "t1", formations_publiees: 6, formations_total: 7, apprenants: 212, note: 4.8, avis: 96, a_corriger: 3, compte_relie: true },
      { id: "t2", formations_publiees: 2, formations_total: 2, apprenants: 1, note: null, avis: 0, a_corriger: 0, compte_relie: false },
    ],
  });

  it("une carte par formateur : initiales, nom, titre, chiffres, compte relié ou non", () => {
    render(<GrilleFormateurs formateurs={FORMATEURS} chiffres={STATS} />);
    const cartes = screen.getAllByRole("listitem");
    const mireille = within(cartes[0]);
    expect(mireille.getByRole("link", { name: "Dr Mireille Adjovi" })).toHaveAttribute("href", "/admin/formateurs/t1");
    expect(mireille.getByText("Enseignante en statistiques appliquées")).toBeInTheDocument();
    expect(mireille.getAllByTestId("chiffre-formateur").map((c) => c.textContent)).toEqual(["6 formations", "212 apprenants", "4,8 (96 avis)", "3 à corriger"]);
    expect(mireille.getByText("Compte relié")).toBeInTheDocument();
    const naimath = within(cartes[1]);
    expect(naimath.getByText("Titre à compléter")).toBeInTheDocument();
    expect(naimath.getAllByTestId("chiffre-formateur").map((c) => c.textContent)).toEqual(["2 formations", "1 apprenant", "Pas d’avis", "0 à corriger"]);
    expect(naimath.getByText("Sans compte")).toBeInTheDocument();
  });
});
