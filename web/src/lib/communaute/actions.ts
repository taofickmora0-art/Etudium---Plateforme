"use server";

import { refresh } from "next/cache";
import { SESSION_EXPIREE } from "@/lib/admin/garde";
import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste, un } from "@/lib/contenus/lecture";
import { formatDe } from "@/lib/admin/fichiers";
import { analyserPublication, configurationModeration } from "@/lib/moderation/analyse";
import { messageBloquee, refusSignalement } from "@/lib/moderation/regles";
import { MOTIFS, type ContenuAnalyse, type MotifSignalement, type Verdict } from "@/lib/moderation/types";
import { createClient } from "@/lib/supabase/server";
import { apercuDuTexte } from "./apercu";
import { lireLot, UUID, versReponse } from "./data";
import { nomCourt, refusPiece, refusPublication, refusReponse } from "./regles";
import type { Apercu, FiltreFil, LotPublications, PieceEnvoyee, Reponse, SuiteFil, TriFil } from "./types";

// Actions de la communauté (spec, §2 à §4). La base revérifie tout (migration 0019) et ses messages (P0001, 42501)
// sont faits pour être affichés tels quels.

const MIGRATION = "Appliquez la migration 0019 (guide « Ce qui te revient », section 24).";
const MIGRATION_ACTUALITES = "Appliquez la migration 0021 (guide « Ce qui te revient », section 26).";
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
type Erreur = { code?: string; message?: string };
type Refus = { ok: false; message: string };
type Resultat = { ok: true } | Refus;
type Client = Awaited<ReturnType<typeof createClient>>;
/** En ligne, ou en attente de l'équipe (analyse active sans verdict valide). */
type StatutPublie = "publiee" | "en_attente";
const FAUX_FICHIER = "Ce fichier n’est pas une image ou un PDF valide.";
const texteOuNull = (valeur: unknown) => (typeof valeur === "string" && valeur ? valeur : null);

