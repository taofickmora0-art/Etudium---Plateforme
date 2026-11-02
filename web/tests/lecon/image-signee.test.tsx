// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Point reporté du lot 4 : sur une page restée ouverte plus d'une heure, le lien signé d'une image a expiré. L'image
// qui ne se charge plus redemande la page (de nouveaux liens), au plus une fois par minute : pas de boucle si l'image
// manque vraiment.

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { ImageSignee } = await import("@/components/lecon/ImageSignee");

describe("Une image servie par un lien signé", () => {
  it("un lien expiré : la page est relue une fois ; une nouvelle erreur aussitôt, rien de plus", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    render(<ImageSignee src="https://exemple.supabase.co/storage/v1/object/sign/images/a.png?token=x" alt="Schéma" />);
    const image = screen.getByRole("img", { name: "Schéma" });
    expect(image).toHaveAttribute("loading", "lazy");
    fireEvent.error(image);
    expect(refresh).toHaveBeenCalledTimes(1);
    fireEvent.error(image);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 61_000);
    fireEvent.error(image);
    expect(refresh).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
