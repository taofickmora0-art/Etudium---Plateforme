// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormState } from "@/lib/auth/schemas";

// Migration 0070 : la fiche formateur du back-office reçoit six champs facultatifs, un par réseau.
vi.mock("@/lib/admin/actions", () => ({ saveFormateur: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { saveFormateur } = await import("@/lib/admin/actions");
const { FormateurForm } = await import("@/components/admin/FormateurForm");

const FICHE = {
  id: "fo1",
  nom: "Koffi Mensah",
  titre: "Expert Excel",
  domaine: "Bureautique",
  presentation: "Bio",
  reseaux: { instagram: "https://instagram.com/koffi", tiktok: "https://tiktok.com/@koffi" },
};
const LIBELLES = ["Instagram", "YouTube", "LinkedIn", "Facebook", "Telegram", "TikTok"];

const afficher = (formateur?: typeof FICHE) =>
  render(
    <ToastProvider>
      <FormateurForm formateur={formateur} />
    </ToastProvider>,
  );

beforeEach(() => vi.mocked(saveFormateur).mockReset());

describe("Fiche formateur : les réseaux", () => {
  it("six champs facultatifs, remplis avec les réseaux enregistrés", () => {
    afficher(FICHE);
    const champs = LIBELLES.map((libelle) => screen.getByLabelText(libelle) as HTMLInputElement);
    expect(champs.map((c) => c.value)).toEqual(["https://instagram.com/koffi", "", "", "", "", "https://tiktok.com/@koffi"]);
    expect(champs.map((c) => c.name)).toEqual(["instagram", "youtube", "linkedin", "facebook", "telegram", "tiktok"]);
    for (const champ of champs) {
      expect(champ.type).toBe("url");
      expect(champ.required).toBe(false);
    }
    expect(screen.getByRole("group", { name: "Réseaux" })).toBeTruthy();
  });

  it("une fiche nouvelle ou lue sans réseaux (avant la 0070) : champs vides", () => {
    afficher({ ...FICHE, reseaux: undefined as unknown as typeof FICHE.reseaux });
    expect(LIBELLES.map((libelle) => (screen.getByLabelText(libelle) as HTMLInputElement).value)).toEqual(["", "", "", "", "", ""]);
  });

  it("l'erreur d'une adresse s'affiche sous son champ ; la saisie reste", async () => {
    const refus: FormState = {
      status: "error",
      fieldErrors: { instagram: "L’adresse doit commencer par https://." },
      values: { nom: "Koffi Mensah", instagram: "http://instagram.com/koffi" },
    };
    vi.mocked(saveFormateur).mockResolvedValue(refus);
    afficher(FICHE);
    const instagram = screen.getByLabelText("Instagram") as HTMLInputElement;
    await userEvent.clear(instagram);
    await userEvent.type(instagram, "http://instagram.com/koffi");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(screen.getByText("L’adresse doit commencer par https://.")).toBeTruthy());
    expect(instagram.getAttribute("aria-invalid")).toBe("true");
    expect(instagram.value).toBe("http://instagram.com/koffi");
    const envoye = vi.mocked(saveFormateur).mock.calls[0][1] as FormData;
    expect(envoye.get("instagram")).toBe("http://instagram.com/koffi");
    expect(envoye.get("tiktok")).toBe("https://tiktok.com/@koffi");
  });
});
