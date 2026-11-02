// @vitest-environment jsdom
import { render as rendre, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FicheFormation } from "@/lib/catalogue/types";
import type { ApercuFormateur } from "@/lib/formateurs/types";
import { etatFormation } from "@/lib/progression/regles";
import type { LigneProgression } from "@/lib/progression/types";
import { EXCEL, EXCEL_OUVERTE, id } from "../lecon/donnees";

// La fiche d'une formation (spec du 2 novembre 2026, §5) : le bouton du haut et l'inscription, « Contenus du cours », le
// formateur du cours et sa carte au survol, la couverture retirée.
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/formations/maitriser-microsoft-excel" }));
const sInscrireFormation = vi.fn();
vi.mock("@/lib/inscriptions/actions", () => ({ sInscrireFormation: (...args: unknown[]) => sInscrireFormation(...args) }));
const ecrireAuFormateur = vi.fn();
vi.mock("@/lib/formateurs/actions", () => ({ ecrireAuFormateur: (...args: unknown[]) => ecrireAuFormateur(...args) }));

const { FicheConnectee } = await import("@/components/catalogue/FicheConnectee");
const { FichePublique } = await import("@/components/catalogue/FichePublique");

const render = (element: ReactElement) => rendre(<ToastProvider>{element}</ToastProvider>);
const ADRESSE = "/formations/maitriser-microsoft-excel/lecons";
const ID_FORMATEUR = "11111111-1111-4111-8111-111111111111";
const IL_Y_A_3_JOURS = new Date(Date.now() - 3 * 86_400_000).toISOString();
const FORMATEUR: ApercuFormateur = {
  id: ID_FORMATEUR,
  nom: "Dr Mireille Adjovi",
  titre: "Enseignante en statistiques appliquées",
  domaine: "Statistiques",
  presentation: "Elle accompagne les étudiants dans l’analyse de données.",
  reseaux: { instagram: "https://instagram.com/mireille", linkedin: "https://linkedin.com/in/mireille" },
  photoUrl: null,
  rejointLe: IL_Y_A_3_JOURS,
  nbFormations: 3,
  peutEcrire: true,
};
const GRATUITE: FicheFormation = { ...EXCEL, gratuite: true };
const ligne = (n: number, terminee: boolean): LigneProgression => ({
  leconId: id(n),
  formationId: EXCEL_OUVERTE.id,
  termineeLe: terminee ? "2026-10-12T10:00:00Z" : null,
  vueLe: new Date(Date.UTC(2026, 9, 13, 12) - (10 - n) * 60_000).toISOString(),
  positionSecondes: 0,
});
const contenus = () => screen.getByRole("region", { name: "Contenus du cours" });
/** La ligne d'une leçon du programme et son repère : rond (non vue), coche (terminée) ou cadenas (fermée). */
const repere = (titre: string) => within(contenus()).getByText(titre).closest("li")?.querySelector("[data-repere]")?.getAttribute("data-repere");

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  sInscrireFormation.mockReset();
  ecrireAuFormateur.mockReset();
});

