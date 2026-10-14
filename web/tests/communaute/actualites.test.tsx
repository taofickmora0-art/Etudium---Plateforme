// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ShellUser } from "@/lib/auth/current-user";
import type { Annonce, Espace, LotPublications, MoiCommunaute, Publication } from "@/lib/communaute/types";

// Le fil « Actualités » (spec du 14 octobre 2026, §1 à §5 ; design NdCommunaute v6) : l'annonce épinglée, les liens et
// leurs aperçus, la vidéo YouTube au clic, le tri, le signet, les initiales des J’aime, le champ fermé.

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
let recherche = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(recherche), unstable_rethrow: () => undefined }));
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
  basculerEnregistrement: vi.fn(),
}));
vi.mock("@/lib/communaute/data", () => ({
  lireEspaces: vi.fn(),
  lireFil: vi.fn(),
  lirePublication: vi.fn(),
  lireTendances: vi.fn(),
  lireActivites: vi.fn(),
  lireAnalyseActive: vi.fn(async () => false),
}));
vi.mock("@/lib/communaute/annonce", () => ({ lireAnnonce: vi.fn() }));
vi.mock("@/lib/sessions/data", () => ({ lireProchaineSession: vi.fn(async () => ({ migrationAbsente: false, donnees: null })) }));
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: vi.fn(), getAuthUser: vi.fn(), demoModeActive: () => false }));

const actions = await import("@/lib/communaute/actions");
const { lireActivites, lireEspaces, lireFil, lireTendances } = await import("@/lib/communaute/data");
const { lireAnnonce } = await import("@/lib/communaute/annonce");
const { getAuthUser, getShellUser } = await import("@/lib/auth/current-user");
const { ContenuCommunaute } = await import("@/components/communaute/ContenuCommunaute");
const { PageCommunaute } = await import("@/components/communaute/PageCommunaute");

