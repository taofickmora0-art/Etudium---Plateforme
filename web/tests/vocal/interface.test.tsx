// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationResume, Fil, Message } from "@/lib/messages/types";

// Les notes vocales à l'écran (spec du 4 novembre 2026) et les deux volets des Messages : le micro remplace « Envoyer »
// quand le champ est vide (si le navigateur sait enregistrer) ; l'enregistrement, l'aperçu, l'envoi (dépôt puis
// message) ; le micro refusé ; la bulle d'écoute (lecture, vitesse) ; la recherche dans la liste et le volet vide.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/messages" }));
vi.mock("@/lib/messages/actions", () => ({
  envoyerMessage: vi.fn(),
  ouvrirConversation: vi.fn(),
  relireFil: vi.fn(async () => null),
  relireConversations: vi.fn(async () => null),
  chercherContacts: vi.fn(),
  lienFichierMessage: vi.fn(),
  lienNoteVocale: vi.fn(),
  compterMessagesNonLus: vi.fn(async () => 0),
}));
const deposerNoteVocale = vi.fn();
const retirerDepot = vi.fn();
vi.mock("@/lib/vocal/depot", () => ({ deposerNoteVocale: (...a: unknown[]) => deposerNoteVocale(...a) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "moi" } } }) }, storage: { from: () => ({}) } }) }));

const actions = await import("@/lib/messages/actions");
const { Messagerie } = await import("@/components/messages/Messagerie");
const { LecteurVocal } = await import("@/components/vocal/LecteurVocal");

const C = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const CONV: ConversationResume = {
  id: C,
  avec: { nom: "Dr Mireille Adjovi", photoUrl: null, role: "Formateur·rice", equipe: false },
  formation: null,
  dernier: { texte: "", fichier: "Note vocale", vocal: 12_400, deMoi: false, creeLe: new Date().toISOString() },
  nonLu: false,
};
const EQUIPE: ConversationResume = { ...CONV, id: C2, avec: { nom: "Équipe Étudium", photoUrl: null, role: "Assistance", equipe: true }, dernier: null };
const message = (o: Partial<Message>): Message => ({ id: crypto.randomUUID(), texte: "", fichier: null, vocal: null, deMoi: false, auteur: null, creeLe: new Date().toISOString(), ...o });
const FIL: Fil = { conversation: CONV, plusAnciens: false, messages: [message({ texte: "Bonjour" })] };

// ─── Un faux micro ───────────────────────────────────────────────────────────────────────────────────
let maintenant = 0;
class FauxEnregistreur {
  static isTypeSupported = (t: string) => t === "audio/webm;codecs=opus";
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_flux: unknown, options: { mimeType: string }) {
    this.mimeType = options.mimeType;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["son"], { type: this.mimeType }) });
    this.onstop?.();
  }
}
const piste = { stop: vi.fn() };
const getUserMedia = vi.fn();

function afficher(o: { fil?: Fil | null; choisie?: string | null } = {}) {
  return render(<Messagerie espace="etudiant" base="/messages" conversations={[CONV, EQUIPE]} fil={o.fil === undefined ? FIL : o.fil} choisie={o.choisie === undefined ? C : o.choisie} contacts={[]} />);
}

