"use server";

import { refresh } from "next/cache";
import { ACCES_EQUIPE, exigerEquipe } from "@/lib/admin/garde";
import type { Role } from "@/lib/auth/permissions";
import { versPage } from "./data";
import { estFiltre, estRole, MOTIF_MAX } from "./regles";
import type { ChoixFiche, FiltreComptes, PageComptes, Resultat } from "./types";

// Actions de la page Utilisateurs (spec des utilisateurs, §2 à §4). Chacune commence par vérifier l'équipe ; la base
// revérifie tout (migration 0013) et ses messages (code P0001) sont faits pour être affichés tels quels.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ECHEC = "L’opération n’a pas abouti. Réessayez.";

function message(error: { code?: string; message?: string }): string {
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return ACCES_EQUIPE;
  return ECHEC;
}

/** Recherche dans les comptes : jamais par l'adresse de la page (donnée personnelle), toujours par cette action. */
export async function chercherComptes(
  recherche: string,
  filtre: FiltreComptes,
  page: number,
): Promise<{ ok: true; page: PageComptes } | { ok: false; message: string }> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const { data, error } = await garde.supabase.rpc("comptes_equipe", {
    p_recherche: (recherche ?? "").trim().slice(0, 200),
    p_filtre: estFiltre(filtre) ? filtre : "tous",
    p_page: Math.max(1, Math.trunc(Number(page)) || 1),
  });
  if (error) return { ok: false, message: "La liste n’a pas pu être chargée. Réessayez." };
  return { ok: true, page: versPage(data) };
}

/** Donne et retire des rôles, avec la fiche formateur choisie pour le rôle Formateur (super admin seul). */
export async function changerRoles(compteId: string, roles: Role[], fiche: ChoixFiche): Promise<Resultat> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const existante = fiche && "existante" in fiche ? fiche.existante : null;
  if (!UUID.test(compteId) || !Array.isArray(roles) || !roles.every(estRole) || (existante !== null && !UUID.test(existante))) {
    return { ok: false, message: ECHEC };
  }
  const { error } = await garde.supabase.rpc("changer_roles", {
    p_compte: compteId,
    p_roles: roles,
    p_fiche: existante,
    p_nouvelle_fiche: fiche !== null && "nouvelle" in fiche,
  });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/** Suspend un compte, avec un motif facultatif (500 caractères au plus, visible de l'équipe seulement). */
export async function suspendreCompte(compteId: string, motif: string): Promise<Resultat> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(compteId)) return { ok: false, message: ECHEC };
  const { error } = await garde.supabase.rpc("suspendre_compte", { p_compte: compteId, p_motif: (motif ?? "").trim().slice(0, MOTIF_MAX) });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/** Réactive un compte suspendu : il retrouve tout, immédiatement. */
export async function reactiverCompte(compteId: string): Promise<Resultat> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(compteId)) return { ok: false, message: ECHEC };
  const { error } = await garde.supabase.rpc("reactiver_compte", { p_compte: compteId });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}
