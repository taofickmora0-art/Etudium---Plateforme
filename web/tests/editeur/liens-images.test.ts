import { describe, expect, it } from "vitest";
import { liensImages } from "@/lib/editeur/envoi-image";

// Les liens des images de l'éditeur (point reporté du lot 4) : après une relecture de la page (liens expirés), les
// liens frais de la page passent devant ceux des images envoyées pendant la séance.

describe("Les liens des images de l'éditeur", () => {
  it("le lien frais de la page l'emporte ; une image tout juste envoyée garde le sien", () => {
    expect(liensImages({ "a.png": "https://frais/a" }, { "a.png": "https://vieux/a", "b.png": "https://neuf/b" })).toEqual({
      "a.png": "https://frais/a",
      "b.png": "https://neuf/b",
    });
  });
});
