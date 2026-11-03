// @vitest-environment jsdom
import { render as rendre, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { EXCEL } from "../lecon/donnees";

// Le groupe de discussion d'une formation (complément du 3 novembre 2026, migration 0075) : l'interrupteur dans la fiche
// au back-office et dans l'espace formateur ; le bouton « Rejoindre le groupe de discussion » sur la fiche de la
// formation, pour un inscrit, si le groupe est actif ; une mention pour qui n'est pas inscrit.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/admin/formations/x" }));
const activerGroupeFormation = vi.fn();
vi.mock("@/lib/groupes/actions", () => ({ activerGroupeFormation: (...a: unknown[]) => activerGroupeFormation(...a) }));
vi.mock("@/lib/inscriptions/actions", () => ({ sInscrireFormation: vi.fn() }));
vi.mock("@/lib/formateurs/actions", () => ({ ecrireAuFormateur: vi.fn() }));

const { GroupeDeLaFormation } = await import("@/components/groupes/GroupeDeLaFormation");
const { FicheConnectee } = await import("@/components/catalogue/FicheConnectee");

const render = (element: ReactElement) => rendre(<ToastProvider>{element}</ToastProvider>);
const F = "11111111-1111-4111-8111-111111111111";
const lu = (actif: boolean, slug: string | null = actif ? "excel" : null) => ({ migrationAbsente: false as const, donnees: { actif, slug, ouvert: actif, peutRegler: true } });

beforeEach(() => activerGroupeFormation.mockReset());

describe("L'interrupteur « Groupe de discussion »", () => {
  it("désactivé par défaut ; l'activer l'applique tout de suite, avec un message de réussite et le lien du groupe", async () => {
    const user = userEvent.setup();
    activerGroupeFormation.mockResolvedValue({ ok: true, actif: true, slug: "excel" });
    render(<GroupeDeLaFormation formationId={F} espace="admin" lu={lu(false)} />);
    const interrupteur = screen.getByRole("switch", { name: "Groupe de discussion" });
    expect(interrupteur).toHaveAccessibleDescription("Les apprenants inscrits peuvent échanger entre eux et avec le formateur dans un groupe dédié.");
    expect(interrupteur).not.toBeChecked();
    await user.click(interrupteur);
    expect(activerGroupeFormation).toHaveBeenCalledWith(F, true);
    expect(await screen.findByText("Groupe de discussion activé")).toBeInTheDocument();
    expect(interrupteur).toBeChecked();
    // L'équipe ouvre les groupes depuis son espace étudiant.
    expect(screen.getByRole("link", { name: "Ouvrir le groupe" })).toHaveAttribute("href", "/groupes/excel");
  });

  it("dans l'espace formateur : le désactiver le cache, le lien reste dans son espace ; un refus remet l'interrupteur", async () => {
    const user = userEvent.setup();
    activerGroupeFormation.mockResolvedValueOnce({ ok: true, actif: false, slug: "excel" });
    render(<GroupeDeLaFormation formationId={F} espace="formateur" lu={lu(true)} />);
    const interrupteur = screen.getByRole("switch", { name: "Groupe de discussion" });
    expect(screen.getByRole("link", { name: "Ouvrir le groupe" })).toHaveAttribute("href", "/formateur/groupes/excel");
    await user.click(interrupteur);
    expect(activerGroupeFormation).toHaveBeenCalledWith(F, false);
    expect(await screen.findByText("Groupe de discussion désactivé")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir le groupe (désactivé)" })).toBeInTheDocument();
    activerGroupeFormation.mockResolvedValueOnce({ ok: false, message: "Seuls le formateur de la formation et l’équipe règlent son groupe." });
    await user.click(interrupteur);
    expect(await screen.findByText("Seuls le formateur de la formation et l’équipe règlent son groupe.")).toBeInTheDocument();
    await waitFor(() => expect(interrupteur).not.toBeChecked());
  });

  it("sans la 0075 : la migration au back-office, le message neutre dans l'espace formateur", () => {
    const { unmount } = render(<GroupeDeLaFormation formationId={F} espace="admin" lu={{ migrationAbsente: true }} />);
    expect(screen.getByText(/Appliquez la migration 0075 \(guide « Ce qui te revient », section 74\)/)).toBeInTheDocument();
    unmount();
    render(<GroupeDeLaFormation formationId={F} espace="formateur" lu={{ migrationAbsente: true }} />);
    expect(screen.getByText("Cette fonction n’est pas disponible pour le moment.")).toBeInTheDocument();
  });
});

describe("Le bouton sur la fiche de la formation", () => {
  const fiche = (groupe: Parameters<typeof FicheConnectee>[0]["groupe"]) => render(<FicheConnectee fiche={EXCEL} groupe={groupe} />);

  it("un inscrit, groupe actif : « Rejoindre le groupe de discussion »", () => {
    fiche({ actif: true, slug: "maitriser-microsoft-excel", ouvert: true, peutRegler: false });
    expect(screen.getByRole("link", { name: "Rejoindre le groupe de discussion" })).toHaveAttribute("href", "/groupes/maitriser-microsoft-excel");
  });

  it("pas inscrit, groupe actif : une mention pour s'inscrire", () => {
    fiche({ actif: true, slug: "maitriser-microsoft-excel", ouvert: false, peutRegler: false });
    expect(screen.queryByRole("link", { name: "Rejoindre le groupe de discussion" })).not.toBeInTheDocument();
    expect(screen.getByText("Inscrivez-vous pour rejoindre le groupe de discussion.")).toBeInTheDocument();
  });

  it("groupe désactivé (ou sans la 0075) : rien", () => {
    const { unmount } = fiche({ actif: false, slug: null, ouvert: false, peutRegler: false });
    expect(screen.queryByText(/groupe de discussion/i)).not.toBeInTheDocument();
    unmount();
    fiche(null);
    expect(screen.queryByText(/groupe de discussion/i)).not.toBeInTheDocument();
  });
});
