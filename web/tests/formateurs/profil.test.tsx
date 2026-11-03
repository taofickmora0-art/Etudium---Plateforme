// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Role } from "@/lib/auth/permissions";
import { DEMO_USER } from "@/lib/demo-user";
import type { FormateurPublic } from "@/lib/formateurs/types";
import type { SuiviDuCompte } from "@/lib/mes-formations/data";
import { CARTES_DESIGN } from "../catalogue/cartes-design";

// Le profil public d'un formateur (/formateurs/[id] ; spec du 2 novembre 2026, §6) : l'en-tête (photo ou initiales, nom,
// « Formateur », titre, arrivée, présentation, réseaux, « Message » si le compte peut lui écrire), puis « Ses formations »
// en cartes du catalogue. Ouvert aux visiteurs ; un compte formateur le voit comme un visiteur.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/formateurs",
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
const lireFormateurPublic = vi.fn<(id: string) => Promise<FormateurPublic | null | "absente">>();
vi.mock("@/lib/formateurs/data", () => ({ lireFormateurPublic: (id: string) => lireFormateurPublic(id) }));
vi.mock("@/lib/formateurs/actions", () => ({ ecrireAuFormateur: vi.fn() }));
const compteConnecte = vi.fn();
vi.mock("@/lib/catalogue/visiteur", () => ({ compteConnecte: () => compteConnecte() }));
const lireApprenants = vi.fn<() => Promise<Record<string, number> | null>>();
vi.mock("@/lib/inscriptions/data", () => ({ lireApprenants: () => lireApprenants() }));
const lireSuiviDuCompte = vi.fn<() => Promise<SuiviDuCompte>>();
vi.mock("@/lib/mes-formations/data", () => ({ lireSuiviDuCompte: () => lireSuiviDuCompte() }));
vi.mock("@/lib/favoris/actions", () => ({ ajouterFavori: vi.fn(), retirerFavori: vi.fn() }));

const { PageProfilFormateur } = await import("@/components/formateurs/PageProfilFormateur");
const { generateMetadata } = await import("@/app/(catalogue)/formateurs/[id]/page");
const { metadonneesFormateur } = await import("@/lib/formateurs/partage");

const ID = "11111111-1111-4111-8111-111111111111";
const [EXCEL, WORD] = CARTES_DESIGN;
const KOFFI: FormateurPublic = {
  id: ID,
  nom: "Koffi Mensah",
  titre: "Expert Excel",
  domaine: "Bureautique",
  presentation: "Dix ans à former des étudiants aux tableurs et à la mise en page.",
  reseaux: { instagram: "https://instagram.com/koffi", linkedin: "https://linkedin.com/in/koffi" },
  photoUrl: null,
  rejointLe: "2026-10-30T12:00:00+01:00",
  formations: [
    { ...EXCEL, nbModules: 4 },
    { ...WORD, nbModules: 1 },
  ],
  nbFormations: 2,
  peutEcrire: true,
};
const compte = (roles: Role[]) => ({ ...DEMO_USER, roles });
const ETUDIANT = compte(["etudiant"]);

const afficher = async (id = ID) => render(<ToastProvider>{await PageProfilFormateur({ params: Promise.resolve({ id }) })}</ToastProvider>);
const grilleDesFormations = () => screen.getByRole("heading", { level: 2, name: /^Ses formations/ }).closest("section")!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T12:00:00+01:00"));
  push.mockReset();
  lireFormateurPublic.mockReset().mockResolvedValue(KOFFI);
  compteConnecte.mockReset().mockResolvedValue(ETUDIANT);
  lireApprenants.mockReset().mockResolvedValue({ [EXCEL.id]: 34 });
  lireSuiviDuCompte.mockReset().mockResolvedValue({ suivies: [], inscrites: { [EXCEL.id]: 40 }, favoris: [WORD.id] });
});
afterEach(() => vi.useRealTimers());

