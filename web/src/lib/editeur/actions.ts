"use server";

import { refresh } from "next/cache";
import { authErrorMessage } from "@/lib/auth/messages";
import { exigerEditeur } from "@/lib/admin/garde";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { MIGRATION_QUIZ } from "@/lib/quiz/conversion";
import type { Lecture, Resultat } from "@/lib/utilisateurs/types";
import { normaliserSaisieInfos, normaliserSaisieLecon } from "./saisie";
import { MIGRATION_EDITEUR, type ModificationEnAttente, type ResultatSauvegarde, type SaisieInfos, type SaisieLecon } from "./types";

// Les actions de l'éditeur (fin du lot 4, spec §2) : l'enregistrement automatique (brouillon ou direct, décidé par la
// base, 0056), les réglages d'une leçon et les questions d'un quiz (aussitôt), la publication et l'abandon des
// modifications. L'enregistrement automatique ne rafraîchit pas la page : l'éditeur reste tel qu'on l'écrit.

const ECHEC = authErrorMessage(null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Les messages de la base sont écrits avec l'apostrophe droite ; l'interface utilise l'apostrophe typographique. */
const typographie = (message: string) => message.replace(/'/g, "’");

type ErreurBase = { code?: string; message?: string } | null;

/** Un refus de la base : un message à montrer (règle, droits), une migration absente, ou un échec à réessayer. */
function refusSauvegarde(erreur: NonNullable<ErreurBase>): ResultatSauvegarde {
  if (estFonctionAbsente(erreur)) return { ok: false, code: "echec", message: MIGRATION_EDITEUR };
  if ((erreur.code === "P0001" || erreur.code === "42501") && erreur.message) return { ok: false, code: "invalide", erreurs: { formulaire: typographie(erreur.message) } };
  return { ok: false, code: "echec", message: ECHEC };
}

function versResultat(data: unknown): ResultatSauvegarde {
  const r = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (r.etat === "conflit") return { ok: false, code: "conflit", par: typeof r.par === "string" ? r.par : null };
  if (r.etat !== "enregistre") return { ok: false, code: "echec", message: ECHEC };
  return { ok: true, revision: Number(r.revision ?? 0), brouillon: r.brouillon === true, enregistreLe: typeof r.enregistre_le === "string" ? r.enregistre_le : new Date().toISOString() };
}

const messageResultat = (erreur: NonNullable<ErreurBase>, absente = MIGRATION_EDITEUR) =>
  estFonctionAbsente(erreur) ? absente : (erreur.code === "P0001" || erreur.code === "42501") && erreur.message ? typographie(erreur.message) : ECHEC;

/** La sauvegarde automatique d'une leçon : `revision`, celle que l'éditeur a vue. */
export async function enregistrerLecon(leconId: string, saisie: SaisieLecon, revision: number): Promise<ResultatSauvegarde> {
  if (!UUID.test(leconId) || !Number.isInteger(revision)) return { ok: false, code: "echec", message: ECHEC };
  const normalise = normaliserSaisieLecon(saisie);
  if (!normalise.ok) return { ok: false, code: "invalide", erreurs: normalise.erreurs };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, code: "invalide", erreurs: { formulaire: garde.erreur } };
    const { data, error } = await garde.supabase.rpc("enregistrer_lecon", { p_lecon: leconId, p_donnees: normalise.donnees, p_revision: revision });
    if (error) return refusSauvegarde(error);
    return versResultat(data);
  } catch {
    return { ok: false, code: "echec", message: ECHEC };
  }
}