describe("Le bouton du haut de la fiche", () => {
  it("non inscrit, formation ouverte : « S’inscrire à ce cours » ; les leçons fermées ont un cadenas et ne sont pas des liens", () => {
    render(<FicheConnectee fiche={GRATUITE} acces={{ inscrit: false, ouverte: true }} />);
    expect(screen.getByRole("button", { name: "S’inscrire à ce cours" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Commencer|Poursuivre|Voir les abonnements/ })).toBeNull();
    // Le fil : « Formations / Titre ».
    const fil = screen.getByRole("navigation", { name: "Fil d’Ariane" });
    expect(within(fil).getByRole("link", { name: "Formations" })).toHaveAttribute("href", "/formations");
    expect(within(fil).getByText("Maîtriser Microsoft Excel")).toHaveAttribute("aria-current", "page");
    // Les leçons d'aperçu restent ouvertes ; les autres : cadenas, pas de lien.
    expect(within(contenus()).getByRole("link", { name: /Découvrir l’interface/ })).toHaveAttribute("href", `${ADRESSE}/${id(1)}`);
    expect(within(contenus()).queryByRole("link", { name: /Les formules essentielles/ })).toBeNull();
    expect(within(contenus()).getByText("Les formules essentielles").closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
    expect(repere("Les formules essentielles")).toBe("cadenas");
    expect(repere("Découvrir l’interface")).toBe("rond");
  });

  it("l'inscription réussie : le bouton charge, « Inscription confirmée. », puis « Commencer le cours » vers la première leçon", async () => {
    let terminer: (valeur: { ok: true }) => void = () => {};
    sInscrireFormation.mockReturnValue(new Promise((resoudre) => (terminer = resoudre)));
    render(<FicheConnectee fiche={GRATUITE} acces={{ inscrit: false, ouverte: true }} />);
    await userEvent.click(screen.getByRole("button", { name: "S’inscrire à ce cours" }));
    expect(sInscrireFormation).toHaveBeenCalledWith(GRATUITE.id);
    expect(screen.getByRole("button", { name: "S’inscrire à ce cours" })).toHaveAttribute("aria-busy", "true");
    terminer({ ok: true });
    expect(await screen.findByText("Inscription confirmée.")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Commencer le cours" })).toHaveAttribute("href", `${ADRESSE}/${id(1)}`);
    expect(screen.queryByRole("button", { name: "S’inscrire à ce cours" })).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });

  it("l'inscription refusée : le message de la base s'affiche et le bouton reste", async () => {
    const refus = "Cette formation est réservée aux abonnés : un abonnement ouvre toutes les formations.";
    sInscrireFormation.mockResolvedValue({ ok: false, message: refus });
    render(<FicheConnectee fiche={GRATUITE} acces={{ inscrit: false, ouverte: true }} />);
    await userEvent.click(screen.getByRole("button", { name: "S’inscrire à ce cours" }));
    expect(await screen.findByText(refus)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "S’inscrire à ce cours" })).not.toHaveAttribute("aria-busy");
    expect(screen.queryByRole("link", { name: "Commencer le cours" })).toBeNull();
  });

  it("inscrit à 0 % : « Commencer le cours » ; commencée : « Poursuivre le cours », un seul bouton (plus dans la carte d'accès)", () => {
    const inscrit = { inscrit: true, ouverte: true };
    const { unmount } = render(<FicheConnectee fiche={{ ...EXCEL_OUVERTE, gratuite: true }} progression={etatFormation(EXCEL_OUVERTE, [])} acces={inscrit} />);
    expect(screen.getByRole("link", { name: "Commencer le cours" })).toHaveAttribute("href", `${ADRESSE}/${id(1)}`);
    expect(screen.queryByRole("button", { name: "S’inscrire à ce cours" })).toBeNull();
    expect(screen.getByText("Vous êtes inscrit·e : toutes les leçons sont ouvertes.")).toBeInTheDocument();
    unmount();
    const progression = etatFormation(EXCEL_OUVERTE, [ligne(1, true), ligne(2, true), ligne(3, true), ligne(4, false)]);
    render(<FicheConnectee fiche={EXCEL_OUVERTE} progression={progression} acces={inscrit} />);
    const liens = screen.getAllByRole("link", { name: "Poursuivre le cours" });
    expect(liens).toHaveLength(1);
    expect(liens[0]).toHaveAttribute("href", `${ADRESSE}/${id(4)}`);
    // La carte d'accès garde la progression et la prochaine leçon.
    expect(screen.getByText("Prochaine leçon")).toBeInTheDocument();
    expect(screen.getByText("25 %")).toBeInTheDocument();
  });

  it("équipe des contenus ou formateur de la formation (toutes les leçons ouvertes, pas d'inscription) : « Commencer le cours », ni bouton ni phrase d'inscription", () => {
    render(<FicheConnectee fiche={EXCEL_OUVERTE} acces={{ inscrit: false, ouverte: true }} lienModifier="/admin/formations/excel?onglet=lecons" />);
    expect(screen.getByRole("link", { name: "Commencer le cours" })).toHaveAttribute("href", `${ADRESSE}/${id(1)}`);
    expect(screen.queryByRole("button", { name: "S’inscrire à ce cours" })).toBeNull();
    expect(screen.queryByText(/inscri/i)).toBeNull();
    expect(screen.getByText("Toutes les leçons vous sont ouvertes.")).toBeInTheDocument();
    expect(repere("Les formules essentielles")).toBe("rond");
  });

  it("formation payante sans abonnement : « Voir les abonnements »", () => {
    render(<FicheConnectee fiche={EXCEL} acces={{ inscrit: false, ouverte: false }} />);
    expect(screen.getByRole("link", { name: "Voir les abonnements" })).toHaveAttribute("href", "/abonnement/souscrire");
    expect(screen.queryByRole("button", { name: "S’inscrire à ce cours" })).toBeNull();
  });

  it("visiteur : « S’inscrire à ce cours » mène à la création de compte, puis revient à la fiche", () => {
    render(<FichePublique fiche={EXCEL} />);
    expect(screen.getByRole("link", { name: "S’inscrire à ce cours" })).toHaveAttribute("href", "/inscription?next=%2Fformations%2Fmaitriser-microsoft-excel");
    expect(screen.getByRole("navigation", { name: "Fil d’Ariane" })).toHaveTextContent("Formations");
  });
});

