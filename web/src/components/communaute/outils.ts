import type { TagTone } from "@/components/ui/Tag";
import type { Espace } from "@/lib/communaute/types";

// Petites pièces partagées par les composants de la communauté.

const TONS_AVATAR = ["bleu", "violet", "ambre"] as const;

/** Une couleur d'avatar stable pour un même nom (le design en mêle trois). */
export function tonAvatar(nom: string): (typeof TONS_AVATAR)[number] {
  let somme = 0;
  for (const c of nom) somme += c.charCodeAt(0);
  return TONS_AVATAR[somme % TONS_AVATAR.length];
}

/** « KD » pour Koffi Dossou ; « ? » sans nom. */
export const initiales = (prenom: string, nom: string) => ((prenom.trim()[0] ?? "") + (nom.trim()[0] ?? "")).toUpperCase() || "?";

const TONS_PARCOURS: Record<string, TagTone> = { academique: "academique", digital: "digital", business: "business" };

/** L'étiquette d'un espace d'après sa couleur de parcours ; gris pour le général. */
export function tonEspace(nomCourt: string, espaces: Espace[]): TagTone {
  const couleur = espaces.find((e) => e.nomCourt === nomCourt)?.couleur;
  return (couleur && TONS_PARCOURS[couleur]) || "enAttente";
}

/** L'adresse absolue d'une publication : celle que copie « Copier le lien ». */
export const lienPublication = (id: string) => `${window.location.origin}/communaute/publications/${id}`;
