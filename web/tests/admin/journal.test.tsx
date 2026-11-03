// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { choisirDansListe } from "../utilitaires/listes";
import { fauxSupabase } from "./faux-supabase";

// La page « Journal des actions » (lot 6 A, spec §2.3) : le super admin lit ce que l'équipe a fait, filtre par
// catégorie, auteur et période (dans l'adresse), et charge la suite avec « Voir plus ».

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));
const { replace, chargerJournal } = vi.hoisted(() => ({ replace: vi.fn(), chargerJournal: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/lib/journal/actions", () => ({ chargerJournal }));

const { lireJournal } = await import("@/lib/journal/data");
const { PageJournal } = await import("@/components/admin/journal/PageJournal");

const LIGNE = { id: "12", creeLe: "2026-11-02T13:05:00Z", auteurNom: "Aïcha Kpadé", categorie: "comptes" as const, resume: "Compte de Jules Koffi suspendu" };
const AUTEURS = [{ id: "a1", nom: "Aïcha Kpadé" }, { id: "a2", nom: "Gildas Tossou" }];
const FILTRES = { categorie: null, auteur: null, periode: "30" as const };

beforeEach(() => {
  faux.vider();
  replace.mockReset();
  chargerJournal.mockReset();
});

describe("Le journal des actions", () => {
  it("la lecture : les filtres vers la base, les lignes converties", async () => {
    faux.repondre("rpc.lire_journal", {
      data: { lignes: [{ id: 12, cree_le: "2026-11-02T13:05:00Z", auteur: "a1", auteur_nom: "Aïcha Kpadé", categorie: "comptes", resume: "Compte de Jules Koffi suspendu" }], suite: true },
    });
    expect(await lireJournal({ categorie: "comptes", auteur: null, jours: 30 })).toEqual({ lignes: [LIGNE], suite: true });
    expect(faux.de("rpc", "lire_journal")[0].valeurs).toEqual({ p_categorie: "comptes", p_auteur: null, p_jours: 30, p_avant: null, p_nombre: 50 });
    faux.repondre("rpc.lire_journal", { error: { code: "PGRST202" } });
    expect(await lireJournal({ categorie: null, auteur: null, jours: null })).toBeNull();
    faux.repondre("rpc.lire_journal", { error: { code: "500", message: "panne" } });
    await expect(lireJournal({ categorie: null, auteur: null, jours: null })).rejects.toThrow();
  });

  it("une ligne par action : date à l'heure du Bénin, auteur, catégorie, résumé ; sans ligne, le message", () => {
    const { unmount } = render(<PageJournal initial={{ lignes: [LIGNE], suite: false }} filtres={FILTRES} auteurs={AUTEURS} />);
    const ligne = screen.getByRole("row", { name: /Compte de Jules Koffi suspendu/ });
    expect(within(ligne).getByText("2 nov. 2026, 14:05")).toBeInTheDocument();
    expect(within(ligne).getByText("Aïcha Kpadé")).toBeInTheDocument();
    expect(within(ligne).getByText("Comptes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voir plus" })).toBeNull();
    unmount();
    render(<PageJournal initial={{ lignes: [], suite: false }} filtres={FILTRES} auteurs={AUTEURS} />);
    expect(screen.getByText("Aucune action sur cette période.")).toBeInTheDocument();
  });

  it("les filtres changent l'adresse, en gardant les autres", async () => {
    const user = userEvent.setup();
    render(<PageJournal initial={{ lignes: [LIGNE], suite: false }} filtres={{ categorie: null, auteur: "a2", periode: "30" }} auteurs={AUTEURS} />);
    await user.click(within(screen.getByRole("group", { name: "Filtrer par catégorie" })).getByRole("button", { name: "Paiements" }));
    expect(replace).toHaveBeenLastCalledWith("/admin/journal?categorie=paiements&auteur=a2&periode=30", { scroll: false });
    await user.click(within(screen.getByRole("group", { name: "Filtrer par période" })).getByRole("button", { name: "Tout" }));
    expect(replace).toHaveBeenLastCalledWith("/admin/journal?auteur=a2&periode=tout", { scroll: false });
    await choisirDansListe(screen.getByLabelText("Auteur"), "Aïcha Kpadé", { user });
    expect(replace).toHaveBeenLastCalledWith("/admin/journal?auteur=a1&periode=30", { scroll: false });
  });

  it("« Voir plus » charge la suite après la dernière ligne", async () => {
    const user = userEvent.setup();
    chargerJournal.mockResolvedValue({ lignes: [{ ...LIGNE, id: "11", resume: "Paiements activés", categorie: "paiements" }], suite: false });
    render(<PageJournal initial={{ lignes: [LIGNE], suite: true }} filtres={FILTRES} auteurs={AUTEURS} />);
    await user.click(screen.getByRole("button", { name: "Voir plus" }));
    expect(chargerJournal).toHaveBeenCalledWith({ categorie: null, auteur: null, jours: 30 }, "12");
    expect(await screen.findByText("Paiements activés")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voir plus" })).toBeNull();
  });

  it("la page demande le domaine « journal »", () => {
    expect(readFileSync(join(process.cwd(), "src/app/(app)/admin/journal/page.tsx"), "utf8")).toContain('requireDomaine("journal")');
  });
});
