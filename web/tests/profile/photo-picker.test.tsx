// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhotoPicker } from "@/components/profile/PhotoPicker";
import { ToastProvider } from "@/components/ui/Toast";
import { updatePhoto } from "@/lib/profile/actions";

vi.mock("@/lib/profile/actions", () => ({ updatePhoto: vi.fn() }));

describe("Changer la photo", () => {
  it("une photo HEIC est refusée avant tout envoi", () => {
    const { container } = render(
      <ToastProvider>
        <PhotoPicker initials="AK" photoUrl={null} name="Aïcha Kpadé" />
      </ToastProvider>,
    );
    expect(screen.getByText("JPG ou PNG, 2 Mo maximum.")).toBeInTheDocument();
    const champ = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(champ, { target: { files: [new File(["x"], "IMG_0001.HEIC", { type: "image/heic" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choisissez une image JPG ou PNG.");
    expect(updatePhoto).not.toHaveBeenCalled();
  });

  it("un texte renommé en .jpg est refusé dans le navigateur", async () => {
    vi.mocked(updatePhoto).mockReset();
    const { container } = render(
      <ToastProvider>
        <PhotoPicker initials="AK" photoUrl={null} name="Aïcha Kpadé" />
      </ToastProvider>,
    );
    const champ = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(champ, { target: { files: [new File(["bonjour, je suis un texte"], "photo.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Choisissez une image JPG ou PNG.");
    expect(updatePhoto).not.toHaveBeenCalled();
  });

  it("l'aide de la photo est annoncée avec le bouton", () => {
    render(
      <ToastProvider>
        <PhotoPicker initials="AK" photoUrl={null} name="Aïcha Kpadé" />
      </ToastProvider>,
    );
    expect(screen.getByRole("button", { name: "Changer la photo" })).toHaveAccessibleDescription("JPG ou PNG, 2 Mo maximum.");
  });

  it("une coupure réseau pendant l'envoi est annoncée", async () => {
    vi.mocked(updatePhoto).mockRejectedValue(new TypeError("Failed to fetch"));
    const { container } = render(
      <ToastProvider>
        <PhotoPicker initials="AK" photoUrl={null} name="Aïcha Kpadé" />
      </ToastProvider>,
    );
    const champ = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(champ, { target: { files: [new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("La photo n’a pas pu être enregistrée. Réessayez.");
  });
});
