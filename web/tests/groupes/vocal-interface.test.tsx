// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageGroupe, ResumeGroupe } from "@/lib/groupes/types";

// Les notes vocales dans les groupes et le volet de gauche (4 novembre 2026) : la note part par onEnvoyer avec sa durée
// (le fichier déposé dans « groupes ») ; la bulle d'une note se lit, sans « Copier » ni « Modifier » ; la liste a sa
// recherche et surligne le groupe ouvert.

let chemin = "/groupes/general";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => chemin }));
vi.mock("@/lib/groupes/actions", () => ({ chargerMesGroupes: vi.fn(async () => ({ ok: false })) }));
const deposerNoteVocale = vi.fn();
vi.mock("@/lib/vocal/depot", () => ({ deposerNoteVocale: (...a: unknown[]) => deposerNoteVocale(...a) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const { ChampGroupe } = await import("@/components/groupes/ChampGroupe");
const { MessageDuFil, actionsDuMessage } = await import("@/components/groupes/MessageDuFil");
const { ListeGroupes } = await import("@/components/groupes/ListeGroupes");

let maintenant = 0;
class FauxEnregistreur {
  static isTypeSupported = (t: string) => t === "audio/mp4";
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_flux: unknown, options: { mimeType: string }) {
    this.mimeType = options.mimeType;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["son"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const message = (o: Partial<MessageGroupe>): MessageGroupe => ({
  id: crypto.randomUUID(),
  groupeId: "g",
  auteur: { id: "a", prenom: "Koffi", nom: "Dossou", photoUrl: null, badge: null },
  deMoi: false,
  texte: "",
  image: null,
  vocal: null,
  reponse: null,
  creeLe: new Date().toISOString(),
  modifieLe: null,
  supprime: false,
  retire: false,
  reactions: [],
  epingle: false,
  ...o,
});
const resume = (o: Partial<ResumeGroupe>): ResumeGroupe => ({ id: crypto.randomUUID(), slug: "general", nom: "Général", type: "general", couleur: null, actif: true, nonLus: 0, coupe: false, dernier: null, ...o });

beforeEach(() => {
  maintenant = 0;
  vi.spyOn(performance, "now").mockImplementation(() => maintenant);
  vi.stubGlobal("MediaRecorder", FauxEnregistreur);
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) }, configurable: true });
  URL.createObjectURL = vi.fn(() => "blob:note");
  URL.revokeObjectURL = vi.fn();
  deposerNoteVocale.mockReset().mockResolvedValue({ ok: true, chemin: "moi/note.m4a", retirer: vi.fn() });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("La note vocale dans un groupe", () => {
  it("le micro, puis Envoyer : déposée dans « groupes », elle part par onEnvoyer avec sa durée", async () => {
    const user = userEvent.setup();
    const onEnvoyer = vi.fn(async () => null);
    render(<ChampGroupe nomGroupe="Général" reponse={null} edition={null} onAnnuler={vi.fn()} onEnvoyer={onEnvoyer} onModifier={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Enregistrer une note vocale" }));
    maintenant = 7_000;
    await user.click(await screen.findByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(onEnvoyer).toHaveBeenCalled());
    expect(deposerNoteVocale).toHaveBeenCalledWith("groupes", null, expect.objectContaining({ type: "audio/mp4", dureeMs: 7_000 }));
    expect(onEnvoyer).toHaveBeenCalledWith("", "moi/note.m4a", { dureeMs: 7_000, ondes: expect.any(Array) });
    expect(await screen.findByRole("button", { name: "Enregistrer une note vocale" })).toBeInTheDocument();
  });

  it("en modifiant un message, pas de micro", () => {
    render(<ChampGroupe nomGroupe="Général" reponse={null} edition={message({ texte: "Bonjour", deMoi: true })} onAnnuler={vi.fn()} onEnvoyer={vi.fn()} onModifier={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Enregistrer une note vocale" })).toBeNull();
  });

  it("la bulle d'une note se lit ; ni « Copier » ni « Modifier » ; la réponse à une note la cite", () => {
    const note = message({ deMoi: true, vocal: { chemin: "a/n.m4a", type: "audio/mp4", url: "https://s/n", dureeMs: 9_000, ondes: [] } });
    const droits = { peutEcrire: true, peutModerer: false, equipe: false };
    expect(actionsDuMessage(note, droits, new Date())).toEqual(["repondre", "supprimer"]);
    const { unmount } = render(<MessageDuFil message={note} premier droits={droits} maintenant={new Date()} surligne={false} onAction={vi.fn()} onReagir={vi.fn()} onCitation={vi.fn()} onImage={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Écouter la note vocale (0:09)" })).toBeInTheDocument();
    unmount();
    const reponse = message({ texte: "Bien reçu", reponse: { id: note.id, auteur: { prenom: "Awa", nom: "Kpadé" }, texte: "", image: false, vocal: true, supprime: false } });
    render(<MessageDuFil message={reponse} premier droits={droits} maintenant={new Date()} surligne={false} onAction={vi.fn()} onReagir={vi.fn()} onCitation={vi.fn()} onImage={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Aller au message cité de Awa K." })).toHaveTextContent("🎤 Note vocale");
  });
});

describe("Le volet de gauche des Groupes", () => {
  it("la recherche par nom (sans accents) ; le groupe ouvert est surligné ; la note vocale dans l'aperçu", async () => {
    const user = userEvent.setup();
    chemin = "/groupes/reussite-academique";
    render(
      <ListeGroupes
        espace="etudiant"
        initiaux={[
          resume({ dernier: { id: "m", auteur: { prenom: "Awa", nom: "Kpadé" }, deMoi: false, texte: "", image: false, vocal: 12_000, supprime: false, retire: false, creeLe: new Date().toISOString() } }),
          resume({ slug: "reussite-academique", nom: "Réussite académique", type: "parcours", couleur: "academique" }),
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Groupes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Réussite académique/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Général/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /Général/ })).toHaveTextContent("Awa K. : 🎤 Note vocale (0:12)");
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un groupe" }), "reussite");
    const liste = screen.getByRole("region", { name: "Groupes" });
    expect(within(liste).queryByRole("link", { name: /Général/ })).toBeNull();
    expect(within(liste).getByRole("link", { name: /Réussite académique/ })).toBeInTheDocument();
  });
});
