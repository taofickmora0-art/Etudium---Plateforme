// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Espace, LotPublications } from "@/lib/communaute/types";

// Restructuration R1 : le formateur garde la communauté, dans son espace (`/formateur/communaute`), sans les formations
// du fil ni « Formations disponibles » ; ses liens restent dans son espace.
let chemin = "/formateur/communaute";
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => chemin,
  unstable_rethrow: () => undefined,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/components/communaute/EditeurTexte", () => import("../communaute/editeur-simule"));
vi.mock("@/lib/communaute/actions", () => ({
  chargerFil: vi.fn(),
  chargerReponses: vi.fn(),
  chargerEspaces: vi.fn(async () => ({ ok: true, espaces: [] })),
  publierPublication: vi.fn(),
  modifierPublication: vi.fn(),
  supprimerPublication: vi.fn(),
  repondre: vi.fn(),
  supprimerReponse: vi.fn(),
  aimer: vi.fn(),
  signaler: vi.fn(),
  basculerEnregistrement: vi.fn(),
}));
vi.mock("@/lib/communaute/data", () => ({
  lireEspaces: vi.fn(),
  lireFil: vi.fn(),
  lirePublication: vi.fn(),
  lireTendances: vi.fn(),
  lireActivites: vi.fn(),
  lireAnalyseActive: vi.fn(async () => false),
}));
vi.mock("@/lib/communaute/annonce", () => ({ lireAnnonce: vi.fn(async () => null) }));
vi.mock("@/lib/sessions/data", () => ({ lireProchaineSession: vi.fn(async () => ({ migrationAbsente: false, donnees: null })) }));
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: vi.fn(async () => null), getAuthUser: vi.fn(async () => null), demoModeActive: () => false }));
const listCatalogue = vi.fn(async () => []);
vi.mock("@/lib/catalogue/data", () => ({ listCatalogue: () => listCatalogue() }));

const { lireEspaces, lireFil, lirePublication, lireTendances, lireActivites } = await import("@/lib/communaute/data");
const { ContenuCommunaute } = await import("@/components/communaute/ContenuCommunaute");
const { PagePublication } = await import("@/components/communaute/PagePublication");
const { CHEMINS_COMMUNAUTE, espaceCommunauteDe } = await import("@/lib/communaute/chemins");

const ESPACES: Espace[] = [{ id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true }];
const VIDE: LotPublications = { publications: [], suite: false };
const afficher = (ui: ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
const lire = (fichier: string) => readFileSync(join(process.cwd(), fichier), "utf8");

beforeEach(() => {
  chemin = "/formateur/communaute";
  listCatalogue.mockClear();
  vi.mocked(lireEspaces).mockResolvedValue({ migrationAbsente: false, donnees: ESPACES });
  vi.mocked(lireFil).mockResolvedValue({ migrationAbsente: false, donnees: VIDE });
  vi.mocked(lireTendances).mockResolvedValue({ migrationAbsente: false, donnees: [{ id: "t1", extrait: "Comment fixer ses prix ?", auteur: { nomCourt: "Aïcha K.", initiales: "AK", equipe: false } }] });
  vi.mocked(lireActivites).mockResolvedValue({ migrationAbsente: false, donnees: [] });
});

describe("La communauté du formateur", () => {
  it("le titre « Communauté », sans formations ni catalogue ; ses liens restent dans son espace", async () => {
    afficher(await ContenuCommunaute({ espace: "formateur" }));
    expect(screen.getByRole("heading", { level: 1, name: "Communauté" })).toBeInTheDocument();
    expect(screen.queryByText("Formations disponibles")).toBeNull();
    expect(listCatalogue).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Comment fixer ses prix/ })).toHaveAttribute("href", "/formateur/communaute/publications/t1");
    expect(screen.queryByRole("heading", { name: "Prochaine session" })).toBeNull();
  });

  it("l'étudiant garde son Accueil et ses adresses", async () => {
    chemin = "/accueil";
    afficher(await ContenuCommunaute());
    expect(listCatalogue).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Comment fixer ses prix/ })).toHaveAttribute("href", "/communaute/publications/t1");
  });

  it("la page d'une publication : le fil d'Ariane mène à sa communauté", async () => {
    vi.mocked(lirePublication).mockResolvedValue({
      migrationAbsente: false,
      donnees: {
        id: "p1",
        auteur: { prenom: "Aïcha", nom: "Kpadé", role: null },
        estMoi: false,
        espace: { id: null, nom: "Général" },
        titre: "",
        texte: "Comment fixer ses prix ?",
        pieceJointe: null,
        creeLe: "2026-10-20T09:00:00Z",
        modifiee: false,
        statut: "publiee",
        reactions: 0,
        jAime: false,
        reponses: 0,
        dernieresReponses: [],
        peutSupprimer: false,
        peutSignaler: true,
        apercu: null,
        enregistree: false,
        aimeePar: [],
        video: null,
        toutesReponses: [],
      },
    });
    afficher(await PagePublication({ id: "p1", espace: "formateur" }));
    expect(screen.getByRole("link", { name: "Communauté" })).toHaveAttribute("href", "/formateur/communaute");
  });

  it("les adresses de chaque espace", () => {
    expect(espaceCommunauteDe("/formateur/communaute")).toBe("formateur");
    expect(espaceCommunauteDe("/formateur/communaute/publications/p1")).toBe("formateur");
    expect(espaceCommunauteDe("/accueil")).toBe("etudiant");
    expect(espaceCommunauteDe(null)).toBe("etudiant");
    expect(CHEMINS_COMMUNAUTE.formateur.publication("p1")).toBe("/formateur/communaute/publications/p1");
    expect(CHEMINS_COMMUNAUTE.formateur.evenements).toBeNull();
    expect(CHEMINS_COMMUNAUTE.etudiant.accueil).toBe("/accueil");
  });

  it("les deux pages du formateur : réservées à son espace", () => {
    const page = lire("src/app/(app)/formateur/communaute/page.tsx");
    expect(page).toContain('requireSpace("formateur")');
    expect(page).toContain('espace="formateur"');
    const publication = lire("src/app/(app)/formateur/communaute/publications/[id]/page.tsx");
    expect(publication).toContain('requireSpace("formateur")');
    expect(publication).toContain('espace="formateur"');
  });
});
