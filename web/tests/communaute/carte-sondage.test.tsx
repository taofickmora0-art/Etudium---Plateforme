// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { MoiCommunaute, Publication, Sondage } from "@/lib/communaute/types";

// Les cartes du sondage et du quiz, et la publication programmée (spec sondages, quiz et programmation, §2 à §5).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/communaute" }));
vi.mock("@/lib/communaute/actions", () => ({
  voter: vi.fn(),
  reprogrammer: vi.fn(),
  aimer: vi.fn(),
  basculerEnregistrement: vi.fn(),
  modifierPublication: vi.fn(),
  supprimerPublication: vi.fn(),
  repondre: vi.fn(),
  supprimerReponse: vi.fn(),
  chargerReponses: vi.fn(),
  modifierReponse: vi.fn(),
  aimerReponse: vi.fn(),
  signaler: vi.fn(),
}));
const actions = await import("@/lib/communaute/actions");
const { CartePublication } = await import("@/components/communaute/CartePublication");

const MOI: MoiCommunaute = { compteId: "moi", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const MAINTENANT = new Date("2026-10-14T15:00:00Z");
const O1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const O2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const O3 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const pub = (o: Partial<Publication> = {}): Publication => ({
  id: "11111111-1111-4111-8111-111111111111",
  auteur: { prenom: "Mireille", nom: "Adjovi", role: "formateur" },
  estMoi: false,
  espace: { id: null, nom: "Général" },
  titre: "",
  texte: "Quand révisez-vous ?",
  pieceJointe: null,
  creeLe: "2026-10-14T13:00:00Z",
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
  ...o,
});
const option = (id: string, texte: string, o: Partial<Sondage["options"][number]> = {}) => ({ id, texte, image: null, votes: null, moi: false, ...o });
const sondage = (o: Partial<Sondage> = {}): Sondage => ({
  type: "texte",
  choixMultiples: false,
  finLe: "2026-10-21T13:00:00Z",
  ferme: false,
  aRepondu: false,
  votants: null,
  options: [option(O1, "Le matin"), option(O2, "Le soir")],
  ...o,
});
function afficher(p: Publication) {
  return render(
    <ToastProvider>
      <CartePublication publication={p} moi={MOI} maintenant={MAINTENANT} onSupprimee={vi.fn()} />
    </ToastProvider>,
  );
}
const resultats = () => within(screen.getByRole("list", { name: "Résultats du sondage" })).getAllByRole("listitem").map((li) => li.textContent);

describe("La carte d'un sondage avec texte", () => {
  beforeEach(() => {
    for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  });

  it("une réponse à cocher, « Voter », puis les résultats et « Changer mon vote »", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.voter).mockResolvedValueOnce({
      ok: true,
      sondage: sondage({ aRepondu: true, votants: 2, options: [option(O1, "Le matin", { votes: 1 }), option(O2, "Le soir", { votes: 1, moi: true })] }),
    });
    afficher(pub({ sondage: sondage() }));
    expect(screen.queryByRole("list", { name: "Résultats du sondage" })).toBeNull();
    const voter = screen.getByRole("button", { name: "Voter" });
    expect(voter).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Le soir" }));
    await user.click(voter);
    expect(actions.voter).toHaveBeenCalledWith(pub().id, [O2]);
    await waitFor(() => expect(resultats()).toEqual([expect.stringContaining("50 %"), expect.stringContaining("50 %")]));
    expect(resultats()[1]).toContain("votre choix");
    expect(screen.getByText(/2 votants/)).toBeInTheDocument();
    expect(screen.getByText(/Se termine le/)).toBeInTheDocument();
    // Changer mon vote : mon choix revient coché ; Annuler revient aux résultats.
    await user.click(screen.getByRole("button", { name: "Changer mon vote" }));
    expect(screen.getByRole("radio", { name: "Le soir" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByRole("list", { name: "Résultats du sondage" })).toBeInTheDocument();
  });

  it("plusieurs réponses possibles : des cases à cocher, envoyées ensemble", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.voter).mockResolvedValueOnce({ ok: true, sondage: sondage({ choixMultiples: true, aRepondu: true, votants: 1 }) });
    afficher(pub({ sondage: sondage({ choixMultiples: true, options: [option(O1, "Le matin"), option(O2, "Le soir"), option(O3, "La nuit")] }) }));
    await user.click(screen.getByRole("checkbox", { name: "Le matin" }));
    await user.click(screen.getByRole("checkbox", { name: "La nuit" }));
    await user.click(screen.getByRole("button", { name: "Voter" }));
    expect(actions.voter).toHaveBeenCalledWith(pub().id, [O1, O3]);
  });

  it("terminé : les résultats seuls et « Sondage terminé »", () => {
    afficher(pub({ sondage: sondage({ ferme: true, votants: 4, options: [option(O1, "Le matin", { votes: 3 }), option(O2, "Le soir", { votes: 1 })] }) }));
    expect(resultats()).toEqual([expect.stringContaining("75 %"), expect.stringContaining("25 %")]);
    expect(screen.getByText(/Sondage terminé/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Voter|Changer mon vote/ })).toBeNull();
  });

  it("l'auteur voit les résultats sans avoir voté, et peut voter", async () => {
    const user = userEvent.setup();
    afficher(pub({ estMoi: true, sondage: sondage({ votants: 0, options: [option(O1, "Le matin", { votes: 0 }), option(O2, "Le soir", { votes: 0 })] }) }));
    expect(resultats()).toEqual([expect.stringContaining("0 %"), expect.stringContaining("0 %")]);
    await user.click(screen.getByRole("button", { name: "Voter" }));
    expect(screen.getByRole("radio", { name: "Le matin" })).toBeInTheDocument();
  });

  it("le vote refusé s'affiche", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.voter).mockResolvedValueOnce({ ok: false, message: "Ce sondage est terminé." });
    afficher(pub({ sondage: sondage() }));
    await user.click(screen.getByRole("radio", { name: "Le matin" }));
    await user.click(screen.getByRole("button", { name: "Voter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ce sondage est terminé.");
  });
});

