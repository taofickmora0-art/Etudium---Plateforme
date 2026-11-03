import { liste, texte, un, type Ligne } from "@/lib/contenus/lecture";
import { photoPublicUrl } from "@/lib/profile/photo-url";
import type { Badge, Citation, CouleurGroupe, FilGroupe, Groupe, GroupeDeFormation, MessageGroupe, RaisonFermeture, ResumeGroupe, TypeGroupe } from "./types";

// Ce que rend la base (migration 0075, en JSON) mis aux formes de l'appli.

const TYPES: TypeGroupe[] = ["general", "parcours", "formation"];
const COULEURS = ["academique", "digital", "business"];
const RAISONS: RaisonFermeture[] = ["abonnement", "formateur", "inscription", "desactive"];
const nombre = (v: unknown) => Number(v) || 0;
const texteOuNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const type = (v: unknown): TypeGroupe => (TYPES.includes(v as TypeGroupe) ? (v as TypeGroupe) : "general");
const couleur = (v: unknown): CouleurGroupe => (COULEURS.includes(v as string) ? (v as CouleurGroupe) : null);
const badge = (v: unknown): Badge => (v === "formateur" || v === "equipe" ? v : null);
const nom = (l: Ligne | null) => ({ prenom: texte(l?.prenom), nom: texte(l?.nom) });

export function versResume(l: Ligne): ResumeGroupe {
  const d = un(l.dernier);
  return {
    id: texte(l.id),
    slug: texte(l.slug),
    nom: texte(l.nom),
    type: type(l.type),
    couleur: couleur(l.couleur),
    actif: l.actif !== false,
    nonLus: nombre(l.non_lus),
    coupe: l.coupe === true,
    dernier: d
      ? {
          id: texte(d.id),
          auteur: nom(un(d.auteur)),
          deMoi: d.de_moi === true,
          texte: texte(d.texte),
          image: d.image === true,
          supprime: d.supprime === true,
          retire: d.retire === true,
          creeLe: texte(d.cree_le),
        }
      : null,
  };
}

function versCitation(l: Ligne | null): Citation | null {
  if (!l || !texte(l.id)) return null;
  return { id: texte(l.id), auteur: nom(un(l.auteur)), texte: texte(l.texte), image: l.image === true, supprime: l.supprime === true };
}

export function versMessage(l: Ligne): MessageGroupe {
  const auteur = un(l.auteur);
  const image = un(l.image);
  return {
    id: texte(l.id),
    groupeId: texte(l.groupe_id),
    auteur: { id: texte(auteur?.id), ...nom(auteur), photoUrl: photoPublicUrl(texte(auteur?.photo) || null), badge: badge(auteur?.badge) },
    deMoi: l.de_moi === true,
    texte: texte(l.texte),
    image: image && texte(image.chemin) ? { chemin: texte(image.chemin), type: texte(image.type), url: null } : null,
    reponse: versCitation(un(l.reponse)),
    creeLe: texte(l.cree_le),
    modifieLe: texteOuNull(l.modifie_le),
    supprime: l.supprime === true,
    retire: l.retire === true,
    reactions: liste(l.reactions).map((r) => ({ emoji: texte(r.emoji), nombre: nombre(r.nombre), moi: r.moi === true })),
    epingle: l.epingle === true,
  };
}

export function versFil(valeur: unknown): FilGroupe {
  const l = un(valeur);
  return { messages: liste(l?.messages).map(versMessage), plusAnciens: l?.plus_anciens === true };
}

/** Le groupe d'une adresse ; null : il n'existe pas (ou plus). */
export function versGroupe(valeur: unknown): Groupe | null {
  const l = un(valeur);
  if (!l || !texte(l.id)) return null;
  const parcours = un(l.parcours);
  const formation = un(l.formation);
  const commun = {
    id: texte(l.id),
    slug: texte(l.slug),
    nom: texte(l.nom),
    type: type(l.type),
    couleur: couleur(l.couleur),
    actif: l.actif !== false,
    parcours: parcours ? { nom: texte(parcours.nom), slug: texte(parcours.slug) } : null,
    formation: formation ? { titre: texte(formation.titre), slug: texte(formation.slug) } : null,
  };
  if (l.ouvert !== true) {
    return { ...commun, ouvert: false, raison: RAISONS.includes(l.raison as RaisonFermeture) ? (l.raison as RaisonFermeture) : "abonnement" };
  }
  const epingle = un(l.epingle);
  return {
    ...commun,
    ouvert: true,
    membres: nombre(l.membres),
    coupe: l.coupe === true,
    peutModerer: l.peut_moderer === true,
    equipe: l.equipe === true,
    peutEcrire: l.peut_ecrire !== false,
    nonLus: nombre(l.non_lus),
    epingle: epingle && texte(epingle.id) ? versMessage(epingle) : null,
  };
}

export function versGroupeDeFormation(valeur: unknown): GroupeDeFormation | null {
  const l = un(valeur);
  if (!l) return null;
  return { actif: l.actif === true, slug: texteOuNull(l.slug), ouvert: l.ouvert === true, peutRegler: l.peut_regler === true };
}
