// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ShellUser } from "@/lib/auth/current-user";
import { REFUS_PIECE, REFUS_TEXTE } from "@/lib/communaute/regles";
import type { Espace, LotPublications, MembreActif, Publication, Reponse } from "@/lib/communaute/types";
import type { ProchaineSession } from "@/lib/sessions/types";

// La page Communauté et la page d'une publication (design NdCommunaute ; spec de la communauté, §3).

const upload = vi.fn();
const remove = vi.fn();
const push = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload, remove }) } }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  unstable_rethrow: () => undefined,
}));
vi.mock("@/lib/communaute/actions", () => ({
  chargerFil: vi.fn(),
  chargerReponses: vi.fn(),
  publierPublication: vi.fn(),
  modifierPublication: vi.fn(),
  supprimerPublication: vi.fn(),
  repondre: vi.fn(),
  supprimerReponse: vi.fn(),
  aimer: vi.fn(),
}));
vi.mock("@/lib/communaute/data", () => ({ lireEspaces: vi.fn(), lireFil: vi.fn(), lirePublication: vi.fn(), lireMembresActifs: vi.fn(), lireAnalyseActive: vi.fn(async () => false) }));
vi.mock("@/lib/sessions/data", () => ({ lireProchaineSession: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: vi.fn(), getAuthUser: vi.fn(), demoModeActive: () => false }));

const actions = await import("@/lib/communaute/actions");
const { lireEspaces, lireFil, lireMembresActifs, lirePublication } = await import("@/lib/communaute/data");
const { lireProchaineSession } = await import("@/lib/sessions/data");
const { getAuthUser, getShellUser } = await import("@/lib/auth/current-user");
const { ContenuCommunaute } = await import("@/components/communaute/ContenuCommunaute");
const { PageCommunaute } = await import("@/components/communaute/PageCommunaute");
const { ColonneCommunaute } = await import("@/components/communaute/ColonneCommunaute");
const { PagePublication } = await import("@/components/communaute/PagePublication");

const P = "22222222-2222-4222-8222-222222222222";
const B = "44444444-4444-4444-8444-444444444444";
const ESPACES: Espace[] = [
  { id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true },
  { id: P, nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", slug: "reussite-academique", ouvert: true },
  { id: B, nom: "Réussite business", nomCourt: "Business", couleur: "business", slug: "reussite-business", ouvert: false },
];
const MOI = { compteId: "compte-1", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const SHELL = { prenom: "Koffi", nom: "Dossou", initials: "KD", email: "k@exemple.com", roles: ["etudiant"], photoUrl: null } as unknown as ShellUser;

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
  reactions: 0,
  jAime: false,
  reponses: 0,
  dernieresReponses: [],
  peutSupprimer: false,
  statut: "publiee",
  peutSignaler: false,
  ...o,
});
const rep = (id: string, texte: string, o: Partial<Reponse> = {}): Reponse => ({
  id,
  auteur: { prenom: "Awa", nomCourt: "Awa K." },
  estMoi: false,
  texte,
  creeLe: "2026-10-14T14:00:00Z",
  peutSupprimer: false,
  peutSignaler: false,
  ...o,
});
const lot = (publications: Publication[], suite = false): LotPublications => ({ publications, suite });

const afficher = (ui: ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
const page = (initial: LotPublications) => afficher(<PageCommunaute espaces={ESPACES} initial={initial} moi={MOI} />);
const carte = (nom = "Mireille Adjovi") => screen.getByRole("article", { name: `Publication de ${nom}` });
const onglet = (nom: string) => within(screen.getByRole("group", { name: "Choisir un espace" })).getByRole("button", { name: nom });
const PNG = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], "affiche.png", { type: "image/png" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T15:00:00Z"));
  for (const f of Object.values(actions)) vi.mocked(f).mockReset();
  [upload, remove, push].forEach((f) => f.mockReset());
  upload.mockResolvedValue({ data: {}, error: null });
  remove.mockResolvedValue({ data: [], error: null });
  vi.mocked(lireEspaces).mockResolvedValue({ migrationAbsente: false, donnees: ESPACES });
  vi.mocked(lireFil).mockResolvedValue({ migrationAbsente: false, donnees: lot([pub()]) });
  vi.mocked(lireMembresActifs).mockResolvedValue({ migrationAbsente: false, donnees: [] });
  vi.mocked(lireProchaineSession).mockResolvedValue({ migrationAbsente: false, donnees: null });
  vi.mocked(getShellUser).mockResolvedValue(SHELL);
  vi.mocked(getAuthUser).mockResolvedValue({ id: "compte-1" } as Awaited<ReturnType<typeof getAuthUser>>);
});
afterEach(() => vi.useRealTimers());

