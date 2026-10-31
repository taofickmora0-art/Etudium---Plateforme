// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CarteSession } from "@/components/sessions/CarteSession";
import { ContenuEvenements } from "@/components/sessions/ContenuEvenements";
import { PageEvenements } from "@/components/sessions/PageEvenements";
import { chargerSessions, seDesinscrire, sinscrire } from "@/lib/sessions/actions";
import { lireSessions } from "@/lib/sessions/data";
import type { SessionCarte } from "@/lib/sessions/types";

// La page Événements (design NdEvenements ; spec des sessions live, §4).

vi.mock("@/lib/sessions/actions", () => ({ chargerSessions: vi.fn(), sinscrire: vi.fn(), seDesinscrire: vi.fn() }));
vi.mock("@/lib/sessions/data", () => ({ lireSessions: vi.fn() }));

// 14 oct. 2026, 16 h 00 au Bénin.
const MAINTENANT = new Date("2026-10-14T15:00:00Z");
const S: SessionCarte = {
  id: "11111111-1111-4111-8111-111111111111",
  titre: "Excel avancé : analyse de données",
  description: "Tableaux croisés dynamiques et graphiques.",
  debut: "2026-10-24T14:00:00Z",
  dureeMinutes: 60,
  plateforme: "Google Meet",
  lien: null,
  parcours: { nomCourt: "Académique", couleur: "academique" },
  animateur: "Dr Mireille Adjovi",
  inscriptions: 128,
  inscrit: false,
  statut: "programmee",
};

