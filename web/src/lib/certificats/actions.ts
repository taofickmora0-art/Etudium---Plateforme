"use server";

import { createClient } from "@/lib/supabase/server";
import { normaliserIdentifiant } from "./adresse";

/** La fenêtre « Félicitations » a été montrée : elle ne revient plus. Une erreur n'empêche rien. */
export async function marquerCertificatVu(identifiant: string): Promise<void> {
  const propre = normaliserIdentifiant(identifiant);
  if (!propre) return;
  try {
    const supabase = await createClient();
    await supabase.rpc("marquer_certificat_vu", { p_identifiant: propre });
  } catch {
    // Base injoignable : la fenêtre reviendra à la prochaine visite.
  }
}
