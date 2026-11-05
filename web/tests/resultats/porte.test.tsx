// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// La porte de « Mes résultats » (spec du 5 novembre 2026, §2 et §4) : avec un code, le clavier à 4 chiffres (masqués)
// avant tout ; sans code ni proposition vue, « Protège tes résultats » (créer, ou plus tard) ; la fenêtre « Sécurité »
// (reverrouiller, changer, retirer, code oublié) ; le code oublié passe par une reconnexion.

const ouvrirResultats = vi.fn();
const creerPin = vi.fn();
const passerProposition = vi.fn();
const changerPin = vi.fn();
const retirerPin = vi.fn();
const verrouillerResultats = vi.fn();
const oublierPin = vi.fn();
vi.mock("@/lib/resultats/actions", () => ({
  ouvrirResultats: (...a: unknown[]) => ouvrirResultats(...a),
  creerPin: (...a: unknown[]) => creerPin(...a),
  passerProposition: (...a: unknown[]) => passerProposition(...a),
  changerPin: (...a: unknown[]) => changerPin(...a),
  retirerPin: (...a: unknown[]) => retirerPin(...a),
  verrouillerResultats: (...a: unknown[]) => verrouillerResultats(...a),
  oublierPin: (...a: unknown[]) => oublierPin(...a),
}));
const signOut = vi.fn(async () => undefined);
vi.mock("@/lib/auth/actions", () => ({ signOut: () => signOut() }));
const loadFullPage = vi.fn();
vi.mock("@/lib/full-page", () => ({ loadFullPage: (url: string) => loadFullPage(url) }));
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/mes-resultats" }));
let etat: unknown = null;
vi.mock("@/lib/resultats/data", () => ({ lireEtatResultats: async () => etat }));

const { DeverrouillageResultats } = await import("@/components/resultats/DeverrouillageResultats");
const { PropositionPin } = await import("@/components/resultats/PropositionPin");
const { SecuriteResultats } = await import("@/components/resultats/SecuriteResultats");
const { PorteResultats } = await import("@/components/resultats/PorteResultats");
const { MinuterieResultats } = await import("@/components/resultats/MinuterieResultats");

/** Tape un code dans le groupe de cases « nom ». */
async function taper(user: ReturnType<typeof userEvent.setup>, nom: string, code: string) {
  const groupe = screen.getByRole("group", { name: nom });
  await user.click(groupe.querySelector("input")!);
  await user.keyboard(code);
}

beforeEach(() => {
  for (const f of [ouvrirResultats, creerPin, passerProposition, changerPin, retirerPin, verrouillerResultats, oublierPin, signOut, replace]) f.mockReset();
  ouvrirResultats.mockResolvedValue({ ok: true });
  creerPin.mockResolvedValue({ ok: true });
  passerProposition.mockResolvedValue({ ok: true });
  changerPin.mockResolvedValue({ ok: true });
  retirerPin.mockResolvedValue({ ok: true });
  verrouillerResultats.mockResolvedValue({ ok: true });
});

