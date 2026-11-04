// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VideoIntegree } from "@/components/communaute/VideoIntegree";

// La taille des vidéos dans le fil (demande du 4 novembre 2026) : l'Accueil a la largeur des autres pages, mais une
// vidéo intégrée (YouTube…) ne dépasse pas 720 px de large ; une vidéo verticale, 340 px ; un fichier, 480 px de haut.

describe("La taille d'une vidéo intégrée", () => {
  it("horizontale : 720 px de large au plus ; verticale : 340 px", () => {
    const { container, unmount } = render(<VideoIntegree video={{ plateforme: "youtube", id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ" }} />);
    expect(container.querySelector('[class~="aspect-video"]')).toHaveClass("w-full", "max-w-[720px]");
    unmount();
    const verticale = render(<VideoIntegree video={{ plateforme: "tiktok", id: "7300000000000000000", url: "https://www.tiktok.com/@etudium/video/7300000000000000000" }} />);
    expect(verticale.container.querySelector('[class~="aspect-[9/16]"]')).toHaveClass("max-w-[340px]");
  });

  it("un fichier vidéo : 480 px de haut au plus", () => {
    const { container } = render(<VideoIntegree video={{ plateforme: "fichier", id: "", url: "https://s/v.mp4" }} />);
    expect(container.querySelector("video")).toHaveClass("max-h-[480px]");
  });
});
