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

describe("Page Parcours (restructuration, §5.2 : le parcours guide, l'abonnement ouvre tout)", () => {
  it("un onglet par parcours, sans cadenas ; le premier montre sa carte et sa progression, sans « Non inclus »", () => {
    render(<MesParcours parcours={PARCOURS} cartes={CARTES_DESIGN} progressions={new Map()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Parcours" })).toBeInTheDocument();
    expect(screen.getByText("Trois parcours pour vous guider. Un abonnement ouvre toutes les formations ; les formations gratuites restent ouvertes à tous.")).toBeInTheDocument();
    const onglets = screen.getByRole("tablist", { name: "Choisir un parcours" });
    expect(within(onglets).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Académique", "Digital", "Business"]);
    expect(onglets.querySelector("svg")).toBeNull();
    const panneau = screen.getByRole("tabpanel");
    expect(within(panneau).getByRole("heading", { name: "Réussite académique" })).toBeInTheDocument();
    expect(within(panneau).getByText(DESCRIPTIONS["reussite-academique"])).toBeInTheDocument();
    expect(within(panneau).queryByText("Non inclus")).toBeNull();
    expect(within(panneau).getByText("0 % du parcours")).toBeInTheDocument();
    expect(within(panneau).getByText("Aucune formation terminée sur 5")).toBeInTheDocument();
    expect(within(panneau).queryByText(/n’est pas inclus/)).toBeNull();
    // Des formations payantes restent fermées à un compte gratuit : la phrase et le lien.
    expect(within(panneau).getByText("Un abonnement ouvre toutes les formations.")).toBeInTheDocument();
    const liens = screen.getAllByRole("link", { name: "Voir les abonnements" });
    expect(liens.length).toBeGreaterThan(0);
    for (const lien of liens) expect(lien).toHaveAttribute("href", "/abonnement");
    expect(screen.queryByRole("link", { name: "Voir les formules" })).toBeNull();
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
    // La barre est décorative dans le lien : l'état (« 68 % ») le dit déjà.
    expect(within(excel).getByRole("progressbar", { hidden: true })).toHaveAttribute("aria-valuenow", "68");
  });

  it("le nom de chaque ligne se limite au titre et à l'état, sans la barre de progression", () => {
    const progressions = new Map([["maitriser-microsoft-excel", { pourcentage: 68, terminee: false }]]);
    render(<MesParcours parcours={PARCOURS} cartes={CARTES_DESIGN} progressions={progressions} />);
    const liste = screen.getByRole("list", { name: "Formations du parcours Réussite académique" });
    // jsdom n'applique pas le CSS : il colle les morceaux du nom sans espace. On compare donc hors espaces.
    const sansEspaces = (texte: string) => texte.replace(/\s/g, "");
    for (const attendu of [
      "Microsoft Word pour vos travaux universitaires Verrouillée",
      "Maîtriser Microsoft Excel 68 %",
      "PowerPoint : réussir sa soutenance Verrouillée",
      "Zotero : gérer ses références Gratuite",
      "Méthodologie du mémoire Verrouillée",
    ]) {
      expect(within(liste).getByRole("link", { name: (nom) => sansEspaces(nom) === sansEspaces(attendu) })).toBeInTheDocument();
    }
  });

  it("l'onglet Digital montre ses formations", async () => {
    render(<MesParcours parcours={PARCOURS} cartes={CARTES_DESIGN} progressions={new Map()} />);
    await userEvent.click(screen.getByRole("tab", { name: "Digital" }));
    const liste = screen.getByRole("list", { name: "Formations du parcours Compétences digitales" });
    expect(within(liste).getAllByRole("link")).toHaveLength(3);
  });

  it("s'ouvre sur le parcours demandé (« Voir le parcours » du tableau de bord) ; un parcours inconnu ouvre le premier", () => {
    const { unmount } = render(<MesParcours parcours={PARCOURS} cartes={CARTES_DESIGN} progressions={new Map()} initial="competences-digitales" />);
    expect(screen.getByRole("tab", { name: "Digital" })).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByRole("tabpanel")).getByRole("heading", { name: "Compétences digitales" })).toBeInTheDocument();
    unmount();
    render(<MesParcours parcours={PARCOURS} cartes={CARTES_DESIGN} progressions={new Map()} initial="inconnu" />);
    expect(screen.getByRole("tab", { name: "Académique" })).toHaveAttribute("aria-selected", "true");
  });

  it("sans parcours, la page le dit", () => {
    render(<MesParcours parcours={[]} cartes={[]} progressions={new Map()} />);
    expect(screen.getByText("Aucun parcours pour le moment")).toBeInTheDocument();
  });
});
