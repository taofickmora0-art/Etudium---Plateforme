// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DonneesLecon, LeconDetail } from "@/lib/lecon/types";
import { EXCEL, EXCEL_OUVERTE, id, ZOTERO } from "./donnees";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));
vi.mock("@/lib/lecon/actions", () => ({ enregistrerNote: vi.fn(), lienRessource: vi.fn() }));

const { ContenuLecon } = await import("@/components/lecon/ContenuLecon");
const { ProgrammeLecon } = await import("@/components/lecon/ProgrammeLecon");
const { ProgrammeMobile } = await import("@/components/lecon/ProgrammeMobile");
const { BarreLecon } = await import("@/components/lecon/NavigationLecon");

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ADRESSE = "/formations/maitriser-microsoft-excel/lecons";

const SAISIR: LeconDetail = {
  id: id(2),
  titre: "Saisir et mettre en forme des données",
  dureeSecondes: 750,
  apercu: true,
  accessible: true,
  resume: "Saisir proprement, puis mettre en forme.",
  pointsCles: ["Saisir des dates", "Appliquer un format de nombre"],
  video: { fournisseur: "youtube", id: "dQw4w9WgXcQ" },
  texte: "",
  ressources: [{ id: id(301), titre: "Classeur d’exemple", format: XLSX, tailleOctets: 84_000, telechargeable: true }],
};
const donnees = (lecon: Partial<LeconDetail>, fiche = EXCEL_OUVERTE): DonneesLecon => ({
  fiche,
  lecon: { ...SAISIR, ...lecon },
  note: null,
  notesDisponibles: true,
});

