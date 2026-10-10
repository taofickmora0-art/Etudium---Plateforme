// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConnexionPage from "@/app/(auth)/connexion/page";
import MotDePasseOubliePage from "@/app/(auth)/mot-de-passe-oublie/page";

// Ces pages restent statiques : l'adresse (?next, ?session, ?erreur, ?lien) est lue dans le navigateur.
// Un formulaire envoyé avant le chargement du JavaScript reçoit ainsi une page complète.
let adresse = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => adresse,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/connexion",
}));
vi.mock("@/lib/auth/actions", () => ({ signIn: vi.fn(), signInWithGoogle: vi.fn(), requestReset: vi.fn() }));

const champsNext = () => [...document.querySelectorAll<HTMLInputElement>('input[name="next"]')].map((i) => i.value);

describe("Adresse des écrans de compte", () => {
  beforeEach(() => {
    adresse = new URLSearchParams();
  });

  it("la page demandée est gardée pour après la connexion, avec l'e-mail comme avec Google", () => {
    adresse = new URLSearchParams("next=/certificats");
    render(<ConnexionPage />);
    expect(champsNext()).toEqual(["/certificats", "/certificats"]);
  });

  it("une adresse extérieure n'est jamais suivie", () => {
    adresse = new URLSearchParams("next=https://pirate.example");
    render(<ConnexionPage />);
    expect(champsNext()).toEqual(["/accueil", "/accueil"]);
  });

  it("le retour raté de Google est annoncé", () => {
    adresse = new URLSearchParams("erreur=google");
    render(<ConnexionPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("La connexion avec Google n’a pas abouti.");
  });

  it("une session expirée est annoncée", () => {
    adresse = new URLSearchParams("session=expiree");
    render(<ConnexionPage />);
    expect(screen.getByRole("dialog", { name: "Votre session a expiré" })).toBeInTheDocument();
  });

  it("un lien de réinitialisation expiré est annoncé", () => {
    adresse = new URLSearchParams("lien=expire");
    render(<MotDePasseOubliePage />);
    expect(screen.getByRole("status")).toHaveTextContent("Ce lien a expiré. Demandez-en un nouveau.");
  });
});
