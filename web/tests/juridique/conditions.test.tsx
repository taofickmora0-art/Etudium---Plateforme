// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page, { metadata } from "@/app/(auth)/conditions/page";

const SECTIONS = [
  "1. Qui édite Étudium",
  "2. Acceptation des conditions",
  "3. Votre compte",
  "4. Formations et certificats",
  "5. Abonnements",
  "6. Paiement et remboursements",
  "7. Communauté et messagerie",
  "8. Règles de conduite",
  "9. Modération et sanctions",
  "10. Propriété des contenus",
  "11. Responsabilité et disponibilité",
  "12. Modification des conditions",
  "13. Droit applicable et contact",
];

/** Le texte de la page, espaces insécables ramenées à des espaces simples. */
const texte = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

describe("Conditions d’utilisation", () => {
  it("a un titre, une description et la date de mise à jour", () => {
    render(<Page />);
    expect(metadata.title).toBe("Conditions d’utilisation · Étudium");
    expect(metadata.description).toMatch(/Mobile Money/);
    expect(screen.getByRole("heading", { level: 1, name: "Conditions d’utilisation" })).toBeInTheDocument();
    expect(screen.getByText("Dernière mise à jour : 3 novembre 2026")).toBeInTheDocument();
  });

  it("numérote les sections principales, et le sommaire mène à chacune", () => {
    render(<Page />);
    const titres = screen.getAllByRole("heading", { level: 2 });
    expect(titres.map((t) => t.textContent?.replace(/\s+/g, " "))).toEqual(SECTIONS);
    const sommaire = within(screen.getByRole("navigation", { name: "Sommaire" })).getAllByRole("link");
    expect(sommaire).toHaveLength(SECTIONS.length);
    sommaire.forEach((lien, i) => {
      const cible = lien.getAttribute("href")?.slice(1) ?? "";
      expect(lien.textContent?.replace(/\s+/g, " ")).toBe(SECTIONS[i]);
      expect(document.getElementById(cible)).toContainElement(titres[i]);
    });
  });

  it("donne le contact par e-mail", () => {
    render(<Page />);
    const liens = screen.getAllByRole("link", { name: "contact@etudium.online" });
    expect(liens.length).toBeGreaterThan(0);
    liens.forEach((lien) => expect(lien).toHaveAttribute("href", "mailto:contact@etudium.online"));
    expect(texte()).toContain("Étudium est un service édité par l’équipe Étudium, basée à Parakou (Bénin).");
  });

  it("décrit les abonnements, le paiement par Payiz et les remboursements tels qu’ils fonctionnent", () => {
    render(<Page />);
    const t = texte();
    expect(t).toContain("Basique : 3 mois");
    expect(t).toContain("Standard : 6 mois");
    expect(t).toContain("Premium : 1 an");
    expect(t).toContain("Il n’y a ni reconduction ni prélèvement automatique.");
    // Tous les pays et tous les opérateurs de Payiz (3 novembre 2026) : plus « MTN ou Moov » seulement.
    expect(t).toContain(
      "les opérateurs de Mobile Money proposés par notre prestataire de paiement dans votre pays (par exemple MTN, Moov ou Celtiis au Bénin). Ce prestataire est Payiz.",
    );
    expect(t).not.toContain("MTN ou Moov");
    expect(t).toContain("Les prix sont fixés en francs CFA.");
    expect(t).toContain("Payiz");
    expect(t).toContain("Chaque demande est étudiée au cas par cas.");
    expect(t).toContain("Anthropic");
    expect(t).toContain("droit béninois");
  });

  it("renvoie vers la politique de confidentialité et l’inscription", () => {
    render(<Page />);
    const politique = screen.getAllByRole("link", { name: "politique de confidentialité" });
    expect(politique.map((l) => l.getAttribute("href"))).toContain("/confidentialite");
    expect(screen.getByRole("link", { name: "Vérifier un certificat" })).toHaveAttribute("href", "/verifier");
    expect(screen.getAllByRole("link", { name: "Retour à l’inscription" })[0]).toHaveAttribute("href", "/inscription");
  });
});
