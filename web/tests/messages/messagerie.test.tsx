// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationResume, Contact, Fil, Message } from "@/lib/messages/types";

// Lot 5, étape A : l'écran Messages (NdMessages), le même pour l'étudiant, le formateur et l'équipe.
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), usePathname: () => "/messages" }));
vi.mock("@/lib/messages/actions", () => ({
  envoyerMessage: vi.fn(),
  ouvrirConversation: vi.fn(),
  relireFil: vi.fn(),
  relireConversations: vi.fn(),
  chercherContacts: vi.fn(),
  lienFichierMessage: vi.fn(),
  compterMessagesNonLus: vi.fn(async () => 0),
}));
const televerser = vi.fn();
const retirer = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "moi" } } }) },
    storage: { from: () => ({ upload: televerser, remove: retirer }) },
  }),
}));

const actions = await import("@/lib/messages/actions");
const { Messagerie } = await import("@/components/messages/Messagerie");

const C = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const F = "33333333-3333-4333-8333-333333333333";
// Le jour au Bénin (UTC+1), pour que « Aujourd’hui » tienne même autour de minuit.
const JOUR = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const aujourdhui = (h: number, m: number) => new Date(`${JOUR}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+01:00`).toISOString();
const CONV: ConversationResume = {
  id: C,
  avec: { nom: "Dr Mireille Adjovi", photoUrl: null, role: "Formateur·rice", equipe: false },
  formation: { titre: "Maîtriser Microsoft Excel", slug: "excel" },
  dernier: { texte: "Merci ! Je serai présente samedi.", fichier: null, deMoi: true, creeLe: aujourdhui(14, 5) },
  nonLu: false,
};
const EQUIPE: ConversationResume = {
  id: C2,
  avec: { nom: "Équipe Étudium", photoUrl: null, role: "Assistance", equipe: true },
  formation: null,
  dernier: { texte: "Votre formule Standard expire dans 5 jours.", fichier: null, deMoi: false, creeLe: "2026-10-14T08:30:00Z" },
  nonLu: true,
};
const message = (o: Partial<Message>): Message => ({ id: crypto.randomUUID(), texte: "", fichier: null, deMoi: false, auteur: null, creeLe: aujourdhui(14, 2), ...o });
const FIL: Fil = {
  conversation: CONV,
  plusAnciens: false,
  messages: [
    message({ texte: "Bonjour Docteur, je viens de déposer mon tableau.", deMoi: true, creeLe: aujourdhui(11, 42), fichier: { nom: "Tableau_ventes.xlsx", format: "application/zip", taille: 248000 } }),
    message({ texte: "Bonjour Aïcha. Votre tableau est validé.", creeLe: aujourdhui(14, 2) }),
  ],
};
const CONTACTS: Contact[] = [
  { id: F, nom: "Dr Mireille Adjovi", photoUrl: null, formation: "Maîtriser Microsoft Excel" },
  { id: null, nom: "Équipe Étudium", photoUrl: null, formation: null },
];

function afficher(o: { fil?: Fil | null; choisie?: string | null; espace?: "etudiant" | "formateur" | "equipe"; contacts?: Contact[] } = {}) {
  return render(
    <Messagerie
      espace={o.espace ?? "etudiant"}
      base="/messages"
      conversations={[CONV, EQUIPE]}
      fil={o.fil === undefined ? FIL : o.fil}
      choisie={o.choisie === undefined ? C : o.choisie}
      contacts={o.contacts ?? CONTACTS}
    />,
  );
}

