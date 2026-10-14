import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste, texte, un } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import { lienDuSite, NOMBRE_PAGE } from "./regles";
import { CATEGORIES_NOTIFICATION, type Annonce, type CategorieNotification, type LotNotifications } from "./types";

// Lectures des notifications du compte connecté et des annonces de l'équipe (migration 0016).

const LOT_VIDE: LotNotifications = { lignes: [], suite: false, nonLues: 0 };

const categorie = (valeur: unknown): CategorieNotification =>
  CATEGORIES_NOTIFICATION.includes(valeur as CategorieNotification) ? (valeur as CategorieNotification) : "service";
const lien = (valeur: unknown) => (typeof valeur === "string" && lienDuSite(valeur) ? valeur : null);
const nombre = (valeur: unknown) => Number(valeur) || 0;

/** Un lot tel que le rend mes_notifications. */
export function versLot(data: unknown): LotNotifications {
  const brut = un(data);
  return {
    lignes: liste(brut?.lignes).map((n) => ({
      id: String(n.id ?? ""),
      categorie: categorie(n.categorie),
      titre: texte(n.titre),
      texte: texte(n.texte),
      lien: lien(n.lien),
      creeLe: texte(n.cree_le),
      lue: n.lue === true,
    })),
    suite: brut?.suite === true,
    nonLues: nombre(brut?.non_lues),
  };
}

type Erreur = { code?: string; message?: string };

/** Rend la lecture, migrationAbsente sans la 0016, et relance toute autre erreur. */
function lecture<T>(quoi: string, error: Erreur | null, convertir: () => T): Lecture<T> {
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture ${quoi} impossible : ${error.message ?? error.code}`);
  }
  return { migrationAbsente: false, donnees: convertir() };
}

/** Les notifications du compte connecté, les plus récentes d'abord ; `avant` : l'identifiant de la dernière déjà lue. */
export async function lireNotifications(options: { nonLues?: boolean; avant?: string | null; nombre?: number }): Promise<Lecture<LotNotifications>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: LOT_VIDE };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mes_notifications", {
    p_non_lues: options.nonLues === true,
    p_avant: options.avant && /^\d+$/.test(options.avant) ? Number(options.avant) : null,
    p_nombre: options.nombre ?? NOMBRE_PAGE,
  });
  return lecture("des notifications", error, () => versLot(data));
}

/** Les annonces envoyées, pour l'équipe (back-office). */
export async function lireAnnonces(): Promise<Lecture<Annonce[]>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("annonces_equipe");
  return lecture("des annonces", error, () =>
    liste(data).map((a) => ({
      id: texte(a.id),
      titre: texte(a.titre),
      texte: texte(a.texte),
      lien: lien(a.lien),
      auteur: texte(a.auteur),
      creeLe: texte(a.cree_le),
      destinataires: nombre(a.destinataires),
    })),
  );
}
