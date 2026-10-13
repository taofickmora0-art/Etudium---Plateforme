import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Sans configuration : le mode démonstration (développement) laisse tout passer.
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL manquante");
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { config, proxy } = await import("@/proxy");
const { default: EtatPage } = await import("@/app/etat/page");
const motif = new RegExp(`^${config.matcher[0]}$`);

describe("Proxy : ce qu'il surveille", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("une adresse avec un point reste protégée", () => {
    for (const page of ["/formations/python-3.12", "/certificats/ETU-2026.0042", "/accueil", "/formations/node.js", "/formations/vue.js", "/formations/excel.xml", "/ressources/guide.pdf"])
      expect(motif.test(page), page).toBe(true);
    // Fichiers à la racine du site (robots.txt, sitemap.xml… que Next pourra générer) : servis sans compte.
    for (const fichier of ["/icons/icone-192.png", "/manifest.webmanifest", "/icon.svg", "/_next/static/x.js", "/apple-icon.png", "/robots.txt", "/sitemap.xml"])
      expect(motif.test(fichier), fichier).toBe(false);
    // Fichiers de décodage de pdf.js (visualiseur, tâche 1.8) : servis à tous, visiteurs compris (aperçus gratuits).
    for (const fichier of ["/pdfjs/wasm/jbig2.wasm", "/pdfjs/wasm/jbig2_nowasm_fallback.js", "/pdfjs/standard_fonts/FoxitSerif.pfb"])
      expect(motif.test(fichier), fichier).toBe(false);
  });

  it("le mode démonstration laisse tout passer", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const reponse = await proxy(new NextRequest("http://localhost:3000/accueil"));
    expect(reponse.headers.get("location")).toBeNull();
  });

  it("le proxy transmet la page demandée aux pages (retour après une session fermée ailleurs)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const requete = new NextRequest("http://localhost:3000/profil", { headers: { "x-etudium-chemin": "//pirate.example" } });
    const reponse = await proxy(requete);
    // Next transmet à la page les en-têtes de requête listés ici ; une valeur envoyée par le navigateur est remplacée.
    expect(reponse.headers.get("x-middleware-request-x-etudium-chemin")).toBe("/profil");
  });

  it("l'état de l'application n'existe pas en ligne", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => EtatPage()).toThrow("NEXT_NOT_FOUND");
  });
});
