// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page, { metadata } from "@/app/(auth)/confidentialite/page";

const SECTIONS = [
  "1. Responsable du traitement",
  "2. Les données que nous traitons",
  "3. Pourquoi nous les utilisons",
  "4. Qui voit vos données",
  "5. Nos prestataires",
  "6. Cookies et stockage local",
  "7. Durée de conservation",
  "8. Vos droits",
  "9. Sécurité",
  "10. Modification de cette politique",
  "11. Contact",
];

/** Le texte de la page, espaces insécables ramenées à des espaces simples. */
const texte = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

describe("Politique de confidentialité", () => {
  it("a un titre, une description et la date de mise à jour", () => {
    render(<Page />);
    expect(metadata.title).toBe("Politique de confidentialité · Étudium");
    expect(metadata.description).toMatch(/prestataires/);
    expect(screen.getByRole("heading", { level: 1, name: "Politique de confidentialité" })).toBeInTheDocument();
    expect(screen.getByText("Dernière mise à jour : 12 novembre 2026")).toBeInTheDocument();
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
    expect(liens.length).toBeGreaterThan(1);
    liens.forEach((lien) => expect(lien).toHaveAttribute("href", "mailto:contact@etudium.online"));
  });

  it("nomme les prestataires", () => {
    render(<Page />);
    const prestataires = within(document.getElementById("prestataires") as HTMLElement);
    for (const nom of [/^Supabase :/, /^Vercel :/, /^Resend :/, /^Google :/, /^Payiz :/, /^SasPay :/, /^Anthropic :/, /^YouTube, Vimeo/]) {
      expect(prestataires.getByText(nom)).toBeInTheDocument();
    }
    expect(texte()).toContain("hébergés dans l’Union européenne (région de Paris)");
    // Tous les pays depuis le 3 novembre 2026 : le pays du payeur part chez Payiz et reste noté avec le paiement.
    expect(texte()).toContain("Payiz reçoit votre numéro de téléphone, votre pays, le montant et la référence du paiement.");
    // SasPay en secours (12 novembre 2026) : il reçoit aussi le nom et l'adresse e-mail.
    expect(texte()).toContain("SasPay reçoit votre numéro de téléphone, votre pays, vos nom, prénom et adresse e-mail, le montant et la référence du paiement.");
    expect(texte()).toContain("Votre numéro de téléphone est transmis au prestataire de paiement (Payiz ou SasPay) pour la demande de paiement.");
  });

  it("le paiement : le pays et l’opérateur notés, le numéro gardé masqué", () => {
    render(<Page />);
    const t = texte();
    expect(t).toContain("l’état du paiement, le pays et l’opérateur");
    expect(t).toContain("Étudium ne le garde que masqué (par exemple +229 •• •• •• •• 00).");
  });

  it("décrit les cookies réels, sans publicité ni mesure d’audience", () => {
    render(<Page />);
    const t = texte();
    for (const cookie of ["« sb-… »", "« etudium-souvenir »", "« etudium-verification »", "« etudium-suite »"]) expect(t).toContain(cookie);
    expect(t).toContain("Il n’y a ni cookie publicitaire, ni outil de mesure d’audience.");
  });

  it("dit ce qui reste après la suppression du compte, et les droits avec l’APDP", () => {
    render(<Page />);
    const t = texte();
    expect(t).toContain("vos certificats déjà délivrés, qui restent vérifiables à votre nom");
    expect(t).toContain("détachée de votre compte");
    expect(t).toContain("loi n° 2017-20 du 20 avril 2018 portant Code du numérique en République du Bénin");
    expect(t).toContain("Autorité de protection des données à caractère personnel (APDP)");
  });

  it("renvoie vers les conditions d’utilisation et l’inscription", () => {
    render(<Page />);
    const conditions = screen.getAllByRole("link", { name: "conditions d’utilisation" });
    expect(conditions.map((l) => l.getAttribute("href"))).toContain("/conditions");
    expect(screen.getAllByRole("link", { name: "Retour à l’inscription" })[0]).toHaveAttribute("href", "/inscription");
  });
});
