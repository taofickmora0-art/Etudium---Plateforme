// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AjouterAgenda } from "@/components/sessions/AjouterAgenda";
import type { SessionCarte } from "@/lib/sessions/types";

// « Ajouter à mon agenda » est rendu d'abord par le serveur (carte d'une session), qui ne connaît pas l'adresse du site :
// le premier rendu du navigateur doit donner le même lien, puis l'adresse complète de la page Événements.
const S: SessionCarte = {
  id: "11111111-1111-4111-8111-111111111111",
  titre: "Excel avancé",
  description: "",
  debut: "2026-10-24T14:00:00Z",
  dureeMinutes: 60,
  plateforme: "Google Meet",
  lien: null,
  parcours: null,
  animateur: "Équipe Étudium",
  inscriptions: 3,
  inscrit: true,
  statut: "programmee",
};
const lieu = (a: Element | null) => new URL(a?.getAttribute("href") ?? "").searchParams.get("location");

describe("Ajouter à mon agenda, rendu serveur puis navigateur", () => {
  it("même lien au rendu serveur et à l'hydratation, puis l'adresse complète", async () => {
    const html = renderToString(<AjouterAgenda session={S} />);
    const conteneur = document.createElement("div");
    conteneur.innerHTML = html;
    document.body.append(conteneur);
    expect(lieu(conteneur.querySelector("a"))).toBe("/evenements");
    const erreurs = vi.fn();
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(conteneur, <AjouterAgenda session={S} />, { onRecoverableError: erreurs });
    });
    expect(erreurs).not.toHaveBeenCalled();
    expect(espion).not.toHaveBeenCalled();
    espion.mockRestore();
    expect(lieu(conteneur.querySelector("a"))).toBe(`${window.location.origin}/evenements`);
  });
});