describe("Page leçon : contenu", () => {
  it("un compte connecté suit la leçon : titre, vidéo, voisines, onglets et « Dans cette leçon »", () => {
    render(<ContenuLecon donnees={donnees({})} connecte terminees={new Set()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Saisir et mettre en forme des données" })).toBeInTheDocument();
    expect(screen.getByText("Leçon 2 sur 4 de ce module")).toBeInTheDocument();
    expect(screen.getByText("12 min 30")).toBeInTheDocument();
    const video = screen.getByTitle("Vidéo : Saisir et mettre en forme des données");
    expect(video).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(video).toHaveAttribute("allowfullscreen");
    expect(screen.getByRole("link", { name: "Leçon précédente" })).toHaveAttribute("href", `${ADRESSE}/${id(1)}`);
    expect(screen.getByRole("link", { name: "Leçon suivante" })).toHaveAttribute("href", `${ADRESSE}/${id(3)}`);
    const [ordinateur, telephone] = screen.getAllByRole("tablist", { name: "Contenu de la leçon" });
    expect(within(ordinateur).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Ressources", "Notes"]);
    expect(within(telephone).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Programme", "Ressources", "Notes"]);
    const carte = screen.getByRole("region", { name: "Dans cette leçon" });
    expect(within(carte).getByText("Saisir proprement, puis mettre en forme.")).toBeInTheDocument();
    expect(within(carte).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Saisir des dates", "Appliquer un format de nombre"]);
    expect(screen.queryByText("Vous regardez un aperçu gratuit")).toBeNull();
  });

  it("une leçon sans vidéo affiche son texte", () => {
    const { container } = render(<ContenuLecon donnees={donnees({ video: null, texte: "Ouvrez Excel.\nPuis créez un classeur." })} connecte terminees={new Set()} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText(/Ouvrez Excel\./)).toBeInTheDocument();
  });

  it("une vidéo Vimeo non répertoriée passe par le lecteur Vimeo", () => {
    render(<ContenuLecon donnees={donnees({ video: { fournisseur: "vimeo", id: "76979871/abcdef0123" } })} connecte terminees={new Set()} />);
    expect(screen.getByTitle(/^Vidéo :/)).toHaveAttribute("src", "https://player.vimeo.com/video/76979871?dnt=1&h=abcdef0123");
  });

  it("un visiteur sur un aperçu est invité à créer son compte, y compris dans l'onglet Notes", async () => {
    render(<ContenuLecon donnees={donnees({ id: id(1), titre: "Découvrir l’interface" }, EXCEL)} connecte={false} terminees={new Set()} />);
    expect(screen.getByText("Vous regardez un aperçu gratuit")).toBeInTheDocument();
    expect(screen.getByText("Créez votre compte gratuit pour enregistrer votre progression.")).toBeInTheDocument();
    const [ordinateur] = screen.getAllByRole("tablist", { name: "Contenu de la leçon" });
    await userEvent.click(within(ordinateur).getByRole("tab", { name: "Notes" }));
    expect(screen.getByText("Vos notes sont privées : créez un compte gratuit pour en prendre.")).toBeInTheDocument();
    for (const lien of screen.getAllByRole("link", { name: "Créer un compte gratuit" })) expect(lien).toHaveAttribute("href", "/inscription");
  });

  it("une leçon verrouillée ne montre ni vidéo, ni texte, ni ressources, ni onglets", () => {
    const fermee = donnees(
      { id: id(3), titre: "Les formules essentielles", apercu: false, accessible: false, texte: "Texte secret de la leçon" },
      EXCEL,
    );
    const { container } = render(<ContenuLecon donnees={fermee} connecte terminees={new Set()} />);
    expect(screen.getByRole("heading", { name: "Cette leçon est verrouillée" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les formules" })).toHaveAttribute("href", "/abonnement");
    expect(screen.getByRole("link", { name: "Voir l’aperçu gratuit" })).toHaveAttribute("href", `${ADRESSE}/${id(1)}`);
    expect(container.innerHTML).not.toMatch(/youtube|vimeo|dQw4w9WgXcQ|Texte secret|Classeur d’exemple/);
    expect(screen.queryByRole("tablist")).toBeNull();
    // Sur téléphone, le programme reste accessible sous le verrou.
    expect(screen.getByRole("heading", { name: "Programme de la formation" })).toBeInTheDocument();
  });

  it("un visiteur devant une leçon d'une formation gratuite est invité à créer son compte ou à se connecter", () => {
    const fermee: DonneesLecon = {
      fiche: ZOTERO,
      lecon: { ...SAISIR, id: id(21), titre: "Installer Zotero", apercu: false, accessible: false, video: null, ressources: [] },
      note: null,
      notesDisponibles: true,
    };
    render(<ContenuLecon donnees={fermee} connecte={false} terminees={new Set()} />);
    expect(screen.getByRole("heading", { name: "Cette leçon est réservée aux comptes Étudium" })).toBeInTheDocument();
    const suite = encodeURIComponent(`/formations/zotero-gerer-ses-references/lecons/${id(21)}`);
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", `/connexion?next=${suite}`);
  });
});

describe("Page leçon : programme", () => {
  it("ordinateur : la leçon ouverte est marquée, une leçon fermée n'est pas un lien, la progression s'affiche", () => {
    render(<ProgrammeLecon fiche={EXCEL} leconId={id(2)} connecte terminees={new Set([id(1)])} />);
    expect(screen.getByRole("link", { name: "Mes formations" })).toHaveAttribute("href", "/mes-formations");
    expect(screen.getByRole("link", { name: "Maîtriser Microsoft Excel" })).toHaveAttribute("href", "/formations/maitriser-microsoft-excel");
    const courante = screen.getByRole("link", { name: "Saisir et mettre en forme" });
    expect(courante).toHaveAttribute("aria-current", "page");
    expect(within(courante).getByText("Saisir et mettre en forme")).toHaveAttribute("title", "Saisir et mettre en forme des données");
    expect(screen.queryByRole("link", { name: "Les formules essentielles" })).toBeNull();
    expect(screen.getByText("Les formules essentielles").closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("progressbar", { name: "Progression de la formation" })).toHaveAttribute("aria-valuenow", "8");
    expect(screen.getByText("8 % terminé")).toBeInTheDocument();
    expect(screen.getByText("2 h 14 restantes")).toBeInTheDocument();
    expect(screen.getByText("1 · Bases d’Excel")).toBeInTheDocument();
  });

  it("ordinateur, visiteur : retour au catalogue, sans progression", () => {
    render(<ProgrammeLecon fiche={EXCEL} leconId={id(1)} connecte={false} terminees={new Set()} />);
    expect(screen.getByRole("link", { name: "Toutes les formations" })).toHaveAttribute("href", "/formations");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("téléphone : modules « Module 1 : … », durées, et « En cours » sur la leçon ouverte", () => {
    render(<ProgrammeMobile fiche={EXCEL} leconId={id(2)} connecte terminees={new Set([id(1)])} />);
    expect(screen.getByRole("heading", { level: 3, name: "Module 1 : Bases d’Excel" })).toBeInTheDocument();
    expect(screen.getByText("1/4")).toBeInTheDocument();
    const courante = screen.getByRole("link", { name: /Saisir et mettre en forme des données/ });
    expect(courante).toHaveAttribute("aria-current", "page");
    expect(within(courante).getByText("En cours")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Découvrir l’interface/ })).getByText("06:10 · terminée")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Les formules essentielles/ })).toBeNull();
  });

  it("barre du téléphone : seulement les voisines qui existent", () => {
    const { rerender } = render(<BarreLecon fiche={EXCEL} leconId={id(1)} />);
    expect(screen.queryByRole("link", { name: "Leçon précédente" })).toBeNull();
    expect(screen.getByRole("link", { name: "Leçon suivante" })).toHaveAttribute("href", `${ADRESSE}/${id(2)}`);
    rerender(<BarreLecon fiche={EXCEL} leconId={id(12)} />);
    expect(screen.getByRole("link", { name: "Leçon précédente" })).toHaveAttribute("href", `${ADRESSE}/${id(11)}`);
    expect(screen.queryByRole("link", { name: "Leçon suivante" })).toBeNull();
  });
});
