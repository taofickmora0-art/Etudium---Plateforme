// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsTab } from "@/components/profile/NotificationsTab";
import { ToastProvider } from "@/components/ui/Toast";
import { DEMO_PROFILE } from "@/lib/demo-user";
import { updatePreferences } from "@/lib/profile/actions";

vi.mock("@/lib/profile/actions", () => ({ updatePreferences: vi.fn() }));

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

  it("les 8 catégories, les canaux et l'e-mail toujours actif", () => {
    afficher();
    expect(screen.getAllByRole("switch")).toHaveLength(10);
    expect(screen.getByRole("switch", { name: "Sessions live" })).toHaveAccessibleDescription("Programmation et rappels 1 h avant");
    expect(screen.getByText("Toujours actif")).toBeInTheDocument();
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