const P = "22222222-2222-4222-8222-222222222222";
const VIDEO = "dQw4w9WgXcQ";
const ESPACES: Espace[] = [
  { id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true },
  { id: P, nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", slug: "reussite-academique", ouvert: true },
];
const MOI: MoiCommunaute = { compteId: "compte-1", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const ANNONCE: Annonce = { titre: "Bienvenue dans la communauté Étudium !", texte: "Cinq minutes pour bien démarrer.", media: "youtube", youtubeId: VIDEO, image: null };

const pub = (o: Partial<Publication> = {}): Publication => ({
  id: "p1",
  auteur: { prenom: "Mireille", nom: "Adjovi", role: "formateur" },
  estMoi: false,
  espace: { id: P, nom: "Académique" },
  titre: "",
  texte: "Le texte",
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
  ...o,
});
const lot = (publications: Publication[], suite = false): LotPublications => ({ publications, suite });
const afficher = (ui: ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
const page = (initial: LotPublications, o: { annonce?: Annonce | null; moi?: MoiCommunaute } = {}) =>
  afficher(<PageCommunaute espaces={ESPACES} initial={initial} moi={o.moi ?? MOI} annonce={o.annonce ?? null} />);
const carte = (nom = "Mireille Adjovi") => screen.getByRole("article", { name: `Publication de ${nom}` });
const onglet = (nom: string) => within(screen.getByRole("group", { name: "Choisir un espace" })).getByRole("button", { name: nom });
const annonce = () => screen.queryByRole("article", { name: "Annonce de l’équipe Étudium" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T15:00:00Z"));
  for (const f of Object.values(actions)) vi.mocked(f).mockReset();
  recherche = "";
});
afterEach(() => vi.useRealTimers());

describe("L'annonce épinglée", () => {
  it("en tête des Actualités : l'étiquette, le titre, le texte ; la vidéo se charge au clic, sans cookies ; absente de Général", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(actions.chargerFil).mockResolvedValue({ ok: true, lot: lot([]) });
    page(lot([pub()]), { annonce: ANNONCE });
    const carteAnnonce = annonce()!;
    expect(within(carteAnnonce).getByText("Annonce épinglée")).toBeInTheDocument();
    expect(within(carteAnnonce).getByRole("heading", { level: 2, name: "Bienvenue dans la communauté Étudium !" })).toBeInTheDocument();
    expect(within(carteAnnonce).getByText("Cinq minutes pour bien démarrer.")).toBeInTheDocument();
    // Hors de l'équipe : pas de réglage.
    expect(within(carteAnnonce).queryByRole("link", { name: "Gérer l’annonce" })).toBeNull();
    expect(carteAnnonce.querySelector("iframe")).toBeNull();
    await user.click(within(carteAnnonce).getByRole("button", { name: "Lire la vidéo" }));
    const lecteur = within(carteAnnonce).getByTitle("Vidéo YouTube");
    expect(lecteur).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${VIDEO}?autoplay=1`);

    await user.click(onglet("Général"));
    expect(annonce()).toBeNull();
    await user.click(onglet("Actualités"));
    expect(annonce()).not.toBeNull();
  });

  it("une affiche : l'image ; pour l'équipe, ⋮ « Gérer l’annonce » vers le back-office", () => {
    page(lot([]), { annonce: { ...ANNONCE, media: "image", youtubeId: null, image: "https://stockage/affiche.png" }, moi: { ...MOI, equipe: true } });
    const carteAnnonce = annonce()!;
    expect(carteAnnonce.querySelector("img")).toHaveAttribute("src", "https://stockage/affiche.png");
    expect(within(carteAnnonce).queryByRole("button", { name: "Lire la vidéo" })).toBeNull();
    expect(within(carteAnnonce).getByRole("link", { name: "Gérer l’annonce" })).toHaveAttribute("href", "/admin/communaute");
  });

  it("la page lit l'annonce et le rôle du compte", async () => {
    vi.mocked(lireEspaces).mockResolvedValue({ migrationAbsente: false, donnees: ESPACES });
    vi.mocked(lireFil).mockResolvedValue({ migrationAbsente: false, donnees: lot([]) });
    vi.mocked(lireTendances).mockResolvedValue({ migrationAbsente: false, donnees: [] });
    vi.mocked(lireActivites).mockResolvedValue({ migrationAbsente: false, donnees: [] });
    vi.mocked(lireAnnonce).mockResolvedValue(ANNONCE);
    vi.mocked(getShellUser).mockResolvedValue({ prenom: "Awa", nom: "Kpadé", initials: "AK", roles: ["etudiant", "admin"], photoUrl: null } as unknown as ShellUser);
    vi.mocked(getAuthUser).mockResolvedValue({ id: "compte-2" } as Awaited<ReturnType<typeof getAuthUser>>);
    afficher(await ContenuCommunaute());
    expect(within(annonce()!).getByRole("link", { name: "Gérer l’annonce" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quoi de neuf, Awa ?" })).toBeInTheDocument();
  });
});

describe("Les liens et les aperçus", () => {
  it("chaque adresse du texte devient un lien (nouvel onglet, noopener nofollow ugc) ; la ponctuation qui suit reste du texte", () => {
    page(lot([pub({ texte: "Rejoignez-nous ici : https://meet.google.com/coj-aymk-rwe. À tout de suite !" })]));
    const lien = within(carte()).getByRole("link", { name: "https://meet.google.com/coj-aymk-rwe" });
    expect(lien).toHaveAttribute("href", "https://meet.google.com/coj-aymk-rwe");
    expect(lien).toHaveAttribute("target", "_blank");
    expect(lien).toHaveAttribute("rel", "noopener nofollow ugc");
    expect(lien.parentElement).toHaveTextContent("Rejoignez-nous ici : https://meet.google.com/coj-aymk-rwe. À tout de suite !");
  });

  it("l'aperçu d'un site : le domaine tiré de l'adresse (jamais de la page), le titre, la description, l'image sans référent", () => {
    page(
      lot([
        pub({
          texte: "Exemple : https://www.exemple.com/portfolio",
          apercu: { type: "lien", url: "https://www.exemple.com/portfolio", titre: "JobFinder · portfolio", description: "Un portfolio depuis son téléphone.", image: "https://cdn.exemple.com/p.png" },
        }),
        pub({
          id: "p2",
          auteur: { prenom: "Équipe", nom: "Étudium", role: "equipe" },
          texte: "https://meet.google.com/coj-aymk-rwe",
          apercu: { type: "lien", url: "https://meet.google.com/coj-aymk-rwe", titre: "Google Meet", description: "Réunions vidéo en temps réel.", image: null },
        }),
      ]),
    );
    const apercu = within(carte()).getByRole("link", { name: /JobFinder · portfolio/ });
    expect(apercu).toHaveAttribute("href", "https://www.exemple.com/portfolio");
    expect(apercu).toHaveAttribute("rel", "noopener nofollow ugc");
    expect(apercu).toHaveTextContent("exemple.com");
    expect(apercu).toHaveTextContent("Un portfolio depuis son téléphone.");
    const image = apercu.querySelector("img");
    expect(image).toHaveAttribute("src", "https://cdn.exemple.com/p.png");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    const meet = within(carte("Équipe Étudium")).getByRole("link", { name: /Google Meet/ });
    expect(meet).toHaveTextContent("meet.google.com");
    expect(meet.querySelector("img")).toBeNull();
  });

  it("une vidéo YouTube : l'image de la vidéo et Lecture ; au clic, le lecteur sans cookies ; Regarder sur YouTube", async () => {
    const user = userEvent.setup({ delay: null });
    page(lot([pub({ texte: `Regardez https://youtu.be/${VIDEO}`, apercu: { type: "youtube", id: VIDEO } })]));
    expect(carte().querySelector("img")).toHaveAttribute("src", `https://i.ytimg.com/vi/${VIDEO}/hqdefault.jpg`);
    expect(within(carte()).getByRole("link", { name: "Regarder sur YouTube" })).toHaveAttribute("href", `https://www.youtube.com/watch?v=${VIDEO}`);
    await user.click(within(carte()).getByRole("button", { name: "Lire la vidéo YouTube" }));
    expect(within(carte()).getByTitle("Vidéo YouTube")).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${VIDEO}?autoplay=1`);
  });
});

describe("Le tri, le signet, les J’aime", () => {
  it("Trier par : Les plus populaires relit le fil, Voir plus par page ; Mes enregistrements vide : la phrase", async () => {
    const user = userEvent.setup({ delay: null });
    page(lot([pub()]));
    expect(screen.getByText("Trier par :")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Les plus récentes" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Les plus récentes", "Les plus populaires", "Mes enregistrements"]);
    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot([pub({ id: "p7", texte: "La plus aimée" })], true) });
    await user.click(screen.getByRole("menuitem", { name: "Les plus populaires" }));
    expect(actions.chargerFil).toHaveBeenLastCalledWith("tous", "populaires", {});
    expect(await screen.findByText("La plus aimée")).toBeInTheDocument();
    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot([pub({ id: "p8", texte: "Page suivante" })]) });
    await user.click(screen.getByRole("button", { name: "Voir plus" }));
    expect(actions.chargerFil).toHaveBeenLastCalledWith("tous", "populaires", { page: 1 });
    expect(await screen.findByText("Page suivante")).toBeInTheDocument();

    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot([]) });
    await user.click(screen.getByRole("button", { name: "Les plus populaires" }));
    await user.click(screen.getByRole("menuitem", { name: "Mes enregistrements" }));
    expect(actions.chargerFil).toHaveBeenLastCalledWith("tous", "enregistrees", {});
    expect(await screen.findByText("Aucune publication enregistrée")).toBeInTheDocument();
    expect(screen.getByText("Touchez le signet d’une publication pour la retrouver ici.")).toBeInTheDocument();
  });

  it("le signet : Enregistrer puis Retirer des enregistrements ; un refus s'affiche", async () => {
    const user = userEvent.setup({ delay: null });
    page(lot([pub()]));
    vi.mocked(actions.basculerEnregistrement).mockResolvedValueOnce({ ok: true, enregistree: true });
    await user.click(within(carte()).getByRole("button", { name: "Enregistrer la publication de Mireille Adjovi" }));
    expect(actions.basculerEnregistrement).toHaveBeenCalledWith("p1");
    expect(await within(carte()).findByRole("button", { name: "Retirer la publication de Mireille Adjovi des enregistrements" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Publication enregistrée")).toBeInTheDocument();
    vi.mocked(actions.basculerEnregistrement).mockResolvedValueOnce({ ok: false, message: "Appliquez la migration 0021 (guide « Ce qui te revient », section 26)." });
    await user.click(within(carte()).getByRole("button", { name: "Retirer la publication de Mireille Adjovi des enregistrements" }));
    expect(await within(carte()).findByRole("alert")).toHaveTextContent("Appliquez la migration 0021");
  });

  it("les initiales des derniers qui aiment ; mon J’aime ajoute les miennes", async () => {
    const user = userEvent.setup({ delay: null });
    page(lot([pub({ reactions: 2, aimeePar: ["FA", "MA"] })]));
    expect(within(carte()).getByText("FA")).toBeInTheDocument();
    expect(within(carte()).getAllByText("KD")).toHaveLength(1);
    expect(within(carte()).getByText("2 J’aime")).toBeInTheDocument();
    vi.mocked(actions.aimer).mockResolvedValueOnce({ ok: true, jAime: true, reactions: 3 });
    await user.click(within(carte()).getByRole("button", { name: "J’aime" }));
    await waitFor(() => expect(within(carte()).getByText("3 J’aime")).toBeInTheDocument());
    // Mes initiales s'ajoutent aux leurs (en plus de celles du champ du commentaire).
    expect(within(carte()).getAllByText("KD")).toHaveLength(2);
  });
});

describe("Le champ de publication", () => {
  it("fermé : « Quoi de neuf, Koffi ? », Ajouter une image, Ajouter un fichier ; ouvert : le champ complet, Annuler le referme", async () => {
    const user = userEvent.setup({ delay: null });
    page(lot([]));
    const choisir = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    await user.click(screen.getByRole("button", { name: "Ajouter une image" }));
    await user.click(screen.getByRole("button", { name: "Ajouter un fichier" }));
    expect(choisir).toHaveBeenCalledTimes(2);
    choisir.mockRestore();
    await user.click(screen.getByRole("button", { name: "Quoi de neuf, Koffi ?" }));
    expect(screen.getByRole("textbox", { name: "Nouvelle publication" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Publier" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("textbox", { name: "Nouvelle publication" })).toBeNull();
    expect(screen.getByRole("button", { name: "Quoi de neuf, Koffi ?" })).toBeInTheDocument();
  });
});

describe("L'adresse et l'onglet", () => {
  it("l'adresse suit la puce ; un espace choisi dans le menu ≡ ouvre son onglet ; une relecture du serveur garde l'onglet et le fil", async () => {
    const user = userEvent.setup({ delay: null });
    const remplacer = vi.spyOn(window.history, "replaceState");
    const ui = (initial: LotPublications) => (
      <ToastProvider>
        <PageCommunaute espaces={ESPACES} initial={initial} moi={MOI} />
      </ToastProvider>
    );
    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot([pub({ id: "g1", texte: "Dans Général" })]) });
    const { rerender } = render(ui(lot([pub()])));
    await user.click(onglet("Général"));
    expect(await screen.findByText("Dans Général")).toBeInTheDocument();
    expect(remplacer).toHaveBeenLastCalledWith(null, "", "/communaute?espace=general");
    // L'adresse écrite par la page elle-même ne relit rien.
    recherche = "espace=general";
    rerender(ui(lot([pub()])));
    expect(actions.chargerFil).toHaveBeenCalledTimes(1);

    // Le menu ≡ → Actualités : une nouvelle adresse, la même page.
    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot([pub({ id: "t1", texte: "Tous les espaces" })]) });
    recherche = "espace=tous";
    rerender(ui(lot([pub()])));
    expect(await screen.findByText("Tous les espaces")).toBeInTheDocument();
    expect(onglet("Actualités")).toHaveAttribute("aria-pressed", "true");
    expect(actions.chargerFil).toHaveBeenLastCalledWith("tous", "recentes", {});
    expect(remplacer).toHaveBeenCalledTimes(1);

    // Une relecture du serveur (après un commentaire, une publication) : l'onglet, le tri et le fil restent.
    rerender(ui(lot([pub({ id: "autre", texte: "Relu par le serveur" })])));
    expect(screen.getByText("Tous les espaces")).toBeInTheDocument();
    expect(screen.queryByText("Relu par le serveur")).toBeNull();
    remplacer.mockRestore();
  });
});

