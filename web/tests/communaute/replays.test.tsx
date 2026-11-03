// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Espace, MoiCommunaute } from "@/lib/communaute/types";
import type { SessionCarte, SessionPublication } from "@/lib/sessions/types";
import { optionsDeLaListe } from "../utilitaires/listes";

// L'espace « Replays de live » (migration 0046, liste du 31 octobre 2026, tâche 11) : un onglet de plus ; seuls l'équipe
// et les formateurs y publient ; un live terminé mène à ses replays (« Voir le replay »).
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/accueil" }));
vi.mock("@/components/communaute/EditeurTexte", () => import("./editeur-simule"));
vi.mock("@/lib/communaute/actions", () => ({ chargerFil: vi.fn(), publierPublication: vi.fn(), masquerAnnonce: vi.fn() }));
vi.mock("@/lib/communaute/nouvelles", () => ({ compterNouvellesPublications: vi.fn(async () => ({ nombre: 0, auteurs: [] })) }));
const { PageCommunaute } = await import("@/components/communaute/PageCommunaute");
const { CarteSession } = await import("@/components/sessions/CarteSession");
const { BlocSession } = await import("@/components/sessions/BlocSession");

const MOI: MoiCommunaute = { compteId: "moi", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const GENERAL: Espace = { id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true };
const DIGITAL: Espace = { id: "22222222-2222-4222-8222-222222222222", nom: "Compétences digitales", nomCourt: "Digital", couleur: "digital", slug: "digital", ouvert: true };
const REPLAYS: Espace = { id: "replays", nom: "Replays de live", nomCourt: "Replays", couleur: null, slug: null, ouvert: true };
const afficher = (espaces: Espace[], ongletInitial = "tous") =>
  render(
    <ToastProvider>
      <PageCommunaute espaces={espaces} initial={{ publications: [], suite: false }} moi={MOI} ongletInitial={ongletInitial} maintenant="2026-10-14T15:00:00Z" />
    </ToastProvider>,
  );
/** Ouvre le champ de publication, puis lit les choix de « Publication dans ». */
const destinations = async () => {
  await userEvent.setup().click(screen.getByRole("button", { name: "Quoi de neuf, Koffi ?" }));
  return optionsDeLaListe(screen.getByRole("combobox", { name: "Publication dans" }));
};

describe("L'espace « Replays de live »", () => {
  it("un onglet de plus, en dernier ; un étudiant le lit sans pouvoir y publier", () => {
    afficher([GENERAL, DIGITAL, { ...REPLAYS, peutPublier: false }], "replays");
    const onglets = screen.getByRole("group", { name: "Choisir un espace" });
    expect(within(onglets).getAllByRole("button").map((b) => b.textContent)).toEqual(["Actualités", "Général", "Digital", "Replays"]);
    expect(screen.queryByRole("button", { name: "Quoi de neuf, Koffi ?" })).toBeNull();
    expect(screen.getByText("Les replays des lives sont publiés ici par l’équipe Étudium et les formateurs.")).toBeInTheDocument();
  });

  it("ailleurs, « Publication dans » ne propose pas les replays à un étudiant", async () => {
    afficher([GENERAL, DIGITAL, { ...REPLAYS, peutPublier: false }]);
    expect(await destinations()).toEqual(["Général", "Digital"]);
  });

  it("l'équipe ou un formateur : « Replays » dans « Publication dans », choisi d'office dans son onglet", async () => {
    afficher([GENERAL, DIGITAL, REPLAYS], "replays");
    expect(await destinations()).toEqual(["Général", "Digital", "Replays"]);
    expect(screen.getByRole("combobox", { name: "Publication dans" })).toHaveTextContent("Replays");
  });
});

describe("« Voir le replay »", () => {
  const SESSION: SessionCarte = {
    id: "11111111-1111-4111-8111-111111111111",
    titre: "Excel avancé",
    description: "",
    debut: "2026-10-10T14:00:00Z",
    dureeMinutes: 60,
    plateforme: "Google Meet",
    lien: null,
    parcours: null,
    animateur: "Dr Mireille Adjovi",
    inscriptions: 12,
    inscrit: true,
    statut: "programmee",
  };
  const MAINTENANT = new Date("2026-10-14T15:00:00Z");
  const rien = () => {};

  it("un live terminé, sur la page Événements : il mène à l'onglet des replays ; annulé : non", () => {
    const { unmount } = render(<CarteSession session={SESSION} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    expect(screen.getByRole("link", { name: "Voir le replay" })).toHaveAttribute("href", "/accueil?espace=replays");
    expect(screen.queryByRole("button", { name: "Rejoindre" })).toBeNull();
    unmount();
    render(<CarteSession session={{ ...SESSION, statut: "annulee" }} maintenant={MAINTENANT} onInscrire={rien} onDesinscrire={rien} />);
    expect(screen.queryByRole("link", { name: "Voir le replay" })).toBeNull();
  });

  it("un live terminé, dans sa publication de la communauté : « Voir le replay » aussi (pas dans l'aperçu du formulaire)", () => {
    const bloc: SessionPublication = {
      id: SESSION.id,
      debut: SESSION.debut,
      dureeMinutes: 60,
      plateforme: "Google Meet",
      animateur: "Dr Mireille Adjovi",
      statut: "programmee",
      inscriptions: 12,
      inscrit: true,
    };
    const { unmount } = render(<BlocSession session={bloc} maintenant={MAINTENANT} lienReplays="/formateur/communaute?espace=replays" />);
    expect(screen.getByText("Terminée")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir le replay" })).toHaveAttribute("href", "/formateur/communaute?espace=replays");
    unmount();
    render(<BlocSession session={bloc} maintenant={MAINTENANT} apercu />);
    expect(screen.queryByRole("link", { name: "Voir le replay" })).toBeNull();
  });
});
