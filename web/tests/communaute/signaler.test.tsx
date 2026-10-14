// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Espace, LotPublications, Publication, Reponse } from "@/lib/communaute/types";

// La modération dans la communauté (spec de la modération, §3 et §4) : Signaler, publications en attente, mention du champ.

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/communaute/actions", () => ({
  chargerFil: vi.fn(),
  chargerReponses: vi.fn(),
  publierPublication: vi.fn(),
  modifierPublication: vi.fn(),
  supprimerPublication: vi.fn(),
  repondre: vi.fn(),
  supprimerReponse: vi.fn(),
  aimer: vi.fn(),
  signaler: vi.fn(),
}));

const actions = await import("@/lib/communaute/actions");
const { PageCommunaute } = await import("@/components/communaute/PageCommunaute");
const { messageBloquee } = await import("@/lib/moderation/regles");

const ESPACES: Espace[] = [{ id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true }];
const MOI = { compteId: "compte-1", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const pub = (o: Partial<Publication> = {}): Publication => ({
  id: "p1",
  auteur: { prenom: "Mireille", nom: "Adjovi", role: "formateur" },
  estMoi: false,
  espace: { id: null, nom: "général" },
  titre: "",
  texte: "Le texte",
  pieceJointe: null,
  creeLe: "2026-10-14T13:00:00Z",
  modifiee: false,
  statut: "publiee",
  reactions: 3,
  jAime: false,
  reponses: 0,
  dernieresReponses: [],
  peutSupprimer: false,
  peutSignaler: true,
  apercu: null,
  enregistree: false,
  aimeePar: [],
  ...o,
});
const rep = (o: Partial<Reponse> = {}): Reponse => ({
  id: "r1",
  auteur: { prenom: "Awa", nomCourt: "Awa K." },
  estMoi: false,
  texte: "Une réponse",
  creeLe: "2026-10-14T14:00:00Z",
  peutSupprimer: false,
  peutSignaler: true,
  ...o,
});
const lot = (publications: Publication[]): LotPublications => ({ publications, suite: false });
const afficher = (ui: ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
const page = (initial: LotPublications, analyseActive = false) => afficher(<PageCommunaute espaces={ESPACES} initial={initial} moi={MOI} analyseActive={analyseActive} />);
const carte = (nom = "Mireille Adjovi") => screen.getByRole("article", { name: `Publication de ${nom}` });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T15:00:00Z"));
  for (const f of Object.values(actions)) vi.mocked(f).mockReset();
});
afterEach(() => vi.useRealTimers());

