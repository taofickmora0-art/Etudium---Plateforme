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
});
