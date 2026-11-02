// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lecture } from "@/lib/utilisateurs/types";
import type { ConversationResume } from "@/lib/messages/types";

// Lot 5, étape A : les pages Messages des trois espaces et la pastille du menu.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/accueil" }));
const lireConversations = vi.fn<() => Promise<Lecture<ConversationResume[]>>>();
vi.mock("@/lib/messages/data", () => ({
  lireConversations: () => lireConversations(),
  lireFil: async () => ({ migrationAbsente: false, donnees: null }),
  lireContacts: async () => ({ migrationAbsente: false, donnees: [] }),
  MIGRATION_MESSAGES: "Appliquez la migration 0035 (guide « Ce qui te revient », section 42).",
}));
const compterMessagesNonLus = vi.fn(async () => 0);
vi.mock("@/lib/messages/actions", () => ({
  compterMessagesNonLus: (...a: unknown[]) => compterMessagesNonLus(...(a as [])),
  envoyerMessage: vi.fn(),
  ouvrirConversation: vi.fn(),
  relireFil: vi.fn(),
  relireConversations: vi.fn(),
  chercherContacts: vi.fn(),
  lienFichierMessage: vi.fn(),
}));
vi.mock("@/lib/sessions/nouvelles", () => ({ compterNouvellesSessions: async () => 0, marquerEvenementsVus: async () => undefined }));

const { PageMessages } = await import("@/components/messages/PageMessages");
const { SidebarNavLinks } = await import("@/components/layout/SidebarNav");
const { reinitialiserMessagesNonLus } = await import("@/components/messages/useMessagesNonLus");
const { PAGES_A_VENIR } = await import("@/lib/pages-a-venir");
const { MENUS } = await import("@/lib/navigation");

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

beforeEach(() => {
  lireConversations.mockReset();
  compterMessagesNonLus.mockReset().mockResolvedValue(0);
  reinitialiserMessagesNonLus();
});

describe("Les pages Messages", () => {
  it("l'étudiant : le titre, et l'invitation à écrire sans conversation", async () => {
    lireConversations.mockResolvedValue({ migrationAbsente: false, donnees: [] });
    render(await PageMessages({ espace: "etudiant", base: "/messages", c: null }));
    expect(screen.getByRole("heading", { level: 1, name: "Messages" })).toBeInTheDocument();
    expect(screen.getByText("Aucune conversation")).toBeInTheDocument();
  });

  it("avant la 0035 : le bandeau de la migration", async () => {
    lireConversations.mockResolvedValue({ migrationAbsente: true });
    render(await PageMessages({ espace: "formateur", base: "/formateur/messages", c: null }));
    expect(screen.getByText("Appliquez la migration 0035 (guide « Ce qui te revient », section 42).")).toBeInTheDocument();
  });

  it("trois adresses : l'étudiant (session vérifiée), le formateur et l'équipe (espace réservé)", () => {
    expect(lire("src/app/(app)/(etudiant)/messages/page.tsx")).toContain('<PageMessages espace="etudiant" base="/messages"');
    expect(lire("src/app/(app)/(etudiant)/messages/page.tsx")).toContain("<SessionGuard");
    expect(lire("src/app/(app)/formateur/messages/page.tsx")).toContain('requireSpace("formateur")');
    expect(lire("src/app/(app)/formateur/messages/page.tsx")).toContain('<PageMessages espace="formateur" base="/formateur/messages"');
    expect(lire("src/app/(app)/admin/messages/page.tsx")).toContain('requireDomaine("communaute")');
    expect(lire("src/app/(app)/admin/messages/page.tsx")).toContain('<PageMessages espace="equipe" base="/admin/messages"');
    expect(PAGES_A_VENIR).not.toHaveProperty("messages");
    expect(PAGES_A_VENIR).not.toHaveProperty("formateur/messages");
  });

  it("l'équipe a « Messages » dans son menu", () => {
    const entrees = MENUS.admin.groupes.flatMap((g) => g.entrees.map((e) => e.href));
    expect(entrees).toContain("/admin/messages");
  });
});

describe("La pastille de « Messages »", () => {
  it("le nombre de conversations non lues sur l'entrée du menu", async () => {
    compterMessagesNonLus.mockResolvedValue(2);
    render(<SidebarNavLinks pathname="/accueil" />);
    expect(await screen.findByRole("link", { name: "Messages, 2 conversations non lues" })).toHaveAttribute("href", "/messages");
    await waitFor(() => expect(compterMessagesNonLus).toHaveBeenCalledWith("etudiant"));
  });

  it("le temps réel (0044) : un message arrive, la pastille se relit aussitôt", async () => {
    render(<SidebarNavLinks pathname="/accueil" />);
    await waitFor(() => expect(compterMessagesNonLus).toHaveBeenCalledTimes(1));
    compterMessagesNonLus.mockResolvedValue(3);
    act(() => {
      window.dispatchEvent(new Event("etudium:temps-reel:message"));
    });
    expect(await screen.findByRole("link", { name: "Messages, 3 conversations non lues" })).toBeInTheDocument();
  });

  it("dans l'espace formateur, sur « Messages » du formateur", async () => {
    compterMessagesNonLus.mockResolvedValue(1);
    render(<SidebarNavLinks pathname="/formateur" />);
    expect(await screen.findByRole("link", { name: "Messages, 1 conversation non lue" })).toHaveAttribute("href", "/formateur/messages");
    expect(compterMessagesNonLus).toHaveBeenCalledWith("formateur");
  });
});