describe("Signaler", () => {
  it("une publication : les motifs du design, Autre sans précisions refusé, l'envoi, le message", async () => {
    const user = userEvent.setup({ delay: null });
    page(lot([pub()]));
    await user.click(within(carte()).getByRole("button", { name: "Actions sur la publication de Mireille Adjovi" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Copier le lien", "Signaler"]);
    await user.click(screen.getByRole("menuitem", { name: "Signaler" }));
    const fenetre = screen.getByRole("dialog", { name: "Signaler cette publication" });
    expect(within(fenetre).getByText("L’équipe Étudium examinera votre signalement. L’auteur ne saura pas qui l’a envoyé.")).toBeInTheDocument();
    expect(within(fenetre).getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual(["Contenu inapproprié", "Spam ou publicité", "Harcèlement", "Autre"]);
    expect(within(fenetre).getByRole("radio", { name: "Contenu inapproprié" })).toBeChecked();
    expect(within(fenetre).getByRole("textbox", { name: "Précisions" })).toHaveAttribute("placeholder", "Expliquez en quelques mots (facultatif)");

    await user.click(within(fenetre).getByRole("radio", { name: "Autre" }));
    await user.click(within(fenetre).getByRole("button", { name: "Envoyer le signalement" }));
    expect(within(fenetre).getByRole("alert")).toHaveTextContent("Précisez le motif du signalement.");
    expect(actions.signaler).not.toHaveBeenCalled();

    vi.mocked(actions.signaler).mockResolvedValueOnce({ ok: false, message: "Vous avez déjà signalé ce contenu." });
    await user.type(within(fenetre).getByRole("textbox", { name: "Précisions" }), "Fausse annonce");
    await user.click(within(fenetre).getByRole("button", { name: "Envoyer le signalement" }));
    expect(await within(fenetre).findByText("Vous avez déjà signalé ce contenu.")).toBeInTheDocument();

    vi.mocked(actions.signaler).mockResolvedValueOnce({ ok: true });
    await user.click(within(fenetre).getByRole("button", { name: "Envoyer le signalement" }));
    expect(actions.signaler).toHaveBeenLastCalledWith({ publicationId: "p1" }, "autre", "Fausse annonce");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Signalement envoyé")).toBeInTheDocument();
    expect(screen.getByText("Merci, la publication a été signalée à la modération.")).toBeInTheDocument();
  });

  it("une réponse : le drapeau, « Signaler cette réponse », le message", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(actions.signaler).mockResolvedValueOnce({ ok: true });
    page(lot([pub({ reponses: 1, dernieresReponses: [rep()] })]));
    await user.click(within(carte()).getByRole("button", { name: "Signaler la réponse de Awa K." }));
    const fenetre = screen.getByRole("dialog", { name: "Signaler cette réponse" });
    await user.click(within(fenetre).getByRole("radio", { name: "Spam ou publicité" }));
    await user.click(within(fenetre).getByRole("button", { name: "Envoyer le signalement" }));
    expect(actions.signaler).toHaveBeenCalledWith({ reponseId: "r1" }, "spam", "");
    expect(await screen.findByText("Merci, la réponse a été signalée à la modération.")).toBeInTheDocument();
  });

  it("l'auteur et l'équipe n'ont pas Signaler", async () => {
    const user = userEvent.setup({ delay: null });
    page(lot([pub({ peutSignaler: false, reponses: 1, dernieresReponses: [rep({ peutSignaler: false })] })]));
    expect(within(carte()).queryByRole("button", { name: /Signaler la réponse/ })).toBeNull();
    await user.click(within(carte()).getByRole("button", { name: "Actions sur la publication de Mireille Adjovi" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Copier le lien"]);
  });
});

describe("Publications en attente", () => {
  it("carte en attente : l'étiquette, ni J’aime ni réponses ; bloquée (vue de l'équipe) : « Bloquée »", () => {
    page(lot([pub({ estMoi: true, auteur: { prenom: "Koffi", nom: "Dossou", role: null }, statut: "en_attente", peutSignaler: false }), pub({ id: "p2", statut: "bloquee", peutSignaler: false })]));
    const attente = carte("Koffi Dossou");
    expect(within(attente).getByText("En attente de vérification")).toBeInTheDocument();
    expect(within(attente).queryByRole("button", { name: /J’aime/ })).toBeNull();
    expect(within(attente).queryByRole("button", { name: /réponses/ })).toBeNull();
    expect(within(carte()).getByText("Bloquée")).toBeInTheDocument();
  });

  it("la mention du champ selon l'analyse", () => {
    const { unmount } = page(lot([]), true);
    expect(screen.getByText("Les publications sont vérifiées automatiquement.")).toBeInTheDocument();
    unmount();
    page(lot([]), false);
    expect(screen.getByText("Soyez bienveillant : l’équipe Étudium veille aux échanges.")).toBeInTheDocument();
  });

  it("publier en attente : « Publication envoyée » et la carte ; bloquée : le message, le texte gardé", async () => {
    const user = userEvent.setup({ delay: null });
    page(lot([]), true);
    vi.mocked(actions.publierPublication).mockResolvedValueOnce({ ok: false, message: messageBloquee("arnaque") });
    await user.type(screen.getByRole("textbox", { name: "Nouvelle publication" }), "Envoyez 5 000 F");
    await user.click(screen.getByRole("button", { name: "Publier" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("elle semble enfreindre les règles de la communauté (Arnaque)");
    expect(screen.getByRole("textbox", { name: "Nouvelle publication" })).toHaveValue("Envoyez 5 000 F");

    vi.mocked(actions.publierPublication).mockResolvedValueOnce({ ok: true, id: "n1", statut: "en_attente" });
    await user.clear(screen.getByRole("textbox", { name: "Nouvelle publication" }));
    await user.type(screen.getByRole("textbox", { name: "Nouvelle publication" }), "Bonjour à tous");
    await user.click(screen.getByRole("button", { name: "Publier" }));
    const nouvelle = await screen.findByRole("article", { name: "Publication de Koffi Dossou" });
    expect(within(nouvelle).getByText("En attente de vérification")).toBeInTheDocument();
    expect(screen.getByText("Publication envoyée")).toBeInTheDocument();
    expect(screen.getByText("Elle paraîtra après vérification par l’équipe Étudium.")).toBeInTheDocument();
  });
});