describe("Le déverrouillage", () => {
  it("4 chiffres masqués : le code part ; un refus s'affiche et les cases se vident", async () => {
    const user = userEvent.setup();
    ouvrirResultats.mockResolvedValueOnce({ ok: false, message: "Code incorrect. Encore 4 essais." });
    render(<DeverrouillageResultats bloqueJusqua={null} />);
    expect(screen.getByRole("heading", { name: "Saisis ton code" })).toBeInTheDocument();
    const cases = screen.getByRole("group", { name: "Ton code PIN" }).querySelectorAll("input");
    expect(cases).toHaveLength(4);
    expect(cases[0].className).toContain("[-webkit-text-security:disc]");
    await taper(user, "Ton code PIN", "0000");
    await waitFor(() => expect(ouvrirResultats).toHaveBeenCalledWith("0000"));
    expect(await screen.findByText("Code incorrect. Encore 4 essais.")).toBeInTheDocument();
    expect(cases[0]).toHaveValue("");
  });

  it("« Code oublié ? » : se reconnecter, puis revenir créer un nouveau code", async () => {
    const user = userEvent.setup();
    render(<DeverrouillageResultats bloqueJusqua={null} />);
    await user.click(screen.getByRole("button", { name: "Code oublié ?" }));
    expect(screen.getByRole("dialog", { name: "Code oublié ?" })).toHaveTextContent("Tes résultats sont gardés.");
    await user.click(screen.getByRole("button", { name: "Me reconnecter" }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(loadFullPage).toHaveBeenCalledWith(`/connexion?next=${encodeURIComponent("/mes-resultats?oubli=1")}`);
  });

  it("après trop d'essais : le temps qui reste, et les cases fermées", () => {
    render(<DeverrouillageResultats bloqueJusqua={new Date(Date.now() + 10 * 60_000 - 1000).toISOString()} />);
    expect(screen.getByText("Trop d’essais : réessaie dans 10 minutes.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Ton code PIN" }).querySelector("input")).toBeDisabled();
  });
});

describe("La proposition du code", () => {
  it("« Plus tard » ne revient plus ; « Créer mon code » demande deux fois le même code", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PropositionPin />);
    expect(screen.getByRole("heading", { name: "Protège tes résultats" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Plus tard" }));
    expect(passerProposition).toHaveBeenCalled();
    unmount();
    render(<PropositionPin />);
    await user.click(screen.getByRole("button", { name: "Créer mon code" }));
    await taper(user, "Choisis ton code", "1234");
    await taper(user, "Confirme ton code", "1235");
    await user.click(screen.getByRole("button", { name: "Enregistrer mon code" }));
    expect(await screen.findByText("Les deux codes ne sont pas identiques.")).toBeInTheDocument();
    expect(creerPin).not.toHaveBeenCalled();
    await taper(user, "Confirme ton code", "1234");
    await user.click(screen.getByRole("button", { name: "Enregistrer mon code" }));
    await waitFor(() => expect(creerPin).toHaveBeenCalledWith("1234"));
  });
});

describe("La sécurité", () => {
  it("avec un code : reverrouiller, changer (code actuel + nouveau), retirer", async () => {
    const user = userEvent.setup();
    render(<SecuriteResultats pin />);
    await user.click(screen.getByRole("button", { name: "Sécurité" }));
    await user.click(screen.getByRole("button", { name: "Reverrouiller maintenant" }));
    expect(verrouillerResultats).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sécurité" }));
    await user.click(screen.getByRole("button", { name: "Changer de code" }));
    await taper(user, "Ton code actuel", "1111");
    await taper(user, "Choisis ton code", "2222");
    await taper(user, "Confirme ton code", "2222");
    await user.click(screen.getByRole("button", { name: "Enregistrer mon code" }));
    await waitFor(() => expect(changerPin).toHaveBeenCalledWith("1111", "2222"));
    await user.click(screen.getByRole("button", { name: "Sécurité" }));
    await user.click(screen.getByRole("button", { name: "Retirer le code" }));
    await taper(user, "Ton code actuel", "2222");
    await user.click(screen.getByRole("button", { name: "Retirer mon code" }));
    await waitFor(() => expect(retirerPin).toHaveBeenCalledWith("2222"));
  });

  it("sans code : en créer un", async () => {
    const user = userEvent.setup();
    render(<SecuriteResultats pin={false} />);
    await user.click(screen.getByRole("button", { name: "Sécurité" }));
    expect(screen.getByRole("dialog", { name: "Sécurité de tes résultats" })).toHaveTextContent("Aucun code ne protège tes résultats.");
    await taper(user, "Choisis ton code", "4321");
    await taper(user, "Confirme ton code", "4321");
    await user.click(screen.getByRole("button", { name: "Enregistrer mon code" }));
    await waitFor(() => expect(creerPin).toHaveBeenCalledWith("4321"));
  });
});

describe("La porte", () => {
  const contenu = <p>Mes parcours</p>;

  it("verrouillée : le clavier, rien d'autre ; ouverte : le contenu ; sans proposition vue : la proposition ; avant la 0077 : un message", async () => {
    etat = { pin: true, ouvert: false, bloqueJusqua: null, propose: true };
    const a = render(await PorteResultats({ children: contenu }));
    expect(screen.getByRole("heading", { name: "Saisis ton code" })).toBeInTheDocument();
    expect(screen.queryByText("Mes parcours")).toBeNull();
    a.unmount();
    etat = { pin: true, ouvert: true, bloqueJusqua: null, propose: true };
    const b = render(await PorteResultats({ children: contenu }));
    expect(screen.getByText("Mes parcours")).toBeInTheDocument();
    b.unmount();
    etat = { pin: false, ouvert: true, bloqueJusqua: null, propose: false };
    const c = render(await PorteResultats({ children: contenu }));
    expect(screen.getByRole("heading", { name: "Protège tes résultats" })).toBeInTheDocument();
    c.unmount();
    etat = null;
    render(await PorteResultats({ children: contenu }));
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
  });

  it("après une reconnexion (?oubli=1) : rien ne part sans un geste ; le nouveau code remplace l'ancien", async () => {
    const user = userEvent.setup();
    oublierPin.mockResolvedValue({ ok: true });
    etat = { pin: true, ouvert: false, bloqueJusqua: null, propose: true };
    render(await PorteResultats({ children: <p>Mes parcours</p>, oubli: true }));
    expect(screen.getByRole("heading", { name: "Crée ton nouveau code" })).toBeInTheDocument();
    expect(oublierPin).not.toHaveBeenCalled();
    await taper(user, "Choisis ton code", "5678");
    await taper(user, "Confirme ton code", "5678");
    await user.click(screen.getByRole("button", { name: "Enregistrer mon code" }));
    await waitFor(() => expect(creerPin).toHaveBeenCalledWith("5678"));
    expect(oublierPin.mock.invocationCallOrder[0]).toBeLessThan(creerPin.mock.invocationCallOrder[0]);
    expect(replace).toHaveBeenCalledWith("/mes-resultats");
  });

  it("une reconnexion trop ancienne : le message, et le nouveau code n'est pas créé", async () => {
    const user = userEvent.setup();
    oublierPin.mockResolvedValue({ ok: false, message: "Reconnecte-toi pour créer un nouveau code.", reconnecter: true });
    etat = { pin: true, ouvert: false, bloqueJusqua: null, propose: true };
    render(await PorteResultats({ children: <p>Mes parcours</p>, oubli: true }));
    await taper(user, "Choisis ton code", "5678");
    await taper(user, "Confirme ton code", "5678");
    await user.click(screen.getByRole("button", { name: "Enregistrer mon code" }));
    expect(await screen.findByText("Reconnecte-toi pour créer un nouveau code.")).toBeInTheDocument();
    expect(creerPin).not.toHaveBeenCalled();
  });
});

describe("La minuterie", () => {
  it("15 minutes sans rien faire : l'espace se reverrouille ; un geste repart de zéro", () => {
    vi.useFakeTimers();
    render(<MinuterieResultats />);
    act(() => vi.advanceTimersByTime(14 * 60_000));
    fireEvent.pointerDown(document);
    act(() => vi.advanceTimersByTime(14 * 60_000));
    expect(verrouillerResultats).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60_000 + 10));
    expect(verrouillerResultats).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
