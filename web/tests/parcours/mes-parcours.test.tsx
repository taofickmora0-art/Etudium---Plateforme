// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MesParcours } from "@/components/parcours/MesParcours";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "../catalogue/cartes-design";

const DESCRIPTIONS = {
  "reussite-academique": "Les outils et méthodes pour réussir à l’université : bureautique, recherche, rédaction scientifique et soutenance.",
  "competences-digitales": "Design, intelligence artificielle, contenu et automatisation : les compétences numériques recherchées.",
  "business-revenus-en-ligne": "Freelance, produits digitaux et vente en ligne : créer une activité grâce au numérique.",
};
const PARCOURS = PARCOURS_DESIGN.map((p) => ({ ...p, description: DESCRIPTIONS[p.slug as keyof typeof DESCRIPTIONS] }));

describe("Page Mes parcours", () => {
  it("un onglet par parcours ; le premier montre sa carte, son état et le bloc « non inclus »", () => {
    render(<MesParcours parcours={PARCOURS} cartes={CARTES_DESIGN} progressions={new Map()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Mes parcours" })).toBeInTheDocument();
    expect(screen.getByText("Compte gratuit : aucun parcours actif. Les formations gratuites restent ouvertes à tous.")).toBeInTheDocument();
    const onglets = screen.getByRole("tablist", { name: "Choisir un parcours" });
    expect(within(onglets).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Académique", "Digital", "Business"]);
    const panneau = screen.getByRole("tabpanel");
    expect(within(panneau).getByRole("heading", { name: "Réussite académique" })).toBeInTheDocument();
    expect(within(panneau).getByText(DESCRIPTIONS["reussite-academique"])).toBeInTheDocument();
    expect(within(panneau).getByText("Non inclus")).toBeInTheDocument();
    expect(within(panneau).getByText("0 % du parcours")).toBeInTheDocument();
    expect(within(panneau).getByText("Aucune formation terminée sur 5")).toBeInTheDocument();
    expect(within(panneau).getByText("Ce parcours n’est pas inclus dans votre compte gratuit")).toBeInTheDocument();
    for (const lien of screen.getAllByRole("link", { name: "Voir les formules" })) expect(lien).toHaveAttribute("href", "/abonnement");
  });

  it("la liste des formations suit la position, avec numéro, état et lien vers la fiche", () => {
    render(<MesParcours parcours={PARCOURS} cartes={CARTES_DESIGN} progressions={new Map()} />);
    const liste = screen.getByRole("list", { name: "Formations du parcours Réussite académique" });
    const lignes = within(liste).getAllByRole("link");
    expect(lignes.map((l) => l.getAttribute("href"))).toEqual([
      "/formations/microsoft-word-travaux-universitaires",
      "/formations/maitriser-microsoft-excel",
      "/formations/powerpoint-reussir-sa-soutenance",
      "/formations/zotero-gerer-ses-references",
      "/formations/methodologie-du-memoire",
    ]);
    expect(within(lignes[0]).getByText("01")).toBeInTheDocument();
    expect(within(lignes[4]).getByText("05")).toBeInTheDocument();
    expect(within(lignes[3]).getByText("Gratuite")).toBeInTheDocument();
    expect(within(lignes[1]).getByText("Verrouillée")).toBeInTheDocument();
    expect(screen.getByText("5 formations")).toBeInTheDocument();
  });

  it("la progression s'affiche quand elle existe (tâche 1.7)", () => {
    const progressions = new Map([["maitriser-microsoft-excel", { pourcentage: 68, terminee: false }]]);
    render(<MesParcours parcours={PARCOURS} cartes={CARTES_DESIGN} progressions={progressions} />);
    const excel = screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ });
    expect(within(excel).getByText("68 %")).toBeInTheDocument();
    expect(within(excel).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "68");
  });

  it("l'onglet Digital montre ses formations", async () => {
    render(<MesParcours parcours={PARCOURS} cartes={CARTES_DESIGN} progressions={new Map()} />);
    await userEvent.click(screen.getByRole("tab", { name: "Digital" }));
    const liste = screen.getByRole("list", { name: "Formations du parcours Compétences digitales" });
    expect(within(liste).getAllByRole("link")).toHaveLength(3);
  });

  it("sans parcours, la page le dit", () => {
    render(<MesParcours parcours={[]} cartes={[]} progressions={new Map()} />);
    expect(screen.getByText("Aucun parcours pour le moment")).toBeInTheDocument();
  });
});
