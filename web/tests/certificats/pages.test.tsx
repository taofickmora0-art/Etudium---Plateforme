// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Certificat, PageCertificats } from "@/lib/certificats/types";

// Lot 3, étape C : la page « Certificats » (NdCertificats) et la vérification publique (NdVerification,
// NdVerificationValide).
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/verifier" }));
const { ListeCertificats } = await import("@/components/certificats/ListeCertificats");
const { FormulaireVerification } = await import("@/components/certificats/FormulaireVerification");
const { ResultatVerification } = await import("@/components/certificats/ResultatVerification");
const { EnTetePublic } = await import("@/components/site/EnTetePublic");
const { PiedDePagePublic } = await import("@/components/site/PiedDePagePublic");

const ID = "ET-2026-K7Q2-M9XD";
const CERTIFICAT: Certificat = { identifiant: ID, titulaire: "Aïcha Kpadé", formation: "Maîtriser Microsoft Excel", formateur: "Dr Mireille Adjovi", parcours: "Réussite académique", delivreLe: "2026-10-15" };
const PAGE: PageCertificats = {
  obtenus: [{ ...CERTIFICAT, slug: "excel" }],
  enPreparation: [{ formationId: "f2", titre: "Microsoft Word", slug: "word", terminees: 3, total: 4, quizRestants: 1, exercicesRestants: 2 }],
};

beforeEach(() => push.mockReset());

describe("La page Certificats", () => {
  it("les certificats obtenus (voir, PDF, partager) et ceux en préparation, avec ce qui manque", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ListeCertificats page={PAGE} />
      </ToastProvider>,
    );
    const obtenus = screen.getByRole("region", { name: "Certificats obtenus" });
    const carte = within(obtenus).getByRole("article");
    expect(carte).toHaveTextContent("Maîtriser Microsoft Excel");
    expect(carte).toHaveTextContent("Obtenu le 15 octobre 2026");
    expect(carte).toHaveTextContent("Vérifiable par QR Code");
    expect(within(carte).getByRole("link", { name: "Voir" })).toHaveAttribute("href", "/formations/excel/validation");
    expect(within(carte).getByRole("link", { name: "Télécharger le PDF" })).toHaveAttribute("href", `/certificats/${ID}/pdf`);
    await user.click(within(carte).getByRole("button", { name: "Partager" }));
    expect(screen.getByRole("dialog", { name: "Partager votre certificat" })).toBeInTheDocument();
    // La fenêtre fermée, la page redevient lisible.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const preparation = screen.getByRole("region", { name: "En préparation" });
    expect(within(preparation).getByRole("link", { name: /Microsoft Word/ })).toHaveAttribute("href", "/formations/word/validation");
    expect(preparation).toHaveTextContent("1 leçon restante · 1 quiz à réussir · 2 exercices à valider");
    expect(within(preparation).getByRole("progressbar", { name: "Progression : Microsoft Word" })).toHaveAttribute("aria-valuenow", "75");
  });

  it("rien encore : deux messages", () => {
    render(
      <ToastProvider>
        <ListeCertificats page={{ obtenus: [], enPreparation: [] }} />
      </ToastProvider>,
    );
    expect(screen.getByText("Aucun certificat pour le moment")).toBeInTheDocument();
    expect(screen.getByText("Commencez une formation : elle s’affichera ici jusqu’à son certificat.")).toBeInTheDocument();
  });
});

describe("La vérification publique", () => {
  it("le formulaire : un identifiant mal formé est signalé ; sinon, la page du résultat (minuscules acceptées)", async () => {
    const user = userEvent.setup();
    render(<FormulaireVerification />);
    const champ = screen.getByRole("textbox", { name: "Identifiant du certificat" });
    expect(champ).toHaveAttribute("placeholder", "ET-2026-XXXX-XXXX");
    await user.type(champ, "ET-2026");
    await user.click(screen.getByRole("button", { name: "Vérifier" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Saisissez l’identifiant tel qu’il figure sur le certificat : ET-2026-XXXX-XXXX.");
    expect(push).not.toHaveBeenCalled();
    await user.clear(champ);
    await user.type(champ, " et-2026-k7q2-m9xd ");
    await user.click(screen.getByRole("button", { name: "Vérifier" }));
    expect(push).toHaveBeenCalledWith(`/c/${ID}`);
  });

  it("le résultat : « Certificat authentique. » et ses informations ; sinon « Aucun certificat trouvé. »", () => {
    const { unmount } = render(<ResultatVerification certificat={CERTIFICAT} />);
    const resultat = screen.getByRole("region", { name: "Résultat de la vérification" });
    expect(resultat).toHaveTextContent("Certificat authentique.");
    expect(resultat).toHaveTextContent("Ce certificat a bien été délivré par Étudium.");
    const infos = Object.fromEntries(within(resultat).getAllByRole("term").map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]));
    expect(infos).toEqual({
      Titulaire: "Aïcha Kpadé",
      Formation: "Maîtriser Microsoft Excel",
      "Date d’obtention": "15 octobre 2026",
      Identifiant: ID,
      Parcours: "Réussite académique",
      "Formation animée par": "Dr Mireille Adjovi",
    });
    unmount();
    render(<ResultatVerification certificat={null} />);
    expect(screen.getByText("Aucun certificat trouvé.")).toBeInTheDocument();
    expect(screen.getByText("Vérifiez l’identifiant (lettres et chiffres) ou scannez à nouveau le QR Code.")).toBeInTheDocument();
  });

  it("l'en-tête et le pied de page publics mènent à « Vérifier un certificat »", () => {
    const { unmount } = render(<EnTetePublic />);
    expect(screen.getByRole("link", { name: "Vérifier un certificat" })).toHaveAttribute("href", "/verifier");
    unmount();
    render(<PiedDePagePublic />);
    expect(screen.getByRole("link", { name: "Vérifier un certificat" })).toHaveAttribute("href", "/verifier");
  });
});
