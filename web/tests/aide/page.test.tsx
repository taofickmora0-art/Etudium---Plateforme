// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { PAGES_A_VENIR } from "@/lib/pages-a-venir";
import { choisirDansListe, optionsDeLaListe } from "../utilitaires/listes";

// La page Aide selon le design (NdAide, lot 5 étape A) : les questions fréquentes, celles sur les formules, une
// recherche, et « Contacter l’équipe », dont la réponse arrive dans les messages (l'assistance).
vi.mock("@/components/layout/SessionGuard", () => ({ SessionGuard: () => null }));
const contacterEquipe = vi.fn();
vi.mock("@/lib/messages/actions", () => ({ contacterEquipe: (...a: unknown[]) => contacterEquipe(...a) }));

const { default: Page } = await import("@/app/(app)/(etudiant)/aide/page");

const afficher = () =>
  render(
    <ToastProvider>
      <Page />
    </ToastProvider>,
  );
const questions = (titre: string) => within(screen.getByRole("region", { name: titre })).getAllByRole("button").map((b) => b.textContent);

beforeEach(() => contacterEquipe.mockReset());

describe("Page Aide (NdAide)", () => {
  it("le titre, les 7 questions fréquentes (la première ouverte) et les 4 questions sur les abonnements", () => {
    afficher();
    expect(screen.getByRole("heading", { level: 1, name: "Aide" })).toBeInTheDocument();
    expect(screen.getByText("Trouvez une réponse dans les questions fréquentes ou écrivez à l’équipe Étudium.")).toBeInTheDocument();
    expect(questions("Questions fréquentes")).toHaveLength(7);
    // Le nouveau modèle (restructuration, §5.2) : trois abonnements qui ne diffèrent que par leur durée.
    expect(questions("Questions sur les formules")).toEqual([
      "Quelle différence entre Basique, Standard et Premium ?",
      "Puis-je prolonger mon abonnement ?",
      "Que se passe-t-il à la fin de mon abonnement ?",
      "Quels moyens de paiement ?",
    ]);
    expect(screen.getByRole("button", { name: "Le compte gratuit est-il vraiment gratuit ?" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Quels moyens de paiement ?" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
    expect(PAGES_A_VENIR).not.toHaveProperty("aide");
  });

  it("la recherche garde les questions qui correspondent (sans tenir compte des accents) ; sinon, un message", async () => {
    const user = userEvent.setup();
    afficher();
    const recherche = screen.getByRole("searchbox", { name: "Rechercher dans l’aide" });
    expect(recherche).toHaveAttribute("placeholder", "Rechercher dans l’aide…");
    await user.type(recherche, "prelevement");
    expect(questions("Questions fréquentes")).toEqual(["Le renouvellement est-il automatique ?"]);
    expect(screen.queryByRole("region", { name: "Questions sur les formules" })).toBeNull();
    await user.clear(recherche);
    await user.type(recherche, "zzz");
    expect(screen.getByText("Aucune question ne correspond.")).toBeInTheDocument();
  });

  it("« Contacter l’équipe » : le sujet et le message partent à l'assistance ; « Message envoyé »", async () => {
    const user = userEvent.setup();
    contacterEquipe.mockResolvedValue({ ok: true });
    afficher();
    const carte = screen.getByRole("region", { name: "Contacter l’équipe" });
    expect(carte).toHaveTextContent("Vous ne trouvez pas la réponse ? Écrivez-nous.");
    const sujet = within(carte).getByRole("combobox", { name: "Sujet" });
    expect(await optionsDeLaListe(sujet, { user })).toEqual(["Paiement et abonnement", "Accès à une formation", "Certificat", "Problème technique", "Autre"]);
    await choisirDansListe(sujet, "Certificat", { user });
    expect(sujet).toHaveTextContent("Certificat");
    const message = within(carte).getByRole("textbox", { name: "Message" });
    expect(message).toHaveAttribute("placeholder", "Décrivez votre question en quelques lignes");
    await user.type(message, "Mon certificat ne s’affiche pas.");
    await user.click(within(carte).getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(contacterEquipe).toHaveBeenCalledWith("Certificat", "Mon certificat ne s’affiche pas."));
    expect(await screen.findByText("Message envoyé")).toBeInTheDocument();
    expect(screen.getByText("La réponse arrivera dans vos messages.")).toBeInTheDocument();
    expect(message).toHaveValue("");
  });

  it("un message vide est signalé sans envoi ; un refus s'affiche", async () => {
    const user = userEvent.setup();
    afficher();
    const carte = screen.getByRole("region", { name: "Contacter l’équipe" });
    await user.click(within(carte).getByRole("button", { name: "Envoyer" }));
    expect(within(carte).getByText("Écrivez votre message.")).toBeInTheDocument();
    expect(contacterEquipe).not.toHaveBeenCalled();
    contacterEquipe.mockResolvedValue({ ok: false, message: "Trop de messages en peu de temps : réessayez dans quelques minutes." });
    await user.type(within(carte).getByRole("textbox", { name: "Message" }), "Bonjour");
    await user.click(within(carte).getByRole("button", { name: "Envoyer" }));
    expect(await within(carte).findByRole("alert")).toHaveTextContent("Trop de messages en peu de temps : réessayez dans quelques minutes.");
  });
});
