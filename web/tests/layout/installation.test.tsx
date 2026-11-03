// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/permissions";
import { DEMO_USER } from "@/lib/demo-user";
import { demandeInstallation, NAVIGATEURS, retablirNavigateur, simulerNavigateur } from "../pwa/simuler-navigateur";
// Chargés une première fois ici, sans limite de temps (la cloche, le temps réel… sont longs à préparer) : les
// rechargements de chaque test reprennent le code déjà préparé.
import "@/components/layout/HeaderActions";
import "@/components/layout/MobileProfileMenu";

// « Installer l'application » dans le menu du profil (demande du 3 novembre 2026) : sur ordinateur, le menu du rond de
// profil ; sur téléphone, la page « Profil ». Chrome : sa fenêtre d'installation ; iPhone : la marche à suivre.

vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/accueil",
}));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/full-page", () => ({ loadFullPage: vi.fn() }));
vi.mock("@/lib/envois/abonnement-push", () => ({ desabonnerPush: vi.fn(async () => null) }));
vi.mock("@/lib/envois/actions", () => ({ retirerAppareil: vi.fn() }));
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: async () => null, marquerLues: async () => ({ ok: true }) }));

const INSTALLER = "Installer l’application";

/** Le magasin de l'installation vit dans un module : rechargé à neuf pour chaque test. */
async function charger() {
  vi.resetModules();
  const { HeaderActions } = await import("@/components/layout/HeaderActions");
  const { MobileProfileMenu } = await import("@/components/layout/MobileProfileMenu");
  const { CapterInstallation } = await import("@/components/installation/CapterInstallation");
  const { ToastProvider } = await import("@/components/ui/Toast");
  return { HeaderActions, MobileProfileMenu, CapterInstallation, ToastProvider };
}

async function ordinateur() {
  const { HeaderActions, CapterInstallation, ToastProvider } = await charger();
  render(
    <ToastProvider>
      <CapterInstallation />
      <HeaderActions user={{ ...DEMO_USER, roles: ["etudiant"] }} />
    </ToastProvider>,
  );
}

async function telephone(roles: Role[] = ["etudiant"], espace?: "formateur") {
  const { MobileProfileMenu, CapterInstallation, ToastProvider } = await charger();
  render(
    <ToastProvider>
      <CapterInstallation />
      <MobileProfileMenu user={{ ...DEMO_USER, roles }} espace={espace} />
    </ToastProvider>,
  );
}

const envoyerDemande = (reponse: "accepted" | "dismissed" = "accepted") => {
  const demande = demandeInstallation(reponse);
  act(() => {
    window.dispatchEvent(demande);
  });
  return demande;
};

afterEach(() => retablirNavigateur());

describe("Installer l'application, menu du profil sur ordinateur", () => {
  it("Chrome : l'entrée apparaît avec sa demande, ouvre sa fenêtre, puis disparaît une fois l'appli installée", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeOrdinateur });
    const user = userEvent.setup();
    await ordinateur();
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(screen.queryByRole("menuitem", { name: INSTALLER })).toBeNull();
    await user.keyboard("{Escape}");

    const demande = envoyerDemande("accepted");
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    // Juste avant « Se déconnecter », après les liens du compte.
    expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["Mon profil", "Mon abonnement", INSTALLER, "Se déconnecter"]);
    await user.click(screen.getByRole("menuitem", { name: INSTALLER }));
    expect(demande.prompt).toHaveBeenCalledOnce();
    expect(await screen.findByText("Application installée.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(screen.queryByRole("menuitem", { name: INSTALLER })).toBeNull();
  });

  it("refusée dans la fenêtre de Chrome : pas de message, et l'entrée disparaît (la demande ne resert pas)", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeOrdinateur });
    const user = userEvent.setup();
    await ordinateur();
    const demande = envoyerDemande("dismissed");
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    await user.click(screen.getByRole("menuitem", { name: INSTALLER }));
    expect(demande.prompt).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(screen.queryByRole("menuitem", { name: INSTALLER })).toBeNull();
    expect(screen.queryByText("Application installée.")).toBeNull();
  });

  it("déjà installée (ouverte comme une appli) : pas d'entrée", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeOrdinateur, autonome: true });
    const user = userEvent.setup();
    await ordinateur();
    envoyerDemande();
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(screen.queryByRole("menuitem", { name: INSTALLER })).toBeNull();
  });

  it("autre navigateur (Firefox) : pas d'entrée", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.firefox });
    const user = userEvent.setup();
    await ordinateur();
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(screen.queryByRole("menuitem", { name: INSTALLER })).toBeNull();
  });

  it("iPad (qui se présente comme un Mac) : l'entrée ouvre la marche à suivre, qui garde le focus puis le rend", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.safariIpadOuMac, toucher: 5 });
    const user = userEvent.setup();
    await ordinateur();
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    await user.click(screen.getByRole("menuitem", { name: INSTALLER }));
    const fenetre = screen.getByRole("dialog", { name: "Installer Étudium sur votre iPad" });
    expect(within(fenetre).getAllByRole("listitem")).toHaveLength(3);
    expect(fenetre).toContainElement(document.activeElement as HTMLElement);
    await user.click(within(fenetre).getByRole("button", { name: "J’ai compris" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Mon profil" })).toHaveFocus();
  });
});

