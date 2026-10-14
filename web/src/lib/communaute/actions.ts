"use server";

import { refresh } from "next/cache";
import { SESSION_EXPIREE } from "@/lib/admin/garde";
import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste, un } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { lireLot, UUID, versReponse } from "./data";
import { nomCourt, refusPiece, refusPublication, refusReponse } from "./regles";
import type { Curseur, FiltreFil, LotPublications, PieceEnvoyee, Reponse } from "./types";

// Actions de la communauté (spec, §2 à §4). La base revérifie tout (migration 0019) et ses messages (P0001, 42501)
// sont faits pour être affichés tels quels.

const MIGRATION = "Appliquez la migration 0019 (guide « Ce qui te revient », section 24).";
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
type Erreur = { code?: string; message?: string };
type Refus = { ok: false; message: string };
type Resultat = { ok: true } | Refus;

function message(error: Erreur): string {
  if (estFonctionAbsente(error)) return MIGRATION;
  if (error.code === "P0001" && error.message) return error.message.replace(/'/g, "’");
  if (error.code === "42501" && error.message) return error.message;
  return ECHEC;
}

/** « Voir plus », ou un changement d'onglet. */
export async function chargerFil(espace: FiltreFil, suite: Curseur | null): Promise<{ ok: true; lot: LotPublications } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const resultat = await lireLot(await createClient(), espace, suite);
  if ("error" in resultat) {
    return { ok: false, message: resultat.error && estFonctionAbsente(resultat.error) ? MIGRATION : "Les publications n’ont pas pu être chargées. Réessayez." };
  }
  return { ok: true, lot: resultat.lot };
}

/** « Voir les N réponses » : toutes les réponses d'une publication. */
export async function chargerReponses(publicationId: string): Promise<{ ok: true; reponses: Reponse[] } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(publicationId)) return { ok: false, message: ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publication_communaute", { p_id: publicationId });
  if (error) return { ok: false, message: message(error) };
  const publication = un(data);
  if (!publication) return { ok: false, message: "Cette publication n’existe plus." };
  return { ok: true, reponses: liste(publication.toutes_reponses).map(versReponse) };
}

/**
 * Publier dans un espace (null : le général). Le fichier éventuel est déjà déposé par le navigateur dans le dossier du
 * compte ; si la base refuse la publication, il est retiré.
 */
export async function publierPublication(
  espaceId: string | null,
  titre: string,
  texte: string,
  piece: PieceEnvoyee | null,
): Promise<{ ok: true; id: string } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const refus = refusPublication(titre, texte) ?? (piece ? refusPiece(piece.type, piece.taille) : null);
  if (refus) return { ok: false, message: refus };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publier", {
    p_parcours: espaceId && UUID.test(espaceId) ? espaceId : null,
    p_titre: titre.trim(),
    p_texte: texte.trim(),
    p_piece: piece ? { chemin: piece.chemin, nom: piece.nom, type: piece.type, taille: piece.taille } : null,
  });
  if (error) {
    if (piece) await supabase.storage.from("communaute").remove([piece.chemin]);
    return { ok: false, message: message(error) };
  }
  refresh();
  return { ok: true, id: String(data) };
}

/** Son auteur seulement : le titre et le texte. */
export async function modifierPublication(id: string, titre: string, texte: string): Promise<Resultat> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const refus = refusPublication(titre, texte);
  if (refus) return { ok: false, message: refus };
  const supabase = await createClient();
  const { error } = await supabase.rpc("modifier_publication", { p_id: id, p_titre: titre.trim(), p_texte: texte.trim() });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/**
 * Son auteur ou l'équipe ; la base rend le chemin du fichier joint, retiré ensuite. Depuis la page de la publication,
 * `relire: false` : relue, elle n'existerait plus (page introuvable) avant le retour à la Communauté.
 */
export async function supprimerPublication(id: string, options: { relire?: boolean } = {}): Promise<Resultat> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("supprimer_publication", { p_id: id });
  if (error) return { ok: false, message: message(error) };
  if (typeof data === "string" && data) await supabase.storage.from("communaute").remove([data]);
  if (options.relire !== false) refresh();
  return { ok: true };
}

/** Répondre : la réponse est rendue pour s'afficher aussitôt sous la publication. */
export async function repondre(publicationId: string, texte: string): Promise<{ ok: true; reponse: Reponse } | Refus> {
  const moi = await getShellUser();
  if (!moi) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(publicationId)) return { ok: false, message: ECHEC };
  const refus = refusReponse(texte);
  if (refus) return { ok: false, message: refus };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commenter", { p_publication: publicationId, p_texte: texte.trim() });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return {
    ok: true,
    reponse: {
      id: String(data),
      auteur: { prenom: moi.prenom, nomCourt: nomCourt(moi.prenom, moi.nom) },
      estMoi: true,
      texte: texte.trim(),
      creeLe: new Date().toISOString(),
      peutSupprimer: true,
    },
  };
}

/** Son auteur ou l'équipe. */
export async function supprimerReponse(id: string): Promise<Resultat> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("supprimer_commentaire", { p_id: id });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/** « J’aime » : ajoute ou retire, et rend l'état et le nombre. */
export async function aimer(publicationId: string): Promise<{ ok: true; jAime: boolean; reactions: number } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(publicationId)) return { ok: false, message: ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("basculer_reaction", { p_publication: publicationId });
  if (error) return { ok: false, message: message(error) };
  const etat = un(data);
  return { ok: true, jAime: etat?.j_aime === true, reactions: Number(etat?.reactions) || 0 };
}
