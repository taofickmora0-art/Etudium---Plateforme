// Le rangement de l'onglet Leçons (refonte des formations, étape A) : les mêmes règles que la fonction `ranger` de la
// migration 0027, pour mettre l'écran à jour aussitôt, et la traduction d'un glisser-déposer en déplacement.

type Element = { id: string };
type Section<L extends Element> = { id: string; lecons: L[] };

/** Un déplacement : une section, ou une leçon vers une section (null : la sienne), au rang `position` (1 = en tête). */
export type Deplacement = { type: "module" | "lecon"; id: string; module: string | null; position: number };

// Les éléments du glisser-déposer : sections et leçons partagent un même espace d'identifiants.
export const cleModule = (id: string) => `module:${id}`;
export const cleLecon = (id: string) => `lecon:${id}`;
function lireCle(cle: string): { type: "module" | "lecon"; id: string } | null {
  const [type, id] = cle.split(":");
  return (type === "module" || type === "lecon") && id ? { type, id } : null;
}

/** L'élément au rang `position` (borné), dans une copie de la liste. */
function placer<T>(liste: T[], element: T, position: number): T[] {
  const rang = Math.min(Math.max(position, 1), liste.length + 1) - 1;
  return [...liste.slice(0, rang), element, ...liste.slice(rang)];
}

/** Le programme après le déplacement ; inchangé si l'élément ou la section n'existe pas. Le programme reçu n'est pas modifié. */
export function deplacerDans<L extends Element, M extends Section<L>>(programme: M[], d: Deplacement): M[] {
  if (d.type === "module") {
    const section = programme.find((m) => m.id === d.id);
    return section ? placer(programme.filter((m) => m.id !== d.id), section, d.position) : programme;
  }
  const depart = programme.find((m) => m.lecons.some((l) => l.id === d.id));
  const arrivee = d.module ?? depart?.id;
  if (!depart || !programme.some((m) => m.id === arrivee)) return programme;
  const lecon = depart.lecons.find((l) => l.id === d.id)!;
  return programme.map((m) => {
    const sans = m.lecons.filter((l) => l.id !== d.id);
    if (m.id === arrivee) return { ...m, lecons: placer(sans, lecon, d.position) };
    return m.id === depart.id ? { ...m, lecons: sans } : m;
  });
}

/**
 * Un élément `actif` déposé sur `sur` : une leçon prend la place de la leçon visée (dans sa section, comme un échange de
 * rang ; ailleurs, juste avant elle), ou va à la fin de la section visée ; une section prend la place de la section visée
 * (ou de celle de la leçon visée). Rien à faire : null.
 */
export function deplacementApresDepot<L extends Element, M extends Section<L>>(programme: M[], actif: string, sur: string): Deplacement | null {
  const a = lireCle(actif);
  const s = lireCle(sur);
  if (!a || !s) return null;
  const sectionDe = (lecon: string) => programme.find((m) => m.lecons.some((l) => l.id === lecon));

  if (a.type === "module") {
    const cible = s.type === "module" ? s.id : sectionDe(s.id)?.id;
    const rang = programme.findIndex((m) => m.id === cible);
    if (!cible || cible === a.id || rang < 0 || !programme.some((m) => m.id === a.id)) return null;
    return { type: "module", id: a.id, module: null, position: rang + 1 };
  }

  const depart = sectionDe(a.id);
  if (!depart) return null;
  if (s.type === "module") {
    const section = programme.find((m) => m.id === s.id);
    if (!section || section.id === depart.id) return null;
    return { type: "lecon", id: a.id, module: section.id, position: section.lecons.length + 1 };
  }
  const arrivee = sectionDe(s.id);
  if (!arrivee || s.id === a.id) return null;
  return { type: "lecon", id: a.id, module: arrivee.id, position: arrivee.lecons.findIndex((l) => l.id === s.id) + 1 };
}
