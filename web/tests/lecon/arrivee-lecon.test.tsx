// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// L'arrivée sur une leçon, sur ordinateur (revue de l'étape B) : le panneau défile seul, il reçoit donc le focus pour que
// Espace et Page suivante le fassent défiler ; le programme montre la leçon en cours.
const { ArriveeLecon } = await import("@/components/lecon/ArriveeLecon");

function page() {
  return (
    <>
      <nav className="programme-lecon">
        <a href="/a">Autre leçon</a>
        <a href="/b" aria-current="page">
          Leçon en cours
        </a>
      </nav>
      <main id="contenu" tabIndex={-1}>
        Contenu
      </main>
      <ArriveeLecon />
    </>
  );
}
const ecran = (ordinateur: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: ordinateur }) as unknown as typeof window.matchMedia;
};

describe("Arrivée sur une leçon", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("ordinateur : le focus va au panneau, sans le faire défiler ; le programme montre la leçon en cours", () => {
    ecran(true);
    const vue = vi.fn();
    Element.prototype.scrollIntoView = vue;
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(page());
    expect(document.activeElement).toHaveAttribute("id", "contenu");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(vue).toHaveBeenCalledWith({ block: "nearest" });
    expect(vue.mock.contexts[0]).toHaveAttribute("aria-current", "page");
    focus.mockRestore();
  });

  it("téléphone : la page défile normalement, rien ne bouge", () => {
    ecran(false);
    const vue = vi.fn();
    Element.prototype.scrollIntoView = vue;
    render(page());
    expect(document.activeElement).toBe(document.body);
    expect(vue).not.toHaveBeenCalled();
  });
});
