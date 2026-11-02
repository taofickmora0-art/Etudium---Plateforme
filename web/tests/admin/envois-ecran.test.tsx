// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EtatEnvois } from "@/lib/admin/envois/types";

// Le bloc « Envois (e-mails et notifications push) » du back-office (mise en ligne, 0071), sur la page « Abonnements et
// paiements », sous le réglage des paiements : « Actifs », « À activer » (avec « Activer les envois ») ou « Sans clé ».

const rafraichir = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: rafraichir }) }));
vi.mock("@/lib/admin/envois/actions", () => ({ activerEnvois: vi.fn(async () => ({ ok: true })) }));
const { activerEnvois } = await import("@/lib/admin/envois/actions");
const { ReglageEnvois } = await import("@/components/admin/envois/ReglageEnvois");

const TITRE = "Envois (e-mails et notifications push)";
const afficher = (etat: EtatEnvois, ecriture = true) => render(<ReglageEnvois etat={etat} ecriture={ecriture} />);

beforeEach(() => vi.clearAllMocks());

describe("Le bloc des envois", () => {
  it("actifs : l'état et les canaux prêts, sans bouton", () => {
    afficher({ etat: "actifs", email: true, push: true });
    expect(screen.getByRole("heading", { name: TITRE })).toBeInTheDocument();
    expect(screen.getByText("Actifs")).toBeInTheDocument();
    expect(screen.getByText("E-mails : prêts")).toBeInTheDocument();
    expect(screen.getByText("Notifications push : prêtes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activer les envois" })).not.toBeInTheDocument();
  });

  it("un canal sans toutes ses clés est signalé", () => {
    afficher({ etat: "actifs", email: false, push: true });
    expect(screen.getByText("E-mails : ajoutez RESEND_API_KEY et EMAIL_EXPEDITEUR")).toBeInTheDocument();
    afficher({ etat: "actifs", email: true, push: false });
    expect(screen.getByText("Notifications push : ajoutez les trois clés VAPID")).toBeInTheDocument();
  });

  it("à activer : « Activer les envois » enregistre le jeton, puis la page se rafraîchit", async () => {
    afficher({ etat: "a_activer", email: true, push: false });
    expect(screen.getByText("À activer")).toBeInTheDocument();
    expect(screen.getByText(/Rien ne part tant que les envois ne sont pas activés/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Activer les envois" }));
    expect(activerEnvois).toHaveBeenCalledTimes(1);
    expect(rafraichir).toHaveBeenCalled();
  });

  it("à activer : un refus s'affiche (migration absente)", async () => {
    vi.mocked(activerEnvois).mockResolvedValueOnce({ ok: false, message: "Appliquez la migration 0071 (guide « Mise en ligne »)." });
    afficher({ etat: "a_activer", email: true, push: true });
    await userEvent.click(screen.getByRole("button", { name: "Activer les envois" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Appliquez la migration 0071 (guide « Mise en ligne »).");
    expect(rafraichir).not.toHaveBeenCalled();
  });

  it("sans clé : le message pour les variables du site, sans bouton", () => {
    afficher({ etat: "sans_cle", email: false, push: false });
    expect(screen.getByText("Sans clé")).toBeInTheDocument();
    expect(screen.getByText("Ajoutez RESEND_API_KEY ou les clés VAPID dans les variables du site, puis redéployez.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activer les envois" })).not.toBeInTheDocument();
    expect(screen.queryByText(/E-mails :/)).not.toBeInTheDocument();
  });

  it("sans droit d'écriture : l'état seulement", () => {
    afficher({ etat: "a_activer", email: true, push: true }, false);
    expect(screen.getByText("À activer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activer les envois" })).not.toBeInTheDocument();
  });
});
