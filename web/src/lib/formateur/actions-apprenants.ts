"use server";

import { exigerEditeur } from "@/lib/admin/garde";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { messageAbsente } from "@/lib/indisponible";
import { MIGRATION_APPRENANTS, versApprenants, type PageApprenants } from "./apprenants";
import { estFiltreSuivi } from "./regles-suivi";
import type { FiltreSuivi } from "./suivi";

// Filtres, recherche et pages de l'onglet « Apprenants » (migration 0029). La base revérifie que le compte est de
// l'équipe ou formateur de cette formation.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ECHEC = "La liste n’a pas pu être chargée. Réessayez.";

/** Jamais par l'adresse de la page : un nom est une donnée personnelle. */
export async function chercherApprenants(
  formationId: string,
  recherche: string,
  filtre: FiltreSuivi,
  page: number,
): Promise<{ ok: true; page: PageApprenants } | { ok: false; message: string }> {
  const garde = await exigerEditeur();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(formationId)) return { ok: false, message: ECHEC };
  const { data, error } = await garde.supabase.rpc("apprenants_formation", {
    p_formation: formationId,
    p_recherche: (recherche ?? "").trim().slice(0, 200),
    p_etat: estFiltreSuivi(filtre) ? filtre : "tous",
    p_page: Math.max(1, Math.trunc(Number(page)) || 1),
  });
  if (error) {
    if (estFonctionAbsente(error)) return { ok: false, message: messageAbsente(garde.equipe, MIGRATION_APPRENANTS) };
    if (error.code === "42501" && error.message) return { ok: false, message: error.message.replace(/'/g, "’") };
    return { ok: false, message: ECHEC };
  }
  return { ok: true, page: versApprenants(data) };
}
