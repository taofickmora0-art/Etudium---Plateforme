// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { dateHeureVersion, messageRestauration, quandVersion } from "@/lib/editeur/historique";
import type { VersionFormation } from "@/lib/editeur/types";

// L'onglet « Historique » d'une formation (fin du lot 4, spec §3.3 et §3.4) : les versions, la plus récente d'abord,
// celle en ligne repérée ; « Restaurer dans le brouillon » remet une version ancienne dans les brouillons.

vi.mock("@/lib/editeur/actions", () => ({ restaurerVersion: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const { restaurerVersion } = await import("@/lib/editeur/actions");
const { OngletHistorique } = await import("@/components/editeur/OngletHistorique");
const { FormationOnglets } = await import("@/components/admin/FormationOnglets");

const VERSIONS: VersionFormation[] = [
  { id: "v8", numero: 8, creeLe: "2026-11-01T13:32:00Z", auteur: "Aïcha Kpadé", resume: "Informations générales et 2 leçons modifiées", enLigne: true },
  { id: "v5", numero: 5, creeLe: "2026-10-28T08:05:00Z", auteur: null, resume: "Leçon « Les macros » mise en ligne", enLigne: false },
];
const afficher = () =>
  render(
    <ToastProvider>
      <OngletHistorique versions={VERSIONS} />
    </ToastProvider>,
  );

beforeEach(() => vi.mocked(restaurerVersion).mockReset());

describe("L'onglet Historique", () => {
  it("la liste : numéro, date et heure (Bénin), auteur, résumé ; l'étiquette « En ligne » ; restaurer seulement les anciennes", () => {
    afficher();
    const liste = screen.getByRole("list", { name: "Versions de la formation" });
    const [v8, v5] = within(liste).getAllByRole("listitem");
    expect(v8).toHaveTextContent("Version 8");
    expect(v8).toHaveTextContent("1er novembre 2026 à 14 h 32");
    expect(v8).toHaveTextContent("par Aïcha Kpadé");
    expect(v8).toHaveTextContent("Informations générales et 2 leçons modifiées");
    expect(within(v8).getByText("En ligne")).toBeInTheDocument();
    expect(within(v8).queryByRole("button", { name: /Restaurer/ })).toBeNull();
    expect(v5).toHaveTextContent("28 octobre 2026 à 9 h 05");
    expect(v5).toHaveTextContent("par un compte supprimé");
    expect(within(v5).getByRole("button", { name: "Restaurer la version 5 dans le brouillon" })).toBeInTheDocument();
  });

  it("restaurer : la fenêtre, l'appel, le message", async () => {
    const user = userEvent.setup();
    vi.mocked(restaurerVersion).mockResolvedValue({ ok: true, message: "Version 5 restaurée dans le brouillon : 3 leçons modifiées. Relisez, puis publiez." });
    afficher();
    await user.click(screen.getByRole("button", { name: "Restaurer la version 5 dans le brouillon" }));
    const fenetre = screen.getByRole("dialog", { name: "Restaurer la version 5 ?" });
    expect(fenetre).toHaveTextContent("Le contenu de la version 5 revient dans le brouillon. Les étudiants ne verront rien changer avant « Publier les modifications ».");
    await user.click(within(fenetre).getByRole("button", { name: "Restaurer" }));
    expect(restaurerVersion).toHaveBeenCalledWith("v5");
    expect(await screen.findByText("Version 5 restaurée dans le brouillon : 3 leçons modifiées. Relisez, puis publiez.")).toBeInTheDocument();
  });

  it("l'onglet n'apparaît qu'avec un historique", () => {
    const onglets = (historique?: React.ReactNode) =>
      render(<FormationOnglets informations="i" programme="p" publication="pub" apprenants="a" historique={historique} />);
    const { unmount } = onglets();
    expect(screen.queryByRole("tab", { name: "Historique" })).toBeNull();
    unmount();
    onglets(<p>h</p>);
    expect(screen.getByRole("tab", { name: "Historique" })).toBeInTheDocument();
  });
});

describe("Les libellés", () => {
  it("quand : aujourd'hui, hier, sinon la date ; la date et l'heure au Bénin", () => {
    const maintenant = new Date("2026-11-01T20:00:00Z");
    expect(quandVersion("2026-11-01T08:00:00Z", maintenant)).toBe("aujourd’hui");
    expect(quandVersion("2026-10-31T08:00:00Z", maintenant)).toBe("hier");
    expect(quandVersion("2026-10-01T08:00:00Z", maintenant)).toBe("1er octobre 2026");
    expect(dateHeureVersion("2026-11-01T13:32:00Z")).toBe("1er novembre 2026 à 14 h 32");
  });

  it("le message d'une restauration : les parties vides omises, le singulier accordé", () => {
    expect(messageRestauration({ numero: 5, infos: false, leconsModifiees: 3, leconsRecreees: 1 })).toBe(
      "Version 5 restaurée dans le brouillon : 3 leçons modifiées, 1 leçon recréée (non publiée). Relisez, puis publiez.",
    );
    expect(messageRestauration({ numero: 2, infos: true, leconsModifiees: 1, leconsRecreees: 0 })).toBe(
      "Version 2 restaurée dans le brouillon : informations générales, 1 leçon modifiée. Relisez, puis publiez.",
    );
    expect(messageRestauration({ numero: 3, infos: false, leconsModifiees: 0, leconsRecreees: 2 })).toBe(
      "Version 3 restaurée dans le brouillon : 2 leçons recréées (non publiées). Relisez, puis publiez.",
    );
    expect(messageRestauration({ numero: 4, infos: false, leconsModifiees: 0, leconsRecreees: 0 })).toBe("La version 4 est déjà le contenu actuel : rien à restaurer.");
  });
});
