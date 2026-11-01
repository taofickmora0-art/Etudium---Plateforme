// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormState } from "@/lib/auth/schemas";
import type { FormationAdmin, LeconAdmin } from "@/lib/admin/types";

// Une action réussie rend la saisie, comme les vraies actions du back-office.
const reussite = async (_prev: FormState, fd: FormData): Promise<FormState> => ({
  status: "success",
  values: Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])),
});
vi.mock("@/lib/admin/actions", () => ({ saveLecon: vi.fn(), saveFormationInfos: vi.fn(), changerStatutLecon: vi.fn(), addRessource: vi.fn(), updateRessource: vi.fn(), deleteRessource: vi.fn(), deplacer: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
vi.mock("@/components/communaute/EditeurTexte", () => import("../communaute/editeur-simule"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { saveLecon, saveFormationInfos } = await import("@/lib/admin/actions");
const { EditeurLecon } = await import("@/components/admin/EditeurLecon");
const { FormationInfosForm } = await import("@/components/admin/FormationInfosForm");

const LECON = {
  id: "l1",
  formationId: "f1",
  titre: "Leçon",
  titreCourt: null,
  dureeSecondes: 0,
  apercu: false,
  resume: "",
  pointsCles: [],
  video: null,
  texte: "",
  ressources: [],
  formationTitre: "Excel",
  formationSlug: "excel",
  publiee: true,
  commentairesActifs: true,
  position: { rang: 1, total: 1, module: { rang: 1, titre: "Module" } },
  voisines: { precedente: null, suivante: null },
} as unknown as LeconAdmin;
const FORMATION = {
  id: "f1",
  slug: "excel",
  titre: "Excel",
  statut: "brouillon",
  niveau: "intermediaire",
  resume: "",
  description: "",
  objectifs: [],
  competences: [],
  formateurId: null,
  gratuite: false,
  badge: null,
  seuilVideo: 90,
  publieeLe: null,
  parcoursIds: [],
} as unknown as FormationAdmin;

const avecNotifications = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
const enregistrer = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Enregistrer" })).not.toHaveAttribute("aria-busy"));
};

describe("Après un enregistrement, le formulaire montre ce qui est enregistré", () => {
  it("un interrupteur garde sa position, et l'enregistrement suivant la renvoie", async () => {
    vi.mocked(saveLecon).mockImplementation(reussite);
    avecNotifications(<EditeurLecon lecon={LECON} />);
    const apercu = screen.getByRole("checkbox", { name: "Leçon d’aperçu gratuite" });
    await userEvent.click(apercu);
    await enregistrer();
    expect(vi.mocked(saveLecon).mock.calls[0][1].get("apercu")).toBe("on");
    expect(screen.getByRole("checkbox", { name: "Leçon d’aperçu gratuite" })).toBeChecked();
    await enregistrer();
    expect(vi.mocked(saveLecon).mock.calls[1][1].get("apercu")).toBe("on");
  });

  it("une liste déroulante et un interrupteur de formation gardent le choix enregistré", async () => {
    vi.mocked(saveFormationInfos).mockImplementation(reussite);
    avecNotifications(<FormationInfosForm formation={FORMATION} parcours={[]} formateurs={[]} />);
    await userEvent.selectOptions(screen.getByLabelText("Niveau"), "avance");
    await userEvent.click(screen.getByRole("switch", { name: "Formation gratuite" }));
    await enregistrer();
    expect(screen.getByLabelText("Niveau")).toHaveValue("avance");
    expect(screen.getByRole("switch", { name: "Formation gratuite" })).toHaveAttribute("aria-checked", "true");
    await enregistrer();
    const second = vi.mocked(saveFormationInfos).mock.calls[1][1];
    expect(second.get("niveau")).toBe("avance");
    expect(second.get("gratuite")).toBe("on");
  });
});
