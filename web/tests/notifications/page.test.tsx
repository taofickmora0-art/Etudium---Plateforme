// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContenuNotifications } from "@/components/notifications/ContenuNotifications";
import { PageNotifications } from "@/components/notifications/PageNotifications";
import { chargerNotifications, marquerLues } from "@/lib/notifications/actions";
import { lireNotifications } from "@/lib/notifications/data";
import { EVENEMENT_NOTIFICATIONS } from "@/lib/notifications/regles";
import type { LotNotifications, NotificationLue } from "@/lib/notifications/types";

// La page Notifications (design NdNotifications ; spec des notifications, §3).

vi.mock("@/lib/notifications/actions", () => ({ chargerNotifications: vi.fn(), marquerLues: vi.fn() }));
vi.mock("@/lib/notifications/data", () => ({ lireNotifications: vi.fn() }));

const notif = (o: Partial<NotificationLue>): NotificationLue => ({
  id: "1",
  categorie: "nouveaux_contenus",
  titre: "Titre",
  texte: "Texte",
  lien: "/formations/excel",
  creeLe: "2026-10-14T13:00:00Z",
  lue: false,
  ...o,
});
// 14 oct. 2026, 16 h au Bénin.
const LOT: LotNotifications = {
  lignes: [
    notif({ id: "3", titre: "Nouvelle formation : Excel", creeLe: "2026-10-14T13:00:00Z" }),
    notif({ id: "2", categorie: "service", titre: "Vous êtes formateur", texte: "", lien: "/formateur", creeLe: "2026-10-13T13:05:00Z", lue: true }),
    notif({ id: "1", categorie: "annonces", titre: "Nouveautés", creeLe: "2026-10-12T08:05:00Z" }),
  ],
  suite: true,
  nonLues: 2,
};

