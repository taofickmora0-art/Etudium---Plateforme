// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormState } from "@/lib/auth/schemas";
import type { FormationAdmin, LeconAdmin } from "@/lib/admin/types";
import { choisirDansListe } from "../utilitaires/listes";

// Une action réussie rend la saisie, comme les vraies actions du back-office.
const reussite = async (_prev: FormState, fd: FormData): Promise<FormState> => ({
  status: "success",
  values: Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])),
});
vi.mock("@/lib/editeur/actions", () => ({
  enregistrerLecon: vi.fn(async () => ({ ok: true, revision: 1, brouillon: false, enregistreLe: "2026-11-01T14:32:00" })),
  enregistrerInfosFormation: vi.fn(async () => ({ ok: true, revision: 1, brouillon: false, enregistreLe: "2026-11-01T14:32:00" })),
  reglerLecon: vi.fn(async () => ({ ok: true })),
  enregistrerQuestions: vi.fn(),
  abandonnerModifications: vi.fn(),
  publierModifications: vi.fn(),
  lireModificationsEnAttente: vi.fn(async () => ({ migrationAbsente: false, donnees: [] })),
}));
vi.mock("@/lib/admin/actions", () => ({ saveFormationInfos: vi.fn(), changerStatutLecon: vi.fn(), addRessource: vi.fn(), updateRessource: vi.fn(), deleteRessource: vi.fn(), deplacer: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
vi.mock("@/components/communaute/EditeurTexte", () => import("../communaute/editeur-simule"));
vi.mock("@/components/editeur/EditeurRiche", () => import("../editeur/editeur-riche-simule"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { saveFormationInfos } = await import("@/lib/admin/actions");
const { reglerLecon } = await import("@/lib/editeur/actions");
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
  it("un interrupteur de leçon garde sa position : il s'enregistre aussitôt (fin du lot 4)", async () => {
    avecNotifications(<EditeurLecon lecon={LECON} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Leçon d’aperçu gratuite" }));
    await waitFor(() => expect(reglerLecon).toHaveBeenCalledWith("l1", expect.objectContaining({ apercu: true })));
    expect(screen.getByRole("checkbox", { name: "Leçon d’aperçu gratuite" })).toBeChecked();
  });

  it("une liste déroulante et un interrupteur de formation gardent le choix enregistré", async () => {
    vi.mocked(saveFormationInfos).mockImplementation(reussite);
    avecNotifications(<FormationInfosForm formation={FORMATION} parcours={[]} formateurs={[]} />);
    // Le niveau a rejoint les informations générales, enregistrées seules (fin du lot 4) : le badge, ici.
    await choisirDansListe("Badge", "Populaire");
    await userEvent.click(screen.getByRole("switch", { name: "Formation gratuite" }));
    await enregistrer();
    expect(screen.getByLabelText("Badge")).toHaveTextContent("Populaire");
    expect(screen.getByRole("switch", { name: "Formation gratuite" })).toHaveAttribute("aria-checked", "true");
    await enregistrer();
    const second = vi.mocked(saveFormationInfos).mock.calls[1][1];
    expect(second.get("badge")).toBe("populaire");
    expect(second.get("gratuite")).toBe("on");
  });
});
