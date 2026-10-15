// @vitest-environment jsdom
import { render as rendre, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { DonneesLecon, LeconDetail } from "@/lib/lecon/types";
import { fauxSupabase } from "../admin/faux-supabase";
import { EXCEL, EXCEL_OUVERTE, id } from "./donnees";

// Côté étudiant (refonte des formations, étape A, spec §3.5) : le texte mis en forme, l'aperçu d'une formation non
// publiée ou d'une leçon en brouillon pour l'équipe et le formateur, l'étiquette « Brouillon » dans le programme.
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false, getShellUser: () => getShellUser() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));
const ouvrirLecon = vi.fn(async () => undefined);
vi.mock("@/lib/lecon/actions", () => ({ enregistrerNote: vi.fn(), lienRessource: vi.fn(), lienConsultation: vi.fn(), ouvrirLecon: () => ouvrirLecon(), terminerLecon: vi.fn() }));
vi.mock("@/lib/video/adaptateurs", () => ({ creerAdaptateur: () => new Promise(() => {}) }));

const { ContenuLecon } = await import("@/components/lecon/ContenuLecon");
const { ProgrammeLecon } = await import("@/components/lecon/ProgrammeLecon");
const { ficheApercu } = await import("@/lib/catalogue/apercu");
const { getFiche } = await import("@/lib/catalogue/data");

const render = (element: ReactElement) => rendre(<ToastProvider>{element}</ToastProvider>);
const LECON: LeconDetail = {
  id: id(2),
  titre: "Saisir et mettre en forme des données",
  dureeSecondes: 750,
  apercu: true,
  accessible: true,
  resume: "",
  pointsCles: [],
  video: { fournisseur: "youtube", id: "dQw4w9WgXcQ" },
  texte: "## Étapes\n\nOuvrez **Excel**, puis :\n\n- créez un classeur ;\n- saisissez les dates.",
  ressources: [],
  visionnage: { passages: [], positionSecondes: 0, terminee: false },
};
const donnees = (lecon: Partial<LeconDetail> = {}): DonneesLecon => ({ fiche: EXCEL_OUVERTE, lecon: { ...LECON, ...lecon }, note: null, notesDisponibles: true });

describe("La page leçon", () => {
  beforeEach(() => ouvrirLecon.mockClear());

  it("le texte de la leçon est mis en forme : titre, gras, liste", () => {
    render(<ContenuLecon donnees={donnees()} connecte terminees={new Set()} />);
    expect(screen.getByRole("heading", { name: "Étapes" })).toBeInTheDocument();
    expect(screen.getByText("Excel").tagName).toBe("STRONG");
    expect(screen.getByText("créez un classeur ;").closest("li")).not.toBeNull();
    expect(ouvrirLecon).toHaveBeenCalled();
  });

  it("aperçu d'une formation non publiée : le bandeau ; ni visite enregistrée, ni temps regardé mesuré", () => {
    render(<ContenuLecon donnees={donnees()} connecte terminees={new Set()} apercu="formation" />);
    const bandeau = screen.getByRole("status", { name: "Aperçu : pas encore visible des étudiants" });
    expect(within(bandeau).getByText("Cette formation n’est pas encore publiée.")).toBeInTheDocument();
    expect(ouvrirLecon).not.toHaveBeenCalled();
    expect(screen.queryByText(/Temps réellement regardé/)).toBeNull();
  });

  it("les discussions sous le contenu quand la base les donne ; sinon, pas de section (étape B)", () => {
    const moi = { compteId: "moi", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
    const { unmount } = render(<ContenuLecon donnees={{ ...donnees(), discussion: { total: 0, reponses: [] } }} connecte terminees={new Set()} moi={moi} />);
    expect(screen.getByRole("region", { name: "Discussions de la leçon" })).toBeInTheDocument();
    unmount();
    render(<ContenuLecon donnees={{ ...donnees(), discussion: null }} connecte terminees={new Set()} moi={moi} />);
    expect(screen.queryByRole("region", { name: "Discussions de la leçon" })).toBeNull();
  });

  it("aperçu d'une leçon en brouillon : le bandeau le dit", () => {
    render(<ContenuLecon donnees={donnees()} connecte terminees={new Set()} apercu="lecon" />);
    expect(within(screen.getByRole("status", { name: "Aperçu : pas encore visible des étudiants" })).getByText("Cette leçon est en brouillon.")).toBeInTheDocument();
  });

  it("le programme : une leçon en brouillon porte son étiquette (l'équipe et le formateur seuls la voient)", () => {
    const fiche = { ...EXCEL, modules: EXCEL.modules.map((m, i) => (i === 0 ? { ...m, lecons: m.lecons.map((l, j) => (j === 3 ? { ...l, publiee: false } : l)) } : m)) };
    render(<ProgrammeLecon fiche={fiche} leconId={id(1)} connecte terminees={new Set()} />);
    const ligne = screen.getByTitle("Références relatives et absolues").parentElement!;
    expect(within(ligne).getByText("Brouillon")).toBeInTheDocument();
    expect(screen.getAllByText("Brouillon")).toHaveLength(1);
  });
});

describe("Lire une formation en aperçu", () => {
  const ligne = (statut: string, lecons: Record<string, unknown>[] = [{ id: id(1), titre: "Leçon", ordre: 1, duree_secondes: 60, apercu: false, accessible: true, publiee: false }]) => ({
    id: "f-brouillon",
    slug: "brouillon",
    titre: "Brouillon",
    resume: "",
    niveau: "debutant",
    statut,
    modules: [{ id: "m1", titre: "Module", ordre: 1, lecons }],
  });
  beforeEach(() => {
    faux.vider();
    getShellUser.mockReset();
  });

  it("l'équipe ouvre une formation non publiée ; ses leçons gardent leur statut", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    faux.repondre("formations.select", { data: ligne("brouillon") });
    const fiche = await ficheApercu("brouillon");
    expect(fiche).toMatchObject({ slug: "brouillon", modules: [{ lecons: [{ id: id(1), publiee: false }] }] });
    expect(faux.de("formations", "select")[0].filtres).toEqual([["eq", "slug", "brouillon"]]);
  });

  it("le formateur de la formation aussi ; un autre compte, non (même s'il lit une formation archivée qu'il a commencée)", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
    faux.repondre("formations.select", { data: ligne("brouillon") });
    faux.repondre("rpc.formateur_de", { data: true });
    expect(await ficheApercu("brouillon")).not.toBeNull();
    faux.vider();
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    faux.repondre("formations.select", { data: ligne("archivee") });
    faux.repondre("rpc.formateur_de", { data: false });
    expect(await ficheApercu("brouillon")).toBeNull();
  });

  it("une formation publiée n'est pas un aperçu ; sans compte, rien n'est lu", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    faux.repondre("formations.select", { data: ligne("publiee") });
    expect(await ficheApercu("brouillon")).toBeNull();
    faux.vider();
    getShellUser.mockResolvedValue(null);
    expect(await ficheApercu("brouillon")).toBeNull();
    expect(faux.appels).toEqual([]);
  });

  it("la fiche lit le statut des leçons ; avant la 0027, toutes publiées", async () => {
    faux.repondre("formations.select", (appel) =>
      String(appel.valeurs).includes("accessible, publiee") ? { error: { code: "42703", message: "column lecons.publiee does not exist" } } : { data: ligne("publiee", [{ id: id(1), titre: "Leçon", ordre: 1, duree_secondes: 60, apercu: false, accessible: true }]) },
    );
    expect((await getFiche("sans-statut"))?.modules[0].lecons[0]).toMatchObject({ publiee: true });
  });
});
