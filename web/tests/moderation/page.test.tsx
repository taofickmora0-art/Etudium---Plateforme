// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ElementFile, EtatModeration } from "@/lib/moderation/types";

// La file de modération du back-office (spec de la modération, §5).

vi.mock("@/lib/moderation/actions", () => ({
  chargerFile: vi.fn(),
  garderContenu: vi.fn(),
  supprimerContenu: vi.fn(),
  retablirPublication: vi.fn(),
  reglerAnalyse: vi.fn(),
}));
vi.mock("@/lib/moderation/data", () => ({ lireEtatModeration: vi.fn(), lireFileModeration: vi.fn(), lireNombreAExaminer: vi.fn() }));

const actions = await import("@/lib/moderation/actions");
const { fixerDomaines } = await import("@/lib/auth/domaines-du-compte");

// La file vue par un admin : le nom de l'auteur mène à sa fiche (lot 6 A ; le modérateur : tests/admin/acces-moderateur).
fixerDomaines(["communaute", "contenus", "utilisateurs", "paiements", "statistiques"]);
const { lireEtatModeration, lireFileModeration } = await import("@/lib/moderation/data");
const { PageModeration } = await import("@/components/admin/moderation/PageModeration");
const { ContenuModeration } = await import("@/components/admin/moderation/ContenuModeration");

const ID = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const element = (o: Partial<ElementFile> = {}): ElementFile => ({
  type: "publication",
  id: ID,
  publicationId: ID,
  espace: { id: P, nom: "Académique" },
  auteur: { id: "a1", prenom: "Jules", nom: "Kossou" },
  creeLe: "2026-10-14T13:00:00Z",
  titre: "Gagnez vite",
  texte: "Cliquez ici",
  pieceJointe: { chemin: "a1/x.png", nom: "x.png", type: "image/png", taille: 1000, url: "https://stockage/x.png" },
  video: null,
  statut: "publiee",
  analyse: { decision: "signaler", categorie: "arnaque", raison: "Lien suspect" },
  extrait: null,
  signalements: {
    nombre: 3,
    motifs: [
      { motif: "spam", nombre: 2 },
      { motif: "harcelement", nombre: 1 },
    ],
    details: [{ motif: "spam", precisions: "Pub", par: "Koffi D.", le: "2026-10-14T13:30:00Z" }],
  },
  ...o,
});
const REPONSE = element({
  type: "reponse",
  id: "r1",
  auteur: { id: "a2", prenom: "Awa", nom: "Kpadé" },
  titre: "",
  texte: "Une insulte",
  pieceJointe: null,
  analyse: null,
  extrait: "Une question sur Excel",
  signalements: { nombre: 1, motifs: [{ motif: "harcelement", nombre: 1 }], details: [{ motif: "harcelement", precisions: "", par: "Koffi D.", le: "2026-10-14T13:30:00Z" }] },
});
const ATTENTE = element({ id: "p3", auteur: { id: "a3", prenom: "Brice", nom: "Lokossou" }, statut: "en_attente", analyse: null, pieceJointe: null, signalements: { nombre: 0, motifs: [], details: [] } });
const ETAT: EtatModeration = { active: true, cle: true, jeton: "reconnu", derniereAnalyse: "2026-10-14T13:00:00Z", enAttente: 0 };

const afficher = (ui: ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
const page = (initial: ElementFile[], etat: EtatModeration = ETAT) => afficher(<PageModeration initial={initial} nombre={initial.length} etat={etat} />);
const bloc = () => screen.getByRole("region", { name: "Analyse automatique" });
const onglet = (nom: string | RegExp) => within(screen.getByRole("group", { name: "Choisir la liste" })).getByRole("button", { name: nom });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T15:00:00Z"));
  for (const f of Object.values(actions)) vi.mocked(f).mockReset();
});
afterEach(() => vi.useRealTimers());

