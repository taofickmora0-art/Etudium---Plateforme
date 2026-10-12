// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InformationsTab } from "@/components/profile/InformationsTab";
import { ToastProvider } from "@/components/ui/Toast";
import { DEMO_PROFILE } from "@/lib/demo-user";
import { updateProfile } from "@/lib/profile/actions";

vi.mock("@/lib/profile/actions", () => ({ updateProfile: vi.fn(), updatePhoto: vi.fn() }));

describe("Onglet Informations", () => {
  it("l'enregistrement est confirmé", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ status: "success", values: {} });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <InformationsTab profile={DEMO_PROFILE} />
      </ToastProvider>,
    );
    expect(screen.getByLabelText("Adresse e-mail")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Prénom")).toHaveValue("Aïcha");
    expect(screen.getByLabelText("Pays")).toHaveValue("benin");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Modifications enregistrées")).toBeInTheDocument();
  });

  it("une coupure réseau est annoncée sans perdre la saisie", async () => {
    vi.mocked(updateProfile).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <InformationsTab profile={DEMO_PROFILE} />
      </ToastProvider>,
    );
    await user.clear(screen.getByLabelText("Filière"));
    await user.type(screen.getByLabelText("Filière"), "Communication");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Une erreur est survenue. Vérifiez votre connexion, puis réessayez.");
    expect(screen.getByLabelText("Filière")).toHaveValue("Communication");
  });
});
