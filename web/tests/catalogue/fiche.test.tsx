// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FicheFormation } from "@/lib/catalogue/types";
import { parSlug } from "./cartes-design";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations/maitriser-microsoft-excel" }));

const { FichePublique } = await import("@/components/catalogue/FichePublique");
const { FicheConnectee } = await import("@/components/catalogue/FicheConnectee");

const lecon = (id: string, titre: string, dureeSecondes: number, apercu = false, accessible = apercu) => ({ id, titre, dureeSecondes, apercu, accessible });

/** La fiche d'Excel du design (programme réduit), payante, avec 2 leçons d'aperçu. */
const EXCEL: FicheFormation = {
  ...parSlug("maitriser-microsoft-excel"),
  dureeSecondes: 8407,
  nbLecons: 12,
  seuilVideo: 90,
  description: "Des formules aux tableaux croisés dynamiques, apprenez à analyser vos données de mémoire et à présenter des résultats clairs.",
  objectifs: ["Construire des formules fiables et lisibles", "Créer des tableaux croisés dynamiques"],
  competences: ["Formules", "Graphiques"],
  formateur: { nom: "Dr Mireille Adjovi", titre: "Enseignante en statistiques appliquées", domaine: "Statistiques appliquées · Analyse de données", presentation: "Elle accompagne…" },
  modules: [
    {
      id: "m1",
      titre: "Bases d’Excel",
      lecons: [lecon("l1", "Découvrir l’interface", 370, true), lecon("l2", "Saisir et mettre en forme des données", 750, true), lecon("l3", "Les formules essentielles", 845)],
    },
    { id: "m2", titre: "Formules et fonctions", lecons: [lecon("l4", "SI, ET, OU", 800)] },
  ],
};
const ADRESSE = "/formations/maitriser-microsoft-excel/lecons";

describe("Fiche d'une formation, pour un visiteur", () => {
  it("le visiteur voit l'aperçu, l'offre et le programme", () => {
    render(<FichePublique fiche={EXCEL} />);
    expect(screen.getByRole("heading", { level: 1, name: "Maîtriser Microsoft Excel" })).toBeInTheDocument();
    const apercus = screen.getAllByRole("link", { name: /Voir l’aperçu gratuit/ });
    expect(apercus[0]).toHaveAttribute("href", `${ADRESSE}/l1`);
    expect(screen.getByText("Incluse dans le parcours")).toBeInTheDocument();
    expect(screen.getByText("Avec les formules Basique, Standard et Premium.")).toBeInTheDocument();
    expect(screen.getByText("Disponible aussi seule, en formation complémentaire.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Créer mon compte gratuit" })[0]).toHaveAttribute("href", "/inscription");
    // Programme : les leçons d'aperçu ont leur lien, les autres ne sont pas cliquables.
    const programme = screen.getByRole("region", { name: "Programme" });
    expect(within(programme).getAllByRole("link", { name: "Aperçu" }).map((a) => a.getAttribute("href"))).toEqual([`${ADRESSE}/l1`, `${ADRESSE}/l2`]);
    expect(within(programme).queryByRole("link", { name: /Les formules essentielles/ })).toBeNull();
    expect(within(programme).getByText("2 modules · 12 leçons · 2 h 20")).toBeInTheDocument();
    expect(screen.getByText("Commencez gratuitement dès aujourd’hui")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Découvrir les formations" })).toHaveAttribute("href", "/formations");
  });

  it("une formation gratuite se présente comme telle", () => {
    render(<FichePublique fiche={{ ...EXCEL, gratuite: true, achatSepare: false }} />);
    expect(screen.getByText("Formation gratuite")).toBeInTheDocument();
    expect(screen.getByText("Toutes les leçons s’ouvrent avec un compte gratuit.")).toBeInTheDocument();
    expect(screen.queryByText("Disponible aussi seule, en formation complémentaire.")).toBeNull();
  });

  it("sans avis, la fiche le dit, et annonce la règle des 50 %", () => {
    render(<FichePublique fiche={EXCEL} />);
    expect(screen.getByText("Pas encore d’avis")).toBeInTheDocument();
    expect(screen.getByText("Vous pourrez laisser un avis à partir de 50 % de progression.")).toBeInTheDocument();
  });

  it("sans formateur ni aperçu, ces blocs disparaissent", () => {
    const sansApercu = EXCEL.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, apercu: false, accessible: false })) }));
    render(<FichePublique fiche={{ ...EXCEL, formateur: null, modules: sansApercu }} />);
    expect(screen.queryByText("Votre formateur·rice")).toBeNull();
    expect(screen.queryByRole("link", { name: /Voir l’aperçu gratuit/ })).toBeNull();
  });
});