describe("Le bloc « Analyse automatique »", () => {
  it("inactive : la clé et le jeton du serveur ; Activer seulement si les deux sont là", async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = page([], { active: false, cle: false, jeton: "absent", derniereAnalyse: null, enAttente: 0 });
    expect(within(bloc()).getByText("Inactive : les publications paraissent sans vérification.")).toBeInTheDocument();
    expect(within(bloc()).getByText("Clé de l’IA : absente")).toBeInTheDocument();
    expect(within(bloc()).getByText("Jeton de modération : absent")).toBeInTheDocument();
    expect(within(bloc()).getByText("Pour l’activer : ajoutez la clé de l’IA et le jeton de modération aux variables d’environnement du site.")).toBeInTheDocument();
    expect(within(bloc()).queryByRole("button", { name: "Activer l’analyse automatique" })).toBeNull();
    unmount();
    const deux = page([], { active: false, cle: true, jeton: "non_reconnu", derniereAnalyse: null, enAttente: 0 });
    expect(within(bloc()).getByText("Clé de l’IA : présente")).toBeInTheDocument();
    expect(within(bloc()).getByText("Jeton de modération : non reconnu")).toBeInTheDocument();
    expect(within(bloc()).queryByRole("button", { name: "Activer l’analyse automatique" })).toBeNull();
    deux.unmount();
    vi.mocked(actions.reglerAnalyse).mockResolvedValueOnce({ ok: true });
    page([], { active: false, cle: true, jeton: "reconnu", derniereAnalyse: null, enAttente: 0 });
    await user.click(within(bloc()).getByRole("button", { name: "Activer l’analyse automatique" }));
    expect(actions.reglerAnalyse).toHaveBeenCalledWith(true);
    expect(await within(bloc()).findByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Analyse automatique activée")).toBeInTheDocument();
  });

  it("active : Désactiver, confirmé ; des publications en attente : l'avertissement", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(actions.reglerAnalyse).mockResolvedValueOnce({ ok: true });
    page([], { ...ETAT, enAttente: 2 });
    expect(within(bloc()).getByText("2 publications attendent : l’analyse n’a pas pu les vérifier. Vérifiez la clé de l’IA et le jeton de modération.")).toBeInTheDocument();
    expect(within(bloc()).getByText("Clé de l’IA : présente")).toBeInTheDocument();
    expect(within(bloc()).getByText("Jeton de modération : reconnu")).toBeInTheDocument();
    await user.click(within(bloc()).getByRole("button", { name: "Désactiver" }));
    const fenetre = screen.getByRole("dialog", { name: "Désactiver l’analyse automatique ?" });
    expect(within(fenetre).getByText("Les publications paraîtront sans vérification.")).toBeInTheDocument();
    await user.click(within(fenetre).getByRole("button", { name: "Désactiver" }));
    expect(actions.reglerAnalyse).toHaveBeenCalledWith(false);
    expect(await within(bloc()).findByText("Inactive : les publications paraissent sans vérification.")).toBeInTheDocument();
    expect(screen.getByText("Analyse automatique désactivée")).toBeInTheDocument();
  });
});

describe("Le bloc actif mal configuré", () => {
  it("clé absente ou jeton non reconnu : l'avertissement, les publications attendent l'équipe", () => {
    const { unmount } = page([], { ...ETAT, cle: false });
    expect(within(bloc()).getByText("Clé de l’IA : absente")).toBeInTheDocument();
    expect(within(bloc()).getByText("L’analyse ne peut pas fonctionner : les nouvelles publications attendent l’équipe. Vérifiez la clé de l’IA et le jeton de modération.")).toBeInTheDocument();
    unmount();
    page([], { ...ETAT, jeton: "non_reconnu" });
    expect(within(bloc()).getByText("Jeton de modération : non reconnu")).toBeInTheDocument();
    expect(within(bloc()).getByText(/L’analyse ne peut pas fonctionner/)).toBeInTheDocument();
  });
});

