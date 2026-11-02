// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementFile } from "@/lib/moderation/types";

// Relecture du lot 6 A (important) : un modérateur ne voit pas d'entrée vers les contenus ni vers les comptes, qui le
// ramèneraient à la vue d'ensemble sans explication.

const { getShellUser, chemin } = vi.hoisted(() => ({ getShellUser: vi.fn(), chemin: { valeur: "/admin" } }));
vi.mock("@/lib/auth/current-user", () => ({ getShellUser, demoModeActive: () => false }));
vi.mock("next/navigation", () => ({ usePathname: () => chemin.valeur, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: async () => ({ data: false, error: null }) }) }));

const { fixerDomaines } = await import("@/lib/auth/domaines-du-compte");
const { BoutonAjouterFormation } = await import("@/components/layout/BoutonAjouterFormation");
const { ElementModeration } = await import("@/components/admin/moderation/ElementModeration");
const { editeurFormation } = await import("@/lib/catalogue/apercu");

const ADMIN = ["communaute", "contenus", "utilisateurs", "paiements", "statistiques"] as const;
const ELEMENT: ElementFile = {
  type: "publication",
  id: "p1",
  publicationId: "p1",
  espace: { id: null, nom: "Général" },
  auteur: { id: "a1", prenom: "Jules", nom: "K." },
  creeLe: "2026-11-01T10:00:00Z",
  titre: "",
  texte: "Gagnez de l'argent facilement",
  pieceJointe: null,
  video: null,
  statut: "en_attente",
  analyse: null,
  extrait: null,
  signalements: { nombre: 0, motifs: [], details: [] },
} as unknown as ElementFile;

beforeEach(() => {
  chemin.valeur = "/admin";
});
afterEach(() => act(() => fixerDomaines(null)));

describe("Les entrées hors de la communauté, cachées au modérateur", () => {
  it("« Ajouter une formation » au back-office : seulement avec les contenus", () => {
    act(() => fixerDomaines(["communaute"]));
    const { unmount } = render(<BoutonAjouterFormation />);
    expect(screen.queryByRole("link", { name: "Ajouter une formation" })).toBeNull();
    unmount();
    act(() => fixerDomaines([...ADMIN]));
    render(<BoutonAjouterFormation />);
    expect(screen.getByRole("link", { name: "Ajouter une formation" })).toHaveAttribute("href", "/admin/formations/nouvelle");
  });

  it("dans la file de modération, le nom de l'auteur ne mène à sa fiche qu'avec les comptes", () => {
    act(() => fixerDomaines(["communaute"]));
    const { unmount } = render(<ElementModeration element={ELEMENT} onglet="a_examiner" maintenant={new Date("2026-11-02T10:00:00Z")} onAgir={async () => null} />);
    expect(screen.getByText("Jules K.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Jules K." })).toBeNull();
    unmount();
    act(() => fixerDomaines([...ADMIN]));
    render(<ElementModeration element={ELEMENT} onglet="a_examiner" maintenant={new Date("2026-11-02T10:00:00Z")} onAgir={async () => null} />);
    expect(screen.getByRole("link", { name: "Jules K." })).toHaveAttribute("href", "/admin/utilisateurs/a1");
  });

  it("« Modifier les leçons » d'une formation : pas pour le modérateur", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "moderateur"] });
    expect(await editeurFormation("f1")).toBeNull();
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    expect(await editeurFormation("f1")).toBe("/admin/formations/f1");
  });
});
