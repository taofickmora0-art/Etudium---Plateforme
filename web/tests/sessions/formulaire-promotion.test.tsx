// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MoiCommunaute } from "@/lib/communaute/types";
import { choisirDansListe } from "../utilitaires/listes";

// Le formulaire d'une session : visuel de promotion et aperçu dans la communauté (spec promotion des sessions live, §1).
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/admin/sessions/nouvelle" }));
const creerSession = vi.fn();
const modifierSession = vi.fn();
vi.mock("@/lib/sessions/actions", () => ({ creerSession: (...a: unknown[]) => creerSession(...a), modifierSession: (...a: unknown[]) => modifierSession(...a) }));
const upload = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: (...a: unknown[]) => upload(...a) }) } }) }));

const { FormulaireSession } = await import("@/components/sessions/FormulaireSession");

const MOI: MoiCommunaute = { compteId: "22222222-2222-4222-8222-222222222222", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null, equipe: true };
const P = "33333333-3333-4333-8333-333333333333";
const dans30 = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date(Date.now() + 30 * 86_400_000));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

const afficher = () => render(<FormulaireSession espace="admin" parcours={[{ id: P, nomCourt: "Académique" }]} formateurs={[]} moi={MOI} />);
const apercu = () => screen.getByRole("region", { name: "Aperçu dans la communauté" });

async function remplir(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Titre"), "Excel avancé");
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: dans30 } });
  fireEvent.change(screen.getByLabelText("Heure"), { target: { value: "15:00" } });
  await user.type(screen.getByLabelText("Lien du live"), "https://zoom.us/j/123456");
}

describe("Visuel de promotion et aperçu", () => {
  beforeEach(() => {
    push.mockReset();
    creerSession.mockReset().mockResolvedValue({ ok: true, id: "s1" });
    upload.mockReset().mockResolvedValue({ error: null });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:affiche");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("l'aperçu suit le formulaire : auteur, espace, titre, description, plateforme d'après le lien", async () => {
    const user = userEvent.setup();
    afficher();
    expect(within(apercu()).getByText("Koffi Dossou")).toBeInTheDocument();
    expect(within(apercu()).getByText(/Publié dans Général/)).toBeInTheDocument();
    await remplir(user);
    await user.type(screen.getByLabelText("Description"), "Tableaux croisés dynamiques.");
    await choisirDansListe(screen.getByLabelText("Parcours"), "Académique", { user });
    expect(within(apercu()).getByRole("heading", { name: "Excel avancé" })).toBeInTheDocument();
    expect(within(apercu()).getByText("Tableaux croisés dynamiques.")).toBeInTheDocument();
    expect(within(apercu()).getByText(/Publié dans Académique/)).toBeInTheDocument();
    expect(within(apercu()).getByText("Zoom")).toBeInTheDocument();
    expect(within(apercu()).getByRole("group", { name: /^Session live du / })).toBeInTheDocument();
  });

  it("une vidéo YouTube : visible dans l'aperçu, transmise avec la session", async () => {
    const user = userEvent.setup();
    afficher();
    await remplir(user);
    await user.click(screen.getByRole("button", { name: "Ajouter une vidéo" }));
    await user.type(screen.getByLabelText("Adresse de la vidéo"), "https://youtu.be/dQw4w9WgXcQ");
    expect(within(apercu()).getByRole("button", { name: /^Lire la vidéo/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Programmer la session" }));
    await waitFor(() => expect(creerSession).toHaveBeenCalled());
    expect(creerSession.mock.calls[0][0]).toMatchObject({ video: "https://youtu.be/dQw4w9WgXcQ", image: null });
  });

  it("une affiche : déposée dans le dossier du compte, visible dans l'aperçu, transmise ; « Retirer le visuel » l'enlève", async () => {
    const user = userEvent.setup();
    afficher();
    await remplir(user);
    await user.upload(screen.getByLabelText("Choisir l’affiche"), new File([PNG], "affiche.png", { type: "image/png" }));
    expect(await within(apercu()).findByRole("img", { name: "Affiche de la session" })).toHaveAttribute("src", "blob:affiche");
    await user.click(screen.getByRole("button", { name: "Programmer la session" }));
    await waitFor(() => expect(creerSession).toHaveBeenCalled());
    const envoi = creerSession.mock.calls[0][0];
    expect(envoi.image).toMatchObject({ nom: "affiche.png", type: "image/png", taille: PNG.length });
    expect(envoi.image.chemin).toMatch(new RegExp(`^${MOI.compteId}/[0-9a-f-]{36}\\.png$`));
    expect(upload).toHaveBeenCalledWith(envoi.image.chemin, expect.anything(), expect.objectContaining({ contentType: "image/png" }));
    expect(envoi.video).toBeNull();
  });

  it("« Retirer le visuel » ; un fichier qui n'est pas une image est refusé", async () => {
    const user = userEvent.setup();
    afficher();
    await user.upload(screen.getByLabelText("Choisir l’affiche"), new File([PNG], "affiche.png", { type: "image/png" }));
    await within(apercu()).findByRole("img", { name: "Affiche de la session" });
    await user.click(screen.getByRole("button", { name: "Retirer le visuel" }));
    expect(within(apercu()).queryByRole("img", { name: "Affiche de la session" })).toBeNull();
    await user.upload(screen.getByLabelText("Choisir l’affiche"), new File([new Uint8Array([1, 2, 3, 4])], "texte.png", { type: "image/png" }));
    expect(await screen.findByText("L’affiche doit être une image (JPG, PNG ou WebP), 10 Mo au plus.")).toBeInTheDocument();
  });
});
