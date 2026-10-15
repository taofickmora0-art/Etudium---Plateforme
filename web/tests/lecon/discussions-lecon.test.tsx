// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { MoiCommunaute, Reponse } from "@/lib/communaute/types";

// La section « Discussions de la leçon » (refonte des formations, étape B, spec §1.6) : le même écran que les
// commentaires de la communauté, avec les actions de la leçon.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations/excel/lecons/l1" }));
vi.mock("@/lib/lecon/discussions", () => ({
  chargerDiscussion: vi.fn(),
  commenterLecon: vi.fn(),
  modifierCommentaireLecon: vi.fn(),
  aimerCommentaireLecon: vi.fn(),
  supprimerCommentaireLecon: vi.fn(),
  signalerCommentaireLecon: vi.fn(),
}));
vi.mock("@/lib/communaute/actions", () => ({ repondre: vi.fn(), chargerReponses: vi.fn(), modifierReponse: vi.fn(), aimerReponse: vi.fn(), supprimerReponse: vi.fn(), signaler: vi.fn() }));
const actions = await import("@/lib/lecon/discussions");
const { DiscussionsLecon } = await import("@/components/lecon/DiscussionsLecon");

const L = "11111111-1111-4111-8111-111111111111";
const MOI: MoiCommunaute = { compteId: "moi", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const rep = (id: string, texte: string, o: Partial<Reponse> = {}): Reponse => ({
  id,
  auteur: { prenom: "Mireille", nomCourt: "Mireille A." },
  estMoi: false,
  texte,
  creeLe: "2026-10-15T09:00:00Z",
  peutSupprimer: false,
  peutSignaler: true,
  parentId: null,
  reactions: 0,
  jAime: false,
  modifie: false,
  peutModifier: false,
  ...o,
});
function afficher(reponses: Reponse[] = [rep("c1", "Le lien est dans les documents.", { formateur: true })], total = reponses.length) {
  render(
    <ToastProvider>
      <DiscussionsLecon leconId={L} slug="excel" initial={{ reponses, total }} moi={MOI} maintenant={new Date("2026-10-15T10:00:00Z")} />
    </ToastProvider>,
  );
}

describe("Discussions de la leçon", () => {
  beforeEach(() => {
    for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  });

  it("le titre, le nombre, l'étiquette « Formateur », le champ « Rédiger un commentaire »", () => {
    afficher();
    const section = screen.getByRole("region", { name: "Discussions de la leçon" });
    expect(within(section).getByText("1 commentaire")).toBeInTheDocument();
    expect(within(section).getByText("Formateur")).toBeInTheDocument();
    expect(within(section).getByRole("textbox", { name: "Rédiger un commentaire" })).toHaveAttribute("placeholder", "Rédiger un commentaire…");
  });

  it("publier un commentaire et répondre : les actions de la leçon", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.commenterLecon)
      .mockResolvedValueOnce({ ok: true, reponse: rep("c2", "Merci !", { estMoi: true, auteur: { prenom: "Koffi", nomCourt: "Koffi D." } }) })
      .mockResolvedValueOnce({ ok: true, reponse: rep("r1", "Trouvé !", { estMoi: true, parentId: "c1", auteur: { prenom: "Koffi", nomCourt: "Koffi D." } }) });
    afficher();
    await user.type(screen.getByRole("textbox", { name: "Rédiger un commentaire" }), "Merci !");
    await user.click(screen.getByRole("button", { name: "Publier le commentaire" }));
    expect(actions.commenterLecon).toHaveBeenCalledWith(L, "Merci !", null);
    expect(await screen.findByText("Merci !")).toBeInTheDocument();
    expect(screen.getByText("2 commentaires")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Répondre à Mireille A." }));
    await user.type(screen.getByRole("textbox", { name: "Répondre à Mireille A." }), "Trouvé !");
    await user.click(screen.getByRole("button", { name: "Envoyer la réponse" }));
    expect(actions.commenterLecon).toHaveBeenLastCalledWith(L, "Trouvé !", "c1");
  });

  it("« Voir plus de commentaires » lit toute la discussion ; « Signaler » passe par la leçon", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.chargerDiscussion).mockResolvedValueOnce({ ok: true, reponses: [rep("c0", "Le premier"), rep("c1", "Le lien est dans les documents.")] });
    vi.mocked(actions.signalerCommentaireLecon).mockResolvedValueOnce({ ok: true });
    afficher(undefined, 2);
    await user.click(screen.getByRole("button", { name: "Voir plus de commentaires" }));
    expect(actions.chargerDiscussion).toHaveBeenCalledWith(L);
    expect(await screen.findByText("Le premier")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Actions sur le commentaire de Mireille A\./ })[0]);
    await user.click(screen.getByRole("menuitem", { name: "Signaler" }));
    const fenetre = screen.getByRole("dialog", { name: "Signaler ce commentaire" });
    await user.click(within(fenetre).getByRole("button", { name: "Envoyer le signalement" }));
    await waitFor(() => expect(actions.signalerCommentaireLecon).toHaveBeenCalledWith("c0", "inapproprie", ""));
  });

  it("un lien vers un commentaire hors de la première page (notification) : toute la discussion est lue, puis on y descend", async () => {
    const descendre = vi.fn();
    Element.prototype.scrollIntoView = descendre;
    window.location.hash = "#commentaire-c0";
    vi.mocked(actions.chargerDiscussion).mockResolvedValueOnce({ ok: true, reponses: [rep("c0", "La question d'il y a longtemps"), rep("c1", "Le lien est dans les documents.")] });
    afficher(undefined, 2);
    expect(actions.chargerDiscussion).toHaveBeenCalledWith(L);
    expect(await screen.findByText("La question d'il y a longtemps")).toBeInTheDocument();
    await waitFor(() => expect(descendre).toHaveBeenCalledWith({ block: "center" }));
    expect(descendre.mock.contexts.at(-1)).toHaveAttribute("id", "commentaire-c0");
    window.location.hash = "";
  });

  it("un lien vers un commentaire déjà affiché : on y descend sans rien relire", async () => {
    const descendre = vi.fn();
    Element.prototype.scrollIntoView = descendre;
    window.location.hash = "#commentaire-c1";
    afficher();
    await waitFor(() => expect(descendre).toHaveBeenCalledWith({ block: "center" }));
    expect(actions.chargerDiscussion).not.toHaveBeenCalled();
    window.location.hash = "";
  });

  it("aucune discussion encore : une invitation", () => {
    afficher([], 0);
    expect(screen.getByText("Aucun commentaire pour l’instant : posez la première question.")).toBeInTheDocument();
  });
});