beforeEach(() => {
  maintenant = 0;
  vi.spyOn(performance, "now").mockImplementation(() => maintenant);
  vi.stubGlobal("MediaRecorder", FauxEnregistreur);
  getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [piste] });
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  URL.createObjectURL = vi.fn(() => "blob:note");
  URL.revokeObjectURL = vi.fn();
  deposerNoteVocale.mockReset().mockResolvedValue({ ok: true, chemin: `moi/${C}/note.webm`, retirer: retirerDepot });
  retirerDepot.mockReset();
  vi.mocked(actions.envoyerMessage).mockReset();
  vi.mocked(actions.lienNoteVocale).mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Les deux volets des Messages", () => {
  it("la liste à gauche (recherche, aperçu de la note), la conversation à droite ; sans conversation, le volet vide", async () => {
    const user = userEvent.setup();
    const { unmount } = afficher();
    const liste = screen.getByRole("navigation", { name: "Conversations" });
    expect(within(liste).getByRole("link", { name: /Dr Mireille Adjovi/ })).toHaveTextContent("🎤 Note vocale (0:12)");
    expect(screen.getByRole("region", { name: "Conversation avec Dr Mireille Adjovi" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Rechercher une conversation" }), "equipe");
    expect(within(liste).queryByRole("link", { name: /Dr Mireille Adjovi/ })).toBeNull();
    expect(within(liste).getByRole("link", { name: /Équipe Étudium/ })).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Rechercher une conversation" }));
    await user.type(screen.getByRole("searchbox", { name: "Rechercher une conversation" }), "zzz");
    expect(screen.getByText("Aucune conversation ne correspond à « zzz ».")).toBeInTheDocument();
    unmount();
    afficher({ fil: null, choisie: null });
    expect(screen.getByText("Choisissez une conversation")).toBeInTheDocument();
  });
});

describe("Enregistrer et envoyer une note vocale", () => {
  it("le micro remplace « Envoyer » quand le champ est vide ; écrire le fait revenir", async () => {
    const user = userEvent.setup();
    afficher();
    expect(screen.getByRole("button", { name: "Enregistrer une note vocale" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Envoyer" })).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Message à Dr Mireille Adjovi" }), "Salut");
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer une note vocale" })).toBeNull();
  });

  it("enregistrer, puis Envoyer : la note est déposée puis part avec sa durée ; elle paraît dans le fil", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.envoyerMessage).mockResolvedValue({
      ok: true,
      message: message({ deMoi: true, fichier: { nom: "Note vocale", format: "audio/webm", taille: 3 }, vocal: { dureeMs: 4_000, ondes: [], chemin: "moi/n.webm", url: "https://s/n" } }),
    });
    afficher();
    await user.click(screen.getByRole("button", { name: "Enregistrer une note vocale" }));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true, noiseSuppression: true } });
    expect(await screen.findByRole("button", { name: "Supprimer la note vocale" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Message à Dr Mireille Adjovi" })).toBeNull();
    maintenant = 4_000;
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(actions.envoyerMessage).toHaveBeenCalled());
    expect(deposerNoteVocale).toHaveBeenCalledWith("messages", C, expect.objectContaining({ type: "audio/webm", dureeMs: 4_000 }));
    expect(actions.envoyerMessage).toHaveBeenCalledWith(C, "", { chemin: `moi/${C}/note.webm`, nom: "Note vocale" }, { dureeMs: 4_000, ondes: expect.any(Array) });
    expect(await screen.findByRole("button", { name: "Écouter la note vocale (0:04)" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message à Dr Mireille Adjovi" })).toBeInTheDocument();
    expect(piste.stop).toHaveBeenCalled();
  });

  it("Arrêter pour réécouter, puis Supprimer : rien ne part ; un refus de la base retire le fichier déposé", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("button", { name: "Enregistrer une note vocale" }));
    maintenant = 2_500;
    await user.click(await screen.findByRole("button", { name: "Arrêter pour réécouter" }));
    expect(await screen.findByRole("button", { name: "Écouter la note vocale (0:03)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Supprimer la note vocale" }));
    expect(screen.getByRole("textbox", { name: "Message à Dr Mireille Adjovi" })).toBeInTheDocument();
    expect(deposerNoteVocale).not.toHaveBeenCalled();

    vi.mocked(actions.envoyerMessage).mockResolvedValue({ ok: false, message: "Trop de messages en peu de temps : réessayez dans quelques minutes." });
    maintenant = 10_000;
    await user.click(screen.getByRole("button", { name: "Enregistrer une note vocale" }));
    maintenant = 13_000;
    await user.click(await screen.findByRole("button", { name: "Envoyer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trop de messages en peu de temps");
    expect(retirerDepot).toHaveBeenCalled();
  });

  it("une note de moins d'une seconde n'est pas gardée ; le micro refusé le dit", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("button", { name: "Enregistrer une note vocale" }));
    maintenant = 600;
    await user.click(await screen.findByRole("button", { name: "Envoyer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Note trop courte : parlez au moins une seconde.");
    expect(deposerNoteVocale).not.toHaveBeenCalled();

    getUserMedia.mockRejectedValueOnce(new DOMException("refus", "NotAllowedError"));
    await user.click(screen.getByRole("button", { name: "Enregistrer une note vocale" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Autorisez le micro dans votre navigateur pour enregistrer une note vocale.");
  });

  it("Supprimer pendant la demande du micro : l'accord arrivé ensuite ne lance pas d'enregistrement", async () => {
    const user = userEvent.setup();
    piste.stop.mockClear();
    let accorder: (flux: unknown) => void = () => undefined;
    getUserMedia.mockReturnValueOnce(new Promise((resoudre) => (accorder = resoudre)));
    afficher();
    await user.click(screen.getByRole("button", { name: "Enregistrer une note vocale" }));
    expect(await screen.findByText("Autorisation du micro…")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Supprimer la note vocale" }));
    await act(async () => accorder({ getTracks: () => [piste] }));
    expect(screen.getByRole("textbox", { name: "Message à Dr Mireille Adjovi" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Arrêter pour réécouter" })).toBeNull();
    expect(piste.stop).toHaveBeenCalled();
  });

  it("sans MediaRecorder (vieux navigateur), pas de micro : « Envoyer » reste", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    afficher();
    expect(screen.queryByRole("button", { name: "Enregistrer une note vocale" })).toBeNull();
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  });
});

describe("Écouter une note vocale", () => {
  it("le premier appui demande le lien puis joue ; la vitesse passe de 1× à 1,5× puis 2× ; un lien manquant le dit", async () => {
    const user = userEvent.setup();
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const source = vi.fn(async () => "https://s/note");
    const { unmount } = render(<LecteurVocal dureeMs={12_400} ondes={[10, 50, 100, 20, 30, 40, 60, 80]} source={source} />);
    await user.click(screen.getByRole("button", { name: "Écouter la note vocale (0:12)" }));
    expect(source).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalled();
    const vitesse = screen.getByRole("button", { name: "Vitesse de lecture : 1×" });
    await user.click(vitesse);
    expect(screen.getByRole("button", { name: "Vitesse de lecture : 1,5×" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vitesse de lecture : 1,5×" }));
    expect(screen.getByRole("button", { name: "Vitesse de lecture : 2×" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Position dans la note vocale" })).toHaveAttribute("aria-valuetext", "0:00 sur 0:12");
    unmount();

    render(<LecteurVocal dureeMs={3_000} ondes={[]} source={null} />);
    await user.click(screen.getByRole("button", { name: "Écouter la note vocale (0:03)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cette note vocale n’a pas pu être lue. Rechargez la page.");
  });

  it("dans le fil : la bulle d'une note vocale, sans bouton de téléchargement", async () => {
    vi.mocked(actions.lienNoteVocale).mockResolvedValue({ url: "https://s/n" });
    const note = message({ fichier: { nom: "Note vocale", format: "audio/mp4", taille: 40_000 }, vocal: { dureeMs: 61_000, ondes: [], chemin: "f/n.m4a", url: null } });
    afficher({ fil: { ...FIL, messages: [note] } });
    const fil = screen.getByRole("region", { name: "Conversation avec Dr Mireille Adjovi" });
    expect(within(fil).getByRole("button", { name: "Écouter la note vocale (1:01)" })).toBeInTheDocument();
    expect(within(fil).queryByRole("button", { name: /Télécharger/ })).toBeNull();
    await act(async () => undefined);
  });
});
