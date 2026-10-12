// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { RESSOURCE_MAX_OCTETS } from "@/lib/admin/fichiers";
import type { LeconAdmin } from "@/lib/admin/types";

const upload = vi.fn();
const remove = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload, remove }) } }) }));
vi.mock("@/lib/admin/actions", () => ({ addRessource: vi.fn(), updateRessource: vi.fn(), deleteRessource: vi.fn(), deplacer: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { addRessource } = await import("@/lib/admin/actions");
const { RessourcesEditor } = await import("@/components/admin/RessourcesEditor");

const LECON = {
  id: "l1",
  formationId: "f1",
  ressources: [
    { id: "r1", titre: "donnees-enquete", fichier: "f1/a.xlsx", format: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", tailleOctets: 84000, telechargeable: true, ordre: 1 },
    { id: "r2", titre: "Guide des tableaux croisés", fichier: "f1/b.pdf", format: "application/pdf", tailleOctets: 1200000, telechargeable: false, ordre: 2 },
  ],
} as unknown as LeconAdmin;

const afficher = (lecon: LeconAdmin = LECON) =>
  render(
    <ToastProvider>
      <RessourcesEditor lecon={lecon} />
    </ToastProvider>,
  );
const deposer = async (container: HTMLElement, fichier: File) => {
  const champ = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  await userEvent.upload(champ, fichier, { applyAccept: false });
};

describe("Ressources d'une leçon au back-office", () => {
  beforeEach(() => {
    [upload, remove].forEach((f) => f.mockReset());
    vi.mocked(addRessource).mockReset();
    upload.mockResolvedValue({ data: {}, error: null });
    remove.mockResolvedValue({ data: [], error: null });
    vi.mocked(addRessource).mockResolvedValue({ ok: true });
  });

  it("chaque ressource dit son format, sa taille et son mode", () => {
    afficher();
    expect(screen.getByText("Excel · 84 Ko · Téléchargeable")).toBeInTheDocument();
    expect(screen.getByText("PDF · 1,2 Mo · Consultation seule")).toBeInTheDocument();
    // Un fichier Excel ne peut pas être en consultation seule : pas d'interrupteur pour lui.
    expect(screen.getAllByRole("switch", { name: "Consultation seule" })).toHaveLength(1);
  });

  it("un faux PDF est refusé sans envoi", async () => {
    const { container } = afficher();
    await deposer(container, new File(["bonjour"], "guide.pdf", { type: "application/pdf" }));
    expect(await screen.findByText(/Format non accepté/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("un fichier trop lourd est refusé", async () => {
    const { container } = afficher();
    const lourd = new File(["%PDF-1.7"], "gros.pdf", { type: "application/pdf" });
    Object.defineProperty(lourd, "size", { value: RESSOURCE_MAX_OCTETS + 1 });
    await deposer(container, lourd);
    expect(await screen.findByText(/dépasse 50 Mo/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("un PDF est envoyé dans le dossier de la formation, puis enregistré", async () => {
    const { container } = afficher();
    const pdf = new File(["%PDF-1.7 contenu"], "Guide des TCD.pdf", { type: "application/pdf" });
    await deposer(container, pdf);
    await waitFor(() => expect(addRessource).toHaveBeenCalled());
    const [chemin, fichier, options] = upload.mock.calls[0];
    expect(chemin).toMatch(/^f1\/[0-9a-f-]{36}\.pdf$/);
    expect(fichier).toBe(pdf);
    expect(options).toMatchObject({ contentType: "application/pdf", upsert: false });
    expect(addRessource).toHaveBeenCalledWith({ leconId: "l1", titre: "Guide des TCD", fichier: chemin, format: "application/pdf", tailleOctets: pdf.size });
  });

  it("si l'enregistrement échoue, le fichier envoyé est retiré", async () => {
    vi.mocked(addRessource).mockResolvedValue({ ok: false, message: "Accès réservé à l’équipe." });
    const { container } = afficher();
    await deposer(container, new File(["%PDF-1.7"], "guide.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(remove).toHaveBeenCalled());
    expect(remove.mock.calls[0][0]).toEqual([upload.mock.calls[0][0]]);
    expect(await screen.findByText(/Accès réservé à l’équipe/)).toBeInTheDocument();
  });
});
