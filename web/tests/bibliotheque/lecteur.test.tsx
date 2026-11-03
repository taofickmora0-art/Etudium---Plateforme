// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentPdf, EntreeSommaire } from "@/lib/ressources/pdf";
import { ID_MEMOIRE } from "./fixtures";

// Le lecteur de la Bibliothèque (spec du 3 novembre 2026, §2 et §4 ; étape B) : plein écran, défilement continu, reprise
// à la dernière page lue, enregistrement regroupé de la page, zoom (boutons et pincement), sommaire, mode nuit. pdf.js et
// les actions serveur sont simulés, comme pour le visualiseur des ressources.

vi.mock("@/lib/bibliotheque/lecteur", () => ({ lienLectureLivre: vi.fn(), lienTelechargementLivre: vi.fn(), noterLecture: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/bibliotheque/reussir-son-memoire/lire" }));

const { LecteurLivre } = await import("@/components/bibliotheque/LecteurLivre");

const LIVRE = { id: ID_MEMOIRE, slug: "reussir-son-memoire", titre: "Réussir son mémoire", telechargeable: false };
const URL_SIGNEE = "https://x.supabase.co/storage/v1/object/sign/bibliotheque/livre.pdf?token=secret";

function fauxDocument(pages = 100, sommaire: EntreeSommaire[] = []) {
  return {
    pages,
    ratio: 1.4,
    dessiner: vi.fn<DocumentPdf["dessiner"]>(async () => undefined),
    fermer: vi.fn(),
    sommaire: vi.fn(async () => sommaire),
  } satisfies DocumentPdf;
}

const attendre = (ms = 0) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

describe("Le lecteur d'un livre", () => {
  const lien = vi.fn();
  const ouvrir = vi.fn();
  const noter = vi.fn();
  const fetchSimule = vi.fn(async () => new Response(new ArrayBuffer(8), { status: 200 }));
  const defiler = vi.spyOn(Element.prototype, "scrollIntoView");

  beforeEach(() => {
    lien.mockReset().mockResolvedValue({ url: URL_SIGNEE });
    ouvrir.mockReset();
    noter.mockReset().mockResolvedValue({ ok: true, lecture: { dernierePage: 1, nbPages: 100, pourcentage: 1, terminee: false } });
    fetchSimule.mockClear();
    defiler.mockClear();
    vi.stubGlobal("fetch", fetchSimule);
    window.localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  const monter = async (o: { document?: DocumentPdf; pageDepart?: number; livre?: Partial<typeof LIVRE>; delai?: number } = {}) => {
    ouvrir.mockResolvedValue(o.document ?? fauxDocument());
    const rendu = render(
      <LecteurLivre livre={{ ...LIVRE, ...o.livre }} pageDepart={o.pageDepart ?? 1} ouvrir={ouvrir} lien={lien} noter={noter} delai={o.delai ?? 60} />,
    );
    await attendre();
    return rendu;
  };
  /** La page dont le cadre a été amené à l'écran en dernier. */
  const derniereAmenee = () => (defiler.mock.contexts.at(-1) as HTMLElement | undefined)?.getAttribute("aria-label");

  it("lit le PDF par un lien signé, en mémoire : ni lien vers le fichier, ni bouton pour le télécharger", async () => {
    await monter();
    expect(lien).toHaveBeenCalledWith(ID_MEMOIRE);
    expect(fetchSimule).toHaveBeenCalledWith(URL_SIGNEE);
    expect(ouvrir).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    expect(screen.getByRole("heading", { level: 1, name: "Réussir son mémoire" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour à la fiche" })).toHaveAttribute("href", "/bibliotheque/reussir-son-memoire");
    expect(screen.getAllByRole("img", { name: /^Page \d+ sur 100$/ })).toHaveLength(100);
    expect(screen.queryByRole("button", { name: /Télécharger|Imprimer/ })).toBeNull();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/bibliotheque/reussir-son-memoire"]);
    // L'adresse signée n'est jamais écrite dans la page.
    expect(document.body.innerHTML).not.toContain("token=secret");
  });

  it("un livre téléchargeable propose « Télécharger »", async () => {
    await monter({ livre: { telechargeable: true } });
    expect(screen.getByRole("button", { name: "Télécharger" })).toBeInTheDocument();
  });

  it("reprend à la dernière page lue et la note tout de suite", async () => {
    await monter({ pageDepart: 42 });
    expect(screen.getByText("Page 42 sur 100")).toBeInTheDocument();
    expect(derniereAmenee()).toBe("Page 42 sur 100");
    expect(noter).toHaveBeenCalledWith(ID_MEMOIRE, 42, 100);
  });

  it("une page de départ hors du livre est ramenée dans le livre", async () => {
    await monter({ pageDepart: 500, document: fauxDocument(10) });
    expect(screen.getByText("Page 10 sur 10")).toBeInTheDocument();
    expect(noter).toHaveBeenCalledWith(ID_MEMOIRE, 10, 10);
  });

  it("l'enregistrement est regroupé : plusieurs pages tournées vite, un seul envoi, la dernière page", async () => {
    const user = userEvent.setup();
    // Un délai d'une seconde (3 dans le site) : les trois clics tombent dedans.
    await monter({ pageDepart: 42, delai: 1000 });
    expect(noter).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: "Page suivante" }));
    expect(screen.getByText("Page 45 sur 100")).toBeInTheDocument();
    expect(derniereAmenee()).toBe("Page 45 sur 100");
    expect(noter).toHaveBeenCalledTimes(1);
    await attendre(1100);
    expect(noter.mock.calls).toEqual([
      [ID_MEMOIRE, 42, 100],
      [ID_MEMOIRE, 45, 100],
    ]);
    await user.click(screen.getByRole("button", { name: "Page précédente" }));
    expect(screen.getByText("Page 44 sur 100")).toBeInTheDocument();
  });

  it("fermer le lecteur, ou cacher l'onglet, envoie la page en attente", async () => {
    const user = userEvent.setup();
    const { unmount } = await monter({ pageDepart: 5, delai: 5000 });
    await user.click(screen.getByRole("button", { name: "Page suivante" }));
    expect(noter).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    fireEvent(document, new Event("visibilitychange"));
    expect(noter).toHaveBeenLastCalledWith(ID_MEMOIRE, 6, 100);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await user.click(screen.getByRole("button", { name: "Page suivante" }));
    expect(noter).toHaveBeenCalledTimes(2);
    unmount();
    expect(noter).toHaveBeenLastCalledWith(ID_MEMOIRE, 7, 100);
    expect(noter).toHaveBeenCalledTimes(3);
  });

  it("la page affichée suit le défilement", async () => {
    await monter({ document: fauxDocument(3) });
    const zone = screen.getByRole("region", { name: "Livre" });
    const pages = screen.getAllByRole("img", { name: /^Page \d sur 3$/ });
    // La zone fait 600 px de haut ; la page 2 commence à 100 px du haut de la zone.
    vi.spyOn(zone, "getBoundingClientRect").mockReturnValue({ top: 0, height: 600 } as DOMRect);
    Object.defineProperty(zone, "clientHeight", { configurable: true, value: 600 });
    pages.forEach((p, i) => vi.spyOn(p, "getBoundingClientRect").mockReturnValue({ top: [-900, 100, 1100][i] } as DOMRect));
    fireEvent.scroll(zone);
    await attendre(20);
    expect(screen.getByText("Page 2 sur 3")).toBeInTheDocument();
  });

  it("le zoom : « Agrandir » et « Réduire », et le pincement à deux doigts", async () => {
    const document = fauxDocument(2);
    await monter({ document });
    const largeur = () => document.dessiner.mock.calls.at(-1)![2] as number;
    const avant = largeur();
    await userEvent.click(screen.getByRole("button", { name: "Agrandir" }));
    await attendre();
    expect(screen.getByText("125 %")).toBeInTheDocument();
    expect(largeur()).toBeGreaterThan(avant);
    await userEvent.click(screen.getByRole("button", { name: "Réduire" }));
    await userEvent.click(screen.getByRole("button", { name: "Réduire" }));
    expect(screen.getByText("75 %")).toBeInTheDocument();
    // Deux doigts qui s'écartent du double : 75 % → 150 %.
    const zone = screen.getByRole("region", { name: "Livre" });
    fireEvent.touchStart(zone, { touches: [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(zone, { touches: [{ clientX: 50, clientY: 100 }, { clientX: 250, clientY: 100 }] });
    fireEvent.touchEnd(zone, { touches: [] });
    await attendre();
    expect(screen.getByText("150 %")).toBeInTheDocument();
  });

  it("le sommaire du PDF mène à la page d'une partie ; sans signets, pas de bouton", async () => {
    const user = userEvent.setup();
    const { unmount } = await monter({
      document: fauxDocument(100, [
        { titre: "Introduction", page: 1, enfants: [] },
        { titre: "Chapitre 2", page: 12, enfants: [{ titre: "Section 2.1", page: 14, enfants: [] }] },
      ]),
    });
    await user.click(screen.getByRole("button", { name: "Sommaire" }));
    const fenetre = screen.getByRole("dialog", { name: "Sommaire" });
    expect(within(fenetre).getByRole("button", { name: /Section 2\.1/ })).toBeInTheDocument();
    await user.click(within(fenetre).getByRole("button", { name: /Chapitre 2/ }));
    expect(screen.queryByRole("dialog", { name: "Sommaire" })).toBeNull();
    expect(screen.getByText("Page 12 sur 100")).toBeInTheDocument();
    expect(derniereAmenee()).toBe("Page 12 sur 100");
    unmount();
    await monter();
    expect(screen.queryByRole("button", { name: "Sommaire" })).toBeNull();
  });

  it("le mode nuit s'allume, s'éteint, et reste choisi pour le livre suivant", async () => {
    const { unmount } = await monter();
    const bouton = screen.getByRole("button", { name: "Mode nuit" });
    expect(bouton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(bouton);
    expect(bouton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Livre" }).closest("[data-nuit]")).toHaveAttribute("data-nuit", "oui");
    unmount();
    await monter();
    expect(screen.getByRole("button", { name: "Mode nuit" })).toHaveAttribute("aria-pressed", "true");
  });

  it("un refus du lien, ou un PDF illisible : un message, réessayer, et le retour à la fiche", async () => {
    lien.mockResolvedValue({ erreur: "Ce livre ne vous est pas ouvert." });
    const { unmount } = await monter();
    expect(screen.getByRole("alert")).toHaveTextContent("Ce livre ne vous est pas ouvert.");
    unmount();
    lien.mockResolvedValue({ url: URL_SIGNEE });
    ouvrir.mockRejectedValueOnce(new Error("PDF abîmé"));
    render(<LecteurLivre livre={LIVRE} pageDepart={1} ouvrir={ouvrir} lien={lien} noter={noter} delai={60} />);
    ouvrir.mockResolvedValue(fauxDocument(3));
    await attendre();
    expect(screen.getByRole("alert")).toHaveTextContent("Ce livre n’a pas pu être affiché.");
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await attendre();
    expect(screen.getByText("Page 1 sur 3")).toBeInTheDocument();
  });

  it("fermer le lecteur libère le document", async () => {
    const document = fauxDocument(3);
    const { unmount } = await monter({ document });
    unmount();
    expect(document.fermer).toHaveBeenCalled();
  });
});
