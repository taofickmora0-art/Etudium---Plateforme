// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { LeconAdmin } from "@/lib/admin/types";

// L'éditeur de leçon en deux colonnes (refonte des formations, étape A, spec §3.4, d'après izimentor).
vi.mock("@/lib/admin/actions", () => ({
  saveLecon: vi.fn(),
  changerStatutLecon: vi.fn(),
  addRessource: vi.fn(),
  updateRessource: vi.fn(),
  deleteRessource: vi.fn(),
  deplacer: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/components/communaute/EditeurTexte", () => import("../communaute/editeur-simule"));
const actions = await import("@/lib/admin/actions");
const { EditeurLecon } = await import("@/components/admin/EditeurLecon");

const LECON: LeconAdmin = {
  id: "l2",
  moduleId: "m1",
  formationId: "f1",
  formationTitre: "Maîtriser Excel",
  formationSlug: "excel",
  titre: "Les formules",
  titreCourt: null,
  dureeSecondes: 760,
  apercu: false,
  resume: "",
  pointsCles: [],
  video: { fournisseur: "youtube", id: "dQw4w9WgXcQ" },
  texte: "Un **texte**",
  ressources: [],
  publiee: false,
  commentairesActifs: true,
  position: { rang: 2, total: 5, module: { rang: 1, titre: "Les bases" } },
  voisines: { precedente: "l1", suivante: "l3" },
};

function afficher(lecon: LeconAdmin = LECON, base?: "/admin/formations" | "/formateur/formations") {
  return render(
    <ToastProvider>
      <EditeurLecon lecon={lecon} base={base} />
    </ToastProvider>,
  );
}
const envoye = () => vi.mocked(actions.saveLecon).mock.calls.at(-1)![1] as FormData;

describe("L'éditeur de leçon", () => {
  beforeEach(() => {
    for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
    push.mockReset();
    vi.mocked(actions.saveLecon).mockResolvedValue({ status: "success" });
  });

  it("la barre du haut : retour aux leçons, position, voisines, statut, voir comme un étudiant", () => {
    afficher();
    expect(screen.getByRole("link", { name: "Retour aux leçons (Maîtriser Excel)" })).toHaveAttribute("href", "/admin/formations/f1?onglet=programme");
    expect(screen.getByText("Leçon 2 sur 5 · Module 1 : Les bases")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leçon précédente" })).toHaveAttribute("href", "/admin/formations/f1/lecons/l1");
    expect(screen.getByRole("link", { name: "Leçon suivante" })).toHaveAttribute("href", "/admin/formations/f1/lecons/l3");
    expect(screen.getByRole("button", { name: "Statut : Brouillon" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir comme un étudiant" })).toHaveAttribute("href", "/formations/excel/lecons/l2");
  });

  it("les réglages : la vidéo reconnue et son aperçu, la durée en minutes et secondes, les deux cases ; le titre et le texte", async () => {
    afficher();
    const reglages = screen.getByRole("region", { name: "Réglages" });
    expect(within(reglages).getByRole("textbox", { name: "Lien de la vidéo" })).toHaveValue("https://youtu.be/dQw4w9WgXcQ");
    expect(within(reglages).getByTitle("Vidéo : Les formules")).toBeInTheDocument();
    expect(within(reglages).getByRole("spinbutton", { name: "Minutes" })).toHaveValue(12);
    expect(within(reglages).getByRole("spinbutton", { name: "Secondes" })).toHaveValue(40);
    expect(within(reglages).getByRole("checkbox", { name: "Activer les commentaires" })).toBeChecked();
    expect(within(reglages).getByRole("checkbox", { name: "Leçon d’aperçu gratuite" })).not.toBeChecked();
    expect(within(reglages).getByRole("heading", { name: "Documents & fichiers" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Titre de la leçon" })).toHaveValue("Les formules");
    // L'éditeur mis en forme se charge à part.
    expect(await screen.findByRole("textbox", { name: "Texte de la leçon" })).toHaveValue("Un **texte**");
  });

  it("« Enregistrer » envoie tout ; « La leçon a bien été mise à jour. »", async () => {
    const user = userEvent.setup();
    afficher();
    await user.clear(screen.getByRole("textbox", { name: "Titre de la leçon" }));
    await user.type(screen.getByRole("textbox", { name: "Titre de la leçon" }), "Les formules essentielles");
    await user.clear(screen.getByRole("spinbutton", { name: "Minutes" }));
    await user.type(screen.getByRole("spinbutton", { name: "Minutes" }), "3");
    await user.clear(screen.getByRole("spinbutton", { name: "Secondes" }));
    await user.type(screen.getByRole("spinbutton", { name: "Secondes" }), "5");
    await user.click(screen.getByRole("checkbox", { name: "Activer les commentaires" }));
    await user.click(screen.getByRole("checkbox", { name: "Leçon d’aperçu gratuite" }));
    await user.type(await screen.findByRole("textbox", { name: "Texte de la leçon" }), " !");
    await user.click(screen.getByRole("button", { name: "Dans cette leçon" }));
    await user.type(screen.getByRole("textbox", { name: "Résumé" }), "Les bases du calcul.");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(actions.saveLecon).toHaveBeenCalled());
    const fd = envoye();
    expect({
      id: fd.get("id"),
      titre: fd.get("titre"),
      duree: fd.get("duree"),
      video: fd.get("video"),
      commentaires: fd.get("commentaires_actifs"),
      apercu: fd.get("apercu"),
      texte: fd.get("texte"),
      resume: fd.get("resume"),
    }).toEqual({
      id: "l2",
      titre: "Les formules essentielles",
      duree: "3:05",
      video: "https://youtu.be/dQw4w9WgXcQ",
      commentaires: null,
      apercu: "on",
      texte: "Un **texte** !",
      resume: "Les bases du calcul.",
    });
    expect(await screen.findByText("La leçon a bien été mise à jour.")).toBeInTheDocument();
  });

  it("le statut change aussitôt, sans enregistrer", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.changerStatutLecon).mockResolvedValue({ ok: true });
    afficher();
    await user.click(screen.getByRole("button", { name: "Statut : Brouillon" }));
    await user.click(screen.getByRole("menuitem", { name: "Publier" }));
    expect(actions.changerStatutLecon).toHaveBeenCalledWith("l2", true);
    expect(await screen.findByRole("button", { name: "Statut : Publiée" })).toBeInTheDocument();
    expect(actions.saveLecon).not.toHaveBeenCalled();
  });

  it("des changements non enregistrés : quitter demande confirmation (lien et fermeture de l'onglet)", async () => {
    const user = userEvent.setup();
    afficher();
    // Sans changement : on part sans question.
    await user.click(screen.getByRole("link", { name: "Leçon suivante" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Titre de la leçon" }), " (modifiée)");
    const quitter = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(quitter);
    expect(quitter.defaultPrevented).toBe(true);
    await user.click(screen.getByRole("link", { name: "Retour aux leçons (Maîtriser Excel)" }));
    const fenetre = screen.getByRole("dialog", { name: "Quitter sans enregistrer ?" });
    await user.click(within(fenetre).getByRole("button", { name: "Quitter" }));
    expect(push).toHaveBeenCalledWith("/admin/formations/f1?onglet=programme");
  });

  it("la première leçon n'a pas de précédente ; espace formateur : ses adresses", () => {
    afficher({ ...LECON, voisines: { precedente: null, suivante: null }, position: { rang: 1, total: 1, module: { rang: 1, titre: "Les bases" } } }, "/formateur/formations");
    expect(screen.queryByRole("link", { name: "Leçon précédente" })).toBeNull();
    expect(screen.getByRole("link", { name: "Retour aux leçons (Maîtriser Excel)" })).toHaveAttribute("href", "/formateur/formations/f1?onglet=programme");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  });
});
