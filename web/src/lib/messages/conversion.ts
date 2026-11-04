import { liste, texte, un, type Ligne } from "@/lib/contenus/lecture";
import { photoPublicUrl } from "@/lib/profile/photo-url";
import { versDuree, versNoteVocale } from "@/lib/vocal/regles";
import type { Contact, ConversationResume, Fil, Message } from "./types";

// Les réponses de la base (migration 0035) dans les formes de l'appli.

export const MIGRATION_MESSAGES = "Appliquez la migration 0035 (guide « Ce qui te revient », section 42).";

const nombre = (valeur: unknown) => (Number.isFinite(Number(valeur)) ? Number(valeur) : 0);

export function versConversation(c: Ligne): ConversationResume {
  const avec = un(c.avec) ?? {};
  const formation = un(c.formation);
  const dernier = un(c.dernier);
  return {
    id: texte(c.id),
    avec: { nom: texte(avec.nom), photoUrl: photoPublicUrl(texte(avec.photo) || null), role: texte(avec.role), equipe: avec.equipe === true },
    formation: formation && texte(formation.titre) ? { titre: texte(formation.titre), slug: texte(formation.slug) } : null,
    dernier: dernier
      ? {
          texte: texte(dernier.texte),
          fichier: texte(dernier.fichier) || null,
          vocal: versDuree(dernier.vocal),
          deMoi: dernier.de_moi === true,
          creeLe: texte(dernier.cree_le),
        }
      : null,
    nonLu: c.non_lu === true,
  };
}

export function versMessage(m: Ligne): Message {
  const fichier = un(m.fichier);
  const vocal = un(m.vocal);
  const note = fichier ? versNoteVocale(vocal) : null;
  return {
    id: texte(m.id),
    texte: texte(m.texte),
    fichier: fichier ? { nom: texte(fichier.nom), format: texte(fichier.format), taille: nombre(fichier.taille) } : null,
    vocal: note ? { ...note, chemin: texte(vocal?.chemin), url: null } : null,
    deMoi: m.de_moi === true,
    auteur: texte(m.auteur) || null,
    creeLe: texte(m.cree_le),
  };
}

/** Le fil ; null si la base n'a rien rendu (on ne participe pas à cette conversation). */
export function versFil(data: unknown): Fil | null {
  const brut = un(data);
  const conversation = un(brut?.conversation);
  if (!brut || !conversation) return null;
  return { conversation: versConversation(conversation), messages: liste(brut.messages).map(versMessage), plusAnciens: brut.plus_anciens === true };
}

export const versContact = (c: Ligne): Contact => ({
  id: texte(c.id) || null,
  nom: texte(c.nom),
  photoUrl: photoPublicUrl(texte(c.photo) || null),
  formation: texte(c.formation) || null,
});

/** L'Équipe Étudium, toujours proposée à l'étudiant (l'assistance). */
export const CONTACT_EQUIPE: Contact = { id: null, nom: "Équipe Étudium", photoUrl: null, formation: null };
