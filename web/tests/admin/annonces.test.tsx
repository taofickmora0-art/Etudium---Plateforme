// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormulaireAnnonce } from "@/components/admin/annonces/FormulaireAnnonce";
import { PageAnnonces } from "@/components/admin/annonces/PageAnnonces";
import { publierAnnonce } from "@/lib/notifications/actions";
import { lireAnnonces } from "@/lib/notifications/data";

// La rubrique Annonces du back-office (spec des notifications, §3) : une annonce va à tous les comptes.

vi.mock("@/lib/notifications/actions", () => ({ publierAnnonce: vi.fn() }));
vi.mock("@/lib/notifications/data", () => ({ lireAnnonces: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/admin/annonces" }));

const LIEN_REFUSE = "Le lien doit être une adresse du site, commençant par « / ».";

async function remplir(titre: string, texte: string, lien = "") {
  // Sans délai entre les touches : la frappe lettre par lettre dépassait 5 s sous la charge de la suite complète.
  const user = userEvent.setup({ delay: null });
  render(<FormulaireAnnonce />);
  if (titre) await user.type(screen.getByLabelText("Titre"), titre);
  if (texte) await user.type(screen.getByLabelText("Texte"), texte);
  if (lien) await user.type(screen.getByLabelText("Lien (facultatif)"), lien);
  return user;
}

describe("Envoyer une annonce", () => {
  beforeEach(() => vi.mocked(publierAnnonce).mockReset());

  it("envoyer : confirmation, puis publierAnnonce(titre, texte, lien) ; message avec le nombre ; champs vidés", async () => {
    vi.mocked(publierAnnonce).mockResolvedValue({ ok: true, destinataires: 12 });
    const user = await remplir("Nouveautés d’octobre", "La page Notifications est en ligne.", "/notifications");
    await user.click(screen.getByRole("button", { name: "Envoyer l’annonce" }));
    const fenetre = screen.getByRole("dialog", { name: "Envoyer cette annonce à tous les comptes ?" });
    expect(within(fenetre).getByText("Elle apparaîtra dans leurs notifications et ne pourra pas être retirée.")).toBeInTheDocument();
    await user.click(within(fenetre).getByRole("button", { name: "Envoyer l’annonce" }));
    expect(publierAnnonce).toHaveBeenCalledWith("Nouveautés d’octobre", "La page Notifications est en ligne.", "/notifications");
    expect(await screen.findByText("Annonce envoyée à 12 comptes.")).toBeInTheDocument();
    expect(screen.getByLabelText("Titre")).toHaveValue("");
    expect(screen.getByLabelText("Texte")).toHaveValue("");
    expect(screen.getByLabelText("Lien (facultatif)")).toHaveValue("");
  });

  it("au singulier : « Annonce envoyée à 1 compte. »", async () => {
    vi.mocked(publierAnnonce).mockResolvedValue({ ok: true, destinataires: 1 });
    const user = await remplir("Titre", "Texte");
    await user.click(screen.getByRole("button", { name: "Envoyer l’annonce" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Envoyer l’annonce" }));
    expect(await screen.findByText("Annonce envoyée à 1 compte.")).toBeInTheDocument();
  });

  it("annuler la confirmation : rien n'est envoyé", async () => {
    const user = await remplir("Titre", "Texte");
    await user.click(screen.getByRole("button", { name: "Envoyer l’annonce" }));
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(publierAnnonce).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Titre")).toHaveValue("Titre");
  });

  it("titre vide ou lien hors du site : le message, sans fenêtre ni envoi", async () => {
    const user = await remplir("", "Texte");
    await user.click(screen.getByRole("button", { name: "Envoyer l’annonce" }));
    expect(screen.getByText("Écrivez un titre (80 caractères au plus).")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.type(screen.getByLabelText("Titre"), "Titre");
    await user.type(screen.getByLabelText("Lien (facultatif)"), "https://ailleurs.com");
    await user.click(screen.getByRole("button", { name: "Envoyer l’annonce" }));
    expect(screen.getByText(LIEN_REFUSE)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(publierAnnonce).not.toHaveBeenCalled();
  });

  it("refus de la base : le message, champs gardés", async () => {
    vi.mocked(publierAnnonce).mockResolvedValue({ ok: false, message: "Accès réservé à l’équipe." });
    const user = await remplir("Titre", "Texte", "/accueil");
    await user.click(screen.getByRole("button", { name: "Envoyer l’annonce" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Envoyer l’annonce" }));
    expect(await screen.findByText("Accès réservé à l’équipe.")).toBeInTheDocument();
    expect(screen.getByLabelText("Titre")).toHaveValue("Titre");
    expect(screen.getByLabelText("Lien (facultatif)")).toHaveValue("/accueil");
  });
});

describe("La rubrique", () => {
  it("la liste : date, titre, auteur, destinataires ; vide", async () => {
    vi.mocked(lireAnnonces).mockResolvedValue({
      migrationAbsente: false,
      donnees: [{ id: "a1", titre: "Nouveautés d’octobre", texte: "Texte", lien: null, auteur: "Aïcha Kpadé", creeLe: "2026-10-14T13:05:00Z", destinataires: 12 }],
    });
    const { unmount } = render(await PageAnnonces());
    expect(screen.getByRole("heading", { level: 1, name: "Annonces" })).toBeInTheDocument();
    expect(screen.getByText("Envoyez une notification à tous les comptes d’Étudium.")).toBeInTheDocument();
    const ligne = within(screen.getByRole("table", { name: "Annonces envoyées" })).getAllByRole("row")[1];
    expect(within(ligne).getAllByRole("cell").map((c) => c.textContent)).toEqual(["14 oct. 2026 à 14 h 05", "Nouveautés d’octobre", "Aïcha Kpadé", "12"]);
    unmount();

    vi.mocked(lireAnnonces).mockResolvedValue({ migrationAbsente: false, donnees: [] });
    render(await PageAnnonces());
    expect(screen.getByText("Aucune annonce envoyée.")).toBeInTheDocument();
  });

  it("avant la 0016 : le bandeau, sans formulaire", async () => {
    vi.mocked(lireAnnonces).mockResolvedValue({ migrationAbsente: true });
    render(await PageAnnonces());
    expect(screen.getByText("Les annonces ne sont pas encore dans la base.")).toBeInTheDocument();
    expect(screen.getByText("Appliquez la migration 0016 (guide « Ce qui te revient », section 21).")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Envoyer l’annonce" })).toBeNull();
  });
});
