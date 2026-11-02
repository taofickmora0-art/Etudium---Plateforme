// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FicheFormation } from "@/lib/catalogue/types";
import type { DonneesLecon } from "@/lib/lecon/types";
import { etatFormation } from "@/lib/progression/regles";
import { EXCEL_OUVERTE, id } from "../lecon/donnees";

// Lot 3, étape B : la page leçon d'un exercice (consigne, fichiers fournis, travail) et l'exercice dans le programme.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));
vi.mock("@/lib/lecon/actions", () => ({ enregistrerNote: vi.fn(), lienRessource: vi.fn(), lienConsultation: vi.fn(), ouvrirLecon: vi.fn(async () => undefined), terminerLecon: vi.fn() }));
vi.mock("@/lib/exercices/actions", () => ({ rendreExercice: vi.fn(), terminerExercice: vi.fn(), lienRendu: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
const { ContenuLecon } = await import("@/components/lecon/ContenuLecon");
const { ProgrammeLecon } = await import("@/components/lecon/ProgrammeLecon");
const { ProgrammeMobile } = await import("@/components/lecon/ProgrammeMobile");
const { FicheConnectee } = await import("@/components/catalogue/FicheConnectee");
const { ProgrammeFiche, resumeProgramme } = await import("@/components/catalogue/ProgrammeFiche");
const { elementsInclus } = await import("@/components/catalogue/BlocsFiche");
const { ouvrirLecon } = await import("@/lib/lecon/actions");

const EXO = "99999999-9999-4999-8999-999999999999";
const SIMPLE = "88888888-8888-4888-8888-888888888888";
const module1 = EXCEL_OUVERTE.modules[0];
const FICHE: FicheFormation = {
  ...EXCEL_OUVERTE,
  nbExercices: 2,
  modules: [
    {
      ...module1,
      lecons: [
        module1.lecons[0],
        { id: EXO, titre: "Tableau des ventes", titreCourt: null, dureeSecondes: 0, apercu: false, accessible: true, type: "exercice" },
        { id: SIMPLE, titre: "Nettoyer une enquête", titreCourt: null, dureeSecondes: 0, apercu: false, accessible: true, type: "exercice" },
        ...module1.lecons.slice(1),
      ],
    },
    ...EXCEL_OUVERTE.modules.slice(1),
  ],
};
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const donnees = (o: Partial<DonneesLecon> = {}): DonneesLecon => ({
  fiche: FICHE,
  lecon: {
    id: EXO,
    titre: "Tableau des ventes",
    dureeSecondes: 0,
    apercu: false,
    accessible: true,
    resume: "",
    pointsCles: [],
    video: null,
    texte: "Créez un tableau croisé dynamique à partir du fichier.",
    ressources: [{ id: id(301), titre: "donnees-ventes.xlsx", format: XLSX, tailleOctets: 96_000, telechargeable: true }],
    visionnage: null,
  },
  note: null,
  notesDisponibles: true,
  exercice: { genre: "rendu", statut: null, peutDeposer: true, versions: [] },
  ...o,
});
const afficher = (d: DonneesLecon, connecte = true, lienModifier: string | null = null) =>
  render(
    <ToastProvider>
      <ContenuLecon donnees={d} connecte={connecte} lienModifier={lienModifier} />
    </ToastProvider>,
  );
const STATUTS = { [EXO]: "a_corriger" as const, [SIMPLE]: "valide" as const };

describe("La page d'un exercice", () => {
  it("la consigne, les fichiers fournis, le dépôt ; « Modifier l’exercice » ; pas de « Terminer la leçon » ni de visite enregistrée", () => {
    afficher(donnees(), true, "/admin/formations/f1/lecons/e");
    expect(screen.getByRole("heading", { level: 1, name: "Tableau des ventes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Consigne" })).toBeInTheDocument();
    expect(screen.getByText("Créez un tableau croisé dynamique à partir du fichier.")).toBeInTheDocument();
    expect(screen.getByText("donnees-ventes.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Déposer votre travail")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Modifier l’exercice" })).toHaveAttribute("href", "/admin/formations/f1/lecons/e");
    expect(screen.queryByRole("button", { name: /Terminer la leçon/ })).toBeNull();
    expect(ouvrirLecon).not.toHaveBeenCalled();
  });

  it("la consigne riche (fin du lot 4)", () => {
    const d = donnees();
    afficher({ ...d, lecon: { ...d.lecon, document: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Étape 1" }] }, { type: "encadre", attrs: { ton: "attention" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Sauvegardez avant." }] }] }] }, images: {} } });
    const consigne = screen.getByRole("region", { name: "Consigne" });
    expect(within(consigne).getByRole("heading", { name: "Étape 1" })).toBeInTheDocument();
    expect(within(consigne).getByRole("note", { name: "Attention" })).toBeInTheDocument();
  });

  it("un visiteur est invité à se connecter ; un exercice illisible (avant la 0032) le dit", () => {
    const { unmount } = afficher(donnees({ exercice: undefined }), false);
    expect(screen.getByText("Connectez-vous pour faire cet exercice.")).toBeInTheDocument();
    expect(screen.queryByText("Déposer votre travail")).toBeNull();
    unmount();
    afficher(donnees({ exercice: null }));
    expect(screen.getByText("Cet exercice n’est pas disponible pour le moment.")).toBeInTheDocument();
  });
});

describe("Un exercice dans le programme", () => {
  it("la page leçon et le téléphone : « Exercice » et son statut", () => {
    const { unmount } = render(<ProgrammeLecon fiche={FICHE} leconId={module1.lecons[0].id} connecte terminees={new Set()} statuts={STATUTS} />);
    expect(screen.getByRole("link", { name: /Tableau des ventes/ })).toHaveTextContent("Exercice · À corriger");
    expect(screen.getByRole("link", { name: /Nettoyer une enquête/ })).toHaveTextContent("Exercice · Validé");
    unmount();
    render(<ProgrammeMobile fiche={FICHE} leconId={module1.lecons[0].id} connecte terminees={new Set()} statuts={STATUTS} />);
    expect(screen.getByRole("link", { name: /Tableau des ventes/ })).toHaveTextContent("Exercice · À corriger");
  });

  it("la fiche : « 2 exercices », le statut dans le programme ; la fiche publique dit « Exercice »", () => {
    expect(resumeProgramme(FICHE)).toContain(" • 2 exercices • ");
    expect(elementsInclus({ ...FICHE, nbExercices: 1 }).map((e) => e.texte)).toContain("1 exercice pratique, à faire ou à rendre");
    const lignes = EXCEL_OUVERTE.modules.flatMap((m) => m.lecons).map((l) => ({ leconId: l.id, formationId: FICHE.id, termineeLe: null, vueLe: "2026-10-15T08:00:00Z", positionSecondes: 0 }));
    const { unmount } = render(<FicheConnectee fiche={FICHE} progression={etatFormation(FICHE, lignes)} statuts={STATUTS} />);
    // Sous le titre : « 4 modules • 12 leçons • 2 exercices • … ».
    expect(screen.getByText(resumeProgramme(FICHE))).toHaveTextContent(/ • 2 exercices • /);
    expect(screen.getByRole("link", { name: /Tableau des ventes/ })).toHaveTextContent("Exercice · À corriger");
    unmount();
    render(<ProgrammeFiche fiche={FICHE} />);
    expect(screen.getByText("Tableau des ventes").closest("li")).toHaveTextContent(/Tableau des ventes\s*Exercice$/);
  });
});
