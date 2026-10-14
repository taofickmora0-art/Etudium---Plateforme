// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { resumeDepuis } from "@/lib/avis/regles";
import type { AvisFormation, AvisPublic, Etoiles } from "@/lib/avis/types";
import { id } from "../lecon/donnees";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations/x" }));
vi.mock("@/lib/avis/actions", () => ({ enregistrerAvis: vi.fn(), supprimerAvis: vi.fn(), masquerAvis: vi.fn() }));

const { SectionAvis } = await import("@/components/avis/SectionAvis");

const vide: Record<Etoiles, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
const unAvis = (o: Partial<AvisPublic> = {}): AvisPublic => ({
  id: id(1),
  note: 4,
  commentaire: "Les tableaux croisés m’ont fait gagner un temps fou.",
  auteur: "Fifamè A.",
  initiales: "FA",
  creeLe: "2026-10-12T10:00:00Z",
  modifieLe: "2026-10-12T10:00:00Z",
  estMoi: false,
  ...o,
});
const DESIGN: AvisFormation = { avis: [unAvis()], resume: resumeDepuis({ ...vide, 5: 103, 4: 17, 3: 5, 2: 1 }) };
const monter = (props: Partial<Parameters<typeof SectionAvis>[0]> = {}) =>
  render(
    <ToastProvider>
      <SectionAvis variante="connecte" formation={{ id: id(9), titre: "Maîtriser Microsoft Excel" }} donnees={DESIGN} peutNoter={false} {...props} />
    </ToastProvider>,
  );
const PHRASE = "Vous pourrez laisser un avis à partir de 50 % de progression.";

describe("Section « Avis des étudiants »", () => {
  it("la synthèse : moyenne, nombre d'avis et répartition (le total fait 100 %)", () => {
    monter();
    expect(screen.getByText("4,8")).toBeInTheDocument();
    expect(screen.getByText("126 avis")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "5 étoiles" })).toHaveAttribute("aria-valuenow", "82");
    expect(screen.getByRole("progressbar", { name: "1 étoile" })).toHaveAttribute("aria-valuenow", "0");
    for (const pct of ["82 %", "13 %", "4 %", "1 %", "0 %"]) expect(screen.getByText(pct)).toBeInTheDocument();
  });

  it("la carte de son propre avis ne porte jamais « Masqué par l’équipe »", () => {
    // Même si une base plus ancienne (avant la 0016) livrait encore l'information, l'auteur ne doit pas la voir.
    const masque = { ...unAvis({ id: id(2), estMoi: true }), masque: true } as AvisPublic;
    monter({ donnees: { avis: [masque], resume: resumeDepuis(vide) } });
    expect(screen.getByText("Votre avis")).toBeInTheDocument();
    expect(screen.queryByText(/Masqué/)).toBeNull();
  });

  it("les cartes : nom, initiales, note, commentaire ; le sien d'abord", () => {
    monter({
      donnees: {
        avis: [unAvis({ id: id(2), estMoi: true, note: 3, commentaire: "<script>alert(1)</script>", auteur: "Aïcha", initiales: "A" }), unAvis()],
        resume: resumeDepuis({ ...vide, 4: 1 }),
      },
    });
    const cartes = within(screen.getByRole("list", { name: "Avis des étudiants" })).getAllByRole("listitem");
    expect(within(cartes[0]).getByText("Votre avis")).toBeInTheDocument();
    expect(within(cartes[0]).getByRole("img", { name: "Note : 3 sur 5" })).toBeInTheDocument();
    expect(within(cartes[0]).getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(within(cartes[1]).getByText("Fifamè A.")).toBeInTheDocument();
    expect(within(cartes[1]).getByText("FA")).toBeInTheDocument();
    expect(within(cartes[1]).getByRole("img", { name: "Note : 4 sur 5" })).toBeInTheDocument();
    expect(within(cartes[1]).getByText("Les tableaux croisés m’ont fait gagner un temps fou.")).toBeInTheDocument();
  });

  it("le bouton : « Laisser un avis » à partir de 50 %, « Modifier mon avis » s'il existe ; sinon, la phrase des 50 %", () => {
    const { unmount } = monter({ peutNoter: true });
    expect(screen.getByRole("button", { name: "Laisser un avis" })).toBeInTheDocument();
    expect(screen.queryByText(PHRASE)).toBeNull();
    unmount();
    const avecLeSien = monter({ peutNoter: true, donnees: { ...DESIGN, avis: [unAvis({ estMoi: true })] } });
    expect(screen.getByRole("button", { name: "Modifier mon avis" })).toBeInTheDocument();
    avecLeSien.unmount();
    monter({ peutNoter: false });
    expect(screen.queryByRole("button", { name: /avis/ })).toBeNull();
    expect(screen.getByText(PHRASE)).toBeInTheDocument();
  });

  it("fiche publique : la phrase, jamais de bouton", () => {
    monter({ variante: "public" });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(PHRASE)).toBeInTheDocument();
    expect(screen.getByText("126 avis")).toBeInTheDocument();
  });

  it("sans avis : « Pas encore d’avis » ; sans la migration 0010 (données nulles), pas de bouton", () => {
    const { unmount } = monter({ peutNoter: true, donnees: { avis: [], resume: resumeDepuis(vide) } });
    expect(screen.getByText("Pas encore d’avis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Laisser un avis" })).toBeInTheDocument();
    unmount();
    monter({ peutNoter: true, donnees: null });
    expect(screen.getByText("Pas encore d’avis")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
