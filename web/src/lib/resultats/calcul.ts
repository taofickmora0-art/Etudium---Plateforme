import type { Categorie, Ecue, Note, ParcoursComplet, Regles, Ue } from "./types";

// Les calculs de « Mes résultats » (spec du 5 novembre 2026, §3), sans dépendance : l'écran et les tests s'en servent.
//   - Une ECUE : dans chaque type de notes, la moyenne simple des notes ramenées sur 20 ; puis la moyenne des types,
//     pondérée par leurs poids (le barème de l'ECUE, sinon celui du parcours). Le rattrapage remplace l'examen (ou la
//     meilleure des deux est gardée). Un type sans note : la moyenne se fait sur les autres, « provisoire ».
//   - Une UE : la moyenne de ses ECUE, pondérée par leurs poids (crédits ou coefficients) ; validée à partir du seuil,
//     quand rien ne manque.
//   - Un semestre : la moyenne de ses UE, pondérée par leurs crédits ; la compensation, si elle est activée.
//   - « Ce qu'il te faut » : la note minimale à l'examen (le même pour les ECUE où seul l'examen manque).
// Rien n'est arrondi : seul l'affichage arrondit (formaterNote).

export const REGLES_PAR_DEFAUT: Regles = {
  seuilUe: 10,
  seuilSemestre: 10,
  compensation: false,
  rattrapage: "remplace",
  categories: [
    { cle: "cc", nom: "Contrôle continu", poids: 40 },
    { cle: "examen", nom: "Examen", poids: 60, examen: true },
  ],
};

const deux = (cc: number): Categorie[] => [
  { cle: "cc", nom: "Contrôle continu", poids: cc },
  { cle: "examen", nom: "Examen", poids: 100 - cc, examen: true },
];

/** Les barèmes proposés ; « Personnalisé » se compose dans la fenêtre du parcours. */
export const MODELES_BAREME: { cle: string; nom: string; categories: Categorie[] }[] = [
  { cle: "40-60", nom: "40 % / 60 %", categories: deux(40) },
  { cle: "30-70", nom: "30 % / 70 %", categories: deux(30) },
  { cle: "50-50", nom: "50 % / 50 %", categories: deux(50) },
  { cle: "examen", nom: "Examen seul", categories: [{ cle: "examen", nom: "Examen", poids: 100, examen: true }] },
];

/** La note qu'il faut viser : une note (sur 20), « acquis » (déjà assuré), « impossible » (même 20 ne suffit pas). */
export type Visee = { note: number } | "acquis" | "impossible" | null;

export type ResultatCategorie = { cle: string; nom: string; poids: number; examen: boolean; moyenne: number | null };

export type ResultatEcue = {
  ecue: Ecue;
  moyenne: number | null;
  provisoire: boolean;
  categories: ResultatCategorie[];
  /** Les notes d'un type qui n'existe plus dans le barème : elles ne comptent pas. */
  nonClassees: number;
  nbNotes: number;
  /** La moyenne selon la note d'examen x : a + b·x (b = 0 si rien ne manque) ; null s'il manque autre chose. */
  lineaire: { a: number; b: number } | null;
  noteVisee: Visee;
};

export type ResultatUe = {
  ue: Ue;
  ecues: ResultatEcue[];
  moyenne: number | null;
  provisoire: boolean;
  /** null tant qu'il manque une moyenne ou une note. */
  validee: boolean | null;
  creditsAcquis: number;
  noteVisee: Visee;
};

export type ResultatSemestre = {
  ues: ResultatUe[];
  moyenne: number | null;
  provisoire: boolean;
  credits: number;
  creditsAcquis: number;
  uesValidees: number;
  /** Les UE qui ont une moyenne (et entrent dans celle du semestre). */
  uesComptees: number;
  mention: string | null;
  valide: boolean | null;
  /** Acquis grâce à la compensation (une UE au moins n'était pas validée). */
  compense: boolean;
};

export const noteSur20 = (n: Pick<Note, "note" | "sur">) => (n.note / n.sur) * 20;

const moyenneSimple = (valeurs: number[]) => (valeurs.length ? valeurs.reduce((s, v) => s + v, 0) / valeurs.length : null);

/** Une moyenne pondérée de couples [valeur, poids] ; null sans poids. */
function ponderee(couples: [number, number][]): number | null {
  const total = couples.reduce((s, [, p]) => s + p, 0);
  return total > 0 ? couples.reduce((s, [v, p]) => s + v * p, 0) / total : null;
}

function viser(lineaire: { a: number; b: number } | null, seuil: number): Visee {
  if (!lineaire || lineaire.b <= 0) return null;
  const x = (seuil - lineaire.a) / lineaire.b;
  if (x <= 0) return "acquis";
  if (x > 20) return "impossible";
  return { note: x };
}