describe("La carte d'une session", () => {
  const rien = () => {};
  afterEach(() => vi.useRealTimers());

  it("la carte du design : OCT. 24, Académique, Session live, 128 inscriptions, date, plateforme, animateur", () => {
    render(<CarteSession session={S} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    const carte = screen.getByRole("article", { name: S.titre });
    for (const texte of ["OCT.", "24", "Académique", "Session live", "128 inscriptions", "Samedi 24 octobre · 15 h 00 (GMT+1)", "Google Meet", "Dr Mireille Adjovi", S.description]) {
      expect(within(carte).getByText(texte)).toBeInTheDocument();
    }
    expect(within(carte).getByRole("heading", { level: 3, name: S.titre })).toBeInTheDocument();
    expect(within(carte).getByRole("button", { name: "Je m’inscris" })).toBeInTheDocument();
    // Rejoindre est là dès maintenant, mais n'ouvre rien avant l'heure (tâche 10 du 31 octobre 2026).
    expect(within(carte).getByRole("button", { name: "Rejoindre" })).toBeInTheDocument();
    expect(within(carte).queryByRole("link", { name: "Rejoindre" })).toBeNull();
  });

  it("à l'heure de l'appareil : au Togo, le même live est à 14 h 00 (GMT)", () => {
    const options = Intl.DateTimeFormat.prototype.resolvedOptions;
    const espion = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...options.call(this), timeZone: "Africa/Lome" };
    });
    render(<CarteSession session={S} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    expect(screen.getByText("Samedi 24 octobre · 14 h 00 (GMT)")).toBeInTheDocument();
    espion.mockRestore();
  });

  it("Rejoindre avant l'heure n'ouvre rien : « Le live n'a pas encore commencé », et le temps qui reste", async () => {
    // Le temps qui reste se compte depuis l'instant du clic.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MAINTENANT);
    const user = userEvent.setup();
    const { unmount } = render(<CarteSession session={S} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    await user.click(screen.getByRole("button", { name: "Rejoindre" }));
    expect(screen.getByRole("status")).toHaveTextContent("Le live n’a pas encore commencé. Il commence dans 9 jours : samedi 24 octobre à 15 h 00 (GMT+1).");
    unmount();
    // Dans les 10 min d'avant, la base a déjà livré le lien : il ne s'ouvre pas pour autant.
    const bientot = { ...S, debut: "2026-10-14T15:05:00Z", lien: "https://meet.google.com/abc-defg-hij" };
    render(<CarteSession session={bientot} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    expect(screen.queryByRole("link", { name: "Rejoindre" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Rejoindre" }));
    expect(screen.getByRole("status")).toHaveTextContent("Il commence dans 5 min");
  });

  it("commencée, mais le lien pas encore reçu : le dire, sans rien ouvrir", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MAINTENANT);
    const user = userEvent.setup();
    render(<CarteSession session={{ ...S, debut: "2026-10-14T14:55:00Z" }} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    await user.click(screen.getByRole("button", { name: "Rejoindre" }));
    expect(screen.getByRole("status")).toHaveTextContent("Le lien du live arrive. Réessayez dans un instant.");
  });

  it("sans parcours : « Tous les parcours » ; inscrit : Inscription confirmée et Se désinscrire", () => {
    render(<CarteSession session={{ ...S, parcours: null, inscrit: true }} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    expect(screen.getByText("Tous les parcours")).toBeInTheDocument();
    expect(screen.getByText("Inscription confirmée")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se désinscrire" })).toBeInTheDocument();
    // Inscrit, avant le début : la session s'ajoute à Google Agenda depuis la carte aussi.
    expect(screen.getByRole("link", { name: "Ajouter à mon agenda" }).getAttribute("href")).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&/);
  });

  it("pas d'« Ajouter à mon agenda » sans inscription, ni une fois la session commencée", () => {
    const { unmount } = render(<CarteSession session={S} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    expect(screen.queryByRole("link", { name: "Ajouter à mon agenda" })).toBeNull();
    unmount();
    render(<CarteSession session={{ ...S, debut: "2026-10-14T14:55:00Z", inscrit: true }} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    expect(screen.queryByRole("link", { name: "Ajouter à mon agenda" })).toBeNull();
  });

  it("Rejoindre seulement avec un lien, dans un nouvel onglet ; En cours pendant ; Annulée sans bouton", () => {
    const enCours = { ...S, debut: "2026-10-14T14:55:00Z", lien: "https://meet.google.com/abc-defg-hij", inscrit: true };
    const { unmount } = render(<CarteSession session={enCours} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    const rejoindre = screen.getByRole("link", { name: "Rejoindre" });
    expect(rejoindre).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
    expect(rejoindre).toHaveAttribute("target", "_blank");
    expect(rejoindre).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("En cours")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Se désinscrire" })).toBeNull();
    unmount();
    render(<CarteSession session={{ ...S, statut: "annulee", inscrit: true }} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    expect(screen.getByText("Annulée")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("La page Événements", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MAINTENANT);
    vi.mocked(chargerSessions).mockReset().mockResolvedValue({ ok: true, sessions: [] });
    vi.mocked(sinscrire).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(seDesinscrire).mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.useRealTimers());

  it("l'en-tête ; Je m’inscris : sinscrire(id), la fenêtre « Inscription confirmée », Ajouter à mon agenda ouvre Google Agenda", async () => {
    const user = userEvent.setup();
    render(<PageEvenements initial={[S]} />);
    expect(screen.getByRole("heading", { level: 1, name: "Événements" })).toBeInTheDocument();
    expect(screen.getByText("Sessions live avec vos formateurs, sur Google Meet ou Zoom. Un rappel vous est envoyé la veille, 1 h avant et 10 min avant.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Je m’inscris" }));
    expect(sinscrire).toHaveBeenCalledWith(S.id);
    const fenetre = await screen.findByRole("dialog", { name: "Inscription confirmée" });
    expect(fenetre).toHaveTextContent(`${S.titre}, samedi 24 octobre à 15 h 00 (GMT+1), sur Google Meet. Un rappel vous sera envoyé la veille, 1 h avant et 10 min avant.`);
    const agenda = within(fenetre).getByRole("link", { name: "Ajouter à mon agenda" });
    expect(agenda.getAttribute("href")).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&.*dates=20261024T140000Z%2F20261024T150000Z/);
    expect(agenda).toHaveAttribute("target", "_blank");
    expect(agenda).toHaveAttribute("rel", "noopener noreferrer");
    expect(agenda).not.toHaveAttribute("download");
    // Les autres agendas (Apple, Outlook) : le fichier, avec son alerte 10 min avant.
    const ics = within(fenetre).getByRole("link", { name: "Autre agenda (.ics)" });
    expect(ics).toHaveAttribute("download", "etudium-session.ics");
    expect(decodeURIComponent(ics.getAttribute("href") ?? "")).toMatch(/^data:text\/calendar;charset=utf-8,BEGIN:VCALENDAR[\s\S]*DTSTART:20261024T140000Z[\s\S]*TRIGGER:-PT10M/);
    // La croix s'appelle aussi « Fermer » : le bouton du design est le dernier.
    await user.click(within(fenetre).getAllByRole("button", { name: "Fermer" }).at(-1)!);
    expect(screen.getByText("Inscription confirmée")).toBeInTheDocument();
    expect(screen.getByText("129 inscriptions")).toBeInTheDocument();
  });

  it("Se désinscrire : seDesinscrire(id) ; le refus s'affiche", async () => {
    const user = userEvent.setup();
    render(<PageEvenements initial={[{ ...S, inscrit: true }]} />);
    await user.click(screen.getByRole("button", { name: "Se désinscrire" }));
    expect(seDesinscrire).toHaveBeenCalledWith(S.id);
    expect(await screen.findByRole("button", { name: "Je m’inscris" })).toBeInTheDocument();
    vi.mocked(sinscrire).mockResolvedValue({ ok: false, message: "Les inscriptions à cette session sont closes." });
    await user.click(screen.getByRole("button", { name: "Je m’inscris" }));
    expect(await screen.findByText("Les inscriptions à cette session sont closes.")).toBeInTheDocument();
  });

  it("onglets : chargerSessions(\"inscriptions\"), chargerSessions(\"passees\") ; les trois états vides", async () => {
    const user = userEvent.setup();
    render(<PageEvenements initial={[]} />);
    expect(screen.getByText("Aucune session programmée")).toBeInTheDocument();
    expect(screen.getByText("Les prochaines sessions live apparaîtront ici.")).toBeInTheDocument();
    const filtres = screen.getByRole("group", { name: "Filtrer les événements" });
    await user.click(within(filtres).getByRole("button", { name: "Mes inscriptions" }));
    expect(chargerSessions).toHaveBeenLastCalledWith("inscriptions");
    expect(await screen.findByText("Aucune inscription pour le moment")).toBeInTheDocument();
    expect(screen.getByText("Inscrivez-vous à une session live pour la retrouver ici. Un rappel vous sera envoyé la veille, 1 h avant et 10 min avant.")).toBeInTheDocument();
    await user.click(within(filtres).getByRole("button", { name: "Passées" }));
    expect(chargerSessions).toHaveBeenLastCalledWith("passees");
    expect(await screen.findByText("Aucune session passée")).toBeInTheDocument();
    expect(screen.getByText("Les sessions de vos inscriptions apparaîtront ici une fois terminées.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voir les sessions à venir" }));
    expect(chargerSessions).toHaveBeenLastCalledWith("a_venir");
    expect(within(filtres).getByRole("button", { name: "À venir" })).toHaveAttribute("aria-pressed", "true");
  });

  it("page ouverte 15 min avant : à 10 min, l'onglet est relu (le lien arrive) ; Rejoindre ne l'ouvre qu'au début", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(MAINTENANT);
    const bientot = { ...S, debut: "2026-10-14T15:15:00Z" };
    vi.mocked(chargerSessions).mockResolvedValue({ ok: true, sessions: [{ ...bientot, lien: "https://meet.google.com/abc-defg-hij" }] });
    render(<PageEvenements initial={[bientot]} />);
    expect(screen.queryByRole("link", { name: "Rejoindre" })).toBeNull();
    await act(async () => {
      // 10 min avant le début, plus 2 s de marge pour une horloge un peu en avance.
      vi.advanceTimersByTime(5 * 60_000 + 2_000);
    });
    expect(chargerSessions).toHaveBeenCalledWith("a_venir");
    await act(async () => {});
    expect(screen.queryByRole("link", { name: "Rejoindre" })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(screen.getByRole("link", { name: "Rejoindre" })).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
  });

  it("page ouverte 2 h avant : Rejoindre finit par ouvrir le lien, au début", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(MAINTENANT);
    const tard = { ...S, debut: "2026-10-14T17:00:00Z" };
    vi.mocked(chargerSessions).mockResolvedValue({ ok: true, sessions: [{ ...tard, lien: "https://meet.google.com/abc-defg-hij" }] });
    render(<PageEvenements initial={[tard]} />);
    await act(async () => {
      vi.advanceTimersByTime(60 * 60_000);
    });
    await act(async () => {
      vi.advanceTimersByTime(50 * 60_000 + 2_000);
    });
    await act(async () => {});
    expect(chargerSessions).toHaveBeenCalledWith("a_venir");
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(screen.getByRole("link", { name: "Rejoindre" })).toBeInTheDocument();
  });

  it("horloge en avance : la base n'a pas encore ouvert le lien, la page relit 20 s plus tard", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(MAINTENANT);
    const bientot = { ...S, debut: "2026-10-14T15:15:00Z" };
    vi.mocked(chargerSessions)
      .mockResolvedValueOnce({ ok: true, sessions: [bientot] })
      .mockResolvedValue({ ok: true, sessions: [{ ...bientot, lien: "https://meet.google.com/abc-defg-hij" }] });
    render(<PageEvenements initial={[bientot]} />);
    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000 + 2_000);
    });
    await act(async () => {});
    expect(chargerSessions).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Rejoindre" })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    await act(async () => {});
    expect(chargerSessions).toHaveBeenCalledTimes(2);
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(screen.getByRole("link", { name: "Rejoindre" })).toBeInTheDocument();
  });

  it("retour sur l'onglet : la page relit l'onglet affiché", async () => {
    render(<PageEvenements initial={[S]} />);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(chargerSessions).toHaveBeenCalledWith("a_venir");
  });

  it("les cartes suivent le temps : En cours au début, plus de Se désinscrire ; plus de Rejoindre après la fin", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(MAINTENANT);
    const imminente = { ...S, debut: "2026-10-14T15:01:00Z", dureeMinutes: 30, lien: "https://meet.google.com/abc-defg-hij", inscrit: true };
    render(<PageEvenements initial={[imminente]} />);
    expect(screen.getByRole("button", { name: "Se désinscrire" })).toBeInTheDocument();
    expect(screen.queryByText("En cours")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(60_000 + 2_000);
    });
    expect(screen.getByText("En cours")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Se désinscrire" })).toBeNull();
    expect(screen.getByRole("link", { name: "Rejoindre" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(30 * 60_000);
    });
    expect(screen.queryByRole("link", { name: "Rejoindre" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rejoindre" })).toBeNull();
  });

  it("avant la 0018 : le bandeau", async () => {
    vi.mocked(lireSessions).mockResolvedValue({ migrationAbsente: true });
    render(await ContenuEvenements());
    expect(screen.getByText("Les sessions live ne sont pas encore dans la base.")).toBeInTheDocument();
    expect(screen.getByText("Appliquez la migration 0018 (guide « Ce qui te revient », section 23).")).toBeInTheDocument();
  });
});
