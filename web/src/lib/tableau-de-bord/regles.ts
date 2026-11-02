import { dureeLisible } from "@/lib/catalogue/regles";
import { versProgressionJeu } from "@/lib/engagement/regles";
import type { FormationSuivie } from "@/lib/mes-formations/regles";
import { quand } from "@/lib/notifications/temps";
import type { LigneProgression } from "@/lib/progression/types";
import { dateCourte } from "@/lib/utilisateurs/regles";
import type { AContinuer, BaseTableau, ElementAFaire, Indicateurs, MotifRecommandation, TypeActivite } from "./types";

// Les règles du tableau de bord (lot 6 B, §1). La progression des formations reprend celle de « Mes formations »
// (formationsSuivies) : les mêmes leçons comptées, la même leçon où reprendre.

const MOIS_BENIN = new Intl.DateTimeFormat("fr-CA", { timeZone: "Africa/Porto-Novo", year: "numeric", month: "2-digit" });
const moisBenin = (date: Date) => MOIS_BENIN.format(date);
const pourcent = (part: number, total: number) => (total > 0 ? Math.round((100 * part) / total) : 0);

/** Les quatre chiffres du haut : progression globale (et ce mois-ci), formations en cours et commencées. */
export function indicateurs(suivies: FormationSuivie[], lignes: LigneProgression[], maintenant: Date): Indicateurs {
  const finLe = new Map(lignes.filter((l) => l.termineeLe).map((l) => [l.leconId, l.termineeLe as string]));
  const ceMois = moisBenin(maintenant);
  let total = 0;
  let faites = 0;
  let duMois = 0;
  for (const s of suivies) {
    total += s.progression.total;
    faites += s.progression.terminees.size;
    for (const id of s.progression.terminees) {
      const fin = finLe.get(id);
      if (fin && moisBenin(new Date(fin)) === ceMois) duMois += 1;
    }
  }
  return {
    progression: pourcent(faites, total),
    progressionMois: pourcent(duMois, total),
    enCours: suivies.filter((s) => s.etat === "enCours").length,
    commencees: suivies.length,
  };
}

const enCours = (suivies: FormationSuivie[]) => suivies.filter((s) => s.etat === "enCours" && s.progression.aReprendre && s.href);
const adresseLecon = (slug: string, leconId: string) => `/formations/${slug}/lecons/${leconId}`;

/** La formation en cours ouverte le plus récemment (les suivies sont déjà triées par dernière visite). */
export function continuer(suivies: FormationSuivie[]): AContinuer | null {
  const s = enCours(suivies)[0];
  const lecon = s?.progression.aReprendre;
  if (!s || !lecon) return null;
  const rang = s.fiche.modules.findIndex((m) => m.lecons.some((l) => l.id === lecon.id));
  const duree = dureeLisible(lecon.dureeSecondes);
  return {
    titre: s.fiche.titre,
    parcours: s.fiche.parcours[0] ?? null,
    lecon: [rang >= 0 ? `Module ${rang + 1}` : null, lecon.titre, duree || null].filter(Boolean).join(" · "),
    pourcentage: s.progression.pourcentage,
    temps: s.temps,
    href: adresseLecon(s.fiche.slug, lecon.id),
    hrefFormation: `/formations/${s.fiche.slug}`,
  };
}

/** « À faire » : l'exercice à corriger, le quiz à repasser, puis la leçon suivante des autres formations en cours ; 3 au plus. */
export function aFaire(base: BaseTableau["aFaire"], suivies: FormationSuivie[]): ElementAFaire[] {
  const exercices: ElementAFaire[] = base
    .filter((a) => a.type === "exercice")
    .map((a) => ({ type: "exercice", titre: "Exercice à corriger", detail: `${a.formation} · ${a.lecon}`, href: adresseLecon(a.slug, a.leconId), etiquette: "À corriger" }));
  const quiz: ElementAFaire[] = base
    .filter((a) => a.type === "quiz")
    .map((a) => ({ type: "quiz", titre: "Quiz à repasser", detail: `${a.formation} · ${a.lecon}`, href: adresseLecon(a.slug, a.leconId) }));
  const lecons: ElementAFaire[] = enCours(suivies)
    .slice(1)
    .map((s) => {
      const lecon = s.progression.aReprendre!;
      return { type: "lecon", titre: "Leçon suivante", detail: `${s.fiche.titre} · ${lecon.titre}`, href: adresseLecon(s.fiche.slug, lecon.id) };
    });
  return [...exercices, ...quiz, ...lecons].slice(0, 3);
}

const JOUR_BENIN = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo", year: "numeric", month: "2-digit", day: "2-digit" });
const joursBenin = (date: Date) => Date.parse(`${JOUR_BENIN.format(date)}T00:00:00Z`) / 86_400_000;

/** « Il y a 2 h », « Hier », « Il y a 3 jours » (jusqu'à 6), puis la date : l'activité récente (NdAccueil). */
export function quandActivite(iso: string, maintenant: Date): string {
  const ecart = joursBenin(maintenant) - joursBenin(new Date(iso));
  if (ecart <= 1) return quand(iso, maintenant);
  return ecart < 7 ? `Il y a ${ecart} jours` : dateCourte(iso);
}

// ─── La conversion de mon_tableau_de_bord() ──────────────────────────────────────────────────────────

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === "object" ? (v as Brut) : {});
const liste = (v: unknown): Brut[] => (Array.isArray(v) ? v.map(objet) : []);
const texte = (v: unknown) => (typeof v === "string" ? v : "");
const TYPES_ACTIVITE: readonly string[] = ["exercice", "quiz", "certificat", "badge"] satisfies TypeActivite[];
const MOTIFS: readonly string[] = ["suite", "monetisation", "parcours", "catalogue"] satisfies MotifRecommandation[];

/** mon_tableau_de_bord() → BaseTableau ; une ligne mal formée est écartée, un champ absent prend une valeur sûre. */
export function versBaseTableau(brut: unknown): BaseTableau {
  const b = objet(brut);
  const certificats = objet(b.certificats);
  return {
    certificats: {
      nombre: typeof certificats.nombre === "number" ? certificats.nombre : 0,
      titres: Array.isArray(certificats.titres) ? certificats.titres.filter((t): t is string => typeof t === "string") : [],
    },
    aFaire: liste(b.a_faire).flatMap((a) =>
      (a.type === "exercice" || a.type === "quiz") && texte(a.slug) && texte(a.lecon_id)
        ? [{ type: a.type, formation: texte(a.formation), slug: texte(a.slug), leconId: texte(a.lecon_id), lecon: texte(a.lecon) }]
        : [],
    ),
    activite: liste(b.activite).flatMap((a) =>
      TYPES_ACTIVITE.includes(texte(a.type)) && !Number.isNaN(Date.parse(texte(a.quand)))
        ? [{
            type: a.type as TypeActivite,
            titre: texte(a.titre),
            formation: typeof a.formation === "string" ? a.formation : null,
            score: typeof a.score === "number" ? a.score : null,
            quand: texte(a.quand),
          }]
        : [],
    ),
    jeu: versProgressionJeu(b.jeu),
    recommandations: liste(b.recommandations).flatMap((r) =>
      texte(r.id) && texte(r.slug) && MOTIFS.includes(texte(r.motif))
        ? [{ id: texte(r.id), slug: texte(r.slug), titre: texte(r.titre), motif: r.motif as MotifRecommandation, message: typeof r.message === "string" ? r.message : null }]
        : [],
    ),
  };
}