beforeEach(() => {
  for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  vi.mocked(actions.relireFil).mockResolvedValue(null);
  vi.mocked(actions.relireConversations).mockResolvedValue(null);
  push.mockReset();
  replace.mockReset();
  televerser.mockReset().mockResolvedValue({ error: null });
  retirer.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => vi.useRealTimers());

describe("La liste des conversations", () => {
  it("chaque conversation : le nom, l'heure, l'aperçu (« Vous : »), le point « Non lu », le lien ; la choisie est marquée", () => {
    afficher();
    const liste = screen.getByRole("navigation", { name: "Conversations" });
    const adjovi = within(liste).getByRole("link", { name: /Dr Mireille Adjovi/ });
    expect(adjovi).toHaveAttribute("href", `/messages?c=${C}`);
    expect(adjovi).toHaveAttribute("aria-current", "true");
    expect(adjovi).toHaveTextContent("14 h 05");
    expect(adjovi).toHaveTextContent("Vous : Merci ! Je serai présente samedi.");
    const equipe = within(liste).getByRole("link", { name: /Équipe Étudium/ });
    expect(within(equipe).getByRole("img", { name: "Non lu" })).toBeInTheDocument();
    expect(equipe).not.toHaveAttribute("aria-current");
  });
});

describe("Le temps réel (0044)", () => {
  it("un message arrive : la conversation ouverte et la liste se relisent aussitôt", async () => {
    vi.mocked(actions.relireFil).mockResolvedValue({ ...FIL, messages: [...FIL.messages, message({ texte: "Arrivé en direct", creeLe: aujourdhui(14, 3) })] });
    vi.mocked(actions.relireConversations).mockResolvedValue([CONV, { ...EQUIPE, dernier: { ...EQUIPE.dernier!, texte: "Réponse en direct" } }]);
    afficher();
    act(() => {
      window.dispatchEvent(new Event("etudium:temps-reel:message"));
    });
    expect(await screen.findByText("Arrivé en direct")).toBeInTheDocument();
    expect(await screen.findByText(/Réponse en direct/)).toBeInTheDocument();
    expect(actions.relireConversations).toHaveBeenCalledWith("etudiant");
  });
});

describe("La conversation", () => {
  it("l'en-tête, les messages groupés par jour, la pièce jointe, « Vous · 11 h 42 »", () => {
    afficher();
    const fil = screen.getByRole("region", { name: "Conversation avec Dr Mireille Adjovi" });
    expect(fil).toHaveTextContent("Formateur·rice · Maîtriser Microsoft Excel");
    expect(within(fil).getByRole("link", { name: "Voir la formation" })).toHaveAttribute("href", "/formations/excel");
    expect(fil).toHaveTextContent("Aujourd’hui");
    expect(within(fil).getByRole("button", { name: "Télécharger Tableau_ventes.xlsx (248 Ko)" })).toBeInTheDocument();
    expect(fil).toHaveTextContent("Vous · 11 h 42");
    expect(fil).toHaveTextContent("14 h 02");
  });

  it("envoyer : le message apparaît tout de suite, le champ se vide ; Entrée envoie, Maj+Entrée va à la ligne", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.envoyerMessage).mockResolvedValue({ ok: true, message: message({ texte: "Merci beaucoup !", deMoi: true, creeLe: new Date().toISOString() }) });
    afficher();
    const champ = screen.getByRole("textbox", { name: "Message à Dr Mireille Adjovi" });
    expect(champ).toHaveAttribute("placeholder", "Écrivez votre message…");
    await user.type(champ, "Merci");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(champ).toHaveValue("Merci\n");
    await user.clear(champ);
    await user.type(champ, "Merci beaucoup !{Enter}");
    await waitFor(() => expect(actions.envoyerMessage).toHaveBeenCalledWith(C, "Merci beaucoup !", null));
    expect(await screen.findByText("Merci beaucoup !")).toBeInTheDocument();
    expect(champ).toHaveValue("");
  });

  it("au téléphone (écran tactile), Entrée va à la ligne : on envoie avec le bouton", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("matchMedia", (requete: string) => ({ matches: requete === "(pointer: coarse)", media: requete, addEventListener: () => {}, removeEventListener: () => {} }));
    afficher();
    const champ = screen.getByRole("textbox", { name: "Message à Dr Mireille Adjovi" });
    await user.type(champ, "Bonjour{Enter}Docteur");
    expect(champ).toHaveValue("Bonjour\nDocteur");
    expect(actions.envoyerMessage).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("un refus s'affiche et le texte reste dans le champ", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.envoyerMessage).mockResolvedValue({ ok: false, message: "Trop de messages en peu de temps : réessayez dans quelques minutes." });
    afficher();
    await user.type(screen.getByRole("textbox", { name: "Message à Dr Mireille Adjovi" }), "Encore");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trop de messages en peu de temps : réessayez dans quelques minutes.");
    expect(screen.getByRole("textbox", { name: "Message à Dr Mireille Adjovi" })).toHaveValue("Encore");
  });

  it("joindre un fichier : un format refusé est arrêté dans le navigateur ; un PDF part avec le message", async () => {
    const user = userEvent.setup({ applyAccept: false });
    afficher();
    const choisir = screen.getByLabelText("Joindre un fichier", { selector: "input" });
    await user.upload(choisir, new File(["bonjour"], "notes.txt", { type: "text/plain" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ce format n’est pas accepté : PDF, Word, Excel, PowerPoint, image ou ZIP.");

    vi.mocked(actions.envoyerMessage).mockResolvedValue({ ok: true, message: message({ deMoi: true, fichier: { nom: "Mémoire.pdf", format: "application/pdf", taille: 9 } }) });
    await user.upload(choisir, new File(["%PDF-1.7"], "Mémoire.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("Mémoire.pdf")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(actions.envoyerMessage).toHaveBeenCalled());
    const [conv, texte, fichier] = vi.mocked(actions.envoyerMessage).mock.calls[0];
    expect([conv, texte, fichier?.nom]).toEqual([C, "", "Mémoire.pdf"]);
    expect(fichier?.chemin).toMatch(/^moi\/[0-9a-z-]+\/[0-9a-z-]+\.pdf$/);
    expect(televerser.mock.calls[0][0]).toBe(fichier?.chemin);
  });

  it("toutes les 10 s, le fil est relu ; une relecture qui échoue garde les messages affichés", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(actions.relireFil).mockResolvedValueOnce({ ...FIL, messages: [...FIL.messages, message({ texte: "Nouveau message du formateur" })] }).mockResolvedValue(null);
    afficher();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(actions.relireFil).toHaveBeenCalledWith(C);
    expect(await screen.findByText("Nouveau message du formateur")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText("Nouveau message du formateur")).toBeInTheDocument();
    expect(screen.getByText("Bonjour Aïcha. Votre tableau est validé.")).toBeInTheDocument();
  });

  it("les messages précédents chargés restent à la relecture suivante ; les charger ne fait pas redescendre", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const defiler = vi.fn();
    Element.prototype.scrollIntoView = defiler;
    const ancien = message({ texte: "Un message de la semaine dernière", creeLe: "2026-10-09T10:00:00Z" });
    vi.mocked(actions.relireFil).mockImplementation(async (_c: string, avant?: string) => (avant ? { ...FIL, messages: [ancien], plusAnciens: false } : FIL));
    afficher({ fil: { ...FIL, plusAnciens: true } });
    const avantChargement = defiler.mock.calls.length;
    await act(async () => {
      screen.getByRole("button", { name: "Messages précédents" }).click();
    });
    expect(await screen.findByText("Un message de la semaine dernière")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Messages précédents" })).toBeNull();
    expect(defiler.mock.calls.length).toBe(avantChargement);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(actions.relireFil).toHaveBeenLastCalledWith(C);
    expect(screen.getByText("Un message de la semaine dernière")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Messages précédents" })).toBeNull();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("vu par l'équipe : le nom du membre qui a répondu sous sa bulle", () => {
    afficher({
      espace: "equipe",
      fil: { conversation: { ...EQUIPE, avec: { nom: "Aïcha Kpadé", photoUrl: null, role: "Assistance", equipe: false } }, plusAnciens: false, messages: [message({ texte: "Nous regardons.", deMoi: true, auteur: "Awa Diallo", creeLe: aujourdhui(9, 30) })] },
      choisie: C2,
    });
    expect(screen.getByRole("region", { name: "Conversation avec Aïcha Kpadé" })).toHaveTextContent("Awa Diallo · 9 h 30");
  });
});

describe("Sans conversation choisie, au téléphone, nouveau message", () => {
  it("sans conversation choisie : une invitation à choisir ou à écrire", () => {
    afficher({ fil: null, choisie: null });
    expect(screen.getByText("Choisissez une conversation")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Conversation avec/ })).toBeNull();
  });

  it("au téléphone, la conversation a un retour vers la liste", () => {
    afficher();
    expect(screen.getByRole("link", { name: "Retour aux conversations" })).toHaveAttribute("href", "/messages");
  });

  it("« Nouveau message » : choisir à qui écrire ouvre la conversation", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.ouvrirConversation).mockResolvedValue({ ok: true, id: C2 });
    afficher();
    await user.click(screen.getByRole("button", { name: "Nouveau message" }));
    const fenetre = screen.getByRole("dialog", { name: "Nouveau message" });
    expect(within(fenetre).getByRole("button", { name: /Dr Mireille Adjovi/ })).toHaveTextContent("Maîtriser Microsoft Excel");
    expect(within(fenetre).queryByText("Inscrivez-vous à une formation pour écrire à son formateur.")).toBeNull();
    await user.click(within(fenetre).getByRole("button", { name: /Équipe Étudium/ }));
    await waitFor(() => expect(actions.ouvrirConversation).toHaveBeenCalledWith(null));
    expect(push).toHaveBeenCalledWith(`/messages?c=${C2}`);
  });

  it("le formateur cherche un étudiant par son nom", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.chercherContacts).mockResolvedValue([{ id: F, nom: "Aïcha Kpadé", photoUrl: null, formation: "Excel" }]);
    afficher({ espace: "formateur" });
    await user.click(screen.getByRole("button", { name: "Nouveau message" }));
    expect(screen.getByRole("searchbox", { name: "Rechercher un étudiant" })).toHaveAttribute("placeholder", "Rechercher un étudiant…");
    expect(screen.queryByRole("searchbox", { name: "Rechercher un formateur" })).toBeNull();
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un étudiant" }), "aïch");
    await waitFor(() => expect(actions.chercherContacts).toHaveBeenLastCalledWith("formateur", "aïch"));
    expect(await screen.findByRole("button", { name: /Aïcha Kpadé/ })).toBeInTheDocument();
    expect(screen.queryByText("Inscrivez-vous à une formation pour écrire à son formateur.")).toBeNull();
  });

  it("l'étudiant cherche un formateur par son nom (spec du 2 novembre 2026, §7) ; sans résultat, il le lit ; le champ vidé, la liste revient", async () => {
    const user = userEvent.setup();
    const KOFFI: Contact = { id: "44444444-4444-4444-8444-444444444444", nom: "Koffi Mensah", photoUrl: null, formation: "Canva, de débutant à expert" };
    vi.mocked(actions.chercherContacts).mockImplementation(async (_espace, terme) => (terme === "koff" ? [KOFFI] : []));
    afficher();
    await user.click(screen.getByRole("button", { name: "Nouveau message" }));
    const fenetre = screen.getByRole("dialog", { name: "Nouveau message" });
    const champ = within(fenetre).getByRole("searchbox", { name: "Rechercher un formateur" });
    expect(champ).toHaveAttribute("placeholder", "Rechercher un formateur…");
    await user.type(champ, "koff");
    await waitFor(() => expect(actions.chercherContacts).toHaveBeenLastCalledWith("etudiant", "koff"));
    expect(await within(fenetre).findByRole("button", { name: /Koffi Mensah/ })).toHaveTextContent("Canva, de débutant à expert");
    expect(within(fenetre).queryByRole("button", { name: /Dr Mireille Adjovi/ })).toBeNull();
    await user.type(champ, "zz");
    expect(await within(fenetre).findByText("Aucun formateur ne correspond.")).toBeInTheDocument();
    await user.clear(champ);
    expect(within(fenetre).getByRole("button", { name: /Dr Mireille Adjovi/ })).toBeInTheDocument();
    expect(within(fenetre).getByRole("button", { name: /Équipe Étudium/ })).toBeInTheDocument();
  });

  it("l'étudiant inscrit à aucune formation : l'Équipe Étudium seule, et une phrase pour s'inscrire", async () => {
    const user = userEvent.setup();
    afficher({ contacts: [{ id: null, nom: "Équipe Étudium", photoUrl: null, formation: null }] });
    await user.click(screen.getByRole("button", { name: "Nouveau message" }));
    const fenetre = screen.getByRole("dialog", { name: "Nouveau message" });
    expect(within(fenetre).getAllByRole("button", { name: /Équipe Étudium/ })).toHaveLength(1);
    expect(within(fenetre).getByText("Inscrivez-vous à une formation pour écrire à son formateur.")).toBeInTheDocument();
    expect(within(fenetre).getByRole("searchbox", { name: "Rechercher un formateur" })).toBeInTheDocument();
  });

  it("l'équipe n'a pas de « Nouveau message » (elle répond à l'assistance)", () => {
    afficher({ espace: "equipe" });
    expect(screen.queryByRole("button", { name: "Nouveau message" })).toBeNull();
  });
});
