// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotificationsTab } from "@/components/profile/NotificationsTab";
import { ToastProvider } from "@/components/ui/Toast";
import { DEMO_PROFILE } from "@/lib/demo-user";
import { updatePreferences } from "@/lib/profile/actions";

// Relecture du lot 5 B : l'interrupteur push répond après l'autorisation du navigateur (plusieurs secondes). Une
// catégorie changée pendant ce temps ne doit pas être annulée par la réponse de l'interrupteur.

vi.mock("@/lib/profile/actions", () => ({ updatePreferences: vi.fn() }));
const premiersProps: { onChange?: (v: boolean) => void } = {};
vi.mock("@/components/profile/InterrupteurPush", () => ({
  InterrupteurPush: (props: { onChange: (v: boolean) => void }) => {
    premiersProps.onChange ??= props.onChange;
    return null;
  },
}));

describe("L'onglet Notifications et l'interrupteur push", () => {
  it("une catégorie changée pendant la demande d'autorisation reste changée quand le push s'allume", async () => {
    vi.mocked(updatePreferences).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <NotificationsTab profile={{ ...DEMO_PROFILE, preferences: { ...DEMO_PROFILE.preferences, canal_push: false, annonces: false } }} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("switch", { name: "Annonces" }));
    // La réponse de l'interrupteur, avec la fonction reçue avant le clic sur « Annonces ».
    await act(async () => premiersProps.onChange?.(true));
    expect(vi.mocked(updatePreferences).mock.lastCall?.[0]).toMatchObject({ annonces: true, canal_push: true });
    expect(screen.getByRole("switch", { name: "Annonces" })).toBeChecked();
  });
});
