// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/formations" }));

const { Logo, LogoComplet, LogoMark } = await import("@/components/brand/Logo");
const { LOGO_COMPLET, SYMBOLE } = await import("@/components/brand/traces");
const { EnTetePublic } = await import("@/components/site/EnTetePublic");
const { PiedDePagePublic } = await import("@/components/site/PiedDePagePublic");

// Logo fourni par l'utilisateur le 15 octobre 2026 (dossier « Projet Claude Code/logo ») : le « e » coiffé d'un
// chapeau de diplômé, et le logo complet « etudium ». Tracés vectorisés depuis les images d'origine.
describe("Logo Étudium", () => {
  it("le symbole est le « e » au chapeau, bleu ou blanc sur fond bleu ; plus d'hexagone", () => {
    const { container, rerender } = render(<LogoMark />);
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${SYMBOLE.largeur} ${SYMBOLE.hauteur}`);
    expect(svg.querySelector("path")?.getAttribute("d")).toBe(SYMBOLE.d);
    expect(svg.querySelector("path")?.getAttribute("fill")).toBe("#0B18C9");
    expect(svg.querySelector("polygon, text")).toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    rerender(<LogoMark inverse />);
    expect(container.querySelector("path")?.getAttribute("fill")).toBe("#FFFFFF");
  });

  it("le logo complet garde ses proportions à la hauteur demandée", () => {
    const { container } = render(<LogoComplet hauteur={30} />);
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${LOGO_COMPLET.largeur} ${LOGO_COMPLET.hauteur}`);
    expect(svg.getAttribute("height")).toBe("30");
    expect(Number(svg.getAttribute("width"))).toBeCloseTo((30 * LOGO_COMPLET.largeur) / LOGO_COMPLET.hauteur, 1);
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("seul, le logo s'annonce « Étudium »", () => {
    render(<Logo />);
    expect(screen.getByRole("img", { name: "Étudium" })).toBeInTheDocument();
  });

  it("l'en-tête et le pied de page publics montrent le logo complet", () => {
    const { container, unmount } = render(<EnTetePublic />);
    const lien = screen.getByRole("link", { name: "Étudium, accueil" });
    expect(lien.querySelector("svg")?.getAttribute("viewBox")).toBe(`0 0 ${LOGO_COMPLET.largeur} ${LOGO_COMPLET.hauteur}`);
    expect(container.querySelector("polygon")).toBeNull();
    unmount();
    render(<PiedDePagePublic />);
    const logo = screen.getByRole("img", { name: "Étudium" });
    expect(logo.querySelector("path")?.getAttribute("fill")).toBe("#FFFFFF");
  });
});
