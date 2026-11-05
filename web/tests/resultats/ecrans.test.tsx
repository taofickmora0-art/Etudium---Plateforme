// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MODELES_BAREME, REGLES_PAR_DEFAUT } from "@/lib/resultats/calcul";
import type { Note, ParcoursComplet } from "@/lib/resultats/types";

// Les écrans de « Mes résultats » (spec du 5 novembre 2026, §2) : la liste des parcours, la fenêtre d'un parcours et
// ses règles, la vue d'un semestre (tuiles, cartes des UE, détail des ECUE, « ce qu'il te faut »), la saisie d'une note.

const enregistrerParcours = vi.fn();
const enregistrerNote = vi.fn();
vi.mock("@/lib/resultats/actions", () => ({
  enregistrerParcours: (...a: unknown[]) => enregistrerParcours(...a),
  enregistrerNote: (...a: unknown[]) => enregistrerNote(...a),
  enregistrerSemestre: vi.fn(),
  enregistrerUe: vi.fn(),
  enregistrerEcue: vi.fn(),
  supprimerElement: vi.fn(),
  deplacerElement: vi.fn(),
  creerPin: vi.fn(),
  changerPin: vi.fn(),
  retirerPin: vi.fn(),
  verrouillerResultats: vi.fn(),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/mes-resultats" }));

const { ListeParcours } = await import("@/components/resultats/ListeParcours");
const { VueParcours } = await import("@/components/resultats/VueParcours");
const { NAV_MON_ESPACE } = await import("@/lib/navigation");

let n = 0;
const note = (ecueId: string, categorie: string, valeur: number, sur = 20): Note => ({
  id: `n${++n}`,
  ecueId,
  categorie,
  libelle: "",
  note: valeur,
  sur,
  rattrapage: false,
  date: null,
  creeLe: `2026-10-0${n % 9}T10:00:00Z`,
});

// S1 : UE 101 (5 crédits) = Physiologie végétale (2) : CC (12 ; 13) = 12,5, examen 10 → 11 ; Botanique (3) : 10 et 10 → 10.
//      L'UE : (2 × 11 + 3 × 10) / 5 = 10,40 → validée, mention Passable.
// S2 : UE 201 = Science du sol : CC 12, examen à venir → 0,4 × 12 + 0,6 x ≥ 10 → x ≥ 8,67 ; une note de TP (type absent).
const complet: ParcoursComplet = {
  parcours: { id: "p1", nom: "Licence en agronomie", etablissement: "UAC", regles: REGLES_PAR_DEFAUT, ordre: 1 },
  semestres: [
    { id: "s1", parcoursId: "p1", nom: "Semestre 1", annee: "2025-2026", ordre: 1 },
    { id: "s2", parcoursId: "p1", nom: "Semestre 2", annee: "2025-2026", ordre: 2 },
  ],
  ues: [
    { id: "u1", semestreId: "s1", code: "UE 101", intitule: "Agronomie générale", credits: 5, ordre: 1 },
    { id: "u2", semestreId: "s2", code: "UE 201", intitule: "Pédologie", credits: 4, ordre: 1 },
  ],
  ecues: [
    { id: "e1", ueId: "u1", intitule: "Physiologie végétale", poids: 2, bareme: null, ordre: 1 },
    { id: "e2", ueId: "u1", intitule: "Botanique", poids: 3, bareme: null, ordre: 2 },
    { id: "e3", ueId: "u2", intitule: "Science du sol", poids: 1, bareme: null, ordre: 1 },
  ],
  notes: [note("e1", "cc", 12), note("e1", "cc", 13), note("e1", "examen", 10), note("e2", "cc", 10), note("e2", "examen", 10), note("e3", "cc", 12), note("e3", "tp", 15)],
};

beforeEach(() => {
  for (const f of [enregistrerParcours, enregistrerNote, push]) f.mockReset();
  enregistrerParcours.mockResolvedValue({ ok: true, id: "p2" });
  enregistrerNote.mockResolvedValue({ ok: true, id: "n9" });
});

describe("La liste des parcours", () => {
  it("aucun parcours : « Crée ton premier parcours » ; la fenêtre envoie les règles du modèle choisi", async () => {
    const user = userEvent.setup();
    render(<ListeParcours parcours={[]} pin={false} />);
    expect(screen.getByRole("heading", { name: "Crée ton premier parcours" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Nouveau parcours" })[0]);
    const fenetre = screen.getByRole("dialog", { name: "Nouveau parcours" });
    await user.type(within(fenetre).getByLabelText("Nom du parcours"), "Licence en agronomie");
    await user.type(within(fenetre).getByLabelText("Établissement"), "UAC");
    await user.click(within(fenetre).getByRole("radio", { name: /30 % \/ 70 %/ }));
    await user.click(within(fenetre).getByRole("button", { name: "Créer le parcours" }));
    await waitFor(() =>
      expect(enregistrerParcours).toHaveBeenCalledWith({
        nom: "Licence en agronomie",
        etablissement: "UAC",
        regles: { ...REGLES_PAR_DEFAUT, categories: MODELES_BAREME.find((m) => m.cle === "30-70")!.categories },
      }),
    );
    expect(push).toHaveBeenCalledWith("/mes-resultats/p2");
  });

  it("un parcours : sa moyenne générale et ses crédits", () => {
    render(<ListeParcours parcours={[complet]} pin={false} />);
    const lien = screen.getByRole("link", { name: /Licence en agronomie/ });
    expect(lien).toHaveAttribute("href", "/mes-resultats/p1");
    expect(lien).toHaveTextContent("11,11");
    expect(lien).toHaveTextContent("5 / 9 crédits");
  });
});

describe("La vue d'un semestre", () => {
  it("les tuiles, la carte d'UE « Validée » et le détail de ses ECUE par type", () => {
    render(<VueParcours complet={complet} semestreId={undefined} pin={false} />);
    expect(screen.getByRole("link", { name: "Semestre 1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("group", { name: "Moyenne du semestre" })).toHaveTextContent("10,40");
    expect(screen.getByRole("group", { name: "Crédits" })).toHaveTextContent("5 / 5");
    expect(screen.getByRole("group", { name: "Mention" })).toHaveTextContent("Passable");
    const ue = screen.getByRole("article", { name: "UE 101 · Agronomie générale" });
    expect(ue).toHaveTextContent("Validée");
    expect(ue).toHaveTextContent("Physiologie végétale");
    expect(ue).toHaveTextContent("Contrôle continu 12,50 · Examen 10,00");
  });

  it("l'examen à venir : « Il te faut au moins 8,67/20 » ; une note d'un type disparu est signalée", () => {
    render(<VueParcours complet={complet} semestreId="s2" pin={false} />);
    const ue = screen.getByRole("article", { name: "UE 201 · Pédologie" });
    expect(ue).toHaveTextContent("Provisoire");
    expect(within(ue).getByText("Il te faut au moins 8,67/20 à l’examen pour valider l’UE.")).toBeInTheDocument();
    expect(within(ue).getByText("1 note d’un type retiré du barème ne compte pas.")).toBeInTheDocument();
  });

  it("ajouter une note l'envoie avec son type, sa valeur et son barème", async () => {
    const user = userEvent.setup();
    render(<VueParcours complet={complet} semestreId="s1" pin={false} />);
    await user.click(screen.getByRole("button", { name: "Ajouter une note à « Physiologie végétale »" }));
    const fenetre = screen.getByRole("dialog", { name: "Nouvelle note" });
    await user.type(within(fenetre).getByLabelText("Libellé"), "Interrogation 3");
    await user.type(within(fenetre).getByLabelText("Note obtenue"), "14,5");
    await user.click(within(fenetre).getByRole("button", { name: "Ajouter la note" }));
    await waitFor(() =>
      expect(enregistrerNote).toHaveBeenCalledWith({ ecueId: "e1", categorie: "cc", libelle: "Interrogation 3", note: 14.5, sur: 20, rattrapage: false, date: null }),
    );
  });

  it("une note hors barème est refusée avant l'envoi", async () => {
    const user = userEvent.setup();
    render(<VueParcours complet={complet} semestreId="s1" pin={false} />);
    await user.click(screen.getByRole("button", { name: "Ajouter une note à « Botanique »" }));
    const fenetre = screen.getByRole("dialog", { name: "Nouvelle note" });
    await user.type(within(fenetre).getByLabelText("Note obtenue"), "24");
    await user.click(within(fenetre).getByRole("button", { name: "Ajouter la note" }));
    expect(await within(fenetre).findByText("La note doit être entre 0 et 20.")).toBeInTheDocument();
    expect(enregistrerNote).not.toHaveBeenCalled();
  });
});

describe("Le menu", () => {
  it("« Mes résultats » vient juste après le tableau de bord", () => {
    const liens = NAV_MON_ESPACE.map((e) => [e.href, e.label]);
    expect(liens.slice(0, 2)).toEqual([
      ["/tableau-de-bord", "Tableau de bord"],
      ["/mes-resultats", "Mes résultats"],
    ]);
  });
});
