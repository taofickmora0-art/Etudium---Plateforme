import type { Metadata } from "next";
import { couper } from "@/lib/catalogue/partage";
import type { FormateurPublic } from "./types";

// Titre et description du profil d'un formateur (/formateurs/[id] ; spec du 2 novembre 2026, §6), comme ceux d'une fiche.

export function metadonneesFormateur(formateur: FormateurPublic | null | "absente"): Metadata {
  if (formateur === "absente") return { title: "Formateur · Étudium" };
  if (!formateur) return { title: "Formateur introuvable · Étudium" };
  const titre = `${formateur.nom} · Formateur`;
  const description = couper(formateur.presentation || formateur.titre || formateur.domaine || "Formateur sur Étudium.");
  return {
    title: `${titre} · Étudium`,
    description,
    openGraph: { title: titre, description, type: "profile", locale: "fr_FR", siteName: "Étudium" },
  };
}
