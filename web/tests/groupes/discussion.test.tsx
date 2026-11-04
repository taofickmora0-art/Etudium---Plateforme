// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilGroupe, GroupeOuvert, MessageGroupe } from "@/lib/groupes/types";

// La discussion d'un groupe (spec des groupes, §2 ; migration 0075) : le fil (jours, blocs, badges, réponse citée,
// supprimé), l'envoi (Entrée, Maj+Entrée), le menu d'un message selon les droits, le temps réel, la lecture, et le champ
// au-dessus du clavier du téléphone.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/groupes/general" }));
vi.mock("@/lib/groupes/actions", () => ({
  envoyerMessageGroupe: vi.fn(),
  modifierMessageGroupe: vi.fn(),
  supprimerMessageGroupe: vi.fn(async () => ({ ok: true })),
  reagirMessageGroupe: vi.fn(),
  epinglerMessageGroupe: vi.fn(async () => ({ ok: true })),
  marquerGroupeLu: vi.fn(async () => ({ ok: true, nonLus: 0 })),
  couperGroupe: vi.fn(async (_g: string, coupe: boolean) => ({ ok: true, coupe })),
  signalerMessageGroupe: vi.fn(async () => ({ ok: true })),
  relireMessages: vi.fn(async () => null),
  relireGroupe: vi.fn(async () => null),
  chargerMesGroupes: vi.fn(async () => ({ ok: false, absente: false })),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "moi" } } }) },
    storage: { from: () => ({ upload: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })) }) },
  }),
}));

const actions = await import("@/lib/groupes/actions");
const { DiscussionGroupe } = await import("@/components/groupes/DiscussionGroupe");
const { ToastProvider } = await import("@/components/ui/Toast");
const { signalerGroupe, reinitialiserGroupesSuivis } = await import("@/components/temps-reel/groupes");

const G = "11111111-1111-4111-8111-111111111111";
const JOUR = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const VEILLE = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() - 86_400_000));
const a = (h: number, m: number, jour = JOUR) => new Date(`${jour}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+01:00`).toISOString();
let n = 0;
const message = (o: Omit<Partial<MessageGroupe>, "auteur"> & { auteur?: Partial<MessageGroupe["auteur"]> }): MessageGroupe => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  groupeId: G,
  deMoi: false,
  texte: "Bonjour",
  image: null,
  vocal: null,
  reponse: null,
  creeLe: a(9, 0),
  modifieLe: null,
  supprime: false,
  retire: false,
  reactions: [],
  epingle: false,
  ...o,
  auteur: { id: "awa", prenom: "Awa", nom: "Kpadé", photoUrl: null, badge: null, ...o.auteur },
});
const GROUPE: GroupeOuvert = {
  id: G,
  slug: "general",
  nom: "Général",
  type: "general",
  couleur: null,
  actif: true,
  parcours: null,
  formation: null,
  ouvert: true,
  membres: 128,
  coupe: false,
  peutModerer: false,
  equipe: false,
  peutEcrire: true,
  nonLus: 0,
  epingle: null,
};

function afficher(messages: MessageGroupe[], groupe: Partial<GroupeOuvert> = {}, fil: Partial<FilGroupe> = {}) {
  return render(
    <ToastProvider>
      <DiscussionGroupe espace="etudiant" groupeInitial={{ ...GROUPE, ...groupe }} filInitial={{ messages, plusAnciens: false, ...fil }} />
    </ToastProvider>,
  );
}

const menuDe = async (user: ReturnType<typeof userEvent.setup>, nom: RegExp | string) => {
  await user.click(screen.getByRole("button", { name: nom }));
  // Radix nomme le menu d'après son bouton.
  return screen.getByRole("menu", { name: nom });
};
const entrees = (menu: HTMLElement) => within(menu).getAllByRole("menuitem").map((e) => e.getAttribute("aria-label") ?? e.textContent);

