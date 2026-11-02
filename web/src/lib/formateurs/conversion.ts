import type { ParcoursCatalogue } from "@/lib/catalogue/types";
import type { Badge, CouleurParcours, Niveau } from "@/lib/contenus/libelles";
import { liste, texte, un, type Ligne } from "@/lib/contenus/lecture";
import { photoPublicUrl } from "@/lib/profile/photo-url";
import { versReseaux } from "./reseaux";
import type { FormateurPublic, FormationDuFormateur } from "./types";

// La réponse de formateur_public (migration 0070) dans les formes de l'appli. Conversion pure : une valeur manquante ou
// inattendue prend une valeur sûre.

export const MIGRATION_FORMATEURS = "Appliquez la migration 0070 (guide « Ce qui te revient », section 69).";

const NIVEAUX: readonly Niveau[] = ["debutant", "intermediaire", "avance"];
const BADGES: readonly Badge[] = ["populaire", "nouveau"];
const COULEURS: readonly CouleurParcours[] = ["academique", "digital", "business"];

/** Un nombre (la base rend parfois un numeric en texte) ; null sinon. */
function nombre(valeur: unknown): number | null {
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : null;
  if (typeof valeur === "string" && valeur.trim() !== "" && Number.isFinite(Number(valeur))) return Number(valeur);
  return null;
}
const entier = (valeur: unknown) => Math.max(0, Math.floor(nombre(valeur) ?? 0));

/** Les parcours actifs d'une formation, le premier (par l'ordre des parcours) d'abord ; une couleur inconnue est écartée. */
const versParcours = (p: Ligne): (ParcoursCatalogue & { position: number }) | null =>
  COULEURS.includes(p.couleur as CouleurParcours)
    ? { slug: texte(p.slug), nom: texte(p.nom), nomCourt: texte(p.nom_court), couleur: p.couleur as CouleurParcours, ordre: nombre(p.ordre) ?? 0, position: nombre(p.position) ?? 0 }
    : null;

export const versFormationDuFormateur = (f: Ligne): FormationDuFormateur => ({
  id: texte(f.id),
  slug: texte(f.slug),
  titre: texte(f.titre),
  resume: texte(f.resume),
  niveau: NIVEAUX.includes(f.niveau as Niveau) ? (f.niveau as Niveau) : "debutant",
  gratuite: f.gratuite === true,
  badge: BADGES.includes(f.badge as Badge) ? (f.badge as Badge) : null,
  publieeLe: texte(f.publiee_le),
  dureeSecondes: entier(f.duree_secondes),
  nbLecons: entier(f.nb_lecons),
  nbModules: entier(f.nb_modules),
  parcours: liste(f.parcours)
    .map(versParcours)
    .filter((p): p is ParcoursCatalogue & { position: number } => p !== null)
    .sort((a, b) => a.ordre - b.ordre),
  note: nombre(f.note_moyenne),
  nbAvis: entier(f.nb_avis),
  couverture: texte(f.couverture) || null,
});

/** La fiche publique d'un formateur ; null si la base n'a rien rendu (fiche inconnue). */
export function versFormateurPublic(brut: unknown): FormateurPublic | null {
  const f = Array.isArray(brut) ? null : un(brut);
  if (!f || typeof f !== "object" || !texte(f.id)) return null;
  const formations = liste(f.formations).map(versFormationDuFormateur);
  return {
    id: texte(f.id),
    nom: texte(f.nom),
    titre: texte(f.titre),
    domaine: texte(f.domaine),
    presentation: texte(f.presentation),
    reseaux: versReseaux(f.reseaux),
    photoUrl: photoPublicUrl(texte(f.photo) || null),
    rejointLe: texte(f.rejoint_le),
    formations,
    nbFormations: nombre(f.nb_formations) === null ? formations.length : entier(f.nb_formations),
    peutEcrire: f.peut_ecrire === true,
  };
}