export function resultatEcue(ecue: Ecue, notes: Note[], regles: Regles): ResultatEcue {
  const bareme = ecue.bareme ?? regles.categories;
  const siennes = notes.filter((n) => n.ecueId === ecue.id);
  const cles = new Set(bareme.map((c) => c.cle));
  const examen = bareme.find((c) => c.examen);
  let nonClassees = siennes.filter((n) => !cles.has(n.categorie)).length;
  if (!examen) nonClassees += siennes.filter((n) => n.rattrapage && cles.has(n.categorie)).length;

  const categories: ResultatCategorie[] = bareme.map((c) => {
    let moyenne = moyenneSimple(siennes.filter((n) => n.categorie === c.cle && !(n.rattrapage && examen)).map(noteSur20));
    if (c.examen) {
      const rattrapage = moyenneSimple(siennes.filter((n) => n.categorie === c.cle && n.rattrapage).map(noteSur20));
      if (rattrapage !== null) moyenne = regles.rattrapage === "meilleure" && moyenne !== null ? Math.max(moyenne, rattrapage) : rattrapage;
    }
    return { cle: c.cle, nom: c.nom, poids: c.poids, examen: c.examen === true, moyenne };
  });

  const presentes = categories.filter((c) => c.moyenne !== null);
  const moyenne = ponderee(presentes.map((c) => [c.moyenne!, c.poids]));
  const provisoire = moyenne !== null && presentes.length < categories.length;
  const total = categories.reduce((s, c) => s + c.poids, 0);
  // Linéaire en la note d'examen : tout est noté (b = 0), ou seul l'examen manque.
  const manquantes = categories.filter((c) => c.moyenne === null);
  let lineaire: { a: number; b: number } | null = null;
  if (manquantes.length === 0 && moyenne !== null) lineaire = { a: moyenne, b: 0 };
  else if (manquantes.length === 1 && manquantes[0].examen && presentes.length > 0) {
    lineaire = { a: presentes.reduce((s, c) => s + c.moyenne! * c.poids, 0) / total, b: manquantes[0].poids / total };
  }
  return { ecue, moyenne, provisoire, categories, nonClassees, nbNotes: siennes.length, lineaire, noteVisee: viser(lineaire, regles.seuilUe) };
}

export function resultatUe(ue: Ue, ecues: Ecue[], notes: Note[], regles: Regles): ResultatUe {
  const resultats = ecues.filter((e) => e.ueId === ue.id).map((e) => resultatEcue(e, notes, regles));
  const notees = resultats.filter((r) => r.moyenne !== null);
  const moyenne = ponderee(notees.map((r) => [r.moyenne!, r.ecue.poids]));
  const provisoire = moyenne !== null && resultats.some((r) => r.moyenne === null || r.provisoire);
  const validee = moyenne === null || provisoire ? null : moyenne >= regles.seuilUe;
  // Toutes les ECUE linéaires (et au moins un examen à venir) : la même note x à chaque examen manquant.
  let noteVisee: Visee = null;
  if (resultats.length > 0 && resultats.every((r) => r.lineaire)) {
    const poids = resultats.reduce((s, r) => s + r.ecue.poids, 0);
    const a = resultats.reduce((s, r) => s + r.lineaire!.a * r.ecue.poids, 0) / poids;
    const b = resultats.reduce((s, r) => s + r.lineaire!.b * r.ecue.poids, 0) / poids;
    noteVisee = viser({ a, b }, regles.seuilUe);
  }
  return { ue, ecues: resultats, moyenne, provisoire, validee, creditsAcquis: validee ? ue.credits : 0, noteVisee };
}

/** Le semestre : `ues` sont les siennes (les ECUE et notes peuvent être celles de tout le parcours). */
export function resultatSemestre(ues: Ue[], ecues: Ecue[], notes: Note[], regles: Regles): ResultatSemestre {
  const resultats = ues.map((u) => resultatUe(u, ecues, notes, regles));
  const comptees = resultats.filter((r) => r.moyenne !== null);
  const moyenne = ponderee(comptees.map((r) => [r.moyenne!, r.ue.credits]));
  const provisoire = moyenne !== null && resultats.some((r) => r.moyenne === null || r.provisoire);
  const credits = ues.reduce((s, u) => s + u.credits, 0);
  let creditsAcquis = resultats.reduce((s, r) => s + r.creditsAcquis, 0);
  const uesValidees = resultats.filter((r) => r.validee).length;
  let compense = false;
  if (regles.compensation && moyenne !== null && !provisoire && moyenne >= regles.seuilSemestre && creditsAcquis < credits) {
    compense = true;
    creditsAcquis = credits;
  }
  return {
    ues: resultats,
    moyenne,
    provisoire,
    credits,
    creditsAcquis,
    uesValidees,
    uesComptees: comptees.length,
    mention: moyenne !== null && !provisoire ? mention(moyenne) : null,
    valide: moyenne === null || provisoire ? null : creditsAcquis >= credits,
    compense,
  };
}

export type ResultatParcours = {
  semestres: (ResultatSemestre & { semestreId: string })[];
  moyenne: number | null;
  credits: number;
  creditsAcquis: number;
};

/** Le parcours : chaque semestre, la moyenne générale (pondérée par les crédits des semestres), les crédits cumulés. */
export function resultatParcours({ parcours, semestres, ues, ecues, notes }: ParcoursComplet): ResultatParcours {
  const resultats = semestres.map((s) => ({ semestreId: s.id, ...resultatSemestre(ues.filter((u) => u.semestreId === s.id), ecues, notes, parcours.regles) }));
  return {
    semestres: resultats,
    moyenne: ponderee(resultats.filter((r) => r.moyenne !== null).map((r) => [r.moyenne!, r.credits])),
    credits: resultats.reduce((s, r) => s + r.credits, 0),
    creditsAcquis: resultats.reduce((s, r) => s + r.creditsAcquis, 0),
  };
}

/** Passable dès 10, Assez bien dès 12, Bien dès 14, Très bien dès 16 ; rien en dessous de 10. */
export function mention(moyenne: number): string | null {
  if (moyenne >= 16) return "Très bien";
  if (moyenne >= 14) return "Bien";
  if (moyenne >= 12) return "Assez bien";
  if (moyenne >= 10) return "Passable";
  return null;
}

const DEUX_DECIMALES = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « 12,46 » : deux décimales, une virgule. */
export const formaterNote = (n: number) => DEUX_DECIMALES.format(n);

/** Une note à viser, arrondie au centième supérieur (8,666… → « 8,67 ») : l'atteindre suffit vraiment. */
export const formaterNoteVisee = (n: number) => DEUX_DECIMALES.format(Math.ceil(n * 100 - 1e-9) / 100);
