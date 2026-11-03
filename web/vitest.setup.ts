import "@testing-library/jest-dom/vitest";

// Les heures s'affichent dans le fuseau de l'appareil (tâche 10 du 31 octobre 2026) : les tests tournent à l'heure du
// Bénin, quel que soit l'ordinateur (ou le serveur d'intégration, souvent en UTC).
process.env.TZ = "Africa/Porto-Novo";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom n'a pas ces API du navigateur, dont se servent les menus et les listes déroulantes Radix (position, défilement,
// capture du pointeur). PointerEvent, lui, existe dans jsdom : user-event s'en sert pour ouvrir les listes à la souris.
// Pour choisir dans une liste d'Étudium : `choisirDansListe` (tests/utilitaires/listes.ts).
if (typeof window !== "undefined") {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= function () {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= function () {};
}
