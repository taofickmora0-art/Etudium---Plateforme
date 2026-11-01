// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormationAdmin } from "@/lib/admin/types";

// L'éditeur réglé par l'espace (back-office ou espace formateur) et la relecture au back-office
// (spec de l'espace formateur, §3, §4 et §6).

const renvoyerAuFormateur = vi.fn();
vi.mock("@/lib/admin/actions", () => ({
  saveFormationInfos: vi.fn(),
  setStatutFormation: vi.fn(),
  deleteFormation: vi.fn(),
  renvoyerAuFormateur: (...a: unknown[]) => renvoyerAuFormateur(...a),
  addModule: vi.fn(),
  renameModule: vi.fn(),
  deleteModule: vi.fn(),
  addLecon: vi.fn(),
  deleteLecon: vi.fn(),
  deplacer: vi.fn(),
  enregistrerCouverture: vi.fn(),
  retirerCouverture: vi.fn(),
}));
const routeur = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => routeur, usePathname: () => "/admin/formations" }));

const { FormationInfosForm } = await import("@/components/admin/FormationInfosForm");
const { OngletLecons } = await import("@/components/admin/OngletLecons");
const { PublicationPanel } = await import("@/components/admin/PublicationPanel");
const { FiltreStatut } = await import("@/components/admin/FiltreStatut");
const { PageAdmin } = await import("@/components/admin/PageAdmin");

const FORMATION: FormationAdmin = {
  id: "f1",
  slug: "excel",
  titre: "Excel",
  statut: "brouillon",
  etat: "brouillon",
  niveau: "debutant",
  nbLecons: 1,
  parcours: [],
  resume: "",
  description: "",
  objectifs: [],
  competences: [],
  formateurId: "fa",
  gratuite: true,
  badge: "populaire",
  seuilVideo: 90,
  scoreQuiz: 70,
  exercicesObligatoires: true,
  publieeLe: null,
  parcoursIds: [],
  modules: [{ id: "m1", titre: "Module", ordre: 1, lecons: [{ id: "l1", titre: "Leçon", dureeSecondes: 0, apercu: false, aVideo: false, publiee: true, type: "lecon" as const }] }],
  couverture: null,
  modifieeParFormateurLe: null,
  envoyeeLe: null,
  renvoyeeLe: null,
  remarqueRelecture: null,
};

const avecToast = (enfant: React.ReactNode) => render(<ToastProvider>{enfant}</ToastProvider>);

beforeEach(() => {
  renvoyerAuFormateur.mockReset();
  renvoyerAuFormateur.mockResolvedValue({ ok: true });
  routeur.replace.mockClear();
});

describe("Les compétences qu'une formation Business apprend à vendre (0048 ; restructuration, §5.3)", () => {
  const PARCOURS = [
    { id: "pd", slug: "competences-digitales", nom: "Compétences digitales", nomCourt: "Digital", description: "", couleur: "digital" as const, ordre: 2, actif: true },
    { id: "pb", slug: "business-revenus-en-ligne", nom: "Business & revenus en ligne", nomCourt: "Business", description: "", couleur: "business" as const, ordre: 3, actif: true },
  ];
  const COMPETENCES = [
    { id: "c1", titre: "Canva, de débutant à expert" },
    { id: "c2", titre: "Montage vidéo sur smartphone" },
  ];

  it("la rubrique, sous les parcours : les compétences de Compétences digitales, celles déjà liées cochées", () => {
    const { container } = avecToast(<FormationInfosForm formation={FORMATION} parcours={PARCOURS} formateurs={[]} espace="formateur" competences={COMPETENCES} liees={["c2"]} />);
    const rubrique = screen.getByRole("group", { name: "Compétences à vendre" });
    expect(within(rubrique).getByText(/Pour une formation du parcours Business/)).toBeInTheDocument();
    expect(within(rubrique).getByRole("checkbox", { name: "Canva, de débutant à expert" })).not.toBeChecked();
    expect(within(rubrique).getByRole("checkbox", { name: "Montage vidéo sur smartphone" })).toBeChecked();
    expect(container.querySelector('input[name="monetisation"]')).not.toBeNull();
  });

  it("sans parcours Business, ou sans la liste : pas de rubrique", () => {
    avecToast(<FormationInfosForm formation={FORMATION} parcours={[PARCOURS[0]]} formateurs={[]} competences={COMPETENCES} liees={[]} />);
    expect(screen.queryByRole("group", { name: "Compétences à vendre" })).toBeNull();
  });
});

