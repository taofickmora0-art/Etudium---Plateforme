// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InformationsTab } from "@/components/profile/InformationsTab";
import { ToastProvider } from "@/components/ui/Toast";
import { DEMO_PROFILE } from "@/lib/demo-user";
import { updateProfile } from "@/lib/profile/actions";
import { choisirDansListe } from "../utilitaires/listes";

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
    expect(screen.getByLabelText("Pays")).toHaveTextContent("Bénin");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Modifications enregistrées")).toBeInTheDocument();
    // La liste dessinée envoie sa valeur avec le formulaire, et la garde après la remise à zéro de React.
    expect(vi.mocked(updateProfile).mock.calls[0][1].get("pays")).toBe("benin");
    expect(screen.getByLabelText("Pays")).toHaveTextContent("Bénin");
  });

  it("un pays choisi reste affiché après l'enregistrement, et repart avec le suivant", async () => {
    // Comme la vraie action : la saisie revient dans l'état, puis React remet le formulaire à zéro.
    vi.mocked(updateProfile).mockImplementation(async (_prev, fd) => ({ status: "success", values: Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])) }));
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <InformationsTab profile={DEMO_PROFILE} />
      </ToastProvider>,
    );
    await choisirDansListe("Pays", "Togo", { user });
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Modifications enregistrées")).toBeInTheDocument();
    expect(vi.mocked(updateProfile).mock.lastCall?.[1].get("pays")).toBe("togo");
    await waitFor(() => expect(screen.getByRole("button", { name: "Enregistrer" })).not.toHaveAttribute("aria-busy"));
    expect(screen.getByRole("combobox", { name: "Pays" })).toHaveTextContent("Togo");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(2));
    expect(vi.mocked(updateProfile).mock.lastCall?.[1].get("pays")).toBe("togo");
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
