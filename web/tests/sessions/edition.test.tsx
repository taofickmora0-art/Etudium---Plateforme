// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { LigneSessionEdition, SessionDetail } from "@/lib/sessions/types";
import { choisirDansListe, optionsDeLaListe } from "../utilitaires/listes";

// Programmer et suivre ses sessions : espace formateur et back-office (spec des sessions live, §4).

const creerSession = vi.fn();
const modifierSession = vi.fn();
const annulerSession = vi.fn();
vi.mock("@/lib/sessions/actions", () => ({
  creerSession: (...a: unknown[]) => creerSession(...a),
  modifierSession: (...a: unknown[]) => modifierSession(...a),
  annulerSession: (...a: unknown[]) => annulerSession(...a),
}));
const lireSessionDetail = vi.fn();
const lireSessionsAnimees = vi.fn();
const lireSessionsEquipe = vi.fn();
vi.mock("@/lib/sessions/data", () => ({
  lireSessionDetail: (...a: unknown[]) => lireSessionDetail(...a),
  lireSessionsAnimees: () => lireSessionsAnimees(),
  lireSessionsEquipe: () => lireSessionsEquipe(),
}));
const lireMaFiche = vi.fn();
vi.mock("@/lib/formateur/data", () => ({ lireMaFiche: () => lireMaFiche() }));
const routeur = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routeur,
  usePathname: () => "/formateur/sessions",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { ListeSessionsEdition } = await import("@/components/sessions/ListeSessionsEdition");
const { FormulaireSession } = await import("@/components/sessions/FormulaireSession");
const { FicheSession } = await import("@/components/sessions/FicheSession");
const { PageSessionsEdition } = await import("@/components/sessions/PageSessionsEdition");

const ID = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const FICHE = "33333333-3333-4333-8333-333333333333";
const MAINTENANT = new Date("2026-10-14T15:00:00Z");
const ligne = (o: Partial<LigneSessionEdition> = {}): LigneSessionEdition => ({
  id: ID,
  titre: "Excel avancé",
  debut: "2026-10-24T14:00:00Z",
  dureeMinutes: 60,
  plateforme: "Google Meet",
  statut: "programmee",
  inscriptions: 12,
  parcours: null,
  animateur: "Mireille Akpo",
  ...o,
});
const DETAIL: SessionDetail = {
  id: ID,
  titre: "Excel avancé",
  description: "Analyse de données",
  debut: "2026-10-24T14:00:00Z",
  dureeMinutes: 90,
  plateforme: "Google Meet",
  lien: "https://meet.google.com/abc-defg-hij",
  parcours: { id: P, nomCourt: "Académique", couleur: "academique" },
  formateurId: FICHE,
  animateur: "Mireille Akpo",
  statut: "programmee",
  annuleeLe: null,
  inscrits: [{ prenom: "Fifamè", nom: "Adjovi" }],
  promoImage: null,
  promoVideo: null,
};
const PARCOURS = [{ id: P, nomCourt: "Académique" }];
const avecToast = (enfant: React.ReactNode) => render(<ToastProvider>{enfant}</ToastProvider>);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MAINTENANT);
  for (const f of [creerSession, modifierSession, annulerSession, lireSessionDetail, lireSessionsAnimees, lireSessionsEquipe, lireMaFiche, routeur.push]) f.mockReset();
  creerSession.mockResolvedValue({ ok: true, id: ID });
  modifierSession.mockResolvedValue({ ok: true });
  annulerSession.mockResolvedValue({ ok: true });
  lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: FICHE });
});
afterEach(() => vi.useRealTimers());

