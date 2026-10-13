"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Favoris (CDC §24) : chacun les siens, sur une formation publiée (règles de la migration 0009).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Resultat = { ok: true } | { ok: false; erreur: string };

async function compteConnecte() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, compte: error ? null : (data?.user ?? null) };
}

/** Met une formation en favori ; un double clic ne crée qu'un favori. */
export async function ajouterFavori(formationId: string): Promise<Resultat> {
  const echec = "Le favori n’a pas pu être enregistré. Réessayez.";
  const { supabase, compte } = await compteConnecte();
  if (!compte) return { ok: false, erreur: "Connectez-vous pour ajouter un favori." };
  if (!UUID.test(formationId)) return { ok: false, erreur: echec };
  const { error } = await supabase
    .from("favoris")
    .upsert({ profil_id: compte.id, formation_id: formationId }, { onConflict: "profil_id,formation_id", ignoreDuplicates: true });
  if (error) return { ok: false, erreur: echec };
  refresh();
  return { ok: true };
}

/** Retire une formation des favoris (la progression ne change pas). */
export async function retirerFavori(formationId: string): Promise<Resultat> {
  const echec = "Le favori n’a pas pu être retiré. Réessayez.";
  const { supabase, compte } = await compteConnecte();
  if (!compte) return { ok: false, erreur: "Connectez-vous pour gérer vos favoris." };
  if (!UUID.test(formationId)) return { ok: false, erreur: echec };
  const { error } = await supabase.from("favoris").delete().eq("formation_id", formationId).eq("profil_id", compte.id);
  if (error) return { ok: false, erreur: echec };
  refresh();
  return { ok: true };
}
