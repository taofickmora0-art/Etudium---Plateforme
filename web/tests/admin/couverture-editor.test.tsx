// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

const upload = vi.fn();
const remove = vi.fn();
const espaces: string[] = [];
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: (espace: string) => {
        espaces.push(espace);
        return { upload, remove };
      },
    },
  }),
}));
const enregistrerCouverture = vi.fn();
const retirerCouverture = vi.fn();
vi.mock("@/lib/admin/actions", () => ({
  enregistrerCouverture: (...a: unknown[]) => enregistrerCouverture(...a),
  retirerCouverture: (...a: unknown[]) => retirerCouverture(...a),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { CouvertureEditor } = await import("@/components/admin/CouvertureEditor");

const F = "11111111-1111-4111-8111-111111111111";
const URL_COUVERTURE = `https://projet.supabase.co/storage/v1/object/public/couvertures/${F}/a.jpg`;
const jpeg = (taille?: number) => {
  const fichier = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])], "photo.jpg", { type: "image/jpeg" });
  if (taille) Object.defineProperty(fichier, "size", { value: taille });
  return fichier;
};
const afficher = (couverture: string | null = null) =>
  render(
    <ToastProvider>
      <CouvertureEditor formationId={F} parcours="academique" couverture={couverture} />
    </ToastProvider>,
  );
const deposer = async (container: HTMLElement, fichier: File) => {
  await userEvent.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, fichier, { applyAccept: false });
};

describe("Image de couverture au back-office", () => {
  beforeEach(() => {
    [upload, remove, enregistrerCouverture, retirerCouverture].forEach((f) => f.mockReset());
    espaces.length = 0;
    upload.mockResolvedValue({ error: null });
    enregistrerCouverture.mockResolvedValue({ ok: true });
    retirerCouverture.mockResolvedValue({ ok: true });
  });

  it("sans image : la couverture par défaut, le conseil et « Choisir une image »", () => {
    const { container } = afficher();
    const bloc = screen.getByRole("region", { name: "Image de couverture" });
    expect(container.querySelector("[data-parcours='academique']")).not.toBeNull();
    expect(within(bloc).getByText("JPG, PNG ou WebP, 5 Mo au plus. Conseil : 1280 × 720 pixels.")).toBeInTheDocument();
    expect(within(bloc).getByRole("button", { name: "Choisir une image" })).toBeInTheDocument();
    expect(within(bloc).queryByRole("button", { name: "Retirer" })).toBeNull();
  });

  it("envoi d'un JPEG : dépôt dans le dossier de la formation, puis enregistrement, puis le toast", async () => {
    const { container } = afficher();
    await deposer(container, jpeg());
    expect(await screen.findByText("Image de couverture enregistrée.")).toBeInTheDocument();
    const [chemin, contenu, options] = upload.mock.calls[0];
    expect(chemin).toMatch(new RegExp(`^${F}/[0-9a-f-]{36}\\.jpg$`));
    expect(contenu).toBeInstanceOf(Blob);
    expect(options).toEqual({ contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
    expect(espaces).toContain("couvertures");
    expect(enregistrerCouverture).toHaveBeenCalledWith(F, chemin);
  });

  it("un PDF renommé en .jpg, ou une image de 6 Mo : refusés avant l'envoi", async () => {
    const { container } = afficher();
    await deposer(container, new File(["%PDF-1.7 contenu"], "faux.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("Choisissez une image JPG, PNG ou WebP.")).toBeInTheDocument();
    await deposer(container, jpeg(6 * 1024 * 1024));
    expect(await screen.findByText("L’image dépasse 5 Mo.")).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("si l'enregistrement échoue, le fichier déposé est supprimé et l'erreur s'affiche", async () => {
    enregistrerCouverture.mockResolvedValue({ ok: false, message: "Ce fichier n’est pas dans le dossier de la formation." });
    const { container } = afficher();
    await deposer(container, jpeg());
    expect(await screen.findByText("Ce fichier n’est pas dans le dossier de la formation.")).toBeInTheDocument();
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });

  it("si le dépôt échoue : « L’image n’a pas pu être envoyée. Réessayez. »", async () => {
    upload.mockResolvedValue({ error: { message: "réseau" } });
    const { container } = afficher();
    await deposer(container, jpeg());
    expect(await screen.findByText("L’image n’a pas pu être envoyée. Réessayez.")).toBeInTheDocument();
    expect(enregistrerCouverture).not.toHaveBeenCalled();
  });

  it("avec une image : « Remplacer » et « Retirer » ; retirer demande confirmation", async () => {
    const user = userEvent.setup();
    const { container } = afficher(URL_COUVERTURE);
    expect(decodeURIComponent(container.querySelector("img")?.getAttribute("src") ?? "")).toContain(URL_COUVERTURE);
    expect(screen.getByRole("button", { name: "Remplacer" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retirer" }));
    const fenetre = screen.getByRole("dialog", { name: "Retirer l’image de couverture ?" });
    await user.click(within(fenetre).getByRole("button", { name: "Retirer" }));
    expect(retirerCouverture).toHaveBeenCalledWith(F);
    expect(await screen.findByText("Image de couverture retirée.")).toBeInTheDocument();
  });
});