describe("La page Communauté", () => {
  it("en-tête, onglets Général puis parcours ; un espace fermé : cadenas, puis « Espace Business verrouillé » et le lien vers ses formations", async () => {
    const user = userEvent.setup();
    // La prochaine session est secondaire : une panne ne bloque pas la page.
    vi.mocked(lireProchaineSession).mockRejectedValue(new Error("panne"));
    afficher(await ContenuCommunaute());
    expect(lireFil).toHaveBeenCalledWith("tous");
    expect(screen.getByRole("heading", { level: 1, name: "Communauté" })).toBeInTheDocument();
    expect(screen.getByText("Posez vos questions, partagez vos réussites, entraidez-vous.")).toBeInTheDocument();
    const onglets = within(screen.getByRole("group", { name: "Choisir un espace" })).getAllByRole("button");
    expect(onglets.map((o) => o.getAttribute("aria-label") ?? o.textContent)).toEqual(["Général", "Académique", "Business, espace verrouillé"]);
    expect(onglet("Général")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Nouvelle publication" })).toHaveAttribute("placeholder", "Partagez une question ou une réussite dans l’espace Général…");
    expect(screen.getByText("Soyez bienveillant : l’équipe Étudium veille aux échanges.")).toBeInTheDocument();
    expect(carte()).toBeInTheDocument();
    expect(screen.getByText("Aucune session programmée pour l’instant.")).toBeInTheDocument();

    await user.click(onglet("Business, espace verrouillé"));
    expect(actions.chargerFil).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 3, name: "Espace Business verrouillé" })).toBeInTheDocument();
    expect(screen.getByText("Commencez une formation du parcours Réussite business pour rejoindre son espace.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les formations du parcours" })).toHaveAttribute("href", "/parcours?parcours=reussite-business");
    expect(screen.queryByRole("textbox", { name: "Nouvelle publication" })).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("changer d'onglet appelle chargerFil(id, null) ; Voir plus avec le curseur de la dernière publication", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot([pub({ id: "p3", texte: "La plus ancienne", creeLe: "2026-10-10T08:00:00Z" })]) });
    page(lot([pub(), pub({ id: "p2", texte: "Deuxième", creeLe: "2026-10-14T12:00:00Z" })], true));
    await user.click(screen.getByRole("button", { name: "Voir plus" }));
    expect(actions.chargerFil).toHaveBeenLastCalledWith("tous", { avant: "2026-10-14T12:00:00Z", avantId: "p2" });
    expect(await screen.findByText("La plus ancienne")).toBeInTheDocument();
    expect(screen.getByText("Deuxième")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voir plus" })).toBeNull();

    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot([pub({ id: "p9", texte: "Dans Académique" })]) });
    await user.click(onglet("Académique"));
    expect(actions.chargerFil).toHaveBeenLastCalledWith(P, null);
    expect(await screen.findByText("Dans Académique")).toBeInTheDocument();
    expect(screen.queryByText("La plus ancienne")).toBeNull();
    expect(onglet("Académique")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Nouvelle publication" })).toHaveAttribute("placeholder", "Partagez une question ou une réussite dans l’espace Académique…");

    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: false, message: "Les publications n’ont pas pu être chargées. Réessayez." });
    await user.click(onglet("Général"));
    expect(await screen.findByText("Les publications n’ont pas pu être chargées. Réessayez.")).toBeInTheDocument();
  });

  it("publier : la publication s'ajoute en haut sans relire le fil, « Publication en ligne » ; un refus s'affiche ; texte vide refusé sans appel", async () => {
    const user = userEvent.setup({ delay: null });
    page(lot([]));
    expect(screen.getByText("Aucune publication pour l’instant")).toBeInTheDocument();
    expect(screen.getByText("Lancez la conversation : posez une question ou partagez une réussite.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publier" }));
    expect(screen.getByRole("alert")).toHaveTextContent(REFUS_TEXTE);
    expect(actions.publierPublication).not.toHaveBeenCalled();

    vi.mocked(actions.publierPublication).mockResolvedValueOnce({ ok: false, message: "Cet espace ne vous est pas ouvert." });
    await user.type(screen.getByRole("textbox", { name: "Nouvelle publication" }), "Bonjour à tous");
    await user.type(screen.getByRole("textbox", { name: "Titre (facultatif)" }), "Salut");
    await user.click(screen.getByRole("button", { name: "Publier" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cet espace ne vous est pas ouvert.");

    vi.mocked(actions.publierPublication).mockResolvedValueOnce({ ok: true, id: "n1", statut: "publiee" });
    await user.click(screen.getByRole("button", { name: "Publier" }));
    expect(actions.publierPublication).toHaveBeenLastCalledWith(null, "Salut", "Bonjour à tous", null);
    const nouvelle = await screen.findByRole("article", { name: "Publication de Koffi Dossou" });
    expect(within(nouvelle).getByText("Vous")).toBeInTheDocument();
    expect(within(nouvelle).getByText("Espace général · à l’instant")).toBeInTheDocument();
    expect(within(nouvelle).getByRole("heading", { level: 3, name: "Salut" })).toBeInTheDocument();
    expect(screen.getByText("Publication en ligne")).toBeInTheDocument();
    expect(screen.getByText("Elle apparaît en haut du fil.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nouvelle publication" })).toHaveValue("");
    expect(screen.queryByText("Aucune publication pour l’instant")).toBeNull();
    expect(actions.chargerFil).not.toHaveBeenCalled();
  });

  it("pièce jointe : un fichier d'un autre type est refusé sans envoi ; une image est envoyée dans le dossier du compte puis passée à publierPublication", async () => {
    const user = userEvent.setup({ delay: null, applyAccept: false });
    page(lot([]));
    await user.upload(screen.getByLabelText("Joindre un fichier"), new File(["PK"], "notes.zip", { type: "application/zip" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(REFUS_PIECE);
    // Un « .png » qui n'en est pas un est refusé aussi : le type se lit sur les premiers octets.
    await user.upload(screen.getByLabelText("Joindre une image"), new File(["pas une image"], "faux.png", { type: "image/png" }));
    expect(screen.queryByText("faux.png")).toBeNull();

    await user.upload(screen.getByLabelText("Joindre une image"), PNG());
    expect(await screen.findByText("affiche.png")).toBeInTheDocument();
    expect(screen.getByText("1 Ko")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    vi.mocked(actions.publierPublication).mockResolvedValueOnce({ ok: true, id: "n2", statut: "publiee" });
    await user.type(screen.getByRole("textbox", { name: "Nouvelle publication" }), "Mon affiche");
    await user.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(actions.publierPublication).toHaveBeenCalled());
    const [chemin, , options] = upload.mock.calls[0];
    expect(chemin).toMatch(/^compte-1\/[0-9a-f-]{36}\.png$/);
    expect(options).toEqual({ contentType: "image/png", upsert: false });
    expect(actions.publierPublication).toHaveBeenCalledWith(null, "", "Mon affiche", { chemin, nom: "affiche.png", type: "image/png", taille: 12 });
    expect(screen.queryByRole("button", { name: "Retirer affiche.png" })).toBeNull();
  });

  it("un envoi de fichier qui échoue : le message, sans publication", async () => {
    const user = userEvent.setup({ delay: null });
    upload.mockResolvedValue({ data: null, error: { message: "panne" } });
    page(lot([]));
    fireEvent.change(screen.getByLabelText("Joindre une image"), { target: { files: [PNG()] } });
    expect(await screen.findByText("affiche.png")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Nouvelle publication" }), "Mon affiche");
    await user.click(screen.getByRole("button", { name: "Publier" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("L’envoi du fichier n’a pas abouti. Réessayez.");
    expect(actions.publierPublication).not.toHaveBeenCalled();
  });

  it("une publication : nom, Formateur ou Équipe Étudium ou Vous, Espace Académique · il y a 2 h, titre, texte, image ou PDF (nom · taille), J’aime 24, 2 réponses", () => {
    page(
      lot([
        pub({
          titre: "Comment structurer la revue ?",
          texte: "Je partage le plan.",
          pieceJointe: { chemin: "a/plan.pdf", nom: "Plan-revue.pdf", type: "application/pdf", taille: 245_760, url: "https://stockage/plan.pdf" },
          reactions: 24,
          reponses: 2,
          dernieresReponses: [rep("r1", "Très bon plan."), rep("r2", "Merci, ça m’aide !")],
          modifiee: true,
        }),
        pub({ id: "p2", auteur: { prenom: "Rodrigue", nom: "Houngbo", role: "equipe" }, espace: { id: null, nom: "général" }, creeLe: "2026-10-13T10:00:00Z" }),
        pub({
          id: "p3",
          auteur: { prenom: "Koffi", nom: "Dossou", role: null },
          estMoi: true,
          pieceJointe: { chemin: "b/affiche.png", nom: "affiche.png", type: "image/png", taille: 1000, url: "https://stockage/affiche.png" },
          creeLe: "2026-10-12T10:00:00Z",
        }),
      ]),
    );
    const mireille = carte();
    expect(within(mireille).getByText("Formateur")).toBeInTheDocument();
    expect(within(mireille).getByText("Espace Académique · il y a 2 h · modifiée")).toBeInTheDocument();
    expect(within(mireille).getByRole("heading", { level: 3, name: "Comment structurer la revue ?" })).toBeInTheDocument();
    expect(within(mireille).getByText("Je partage le plan.")).toBeInTheDocument();
    expect(within(mireille).getByText("Plan-revue.pdf")).toBeInTheDocument();
    expect(within(mireille).getByText("240 Ko")).toBeInTheDocument();
    const ouvrir = within(mireille).getByRole("link", { name: "Ouvrir Plan-revue.pdf" });
    expect(ouvrir).toHaveAttribute("href", "https://stockage/plan.pdf");
    expect(ouvrir).toHaveAttribute("target", "_blank");
    expect(within(mireille).getByRole("button", { name: "J’aime, 24 mentions" })).toHaveTextContent("24");
    expect(within(mireille).getByRole("button", { name: "Masquer les réponses, 2 réponses" })).toHaveTextContent("2 réponses");
    expect(within(mireille).getByText("Très bon plan.")).toBeInTheDocument();
    expect(within(mireille).getByText("Merci, ça m’aide !")).toBeInTheDocument();

    const equipe = carte("Rodrigue Houngbo");
    expect(within(equipe).getByText("Équipe Étudium")).toBeInTheDocument();
    expect(within(equipe).getByText("Espace général · hier")).toBeInTheDocument();
    expect(within(equipe).getByRole("button", { name: "Afficher les réponses, aucune réponse" })).toHaveTextContent("Répondre");
    expect(within(equipe).queryByRole("textbox", { name: "Répondre" })).toBeNull();

    const moi = carte("Koffi Dossou");
    expect(within(moi).getByText("Vous")).toBeInTheDocument();
    expect(within(moi).getByText("Espace Académique · il y a 2 jours")).toBeInTheDocument();
    expect(within(moi).getByRole("img", { name: "affiche.png" })).toHaveAttribute("src", "https://stockage/affiche.png");
  });

  it("menu : Copier le lien (Lien copié), Modifier (l'auteur), Supprimer (l'auteur ou l'équipe) avec la confirmation du design", async () => {
    const user = userEvent.setup({ delay: null });
    const ecrire = vi.spyOn(navigator.clipboard, "writeText");
    page(
      lot([
        pub(),
        pub({ id: "p2", auteur: { prenom: "Koffi", nom: "Dossou", role: null }, estMoi: true, peutSupprimer: true, texte: "Mon texte" }),
        pub({ id: "p3", auteur: { prenom: "Awa", nom: "Kpadé", role: null }, peutSupprimer: true }),
      ]),
    );
    await user.click(within(carte()).getByRole("button", { name: "Actions sur la publication de Mireille Adjovi" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Copier le lien"]);
    await user.click(screen.getByRole("menuitem", { name: "Copier le lien" }));
    expect(ecrire).toHaveBeenCalledWith(`${window.location.origin}/communaute/publications/p1`);
    expect(await screen.findByText("Lien copié")).toBeInTheDocument();

    await user.click(within(carte("Awa Kpadé")).getByRole("button", { name: "Actions sur la publication de Awa Kpadé" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Copier le lien", "Supprimer"]);
    await user.keyboard("{Escape}");

    // Modifier sur place.
    vi.mocked(actions.modifierPublication).mockResolvedValueOnce({ ok: true, statut: "publiee" });
    await user.click(within(carte("Koffi Dossou")).getByRole("button", { name: "Actions sur la publication de Koffi Dossou" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Modifier", "Copier le lien", "Supprimer"]);
    await user.click(screen.getByRole("menuitem", { name: "Modifier" }));
    const texte = within(carte("Koffi Dossou")).getByRole("textbox", { name: "Texte de la publication" });
    expect(texte).toHaveValue("Mon texte");
    await user.clear(texte);
    await user.type(texte, "Texte corrigé");
    await user.click(within(carte("Koffi Dossou")).getByRole("button", { name: "Enregistrer" }));
    expect(actions.modifierPublication).toHaveBeenCalledWith("p2", "", "Texte corrigé");
    expect(await within(carte("Koffi Dossou")).findByText("Texte corrigé")).toBeInTheDocument();
    expect(within(carte("Koffi Dossou")).getByText("Espace Académique · il y a 2 h · modifiée")).toBeInTheDocument();

    // Supprimer, confirmé.
    vi.mocked(actions.supprimerPublication).mockResolvedValueOnce({ ok: true });
    await user.click(within(carte("Koffi Dossou")).getByRole("button", { name: "Actions sur la publication de Koffi Dossou" }));
    await user.click(screen.getByRole("menuitem", { name: "Supprimer" }));
    const fenetre = screen.getByRole("dialog", { name: "Supprimer cette publication ?" });
    expect(within(fenetre).getByText("Elle disparaîtra de l’espace Académique avec toutes ses réponses. Cette action est définitive.")).toBeInTheDocument();
    await user.click(within(fenetre).getByRole("button", { name: "Supprimer" }));
    expect(actions.supprimerPublication).toHaveBeenCalledWith("p2", { relire: true });
    await waitFor(() => expect(screen.queryByRole("article", { name: "Publication de Koffi Dossou" })).toBeNull());
    expect(screen.getByText("Publication supprimée")).toBeInTheDocument();
  });

  it("J’aime bascule ; Voir les 5 réponses les déplie ; Répondre ajoute la réponse ; Supprimer une réponse", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(actions.aimer).mockResolvedValueOnce({ ok: true, jAime: true, reactions: 25 });
    page(lot([pub({ reactions: 24, reponses: 5, dernieresReponses: [rep("r4", "Quatrième"), rep("r5", "Cinquième")] })]));
    await user.click(within(carte()).getByRole("button", { name: "J’aime, 24 mentions" }));
    expect(actions.aimer).toHaveBeenCalledWith("p1");
    expect(await within(carte()).findByRole("button", { name: "Retirer la mention J’aime, 25 mentions" })).toHaveAttribute("aria-pressed", "true");

    vi.mocked(actions.chargerReponses).mockResolvedValueOnce({
      ok: true,
      reponses: [rep("r1", "Première"), rep("r2", "Deuxième"), rep("r3", "Troisième"), rep("r4", "Quatrième"), rep("r5", "Cinquième")],
    });
    expect(within(carte()).queryByText("Première")).toBeNull();
    await user.click(within(carte()).getByRole("button", { name: "Voir les 5 réponses" }));
    expect(actions.chargerReponses).toHaveBeenCalledWith("p1");
    expect(await within(carte()).findByText("Première")).toBeInTheDocument();
    expect(within(carte()).queryByRole("button", { name: "Voir les 5 réponses" })).toBeNull();

    vi.mocked(actions.repondre).mockResolvedValueOnce({
      ok: true,
      reponse: rep("r9", "Merci !", { auteur: { prenom: "Koffi", nomCourt: "Koffi D." }, estMoi: true, peutSupprimer: true, creeLe: "2026-10-14T15:00:00Z" }),
    });
    await user.type(within(carte()).getByRole("textbox", { name: "Répondre" }), "Merci !");
    await user.click(within(carte()).getByRole("button", { name: "Envoyer la réponse" }));
    expect(actions.repondre).toHaveBeenCalledWith("p1", "Merci !");
    expect(await within(carte()).findByText("Merci !")).toBeInTheDocument();
    expect(within(carte()).getByText("Koffi D.")).toBeInTheDocument();
    expect(within(carte()).getByRole("button", { name: "Masquer les réponses, 6 réponses" })).toBeInTheDocument();
    expect(within(carte()).getByRole("textbox", { name: "Répondre" })).toHaveValue("");

    vi.mocked(actions.supprimerReponse).mockResolvedValueOnce({ ok: true });
    await user.click(within(carte()).getByRole("button", { name: "Supprimer la réponse de Koffi D." }));
    expect(actions.supprimerReponse).toHaveBeenCalledWith("r9");
    await waitFor(() => expect(within(carte()).queryByText("Merci !")).toBeNull());
    expect(within(carte()).getByRole("button", { name: "Masquer les réponses, 5 réponses" })).toBeInTheDocument();

    // Une réponse vide est refusée sans appel.
    await user.click(within(carte()).getByRole("button", { name: "Envoyer la réponse" }));
    expect(actions.repondre).toHaveBeenCalledTimes(1);
  });

  it("réponses : deux suppressions rapprochées retirent les deux ; une réponse envoyée pendant une suppression reste", async () => {
    const user = userEvent.setup({ delay: null });
    const finir: Record<string, () => void> = {};
    const attendre = (cle: string, valeur: unknown) => () => new Promise((ok) => (finir[cle] = () => ok(valeur)));
    vi.mocked(actions.supprimerReponse)
      .mockImplementationOnce(attendre("a", { ok: true }) as never)
      .mockImplementationOnce(attendre("b", { ok: true }) as never)
      .mockImplementationOnce(attendre("c", { ok: true }) as never);
    vi.mocked(actions.repondre).mockImplementationOnce(
      attendre("envoi", { ok: true, reponse: rep("r9", "Merci !", { auteur: { prenom: "Koffi", nomCourt: "Koffi D." }, estMoi: true, peutSupprimer: true }) }) as never,
    );
    const auteur = (prenom: string, nomCourt: string) => ({ auteur: { prenom, nomCourt }, peutSupprimer: true });
    page(
      lot([
        pub({
          reponses: 3,
          dernieresReponses: [rep("r1", "Première", auteur("Awa", "Awa K.")), rep("r2", "Deuxième", auteur("Sènami", "Sènami D.")), rep("r3", "Troisième", auteur("Rodrigue", "Rodrigue H."))],
        }),
      ]),
    );
    const corbeille = (nom: string) => within(carte()).getByRole("button", { name: `Supprimer la réponse de ${nom}` });
    await user.click(corbeille("Awa K."));
    expect(corbeille("Awa K.")).toBeDisabled();
    await user.click(corbeille("Sènami D."));
    await act(async () => finir.a());
    await act(async () => finir.b());
    expect(within(carte()).queryByText("Première")).toBeNull();
    expect(within(carte()).queryByText("Deuxième")).toBeNull();
    expect(within(carte()).getByRole("button", { name: "Masquer les réponses, 1 réponse" })).toBeInTheDocument();

    await user.type(within(carte()).getByRole("textbox", { name: "Répondre" }), "Merci !");
    await user.click(within(carte()).getByRole("button", { name: "Envoyer la réponse" }));
    await user.click(corbeille("Rodrigue H."));
    await act(async () => finir.c());
    await act(async () => finir.envoi());
    expect(within(carte()).getByText("Merci !")).toBeInTheDocument();
    expect(within(carte()).queryByText("Troisième")).toBeNull();
    expect(within(carte()).getByRole("button", { name: "Masquer les réponses, 1 réponse" })).toBeInTheDocument();
  });

  it("colonne de droite : Prochaine session (Voir la session), Membres actifs ; sans rien : les phrases d'attente", () => {
    const session = { id: "s1", titre: "Excel avancé : analyse de données", debut: "2026-10-24T14:00:00Z" } as ProchaineSession;
    const membres: MembreActif[] = [
      { prenom: "Koffi", nomCourt: "Koffi D.", initiales: "KD", espace: "Académique" },
      { prenom: "Awa", nomCourt: "Awa K.", initiales: "AK", espace: "Général" },
    ];
    const { unmount } = render(<ColonneCommunaute session={session} membres={membres} espaces={ESPACES} />);
    expect(screen.getByRole("heading", { level: 2, name: "Prochaine session" })).toBeInTheDocument();
    expect(screen.getByText("Excel avancé : analyse de données")).toBeInTheDocument();
    expect(screen.getByText("Samedi 24 octobre · 15 h 00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir la session" })).toHaveAttribute("href", "/evenements");
    expect(screen.getByRole("heading", { level: 2, name: "Membres actifs" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((l) => l.textContent)).toEqual(["KDKoffi D.Académique", "AKAwa K.Général"]);
    unmount();
    render(<ColonneCommunaute session={null} membres={[]} espaces={ESPACES} />);
    expect(screen.getByText("Aucune session programmée pour l’instant.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les événements" })).toHaveAttribute("href", "/evenements");
    expect(screen.getByText("Aucun membre actif cette semaine.")).toBeInTheDocument();
  });

  it("page d'une publication : toutes ses réponses, le fil d'Ariane ; supprimée : retour à la Communauté ; introuvable : page introuvable", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(lirePublication).mockResolvedValue({
      migrationAbsente: false,
      donnees: {
        ...pub({ estMoi: true, peutSupprimer: true, reponses: 3, dernieresReponses: [rep("r2", "Deuxième"), rep("r3", "Troisième")] }),
        toutesReponses: [rep("r1", "Première"), rep("r2", "Deuxième"), rep("r3", "Troisième")],
      },
    });
    afficher(await PagePublication({ id: "p1" }));
    expect(lirePublication).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("link", { name: "Communauté" })).toHaveAttribute("href", "/communaute");
    for (const texte of ["Première", "Deuxième", "Troisième"]) expect(within(carte()).getByText(texte)).toBeInTheDocument();
    expect(within(carte()).queryByRole("button", { name: /Voir les/ })).toBeNull();
    expect(within(carte()).getByRole("textbox", { name: "Répondre" })).toBeInTheDocument();

    vi.mocked(actions.supprimerPublication).mockResolvedValueOnce({ ok: true });
    await user.click(within(carte()).getByRole("button", { name: "Actions sur la publication de Mireille Adjovi" }));
    await user.click(screen.getByRole("menuitem", { name: "Supprimer" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/communaute"));
    expect(actions.supprimerPublication).toHaveBeenCalledWith("p1", { relire: false });

    vi.mocked(lirePublication).mockResolvedValue({ migrationAbsente: false, donnees: null });
    await expect(PagePublication({ id: "inconnue" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("avant la 0019 : le bandeau, sur les deux pages", async () => {
    vi.mocked(lireEspaces).mockResolvedValue({ migrationAbsente: true });
    const { unmount } = afficher(await ContenuCommunaute());
    expect(screen.getByRole("heading", { level: 1, name: "Communauté" })).toBeInTheDocument();
    expect(screen.getByText("La communauté n’est pas encore dans la base.")).toBeInTheDocument();
    expect(screen.getByText("Appliquez la migration 0019 (guide « Ce qui te revient », section 24).")).toBeInTheDocument();
    unmount();
    vi.mocked(lirePublication).mockResolvedValue({ migrationAbsente: true });
    afficher(await PagePublication({ id: "p1" }));
    expect(screen.getByText("La communauté n’est pas encore dans la base.")).toBeInTheDocument();
  });
});
