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

/** L'adresse absolue d'une publication : celle que copie « Copier le lien ». */
export const lienPublication = (id: string) => `${window.location.origin}/communaute/publications/${id}`;

/** Le début d'un texte, coupé entre deux mots, avec « … » s'il est plus long (les activités récentes). */
export function extraitCourt(texte: string, max = 60): string {
  const t = texte.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const coupe = t.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > max / 2 ? coupe.slice(0, espace) : coupe).replace(/[\s.,;:!?]+$/, "")}…`;
}
