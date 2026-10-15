// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormationAdmin } from "@/lib/admin/types";

vi.mock("@/lib/admin/actions", () => ({
  saveFormationInfos: vi.fn(),
  setStatutFormation: vi.fn(),
  deleteFormation: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { FormationInfosForm } = await import("@/components/admin/FormationInfosForm");
const { PublicationPanel } = await import("@/components/admin/PublicationPanel");

const FORMATION: FormationAdmin = {
  id: "f1",
  slug: "maitriser-microsoft-excel",
  titre: "Maîtriser Microsoft Excel",
  statut: "publiee",
  niveau: "intermediaire",
  nbLecons: 12,
  parcours: ["Académique"],
  resume: "",
  description: "",
  objectifs: ["Construire des formules", "Créer des graphiques"],
  competences: [],
  formateurId: null,
  gratuite: false,
  achatSepare: true,
  prixFcfa: null,
  badge: "populaire",
  seuilVideo: 90,
  scoreQuiz: 70,
  publieeLe: "2026-08-13T00:00:00Z",
  parcoursIds: ["p1"],
  modules: [],
  couverture: null,
  etat: "publiee",
  modifieeParFormateurLe: null,
  envoyeeLe: null,
  renvoyeeLe: null,
  remarqueRelecture: null,
};
const PARCOURS = [
  { id: "p1", slug: "reussite-academique", nom: "Réussite académique", nomCourt: "Académique", description: "", couleur: "academique" as const, ordre: 1, actif: true },
  { id: "p2", slug: "competences-digitales", nom: "Compétences digitales", nomCourt: "Digital", description: "", couleur: "digital" as const, ordre: 2, actif: true },
];

const avecNotifications = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

describe("Fiche d'une formation au back-office", () => {
  it("l'adresse d'une formation publiée est en lecture seule", () => {
    avecNotifications(<FormationInfosForm formation={FORMATION} parcours={PARCOURS} formateurs={[]} />);
    expect(screen.getByLabelText("Adresse")).toHaveAttribute("readonly");
    expect(screen.getByText("Fixée depuis la publication : les liens partagés restent valables.")).toBeInTheDocument();
    expect(screen.getByLabelText("Ce que vous allez apprendre")).toHaveValue("Construire des formules\nCréer des graphiques");
    expect(screen.getByRole("checkbox", { name: "Réussite académique" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Compétences digitales" })).not.toBeChecked();
  });

  it("le score minimal aux quiz : réglé par l'équipe comme par le formateur (lot 3)", () => {
    const { unmount } = avecNotifications(<FormationInfosForm formation={{ ...FORMATION, scoreQuiz: 80 }} parcours={PARCOURS} formateurs={[]} />);
    expect(screen.getByLabelText("Score minimal aux quiz (%)")).toHaveValue(80);
    expect(screen.getByLabelText("Score minimal aux quiz (%)")).toHaveAttribute("name", "score_quiz");
    unmount();
    avecNotifications(<FormationInfosForm formation={FORMATION} parcours={PARCOURS} formateurs={[]} espace="formateur" />);
    expect(screen.getByLabelText("Score minimal aux quiz (%)")).toHaveValue(70);
  });

  it("l'adresse d'un brouillon reste modifiable", () => {
    avecNotifications(<FormationInfosForm formation={{ ...FORMATION, statut: "brouillon", publieeLe: null }} parcours={PARCOURS} formateurs={[]} />);
    expect(screen.getByLabelText("Adresse")).not.toHaveAttribute("readonly");
  });

  it("les boutons de publication suivent le statut", () => {
    const pub = (statut: "brouillon" | "publiee" | "archivee") => (
      <PublicationPanel id="f1" formation={{ ...FORMATION, statut, etat: statut }} formateurNom={null} />
    );
    const { unmount } = avecNotifications(pub("brouillon"));
    expect(screen.getByRole("button", { name: "Publier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Supprimer le brouillon" })).toBeInTheDocument();
    unmount();
    const publiee = avecNotifications(pub("publiee"));
    expect(screen.getByRole("button", { name: "Archiver" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Supprimer le brouillon" })).toBeNull();
    publiee.unmount();
    avecNotifications(pub("archivee"));
    expect(screen.getByRole("button", { name: "Republier" })).toBeInTheDocument();
  });
});