describe("La carte d'un sondage avec images", () => {
  beforeEach(() => {
    for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  });
  const image = (nom: string) => ({ chemin: `moi/${nom}`, nom, type: "image/png", taille: 10, url: `https://signe/${nom}` });

  it("une seule réponse : toucher une image vote ; le pourcentage s'affiche sur l'image, qui garde son lien", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.voter).mockResolvedValueOnce({
      ok: true,
      sondage: sondage({
        type: "images",
        aRepondu: true,
        votants: 4,
        options: [option(O1, "Rouge", { votes: 3, moi: true, image: { ...image("rouge.png"), url: null } }), option(O2, "", { votes: 1, image: { ...image("bleu.png"), url: null } })],
      }),
    });
    afficher(pub({ sondage: sondage({ type: "images", options: [option(O1, "Rouge", { image: image("rouge.png") }), option(O2, "", { image: image("bleu.png") })] }) }));
    await user.click(screen.getByRole("button", { name: "Voter pour Rouge" }));
    expect(actions.voter).toHaveBeenCalledWith(pub().id, [O1]);
    await waitFor(() => expect(resultats()).toEqual([expect.stringContaining("75 %"), expect.stringContaining("25 %")]));
    expect(screen.getAllByRole("img").map((i) => i.getAttribute("src"))).toEqual(["https://signe/rouge.png", "https://signe/bleu.png"]);
  });

  it("plusieurs réponses : on sélectionne les images, puis « Voter »", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.voter).mockResolvedValueOnce({ ok: true, sondage: sondage({ type: "images", choixMultiples: true, aRepondu: true, votants: 1 }) });
    afficher(pub({ sondage: sondage({ type: "images", choixMultiples: true, options: [option(O1, "Rouge", { image: image("rouge.png") }), option(O2, "", { image: image("bleu.png") })] }) }));
    await user.click(screen.getByRole("button", { name: "Voter pour Rouge" }));
    await user.click(screen.getByRole("button", { name: "Voter pour l’image 2" }));
    expect(screen.getByRole("button", { name: "Voter pour Rouge" })).toHaveAttribute("aria-pressed", "true");
    expect(actions.voter).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Voter" }));
    expect(actions.voter).toHaveBeenCalledWith(pub().id, [O1, O2]);
  });
});