describe("Éditeur réglé par l'espace", () => {
  it("en formateur : pas de réglages de l'équipe, mais un bloc en lecture seule", () => {
    const { container } = avecToast(<FormationInfosForm formation={FORMATION} parcours={[]} formateurs={[]} espace="formateur" />);
    for (const nom of ["Formateur", "Badge", "Seuil de validation des vidéos (%)", "Prix en FCFA"]) expect(screen.queryByLabelText(nom)).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /Formation gratuite/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /Disponible seule/ })).not.toBeInTheDocument();
    const bloc = screen.getByRole("region", { name: "Réglé par l’équipe Étudium" });
    expect(bloc).toHaveTextContent("Gratuite : oui");
    // Plus d'achat seul ni de prix par formation (restructuration, §5.2).
    expect(bloc).not.toHaveTextContent(/Prix|Disponible seule/);
    expect(bloc).toHaveTextContent("Badge : Populaire");
    expect(bloc).toHaveTextContent("Seuil des vidéos : 90 %");
    expect(container.querySelector('input[name="espace"]')).toHaveValue("formateur");
    expect(screen.getByLabelText("Titre")).toBeInTheDocument();
  });

  it("au back-office : le formateur ; plus de « Disponible seule » ni de prix (restructuration, §5.2)", () => {
    avecToast(<FormationInfosForm formation={FORMATION} parcours={[]} formateurs={[{ id: "fa", nom: "Awa", titre: "", domaine: "", presentation: "" }]} />);
    expect(screen.getByLabelText("Formateur")).toBeInTheDocument();
    expect(screen.queryByLabelText("Prix en FCFA")).toBeNull();
    expect(screen.queryByRole("switch", { name: /Disponible seule/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "Réglé par l’équipe Étudium" })).not.toBeInTheDocument();
  });

  it("le lien d'une leçon et l'ajout d'une leçon suivent l'espace", async () => {
    const user = userEvent.setup();
    avecToast(<OngletLecons formation={FORMATION} base="/formateur/formations" />);
    expect(screen.getByRole("link", { name: "Leçon" })).toHaveAttribute("href", "/formateur/formations/f1/lecons/l1");
    await user.click(screen.getByRole("button", { name: /Ajouter une leçon à/ }));
    expect(document.querySelector('input[name="espace"][value="formateur"]')).not.toBeNull();
  });

  it("le fil d'Ariane suit la racine de l'espace", () => {
    render(
      <PageAdmin titre="Excel" fil={[{ label: "Mes formations", href: "/formateur/formations" }, { label: "Excel" }]} racine={{ label: "Espace formateur", href: "/formateur" }}>
        <p>contenu</p>
      </PageAdmin>,
    );
    expect(screen.getByRole("link", { name: "Espace formateur" })).toHaveAttribute("href", "/formateur");
    expect(screen.queryByRole("link", { name: "Back-office" })).not.toBeInTheDocument();
  });
});

describe("Relecture au back-office", () => {
  it("formation en attente : date, formateur, Publier et Renvoyer au formateur", () => {
    avecToast(<PublicationPanel id="f1" formation={{ ...FORMATION, etat: "en_attente", envoyeeLe: "2026-10-13T08:00:00Z" }} formateurNom="Awa Houngbo" />);
    expect(screen.getByText("Envoyée en relecture le 13 oct. 2026 par Awa Houngbo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Renvoyer au formateur" })).toBeInTheDocument();
  });

  it("renvoyer : la remarque est obligatoire, puis transmise", async () => {
    const user = userEvent.setup();
    avecToast(<PublicationPanel id="f1" formation={{ ...FORMATION, etat: "en_attente", envoyeeLe: "2026-10-13T08:00:00Z" }} formateurNom="Awa Houngbo" />);
    await user.click(screen.getByRole("button", { name: "Renvoyer au formateur" }));
    const fenetre = screen.getByRole("dialog");
    expect(within(fenetre).getByRole("button", { name: "Renvoyer" })).toBeDisabled();
    await user.type(within(fenetre).getByRole("textbox", { name: "Remarque pour le formateur" }), "Ajoutez une vidéo.");
    await user.click(within(fenetre).getByRole("button", { name: "Renvoyer" }));
    expect(renvoyerAuFormateur).toHaveBeenCalledWith("f1", "Ajoutez une vidéo.");
  });

  it("à corriger : la date du renvoi et la remarque", () => {
    avecToast(
      <PublicationPanel id="f1" formation={{ ...FORMATION, etat: "a_corriger", renvoyeeLe: "2026-10-13T08:00:00Z", remarqueRelecture: "Ajoutez une vidéo." }} formateurNom="Awa Houngbo" />,
    );
    expect(screen.getByText("Renvoyée au formateur le 13 oct. 2026")).toBeInTheDocument();
    expect(screen.getByText("Ajoutez une vidéo.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renvoyer au formateur" })).not.toBeInTheDocument();
  });

  it("publiée puis modifiée par le formateur : la date", () => {
    avecToast(
      <PublicationPanel
        id="f1"
        formation={{ ...FORMATION, statut: "publiee", etat: "publiee", publieeLe: "2026-10-01T08:00:00Z", modifieeParFormateurLe: "2026-10-13T08:00:00Z" }}
        formateurNom="Awa Houngbo"
      />,
    );
    expect(screen.getByText("Modifiée par le formateur le 13 oct. 2026")).toBeInTheDocument();
  });

  it("le filtre En attente", async () => {
    const user = userEvent.setup();
    render(<FiltreStatut valeur="toutes" />);
    expect(within(screen.getByRole("group", { name: "Filtrer les formations" })).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Toutes",
      "En attente",
      "Brouillons",
      "Publiées",
      "Archivées",
    ]);
    await user.click(screen.getByRole("button", { name: "En attente" }));
    expect(routeur.replace).toHaveBeenCalledWith("/admin/formations?statut=en_attente", { scroll: false });
  });
});
