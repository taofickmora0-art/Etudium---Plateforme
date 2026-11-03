// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsTab } from "@/components/profile/NotificationsTab";
import { ToastProvider } from "@/components/ui/Toast";
import { DEMO_PROFILE } from "@/lib/demo-user";
import { updatePreferences } from "@/lib/profile/actions";

vi.mock("@/lib/profile/actions", () => ({ updatePreferences: vi.fn() }));
vi.mock("@/lib/envois/actions", () => ({ enregistrerAppareil: vi.fn(), retirerAppareil: vi.fn() }));

const afficher = () =>
  render(
    <ToastProvider>
      <NotificationsTab profile={DEMO_PROFILE} />
    </ToastProvider>,
  );

describe("Onglet Notifications", () => {
  beforeEach(() => {
    vi.mocked(updatePreferences).mockReset();
  });

  it("les 9 catégories, les canaux et l'e-mail toujours actif", () => {
    afficher();
    // 9 catégories, 2 canaux, et le son des notifications (choix du 3 novembre 2026).
    expect(screen.getAllByRole("switch")).toHaveLength(12);
    expect(screen.getByRole("switch", { name: "Son des notifications" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Messages" })).toHaveAccessibleDescription("Messages de vos formateurs et de l’équipe");
    expect(screen.getByRole("switch", { name: "Sessions live" })).toHaveAccessibleDescription("Programmation et rappels 1 h avant");
    expect(screen.getByText("Toujours actif")).toBeInTheDocument();
  });

  it("« Notifications push » est l'interrupteur de cet appareil : sans clé publique, « Bientôt disponible » et désactivé", () => {
    afficher();
    const push = screen.getByRole("switch", { name: "Notifications push" });
    expect(push).toHaveAccessibleDescription("Bientôt disponible");
    expect(push).toBeDisabled();
  });

  it("un interrupteur enregistre son nouvel état", async () => {
    vi.mocked(updatePreferences).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("switch", { name: "Recommandations" }));
    expect(updatePreferences).toHaveBeenCalledWith(expect.objectContaining({ recommandations: true, annonces: false }));
  });

  it("deux clics rapides : le dernier état est enregistré", async () => {
    let terminer: (v: { ok: boolean }) => void = () => {};
    vi.mocked(updatePreferences).mockImplementationOnce(() => new Promise((resolve) => (terminer = resolve))).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("switch", { name: "Recommandations" }));
    await user.click(screen.getByRole("switch", { name: "Annonces" }));
    expect(updatePreferences).toHaveBeenCalledTimes(1);
    await act(async () => terminer({ ok: true }));
    expect(updatePreferences).toHaveBeenCalledTimes(2);
    expect(vi.mocked(updatePreferences).mock.calls[1][0]).toMatchObject({ recommandations: true, annonces: true });
  });

  it("un échec remet l'interrupteur et le dit", async () => {
    vi.mocked(updatePreferences).mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    afficher();
    const interrupteur = screen.getByRole("switch", { name: "Recommandations" });
    await user.click(interrupteur);
    expect(await screen.findByText("La modification n’a pas été enregistrée.")).toBeInTheDocument();
    expect(interrupteur).toHaveAttribute("aria-checked", "false");
  });
});
