// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ExerciceEtudiant, VersionRendu } from "@/lib/exercices/types";

// Lot 3, étape B : l'étudiant fait un exercice (NdExercice, NdExerciceEnvoi, NdExerciceEnvoye) dans la page leçon.
vi.mock("@/lib/exercices/actions", () => ({ rendreExercice: vi.fn(), terminerExercice: vi.fn(), lienRendu: vi.fn() }));
const upload = vi.fn();
const remove = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) }, storage: { from: () => ({ upload, remove }) } }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const { rendreExercice, terminerExercice, lienRendu } = await import("@/lib/exercices/actions");
const { ExerciceLecon } = await import("@/components/exercices/ExerciceLecon");

const L = "11111111-1111-4111-8111-111111111111";
const R = "22222222-2222-4222-8222-222222222222";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const version = (o: Partial<VersionRendu> = {}): VersionRendu => ({
  id: R,
  version: 1,
  nomFichier: "Tableau_ventes.xlsx",
  format: XLSX,
  tailleOctets: 142000,
  message: "",
  statut: "en_attente",
  remarque: "",
  correcteur: null,
  corrigeLe: null,
  creeLe: new Date(Date.now() - 2 * 3600_000).toISOString(),
  aUnFichier: true,
  ...o,
});
const RENDU: ExerciceEtudiant = { genre: "rendu", statut: null, peutDeposer: true, versions: [] };

function afficher(exercice: ExerciceEtudiant) {
  return render(
    <ToastProvider>
      <ExerciceLecon leconId={L} exercice={exercice} />
    </ToastProvider>,
  );
}
const xlsx = (nom = "Tableau.xlsx") => new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4])], nom, { type: XLSX });
const deposer = async (container: HTMLElement, fichier: File) => {
  await userEvent.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, fichier, { applyAccept: false });
};

beforeEach(() => {
  for (const f of [rendreExercice, terminerExercice, lienRendu, upload, remove]) vi.mocked(f).mockReset();
  upload.mockResolvedValue({ data: {}, error: null });
  remove.mockResolvedValue({ data: [], error: null });
});