describe("La file", () => {
  it("les éléments : auteur, espace, raisons (analyse, signalements comptés, précisions), fichier, publication", () => {
    page([element(), REPONSE, ATTENTE, element({ id: "p4", auteur: { id: "a4", prenom: "Rodrigue", nom: "H" }, analyse: { decision: "echec", categorie: "aucune", raison: "Analyse impossible : délai dépassé." }, signalements: { nombre: 0, motifs: [], details: [] } })]);
    expect(onglet("À examiner (4)")).toHaveAttribute("aria-pressed", "true");
    const pub = screen.getByRole("article", { name: "Publication de Jules Kossou" });
    expect(within(pub).getByRole("link", { name: "Jules Kossou" })).toHaveAttribute("href", "/admin/utilisateurs/a1");
    expect(within(pub).getByText("Publication").querySelector("svg")).toBeNull();
    expect(within(pub).getByText("Espace Académique · il y a 2 h")).toBeInTheDocument();
    expect(within(pub).getByText("Gagnez vite")).toBeInTheDocument();
    expect(within(pub).getByText("Cliquez ici")).toBeInTheDocument();
    expect(within(pub).getByText("Analyse automatique : Arnaque — Lien suspect")).toBeInTheDocument();
    expect(within(pub).getByText("Signalée par 3 membres : Spam ou publicité (2), Harcèlement (1)")).toBeInTheDocument();
    expect(within(pub).getByText("Koffi D. · Spam ou publicité : Pub")).toBeInTheDocument();
    expect(within(pub).getByRole("link", { name: "x.png" })).toHaveAttribute("href", "https://stockage/x.png");
    expect(within(pub).getByRole("link", { name: "Ouvrir la publication" })).toHaveAttribute("href", `/communaute/publications/${ID}`);
    const reponse = screen.getByRole("article", { name: "Réponse de Awa Kpadé" });
    expect(within(reponse).getByText("En réponse à « Une question sur Excel »")).toBeInTheDocument();
    expect(within(reponse).getByText("Signalée par 1 membre : Harcèlement (1)")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Publication de Brice Lokossou" })).getByText("En attente : non analysée")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Publication de Rodrigue H" })).getByText("Analyse impossible : délai dépassé.")).toBeInTheDocument();
  });

  it("un commentaire de leçon (0028) : son étiquette, la leçon, son lien ; Garder vise le commentaire", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(actions.garderContenu).mockResolvedValueOnce({ ok: true });
    const commentaire = element({
      type: "commentaire_lecon",
      id: "c7",
      publicationId: "",
      lien: "/formations/excel/lecons/l1#commentaire-c7",
      espace: { id: null, nom: "Maîtriser Excel" },
      titre: "",
      extrait: "Installer les outils",
      pieceJointe: null,
      analyse: null,
    });
    page([commentaire]);
    const carte = screen.getByRole("article", { name: "Commentaire de leçon de Jules Kossou" });
    expect(within(carte).getByText("Commentaire de leçon")).toBeInTheDocument();
    expect(within(carte).getByText("Sous la leçon « Installer les outils »")).toBeInTheDocument();
    expect(within(carte).getByRole("link", { name: "Ouvrir la leçon" })).toHaveAttribute("href", "/formations/excel/lecons/l1#commentaire-c7");
    await user.click(within(carte).getByRole("button", { name: "Garder" }));
    expect(actions.garderContenu).toHaveBeenCalledWith({ commentaireLeconId: "c7" });
  });

  it("Garder et Supprimer (confirmé) ; Bloquées : Rétablir", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(actions.garderContenu).mockResolvedValueOnce({ ok: true });
    vi.mocked(actions.supprimerContenu).mockResolvedValueOnce({ ok: true });
    page([element(), REPONSE]);
    await user.click(within(screen.getByRole("article", { name: "Publication de Jules Kossou" })).getByRole("button", { name: "Garder" }));
    expect(actions.garderContenu).toHaveBeenCalledWith({ publicationId: ID });
    await waitFor(() => expect(screen.queryByRole("article", { name: "Publication de Jules Kossou" })).toBeNull());
    expect(onglet("À examiner (1)")).toBeInTheDocument();
    expect(screen.getByText("Contenu gardé")).toBeInTheDocument();

    await user.click(within(screen.getByRole("article", { name: "Réponse de Awa Kpadé" })).getByRole("button", { name: "Supprimer" }));
    const fenetre = screen.getByRole("dialog", { name: "Supprimer ce contenu ?" });
    expect(within(fenetre).getByText("Il disparaîtra de la communauté et son auteur sera prévenu.")).toBeInTheDocument();
    await user.click(within(fenetre).getByRole("button", { name: "Supprimer" }));
    expect(actions.supprimerContenu).toHaveBeenCalledWith({ reponseId: "r1" });
    await waitFor(() => expect(screen.queryByRole("article", { name: "Réponse de Awa Kpadé" })).toBeNull());
    expect(screen.getByText("Contenu supprimé")).toBeInTheDocument();
    expect(screen.getByText("Rien à examiner")).toBeInTheDocument();
    expect(screen.getByText("Les publications signalées par l’analyse ou par les membres apparaîtront ici.")).toBeInTheDocument();

    const bloquee = element({ id: "p9", statut: "bloquee", analyse: { decision: "bloquer", categorie: "arnaque", raison: "Demande d’argent" }, signalements: { nombre: 0, motifs: [], details: [] } });
    vi.mocked(actions.chargerFile).mockResolvedValueOnce({ ok: true, elements: [bloquee] });
    vi.mocked(actions.retablirPublication).mockResolvedValueOnce({ ok: true });
    await user.click(onglet("Bloquées"));
    expect(actions.chargerFile).toHaveBeenCalledWith("bloquees");
    const carte = await screen.findByRole("article", { name: "Publication de Jules Kossou" });
    expect(within(carte).getByText("Analyse automatique : Arnaque — Demande d’argent")).toBeInTheDocument();
    expect(within(carte).queryByRole("button", { name: "Garder" })).toBeNull();
    await user.click(within(carte).getByRole("button", { name: "Rétablir" }));
    expect(actions.retablirPublication).toHaveBeenCalledWith("p9");
    expect(await screen.findByText("Publication rétablie")).toBeInTheDocument();
    expect(screen.getByText("Aucune publication bloquée")).toBeInTheDocument();
    expect(screen.getByText("Les publications refusées par l’analyse automatique apparaîtront ici.")).toBeInTheDocument();
  });

  it("une action refusée : le message, l'élément reste", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(actions.garderContenu).mockResolvedValueOnce({ ok: false, message: "Ce contenu n’existe plus." });
    page([element()]);
    await user.click(screen.getByRole("button", { name: "Garder" }));
    expect(await screen.findByText("Ce contenu n’existe plus.")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Publication de Jules Kossou" })).toBeInTheDocument();
  });

  it("avant la 0020 : le bandeau", async () => {
    vi.mocked(lireEtatModeration).mockResolvedValue({ migrationAbsente: true });
    vi.mocked(lireFileModeration).mockResolvedValue({ migrationAbsente: true });
    afficher(await ContenuModeration());
    expect(screen.getByText("La modération n’est pas encore dans la base.")).toBeInTheDocument();
    expect(screen.getByText("Appliquez la migration 0020 (guide « Ce qui te revient », section 25).")).toBeInTheDocument();
  });

  it("une publication avec une vidéo : la vidéo est montrée à l'équipe (revue finale)", () => {
    page([element({ video: { plateforme: "youtube", id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ" } })]);
    expect(screen.getByRole("button", { name: "Lire la vidéo YouTube" })).toBeInTheDocument();
  });
});