beforeEach(() => {
  vi.mocked(actions.envoyerMessageGroupe).mockReset();
  vi.mocked(actions.relireMessages).mockReset().mockResolvedValue(null);
  vi.mocked(actions.marquerGroupeLu).mockClear();
  reinitialiserGroupesSuivis();
  window.matchMedia = ((requete: string) => ({ matches: false, media: requete, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
});

describe("Le fil", () => {
  it("les jours, les messages groupés par auteur, les badges, la réponse citée, supprimé et retiré", async () => {
    const question = message({ texte: "Comment figer une ligne ?", creeLe: a(18, 0, VEILLE) });
    afficher([
      question,
      message({ texte: "Bonjour à tous", creeLe: a(9, 0) }),
      message({ texte: "Je suis nouvelle", creeLe: a(9, 2) }),
      message({ texte: "Affichage, puis Figer les volets", creeLe: a(9, 30), auteur: { id: "mir", prenom: "Mireille", nom: "Adjovi", badge: "formateur" }, reponse: { id: question.id, auteur: { prenom: "Awa", nom: "Kpadé" }, texte: question.texte, image: false, vocal: false, supprime: false } }),
      message({ texte: "Rappel des règles", creeLe: a(9, 40), auteur: { id: "eq", prenom: "Équipe", nom: "Étudium", badge: "equipe" } }),
      message({ texte: "", supprime: true, creeLe: a(10, 0), auteur: { id: "kof", prenom: "Koffi", nom: "Dossou" } }),
      message({ texte: "", retire: true, creeLe: a(10, 5), auteur: { id: "kof", prenom: "Koffi", nom: "Dossou" } }),
      message({ texte: "Merci, voir https://exemple.bj", deMoi: true, creeLe: a(10, 10), auteur: { id: "moi", prenom: "Moi", nom: "" } }),
    ]);
    const fil = screen.getByRole("log", { name: "Messages du groupe Général" });
    expect(within(fil).getByText("Hier")).toBeInTheDocument();
    expect(within(fil).getByText("Aujourd’hui")).toBeInTheDocument();
    // Awa : un bloc hier, un bloc ce matin (ses deux messages à 2 minutes d'écart) : son nom deux fois, pas trois.
    expect(within(fil).getAllByText("Awa K.").filter((e) => e.tagName === "SPAN" && e.className.includes("font-semibold") && !e.closest("button"))).toHaveLength(2);
    expect(within(fil).getByText("Formateur")).toBeInTheDocument();
    expect(within(fil).getByText("Équipe")).toBeInTheDocument();
    expect(within(fil).getByText("Message supprimé")).toBeInTheDocument();
    expect(within(fil).getByText("Message retiré par la modération")).toBeInTheDocument();
    expect(within(fil).getByRole("link", { name: "https://exemple.bj" })).toHaveAttribute("target", "_blank");
    // La réponse citée mène au message, mis en valeur.
    await userEvent.setup().click(within(fil).getByRole("button", { name: "Aller au message cité de Awa K." }));
    await waitFor(() => expect(document.querySelector(`[data-message="${question.id}"] .ring-2`)).not.toBeNull());
    expect(screen.getByRole("heading", { level: 1, name: "Général" })).toBeInTheDocument();
    expect(screen.getByText("128 membres")).toBeInTheDocument();
  });

  it("ouvrir le groupe marque lu jusqu'au dernier message visible", async () => {
    const dernier = message({ texte: "Dernier", creeLe: a(9, 5) });
    afficher([message({ creeLe: a(9, 0) }), dernier]);
    await waitFor(() => expect(actions.marquerGroupeLu).toHaveBeenCalledWith(G, dernier.id));
  });

  it("« Charger les messages précédents » ajoute les plus anciens en haut", async () => {
    const recent = message({ texte: "Récent", creeLe: a(9, 0) });
    vi.mocked(actions.relireMessages).mockResolvedValueOnce({ messages: [message({ texte: "Ancien", creeLe: a(8, 0) })], plusAnciens: false });
    afficher([recent], {}, { plusAnciens: true });
    await userEvent.setup().click(screen.getByRole("button", { name: "Charger les messages précédents" }));
    expect(actions.relireMessages).toHaveBeenCalledWith(G, recent.id);
    expect(await screen.findByText("Ancien")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Charger les messages précédents" })).not.toBeInTheDocument();
  });
});

describe("Écrire", () => {
  it("Entrée envoie ; Maj+Entrée va à la ligne", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.envoyerMessageGroupe).mockImplementation(async (_g, texte) => ({ ok: true, message: message({ texte: texte as string, deMoi: true, creeLe: new Date().toISOString() }) }));
    afficher([]);
    const champ = screen.getByRole("textbox", { name: "Message au groupe Général" });
    await user.type(champ, "Bonjour{Shift>}{Enter}{/Shift}à tous");
    expect(actions.envoyerMessageGroupe).not.toHaveBeenCalled();
    expect(champ).toHaveValue("Bonjour\nà tous");
    await user.keyboard("{Enter}");
    expect(actions.envoyerMessageGroupe).toHaveBeenCalledWith(G, "Bonjour\nà tous", null, null);
    await waitFor(() => expect(champ).toHaveValue(""));
    expect(within(screen.getByRole("log")).getByText(/à tous/)).toBeInTheDocument();
  });

  it("Répondre cite le message ; la réponse part avec lui ; un refus de la base s'affiche", async () => {
    const user = userEvent.setup();
    const cible = message({ texte: "Qui vient samedi ?" });
    vi.mocked(actions.envoyerMessageGroupe).mockResolvedValueOnce({ ok: false, message: "Vous envoyez beaucoup de messages. Patientez une minute avant d’écrire de nouveau." });
    afficher([cible]);
    const menu = await menuDe(user, "Actions sur le message de Awa K.");
    await user.click(within(menu).getByRole("menuitem", { name: "Répondre" }));
    expect(screen.getByText("Réponse à Awa K.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Message au groupe Général" }), "Moi !{Enter}");
    expect(actions.envoyerMessageGroupe).toHaveBeenCalledWith(G, "Moi !", null, cible.id);
    expect(await screen.findByRole("alert")).toHaveTextContent("Patientez une minute");
    // Échap annule la réponse.
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Réponse à Awa K.")).not.toBeInTheDocument();
  });

  it("une image trop lourde est refusée avant l'envoi", async () => {
    const user = userEvent.setup();
    afficher([]);
    const lourde = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(lourde, "size", { value: 6_000_000 });
    await user.upload(screen.getByLabelText("Ajouter une image"), lourde);
    expect(await screen.findByRole("alert")).toHaveTextContent("L’image dépasse 5 Mo.");
  });
});

describe("Le menu d'un message, selon les droits", () => {
  it("le message d'un autre : répondre, réagir, copier, signaler ; pas de modification ni de suppression", async () => {
    const user = userEvent.setup();
    afficher([message({ texte: "Bonjour" })]);
    const menu = await menuDe(user, "Actions sur le message de Awa K.");
    expect(entrees(menu)).toEqual([
      "Réagir : Pouce levé",
      "Réagir : Cœur",
      "Réagir : Rire",
      "Réagir : Surprise",
      "Réagir : Tristesse",
      "Réagir : Merci",
      "Répondre",
      "Copier le texte",
      "Signaler",
    ]);
  });

  it("le sien, de moins de 15 minutes : modifier et supprimer, pas signaler", async () => {
    const user = userEvent.setup();
    afficher([message({ deMoi: true, creeLe: new Date(Date.now() - 60_000).toISOString(), auteur: { id: "moi" } })]);
    const menu = await menuDe(user, "Actions sur votre message");
    expect(entrees(menu).slice(6)).toEqual(["Répondre", "Copier le texte", "Modifier", "Supprimer"]);
  });

  it("le formateur ou l'équipe : épingler et supprimer ; l'équipe ne signale pas", async () => {
    const user = userEvent.setup();
    afficher([message({ texte: "Bonjour" })], { peutModerer: true, equipe: true });
    const menu = await menuDe(user, "Actions sur le message de Awa K.");
    expect(entrees(menu).slice(6)).toEqual(["Répondre", "Copier le texte", "Épingler", "Supprimer"]);
    await user.click(within(menu).getByRole("menuitem", { name: "Épingler" }));
    expect(actions.epinglerMessageGroupe).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /Message épinglé/ })).toBeInTheDocument();
  });

  it("une réaction se met depuis le menu et s'affiche sous le message", async () => {
    const user = userEvent.setup();
    const m = message({ texte: "Bravo" });
    vi.mocked(actions.reagirMessageGroupe).mockResolvedValueOnce({ ok: true, reactions: [{ emoji: "❤️", nombre: 1, moi: true }] });
    afficher([m]);
    const menu = await menuDe(user, "Actions sur le message de Awa K.");
    await user.click(within(menu).getByRole("menuitem", { name: "Réagir : Cœur" }));
    expect(actions.reagirMessageGroupe).toHaveBeenCalledWith(m.id, "❤️");
    expect(await screen.findByRole("button", { name: "Cœur : 1 réaction, dont la vôtre" })).toHaveAttribute("aria-pressed", "true");
  });

  it("un groupe désactivé : ni champ, ni réponse, ni réaction", async () => {
    const user = userEvent.setup();
    afficher([message({ texte: "Ancien message" })], { peutEcrire: false, actif: false, type: "formation" });
    expect(screen.getByText("Ce groupe est désactivé : personne ne peut y écrire.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const menu = await menuDe(user, "Actions sur le message de Awa K.");
    expect(entrees(menu)).toEqual(["Copier le texte", "Signaler"]);
  });
});

