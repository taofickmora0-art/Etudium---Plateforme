// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlocSession } from "@/components/sessions/BlocSession";
import type { SessionPublication } from "@/lib/sessions/types";

// Le bloc d'une session dans sa publication de la communauté (spec promotion des sessions live, §2).
const S: SessionPublication = {
  id: "11111111-1111-4111-8111-111111111111",
  debut: "2026-10-24T14:00:00Z",
  dureeMinutes: 60,
  plateforme: "Google Meet",
  animateur: "Dr Mireille Adjovi",
  statut: "programmee",
  inscriptions: 12,
  inscrit: false,
};

describe("Le bloc de session", () => {
  it("la date, « Session live », la plateforme bien visible, l'animateur, les inscriptions et « Voir la session »", () => {
    render(<BlocSession session={S} maintenant={new Date("2026-10-14T15:00:00Z")} />);
    const bloc = screen.getByRole("group", { name: "Session live du samedi 24 octobre à 15 h 00" });
    for (const texte of ["OCT.", "24", "Session live", "Samedi 24 octobre · 15 h 00", "Google Meet", "Dr Mireille Adjovi", "12 inscriptions"]) {
      expect(within(bloc).getByText(texte)).toBeInTheDocument();
    }
    expect(within(bloc).getByRole("link", { name: "Voir la session" })).toHaveAttribute("href", "/evenements");
  });

  it("inscrit : « Inscription confirmée » ; annulée : « Annulée » sans lien ; terminée : « Terminée »", () => {
    const { unmount } = render(<BlocSession session={{ ...S, inscrit: true }} maintenant={new Date("2026-10-14T15:00:00Z")} />);
    expect(screen.getByText("Inscription confirmée")).toBeInTheDocument();
    unmount();
    const annulee = render(<BlocSession session={{ ...S, statut: "annulee" }} maintenant={new Date("2026-10-14T15:00:00Z")} />);
    expect(screen.getByText("Annulée")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    annulee.unmount();
    render(<BlocSession session={S} maintenant={new Date("2026-10-25T15:00:00Z")} />);
    expect(screen.getByText("Terminée")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("Zoom et « En ligne » s'affichent aussi", () => {
    const { unmount } = render(<BlocSession session={{ ...S, plateforme: "Zoom" }} maintenant={new Date("2026-10-14T15:00:00Z")} />);
    expect(screen.getByText("Zoom")).toBeInTheDocument();
    unmount();
    render(<BlocSession session={{ ...S, plateforme: "En ligne" }} maintenant={new Date("2026-10-14T15:00:00Z")} />);
    expect(screen.getByText("En ligne")).toBeInTheDocument();
  });
});
