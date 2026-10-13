import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";

// Lectures de l'espace formateur (spec de l'espace formateur, §3 et §5) : sa fiche formateur, et « cette formation
// est-elle la sienne ». La base le vérifie elle-même à chaque écriture ; ces lectures servent à l'affichage.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La fiche formateur reliée au compte connecté (null : pas encore reliée) ; sans la migration 0014, migrationAbsente. */
export async function lireMaFiche(): Promise<{ migrationAbsente: true } | { migrationAbsente: false; fiche: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ma_fiche_formateur");
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture de la fiche formateur impossible : ${error.message ?? error.code}`);
  }
  return { migrationAbsente: false, fiche: typeof data === "string" ? data : null };
}

/** La formation appartient-elle à la fiche du formateur connecté ? Faux en cas de doute (identifiant, migration absente). */
export async function estMaFormation(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("formateur_de", { p_formation: id });
  return !error && data === true;
}
