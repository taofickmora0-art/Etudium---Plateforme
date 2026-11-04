// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Groupe, ResumeGroupe } from "@/lib/groupes/types";

// La liste « Groupes » et les pages d'un groupe (spec des groupes, §2 ; migration 0075) : mes groupes, rangés (Général
// et parcours, puis « Mes formations »), leur dernier message et leurs non-lus ; un groupe fermé dit pourquoi ; sans la
// 0075, l'équipe lit la migration à appliquer, les étudiants et les formateurs un message neutre.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/groupes",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
const chargerMesGroupes = vi.fn();
vi.mock("@/lib/groupes/actions", () => ({ chargerMesGroupes: () => chargerMesGroupes() }));
const lireMesGroupes = vi.fn();
const lireGroupe = vi.fn();
vi.mock("@/lib/groupes/data", () => ({ lireMesGroupes: () => lireMesGroupes(), lireGroupe: (...a: unknown[]) => lireGroupe(...a) }));
let roles = ["etudiant"];
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: async () => ({ roles }) }));

const { ListeGroupes } = await import("@/components/groupes/ListeGroupes");
const { PageGroupes } = await import("@/components/groupes/PageGroupes");
const { PageGroupe } = await import("@/components/groupes/PageGroupe");
const { signalerGroupe, reinitialiserGroupesSuivis, useGroupesSuivis } = await import("@/components/temps-reel/groupes");

const ici = new Date().toISOString();
const resume = (o: Partial<ResumeGroupe>): ResumeGroupe => ({
  id: crypto.randomUUID(),
  slug: "general",
  nom: "Général",
  type: "general",
  couleur: null,
  actif: true,
  nonLus: 0,
  coupe: false,
  dernier: null,
  ...o,
});
const GROUPES = [
  resume({ dernier: { id: "m", auteur: { prenom: "Awa", nom: "Kpadé" }, deMoi: false, texte: "Bienvenue à tous", image: false, vocal: null, supprime: false, retire: false, creeLe: ici }, nonLus: 3 }),
  resume({ slug: "reussite-academique", nom: "Réussite académique", type: "parcours", couleur: "academique", coupe: true, nonLus: 2 }),
  resume({ slug: "excel", nom: "Excel avancé", type: "formation", couleur: "academique" }),
  resume({ slug: "canva", nom: "Canva", type: "formation", couleur: "digital", actif: false }),
];

function Suivis() {
  return <span data-testid="suivis">{useGroupesSuivis().length}</span>;
}

beforeEach(() => {
  chargerMesGroupes.mockReset();
  reinitialiserGroupesSuivis();
  roles = ["etudiant"];
});