describe("Installer l'application, page Profil du téléphone", () => {
  it("Chrome sur Android : la ligne apparaît avec sa demande, ouvre sa fenêtre, puis disparaît une fois l'appli installée", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeAndroid, toucher: 5 });
    const user = userEvent.setup();
    await telephone();
    expect(screen.queryByRole("button", { name: INSTALLER })).toBeNull();
    const demande = envoyerDemande("accepted");
    const ligne = screen.getByRole("button", { name: INSTALLER });
    // Une cible tactile confortable, comme les autres lignes de la page (76 px).
    expect(ligne).toHaveClass("min-h-[76px]");
    // Dans la liste « Mon compte », juste avant « Se déconnecter ».
    const lignes = within(screen.getByRole("list", { name: "Mon compte" })).getAllByRole("listitem");
    expect(lignes.at(-2)).toContainElement(ligne);
    await user.click(ligne);
    expect(demande.prompt).toHaveBeenCalledOnce();
    expect(await screen.findByText("Application installée.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: INSTALLER })).toBeNull();
  });

  it("iPhone : la ligne ouvre la fenêtre « Installer Étudium sur votre iPhone » et ses trois étapes", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.safariIphone, toucher: 5 });
    const user = userEvent.setup();
    await telephone();
    const ligne = screen.getByRole("button", { name: INSTALLER });
    expect(ligne).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(ligne);
    const fenetre = screen.getByRole("dialog", { name: "Installer Étudium sur votre iPhone" });
    const etapes = within(fenetre).getAllByRole("listitem").map((e) => e.textContent);
    expect(etapes).toHaveLength(3);
    expect(etapes[0]).toContain("Touchez le bouton Partager, en bas de Safari.");
    expect(etapes[1]).toContain("Choisissez « Sur l’écran d’accueil ».");
    expect(etapes[1]).toContain("Si elle n’apparaît pas, touchez d’abord « En voir plus ».");
    expect(etapes[2]).toContain("Touchez « Ajouter », en haut à droite.");
    expect(etapes[2]).toContain("Laissez « Ouvrir comme app web » activé.");
    expect(fenetre).toHaveTextContent("Chrome et les autres navigateurs de l’iPhone le permettent aussi, par leur bouton Partager.");
    await user.click(within(fenetre).getByRole("button", { name: "J’ai compris" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ligne).toHaveFocus();
  });

  it("Chrome sur iPhone (demande du 3 novembre 2026) : les gestes de Chrome, bouton Partager dans la barre d'adresse", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeIphone, toucher: 5 });
    const user = userEvent.setup();
    await telephone();
    await user.click(screen.getByRole("button", { name: INSTALLER }));
    const fenetre = screen.getByRole("dialog", { name: "Installer Étudium sur votre iPhone" });
    const etapes = within(fenetre).getAllByRole("listitem").map((e) => e.textContent);
    expect(etapes[0]).toContain("Touchez le bouton Partager, dans la barre d’adresse de Chrome, à droite.");
    expect(etapes[0]).toContain("La barre d’adresse est en bas ou en haut de l’écran.");
    expect(etapes[1]).toContain("Choisissez « Sur l’écran d’accueil ».");
    expect(fenetre).toHaveTextContent("Si « Sur l’écran d’accueil » n’apparaît pas, ouvrez etudium.online dans Safari et recommencez.");
    expect(fenetre).not.toHaveTextContent("en bas de Safari");
  });

  it("iPhone déjà ajouté à l'écran d'accueil : pas de ligne", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.safariIphone, toucher: 5, standalone: true });
    await telephone();
    expect(screen.queryByRole("button", { name: INSTALLER })).toBeNull();
  });

  it("autre navigateur (Firefox) : pas de ligne", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.firefox, toucher: 5 });
    await telephone();
    expect(screen.queryByRole("button", { name: INSTALLER })).toBeNull();
  });

  it("le formateur a la ligne aussi, sur la page Profil de son espace", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeAndroid, toucher: 5 });
    await telephone(["etudiant", "formateur"], "formateur");
    envoyerDemande();
    expect(screen.getByRole("button", { name: INSTALLER })).toBeInTheDocument();
  });
});
