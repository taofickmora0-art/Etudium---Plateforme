// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { EtatValidation } from "@/lib/certificats/types";
import { etatFormation } from "@/lib/progression/regles";
import { EXCEL_OUVERTE } from "../lecon/donnees";

// Lot 3, étape C : « Validation de votre formation » (NdCertificat, NdCertificatObtenu, NdCertificatPartage), le lien
// depuis la fiche, et le réglage « Exercices obligatoires » de la carte « Certification ».
vi.mock("@/lib/certificats/actions", () => ({ marquerCertificatVu: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));
vi.mock("@/lib/admin/actions", () => ({ saveFormationInfos: vi.fn(), setStatutFormation: vi.fn(), deleteFormation: vi.fn() }));
const { marquerCertificatVu } = await import("@/lib/certificats/actions");
const { ValidationFormation } = await import("@/components/certificats/ValidationFormation");
const { FicheConnectee } = await import("@/components/catalogue/FicheConnectee");
const { ProgrammeLecon } = await import("@/components/lecon/ProgrammeLecon");

const ID = "ET-2026-K7Q2-M9XD";
const INCOMPLET: EtatValidation = {
  lecons: { terminees: 2, total: 3 },
  minimum: 70,
  exercicesObligatoires: true,
  quiz: [{ id: "q1", titre: "Quiz du module 1", meilleur: 45, reussi: false }],
  exercices: [{ id: "x1", titre: "Tableau des ventes", statut: "en_attente", valide: false }],
  complet: false,
  certificat: null,
};
const DELIVRE: EtatValidation = {
  ...INCOMPLET,
  lecons: { terminees: 3, total: 3 },
  quiz: [{ id: "q1", titre: "Quiz du module 1", meilleur: 75, reussi: true }],
  exercices: [{ id: "x1", titre: "Tableau des ventes", statut: "valide", valide: true }],
  complet: true,
  certificat: { identifiant: ID, titulaire: "Aïcha Kpadé", formation: "Maîtriser Microsoft Excel", formateur: "Dr Mireille Adjovi", parcours: "Réussite académique", delivreLe: "2026-10-15", vu: false },
};
const afficher = (etat: EtatValidation) =>
  render(
    <ToastProvider>
      <ValidationFormation etat={etat} formation={{ titre: "Maîtriser Microsoft Excel", slug: "excel" }} prenom="Aïcha" />
    </ToastProvider>,
  );

beforeEach(() => vi.mocked(marquerCertificatVu).mockClear());

describe("La validation de la formation", () => {
  it("chaque condition, remplie ou non, avec un lien vers ce qui manque ; le certificat pas encore délivré", () => {
    afficher(INCOMPLET);
    const conditions = screen.getByRole("list", { name: "Conditions de validation" });
    const lignes = within(conditions).getAllByRole("listitem");
    expect(lignes[0]).toHaveTextContent("Toutes les leçons terminées");
    expect(lignes[0]).toHaveTextContent("2 / 3");
    expect(lignes[1]).toHaveTextContent("Quiz « Quiz du module 1 » réussi");
    expect(lignes[1]).toHaveTextContent("45 % · minimum 70 %");
    expect(within(lignes[1]).getByRole("link", { name: /Quiz du module 1/ })).toHaveAttribute("href", "/formations/excel/lecons/q1");
    expect(lignes[2]).toHaveTextContent("Exercice « Tableau des ventes » validé");
    expect(lignes[2]).toHaveTextContent("En attente");
    expect(screen.getByRole("progressbar", { name: "Progression du contenu" })).toHaveAttribute("aria-valuenow", "67");
    expect(screen.getByText("Votre certificat sera délivré dès que toutes les conditions seront remplies.")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Certificat de réussite/ })).toBeNull();
  });

  it("des exercices facultatifs : ils sont listés à part, sans compter", () => {
    afficher({ ...INCOMPLET, exercicesObligatoires: false });
    expect(within(screen.getByRole("list", { name: "Conditions de validation" })).queryByText(/Tableau des ventes/)).toBeNull();
    expect(screen.getByText("Les exercices sont facultatifs pour cette formation : ils ne comptent pas pour le certificat.")).toBeInTheDocument();
  });

  it("délivré : « Félicitations, Aïcha ! » une fois, le certificat, le PDF, la vérification", async () => {
    const user = userEvent.setup();
    afficher(DELIVRE);
    const fenetre = await screen.findByRole("dialog", { name: "Félicitations, Aïcha !" });
    expect(fenetre).toHaveTextContent("Vous avez validé « Maîtriser Microsoft Excel ». Votre certificat est prêt, avec son QR Code de vérification.");
    expect(marquerCertificatVu).toHaveBeenCalledWith(ID);
    await user.click(within(fenetre).getByRole("button", { name: "Voir mon certificat" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Votre formation est validée. Votre certificat est prêt.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Certificat de réussite d’Aïcha Kpadé pour la formation Maîtriser Microsoft Excel" })).toHaveAttribute("src", `/certificats/${ID}/image`);
    expect(screen.getByRole("link", { name: "Télécharger le PDF" })).toHaveAttribute("href", `/certificats/${ID}/pdf`);
    expect(screen.getByRole("link", { name: "Vérifier" })).toHaveAttribute("href", `/c/${ID}`);
  });

  it("le texte de l'image élide seulement devant une voyelle : « de Kossi », « d’Aïcha »", () => {
    afficher({ ...DELIVRE, certificat: { ...DELIVRE.certificat!, titulaire: "Kossi Agbo", vu: true } });
    expect(screen.getByRole("img", { name: "Certificat de réussite de Kossi Agbo pour la formation Maîtriser Microsoft Excel" })).toBeInTheDocument();
  });

  it("le programme de la page leçon mène aussi à « Validation et certificat » (compte connecté)", () => {
    const premiere = EXCEL_OUVERTE.modules[0].lecons[0];
    const lignes = [{ leconId: premiere.id, formationId: EXCEL_OUVERTE.id, termineeLe: "2026-10-15T08:00:00Z", vueLe: "2026-10-15T08:00:00Z", positionSecondes: 0 }];
    const { unmount } = render(<ProgrammeLecon fiche={EXCEL_OUVERTE} leconId={premiere.id} connecte terminees={etatFormation(EXCEL_OUVERTE, lignes).terminees} />);
    expect(screen.getByRole("link", { name: "Validation et certificat" })).toHaveAttribute("href", `/formations/${EXCEL_OUVERTE.slug}/validation`);
    unmount();
    render(<ProgrammeLecon fiche={EXCEL_OUVERTE} leconId={premiere.id} connecte={false} terminees={new Set()} />);
    expect(screen.queryByRole("link", { name: "Validation et certificat" })).toBeNull();
  });

  it("déjà vu : pas de fenêtre ; « Partager » : le lien de vérification à copier", async () => {
    const user = userEvent.setup({ writeToClipboard: true });
    afficher({ ...DELIVRE, certificat: { ...DELIVRE.certificat!, vu: true } });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(marquerCertificatVu).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Partager" }));
    const fenetre = screen.getByRole("dialog", { name: "Partager votre certificat" });
    expect(fenetre).toHaveTextContent("Toute personne disposant du lien peut vérifier son authenticité.");
    const lien = within(fenetre).getByRole("textbox", { name: "Lien de vérification" });
    expect((lien as HTMLInputElement).value).toMatch(new RegExp(`/c/${ID}$`));
    await user.click(within(fenetre).getByRole("button", { name: "Copier" }));
    expect(await navigator.clipboard.readText()).toBe((lien as HTMLInputElement).value);
    expect(await screen.findByText("Lien copié")).toBeInTheDocument();
  });
});

describe("Les accès à la validation", () => {
  it("la fiche d'une formation commencée mène à « Validation et certificat »", () => {
    const lignes = EXCEL_OUVERTE.modules.flatMap((m) => m.lecons).slice(0, 2).map((l) => ({ leconId: l.id, formationId: EXCEL_OUVERTE.id, termineeLe: "2026-10-15T08:00:00Z", vueLe: "2026-10-15T08:00:00Z", positionSecondes: 0 }));
    render(<FicheConnectee fiche={EXCEL_OUVERTE} progression={etatFormation(EXCEL_OUVERTE, lignes)} />);
    expect(screen.getByRole("link", { name: "Validation et certificat" })).toHaveAttribute("href", `/formations/${EXCEL_OUVERTE.slug}/validation`);
  });
});