describe("La liste de mes groupes", () => {
  it("le Général et les parcours, puis « Mes formations » ; dernier message, non-lus, coupé, désactivé", () => {
    render(
      <>
        <ListeGroupes espace="etudiant" initiaux={GROUPES} />
        <Suivis />
      </>,
    );
    const communs = screen.getByRole("region", { name: "Groupes" });
    const general = within(communs).getByRole("link", { name: /Général/ });
    expect(general).toHaveAttribute("href", "/groupes/general");
    expect(general).toHaveTextContent("Awa K. : Bienvenue à tous");
    expect(general).toHaveTextContent("3 messages non lus");
    expect(within(communs).getByRole("link", { name: /Réussite académique/ })).toHaveTextContent("(notifications coupées)");
    const formations = screen.getByRole("region", { name: "Mes formations" });
    expect(within(formations).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/groupes/excel", "/groupes/canva"]);
    expect(within(formations).getByRole("link", { name: /Canva/ })).toHaveTextContent("Désactivé");
    // Les groupes actifs sont suivis en temps réel.
    expect(screen.getByTestId("suivis")).toHaveTextContent("3");
  });

  it("dans l'espace formateur, les liens restent dans son espace", () => {
    render(<ListeGroupes espace="formateur" initiaux={GROUPES.slice(0, 1)} />);
    expect(screen.getByRole("link", { name: /Général/ })).toHaveAttribute("href", "/formateur/groupes/general");
  });

  it("un message dans l'un d'eux : la liste se relit", async () => {
    vi.useFakeTimers();
    chargerMesGroupes.mockResolvedValue({ ok: true, groupes: [resume({ nonLus: 7, dernier: { id: "x", auteur: { prenom: "Koffi", nom: "Dossou" }, deMoi: false, texte: "Du nouveau", image: false, vocal: null, supprime: false, retire: false, creeLe: ici } })] });
    render(<ListeGroupes espace="etudiant" initiaux={GROUPES.slice(0, 1)} />);
    act(() => signalerGroupe(GROUPES[0].id, "message"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole("link", { name: /Général/ })).toHaveTextContent("Koffi D. : Du nouveau"));
    expect(screen.getByRole("link", { name: /Général/ })).toHaveTextContent("7 messages non lus");
  });
});

describe("Les pages", () => {
  it("« Groupes » : le titre et la liste", async () => {
    lireMesGroupes.mockResolvedValue({ migrationAbsente: false, donnees: GROUPES });
    render(await PageGroupes({ espace: "etudiant" }));
    expect(screen.getByRole("heading", { level: 1, name: "Groupes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Excel avancé/ })).toBeInTheDocument();
  });

  it("sans la 0075 : la migration pour l'équipe, le message neutre pour les étudiants et les formateurs", async () => {
    lireMesGroupes.mockResolvedValue({ migrationAbsente: true });
    const { unmount } = render(await PageGroupes({ espace: "etudiant" }));
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
    expect(screen.queryByText(/migration/)).not.toBeInTheDocument();
    unmount();
    roles = ["etudiant", "formateur"];
    const formateur = render(await PageGroupes({ espace: "formateur" }));
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
    formateur.unmount();
    roles = ["etudiant", "moderateur"];
    render(await PageGroupes({ espace: "etudiant" }));
    expect(screen.getByText("Appliquez la migration 0075 (guide « Ce qui te revient », section 74).")).toBeInTheDocument();
  });

  it("la page d'un groupe, sans la 0075 : de même", async () => {
    lireGroupe.mockResolvedValue({ migrationAbsente: true });
    const { unmount } = render(await PageGroupe({ espace: "etudiant", slug: "general", message: null }));
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
    unmount();
    roles = ["etudiant", "admin"];
    render(await PageGroupe({ espace: "etudiant", slug: "general", message: null }));
    expect(screen.getByText("Appliquez la migration 0075 (guide « Ce qui te revient », section 74).")).toBeInTheDocument();
  });

  it("un groupe inconnu : page introuvable ; un groupe fermé dit pourquoi et propose les abonnements", async () => {
    lireGroupe.mockResolvedValue({ migrationAbsente: false, donnees: null });
    await expect(PageGroupe({ espace: "etudiant", slug: "inconnu", message: null })).rejects.toThrow("NEXT_NOT_FOUND");
    const ferme: Groupe = {
      id: "g",
      slug: "reussite-academique",
      nom: "Réussite académique",
      type: "parcours",
      couleur: "academique",
      actif: true,
      parcours: { nom: "Réussite académique", slug: "reussite-academique" },
      formation: null,
      ouvert: false,
      raison: "abonnement",
    };
    lireGroupe.mockResolvedValue({ migrationAbsente: false, donnees: { groupe: ferme, fil: null } });
    const { unmount } = render(await PageGroupe({ espace: "etudiant", slug: "reussite-academique", message: null }));
    expect(screen.getByText(/réservé aux abonnés et aux étudiants inscrits à une formation du parcours Réussite académique/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les abonnements" })).toHaveAttribute("href", "/abonnement/souscrire");
    unmount();
    lireGroupe.mockResolvedValue({ migrationAbsente: false, donnees: { groupe: { ...ferme, type: "formation", formation: { titre: "Excel avancé", slug: "excel" }, raison: "inscription" }, fil: null } });
    render(await PageGroupe({ espace: "etudiant", slug: "excel", message: null }));
    expect(screen.getByText(/réservé aux étudiants inscrits à la formation « Excel avancé »/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir la formation" })).toHaveAttribute("href", "/formations/excel");
  });
});