const groupes = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("La page Notifications", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T15:00:00Z"));
    vi.mocked(chargerNotifications).mockReset();
    vi.mocked(marquerLues).mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.useRealTimers());

  it("l'en-tête du design ; groupes Aujourd’hui / Hier / date ; Il y a 2 h aujourd'hui, 14 h 05 les autres jours", () => {
    render(<PageNotifications initial={LOT} />);
    expect(screen.getByRole("heading", { level: 1, name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("Corrections, sessions live, abonnement et communauté.")).toBeInTheDocument();
    expect(groupes()).toEqual(["Aujourd’hui", "Hier", "12 oct. 2026"]);
    const aujourdhui = screen.getByRole("link", { name: /Nouvelle formation : Excel/ });
    expect(aujourdhui).toHaveAttribute("href", "/formations/excel");
    expect(within(aujourdhui).getByText("Il y a 2 h")).toBeInTheDocument();
    expect(within(aujourdhui).getByRole("img", { name: "Non lue" })).toBeInTheDocument();
    const hier = screen.getByRole("link", { name: /Vous êtes formateur/ });
    expect(within(hier).getByText("14 h 05")).toBeInTheDocument();
    expect(within(hier).queryByRole("img", { name: "Non lue" })).toBeNull();
    expect(within(screen.getByRole("link", { name: /Nouveautés/ })).getByText("9 h 05")).toBeInTheDocument();
  });

  it("filtre Non lues : chargerNotifications(true, null) ; Voir plus : chargerNotifications(false, dernier id), lignes ajoutées à la suite", async () => {
    const user = userEvent.setup();
    vi.mocked(chargerNotifications).mockResolvedValueOnce({
      ok: true,
      page: { lignes: [notif({ id: "0", titre: "La plus ancienne", creeLe: "2026-10-01T08:00:00Z" })], suite: false, nonLues: 2 },
    });
    render(<PageNotifications initial={LOT} />);
    await user.click(screen.getByRole("button", { name: "Voir plus" }));
    expect(chargerNotifications).toHaveBeenLastCalledWith(false, "1");
    expect(await screen.findByRole("link", { name: /La plus ancienne/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nouvelle formation : Excel/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voir plus" })).toBeNull();

    vi.mocked(chargerNotifications).mockResolvedValueOnce({ ok: true, page: { lignes: [LOT.lignes[0]], suite: false, nonLues: 2 } });
    await user.click(within(screen.getByRole("group", { name: "Filtrer les notifications" })).getByRole("button", { name: "Non lues" }));
    expect(chargerNotifications).toHaveBeenLastCalledWith(true, null);
    await waitFor(() => expect(screen.queryByRole("link", { name: /La plus ancienne/ })).toBeNull());
    expect(screen.getByRole("button", { name: "Non lues" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Tout marquer comme lu : marquerLues(null), les points disparaissent, l'événement est émis ; un clic marque une notification", async () => {
    const user = userEvent.setup();
    const evenements = vi.fn();
    window.addEventListener(EVENEMENT_NOTIFICATIONS, evenements);
    render(<PageNotifications initial={LOT} />);
    await user.click(screen.getByRole("link", { name: /Nouveautés/ }));
    expect(marquerLues).toHaveBeenCalledWith(["1"]);
    await waitFor(() => expect(evenements).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Tout marquer comme lu" }));
    expect(marquerLues).toHaveBeenLastCalledWith(null);
    expect(screen.queryAllByRole("img", { name: "Non lue" })).toEqual([]);
    expect(screen.queryByRole("button", { name: "Tout marquer comme lu" })).toBeNull();
    await waitFor(() => expect(evenements).toHaveBeenCalledTimes(2));
    window.removeEventListener(EVENEMENT_NOTIFICATIONS, evenements);
  });

  it("le temps réel (0044) : une notification arrive, elle s'ajoute en tête ; les pages déjà chargées restent", async () => {
    const PLUS: LotNotifications = { lignes: [...LOT.lignes, notif({ id: "0", titre: "Plus ancienne", creeLe: "2026-10-10T08:00:00Z" })], suite: false, nonLues: 3 };
    render(<PageNotifications initial={PLUS} />);
    vi.mocked(chargerNotifications).mockResolvedValue({
      ok: true,
      page: { lignes: [notif({ id: "4", titre: "Nouvelle réponse", creeLe: "2026-10-14T14:59:00Z" }), ...LOT.lignes], suite: true, nonLues: 3 },
    });
    act(() => {
      window.dispatchEvent(new Event("etudium:temps-reel:notification"));
    });
    expect(await screen.findByText("Nouvelle réponse")).toBeInTheDocument();
    expect(chargerNotifications).toHaveBeenCalledWith(false, null);
    expect(screen.getByText("Plus ancienne")).toBeInTheDocument();
    expect(screen.getAllByText("Nouvelle formation : Excel")).toHaveLength(1);
  });

  it("une annonce sans lien se marque lue d'un clic, elle aussi", async () => {
    const user = userEvent.setup();
    render(<PageNotifications initial={{ lignes: [notif({ id: "9", categorie: "annonces", titre: "Nouveautés", lien: null })], suite: false, nonLues: 1 }} />);
    const annonce = screen.getByRole("button", { name: /Nouveautés/ });
    await user.click(annonce);
    expect(marquerLues).toHaveBeenCalledWith(["9"]);
    expect(within(annonce).queryByRole("img", { name: "Non lue" })).toBeNull();
  });

  it("Préférences mène à l'onglet Notifications du profil", () => {
    render(<PageNotifications initial={LOT} />);
    expect(screen.getByRole("link", { name: "Préférences" })).toHaveAttribute("href", "/profil?onglet=notifications");
  });

  it("vide : Vous êtes à jour ; un chargement qui échoue le dit", async () => {
    const user = userEvent.setup();
    render(<PageNotifications initial={{ lignes: [], suite: false, nonLues: 0 }} />);
    expect(screen.getByText("Vous êtes à jour")).toBeInTheDocument();
    expect(screen.getByText("Aucune notification non lue. Les prochaines apparaîtront ici.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tout marquer comme lu" })).toBeNull();
    vi.mocked(chargerNotifications).mockResolvedValueOnce({ ok: false, message: "Les notifications n’ont pas pu être chargées. Réessayez." });
    await user.click(screen.getByRole("button", { name: "Non lues" }));
    expect(await screen.findByText("Les notifications n’ont pas pu être chargées. Réessayez.")).toBeInTheDocument();
  });

  it("le premier affichage prend l'heure du serveur : aucun écart à l'hydratation, même si une minute bascule entre-temps", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");
    const unique: LotNotifications = { lignes: [notif({ id: "9", titre: "Récente", creeLe: "2026-10-14T14:55:30Z" })], suite: false, nonLues: 1 };
    const page = <PageNotifications initial={unique} maintenant="2026-10-14T15:00:00Z" />;
    // Le serveur rend à 15 h 00 (« Il y a 4 min ») ; l'appareil hydrate à 15 h 01 (« Il y a 5 min »).
    const html = renderToString(page);
    vi.setSystemTime(new Date("2026-10-14T15:01:00Z"));
    const conteneur = document.createElement("div");
    conteneur.innerHTML = html;
    document.body.appendChild(conteneur);
    const ecarts = vi.fn();
    await act(async () => {
      hydrateRoot(conteneur, page, { onRecoverableError: ecarts });
    });
    expect(ecarts).not.toHaveBeenCalled();
    // Une fois affichée, la page passe à l'heure de l'appareil.
    expect(conteneur.textContent).toContain("Il y a 5 min");
    conteneur.remove();
  });

  it("avant la 0016 : le bandeau", async () => {
    vi.mocked(lireNotifications).mockResolvedValue({ migrationAbsente: true });
    render(await ContenuNotifications());
    expect(screen.getByText("Les notifications ne sont pas encore dans la base.")).toBeInTheDocument();
    expect(screen.getByText("Appliquez la migration 0016 (guide « Ce qui te revient », section 21).")).toBeInTheDocument();
  });
});
