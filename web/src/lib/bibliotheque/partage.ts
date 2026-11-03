import type { Metadata } from "next";
import { couper } from "@/lib/catalogue/partage";
import { urlCouverture } from "@/lib/couvertures/adresse";
import { adresseLivre } from "./regles";
import type { FicheLivre } from "./types";

// L'aperçu du lien d'une fiche de livre partagée (WhatsApp, Facebook…) : titre, description et couverture, comme pour
// les formations (src/lib/catalogue/partage.ts).

export function metadonneesLivre(fiche: FicheLivre | null): Metadata {
  if (!fiche) return { title: "Livre introuvable · Étudium" };
  const description = couper(fiche.resume || `Un livre de la bibliothèque Étudium${fiche.auteur ? `, par ${fiche.auteur}` : ""}.`);
  const image = urlCouverture(fiche.couverture);
  return {
    title: `${fiche.titre} · Bibliothèque Étudium`,
    description,
    alternates: { canonical: adresseLivre(fiche.slug) },
    openGraph: {
      title: fiche.titre,
      description,
      type: "website",
      locale: "fr_FR",
      siteName: "Étudium",
      ...(image ? { images: [{ url: image, alt: fiche.titre }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: fiche.titre, description, ...(image ? { images: [image] } : {}) },
  };
}
