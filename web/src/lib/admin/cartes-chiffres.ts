// Les chiffres des cartes des pages Formations et Formateurs du back-office (migration 0068 ; demande du 2 novembre 2026).
// Sans accès au serveur.

export type ChiffresFormation = { apprenants: number; certificats: number; aCorriger: number };
export type ChiffresFormations = { apprenantsTotal: number; parFormation: Record<string, ChiffresFormation> };

export type ChiffresFormateur = { formationsPubliees: number; formationsTotal: number; apprenants: number; note: number | null; avis: number; aCorriger: number; compteRelie: boolean };
export type ChiffresFormateurs = {
  totaux: { formateurs: number; formationsPubliees: number; aCorriger: number; noteMoyenne: number | null };
  parFormateur: Record<string, ChiffresFormateur>;
};

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === "object" ? (v as Brut) : {});
const liste = (v: unknown): Brut[] => (Array.isArray(v) ? v.map(objet) : []);
const entier = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
const note = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const id = (v: unknown) => (typeof v === "string" && v ? v : null);

/** formations_back_office() → ChiffresFormations. */
export function versChiffresFormations(brut: unknown): ChiffresFormations {
  const b = objet(brut);
  const parFormation: Record<string, ChiffresFormation> = {};
  for (const f of liste(b.formations)) {
    const cle = id(f.id);
    if (cle) parFormation[cle] = { apprenants: entier(f.apprenants), certificats: entier(f.certificats), aCorriger: entier(f.a_corriger) };
  }
  return { apprenantsTotal: entier(b.apprenants_total), parFormation };
}

/** formateurs_back_office() → ChiffresFormateurs. */
export function versChiffresFormateurs(brut: unknown): ChiffresFormateurs {
  const b = objet(brut);
  const t = objet(b.totaux);
  const parFormateur: Record<string, ChiffresFormateur> = {};
  for (const f of liste(b.formateurs)) {
    const cle = id(f.id);
    if (!cle) continue;
    parFormateur[cle] = {
      formationsPubliees: entier(f.formations_publiees),
      formationsTotal: entier(f.formations_total),
      apprenants: entier(f.apprenants),
      note: note(f.note),
      avis: entier(f.avis),
      aCorriger: entier(f.a_corriger),
      compteRelie: f.compte_relie === true,
    };
  }
  return {
    totaux: { formateurs: entier(t.formateurs), formationsPubliees: entier(t.formations_publiees), aCorriger: entier(t.a_corriger), noteMoyenne: note(t.note_moyenne) },
    parFormateur,
  };
}

/** « 4,8 » : une note au dixième. */
export const noteLisible = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
