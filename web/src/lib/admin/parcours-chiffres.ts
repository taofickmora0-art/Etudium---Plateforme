// Les chiffres de la page Parcours du back-office (migration 0065 ; demande du 2 novembre 2026, option A). Sans accès
// au serveur : la grille (composant client) les lit aussi.

export type ChiffresParcours = { formationsPubliees: number; formationsBrouillons: number; apprenants: number; certificats: number };

export type StatistiquesParcours = {
  totaux: { parcoursActifs: number; formationsPubliees: number; apprenants: number; certificats: number };
  /** Par identifiant de parcours ; un parcours absent n'a pas de chiffres. */
  parParcours: Record<string, ChiffresParcours>;
};

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === "object" ? (v as Brut) : {});
const entier = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

/** parcours_back_office() → StatistiquesParcours ; un champ absent vaut 0. */
export function versStatistiquesParcours(brut: unknown): StatistiquesParcours {
  const b = objet(brut);
  const t = objet(b.totaux);
  const parParcours: Record<string, ChiffresParcours> = {};
  for (const p of Array.isArray(b.parcours) ? b.parcours.map(objet) : []) {
    if (typeof p.id !== "string" || !p.id) continue;
    parParcours[p.id] = {
      formationsPubliees: entier(p.formations_publiees),
      formationsBrouillons: entier(p.formations_brouillons),
      apprenants: entier(p.apprenants),
      certificats: entier(p.certificats),
    };
  }
  return {
    totaux: { parcoursActifs: entier(t.parcours_actifs), formationsPubliees: entier(t.formations_publiees), apprenants: entier(t.apprenants), certificats: entier(t.certificats) },
    parParcours,
  };
}

/** « 1 formation », « 8 formations », « 0 brouillon ». */
export const compter = (n: number, mot: string) => `${n.toLocaleString("fr-FR")} ${mot}${n > 1 ? "s" : ""}`;

/** La part des apprenants d'un parcours, en % entier (0 sans apprenant). */
export const part = (apprenants: number, total: number) => (total > 0 ? Math.min(100, Math.round((100 * apprenants) / total)) : 0);

// ─── La fiche d'un parcours (0066) ──────────────────────────────────────────────────────────────────

export type StatutFormationParcours = "brouillon" | "publiee" | "archivee" | "desactivee";
export type FormationDuParcours = {
  id: string;
  titre: string;
  slug: string;
  statut: StatutFormationParcours;
  apprenants: number;
  certificats: number;
  /** Les autres parcours où elle figure aussi. */
  autresParcours: string[];
};
export type ApprenantDuParcours = { id: string; nom: string; formations: number; certificats: number; derniereActivite: string };

export type FicheParcoursDonnees = {
  chiffres: { formationsPubliees: number; formationsBrouillons: number; apprenants: number; certificats: number; sessionsAVenir: number; publications30j: number };
  formations: FormationDuParcours[];
  /** Les 100 plus récemment actifs, et le total. */
  apprenants: { total: number; liste: ApprenantDuParcours[] };
  sessions: { id: string; titre: string; debut: string }[];
  /** Les formations qu'on peut encore y ajouter. */
  aAjouter: { id: string; titre: string; statut: StatutFormationParcours }[];
};

const STATUTS: readonly string[] = ["brouillon", "publiee", "archivee", "desactivee"];
const statut = (v: unknown): StatutFormationParcours => (typeof v === "string" && STATUTS.includes(v) ? (v as StatutFormationParcours) : "brouillon");
const texte = (v: unknown) => (typeof v === "string" ? v : "");
const liste = (v: unknown): Brut[] => (Array.isArray(v) ? v.map(objet) : []);

/** parcours_detail_back_office() → FicheParcoursDonnees ; une ligne sans identifiant est écartée. */
export function versFicheParcours(brut: unknown): FicheParcoursDonnees {
  const b = objet(brut);
  const c = objet(b.chiffres);
  const a = objet(b.apprenants);
  return {
    chiffres: {
      formationsPubliees: entier(c.formations_publiees),
      formationsBrouillons: entier(c.formations_brouillons),
      apprenants: entier(c.apprenants),
      certificats: entier(c.certificats),
      sessionsAVenir: entier(c.sessions_a_venir),
      publications30j: entier(c.publications_30j),
    },
    formations: liste(b.formations).flatMap((f) =>
      texte(f.id)
        ? [{
            id: texte(f.id),
            titre: texte(f.titre),
            slug: texte(f.slug),
            statut: statut(f.statut),
            apprenants: entier(f.apprenants),
            certificats: entier(f.certificats),
            autresParcours: Array.isArray(f.autres_parcours) ? f.autres_parcours.filter((n): n is string => typeof n === "string") : [],
          }]
        : [],
    ),
    apprenants: {
      total: entier(a.total),
      liste: liste(a.liste).flatMap((x) =>
        texte(x.id) ? [{ id: texte(x.id), nom: texte(x.nom), formations: entier(x.formations), certificats: entier(x.certificats), derniereActivite: texte(x.derniere_activite) }] : [],
      ),
    },
    sessions: liste(b.sessions).flatMap((x) => (texte(x.id) ? [{ id: texte(x.id), titre: texte(x.titre), debut: texte(x.debut) }] : [])),
    aAjouter: liste(b.a_ajouter).flatMap((x) => (texte(x.id) ? [{ id: texte(x.id), titre: texte(x.titre), statut: statut(x.statut) }] : [])),
  };
}