describe("Un exercice simple", () => {
  it("« Marquer comme terminé », puis « Exercice terminé »", async () => {
    const user = userEvent.setup();
    vi.mocked(terminerExercice).mockResolvedValue({ ok: true });
    const { unmount } = afficher({ genre: "simple", statut: null, peutDeposer: false, versions: [] });
    await user.click(screen.getByRole("button", { name: "Marquer comme terminé" }));
    expect(terminerExercice).toHaveBeenCalledWith(L);
    expect(await screen.findByText("Exercice marqué comme terminé")).toBeInTheDocument();
    // Le bouton disparaît : le focus passe à l'état de l'exercice.
    expect(screen.getByText("Exercice terminé")).toHaveFocus();
    unmount();
    afficher({ genre: "simple", statut: "valide", peutDeposer: false, versions: [version({ statut: "valide", aUnFichier: false })] });
    expect(screen.getByText("Exercice terminé")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marquer comme terminé" })).toBeNull();
  });
});

describe("Un exercice avec rendu", () => {
  it("déposer son travail : le fichier, le message, « Envoyer votre travail ? », puis « Travail envoyé »", async () => {
    const user = userEvent.setup();
    vi.mocked(rendreExercice).mockResolvedValue({ ok: true, version: 1 });
    const { container } = afficher(RENDU);
    expect(screen.getByText("Déposer votre travail")).toBeInTheDocument();
    expect(screen.getByText("PDF, Word, Excel, PowerPoint, image ou ZIP · 20 Mo maximum")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Envoyer mon travail" })).toBeDisabled();
    await deposer(container, xlsx());
    expect(screen.getByText("Tableau.xlsx")).toBeInTheDocument();
    expect(screen.getByText("1 Ko · prêt à être envoyé")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Message pour le formateur/ }), "Voici mon tableau.");
    expect(screen.getByText("Vous ne pourrez plus modifier votre fichier tant qu’il n’est pas corrigé.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Envoyer mon travail" }));
    const fenetre = screen.getByRole("dialog", { name: "Envoyer votre travail ?" });
    expect(fenetre).toHaveTextContent("Votre formateur recevra « Tableau.xlsx ». Vous ne pourrez plus le modifier tant qu’il n’est pas corrigé.");
    await user.click(within(fenetre).getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(rendreExercice).toHaveBeenCalled());
    const [chemin, fichier, options] = upload.mock.calls[0];
    expect(chemin).toMatch(new RegExp(`^u1/${L}/[0-9a-f-]{36}\\.xlsx$`));
    // Le type part avec le fichier lui-même (la bibliothèque ignore contentType pour un fichier) : celui vérifié.
    expect((fichier as Blob).type).toBe(XLSX);
    expect(options).toMatchObject({ contentType: XLSX, upsert: false });
    expect(rendreExercice).toHaveBeenCalledWith(L, chemin, "Tableau.xlsx", "Voici mon tableau.");
    expect(await screen.findByText("Travail envoyé")).toBeInTheDocument();
  });

  it("un ZIP annoncé « application/x-zip-compressed » par Windows part comme « application/zip »", async () => {
    const user = userEvent.setup();
    vi.mocked(rendreExercice).mockResolvedValue({ ok: true, version: 1 });
    const { container } = afficher(RENDU);
    await deposer(container, new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])], "projet.zip", { type: "application/x-zip-compressed" }));
    await user.click(screen.getByRole("button", { name: "Envoyer mon travail" }));
    await user.click(within(screen.getByRole("dialog", { name: "Envoyer votre travail ?" })).getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect((upload.mock.calls[0][1] as Blob).type).toBe("application/zip");
  });

  it("un format refusé ou un fichier trop lourd est arrêté dans le navigateur ; un refus de la base retire le fichier déposé", async () => {
    const user = userEvent.setup();
    const { container } = afficher(RENDU);
    await deposer(container, new File(["texte"], "notes.txt", { type: "text/plain" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ce format n’est pas accepté : PDF, Word, Excel, PowerPoint, image ou ZIP.");
    const lourd = xlsx("Gros.xlsx");
    Object.defineProperty(lourd, "size", { value: 21_000_000 });
    await deposer(container, lourd);
    expect(screen.getByRole("alert")).toHaveTextContent("Le fichier dépasse 20 Mo.");
    expect(screen.getByRole("button", { name: "Envoyer mon travail" })).toBeDisabled();

    vi.mocked(rendreExercice).mockResolvedValue({ ok: false, message: "Votre travail attend déjà sa correction." });
    await deposer(container, xlsx());
    await user.click(screen.getByRole("button", { name: "Envoyer mon travail" }));
    await user.click(within(screen.getByRole("dialog", { name: "Envoyer votre travail ?" })).getByRole("button", { name: "Envoyer" }));
    expect(await within(screen.getByRole("dialog")).findByText("Votre travail attend déjà sa correction.")).toBeInTheDocument();
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });

  it("en attente : plus de dépôt ; l'historique, avec le fichier à télécharger", async () => {
    const user = userEvent.setup();
    vi.mocked(lienRendu).mockResolvedValue({ erreur: "Ce fichier n’est pas accessible." });
    afficher({ genre: "rendu", statut: "en_attente", peutDeposer: false, versions: [version({ message: "Voici mon tableau." })] });
    expect(screen.getByText("Votre travail attend sa correction. Vous recevrez une notification dès qu’il sera corrigé.")).toBeInTheDocument();
    expect(screen.queryByText("Déposer votre travail")).toBeNull();
    const historique = screen.getByRole("list", { name: "Historique des rendus" });
    const [v1] = within(historique).getAllByRole("listitem");
    expect(v1).toHaveTextContent("Version 1");
    expect(v1).toHaveTextContent("En attente");
    expect(v1).toHaveTextContent("Tableau_ventes.xlsx");
    expect(v1).toHaveTextContent("Votre message : Voici mon tableau.");
    await user.click(within(v1).getByRole("button", { name: "Télécharger Tableau_ventes.xlsx" }));
    expect(lienRendu).toHaveBeenCalledWith(R);
    expect(await screen.findByText("Ce fichier n’est pas accessible.")).toBeInTheDocument();
  });

  it("le statut change après l'envoi : le focus passe au titre « Votre travail »", () => {
    const { rerender } = afficher(RENDU);
    rerender(
      <ToastProvider>
        <ExerciceLecon leconId={L} exercice={{ genre: "rendu", statut: "en_attente", peutDeposer: false, versions: [version()] }} />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: "Votre travail" })).toHaveFocus();
  });

  it("à corriger : la remarque du formateur, puis « Déposer une nouvelle version » ; validé : le commentaire", () => {
    const remarque = "Il manque le filtre par produit.";
    const { unmount } = afficher({
      genre: "rendu",
      statut: "a_corriger",
      peutDeposer: true,
      versions: [version({ statut: "a_corriger", remarque, correcteur: "Mireille Adjovi", corrigeLe: new Date().toISOString() })],
    });
    expect(screen.getByText("Une correction est demandée")).toBeInTheDocument();
    expect(screen.getByText("Déposer une nouvelle version")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Historique des rendus" })).getByText(`Remarque de Mireille Adjovi : ${remarque}`)).toBeInTheDocument();
    unmount();
    afficher({
      genre: "rendu",
      statut: "valide",
      peutDeposer: false,
      versions: [version({ version: 2, statut: "valide", remarque: "Bravo !", correcteur: "Mireille Adjovi" }), version({ statut: "a_corriger", remarque })],
    });
    expect(screen.getByText("Exercice validé")).toBeInTheDocument();
    expect(screen.getByText("Commentaire de Mireille Adjovi : Bravo !")).toBeInTheDocument();
    expect(screen.queryByText("Déposer une nouvelle version")).toBeNull();
    expect(within(screen.getByRole("list", { name: "Historique des rendus" })).getAllByRole("listitem")).toHaveLength(2);
  });
});
