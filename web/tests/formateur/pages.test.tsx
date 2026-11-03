// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormationAdmin, FormationResume } from "@/lib/admin/types";

// Espace formateur, « Mes formations » (spec de l'espace formateur, §3).

const lireMaFiche = vi.fn();
const estMaFormation = vi.fn();
vi.mock("@/lib/formateur/data", () => ({ lireMaFiche: () => lireMaFiche(), estMaFormation: (id: string) => estMaFormation(id) }));
const listFormations = vi.fn();
const getFormationAdmin = vi.fn();
const getLeconAdmin = vi.fn();
vi.mock("@/lib/admin/data", () => ({
  listFormations: (...a: unknown[]) => listFormations(...a),
  getFormationAdmin: (id: string) => getFormationAdmin(id),
  getLeconAdmin: (id: string) => getLeconAdmin(id),
  listParcours: async () => [],
  estTablesAbsentes: () => false,
}));
// Les compétences qu'une formation Business apprend à vendre (0048) : lues pour la rubrique de l'éditeur.
vi.mock("@/lib/catalogue/data", () => ({ competencesAVendre: async () => ({ competences: [], liees: [] }) }));
const envoyerEnRelecture = vi.fn();
const deleteFormation = vi.fn();
vi.mock("@/lib/admin/actions", () => ({
  envoyerEnRelecture: (...a: unknown[]) => envoyerEnRelecture(...a),
  deleteFormation: (...a: unknown[]) => deleteFormation(...a),
  createFormation: vi.fn(),
  saveFormationInfos: vi.fn(),
  addModule: vi.fn(),
  renameModule: vi.fn(),
  deleteModule: vi.fn(),
  addLecon: vi.fn(),
  deleteLecon: vi.fn(),
  deplacer: vi.fn(),
  addRessource: vi.fn(),
  updateRessource: vi.fn(),
  deleteRessource: vi.fn(),
  enregistrerCouverture: vi.fn(),
  retirerCouverture: vi.fn(),
}));
const routeur = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routeur,
  usePathname: () => "/formateur/formations",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { MesFormations } = await import("@/components/formateur/MesFormations");
const { NouvelleFormationFormateur } = await import("@/components/formateur/NouvelleFormationFormateur");
const { EditeurFormateur } = await import("@/components/formateur/EditeurFormateur");
const { LeconFormateur } = await import("@/components/formateur/LeconFormateur");
const { PublicationFormateur } = await import("@/components/formateur/PublicationFormateur");

const F = "11111111-1111-4111-8111-111111111111";
const resume = (id: string, titre: string, etat: FormationResume["etat"]): FormationResume => ({
  id,
  slug: titre.toLowerCase(),
  titre,
  statut: etat === "publiee" || etat === "archivee" ? etat : "brouillon",
  etat,
  niveau: "debutant",
  nbLecons: 2,
  parcours: [],
  modifieeParFormateurLe: null,
});
const FORMATION: FormationAdmin = {
  ...resume(F, "Excel", "brouillon"),
  resume: "",
  description: "",
  objectifs: [],
  competences: [],
  formateurId: "fa",
  gratuite: false,
  badge: null,
  seuilVideo: 90,
  scoreQuiz: 70,
  exercicesObligatoires: true,
  publieeLe: null,
  parcoursIds: [],
  modules: [],
  couverture: null,
  envoyeeLe: null,
  renvoyeeLe: null,
  remarqueRelecture: null,
};
const avecToast = (enfant: React.ReactNode) => render(<ToastProvider>{enfant}</ToastProvider>);

beforeEach(() => {
  for (const f of [lireMaFiche, estMaFormation, listFormations, getFormationAdmin, getLeconAdmin, envoyerEnRelecture, deleteFormation, routeur.push]) f.mockReset();
  lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: "fa" });
  estMaFormation.mockResolvedValue(true);
  envoyerEnRelecture.mockResolvedValue({ ok: true });
  deleteFormation.mockResolvedValue({ ok: true, redirection: "/formateur/formations" });
});

