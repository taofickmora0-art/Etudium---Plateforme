// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AvisEquipe } from "@/lib/avis/types";

// Les chiffres clés des pages Avis, Corrections et Annonces du back-office, au style de l'espace étudiant (demande du
// 2 novembre 2026) : calculés à partir des données déjà lues, sans migration.

vi.mock("@/lib/avis/actions", () => ({ masquerAvis: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const { chiffresAvis, chiffresCorrections, chiffresAnnonces } = await import("@/lib/admin/chiffres-pages");
const { ListeAvis } = await import("@/components/admin/ListeAvis");

const MAINTENANT = new Date("2026-11-02T12:00:00Z");
const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();

const avis = (id: string, note: AvisEquipe["note"], plus: Partial<AvisEquipe> = {}): AvisEquipe => ({
  id,
  formationTitre: "Excel",
  formationSlug: "excel",
  auteur: "Aïcha",
  note,
  commentaire: `Commentaire ${id}`,
  masque: false,
  creeLe: ilYA(2),
  ...plus,
});
const AVIS = [avis("a1", 5), avis("a2", 4, { creeLe: ilYA(40) }), avis("a3", 1, { masque: true }), avis("a4", 2)];

describe("Les chiffres des avis", () => {
  it("la note moyenne et le nombre des avis visibles, les nouveaux sur 30 jours, les masqués", () => {
    expect(chiffresAvis(AVIS, MAINTENANT)).toEqual({ noteMoyenne: 3.7, visibles: 3, nouveaux: 3, masques: 1 });
  });

  it("sans avis visible : pas de note", () => {
    expect(chiffresAvis([avis("a1", 5, { masque: true })], MAINTENANT)).toEqual({ noteMoyenne: null, visibles: 0, nouveaux: 1, masques: 1 });
    expect(chiffresAvis([], MAINTENANT)).toEqual({ noteMoyenne: null, visibles: 0, nouveaux: 0, masques: 0 });
  });
});

describe("La page Avis", () => {
  it("les chiffres en haut, puis le filtre ; masquer un avis met les chiffres à jour", async () => {
    render(<ListeAvis avis={AVIS} maintenant={MAINTENANT.toISOString()} />);
    const tuile = (nom: string) => screen.getByText(nom).closest("[data-tuile]")?.textContent;
    expect(tuile("Note moyenne")).toBe("Note moyenne3,7");
    expect(tuile("Avis visibles")).toBe("Avis visibles3");
    expect(tuile("Nouveaux sur 30 jours")).toBe("Nouveaux sur 30 jours3");
    expect(tuile("Avis masqués")).toBe("Avis masqués1");
    fireEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Masquer" }));
    await waitFor(() => expect(tuile("Avis masqués")).toBe("Avis masqués2"));
    expect(tuile("Avis visibles")).toBe("Avis visibles2");
    expect(tuile("Note moyenne")).toBe("Note moyenne3,0");
  });

  it("le filtre : masqués, puis notes basses (1 ou 2 étoiles)", () => {
    render(<ListeAvis avis={AVIS} maintenant={MAINTENANT.toISOString()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Masqués/ }));
    expect(screen.getAllByRole("listitem").map((li) => within(li).getByText(/^Commentaire/).textContent)).toEqual(["Commentaire a3"]);
    fireEvent.click(screen.getByRole("button", { name: /^Notes basses/ }));
    expect(screen.getAllByRole("listitem").map((li) => within(li).getByText(/^Commentaire/).textContent)).toEqual(["Commentaire a3", "Commentaire a4"]);
  });
});

describe("Les chiffres des corrections", () => {
  const correction = (renduId: string, formationId: string, jours: number) => ({
    renduId,
    etudiant: "Koffi",
    exercice: "Tableau",
    formation: "Excel",
    formationId,
    module: "Module",
    moduleRang: 1,
    version: 1,
    nomFichier: "a.xlsx",
    deposeLe: ilYA(jours),
  });

  it("à corriger, en attente depuis plus de 7 jours, formations concernées, plus ancien dépôt en jours", () => {
    expect(chiffresCorrections([correction("r1", "f1", 9), correction("r2", "f1", 8), correction("r3", "f2", 1)], MAINTENANT)).toEqual({
      aCorriger: 3,
      enRetard: 2,
      formations: 2,
      plusAncienJours: 9,
    });
    expect(chiffresCorrections([], MAINTENANT)).toEqual({ aCorriger: 0, enRetard: 0, formations: 0, plusAncienJours: null });
  });
});

describe("Les chiffres des annonces", () => {
  const annonce = (id: string, jours: number, destinataires: number) => ({ id, titre: `Annonce ${id}`, texte: "", lien: null, auteur: "Équipe", creeLe: ilYA(jours), destinataires });

  it("envoyées, sur 30 jours, la dernière (la plus récente) et ses destinataires", () => {
    const chiffres = chiffresAnnonces([annonce("b", 40, 90), annonce("a", 3, 120), annonce("c", 10, 100)], MAINTENANT);
    expect(chiffres).toEqual({ envoyees: 3, sur30Jours: 2, derniere: { titre: "Annonce a", creeLe: ilYA(3), destinataires: 120 } });
    expect(chiffresAnnonces([], MAINTENANT)).toEqual({ envoyees: 0, sur30Jours: 0, derniere: null });
  });
});
