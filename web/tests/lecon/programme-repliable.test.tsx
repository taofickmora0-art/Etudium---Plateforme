// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EXCEL, EXCEL_OUVERTE, id } from "./donnees";

// Le programme repliable de la leçon et le tiroir « Leçons » du téléphone (refonte des formations, étape B, spec §1.4).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));

const { ProgrammeLecon } = await import("@/components/lecon/ProgrammeLecon");
const { ProgrammeMobile } = await import("@/components/lecon/ProgrammeMobile");
const { TiroirLecons } = await import("@/components/lecon/TiroirLecons");

describe("Le programme de la leçon, sur ordinateur", () => {
  it("les modules se replient : celui de la leçon ouverte est déplié, les autres repliés", async () => {
    render(<ProgrammeLecon fiche={EXCEL} leconId={id(6)} connecte terminees={new Set([id(1)])} />);
    const enCours = screen.getByRole("button", { name: /2 · Formules et fonctions/ });
    expect(enCours).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /RECHERCHEX/ })).toHaveAttribute("aria-current", "page");
    const premier = screen.getByRole("button", { name: /1 · Bases d’Excel/ });
    expect(premier).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Découvrir l’interface")).toBeNull();
    await userEvent.click(premier);
    expect(premier).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Découvrir l’interface")).toBeInTheDocument();
    await userEvent.click(enCours);
    expect(screen.queryByText("RECHERCHEX")).toBeNull();
  });

  it("la durée de chaque leçon ; la progression du cours en bas du panneau", () => {
    render(<ProgrammeLecon fiche={EXCEL_OUVERTE} leconId={id(6)} connecte terminees={new Set([id(1)])} />);
    expect(within(screen.getByRole("link", { name: /RECHERCHEX/ })).getByText("15:00")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /SI, ET, OU/ })).getByText("13:20")).toBeInTheDocument();
    const barre = screen.getByRole("progressbar", { name: "Progression de la formation" });
    const dernierModule = screen.getByRole("button", { name: /4 · Automatisation/ });
    expect(dernierModule.compareDocumentPosition(barre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("8 % terminé")).toBeInTheDocument();
  });
});

describe("Le tiroir « Leçons », sur téléphone", () => {
  const tiroir = () =>
    render(
      <TiroirLecons>
        <ProgrammeMobile fiche={EXCEL} leconId={id(2)} connecte terminees={new Set([id(1)])} />
      </TiroirLecons>,
    );

  it("« Leçons » ouvre le tiroir ; choisir une leçon le ferme", async () => {
    tiroir();
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Leçons" }));
    const fenetre = screen.getByRole("dialog", { name: "Leçons" });
    await userEvent.click(within(fenetre).getByRole("link", { name: /Découvrir l’interface/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Échap le ferme aussi", async () => {
    tiroir();
    await userEvent.click(screen.getByRole("button", { name: "Leçons" }));
    expect(screen.getByRole("dialog", { name: "Leçons" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
