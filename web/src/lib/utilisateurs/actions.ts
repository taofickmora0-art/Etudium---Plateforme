"use server";

import { refresh } from "next/cache";
import { ACCES_EQUIPE, exigerDomaine } from "@/lib/admin/garde";
import type { Role } from "@/lib/auth/permissions";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { viderFileApres } from "@/lib/envois/declencher";
import { versPage } from "./data";
import { INDISPONIBLE } from "@/lib/indisponible";
import { estFiltre, estRole, MOTIF_MAX, refusRoles, rolesOrdonnes } from "./regles";
import type { FiltreComptes, PageComptes, Resultat } from "./types";

// Actions de la page Utilisateurs (spec des utilisateurs, §2 à §4). Chacune commence par vérifier l'équipe ; la base
// revérifie tout (migration 0013) et ses messages (code P0001) sont faits pour être affichés tels quels.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const MIGRATION_0061 = "Appliquez la migration 0061 (guide « Ce qui te revient », section 61).";

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
  const garde = await exigerDomaine("utilisateurs");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const { data, error } = await garde.supabase.rpc("comptes_equipe", {
    p_recherche: (recherche ?? "").trim().slice(0, 200),
    p_filtre: estFiltre(filtre) ? filtre : "tous",
    p_page: Math.max(1, Math.trunc(Number(page)) || 1),
  });
  if (error) return { ok: false, message: "La liste n’a pas pu être chargée. Réessayez." };
  return { ok: true, page: versPage(data) };
}

/**
 * Les rôles d'un compte (super admin seul ; migration 0079) : étudiant, formateur, ou les deux, et au plus un rôle de
 * l'équipe. Le rôle Formateur crée sa fiche formateur, ou lui rend la sienne : la base s'en charge.
 */
export async function changerRoles(compteId: string, roles: Role[]): Promise<Resultat> {
  const garde = await exigerDomaine("roles");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(compteId) || !Array.isArray(roles) || !roles.every(estRole)) return { ok: false, message: ECHEC };
  const choisis = rolesOrdonnes(roles);
  const refus = refusRoles(choisis);
  if (refus) return { ok: false, message: refus };
  const { error } = await garde.supabase.rpc("changer_roles", { p_compte: compteId, p_roles: choisis });
  if (error) {
    return { ok: false, message: estFonctionAbsente(error) ? INDISPONIBLE : message(error) };
  }
  refresh();
  return { ok: true };
}

/** Suspend un compte, avec un motif facultatif (500 caractères au plus, visible de l'équipe seulement). */
export async function suspendreCompte(compteId: string, motif: string): Promise<Resultat> {
  const garde = await exigerDomaine("utilisateurs");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(compteId)) return { ok: false, message: ECHEC };
  const { error } = await garde.supabase.rpc("suspendre_compte", { p_compte: compteId, p_motif: (motif ?? "").trim().slice(0, MOTIF_MAX) });
  if (error) return { ok: false, message: message(error) };
  refresh();
  viderFileApres();
  return { ok: true };
}

/** Réactive un compte suspendu : il retrouve tout, immédiatement. */
export async function reactiverCompte(compteId: string): Promise<Resultat> {
  const garde = await exigerDomaine("utilisateurs");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(compteId)) return { ok: false, message: ECHEC };
  const { error } = await garde.supabase.rpc("reactiver_compte", { p_compte: compteId });
  if (error) return { ok: false, message: message(error) };
  refresh();
  viderFileApres();
  return { ok: true };
}

/** Corrige le prénom et le nom d'un compte (lot 6 A) ; la base revérifie les droits et les longueurs. */
export async function renommerCompte(compteId: string, prenom: string, nom: string): Promise<Resultat> {
  const garde = await exigerDomaine("utilisateurs");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(compteId)) return { ok: false, message: ECHEC };
  const { error } = await garde.supabase.rpc("renommer_compte", { p_compte: compteId, p_prenom: prenom ?? "", p_nom: nom ?? "" });
  if (error) return { ok: false, message: estFonctionAbsente(error) ? MIGRATION_0061 : message(error) };
  refresh();
  return { ok: true };
}

/**
 * Supprime un compte (le super admin, lot 6 A). Ses photos, ses travaux rendus et les pièces jointes de ses
 * conversations d'abord : la base les ouvre au super admin le temps de la suppression (0061). Si l'un d'eux ne part
 * pas, on s'arrête : il resterait en ligne sans propriétaire. Puis le compte.
 */
export async function supprimerCompte(compteId: string, motif: string): Promise<Resultat> {
  const garde = await exigerDomaine("roles");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  if (!UUID.test(compteId)) return { ok: false, message: ECHEC };
  const { supabase } = garde;
  const lecture = await supabase.rpc("fichiers_du_compte", { p_compte: compteId });
  if (lecture.error) return { ok: false, message: estFonctionAbsente(lecture.error) ? MIGRATION_0061 : message(lecture.error) };
  const fichiers = (lecture.data ?? {}) as { photos?: string[]; rendus?: string[]; messages?: string[] };
  const espaces = [["photos-profil", fichiers.photos ?? []], ["rendus", fichiers.rendus ?? []], ["messages", fichiers.messages ?? []]] as const;
  for (const [espace, chemins] of espaces) {
    if (chemins.length === 0) continue;
    const effacement = await supabase.storage.from(espace).remove([...chemins]);
    // L'API ne dit pas d'erreur pour un fichier qu'elle n'a pas pu effacer : on compte ce qu'elle a vraiment retiré.
    if (effacement.error || (effacement.data ?? []).length !== chemins.length) {
      return { ok: false, message: "Les fichiers du compte n’ont pas pu être effacés. Réessayez." };
    }
  }
  const { error } = await supabase.rpc("supprimer_compte", { p_compte: compteId, p_motif: (motif ?? "").trim().slice(0, MOTIF_MAX) });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}
