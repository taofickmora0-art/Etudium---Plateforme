"use server";

import { refresh } from "next/cache";
import { exigerEditeur, SESSION_EXPIREE } from "@/lib/admin/garde";
import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { versCarte } from "./data";
import { debutDepuis, refusSession } from "./regles";
import type { DonneesSession, SessionCarte, VueSessions } from "./types";

// Actions des sessions live (spec, §1 et §4). La base revérifie tout (migration 0018) et ses messages (P0001) sont
// faits pour être affichés tels quels.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIGRATION = "Appliquez la migration 0018 (guide « Ce qui te revient », section 23).";
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const VUES: VueSessions[] = ["a_venir", "inscriptions", "passees"];
type Erreur = { code?: string; message?: string };
type Resultat = { ok: boolean; message?: string };

function message(error: Erreur): string {
  if (estFonctionAbsente(error)) return MIGRATION;
  if (error.code === "P0001" && error.message) return error.message.replace(/'/g, "’");
  if (error.code === "42501" && error.message) return error.message;
  return ECHEC;
}

const uuidOuNull = (valeur: string | null) => (valeur && UUID.test(valeur) ? valeur : null);

/** Un onglet de la page Événements (changer d'onglet, relire à l'ouverture du lien). */
export async function chargerSessions(vue: VueSessions): Promise<{ ok: true; sessions: SessionCarte[] } | { ok: false; message: string }> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sessions_live", { p_vue: VUES.includes(vue) ? vue : "a_venir" });
  if (error) return { ok: false, message: estFonctionAbsente(error) ? MIGRATION : "Les sessions n’ont pas pu être chargées. Réessayez." };
  return { ok: true, sessions: liste(data).map(versCarte) };
}

async function inscription(fonction: "sinscrire_session" | "se_desinscrire_session", id: string): Promise<Resultat> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const supabase = await createClient();
  const { error } = await supabase.rpc(fonction, { p_session: id });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/** S'inscrire à une session : pour les rappels et « Mes inscriptions » (rejoindre n'en a pas besoin). */
export async function sinscrire(id: string): Promise<Resultat> {
  return inscription("sinscrire_session", id);
}

export async function seDesinscrire(id: string): Promise<Resultat> {
  return inscription("se_desinscrire_session", id);
}

function parametres(d: DonneesSession, equipe: boolean) {
  return {
    p_titre: d.titre.trim(),
    p_description: d.description.trim(),
    p_debut: debutDepuis(d.date, d.heure),
    p_duree: d.dureeMinutes,
    p_lien: d.lien.trim(),
    p_parcours: uuidOuNull(d.parcoursId),
    // Un formateur anime toujours ses sessions : la base l'impose, on ne transmet rien.
    p_formateur: equipe ? uuidOuNull(d.formateurId) : null,
  };
}

/** Programmer une session (formateur ou équipe). */
export async function creerSession(d: DonneesSession): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const garde = await exigerEditeur();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const refus = refusSession(d, new Date());
  if (refus) return { ok: false, message: refus };
  const { data, error } = await garde.supabase.rpc("creer_session", parametres(d, garde.equipe));
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true, id: String(data) };
}

/** Modifier une session : la base revérifie le début seulement s'il change. */
export async function modifierSession(id: string, d: DonneesSession): Promise<Resultat> {
  const garde = await exigerEditeur();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const refus = refusSession(d, new Date(), { verifierDebut: false });
  if (refus) return { ok: false, message: refus };
  const { error } = await garde.supabase.rpc("modifier_session", { p_session: id, ...parametres(d, garde.equipe) });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/** Annuler une session : ses inscrits sont prévenus. */
export async function annulerSession(id: string): Promise<Resultat> {
  const garde = await exigerEditeur();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const { error } = await garde.supabase.rpc("annuler_session", { p_session: id });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}
