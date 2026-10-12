// Valeurs et libellés des contenus du lot 1 (spec du lot 1, §1 Q5 et §4), les mêmes que les types de la migration 0004.

export type Niveau = "debutant" | "intermediaire" | "avance";
export type StatutFormation = "brouillon" | "publiee" | "archivee";
export type CouleurParcours = "academique" | "digital" | "business";
export type Badge = "populaire" | "nouveau";

export const NIVEAUX: { value: Niveau; label: string }[] = [
  { value: "debutant", label: "Débutant" },
  { value: "intermediaire", label: "Intermédiaire" },
  { value: "avance", label: "Avancé" },
];

export const STATUTS: Record<StatutFormation, string> = {
  brouillon: "Brouillon",
  publiee: "Publiée",
  archivee: "Archivée",
};

export const COULEURS: { value: CouleurParcours; label: string }[] = [
  { value: "academique", label: "Académique (bleu)" },
  { value: "digital", label: "Digital (violet)" },
  { value: "business", label: "Business (orange)" },
];

export const BADGES: { value: Badge; label: string }[] = [
  { value: "populaire", label: "Populaire" },
  { value: "nouveau", label: "Nouveau" },
];

export const libelleNiveau = (niveau: Niveau) => NIVEAUX.find((n) => n.value === niveau)?.label ?? niveau;
