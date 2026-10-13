"use server";

import { refresh } from "next/cache";
import { exigerFormateur } from "@/lib/admin/garde";
import { estFiltreSuivi, REMARQUE_MAX } from "./regles-suivi";
import { versPageSuivi, type FiltreSuivi, type PageSuivi } from "./suivi";

// Actions du suivi des étudiants (spec « Étudiants » et tableau de bord du formateur). La base revérifie tout
// (migration 0015) : un formateur ne voit et n'annote que les étudiants de ses formations.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const typographie = (message: string) => message.replace(/'/g, "’");

/** Recherche, filtres et page du suivi : jamais par l'adresse de la page (un nom est une donnée personnelle). */
export async function chercherSuivi(
  recherche: string,
  formationId: string | null,
  filtre: FiltreSuivi,
  page: number,
): Promise<{ ok: true; page: PageSuivi } | { ok: false; message: string }> {
  const garde = await exigerFormateur();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const { data, error } = await garde.supabase.rpc("etudiants_formateur", {
    p_recherche: (recherche ?? "").trim().slice(0, 200),
    p_formation: formationId && UUID.test(formationId) ? formationId : null,
    p_etat: estFiltreSuivi(filtre) ? filtre : "tous",
    p_page: Math.max(1, Math.trunc(Number(page)) || 1),
  });
  if (error) return { ok: false, message: "La liste n’a pas pu être chargée. Réessayez." };
  return { ok: true, page: versPageSuivi(data) };
}

/** La remarque privée du formateur sur un étudiant (vide : supprimée). */
export async function enregistrerRemarque(etudiantId: string, texte: string): Promise<{ ok: boolean; message?: string }> {
  const garde = await exigerFormateur();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(etudiantId)) return { ok: false, message: ECHEC };
  const { error } = await garde.supabase.rpc("enregistrer_remarque", { p_etudiant: etudiantId, p_texte: (texte ?? "").slice(0, REMARQUE_MAX + 100) });
  if (error) return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : ECHEC };
  refresh();
  return { ok: true };
}