describe("Le temps réel", () => {
  it("un nouveau message arrive sans recharger ; en bas du fil, la page y reste et l'annonce", async () => {
    const premier = message({ texte: "Premier", creeLe: a(9, 0) });
    afficher([premier]);
    vi.mocked(actions.relireMessages).mockResolvedValueOnce({ messages: [premier, message({ texte: "Tout nouveau", creeLe: a(9, 1) })], plusAnciens: false });
    act(() => signalerGroupe(G, "message"));
    expect(await screen.findByText("Tout nouveau")).toBeInTheDocument();
    expect(screen.getByText("Nouveau message de Awa K. : Tout nouveau")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button", { name: /Nouveau message/ })).not.toBeInTheDocument();
  });

  it("remonté dans le fil : « Nouveau message » apparaît et ramène en bas", async () => {
    const user = userEvent.setup();
    const premier = message({ texte: "Premier", creeLe: a(9, 0) });
    afficher([premier]);
    const fil = screen.getByRole("log");
    Object.defineProperty(fil, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(fil, "clientHeight", { configurable: true, value: 400 });
    fil.scrollTop = 100;
    fil.dispatchEvent(new Event("scroll"));
    vi.mocked(actions.relireMessages).mockResolvedValueOnce({ messages: [premier, message({ texte: "Pendant ma lecture", creeLe: a(9, 1) })], plusAnciens: false });
    act(() => signalerGroupe(G, "message"));
    const bouton = await screen.findByRole("button", { name: "Nouveau message" });
    await user.click(bouton);
    expect(screen.queryByRole("button", { name: "Nouveau message" })).not.toBeInTheDocument();
  });

  it("un événement d'un autre groupe ne relit rien", async () => {
    afficher([message({})]);
    act(() => signalerGroupe("22222222-2222-4222-8222-222222222222", "message"));
    await new Promise((r) => setTimeout(r, 0));
    expect(actions.relireMessages).not.toHaveBeenCalled();
  });
});

describe("Le téléphone et son clavier", () => {
  it("le clavier ouvert : la discussion occupe la partie visible, le champ reste au-dessus", () => {
    const ecouteurs: (() => void)[] = [];
    const vue = { height: 800, offsetTop: 0, addEventListener: (_: string, f: () => void) => ecouteurs.push(f), removeEventListener: () => {} };
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vue });
    window.matchMedia = ((requete: string) => ({ matches: requete.includes("max-width"), media: requete, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    afficher([message({})]);
    const section = screen.getByRole("region", { name: "Général" });
    expect(section.style.position).toBe("");
    vue.height = 460;
    act(() => ecouteurs.forEach((f) => f()));
    expect(section.style.position).toBe("fixed");
    expect(section.style.top).toBe("0px");
    expect(section.style.height).toBe("460px");
    expect(within(section).getByRole("textbox", { name: "Message au groupe Général" })).toBeInTheDocument();
    vue.height = 800;
    act(() => ecouteurs.forEach((f) => f()));
    expect(section.style.position).toBe("");
  });
});