describe("Le profil d'un formateur : l'en-tête", () => {
  it("le fil, le nom en titre, « Formateur », le titre, l'arrivée, la présentation, les réseaux et « Message »", async () => {
    await afficher();
    const fil = screen.getByRole("navigation", { name: "Fil d’Ariane" });
    expect(within(fil).getByRole("link", { name: "Formations" })).toHaveAttribute("href", "/formations");
    expect(within(fil).getByText("Koffi Mensah")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 1, name: "Koffi Mensah" })).toBeInTheDocument();
    const entete = screen.getByRole("region", { name: "Profil de Koffi Mensah" });
    expect(within(entete).getByText("Formateur")).toBeInTheDocument();
    expect(within(entete).getByText("Expert Excel")).toBeInTheDocument();
    expect(within(entete).getByText("A rejoint : il y a 3 jours")).toBeInTheDocument();
    expect(within(entete).getByText("Dix ans à former des étudiants aux tableurs et à la mise en page.")).toBeInTheDocument();
    expect(within(entete).getByText("KM")).toBeInTheDocument();
    expect(within(entete).getByRole("link", { name: "Instagram de Koffi Mensah" })).toHaveAttribute("href", "https://instagram.com/koffi");
    expect(within(entete).getByRole("link", { name: "LinkedIn de Koffi Mensah" })).toHaveAttribute("href", "https://linkedin.com/in/koffi");
    expect(within(entete).getByRole("button", { name: "Message" })).toBeInTheDocument();
    expect(lireFormateurPublic).toHaveBeenCalledWith(ID);
  });

  it("sans titre : le domaine ; sans présentation, réseaux ni date : rien de vide", async () => {
    lireFormateurPublic.mockResolvedValue({ ...KOFFI, titre: "", presentation: "", reseaux: {}, rejointLe: "" });
    await afficher();
    const entete = screen.getByRole("region", { name: "Profil de Koffi Mensah" });
    expect(within(entete).getByText("Bureautique")).toBeInTheDocument();
    expect(within(entete).queryByText(/A rejoint/)).toBeNull();
    expect(within(entete).queryByRole("list", { name: "Réseaux de Koffi Mensah" })).toBeNull();
  });

  it("« Message » seulement si le compte peut lui écrire (inscrit à une de ses formations)", async () => {
    lireFormateurPublic.mockResolvedValue({ ...KOFFI, peutEcrire: false });
    await afficher();
    expect(screen.getByRole("heading", { level: 1, name: "Koffi Mensah" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
  });
});

describe("Le profil d'un formateur : ses formations", () => {
  it("« Ses formations (2) » : les cartes du catalogue, avec le programme, les apprenants, la progression et le cœur", async () => {
    await afficher();
    const section = grilleDesFormations();
    expect(within(section).getByRole("heading", { level: 2, name: "Ses formations (2)" })).toBeInTheDocument();
    const excel = within(section).getByRole("link", { name: /Maîtriser Microsoft Excel/ });
    expect(excel).toHaveAttribute("href", `/formations/${EXCEL.slug}`);
    expect(within(excel).getByText("4 modules • 12 leçons")).toBeInTheDocument();
    expect(within(excel).getByText("34 apprenants")).toBeInTheDocument();
    expect(within(excel).getByText("40 % terminé")).toBeInTheDocument();
    const word = within(section).getByRole("link", { name: /Microsoft Word pour vos travaux universitaires/ });
    expect(within(word).getByText("1 module • 6 leçons")).toBeInTheDocument();
    expect(within(word).getByText("Voir le cours")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Ajouter « Microsoft Word pour vos travaux universitaires » aux favoris" })).toHaveAttribute("aria-pressed", "true");
    expect(within(section).getByRole("button", { name: "Ajouter « Maîtriser Microsoft Excel » aux favoris" })).toHaveAttribute("aria-pressed", "false");
    // Les titres des cartes sont sous « Ses formations » ; les colonnes du catalogue connecté.
    expect(within(section).getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(section.querySelector(".grid")?.className).toContain("(100%-80px)/5");
    expect(lireSuiviDuCompte).toHaveBeenCalledTimes(1);
    expect(lireApprenants).toHaveBeenCalledTimes(1);
  });

  it("aucune formation publiée : une phrase simple, sans grille", async () => {
    lireFormateurPublic.mockResolvedValue({ ...KOFFI, formations: [], nbFormations: 0 });
    await afficher();
    const section = grilleDesFormations();
    expect(within(section).getByRole("heading", { level: 2, name: "Ses formations" })).toBeInTheDocument();
    expect(within(section).getByText("Koffi Mensah n’a pas encore de formation publiée.")).toBeInTheDocument();
    expect(within(section).queryByRole("link")).toBeNull();
  });

  it("une lecture des apprenants ou du suivi impossible : les cartes s'affichent sans eux", async () => {
    const trace = vi.spyOn(console, "error").mockImplementation(() => {});
    lireApprenants.mockRejectedValue(new Error("panne"));
    lireSuiviDuCompte.mockRejectedValue(new Error("panne"));
    await afficher();
    const section = grilleDesFormations();
    expect(within(section).queryByText(/apprenant/)).toBeNull();
    expect(within(section).getAllByText("Voir le cours")).toHaveLength(2);
    expect(within(section).queryByRole("button", { name: /favoris/ })).toBeNull();
    expect(trace).toHaveBeenCalled();
    trace.mockRestore();
  });
});

describe("Le profil d'un formateur : selon qui regarde", () => {
  it("le visiteur : les colonnes du catalogue public, les apprenants, « Voir le cours », sans cœur ni « Message »", async () => {
    compteConnecte.mockResolvedValue(null);
    await afficher();
    const section = grilleDesFormations();
    expect(section.querySelector(".grid")?.className).toContain("(100%-60px)/4");
    expect(within(section).getByText("34 apprenants")).toBeInTheDocument();
    expect(within(section).getAllByText("Voir le cours")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /favoris/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
    expect(lireSuiviDuCompte).not.toHaveBeenCalled();
  });

  it("un compte formateur : comme un visiteur, sans progression, cœur ni « Message »", async () => {
    compteConnecte.mockResolvedValue(compte(["formateur"]));
    await afficher();
    expect(screen.getByRole("heading", { level: 1, name: "Koffi Mensah" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
    expect(screen.queryByRole("button", { name: /favoris/ })).toBeNull();
    expect(screen.queryByText(/% terminé/)).toBeNull();
    expect(lireSuiviDuCompte).not.toHaveBeenCalled();
  });

  it("l'équipe des contenus garde ses cartes de compte connecté", async () => {
    compteConnecte.mockResolvedValue(compte(["etudiant", "admin"]));
    await afficher();
    expect(screen.getByText("40 % terminé")).toBeInTheDocument();
    expect(lireSuiviDuCompte).toHaveBeenCalledTimes(1);
  });
});

describe("Le profil d'un formateur : cas limites", () => {
  it("formateur introuvable ou identifiant invalide : 404", async () => {
    lireFormateurPublic.mockResolvedValue(null);
    await expect(PageProfilFormateur({ params: Promise.resolve({ id: "pas-un-identifiant" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(lireFormateurPublic).toHaveBeenCalledWith("pas-un-identifiant");
  });

  it("sans la migration 0070 : un bandeau neutre, sans migration ni guide", async () => {
    lireFormateurPublic.mockResolvedValue("absente");
    await afficher();
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/migration|guide/i);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("la page est dans le cadre du catalogue (visiteur ou connecté) et attend ses données dans un Suspense", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(catalogue)/formateurs/[id]/page.tsx"), "utf8");
    expect(page).toContain("<Suspense");
    expect(page).toContain("PageProfilFormateur");
  });
});

describe("Le profil d'un formateur : métadonnées", () => {
  it("« Nom · Formateur · Étudium » et la présentation en description", async () => {
    expect(await generateMetadata({ params: Promise.resolve({ id: ID }) })).toMatchObject({
      title: "Koffi Mensah · Formateur · Étudium",
      description: "Dix ans à former des étudiants aux tableurs et à la mise en page.",
      openGraph: { title: "Koffi Mensah · Formateur", description: "Dix ans à former des étudiants aux tableurs et à la mise en page.", type: "profile", locale: "fr_FR", siteName: "Étudium" },
    });
  });

  it("une longue présentation est coupée sur un mot ; sans présentation, le titre ; introuvable, absente ou en échec : un titre seul", async () => {
    const longue = "Une présentation très détaillée ".repeat(10).trim();
    const description = String(metadonneesFormateur({ ...KOFFI, presentation: longue }).description);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("…")).toBe(true);
    expect(metadonneesFormateur({ ...KOFFI, presentation: "" }).description).toBe("Expert Excel");
    expect(metadonneesFormateur({ ...KOFFI, presentation: "", titre: "", domaine: "" }).description).toBe("Formateur sur Étudium.");
    expect(metadonneesFormateur(null)).toEqual({ title: "Formateur introuvable · Étudium" });
    expect(metadonneesFormateur("absente")).toEqual({ title: "Formateur · Étudium" });
    lireFormateurPublic.mockRejectedValue(new Error("panne"));
    expect(await generateMetadata({ params: Promise.resolve({ id: ID }) })).toEqual({ title: "Formateur introuvable · Étudium" });
  });
});