/** La sauvegarde automatique des informations générales d'une formation. */
export async function enregistrerInfosFormation(formationId: string, saisie: SaisieInfos, revision: number): Promise<ResultatSauvegarde> {
  if (!UUID.test(formationId) || !Number.isInteger(revision)) return { ok: false, code: "echec", message: ECHEC };
  const normalise = normaliserSaisieInfos(saisie);
  if (!normalise.ok) return { ok: false, code: "invalide", erreurs: normalise.erreurs };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, code: "invalide", erreurs: { formulaire: garde.erreur } };
    const { data, error } = await garde.supabase.rpc("enregistrer_infos_formation", { p_formation: formationId, p_donnees: normalise.donnees, p_revision: revision });
    if (error) return refusSauvegarde(error);
    return versResultat(data);
  } catch {
    return { ok: false, code: "echec", message: ECHEC };
  }
}

/** Les réglages d'une leçon (commentaires, aperçu gratuit, genre d'exercice) : enregistrés aussitôt, sans brouillon. */
export async function reglerLecon(leconId: string, reglages: { commentairesActifs: boolean; apercu: boolean; genreExercice?: "simple" | "rendu" }): Promise<Resultat> {
  if (!UUID.test(leconId)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const champs = {
      commentaires_actifs: reglages.commentairesActifs === true,
      apercu: reglages.apercu === true,
      ...(reglages.genreExercice === "simple" || reglages.genreExercice === "rendu" ? { genre_exercice: reglages.genreExercice } : {}),
    };
    const { error } = await garde.supabase.from("lecons").update(champs).eq("id", leconId);
    if (error) return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : ECHEC };
  } catch {
    return { ok: false, message: ECHEC };
  }
  return { ok: true };
}

/** Les questions d'un quiz : « Enregistrer les questions », effet immédiat (la base les vérifie une à une). */
export async function enregistrerQuestions(leconId: string, questions: unknown): Promise<Resultat> {
  if (!UUID.test(leconId)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { error } = await garde.supabase.rpc("enregistrer_quiz", { p_lecon: leconId, p_questions: questions });
    if (error) return { ok: false, message: messageResultat(error, MIGRATION_QUIZ) };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/** Ce qui attend d'être publié dans une formation (fenêtre « Publier les modifications »). */
export async function lireModificationsEnAttente(formationId: string): Promise<Lecture<ModificationEnAttente[]>> {
  if (!UUID.test(formationId)) return { migrationAbsente: false, donnees: [] };
  const garde = await exigerEditeur();
  if ("erreur" in garde) return { migrationAbsente: false, donnees: [] };
  const { data, error } = await garde.supabase.rpc("modifications_en_attente", { p_formation: formationId });
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture des modifications impossible : ${error.message ?? error.code}`);
  }
  const lignes = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  return {
    migrationAbsente: false,
    donnees: lignes.map((l) => ({
      type: l.type === "formation" ? "formation" : "lecon",
      id: String(l.id ?? ""),
      titre: typeof l.titre === "string" ? l.titre : "",
      rang: typeof l.rang === "number" ? l.rang : null,
      modifiePar: typeof l.modifie_par === "string" ? l.modifie_par : null,
      modifieLe: typeof l.modifie_le === "string" ? l.modifie_le : "",
    })),
  };
}

/** « Publier les modifications » : tous les brouillons de la formation d'un coup ; la version créée (0057). */
export async function publierModifications(formationId: string): Promise<Resultat & { publiees?: number; version?: number | null }> {
  if (!UUID.test(formationId)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { data, error } = await garde.supabase.rpc("publier_modifications", { p_formation: formationId });
    if (error) return { ok: false, message: messageResultat(error) };
    const r = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    refresh();
    return { ok: true, publiees: Number(r.publiees ?? 0), version: typeof r.version === "number" ? r.version : null };
  } catch {
    return { ok: false, message: ECHEC };
  }
}

/** « Abandonner les modifications » : d'une leçon, ou de toute la formation. */
export async function abandonnerModifications(formationId: string, leconId?: string): Promise<Resultat> {
  if (!UUID.test(formationId) || (leconId !== undefined && !UUID.test(leconId))) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { error } = await garde.supabase.rpc("abandonner_modifications", { p_formation: formationId, p_lecon: leconId ?? null });
    if (error) return { ok: false, message: messageResultat(error) };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}