describe("La liste des sessions", () => {
  it("à venir et passées : date, titre (lien vers la fiche), plateforme, inscriptions, état ; Nouvelle session", () => {
    render(
      <ListeSessionsEdition
        espace="formateur"
        liste={{ aVenir: [ligne(), ligne({ id: "a2", titre: "Annulée", statut: "annulee" }), ligne({ id: "a3", titre: "En direct", debut: "2026-10-14T14:30:00Z" })], passees: [ligne({ id: "p1", titre: "Word", debut: "2026-10-01T14:00:00Z" })] }}
      />,
    );
    expect(screen.getByRole("link", { name: "Nouvelle session" })).toHaveAttribute("href", "/formateur/sessions/nouvelle");
    const aVenir = screen.getByRole("table", { name: "Sessions à venir" });
    expect(within(aVenir).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Date", "Titre", "Plateforme", "Inscriptions", "État"]);
    const [premiere, annulee, enDirect] = within(aVenir).getAllByRole("row").slice(1);
    expect(within(premiere).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Samedi 24 octobre · 15 h 00 (GMT+1)", "Excel avancé", "Google Meet", "12", "Programmée"]);
    expect(within(premiere).getByRole("link", { name: "Excel avancé" })).toHaveAttribute("href", `/formateur/sessions/${ID}`);
    expect(annulee).toHaveTextContent("Annulée");
    expect(enDirect).toHaveTextContent("En cours");
    expect(within(screen.getByRole("table", { name: "Sessions passées" })).getByRole("link", { name: "Word" })).toHaveAttribute("href", "/formateur/sessions/p1");
  });

  it("au back-office : la colonne Animateur et les adresses du back-office ; vide : Aucune session programmée.", () => {
    const { unmount } = render(<ListeSessionsEdition espace="admin" liste={{ aVenir: [ligne({ animateur: "Équipe Étudium" })], passees: [] }} />);
    expect(within(screen.getByRole("table", { name: "Sessions à venir" })).getAllByRole("columnheader").map((c) => c.textContent)).toContain("Animateur");
    expect(screen.getByText("Équipe Étudium")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Excel avancé" })).toHaveAttribute("href", `/admin/sessions/${ID}`);
    unmount();
    render(<ListeSessionsEdition espace="formateur" liste={{ aVenir: [], passees: [] }} />);
    expect(screen.getByText("Aucune session programmée.")).toBeInTheDocument();
  });

  it("au back-office : toutes les sessions (sessions_equipe), sans fiche formateur à vérifier", async () => {
    lireSessionsEquipe.mockResolvedValue({ migrationAbsente: false, donnees: { aVenir: [ligne({ animateur: "Équipe Étudium" })], passees: [] } });
    render(await PageSessionsEdition({ espace: "admin" }));
    expect(screen.getByRole("heading", { level: 1, name: "Sessions live" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nouvelle session" })).toHaveAttribute("href", "/admin/sessions/nouvelle");
    expect(lireMaFiche).not.toHaveBeenCalled();
    expect(lireSessionsAnimees).not.toHaveBeenCalled();
  });

  it("avant la 0018 et sans fiche formateur : les bandeaux", async () => {
    lireSessionsAnimees.mockResolvedValue({ migrationAbsente: true });
    const { unmount } = render(await PageSessionsEdition({ espace: "formateur" }));
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
    expect(screen.queryByText(/Appliquez la migration/)).toBeNull();
    unmount();
    lireMaFiche.mockResolvedValue({ migrationAbsente: false, fiche: null });
    render(await PageSessionsEdition({ espace: "formateur" }));
    expect(screen.getByText("Votre compte n’est pas encore relié à une fiche formateur. Contactez l’équipe Étudium.")).toBeInTheDocument();
  });
});

describe("Le formulaire", () => {
  const remplir = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText("Titre"), "Excel avancé");
    await user.type(screen.getByLabelText("Date"), "2026-10-24");
    await user.type(screen.getByLabelText("Heure"), "15:00");
    await user.type(screen.getByLabelText("Lien du live"), "https://meet.google.com/abc-defg-hij");
  };

  it("le formateur : pas d'animateur à choisir ; Programmer la session appelle creerSession puis ouvre la fiche", async () => {
    const user = userEvent.setup({ delay: null });
    render(<FormulaireSession espace="formateur" parcours={PARCOURS} />);
    expect(screen.queryByLabelText("Animateur")).toBeNull();
    expect(screen.getByLabelText("Durée")).toHaveTextContent(/^1 h$/);
    await remplir(user);
    await choisirDansListe(screen.getByLabelText("Parcours"), "Académique", { user });
    await user.click(screen.getByRole("button", { name: "Programmer la session" }));
    expect(creerSession).toHaveBeenCalledWith({
      titre: "Excel avancé",
      description: "",
      date: "2026-10-24",
      heure: "15:00",
      // Saisies à l'heure de l'appareil (tâche 10 du 31 octobre 2026) : ici, celle du Bénin.
      fuseau: "Africa/Porto-Novo",
      dureeMinutes: 60,
      lien: "https://meet.google.com/abc-defg-hij",
      parcoursId: P,
      formateurId: null,
      espace: "formateur",
      // Sans visuel de promotion (spec promotion des sessions live, §1).
      image: null,
      video: null,
    });
    expect(routeur.push).toHaveBeenCalledWith(`/formateur/sessions/${ID}`);
  });

  it("une donnée invalide est refusée sans appel ; le refus de la base s'affiche", async () => {
    const user = userEvent.setup({ delay: null });
    render(<FormulaireSession espace="formateur" parcours={PARCOURS} />);
    await remplir(user);
    await user.clear(screen.getByLabelText("Lien du live"));
    await user.type(screen.getByLabelText("Lien du live"), "http://meet.google.com/x");
    await user.click(screen.getByRole("button", { name: "Programmer la session" }));
    expect(screen.getByText("Le lien doit commencer par https://")).toBeInTheDocument();
    expect(creerSession).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Lien du live"));
    await user.type(screen.getByLabelText("Lien du live"), "https://zoom.us/j/1");
    creerSession.mockResolvedValue({ ok: false, message: "Accès réservé aux formateurs et à l’équipe." });
    await user.click(screen.getByRole("button", { name: "Programmer la session" }));
    expect(await screen.findByText("Accès réservé aux formateurs et à l’équipe.")).toBeInTheDocument();
  });

  it("au back-office : l'animateur, Équipe Étudium ou une fiche", async () => {
    const user = userEvent.setup({ delay: null });
    render(<FormulaireSession espace="admin" parcours={PARCOURS} formateurs={[{ id: FICHE, nom: "Mireille Akpo" }]} />);
    const animateur = screen.getByLabelText("Animateur");
    expect(await optionsDeLaListe(animateur, { user })).toEqual(["Équipe Étudium", "Mireille Akpo"]);
    expect(animateur).toHaveTextContent("Équipe Étudium");
    await remplir(user);
    await choisirDansListe(animateur, "Mireille Akpo", { user });
    await user.click(screen.getByRole("button", { name: "Programmer la session" }));
    expect(creerSession).toHaveBeenCalledWith(expect.objectContaining({ formateurId: FICHE, parcoursId: null }));
    expect(routeur.push).toHaveBeenCalledWith(`/admin/sessions/${ID}`);
  });

  it("modification : les champs repris (heure du Bénin) ; Enregistrer appelle modifierSession", async () => {
    const user = userEvent.setup({ delay: null });
    render(<FormulaireSession espace="formateur" parcours={PARCOURS} initial={DETAIL} />);
    expect(screen.getByLabelText("Date")).toHaveValue("24/10/2026");
    expect(screen.getByLabelText("Heure")).toHaveValue("15:00");
    expect(screen.getByLabelText("Durée")).toHaveTextContent("1 h 30");
    expect(screen.getByLabelText("Parcours")).toHaveTextContent("Académique");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(modifierSession).toHaveBeenCalledWith(ID, expect.objectContaining({ titre: "Excel avancé", date: "2026-10-24", heure: "15:00", dureeMinutes: 90 }));
    expect(routeur.push).toHaveBeenCalledWith(`/formateur/sessions/${ID}`);
  });
});

describe("La fiche d'une session", () => {
  it("le lien, les inscriptions (prénom nom, jamais d'e-mail), Modifier, Annuler la session", async () => {
    lireSessionDetail.mockResolvedValue({ migrationAbsente: false, donnees: DETAIL });
    const user = userEvent.setup({ delay: null });
    avecToast(await FicheSession({ espace: "formateur", id: ID }));
    expect(screen.getByRole("heading", { level: 1, name: "Excel avancé" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://meet.google.com/abc-defg-hij" })).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
    expect(screen.getByText("Samedi 24 octobre · 15 h 00 (GMT+1)")).toBeInTheDocument();
    const inscriptions = screen.getByRole("region", { name: "Inscriptions" });
    expect(within(inscriptions).getByText("Fifamè Adjovi")).toBeInTheDocument();
    expect(inscriptions.textContent).not.toContain("@");
    expect(screen.getByRole("link", { name: "Modifier" })).toHaveAttribute("href", `/formateur/sessions/${ID}/modifier`);
    await user.click(screen.getByRole("button", { name: "Annuler la session" }));
    const fenetre = screen.getByRole("dialog", { name: "Annuler cette session ?" });
    expect(fenetre).toHaveTextContent("La personne inscrite sera prévenue. Elle ne pourra pas être reprogrammée.");
    await user.click(within(fenetre).getByRole("button", { name: "Annuler la session" }));
    expect(annulerSession).toHaveBeenCalledWith(ID);
  });

  it("terminée : ni Modifier ni Annuler ; aucune inscription ; introuvable : page introuvable", async () => {
    lireSessionDetail.mockResolvedValue({ migrationAbsente: false, donnees: { ...DETAIL, debut: "2026-10-01T14:00:00Z", inscrits: [] } });
    avecToast(await FicheSession({ espace: "admin", id: ID }));
    expect(screen.queryByRole("link", { name: "Modifier" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Annuler la session" })).toBeNull();
    expect(screen.getByText("Aucune inscription pour l’instant.")).toBeInTheDocument();
    lireSessionDetail.mockResolvedValue({ migrationAbsente: false, donnees: null });
    await expect(FicheSession({ espace: "admin", id: ID })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
