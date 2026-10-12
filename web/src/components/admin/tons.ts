import type { TagTone } from "@/components/ui/Tag";
import type { StatutFormation } from "@/lib/contenus/libelles";

/** Couleur de l'étiquette d'un statut : gris (brouillon), vert (publiée), ambre (archivée). */
export const TON_STATUT: Record<StatutFormation, TagTone> = { brouillon: "enAttente", publiee: "valide", archivee: "aCorriger" };