function message(error: Erreur): string {
  if (estFonctionAbsente(error)) return MIGRATION;
  if (error.code === "P0001" && error.message) return error.message.replace(/'/g, "’");
  if (error.code === "42501" && error.message) return error.message;
  return ECHEC;
}

/** « Voir plus », un changement d'espace ou de tri. */
export async function chargerFil(espace: FiltreFil, tri: TriFil = "recentes", suite: SuiteFil = {}): Promise<{ ok: true; lot: LotPublications } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const resultat = await lireLot(await createClient(), espace, tri, suite);
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
 * La modération (migration 0020) : `null` avant la 0020 (on publie comme avant) ; sinon l'analyse est-elle active, et la
 * configuration du serveur (clé de l'IA, jeton) si elle l'est.
 */
async function moderation(supabase: Client) {
  const { data, error } = await supabase.rpc("moderation_active");
  if (error && estFonctionAbsente(error)) return null;
  return { active: data === true, config: data === true ? configurationModeration() : null };
}

const analyseImpossible = (cause: string): Verdict => ({ decision: "echec", categorie: "aucune", raison: `Analyse impossible : ${cause}.` });

/** Le fichier relu avec la session de l'auteur ; ses premiers octets doivent être ceux de son type. */
async function relireFichier(supabase: Client, piece: PieceEnvoyee): Promise<ContenuAnalyse["fichier"] | "illisible" | "faux"> {
  const { data, error } = await supabase.storage.from("communaute").download(piece.chemin);
  if (error || !data) return "illisible";
  const octets = new Uint8Array(await data.arrayBuffer());
  return formatDe(piece.nom, octets.slice(0, 16)) === piece.type ? { type: piece.type, octets } : "faux";
}

/** Le nom de l'espace pour l'IA : « général », ou le nom court du parcours. */
async function nomDeLEspace(supabase: Client, espaceId: string | null) {
  if (!espaceId) return "général";
  const { data } = await supabase.rpc("espaces_communaute");
  return String(liste(data).find((e) => e.id === espaceId)?.nom_court ?? "général");
}

/** L'aperçu de la première adresse du texte (0021), lu pendant l'analyse ; un échec : pas d'aperçu. */
const lireApercuDuTexte = (texte: string): Promise<Apercu | null> => apercuDuTexte(texte).catch(() => null);

/**
 * Publier ou modifier avec l'aperçu, transmis seulement s'il y en a un ; avant la 0021 (fonction sans p_apercu),
 * le même appel sans lui.
 */
async function avecApercu(supabase: Client, fonction: string, parametres: Record<string, unknown>, apercu: Apercu | null) {
  if (!apercu) return supabase.rpc(fonction, parametres);
  const reponse = await supabase.rpc(fonction, { ...parametres, p_apercu: apercu });
  return reponse.error && estFonctionAbsente(reponse.error) ? supabase.rpc(fonction, parametres) : reponse;
}

/** Le résultat de publier ou modifier : l'id (absent pour modifier), le statut, la catégorie d'un blocage. */
function lireResultat(data: unknown): { id: string; statut: string; categorie: string | null } {
  // Avant la 0020, publier rend l'id seul.
  if (typeof data === "string") return { id: data, statut: "publiee", categorie: null };
  const r = un(data);
  return { id: String(r?.id ?? ""), statut: String(r?.statut ?? "publiee"), categorie: typeof r?.categorie === "string" ? r.categorie : null };
}

/**
 * Publier dans un espace (null : le général). Le fichier éventuel est déjà déposé par le navigateur dans le dossier du
 * compte ; si la base refuse la publication, il est retiré. Analyse active, l'IA juge le titre, le texte et le fichier
 * relu, et la base n'applique son verdict que s'il porte le jeton : bloquée, la publication est refusée (gardée pour
 * l'équipe) ; sans verdict, elle attend l'équipe.
 */
export async function publierPublication(
  espaceId: string | null,
  titre: string,
  texte: string,
  piece: PieceEnvoyee | null,
): Promise<{ ok: true; id: string; statut: StatutPublie } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const refus = refusPublication(titre, texte) ?? (piece ? refusPiece(piece.type, piece.taille) : null);
  if (refus) return { ok: false, message: refus };
  const supabase = await createClient();
  const parcours = espaceId && UUID.test(espaceId) ? espaceId : null;
  const apercu = lireApercuDuTexte(texte.trim());
  const reglage = await moderation(supabase);
  const pieceEnvoyee = piece ? { chemin: piece.chemin, nom: piece.nom, type: piece.type, taille: piece.taille } : null;
  let analyse: Record<string, unknown> | null = null;
  if (reglage?.config) {
    // Avant l'IA : tout ce que la base refuserait, la limite des analyses, et l'identifiant du fichier analysé.
    const preparation = await supabase.rpc("preparer_analyse", {
      p_publication: null,
      p_parcours: parcours,
      p_titre: titre.trim(),
      p_texte: texte.trim(),
      p_piece: pieceEnvoyee,
    });
    if (preparation.error) {
      if (piece) await supabase.storage.from("communaute").remove([piece.chemin]);
      return { ok: false, message: message(preparation.error) };
    }
    const objet = texteOuNull(un(preparation.data)?.objet);
    let fichier: ContenuAnalyse["fichier"] = null;
    let verdict: Verdict | null = null;
    if (piece) {
      const relu = await relireFichier(supabase, piece);
      if (relu === "faux") {
        await supabase.storage.from("communaute").remove([piece.chemin]);
        return { ok: false, message: FAUX_FICHIER };
      }
      if (relu === "illisible") verdict = analyseImpossible("fichier illisible");
      else fichier = relu;
    }
    verdict ??= await analyserPublication({ titre: titre.trim(), texte: texte.trim(), espace: await nomDeLEspace(supabase, parcours), fichier }, reglage.config);
    // Sans verdict (clé refusée, refus de l'IA), la base met la publication en attente de l'équipe.
    analyse = verdict ? { jeton: reglage.config.jeton, ...verdict, objet } : null;
  }
  const { data, error } = await avecApercu(
    supabase,
    "publier",
    { p_parcours: parcours, p_titre: titre.trim(), p_texte: texte.trim(), p_piece: pieceEnvoyee, ...(reglage ? { p_analyse: analyse } : {}) },
    await apercu,
  );
  if (error) {
    if (piece) await supabase.storage.from("communaute").remove([piece.chemin]);
    return { ok: false, message: message(error) };
  }
  const resultat = lireResultat(data);
  if (resultat.statut === "bloquee") return { ok: false, message: messageBloquee(resultat.categorie) };
  refresh();
  return { ok: true, id: resultat.id, statut: resultat.statut === "en_attente" ? "en_attente" : "publiee" };
}

/** Son auteur seulement : le titre et le texte, réanalysés si l'analyse est active ; bloquée, l'ancienne version reste. */
export async function modifierPublication(id: string, titre: string, texte: string): Promise<{ ok: true; statut: StatutPublie } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const refus = refusPublication(titre, texte);
  if (refus) return { ok: false, message: refus };
  const supabase = await createClient();
  const apercu = lireApercuDuTexte(texte.trim());
  const reglage = await moderation(supabase);
  let analyse: Record<string, unknown> | null = null;
  if (reglage?.config) {
    // Avant l'IA : la publication de l'appelant, non bloquée, et la limite des analyses.
    const preparation = await supabase.rpc("preparer_analyse", { p_publication: id, p_parcours: null, p_titre: titre.trim(), p_texte: texte.trim(), p_piece: null });
    if (preparation.error) return { ok: false, message: message(preparation.error) };
    const { data } = await supabase.rpc("publication_communaute", { p_id: id });
    const espace = String(un(un(data)?.espace)?.nom ?? "général");
    const verdict = await analyserPublication({ titre: titre.trim(), texte: texte.trim(), espace, fichier: null }, reglage.config);
    analyse = verdict ? { jeton: reglage.config.jeton, ...verdict, objet: null } : null;
  }
  const { data, error } = await avecApercu(
    supabase,
    "modifier_publication",
    { p_id: id, p_titre: titre.trim(), p_texte: texte.trim(), ...(reglage ? { p_analyse: analyse } : {}) },
    await apercu,
  );
  if (error) return { ok: false, message: message(error) };
  const resultat = lireResultat(data);
  if (resultat.statut === "bloquee") return { ok: false, message: messageBloquee(resultat.categorie) };
  refresh();
  return { ok: true, statut: resultat.statut === "en_attente" ? "en_attente" : "publiee" };
}

