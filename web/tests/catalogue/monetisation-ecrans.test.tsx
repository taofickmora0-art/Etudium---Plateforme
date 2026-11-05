// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { EtatValidation } from "@/lib/certificats/types";
import type { FicheFormation } from "@/lib/catalogue/types";
import { CARTES_DESIGN, PARCOURS_DESIGN, parSlug } from "./cartes-design";

// Le lien compétence → monétisation à l'écran (restructuration, §5.3 ; liste du 31 octobre 2026, tâche 14) : « Et
// ensuite ? Vendre cette compétence » sur la fiche d'une compétence, « À suivre d'abord » sur celle d'une formation
// Business, « Étape suivante » une fois la compétence validée, et l'onglet Business de la page Parcours rangé par compétence.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));
vi.mock("@/lib/certificats/actions", () => ({ marquerCertificatVu: vi.fn(async () => undefined) }));
const { FichePublique } = await import("@/components/catalogue/FichePublique");
const { FicheConnectee } = await import("@/components/catalogue/FicheConnectee");
const { ValidationFormation } = await import("@/components/certificats/ValidationFormation");
const { MesParcours } = await import("@/components/parcours/MesParcours");

const fiche = (slug: string): FicheFormation => ({
  ...parSlug(slug),
  dureeSecondes: 3600,
  nbLecons: 1,
  seuilVideo: 90,
  description: "",
  objectifs: [],
  competences: [],
  formateur: null,
  modules: [{ id: "m1", titre: "Module", lecons: [{ id: "l1", titre: "Leçon", dureeSecondes: 600, apercu: true, accessible: true }] }],
});
const FREELANCE = parSlug("lancer-son-activite-freelance");
const CANVA = parSlug("canva-debutant-a-expert");

describe("Les fiches", () => {
  it("une compétence (visiteur) : « Et ensuite ? Vendre cette compétence », vers les formations Business liées", () => {
    render(<FichePublique fiche={fiche("canva-debutant-a-expert")} monetisation={{ aVendre: [FREELANCE], aSuivre: [] }} />);
    const bloc = screen.getByRole("region", { name: "Et ensuite ? Vendre cette compétence" });
    expect(within(bloc).getByRole("link", { name: /Lancer son activité de freelance/ })).toHaveAttribute("href", "/formations/lancer-son-activite-freelance");
    expect(screen.queryByRole("region", { name: "À suivre d’abord" })).toBeNull();
  });

  it("une formation Business (connecté) : « À suivre d'abord », vers les compétences liées", () => {
    render(<FicheConnectee fiche={fiche("lancer-son-activite-freelance")} monetisation={{ aVendre: [], aSuivre: [CANVA] }} />);
    const bloc = screen.getByRole("region", { name: "À suivre d’abord" });
    expect(within(bloc).getByRole("link", { name: /Canva, de débutant à expert/ })).toHaveAttribute("href", "/formations/canva-debutant-a-expert");
  });

  it("sans lien : aucun des deux blocs", () => {
    render(<FichePublique fiche={fiche("maitriser-microsoft-excel")} />);
    expect(screen.queryByRole("region", { name: /Vendre cette compétence|À suivre d’abord/ })).toBeNull();
  });
});

describe("Une fois la compétence validée", () => {
  const ETAT: EtatValidation = {
    lecons: { terminees: 3, total: 3 },
    minimum: 70,
    exercicesObligatoires: false,
    quiz: [],
    exercices: [],
    complet: true,
    certificat: null,
  };
  const afficher = (etat: EtatValidation) =>
    render(
      <ToastProvider>
        <ValidationFormation etat={etat} formation={{ titre: "Canva", slug: "canva-debutant-a-expert" }} prenom="Aïcha" etapeSuivante={FREELANCE} />
      </ToastProvider>,
    );

  it("« Étape suivante » mène à la première formation Business liée", () => {
    afficher(ETAT);
    const carte = screen.getByRole("region", { name: "Étape suivante" });
    expect(within(carte).getByText("Lancer son activité de freelance")).toBeInTheDocument();
    expect(within(carte).getByRole("link", { name: "Voir la formation" })).toHaveAttribute("href", "/formations/lancer-son-activite-freelance");
  });

  it("pas encore validée : pas d'étape suivante", () => {
    afficher({ ...ETAT, lecons: { terminees: 2, total: 3 }, complet: false });
    expect(screen.queryByRole("region", { name: "Étape suivante" })).toBeNull();
  });
});

describe("Les onglets de la page Parcours", () => {
  it("l'onglet orange (Entrepreneuriat depuis la 0078) : une simple liste dans l'ordre du parcours, sans groupes", () => {
    const orange = PARCOURS_DESIGN.find((p) => p.couleur === "business")!;
    render(<MesParcours parcours={PARCOURS_DESIGN} cartes={CARTES_DESIGN} progressions={new Map()} initial={orange.slug} />);
    expect(screen.getByRole("list", { name: `Formations du parcours ${orange.nom}` })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Pour toutes les compétences" })).toBeNull();
  });

  it("les autres onglets restent une simple liste", () => {
    render(<MesParcours parcours={PARCOURS_DESIGN} cartes={CARTES_DESIGN} progressions={new Map()} initial="competences-digitales" />);
    expect(screen.getByRole("list", { name: "Formations du parcours Compétences digitales" })).toBeInTheDocument();
  });
});
