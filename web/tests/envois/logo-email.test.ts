import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LOGO_EMAIL, modeleEmail } from "@/lib/envois/email";

// Le vrai logo d'Étudium en tête des e-mails, au lieu de la tuile « É » (demande du 3 novembre 2026). Une image PNG
// (les messageries refusent le SVG), servie par le site : public/email/logo-etudium.png, produite par
// scripts/generer-logo-email.mjs depuis le tracé du logo.
const fichier = (chemin: string) => join(process.cwd(), chemin);
const MODELES = ["supabase/templates/confirmation-inscription.html", "supabase/templates/mot-de-passe-oublie.html", "supabase/templates/code-mot-de-passe.html"];

describe("Le logo des e-mails", () => {
  it("l'image existe, en haute définition (trois fois la taille affichée de 32 px de haut)", async () => {
    expect(existsSync(fichier("public/email/logo-etudium.png"))).toBe(true);
    const { width, height } = await sharp(fichier("public/email/logo-etudium.png")).metadata();
    expect(height).toBe(96);
    expect(width).toBe(366);
  });

  it("l'adresse absolue du site en ligne : elle s'affiche quelle que soit la base qui envoie", () => {
    expect(LOGO_EMAIL).toBe("https://etudium.online/email/logo-etudium.png");
  });

  it("les e-mails de l'application ouvrent sur le logo, sans la tuile « É »", () => {
    const { html } = modeleEmail({ titre: "Paiement reçu", texte: "Merci.", lien: "/abonnement", prenom: null }, "https://etudium.online");
    expect(html).toContain(`<img src="${LOGO_EMAIL}" width="122" height="32" alt="Étudium"`);
    expect(html).not.toMatch(/>\s*É\s*<\/td>/);
  });

  it.each(MODELES)("le modèle Supabase %s aussi", (modele) => {
    const html = readFileSync(fichier(modele), "utf8");
    expect(html).toContain(`<img src="${LOGO_EMAIL}" width="122" height="32" alt="Étudium"`);
    expect(html).not.toMatch(/>\s*É\s*<\/td>/);
  });
});