describe("Mes formations", () => {
  it("ses formations avec leur état, et le lien vers une nouvelle formation", async () => {
    listFormations.mockResolvedValue([resume("a", "Excel", "en_attente"), resume("b", "Word", "a_corriger")]);
    avecToast(await MesFormations());
    expect(listFormations).toHaveBeenCalledWith({ formateurId: "fa" });
    const lignes = within(screen.getByRole("list", { name: "Mes formations" })).getAllByRole("listitem");
    expect(within(lignes[0]).getByText("Excel")).toBeInTheDocument();
    expect(within(lignes[0]).getByText("En attente de validation")).toBeInTheDocument();
    expect(within(lignes[0]).getByRole("link")).toHaveAttribute("href", "/formateur/formations/a");
    expect(within(lignes[1]).getByText("À corriger")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nouvelle formation" })).toHaveAttribute("href", "/formateur/formations/nouvelle");
    expect(screen.getByRole("link", { name: "Espace formateur" })).toHaveAttribute("href", "/formateur");
  });

  it("sans formation : le message", async () => {
    listFormations.mockResolvedValue([]);
    avecToast(await MesFormations());
    expect(screen.getByText("Vous n’avez pas encore de formation. Créez-en une : elle reste un brouillon tant que vous ne l’envoyez pas en relecture.")).toBeInTheDocument();
  });

  it("sans fiche formateur reliée : le message, sans liste ni bouton", async () => {
    lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: null });
    avecToast(await MesFormations());
    expect(screen.getByText("Votre compte n’est pas encore relié à une fiche formateur. Contactez l’équipe Étudium.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nouvelle formation" })).not.toBeInTheDocument();
    expect(listFormations).not.toHaveBeenCalled();
  });

  it("avant la migration 0014 : un bandeau neutre, sans migration", async () => {
    lireMaFiche.mockResolvedValue({ migrationAbsente: true });
    avecToast(await MesFormations());
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
    expect(screen.queryByText(/migration|dans la base/i)).toBeNull();
  });

  it("nouvelle formation : le formulaire de l'espace formateur ; sans fiche, le message", async () => {
    const { container, unmount } = avecToast(await NouvelleFormationFormateur());
    expect(screen.getByLabelText("Titre de la formation")).toBeInTheDocument();
    expect(container.querySelector('input[name="espace"]')).toHaveValue("formateur");
    unmount();
    lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: null });
    avecToast(await NouvelleFormationFormateur());
    expect(screen.getByText(/pas encore relié à une fiche formateur/)).toBeInTheDocument();
  });
});

describe("Éditeur du formateur", () => {
  const params = (id = F) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });

  it("la formation d'un autre (même publiée et lisible) : page introuvable", async () => {
    estMaFormation.mockResolvedValue(false);
    await expect(EditeurFormateur(params())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getFormationAdmin).not.toHaveBeenCalled();
  });

  it("l'éditeur en mode formateur : pas de choix du formateur, fil de l'espace formateur", async () => {
    getFormationAdmin.mockResolvedValue(FORMATION);
    avecToast(await EditeurFormateur(params()));
    expect(screen.getByRole("heading", { level: 1, name: "Excel" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Formateur")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Réglé par l’équipe Étudium" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mes formations" })).toHaveAttribute("href", "/formateur/formations");
  });

  it("la leçon d'une formation d'un autre, ou d'une autre formation : page introuvable", async () => {
    estMaFormation.mockResolvedValue(false);
    await expect(LeconFormateur({ params: Promise.resolve({ id: F, leconId: "l1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    estMaFormation.mockResolvedValue(true);
    getLeconAdmin.mockResolvedValue({ id: "l1", formationId: "autre", formationTitre: "Autre" });
    await expect(LeconFormateur({ params: Promise.resolve({ id: F, leconId: "l1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("Publication, côté formateur", () => {
  const pub = (champs: Partial<FormationAdmin>) => avecToast(<PublicationFormateur id={F} formation={{ ...FORMATION, ...champs }} />);

  it("brouillon : envoyer en relecture (confirmation) ou supprimer le brouillon", async () => {
    const user = userEvent.setup();
    pub({});
    await user.click(screen.getByRole("button", { name: "Envoyer en relecture" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Envoyer" }));
    expect(envoyerEnRelecture).toHaveBeenCalledWith(F);
    expect(screen.getByRole("button", { name: "Supprimer le brouillon" })).toBeInTheDocument();
  });

  it("supprimer le brouillon ramène à Mes formations", async () => {
    const user = userEvent.setup();
    pub({});
    await user.click(screen.getByRole("button", { name: "Supprimer le brouillon" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer" }));
    expect(deleteFormation).toHaveBeenCalledWith(F, "formateur");
    expect(routeur.push).toHaveBeenCalledWith("/formateur/formations");
  });

  it("en attente : la date, et il peut continuer à modifier", () => {
    pub({ etat: "en_attente", envoyeeLe: "2026-10-13T08:00:00Z" });
    expect(screen.getByText("Envoyée en relecture le 13 oct. 2026. Un admin la relit ; vous pouvez continuer à la modifier.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Envoyer en relecture" })).not.toBeInTheDocument();
  });

  it("à corriger : la remarque de l'admin et sa date, puis renvoyer", () => {
    pub({ etat: "a_corriger", renvoyeeLe: "2026-10-13T08:00:00Z", remarqueRelecture: "Ajoutez une vidéo d’introduction." });
    expect(screen.getByText("Ajoutez une vidéo d’introduction.")).toBeInTheDocument();
    expect(screen.getByText(/Renvoyée le 13 oct\. 2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Envoyer en relecture" })).toBeInTheDocument();
  });

  it("publiée, puis archivée", () => {
    const { unmount } = pub({ statut: "publiee", etat: "publiee", publieeLe: "2026-10-01T08:00:00Z" });
    expect(screen.getByText("En ligne depuis le 1 oct. 2026. Vos corrections sont visibles tout de suite.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();
    pub({ statut: "archivee", etat: "archivee", publieeLe: "2026-10-01T08:00:00Z" });
    expect(screen.getByText("Archivée par l’équipe Étudium.")).toBeInTheDocument();
  });
});
