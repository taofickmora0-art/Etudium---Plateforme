// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Espace, MoiCommunaute } from "@/lib/communaute/types";

// Le champ de publication façon capture (spec sondages, quiz et programmation, §1 à §5) : la rangée d'options, le sondage
// avec texte, le sondage avec images, le quiz, « Publier ▾ Programmer… » et un seul ajout par publication.
const upload = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: (...a: unknown[]) => upload(...a), remove: vi.fn(async () => ({})) }) } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/communaute/EditeurTexte", () => import("./editeur-simule"));
const publierPublication = vi.fn();
vi.mock("@/lib/communaute/actions", () => ({ publierPublication: (...a: unknown[]) => publierPublication(...a) }));

const { ChampPublication } = await import("@/components/communaute/ChampPublication");

const GENERAL: Espace = { id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true };
const MOI: MoiCommunaute = { compteId: "22222222-2222-4222-8222-222222222222", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const OK = { ok: true, id: "11111111-1111-4111-8111-111111111111", statut: "publiee", apercu: null, video: null };

async function ouvrir() {
  const user = userEvent.setup();
  const onPubliee = vi.fn(() => true);
  render(
    <ToastProvider>
      <ChampPublication espace={GENERAL} moi={MOI} onPubliee={onPubliee} />
    </ToastProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Quoi de neuf, Koffi ?" }));
  await user.type(await screen.findByRole("textbox", { name: "Nouvelle publication" }), "Votre avis ?");
  return { user, onPubliee };
}

describe("Le champ de publication : options, sondages, quiz", () => {
  beforeEach(() => {
    publierPublication.mockReset().mockResolvedValue(OK);
    upload.mockReset().mockResolvedValue({ error: null });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:image");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("la rangée d'options de la capture", async () => {
    await ouvrir();
    const rangee = screen.getByRole("group", { name: "Ajouter à la publication" });
    expect(within(rangee).getAllByRole("button").map((b) => b.textContent)).toEqual(["Image", "Sondage avec images", "Sondage avec texte", "Quiz", "Vidéo", "Fichier"]);
  });

  it("sondage avec texte : options, plusieurs réponses, fin ; publié avec la publication", async () => {
    const { user } = await ouvrir();
    await user.click(screen.getByRole("button", { name: "Sondage avec texte" }));
    await user.type(screen.getByRole("textbox", { name: "Option 1" }), "Le matin");
    await user.type(screen.getByRole("textbox", { name: "Option 2" }), "Le soir");
    await user.click(screen.getByRole("button", { name: "Ajouter une option" }));
    await user.type(screen.getByRole("textbox", { name: "Option 3" }), "La nuit");
    await user.click(screen.getByRole("checkbox", { name: "Plusieurs réponses possibles" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Fin du sondage" }), "3");
    await user.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(publierPublication).toHaveBeenCalled());
    expect(publierPublication.mock.calls[0].slice(0, 5)).toEqual([null, "", "Votre avis ?", null, null]);
    expect(publierPublication.mock.calls[0][5]).toEqual({
      sondage: { type: "texte", choixMultiples: true, dureeJours: 3, explication: "", options: [{ texte: "Le matin" }, { texte: "Le soir" }, { texte: "La nuit" }] },
      publieLe: null,
    });
  });

  it("quiz : la bonne réponse cochée et l'explication", async () => {
    const { user } = await ouvrir();
    await user.click(screen.getByRole("button", { name: "Quiz" }));
    await user.type(screen.getByRole("textbox", { name: "Réponse 1" }), "Lyon");
    await user.type(screen.getByRole("textbox", { name: "Réponse 2" }), "Paris");
    await user.click(screen.getByRole("radio", { name: "Bonne réponse : réponse 2" }));
    await user.type(screen.getByRole("textbox", { name: "Explication (facultative)" }), "C’est la capitale.");
    await user.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(publierPublication).toHaveBeenCalled());
    expect(publierPublication.mock.calls[0][5].sondage).toEqual({
      type: "quiz",
      choixMultiples: false,
      dureeJours: null,
      explication: "C’est la capitale.",
      options: [
        { texte: "Lyon", correcte: false },
        { texte: "Paris", correcte: true },
      ],
    });
  });

  it("sondage avec images : chaque image déposée dans le dossier du compte, puis publiée", async () => {
    const { user } = await ouvrir();
    await user.click(screen.getByRole("button", { name: "Sondage avec images" }));
    await user.upload(screen.getByLabelText("Image de l’option 1"), new File([PNG], "rouge.png", { type: "image/png" }));
    await user.upload(screen.getByLabelText("Image de l’option 2"), new File([PNG], "bleu.png", { type: "image/png" }));
    await user.type(screen.getByRole("textbox", { name: "Libellé de l’option 1 (facultatif)" }), "Rouge");
    await user.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(publierPublication).toHaveBeenCalled());
    expect(upload).toHaveBeenCalledTimes(2);
    const options = publierPublication.mock.calls[0][5].sondage.options;
    expect(options.map((o: { texte: string }) => o.texte)).toEqual(["Rouge", ""]);
    expect(options[0].image).toMatchObject({ nom: "rouge.png", type: "image/png" });
    expect(options[0].image.chemin).toMatch(new RegExp(`^${MOI.compteId}/`));
  });

  it("une heure devenue trop proche est refusée avant tout dépôt d'image (revue finale, I3)", async () => {
    const { user } = await ouvrir();
    await user.click(screen.getByRole("button", { name: "Sondage avec images" }));
    await user.upload(screen.getByLabelText("Image de l’option 1"), new File([PNG], "rouge.png", { type: "image/png" }));
    await user.upload(screen.getByLabelText("Image de l’option 2"), new File([PNG], "bleu.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Plus d’options de publication" }));
    await user.click(screen.getByRole("menuitem", { name: "Programmer…" }));
    const fenetre = screen.getByRole("dialog", { name: "Programmer la publication" });
    const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date(Date.now() + 2 * 86_400_000));
    fireEvent.change(within(fenetre).getByLabelText("Date"), { target: { value: jour } });
    fireEvent.change(within(fenetre).getByLabelText("Heure"), { target: { value: "15:00" } });
    await user.click(within(fenetre).getByRole("button", { name: "Programmer" }));
    // Le temps a passé : il ne reste que 5 minutes avant l'heure choisie.
    vi.useFakeTimers({ toFake: ["Date"], now: Date.parse(`${jour}T15:00:00+01:00`) - 5 * 60_000 });
    try {
      await user.click(screen.getByRole("button", { name: "Programmer" }));
      expect(await screen.findByText("Choisissez une heure au moins 10 minutes plus tard.")).toBeInTheDocument();
      expect(upload).not.toHaveBeenCalled();
      expect(publierPublication).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("un seul ajout : choisir une image remplace le sondage, après confirmation", async () => {
    const { user } = await ouvrir();
    await user.click(screen.getByRole("button", { name: "Sondage avec texte" }));
    await user.type(screen.getByRole("textbox", { name: "Option 1" }), "A");
    await user.click(screen.getByRole("button", { name: "Vidéo" }));
    const fenetre = screen.getByRole("dialog", { name: "Remplacer le sondage ?" });
    await user.click(within(fenetre).getByRole("button", { name: "Remplacer" }));
    expect(screen.queryByRole("textbox", { name: "Option 1" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Lien de la vidéo" })).toBeInTheDocument();
  });
});

describe("Programmer", () => {
  beforeEach(() => {
    publierPublication.mockReset().mockResolvedValue(OK);
  });

  it("« Publier ▾ » → Programmer… : la date et l'heure du Bénin ; le bouton devient « Programmer » ; publiée avec l'heure", async () => {
    const { user, onPubliee } = await ouvrir();
    await user.click(screen.getByRole("button", { name: "Plus d’options de publication" }));
    await user.click(screen.getByRole("menuitem", { name: "Programmer…" }));
    const fenetre = screen.getByRole("dialog", { name: "Programmer la publication" });
    const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date(Date.now() + 2 * 86_400_000));
    fireEvent.change(within(fenetre).getByLabelText("Date"), { target: { value: jour } });
    fireEvent.change(within(fenetre).getByLabelText("Heure"), { target: { value: "15:00" } });
    await user.click(within(fenetre).getByRole("button", { name: "Programmer" }));
    expect(screen.getByText(/^Programmée pour le /)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Programmer" }));
    await waitFor(() => expect(publierPublication).toHaveBeenCalled());
    expect(publierPublication.mock.calls[0][5]).toEqual({ sondage: null, publieLe: `${jour}T15:00:00+01:00` });
    // Programmée : pas dans le fil tout de suite ; le message dit quand.
    expect(onPubliee).not.toHaveBeenCalled();
    expect(await screen.findByText("Publication programmée")).toBeInTheDocument();
  });

  it("une heure trop proche est refusée dans la fenêtre ; « Ne plus programmer » revient à « Publier »", async () => {
    const { user } = await ouvrir();
    await user.click(screen.getByRole("button", { name: "Plus d’options de publication" }));
    await user.click(screen.getByRole("menuitem", { name: "Programmer…" }));
    const fenetre = screen.getByRole("dialog", { name: "Programmer la publication" });
    const hier = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date(Date.now() - 86_400_000));
    fireEvent.change(within(fenetre).getByLabelText("Date"), { target: { value: hier } });
    fireEvent.change(within(fenetre).getByLabelText("Heure"), { target: { value: "10:00" } });
    await user.click(within(fenetre).getByRole("button", { name: "Programmer" }));
    expect(within(fenetre).getByText("Choisissez une heure au moins 10 minutes plus tard.")).toBeInTheDocument();
    const demain = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date(Date.now() + 86_400_000));
    fireEvent.change(within(fenetre).getByLabelText("Date"), { target: { value: demain } });
    await user.click(within(fenetre).getByRole("button", { name: "Programmer" }));
    await user.click(screen.getByRole("button", { name: "Ne plus programmer" }));
    expect(screen.getByRole("button", { name: "Publier" })).toBeInTheDocument();
  });
});
