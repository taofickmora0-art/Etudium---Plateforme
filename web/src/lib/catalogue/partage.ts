import type { Metadata } from "next";
import type { FicheFormation } from "./types";

// Aperçu du lien d'une fiche partagée (WhatsApp, Facebook…) : titre, description et image (spec du lot 1, §9).

const LONGUEUR_DESCRIPTION = 160;

/** Coupe sur un mot, avec « … », pour rester sous 160 caractères. */
function couper(texte: string) {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= LONGUEUR_DESCRIPTION) return propre;
  const coupe = propre.slice(0, LONGUEUR_DESCRIPTION - 1);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > 80 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

export function metadonneesFiche(fiche: FicheFormation | null): Metadata {
  if (!fiche) return { title: "Formation introuvable · Étudium" };
  const description = couper(fiche.resume || fiche.description || "Une formation Étudium.");
  return {
    title: `${fiche.titre} · Étudium`,
    description,
    // L'image vient de opengraph-image.tsx, à côté de la page.
    openGraph: { title: fiche.titre, description, type: "website", locale: "fr_FR", siteName: "Étudium" },
    twitter: { card: "summary_large_image", title: fiche.titre, description },
  };
}
