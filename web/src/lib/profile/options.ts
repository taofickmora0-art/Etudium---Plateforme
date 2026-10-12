// Listes de l'onglet Informations du profil (NdProfil). On enregistre la valeur, on affiche le libellé.

export type Option = { value: string; label: string };

export const PAYS: Option[] = [
  { value: "benin", label: "Bénin" },
  { value: "burkina_faso", label: "Burkina Faso" },
  { value: "cameroun", label: "Cameroun" },
  { value: "cote_ivoire", label: "Côte d’Ivoire" },
  { value: "gabon", label: "Gabon" },
  { value: "guinee", label: "Guinée" },
  { value: "mali", label: "Mali" },
  { value: "niger", label: "Niger" },
  { value: "rdc", label: "République démocratique du Congo" },
  { value: "senegal", label: "Sénégal" },
  { value: "togo", label: "Togo" },
  { value: "france", label: "France" },
  { value: "autre", label: "Autre pays" },
];

export const NIVEAUX: Option[] = [
  { value: "bts_dut", label: "BTS / DUT" },
  { value: "licence_1", label: "Licence 1" },
  { value: "licence_2", label: "Licence 2" },
  { value: "licence_3", label: "Licence 3" },
  { value: "master_1", label: "Master 1" },
  { value: "master_2", label: "Master 2" },
  { value: "doctorat", label: "Doctorat" },
  { value: "jeune_diplome", label: "Jeune diplômé(e)" },
  { value: "autre", label: "Autre" },
];

export function labelOf(list: Option[], value: string | null | undefined): string | null {
  return list.find((o) => o.value === value)?.label ?? null;
}
