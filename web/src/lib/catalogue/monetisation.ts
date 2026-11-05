import type { CarteCatalogue } from "./types";

// Le lien compétence → monétisation (migration 0048 ; restructuration, §5.3 ; liste du 31 octobre 2026, tâche 14) : une
// formation de Compétences digitales ou d'Entrepreneuriat (0078) apprend à vendre une ou plusieurs compétences de
// Compétences digitales. Les liens vers une formation absente du catalogue (pas publiée, archivée) sont ignorés.

export type LienMonetisation = { businessId: string; competenceId: string };

/** Sur une fiche : les formations qui apprennent à vendre cette compétence, et les compétences à suivre d'abord. */
export type Monetisation = { aVendre: CarteCatalogue[]; aSuivre: CarteCatalogue[] };

/** La place d'une formation dans le parcours d'une de ces couleurs (Digital, puis Entrepreneuriat), puis le titre. */
function ordre(...couleurs: ("business" | "digital")[]) {
  const position = (c: CarteCatalogue) =>
    couleurs.map((couleur) => c.parcours.find((p) => p.couleur === couleur)?.position).find((p) => p !== undefined) ?? Number.MAX_SAFE_INTEGER;
  return (a: CarteCatalogue, b: CarteCatalogue) => position(a) - position(b) || a.titre.localeCompare(b.titre, "fr");
}

/** Ce que propose la fiche de cette formation. */
export function monetisationDe(formationId: string, liens: LienMonetisation[], cartes: CarteCatalogue[]): Monetisation {
  const parId = new Map(cartes.map((c) => [c.id, c]));
  const trouver = (ids: string[]) => ids.flatMap((id) => parId.get(id) ?? []);
  return {
    aVendre: trouver(liens.filter((l) => l.competenceId === formationId).map((l) => l.businessId)).sort(ordre("digital", "business")),
    aSuivre: trouver(liens.filter((l) => l.businessId === formationId).map((l) => l.competenceId)).sort(ordre("digital")),
  };
}
