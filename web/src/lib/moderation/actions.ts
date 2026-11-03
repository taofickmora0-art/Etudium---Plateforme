"use server";

import { refresh } from "next/cache";
import { exigerEquipe } from "@/lib/admin/garde";
import { estFonctionAbsente, liste } from "@/lib/contenus/lecture";
import { avecLiens, versElement } from "./data";
import type { CibleModeration, ElementFile, OngletFile } from "./types";

// Actions de l'équipe sur la file de modération (spec de la modération, §5). La base revérifie que le compte est de
// l'équipe (migration 0020) ; ses messages (P0001) sont faits pour être affichés tels quels.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIGRATION = "Appliquez la migration 0020 (guide « Ce qui te revient », section 25).";
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
type Erreur = { code?: string; message?: string };
type Refus = { ok: false; message: string };
type Resultat = { ok: true } | Refus;

function message(error: Erreur): string {
  if (estFonctionAbsente(error)) return MIGRATION;
  if ((error.code === "P0001" || error.code === "42501") && error.message) return error.message.replace(/'/g, "’");
  return ECHEC;
}

/** Les paramètres d'une cible ; null si l'identifiant est mal formé (un commentaire de leçon a ses propres fonctions). */
function cibler(cible: CibleModeration) {
  if ("commentaireLeconId" in cible) return null;
  const id = "publicationId" in cible ? cible.publicationId : cible.reponseId;
  if (!UUID.test(id)) return null;
  return { p_publication: "publicationId" in cible ? id : null, p_commentaire: "reponseId" in cible ? id : null };
}

type Equipe = Exclude<Awaited<ReturnType<typeof exigerEquipe>>, { erreur: string }>;

/** Garder ou retirer un commentaire de leçon (0028) : ses propres fonctions. */
async function actionCommentaireLecon(
  supabase: Equipe["supabase"],
  fonction: "garder_commentaire_lecon" | "retirer_commentaire_lecon",
  id: string,
): Promise<Resultat> {
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const { error } = await supabase.rpc(fonction, { p_id: id });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/** Un onglet de la file. */
export async function chargerFile(onglet: OngletFile): Promise<{ ok: true; elements: ElementFile[] } | Refus> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const { data, error } = await garde.supabase.rpc("file_moderation", { p_onglet: onglet === "bloquees" ? "bloquees" : "a_examiner" });
  if (error) return { ok: false, message: estFonctionAbsente(error) ? MIGRATION : "La file n’a pas pu être chargée. Réessayez." };
  return { ok: true, elements: await avecLiens(garde.supabase, liste(data).map(versElement)) };
}

/** Garder : les signalements sont classés ; une publication en attente est mise en ligne. */
export async function garderContenu(cible: CibleModeration): Promise<Resultat> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if ("commentaireLeconId" in cible) return actionCommentaireLecon(garde.supabase, "garder_commentaire_lecon", cible.commentaireLeconId);
  const parametres = cibler(cible);
  if (!parametres) return { ok: false, message: ECHEC };
  const { error } = await garde.supabase.rpc("garder_contenu", parametres);
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/** Supprimer : le contenu disparaît, son fichier aussi, et son auteur est prévenu. */
export async function supprimerContenu(cible: CibleModeration): Promise<Resultat> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if ("commentaireLeconId" in cible) return actionCommentaireLecon(garde.supabase, "retirer_commentaire_lecon", cible.commentaireLeconId);
  const parametres = cibler(cible);
  if (!parametres) return { ok: false, message: ECHEC };
  // Les images d'un sondage (0026), lues avant la suppression ; rien pour un commentaire, ni avant la 0026.
  const images = parametres.p_publication
    ? await garde.supabase.rpc("images_sondage", { p_publication: parametres.p_publication }).then(
        (r) => (Array.isArray(r.data) ? r.data.filter((c): c is string => typeof c === "string" && c !== "") : []),
        () => [] as string[],
      )
    : [];
  const { data, error } = await garde.supabase.rpc("supprimer_contenu", parametres);
  if (error) return { ok: false, message: message(error) };
  if (typeof data === "string" && data) await garde.supabase.storage.from("communaute").remove([data]);
  if (images.length > 0) await garde.supabase.storage.from("communaute").remove(images).catch(() => undefined);
  refresh();
  return { ok: true };
}

/** Rétablir une publication bloquée par l'analyse : elle est mise en ligne et son auteur est prévenu. */
export async function retablirPublication(id: string): Promise<Resultat> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const { error } = await garde.supabase.rpc("retablir_publication", { p_id: id });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/** Activer (avec le jeton du serveur, jamais transmis au navigateur) ou désactiver l'analyse automatique. */
export async function reglerAnalyse(active: boolean): Promise<Resultat> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const jeton = process.env.MODERATION_JETON?.trim();
  if (active && (!jeton || !process.env.ANTHROPIC_API_KEY?.trim())) {
    return { ok: false, message: "Ajoutez la clé de l’IA et le jeton de modération aux variables d’environnement du site." };
  }
  const { error } = await garde.supabase.rpc("regler_analyse", { p_active: active, p_jeton: active ? jeton : null });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}
