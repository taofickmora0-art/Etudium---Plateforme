// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { AnnonceEquipe } from "@/lib/communaute/types";
import { choisirDansListe, optionsDeLaListe } from "../utilitaires/listes";

// L'annonce épinglée au back-office (spec du fil « Actualités », §2 ; design NdAdminAnnonceCommunaute).

const upload = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload }) } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/admin/communaute" }));
vi.mock("@/lib/communaute/actions-annonce", () => ({ enregistrerAnnonce: vi.fn(), retirerAnnonce: vi.fn() }));
vi.mock("@/lib/communaute/annonce", () => ({ lireAnnonceEquipe: vi.fn() }));
vi.mock("@/lib/admin/data", () => ({ listParcours: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getAuthUser: vi.fn(async () => ({ id: "compte-1" })), demoModeActive: () => false }));

const { enregistrerAnnonce, retirerAnnonce } = await import("@/lib/communaute/actions-annonce");
const { lireAnnonceEquipe } = await import("@/lib/communaute/annonce");
const { listParcours } = await import("@/lib/admin/data");
const { PageAnnonceCommunaute } = await import("@/components/admin/communaute/PageAnnonceCommunaute");

const P = "22222222-2222-4222-8222-222222222222";
const VIDEO = "dQw4w9WgXcQ";
const VIDE: AnnonceEquipe = { active: false, titre: "", texte: "", media: null, youtubeId: null, image: null, imageChemin: null, public: "tous", parcoursId: null };
const PNG = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], "affiche.png", { type: "image/png" });
const afficher = (ui: ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
const apercu = () => screen.getByRole("complementary", { name: "Aperçu dans le fil" });

beforeEach(() => {
  vi.mocked(enregistrerAnnonce).mockReset();
  vi.mocked(retirerAnnonce).mockReset();
  upload.mockReset().mockResolvedValue({ data: {}, error: null });
  vi.mocked(listParcours).mockResolvedValue([
    { id: P, slug: "reussite-academique", nom: "Réussite académique", nomCourt: "Académique", description: "", couleur: "academique", ordre: 1, actif: true },
    { id: "33333333-3333-4333-8333-333333333333", slug: "ancien", nom: "Ancien parcours", nomCourt: "Ancien", description: "", couleur: null, ordre: 2, actif: false },
  ] as Awaited<ReturnType<typeof listParcours>>);
});

describe("L'annonce de la communauté au back-office", () => {
  it("avant la 0021 : le bandeau", async () => {
    vi.mocked(lireAnnonceEquipe).mockResolvedValue({ migrationAbsente: true });
    afficher(await PageAnnonceCommunaute());
    expect(screen.getByRole("heading", { level: 1, name: "Annonce de la communauté" })).toBeInTheDocument();
    expect(screen.getByText("L’annonce de la communauté n’est pas encore dans la base.")).toBeInTheDocument();
    expect(screen.getByText("Appliquez la migration 0021 (guide « Ce qui te revient », section 26).")).toBeInTheDocument();
  });

  it("le réglage actuel ; l'aperçu suit la saisie ; Enregistrer : « Annonce enregistrée »", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(lireAnnonceEquipe).mockResolvedValue({
      migrationAbsente: false,
      donnees: { ...VIDE, active: true, titre: "Bienvenue", texte: "Cinq minutes.", media: "youtube", youtubeId: VIDEO },
    });
    afficher(await PageAnnonceCommunaute());
    expect(screen.getByText("Une vidéo ou une affiche épinglée en haut du fil « Actualités ».")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Afficher l’annonce" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Titre")).toHaveValue("Bienvenue");
    expect(screen.getByRole("button", { name: "Vidéo YouTube" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Adresse de la vidéo YouTube" })).toHaveValue(`https://youtu.be/${VIDEO}`);
    expect(within(apercu()).getByRole("heading", { level: 2, name: "Bienvenue" })).toBeInTheDocument();
    expect(within(apercu()).getByRole("button", { name: "Lire la vidéo" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Titre"));
    await user.type(screen.getByLabelText("Titre"), "Nouveau titre");
    expect(within(apercu()).getByRole("heading", { level: 2, name: "Nouveau titre" })).toBeInTheDocument();

    vi.mocked(enregistrerAnnonce).mockResolvedValueOnce({ ok: false, message: "Cette adresse YouTube n’est pas reconnue." });
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cette adresse YouTube n’est pas reconnue.");

    vi.mocked(enregistrerAnnonce).mockResolvedValueOnce({ ok: true });
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(enregistrerAnnonce).toHaveBeenLastCalledWith({
      active: true,
      titre: "Nouveau titre",
      texte: "Cinq minutes.",
      media: "youtube",
      youtube: `https://youtu.be/${VIDEO}`,
      imageChemin: null,
      public: "tous",
      parcoursId: null,
      masquable: false,
    });
    expect(await screen.findByText("Annonce enregistrée")).toBeInTheDocument();
    // Les membres peuvent la masquer (liste du 31 octobre, tâche 6) : la case, puis l'enregistrement.
    const masquable = screen.getByRole("switch", { name: "Les membres peuvent la masquer" });
    expect(masquable).toHaveAttribute("aria-checked", "false");
    await user.click(masquable);
    expect(within(apercu()).getByRole("button", { name: "Masquer l’annonce" })).toBeInTheDocument();
    vi.mocked(enregistrerAnnonce).mockResolvedValueOnce({ ok: true });
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(enregistrerAnnonce).toHaveBeenLastCalledWith(expect.objectContaining({ masquable: true }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("une affiche : vérifiée sur ses octets, déposée dans le dossier du compte à l'enregistrement, montrée dans l'aperçu", async () => {
    const user = userEvent.setup({ delay: null, applyAccept: false });
    vi.mocked(lireAnnonceEquipe).mockResolvedValue({ migrationAbsente: false, donnees: VIDE });
    afficher(await PageAnnonceCommunaute());
    await user.click(screen.getByRole("button", { name: "Affiche" }));
    expect(screen.queryByRole("textbox", { name: "Adresse de la vidéo YouTube" })).toBeNull();
    const choix = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(choix(), new File(["pas une image"], "faux.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choisissez une image JPEG, PNG ou WebP de 10 Mo au plus.");
    await user.upload(choix(), PNG());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByText("affiche.png")).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Afficher l’annonce" }));
    await user.type(screen.getByLabelText("Titre"), "Rentrée");
    vi.mocked(enregistrerAnnonce).mockResolvedValueOnce({ ok: true });
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(enregistrerAnnonce).toHaveBeenCalled());
    const [chemin, , options] = upload.mock.calls[0];
    expect(chemin).toMatch(/^compte-1\/[0-9a-f-]{36}\.png$/);
    expect(options).toEqual({ contentType: "image/png", upsert: false });
    expect(enregistrerAnnonce).toHaveBeenCalledWith(expect.objectContaining({ active: true, titre: "Rentrée", media: "image", imageChemin: chemin, youtube: "" }));
  });

  it("qui la voit : tous les membres, ou ceux d'un parcours actif ; aucun choix grisé", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(lireAnnonceEquipe).mockResolvedValue({ migrationAbsente: false, donnees: { ...VIDE, titre: "Pour les académiques" } });
    afficher(await PageAnnonceCommunaute());
    const groupe = screen.getByRole("group", { name: "Qui la voit" });
    expect(within(groupe).getByRole("radio", { name: /Tous les membres/ })).toBeChecked();
    expect(within(groupe).getAllByRole("radio")).toHaveLength(2);
    expect(within(groupe).queryByRole("radio", { name: /formule d’abonnement/ })).toBeNull();
    expect(groupe).not.toHaveTextContent(/lot \d/);
    expect(screen.queryByRole("combobox", { name: "Parcours" })).toBeNull();
    await user.click(within(groupe).getByRole("radio", { name: /Les membres d’un parcours/ }));
    const liste = screen.getByRole("combobox", { name: "Parcours" });
    // « Choisissez un parcours » est l'indication de la liste, pas une option.
    expect(liste).toHaveTextContent("Choisissez un parcours");
    expect(await optionsDeLaListe(liste, { user })).toEqual(["Réussite académique"]);
    await choisirDansListe(liste, "Réussite académique", { user });
    vi.mocked(enregistrerAnnonce).mockResolvedValueOnce({ ok: true });
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    // Sans vidéo ni affiche : pas de média.
    expect(enregistrerAnnonce).toHaveBeenCalledWith(expect.objectContaining({ public: "parcours", parcoursId: P, media: null }));
  });

  it("Retirer l’annonce : confirmé, puis le formulaire vidé", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(lireAnnonceEquipe).mockResolvedValue({ migrationAbsente: false, donnees: { ...VIDE, active: true, titre: "Bienvenue" } });
    afficher(await PageAnnonceCommunaute());
    await user.click(screen.getByRole("button", { name: "Retirer l’annonce" }));
    const fenetre = screen.getByRole("dialog", { name: "Retirer l’annonce ?" });
    expect(within(fenetre).getByText("Elle disparaît du fil. Vous pourrez en écrire une autre.")).toBeInTheDocument();
    vi.mocked(retirerAnnonce).mockResolvedValueOnce({ ok: true });
    await user.click(within(fenetre).getByRole("button", { name: "Retirer" }));
    expect(retirerAnnonce).toHaveBeenCalled();
    expect(await screen.findByText("Annonce retirée")).toBeInTheDocument();
    expect(screen.getByLabelText("Titre")).toHaveValue("");
    expect(screen.getByRole("switch", { name: "Afficher l’annonce" })).toHaveAttribute("aria-checked", "false");
  });
});