describe("Fiche d'une formation, pour un compte connecté", () => {
  it("formation payante : leçons d'aperçu ouvertes, les autres fermées par un cadenas", () => {
    render(<FicheConnectee fiche={EXCEL} />);
    const programme = screen.getByRole("region", { name: "Programme" });
    expect(within(programme).getByRole("link", { name: /Découvrir l’interface/ })).toHaveAttribute("href", `${ADRESSE}/l1`);
    expect(within(programme).queryByRole("link", { name: /Les formules essentielles/ })).toBeNull();
    expect(within(programme).getByText("Les formules essentielles").closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Incluse dans les formules Basique, Standard et Premium.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voir l’aperçu gratuit/ })).toHaveAttribute("href", `${ADRESSE}/l1`);
    // Lot 1 : personne n'a encore d'abonnement, la formation n'est pas « dans votre parcours ».
    expect(screen.getByText("Incluse dans le parcours Réussite académique.")).toBeInTheDocument();
  });

  it("formation gratuite : toutes les leçons sont ouvertes, et l'on commence en un clic", () => {
    const ouverte = EXCEL.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, accessible: true })) }));
    render(<FicheConnectee fiche={{ ...EXCEL, gratuite: true, modules: ouverte }} />);
    const programme = screen.getByRole("region", { name: "Programme" });
    // Module 1 ouvert par défaut : ses 3 leçons sont des liens (le module 2 se déplie au clic).
    expect(within(programme).getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Commencer" })).toHaveAttribute("href", `${ADRESSE}/l1`);
    expect(screen.getByText("Formation gratuite : toutes les leçons sont ouvertes.")).toBeInTheDocument();
  });

  it("formation verrouillée sans aperçu : pas de bouton", () => {
    const fermee = EXCEL.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, apercu: false, accessible: false })) }));
    render(<FicheConnectee fiche={{ ...EXCEL, modules: fermee }} />);
    expect(screen.getByText("Formation verrouillée")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Commencer|Voir l’aperçu/ })).toBeNull();
  });

  it("la durée et le nombre de leçons viennent des données ; pas d'avis inventé", () => {
    render(<FicheConnectee fiche={EXCEL} />);
    expect(screen.getAllByText("2 h 20").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12 leçons").length).toBeGreaterThan(0);
    expect(screen.getByText("Pas encore d’avis")).toBeInTheDocument();
    expect(screen.queryByText(/Écrire à la formatrice/)).toBeNull();
  });

  it("une formation sans leçon annonce son programme à venir", () => {
    render(<FicheConnectee fiche={{ ...EXCEL, modules: [], nbLecons: 0, dureeSecondes: 0 }} />);
    expect(screen.getByText("Le programme arrive bientôt.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Commencer/ })).toBeNull();
  });

  it("sur petit écran, rien ne déborde : boutons qui passent à la ligne, illustrations masquées", () => {
    render(<FichePublique fiche={EXCEL} />);
    for (const lien of screen.getAllByRole("link", { name: "Créer mon compte gratuit" })) expect(lien.className).not.toMatch(/(^|s)whitespace-nowrap/);
    const bande = screen.getByText("Commencez gratuitement dès aujourd’hui").closest("section")!;
    expect(bande.querySelector("[data-illustrations]")).toHaveClass("max-sm:hidden");
  });
});

describe("Note de la formation dans le bandeau (tâche 1.11)", () => {
  it("« 4,8 (126 avis) » avec au moins un avis, rien sans avis", () => {
    const { unmount } = render(<FichePublique fiche={{ ...EXCEL, note: 4.8, nbAvis: 126 }} />);
    expect(screen.getByText("4,8 (126 avis)")).toBeInTheDocument();
    unmount();
    const connectee = render(<FicheConnectee fiche={{ ...EXCEL, note: 4.8, nbAvis: 126 }} />);
    expect(screen.getByText("4,8 (126 avis)")).toBeInTheDocument();
    connectee.unmount();
    render(<FichePublique fiche={EXCEL} />);
    expect(screen.queryByText(/\(\d+ avis\)/)).toBeNull();
  });

  it("fiche connectée : la note du bandeau vient des avis lus pour ce compte (son avis masqué y compte, pour lui seul)", async () => {
    const { ToastProvider } = await import("@/components/ui/Toast");
    const { resumeDepuis } = await import("@/lib/avis/regles");
    const sien = { id: "a1", note: 5 as const, commentaire: "", auteur: "Aïcha", initiales: "A", creeLe: "2026-10-12T10:00:00Z", modifieLe: "2026-10-12T10:00:00Z", estMoi: true };
    render(
      <ToastProvider>
        <FicheConnectee fiche={{ ...EXCEL, note: null, nbAvis: 0 }} avis={{ avis: [sien], resume: resumeDepuis({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }) }} />
      </ToastProvider>,
    );
    expect(screen.getByText("5,0 (1 avis)")).toBeInTheDocument();
  });
});

describe("Image de couverture de la fiche", () => {
  const AVEC = { ...EXCEL, couverture: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg" };
  const image = (racine: HTMLElement) =>
    [...racine.querySelectorAll("[data-couverture-fiche] img")].some((i) => decodeURIComponent(i.getAttribute("src") ?? "").includes("https://projet.supabase.co/storage/v1/object/public/couvertures/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg"));

  it("fiche publique et fiche connectée : la couverture quand elle existe, la couverture par défaut sinon", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
    const publique = render(<FichePublique fiche={AVEC} />);
    expect(image(publique.container)).toBe(true);
    publique.unmount();
    const connectee = render(<FicheConnectee fiche={AVEC} />);
    expect(image(connectee.container)).toBe(true);
    connectee.unmount();
    const sans = render(<FicheConnectee fiche={EXCEL} />);
    expect(sans.container.querySelector("[data-couverture-fiche] img")).toBeNull();
    expect(sans.container.querySelector("[data-couverture-fiche] [data-parcours='academique']")).not.toBeNull();
    vi.unstubAllEnvs();
  });
});

