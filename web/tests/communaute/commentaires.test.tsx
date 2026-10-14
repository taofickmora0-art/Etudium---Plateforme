// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EtatReponses } from "@/components/communaute/Reponses";
import { ToastProvider } from "@/components/ui/Toast";
import type { MoiCommunaute, Reponse } from "@/lib/communaute/types";

// Les commentaires (communauté v3, étape 2) : Répondre (un niveau), J’aime, menu ⋮, « Voir plus de commentaires ».
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/communaute" }));
vi.mock("@/lib/communaute/actions", () => ({
  repondre: vi.fn(),
  supprimerReponse: vi.fn(),
  chargerReponses: vi.fn(),
  modifierReponse: vi.fn(),
  aimerReponse: vi.fn(),
  signaler: vi.fn(),
}));
const actions = await import("@/lib/communaute/actions");
const { Reponses } = await import("@/components/communaute/Reponses");
const { DetailPublication } = await import("@/components/communaute/DetailPublication");

const PUB = "11111111-1111-4111-8111-111111111111";
const MOI: MoiCommunaute = { compteId: "moi", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const rep = (id: string, texte: string, o: Partial<Reponse> = {}): Reponse => ({
  id,
  auteur: { prenom: "Awa", nomCourt: "Awa K." },
  estMoi: false,
  texte,
  creeLe: "2026-10-14T14:00:00Z",
  peutSupprimer: false,
  peutSignaler: true,
  parentId: null,
  reactions: 0,
  jAime: false,
  modifie: false,
  peutModifier: false,
  ...o,
});

function Essai({ initial }: { initial: EtatReponses }) {
  const [etat, setEtat] = useState(initial);
  return (
    <ToastProvider>
      <Reponses publicationId={PUB} etat={etat} onChange={setEtat} moi={MOI} maintenant={new Date("2026-10-14T15:00:00Z")} />
      <p>Total : {etat.total}</p>
    </ToastProvider>
  );
}
const commentaire = (id: string) => document.getElementById(`commentaire-${id}`)!;

describe("Les commentaires", () => {
  beforeEach(() => {
    for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  });

  it("les réponses s'affichent sous leur commentaire, décalées ; « modifié » ; le nombre de J’aime", () => {
    render(
      <Essai
        initial={{
          reponses: [rep("c1", "Question ?", { reactions: 3, modifie: true }), rep("r1", "Réponse", { parentId: "c1", auteur: { prenom: "Moussa", nomCourt: "Moussa B." } })],
          total: 2,
          completes: true,
        }}
      />,
    );
    const fil = within(commentaire("c1"));
    expect(fil.getByText("Réponse")).toBeInTheDocument();
    expect(commentaire("r1").closest("[data-reponses]")).not.toBeNull();
    expect(fil.getByText(/modifié/)).toBeInTheDocument();
    expect(fil.getByRole("button", { name: "J’aime le commentaire de Awa K." })).toHaveTextContent("3");
  });

  it("Répondre : le champ sous le commentaire ; la réponse s'ajoute dessous ; répondre à une réponse cite son auteur et vise le même commentaire", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.repondre).mockResolvedValueOnce({ ok: true, reponse: rep("r2", "Merci !", { parentId: "c1", estMoi: true, auteur: { prenom: "Koffi", nomCourt: "Koffi D." } }) });
    render(<Essai initial={{ reponses: [rep("c1", "Question ?"), rep("r1", "Réponse", { parentId: "c1", auteur: { prenom: "Moussa", nomCourt: "Moussa B." } })], total: 2, completes: true }} />);
    await user.click(screen.getByRole("button", { name: "Répondre à Moussa B." }));
    const champ = screen.getByRole("textbox", { name: "Répondre à Moussa B." });
    expect(champ).toHaveValue("@Moussa B. ");
    await user.type(champ, "Merci !");
    await user.click(screen.getByRole("button", { name: "Envoyer la réponse" }));
    expect(actions.repondre).toHaveBeenCalledWith(PUB, "@Moussa B. Merci !", "c1");
    expect(await within(commentaire("c1")).findByText("Merci !")).toBeInTheDocument();
    expect(screen.getByText("Total : 3")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Répondre à Moussa B." })).toBeNull();
  });

  it("J’aime un commentaire : l'état et le nombre de la base", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.aimerReponse).mockResolvedValueOnce({ ok: true, jAime: true, reactions: 1 });
    render(<Essai initial={{ reponses: [rep("c1", "Question ?")], total: 1, completes: true }} />);
    await user.click(screen.getByRole("button", { name: "J’aime le commentaire de Awa K." }));
    expect(actions.aimerReponse).toHaveBeenCalledWith("c1");
    const bouton = await screen.findByRole("button", { name: "Retirer la mention J’aime du commentaire de Awa K." });
    expect(bouton).toHaveAttribute("aria-pressed", "true");
    expect(bouton).toHaveTextContent("1");
  });

  it("le menu ⋮ : Copier le lien (adresse de la publication et du commentaire), Signaler ; pas Modifier ni Supprimer chez les autres", async () => {
    const user = userEvent.setup();
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: ecrire } });
    render(<Essai initial={{ reponses: [rep("c1", "Question ?")], total: 1, completes: true }} />);
    await user.click(screen.getByRole("button", { name: "Actions sur le commentaire de Awa K." }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Copier le lien", "Signaler"]);
    await user.click(within(menu).getByRole("menuitem", { name: "Copier le lien" }));
    expect(ecrire).toHaveBeenCalledWith(`${window.location.origin}/communaute/publications/${PUB}#commentaire-c1`);
    expect(await screen.findByText("Lien copié")).toBeInTheDocument();
  });

  it("Modifier (auteur ou équipe) : le champ, Enregistrer, « modifié » ; Supprimer retire le commentaire et ses réponses", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.modifierReponse).mockResolvedValueOnce({ ok: true });
    vi.mocked(actions.supprimerReponse).mockResolvedValueOnce({ ok: true });
    const mien = { estMoi: true, auteur: { prenom: "Koffi", nomCourt: "Koffi D." }, peutModifier: true, peutSupprimer: true, peutSignaler: false };
    render(<Essai initial={{ reponses: [rep("c1", "Avant", mien), rep("r1", "Réponse", { parentId: "c1" })], total: 2, completes: true }} />);
    await user.click(screen.getByRole("button", { name: "Actions sur le commentaire de Koffi D." }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Copier le lien", "Modifier", "Supprimer"]);
    await user.click(screen.getByRole("menuitem", { name: "Modifier" }));
    const champ = screen.getByRole("textbox", { name: "Modifier le commentaire" });
    await user.clear(champ);
    await user.type(champ, "Après");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(actions.modifierReponse).toHaveBeenCalledWith("c1", "Après");
    expect(await within(commentaire("c1")).findByText("Après")).toBeInTheDocument();
    expect(within(commentaire("c1")).getByText(/modifié/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actions sur le commentaire de Koffi D." }));
    await user.click(screen.getByRole("menuitem", { name: "Supprimer" }));
    expect(actions.supprimerReponse).toHaveBeenCalledWith("c1");
    await waitFor(() => expect(screen.queryByText("Réponse")).toBeNull());
    expect(screen.getByText("Total : 0")).toBeInTheDocument();
  });

  it("« Voir plus de commentaires » charge tous les commentaires et leurs réponses", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.chargerReponses).mockResolvedValueOnce({ ok: true, reponses: [rep("c0", "Ancien"), rep("r0", "Sous l’ancien", { parentId: "c0" }), rep("c1", "Récent")] });
    render(<Essai initial={{ reponses: [rep("c1", "Récent")], total: 3, completes: false }} />);
    await user.click(screen.getByRole("button", { name: "Voir plus de commentaires" }));
    expect(await within(commentaire("c0")).findByText("Sous l’ancien")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voir plus de commentaires" })).toBeNull();
  });
});

