// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import type { Espace, LotPublications, MoiCommunaute, Publication } from "@/lib/communaute/types";
import { GRILLE_CARTES } from "@/components/ui/grilles";

// Le nouvel Accueil (spec du nouvel Accueil, §1 à §3) : la communauté avec son en-tête, les nouvelles formations à leur
// date dans Actualités, « Formations disponibles » sous le fil.
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/accueil" }));
vi.mock("@/components/communaute/EditeurTexte", () => import("../communaute/editeur-simule"));
vi.mock("@/lib/communaute/actions", () => ({
  chargerFil: vi.fn(),
  reprogrammer: vi.fn(),
  publierPublication: vi.fn(),
  chargerReponses: vi.fn(),
  modifierPublication: vi.fn(),
  supprimerPublication: vi.fn(),
  repondre: vi.fn(),
  aimer: vi.fn(),
  basculerEnregistrement: vi.fn(),
}));
const actions = await import("@/lib/communaute/actions");
const { PageCommunaute } = await import("@/components/communaute/PageCommunaute");

const ESPACES: Espace[] = [{ id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true }];
const MOI: MoiCommunaute = { compteId: "moi", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const pub = (id: string, prenom: string, creeLe: string): Publication => ({
  id,
  auteur: { prenom, nom: "Adjovi", role: null },
  estMoi: false,
  espace: { id: null, nom: "Général" },
  titre: "",
  texte: `Texte ${id}`,
  pieceJointe: null,
  creeLe,
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
});
const formation = (id: string, publieeLe: string): CarteCatalogue => ({
  id,
  slug: id,
  titre: `Formation ${id}`,
  resume: "Un résumé.",
  niveau: "debutant",
  gratuite: false,
  badge: null,
  publieeLe,
  dureeSecondes: 3600,
  nbLecons: 4,
  parcours: [],
  note: null,
  nbAvis: 0,
  couverture: null,
});
const lot = (publications: Publication[], suite = false): LotPublications => ({ publications, suite });
const AWA = pub("p1", "Awa", "2026-10-15T09:00:00Z");
const ELI = pub("p2", "Éli", "2026-10-12T09:00:00Z");
const NOUVELLE = formation("prise-de-notes", "2026-10-14T09:00:00Z");

function afficher(o: { initial?: LotPublications; nouvelles?: CarteCatalogue[]; disponibles?: CarteCatalogue[] } = {}) {
  render(
    <ToastProvider>
      <PageCommunaute
        espaces={ESPACES}
        initial={o.initial ?? lot([AWA, ELI], true)}
        moi={MOI}
        maintenant="2026-10-15T12:00:00Z"
        titre="Bonjour, Koffi"
        nouvelles={o.nouvelles ?? [NOUVELLE]}
        disponibles={o.disponibles ?? []}
      />
    </ToastProvider>,
  );
}
const articles = () => screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"));

describe("Le nouvel Accueil", () => {
  beforeEach(() => {
    for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("l'en-tête : « Bonjour, Koffi » et les dernières nouvelles", () => {
    afficher();
    // La taille de titre du téléphone compact (26 px), comme les autres pages (revue finale).
    expect(screen.getByRole("heading", { level: 1, name: "Bonjour, Koffi" })).not.toHaveClass("max-sm:text-[28px]");
    expect(screen.getByRole("heading", { level: 1, name: "Bonjour, Koffi" })).toBeInTheDocument();
    expect(screen.getByText("Les dernières nouvelles d’Étudium : publications, nouvelles formations et sessions live.")).toBeInTheDocument();
  });

  it("une nouvelle formation entre les publications, à sa date", () => {
    afficher();
    expect(articles()).toEqual(["Publication de Awa Adjovi", "Nouvelle formation : Formation prise-de-notes", "Publication de Éli Adjovi"]);
  });

  it("aucune publication : la nouvelle formation, pas l'état vide", () => {
    afficher({ initial: lot([]) });
    expect(articles()).toEqual(["Nouvelle formation : Formation prise-de-notes"]);
    expect(screen.queryByText("Aucune publication pour l’instant")).toBeNull();
  });

  it("onglet Général, tri « Les plus populaires », onglet « Programmées » : pas de formation", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.chargerFil).mockResolvedValue({ ok: true, lot: lot([AWA, ELI]) });
    afficher();
    await user.click(screen.getByRole("button", { name: "Général" }));
    await waitFor(() => expect(articles()).toEqual(["Publication de Awa Adjovi", "Publication de Éli Adjovi"]));
    await user.click(screen.getByRole("button", { name: "Actualités" }));
    await waitFor(() => expect(articles()).toContain("Nouvelle formation : Formation prise-de-notes"));
    await user.click(screen.getByRole("button", { name: /Les plus récentes/ }));
    await user.click(screen.getByRole("menuitem", { name: "Les plus populaires" }));
    await waitFor(() => expect(articles()).toEqual(["Publication de Awa Adjovi", "Publication de Éli Adjovi"]));
    await user.click(screen.getByRole("button", { name: /Les plus populaires/ }));
    await user.click(screen.getByRole("menuitem", { name: "Les plus récentes" }));
    await waitFor(() => expect(articles()).toContain("Nouvelle formation : Formation prise-de-notes"));
    await user.click(screen.getByRole("tab", { name: "Programmées" }));
    await waitFor(() => expect(articles()).toEqual(["Publication de Awa Adjovi", "Publication de Éli Adjovi"]));
  });

  it("« Formations disponibles » : 4 cartes et « Voir toutes les formations » ; sans formation, pas de section", () => {
    const quatre = ["a", "b", "c", "d"].map((id) => formation(id, "2026-09-01T00:00:00Z"));
    afficher({ disponibles: quatre });
    const section = screen.getByRole("region", { name: "Formations disponibles" });
    expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Formation a", "Formation b", "Formation c", "Formation d"]);
    expect(within(section).getByRole("link", { name: "Voir toutes les formations" })).toHaveAttribute("href", "/formations");
    // La grille des cartes du catalogue (3 colonnes au plus), chaque carte étirée sur sa colonne : toutes ont la même
    // largeur, quelle que soit la longueur de leur texte.
    const titre = within(section).getByRole("heading", { name: "Formation a" });
    const cadre = [...section.querySelectorAll(":scope > div")].at(-1)!;
    expect(cadre.className).toContain(GRILLE_CARTES);
    for (const case_ of cadre.children) expect(case_.className).toContain("[&>*]:flex-1");
    expect(titre).toBeInTheDocument();
  });

  it("sans formation disponible : pas de section", () => {
    afficher({ disponibles: [] });
    expect(screen.queryByRole("region", { name: "Formations disponibles" })).toBeNull();
  });

  it("changer d'onglet écrit l'adresse de l'Accueil", async () => {
    const user = userEvent.setup();
    const ecrire = vi.spyOn(window.history, "replaceState");
    vi.mocked(actions.chargerFil).mockResolvedValue({ ok: true, lot: lot([AWA]) });
    afficher();
    await user.click(screen.getByRole("button", { name: "Général" }));
    expect(ecrire).toHaveBeenLastCalledWith(null, "", "/accueil?espace=general");
    await user.click(screen.getByRole("button", { name: "Actualités" }));
    expect(ecrire).toHaveBeenLastCalledWith(null, "", "/accueil");
  });
});
