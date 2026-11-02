// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormationAdmin } from "@/lib/admin/types";

// L'onglet « Leçons » (refonte des formations, étape A, spec §3.2) : sections et leçons, statut, rangement, ajout.
vi.mock("@/lib/admin/actions", () => ({
  addModule: vi.fn(),
  renameModule: vi.fn(),
  deleteModule: vi.fn(),
  addLecon: vi.fn(),
  deleteLecon: vi.fn(),
  ranger: vi.fn(),
  changerStatutLecon: vi.fn(),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const actions = await import("@/lib/admin/actions");
const { OngletLecons } = await import("@/components/admin/OngletLecons");

const lecon = (id: string, titre: string, o: Record<string, unknown> = {}) => ({ id, titre, dureeSecondes: 370, apercu: false, aVideo: true, publiee: true, ...o });
const FORMATION = {
  id: "f1",
  slug: "excel",
  modules: [
    { id: "m1", titre: "Bases d’Excel", ordre: 1, lecons: [lecon("l1", "Découvrir l’interface", { apercu: true }), lecon("l2", "Les formules", { publiee: false, aVideo: false })] },
    { id: "m2", titre: "Automatisation", ordre: 2, lecons: [lecon("l3", "Les macros")] },
  ],
} as unknown as FormationAdmin;

function afficher(base?: "/admin/formations" | "/formateur/formations") {
  return render(
    <ToastProvider>
      <OngletLecons formation={FORMATION} base={base} />
    </ToastProvider>,
  );
}
const section = (nom: RegExp) => screen.getByRole("region", { name: nom });
const ligne = (titre: string) => screen.getByRole("listitem", { name: titre });
async function menuLecon(user: ReturnType<typeof userEvent.setup>, titre: string, choix: string) {
  await user.click(within(ligne(titre)).getByRole("button", { name: `Actions sur « ${titre} »` }));
  await user.click(screen.getByRole("menuitem", { name: choix }));
}

describe("L'onglet Leçons", () => {
  beforeEach(() => {
    for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
    push.mockReset();
  });

  it("le compte, les sections et leurs leçons, le résumé et le statut de chaque leçon", () => {
    afficher();
    expect(screen.getByRole("heading", { name: "2 sections · 3 leçons" })).toBeInTheDocument();
    // Un seul format de module partout (spec du 2 novembre 2026, §1.8) : « Module N - Titre ».
    expect(within(section(/^Module 1 - Bases d’Excel$/)).getAllByRole("listitem").map((l) => l.getAttribute("aria-label"))).toEqual(["Découvrir l’interface", "Les formules"]);
    expect(screen.getByRole("heading", { level: 3, name: "Module 2 - Automatisation" })).toBeInTheDocument();
    expect(within(ligne("Découvrir l’interface")).getByText("06:10 · Vidéo · Aperçu")).toBeInTheDocument();
    expect(within(ligne("Découvrir l’interface")).getByRole("button", { name: "Statut : Publiée" })).toBeInTheDocument();
    expect(within(ligne("Les formules")).getByRole("button", { name: "Statut : Brouillon" })).toBeInTheDocument();
    expect(within(ligne("Les formules")).getByRole("link", { name: "Les formules" })).toHaveAttribute("href", "/admin/formations/f1/lecons/l2");
  });

  it("une leçon modifiée mais pas encore publiée porte l'étiquette (fin du lot 4)", () => {
    render(
      <ToastProvider>
        <OngletLecons
          formation={{ ...FORMATION, modules: [{ ...FORMATION.modules[0], lecons: [{ ...FORMATION.modules[0].lecons[0], brouillon: true }] }] } as FormationAdmin}
        />
      </ToastProvider>,
    );
    expect(within(ligne("Découvrir l’interface")).getByText("Modifiée, non publiée")).toBeInTheDocument();
  });

  it("changer le statut d'une leçon", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.changerStatutLecon).mockResolvedValue({ ok: true });
    afficher();
    await user.click(within(ligne("Les formules")).getByRole("button", { name: "Statut : Brouillon" }));
    await user.click(screen.getByRole("menuitem", { name: "Publier" }));
    expect(actions.changerStatutLecon).toHaveBeenCalledWith("l2", true);
    expect(await within(ligne("Les formules")).findByRole("button", { name: "Statut : Publiée" })).toBeInTheDocument();
  });

  it("la pastille « n leçons » replie la section ; « Tout replier »", async () => {
    const user = userEvent.setup();
    afficher();
    const pastille = within(section(/Module 1/)).getByRole("button", { name: "2 leçons" });
    expect(pastille).toHaveAttribute("aria-expanded", "true");
    await user.click(pastille);
    expect(pastille).toHaveAttribute("aria-expanded", "false");
    expect(within(section(/Module 1/)).queryByRole("listitem")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tout replier" }));
    expect(within(section(/Module 2/)).queryByRole("listitem")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tout déplier" }));
    expect(within(section(/Module 1/)).getAllByRole("listitem")).toHaveLength(2);
  });

  it("menu ⋮ d'une leçon : Monter, Descendre, « Déplacer vers… », « Voir comme un étudiant »", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.ranger).mockResolvedValue({ ok: true });
    afficher();
    await menuLecon(user, "Les formules", "Monter");
    expect(actions.ranger).toHaveBeenLastCalledWith("lecons", "l2", "m1", 1);
    expect(within(section(/Module 1/)).getAllByRole("listitem").map((l) => l.getAttribute("aria-label"))).toEqual(["Les formules", "Découvrir l’interface"]);
    await menuLecon(user, "Les formules", "Déplacer vers…");
    const fenetre = screen.getByRole("dialog", { name: "Déplacer « Les formules »" });
    expect(within(fenetre).getAllByRole("option").map((o) => o.textContent)).toEqual(["Module 1 - Bases d’Excel", "Module 2 - Automatisation"]);
    await user.selectOptions(within(fenetre).getByRole("combobox", { name: "Section" }), "m2");
    await user.click(within(fenetre).getByRole("button", { name: "Déplacer" }));
    expect(actions.ranger).toHaveBeenLastCalledWith("lecons", "l2", "m2", 2);
    expect(within(section(/Module 2/)).getAllByRole("listitem").map((l) => l.getAttribute("aria-label"))).toEqual(["Les macros", "Les formules"]);
    await user.click(within(ligne("Les macros")).getByRole("button", { name: "Actions sur « Les macros »" }));
    expect(screen.getByRole("menuitem", { name: "Voir comme un étudiant" })).toHaveAttribute("href", "/formations/excel/lecons/l3");
  });

  it("un rangement refusé : l'écran revient en arrière et le message s'affiche", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.ranger).mockResolvedValue({ ok: false, message: "Le déplacement n’a pas abouti." });
    afficher();
    await menuLecon(user, "Découvrir l’interface", "Descendre");
    expect(await screen.findByText("Le déplacement n’a pas abouti.")).toBeInTheDocument();
    expect(within(section(/Module 1/)).getAllByRole("listitem").map((l) => l.getAttribute("aria-label"))).toEqual(["Découvrir l’interface", "Les formules"]);
  });

  it("menu ⋮ d'une section : Descendre ; « + Ajouter une section » et « Ajouter » une leçon ouvrent une fenêtre", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.ranger).mockResolvedValue({ ok: true });
    vi.mocked(actions.addModule).mockResolvedValue({ status: "success" });
    vi.mocked(actions.addLecon).mockResolvedValue({ status: "success", redirection: "/admin/formations/f1/lecons/l9" });
    afficher();
    await user.click(within(section(/Module 1/)).getByRole("button", { name: "Actions sur « Bases d’Excel »" }));
    await user.click(screen.getByRole("menuitem", { name: "Descendre" }));
    expect(actions.ranger).toHaveBeenLastCalledWith("modules", "m1", null, 2);
    await user.click(screen.getByRole("button", { name: "Ajouter une section" }));
    const nouvelle = screen.getByRole("dialog", { name: "Nouvelle section" });
    await user.type(within(nouvelle).getByRole("textbox", { name: "Titre de la section" }), "Tableaux croisés");
    await user.click(within(nouvelle).getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(actions.addModule).toHaveBeenCalled());
    expect((vi.mocked(actions.addModule).mock.calls[0][1] as FormData).get("titre")).toBe("Tableaux croisés");
    // Enregistrée, la fenêtre se ferme.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(within(section(/Bases d’Excel/)).getByRole("button", { name: "Ajouter une leçon à « Bases d’Excel »" }));
    const fenetre = screen.getByRole("dialog", { name: "Nouvelle leçon" });
    await user.type(within(fenetre).getByRole("textbox", { name: "Titre de la leçon" }), "Les graphiques");
    await user.click(within(fenetre).getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/formations/f1/lecons/l9"));
    const envoye = vi.mocked(actions.addLecon).mock.calls[0][1] as FormData;
    expect([envoye.get("module_id"), envoye.get("titre")]).toEqual(["m1", "Les graphiques"]);
  });

  it("espace formateur : les liens mènent à ses pages", () => {
    afficher("/formateur/formations");
    expect(within(ligne("Les macros")).getByRole("link", { name: "Les macros" })).toHaveAttribute("href", "/formateur/formations/f1/lecons/l3");
  });
});
