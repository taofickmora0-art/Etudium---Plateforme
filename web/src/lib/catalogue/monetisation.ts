import type { CarteCatalogue } from "./types";

// Le lien compétence → monétisation (migration 0048 ; restructuration, §5.3 ; liste du 31 octobre 2026, tâche 14) : une
// formation du parcours Business apprend à vendre une ou plusieurs compétences de Compétences digitales. Les liens vers
// une formation absente du catalogue (pas publiée, archivée) sont ignorés.

export type LienMonetisation = { businessId: string; competenceId: string };

/** Sur une fiche : les formations Business qui apprennent à vendre cette compétence, et les compétences à suivre d'abord. */
export type Monetisation = { aVendre: CarteCatalogue[]; aSuivre: CarteCatalogue[] };

/** La place d'une formation dans le parcours d'une couleur (Business, Digital), puis le titre. */
function ordre(couleur: "business" | "digital") {
  const position = (c: CarteCatalogue) => c.parcours.find((p) => p.couleur === couleur)?.position ?? Number.MAX_SAFE_INTEGER;
  return (a: CarteCatalogue, b: CarteCatalogue) => position(a) - position(b) || a.titre.localeCompare(b.titre, "fr");
}

/** Ce que propose la fiche de cette formation. */
export function monetisationDe(formationId: string, liens: LienMonetisation[], cartes: CarteCatalogue[]): Monetisation {
  const parId = new Map(cartes.map((c) => [c.id, c]));
  const trouver = (ids: string[]) => ids.flatMap((id) => parId.get(id) ?? []);
  return {
    aVendre: trouver(liens.filter((l) => l.competenceId === formationId).map((l) => l.businessId)).sort(ordre("business")),
    aSuivre: trouver(liens.filter((l) => l.businessId === formationId).map((l) => l.competenceId)).sort(ordre("digital")),
  };
}

/**
 * L'onglet Business de la page Parcours : un groupe par compétence (dans l'ordre du parcours Digital), avec les
 * formations Business qui la monétisent ; puis « Pour toutes les compétences » (competence null), celles sans lien.
 * `business` : les formations du parcours Business, déjà dans leur ordre.
 */
export function grouperBusiness(
  business: CarteCatalogue[],
  liens: LienMonetisation[],
  cartes: CarteCatalogue[],
): { competence: CarteCatalogue | null; formations: CarteCatalogue[] }[] {
  const ids = new Set(business.map((b) => b.id));
  const utiles = liens.filter((l) => ids.has(l.businessId));
  const parId = new Map(cartes.map((c) => [c.id, c]));
  const competences = [...new Set(utiles.map((l) => l.competenceId))].flatMap((id) => parId.get(id) ?? []).sort(ordre("digital"));
  const groupes = competences.map((competence) => ({
    competence,
    formations: business.filter((b) => utiles.some((l) => l.businessId === b.id && l.competenceId === competence.id)),
  }));
  const liees = new Set(groupes.flatMap((g) => g.formations.map((f) => f.id)));
  const pourToutes = business.filter((b) => !liees.has(b.id));
  return [...groupes, ...(pourToutes.length > 0 ? [{ competence: null, formations: pourToutes }] : [])];
}