/** Signaler une publication ou une réponse à l'équipe (migration 0020) ; l'auteur ne sait jamais qui l'a signalée. */
export async function signaler(cible: { publicationId: string } | { reponseId: string }, motif: MotifSignalement, precisions: string): Promise<Resultat> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const id = "publicationId" in cible ? cible.publicationId : cible.reponseId;
  if (!UUID.test(id) || !MOTIFS.includes(motif)) return { ok: false, message: ECHEC };
  const refus = refusSignalement(motif, precisions);
  if (refus) return { ok: false, message: refus };
  const supabase = await createClient();
  const { error } = await supabase.rpc("signaler", {
    p_publication: "publicationId" in cible ? id : null,
    p_commentaire: "reponseId" in cible ? id : null,
    p_motif: motif,
    p_precisions: precisions.trim(),
  });
  if (error) return { ok: false, message: estFonctionAbsente(error) ? "Appliquez la migration 0020 (guide « Ce qui te revient », section 25)." : message(error) };
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
      peutSignaler: false,
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

/** Le signet (0021) : ajoute ou retire la publication des « Enregistrées » du compte. */
export async function basculerEnregistrement(publicationId: string): Promise<{ ok: true; enregistree: boolean } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(publicationId)) return { ok: false, message: ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("basculer_enregistrement", { p_publication: publicationId });
  if (error) return { ok: false, message: estFonctionAbsente(error) ? MIGRATION_ACTUALITES : message(error) };
  return { ok: true, enregistree: data === true };
}