describe("Contenus du cours", () => {
  it("le titre, « N modules • N leçons » ; « Module N - Titre » et « N leçons • durée » ; rond, coche ou cadenas, durée avec une icône", () => {
    const fiche: FicheFormation = { ...EXCEL_OUVERTE, modules: EXCEL_OUVERTE.modules.map((m, i) => (i === 0 ? { ...m, lecons: m.lecons.map((l, j) => (j === 3 ? { ...l, accessible: false } : l)) } : m)) };
    render(<FicheConnectee fiche={fiche} progression={etatFormation(fiche, [ligne(1, true), ligne(2, false)])} />);
    expect(screen.getByRole("heading", { level: 1, name: "Maîtriser Microsoft Excel" })).toBeInTheDocument();
    expect(screen.getByText("4 modules • 12 leçons • 2 h 20")).toBeInTheDocument();
    expect(within(contenus()).getByRole("button", { name: /^Module 1 - Bases d’Excel/ })).toHaveAttribute("aria-expanded", "true");
    expect(within(contenus()).getByRole("button", { name: /^Module 2 - Formules et fonctions/ })).toBeInTheDocument();
    expect(within(contenus()).getByText("4 leçons • 43 min")).toBeInTheDocument();
    expect(within(contenus()).getByRole("button", { name: "Tout déplier" })).toBeInTheDocument();
    expect(repere("Découvrir l’interface")).toBe("coche");
    expect(repere("Les formules essentielles")).toBe("rond");
    expect(repere("Références relatives et absolues")).toBe("cadenas");
    expect(within(contenus()).queryByRole("link", { name: /Références relatives et absolues/ })).toBeNull();
    const premiere = within(contenus()).getByRole("link", { name: /Découvrir l’interface/ });
    expect(premiere).toHaveTextContent("06:10");
    expect(premiere.querySelector("[data-duree] svg")).not.toBeNull();
    // « Vous êtes ici » : la leçon où reprendre.
    expect(within(within(contenus()).getByRole("link", { name: /Saisir et mettre en forme des données/ })).getByText("Vous êtes ici")).toBeInTheDocument();
  });

  it("ensuite, comme avant : ce que vous allez apprendre, les compétences, les avis", () => {
    render(<FicheConnectee fiche={{ ...EXCEL, objectifs: ["Construire des formules fiables"], competences: ["Formules"] }} />);
    const apprendre = screen.getByRole("heading", { name: "Ce que vous allez apprendre" });
    expect(contenus().compareDocumentPosition(apprendre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Compétences acquises")).toBeInTheDocument();
    expect(screen.getByText("Pas encore d’avis")).toBeInTheDocument();
  });
});

describe("La colonne de droite : le formateur du cours", () => {
  it("« Formateur du cours » : initiales sans « Dr », nom vers son profil, « Formateur », « 3 formations », présentation, réseaux ; puis l'accès, puis « Inclus »", () => {
    render(<FicheConnectee fiche={EXCEL} formateur={FORMATEUR} favori={false} />);
    const bloc = screen.getByRole("region", { name: "Formateur du cours" });
    expect(within(bloc).getByText("MA")).toBeInTheDocument();
    expect(within(bloc).getByRole("link", { name: "Dr Mireille Adjovi" })).toHaveAttribute("href", `/formateurs/${ID_FORMATEUR}`);
    expect(within(bloc).getByText("Formateur")).toBeInTheDocument();
    expect(within(bloc).getByText("3 formations")).toBeInTheDocument();
    expect(within(bloc).getByText("Elle accompagne les étudiants dans l’analyse de données.")).toBeInTheDocument();
    const instagram = within(bloc).getByRole("link", { name: "Instagram de Dr Mireille Adjovi" });
    expect(instagram).toHaveAttribute("href", "https://instagram.com/mireille");
    expect(instagram).toHaveAttribute("target", "_blank");
    expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(bloc).getByRole("link", { name: "LinkedIn de Dr Mireille Adjovi" })).toHaveAttribute("href", "https://linkedin.com/in/mireille");
    expect(within(bloc).queryByRole("link", { name: /YouTube/ })).toBeNull();
    // L'ordre de la colonne : formateur, carte d'accès (avec le favori), « Inclus dans la formation ».
    const favori = screen.getByRole("button", { name: "Ajouter aux favoris" });
    const inclus = screen.getByRole("heading", { name: "Inclus dans la formation" });
    expect(bloc.compareDocumentPosition(favori) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(favori.compareDocumentPosition(inclus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("la photo du compte plutôt que les initiales ; « 1 formation » au singulier ; sans réseau, pas de liste", () => {
    const photo = "https://projet.supabase.co/storage/v1/object/public/photos-profil/a/b.jpg";
    render(<FicheConnectee fiche={EXCEL} formateur={{ ...FORMATEUR, photoUrl: photo, nbFormations: 1, reseaux: {} }} />);
    const bloc = screen.getByRole("region", { name: "Formateur du cours" });
    expect(bloc.querySelector("img")).toHaveAttribute("src", photo);
    expect(within(bloc).queryByText("MA")).toBeNull();
    expect(within(bloc).getByText("1 formation")).toBeInTheDocument();
    expect(within(bloc).queryByRole("list", { name: /Réseaux/ })).toBeNull();
  });

  it("au survol du nom : la carte avec la présentation, « A rejoint », « Voir le profil » et « Message », qui ouvre la conversation", async () => {
    ecrireAuFormateur.mockResolvedValue({ ok: true, conversationId: "22222222-2222-4222-8222-222222222222" });
    render(<FicheConnectee fiche={EXCEL} formateur={FORMATEUR} />);
    await userEvent.hover(screen.getByRole("link", { name: "Dr Mireille Adjovi" }));
    const profil = await screen.findByRole("link", { name: "Voir le profil" });
    expect(profil).toHaveAttribute("href", `/formateurs/${ID_FORMATEUR}`);
    const carte = profil.closest("[data-carte-formateur]") as HTMLElement;
    expect(within(carte).getByText("A rejoint : il y a 3 jours")).toBeInTheDocument();
    expect(within(carte).getByText("Formateur")).toBeInTheDocument();
    expect(within(carte).getByText("Elle accompagne les étudiants dans l’analyse de données.")).toBeInTheDocument();
    expect(within(carte).getByRole("link", { name: "Instagram de Dr Mireille Adjovi" })).toBeInTheDocument();
    await userEvent.click(within(carte).getByRole("button", { name: "Message" }));
    expect(ecrireAuFormateur).toHaveBeenCalledWith(ID_FORMATEUR);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/messages?c=22222222-2222-4222-8222-222222222222"));
  });

  it("« Message » n'apparaît que si le compte peut écrire ; un refus s'affiche dans la carte", async () => {
    const { unmount } = render(<FicheConnectee fiche={EXCEL} formateur={{ ...FORMATEUR, peutEcrire: false }} />);
    await userEvent.hover(screen.getByRole("link", { name: "Dr Mireille Adjovi" }));
    await screen.findByRole("link", { name: "Voir le profil" });
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
    unmount();
    ecrireAuFormateur.mockResolvedValue({ ok: false, message: "Inscrivez-vous à une de ses formations pour lui écrire." });
    render(<FicheConnectee fiche={EXCEL} formateur={FORMATEUR} />);
    await userEvent.hover(screen.getByRole("link", { name: "Dr Mireille Adjovi" }));
    await userEvent.click(await screen.findByRole("button", { name: "Message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Inscrivez-vous à une de ses formations pour lui écrire.");
    expect(push).not.toHaveBeenCalled();
  });

  it("au clavier, le nom reste un simple lien vers le profil : la carte ne s'ouvre pas", async () => {
    render(<FicheConnectee fiche={EXCEL} formateur={FORMATEUR} />);
    screen.getByRole("link", { name: "Dr Mireille Adjovi" }).focus();
    await new Promise((fin) => setTimeout(fin, 600));
    expect(screen.queryByRole("link", { name: "Voir le profil" })).toBeNull();
  });

  it("sans la 0070 : le bloc d'avant (nom, titre, présentation, initiales), sans lien, survol ni « Message » ; sans formateur : rien", () => {
    const { unmount } = render(<FicheConnectee fiche={EXCEL} formateur={null} />);
    expect(screen.getByText("Votre formateur·rice")).toBeInTheDocument();
    expect(screen.getByText("Enseignante en statistiques appliquées")).toBeInTheDocument();
    expect(screen.getByText("MA")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dr Mireille Adjovi" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Formateur du cours" })).toBeNull();
    unmount();
    render(<FicheConnectee fiche={{ ...EXCEL, formateur: null }} formateur={null} />);
    expect(screen.queryByText("Votre formateur·rice")).toBeNull();
    expect(screen.queryByRole("region", { name: "Formateur du cours" })).toBeNull();
  });

  it("visiteur : la même structure, sans favori ni « Message »", async () => {
    render(<FichePublique fiche={EXCEL} formateur={{ ...FORMATEUR, peutEcrire: false }} />);
    expect(screen.getByRole("region", { name: "Formateur du cours" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Contenus du cours" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /favoris/ })).toBeNull();
    await userEvent.hover(screen.getByRole("link", { name: "Dr Mireille Adjovi" }));
    await screen.findByRole("link", { name: "Voir le profil" });
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
  });
});
