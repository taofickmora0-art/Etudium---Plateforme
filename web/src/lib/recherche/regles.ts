import { sansAccents } from "@/lib/catalogue/filtres";
import type { CarteCatalogue, ParcoursCatalogue } from "@/lib/catalogue/types";

// Recherche (spec du lot 1, §8) : formations, parcours et leçons publiés ; sans accents ni majuscules
// (« zotéro » trouve « Zotero »). La recherche se fait en mémoire : rien de la requête n'atteint la base.

export type LeconTrouvable = {
  id: string;
  titre: string;
  dureeSecondes: number;
  accessible: boolean;
  formation: { slug: string; titre: string };
  module: { numero: number; titre: string };
};

export type Resultats = { formations: CarteCatalogue[]; parcours: ParcoursCatalogue[]; lecons: LeconTrouvable[]; total: number };

/** Tous les mots de la requête apparaissent dans le texte (sans accents ni majuscules) ; une requête vide ne trouve rien. */
export function correspond(texte: string, requete: string): boolean {
  const mots = sansAccents(requete).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return false;
  const cible = sansAccents(texte);
  return mots.every((mot) => cible.includes(mot));
}

/** Une leçon se trouve par son titre ou celui de son module (« excel » → les leçons de « Bases d’Excel »). */
export function rechercher(
  { cartes, parcours, lecons }: { cartes: CarteCatalogue[]; parcours: ParcoursCatalogue[]; lecons: LeconTrouvable[] },
  q: string,
): Resultats {
  if (!q.trim()) return { formations: [], parcours: [], lecons: [], total: 0 };
  const formations = cartes.filter((c) => correspond(`${c.titre} ${c.resume}`, q));
  const trouves = parcours.filter((p) => correspond(`${p.nom} ${p.nomCourt} ${p.description ?? ""}`, q));
  const lecs = lecons.filter((l) => correspond(`${l.titre} ${l.module.titre}`, q));
  return { formations, parcours: trouves, lecons: lecs, total: formations.length + trouves.length + lecs.length };
}

/** « Recommandé pour vous » : des formations pas encore commencées ; « Populaire », puis « Nouveau », puis gratuites. */
export function recommandations(cartes: CarteCatalogue[], commencees: ReadonlySet<string>, n = 3): CarteCatalogue[] {
  const rang = (c: CarteCatalogue) => (c.badge === "populaire" ? 0 : c.badge === "nouveau" ? 1 : c.gratuite ? 2 : 3);
  return cartes
    .map((carte, ordre) => ({ carte, ordre }))
    .filter(({ carte }) => !commencees.has(carte.id))
    .sort((a, b) => rang(a.carte) - rang(b.carte) || a.ordre - b.ordre)
    .slice(0, n)
    .map(({ carte }) => carte);
}