describe("Le lien d'un commentaire", () => {
  it("la page de la publication défile jusqu'au commentaire de l'adresse (#commentaire-…)", async () => {
    const defile = vi.fn();
    Element.prototype.scrollIntoView = defile;
    window.history.replaceState(null, "", "/communaute/publications/p1#commentaire-r1");
    render(
      <ToastProvider>
        <DetailPublication
          moi={MOI}
          maintenant="2026-10-14T15:00:00Z"
          publication={{
            id: "p1",
            auteur: { prenom: "Mireille", nom: "Adjovi", role: null },
            estMoi: false,
            espace: { id: null, nom: "général" },
            titre: "",
            texte: "Le texte",
            pieceJointe: null,
            creeLe: "2026-10-14T13:00:00Z",
            modifiee: false,
            statut: "publiee",
            reactions: 0,
            jAime: false,
            reponses: 1,
            dernieresReponses: [],
            peutSupprimer: false,
            peutSignaler: true,
            apercu: null,
            enregistree: false,
            aimeePar: [],
            video: null,
            toutesReponses: [rep("r1", "Le commentaire visé")],
          }}
        />
      </ToastProvider>,
    );
    await waitFor(() => expect(defile).toHaveBeenCalled());
    expect(defile.mock.contexts[0]).toBe(document.getElementById("commentaire-r1"));
    window.history.replaceState(null, "", "/");
  });
});