describe("La carte d'un quiz", () => {
  beforeEach(() => {
    for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  });
  const quiz = (o: Partial<Sondage> = {}) => sondage({ type: "quiz", finLe: null, options: [option(O1, "Lyon"), option(O2, "Paris")], ...o });

  it("avant de répondre, rien ne dit la bonne réponse ; « Valider » est définitif ; puis la correction et l'explication", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.voter).mockResolvedValueOnce({
      ok: true,
      sondage: quiz({
        aRepondu: true,
        votants: 3,
        explication: "C’est la capitale.",
        options: [option(O1, "Lyon", { votes: 1, moi: true, correcte: false }), option(O2, "Paris", { votes: 2, correcte: true })],
      }),
    });
    afficher(pub({ sondage: quiz() }));
    expect(screen.queryByText(/Bonne réponse/)).toBeNull();
    expect(screen.getByText(/Une seule réponse, définitive/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Lyon" }));
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(actions.voter).toHaveBeenCalledWith(pub().id, [O1]);
    const lignes = await screen.findAllByRole("listitem");
    expect(lignes[0]).toHaveTextContent(/Lyon.*Votre réponse.*33 %/);
    expect(lignes[1]).toHaveTextContent(/Paris.*Bonne réponse.*67 %/);
    expect(screen.getByText("C’est la capitale.")).toBeInTheDocument();
    expect(screen.getByText(/Ce n’est pas la bonne réponse/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Valider|Changer/ })).toBeNull();
  });

  it("déjà répondu juste : « Bonne réponse ! »", () => {
    afficher(pub({ sondage: quiz({ aRepondu: true, votants: 1, options: [option(O1, "Lyon", { votes: 0, correcte: false }), option(O2, "Paris", { votes: 1, moi: true, correcte: true })] }) }));
    expect(screen.getByText(/Bonne réponse !/)).toBeInTheDocument();
    expect(screen.getByText(/1 participant\b/)).toBeInTheDocument();
  });
});

describe("Une publication programmée", () => {
  beforeEach(() => {
    for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  });
  const programmee = (o: Partial<Publication> = {}) => pub({ estMoi: true, peutSupprimer: true, programmee: true, creeLe: "2026-10-16T14:00:00Z", ...o });

  it("l'étiquette « Programmée pour le … » ; ni J’aime ni commentaires ; le vote attend la parution", () => {
    afficher(programmee({ sondage: sondage() }));
    expect(screen.getByText("Programmée pour le vendredi 16 octobre à 15 h 00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "J’aime" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Le matin" })).toBeDisabled();
    expect(screen.getByText("Le vote ouvrira à la parution de la publication.")).toBeInTheDocument();
  });

  it("menu ⋮ → « Publier maintenant » : elle paraît", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.reprogrammer).mockResolvedValueOnce({ ok: true });
    afficher(programmee());
    await user.click(screen.getByRole("button", { name: /Actions sur la publication/ }));
    await user.click(screen.getByRole("menuitem", { name: "Publier maintenant" }));
    expect(actions.reprogrammer).toHaveBeenCalledWith(pub().id, null);
    await waitFor(() => expect(screen.queryByText(/^Programmée pour le/)).toBeNull());
    expect(screen.getByRole("button", { name: "J’aime" })).toBeInTheDocument();
    expect(await screen.findByText("Publication parue")).toBeInTheDocument();
  });

  it("menu ⋮ → « Modifier la date » : la fenêtre préremplie, la nouvelle heure enregistrée", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.reprogrammer).mockResolvedValueOnce({ ok: true });
    afficher(programmee());
    await user.click(screen.getByRole("button", { name: /Actions sur la publication/ }));
    await user.click(screen.getByRole("menuitem", { name: "Modifier la date" }));
    const fenetre = screen.getByRole("dialog", { name: "Modifier la date" });
    expect(within(fenetre).getByLabelText("Date")).toHaveValue("16/10/2026");
    expect(within(fenetre).getByLabelText("Heure")).toHaveValue("15:00");
    // Une date lointaine reste dans les 3 mois qui suivent le vrai « maintenant » du test.
    const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date(Date.now() + 5 * 86_400_000));
    fireEvent.change(within(fenetre).getByLabelText("Date"), { target: { value: jour } });
    await user.click(within(fenetre).getByRole("button", { name: "Enregistrer" }));
    expect(actions.reprogrammer).toHaveBeenCalledWith(pub().id, `${jour}T15:00:00+01:00`);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Modifier la date" })).toBeNull());
    expect(screen.getByText(/^Programmée pour le /)).toBeInTheDocument();
  });

  it("le refus du serveur reste dans la fenêtre", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.reprogrammer).mockResolvedValueOnce({ ok: false, message: "Cette publication est déjà parue." });
    afficher(programmee());
    await user.click(screen.getByRole("button", { name: /Actions sur la publication/ }));
    await user.click(screen.getByRole("menuitem", { name: "Modifier la date" }));
    const fenetre = screen.getByRole("dialog", { name: "Modifier la date" });
    const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date(Date.now() + 5 * 86_400_000));
    fireEvent.change(within(fenetre).getByLabelText("Date"), { target: { value: jour } });
    await user.click(within(fenetre).getByRole("button", { name: "Enregistrer" }));
    expect(await within(fenetre).findByRole("alert")).toHaveTextContent("Cette publication est déjà parue.");
  });
});
