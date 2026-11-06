import { cache } from "react";
import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { MIGRATION_FORMATEURS, versFormateurPublic } from "./conversion";
import { estEtudium, ID_ETUDIUM, PHOTO_ETUDIUM } from "./etudium";
import type { ApercuFormateur, FormateurPublic } from "./types";

// Lecture du formateur public (migration 0070) : sa fiche, lisible par tous (visiteurs compris), par formateur_public.

export { MIGRATION_FORMATEURS };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La fiche publique d'un formateur ; null si elle n'existe pas (ou en démonstration) ; « absente » sans la migration
 * 0070. Lue une seule fois par requête : la page et ses métadonnées la demandent toutes deux.
 */
export const lireFormateurPublic = cache(async (id: string): Promise<FormateurPublic | null | "absente"> => {
  const etudium = estEtudium(id);
  if (demoModeActive() || (!etudium && !UUID.test(id))) return null;
  const client = await createClient();
  // L'Équipe Étudium (0078) : les formations publiées sans formateur, avec le logo d'Étudium.
  const { data, error } = etudium ? await client.rpc("formateur_etudium") : await client.rpc("formateur_public", { p_formateur: id });
  if (error) {
    if (estFonctionAbsente(error)) return "absente";
    throw new Error(`Lecture de la fiche du formateur impossible (${error.code ?? "?"}).`);
  }
  const formateur = versFormateurPublic(data);
  return etudium && formateur ? { ...formateur, photoUrl: PHOTO_ETUDIUM } : formateur;
});

/**
 * Le formateur d'une formation, pour sa fiche (spec du 2 novembre 2026, §3 et §5) ; sans formateur, l'Équipe Étudium
 * (0078). Null si sa fiche est inconnue, sans la migration (0070, 0078) ou si la lecture échoue : la fiche garde alors le
 * bloc d'avant (nom, titre, présentation), sans survol ni « Message ».
 */
export async function lireFormateurDeFiche(id: string | undefined): Promise<ApercuFormateur | null> {
  let formateur: FormateurPublic | null | "absente";
  try {
    formateur = await lireFormateurPublic(id ?? ID_ETUDIUM);
  } catch (erreur) {
    console.error("Lecture du formateur de la fiche impossible :", erreur);
    return null;
  }
  if (!formateur || formateur === "absente") return null;
  return {
    id: formateur.id,
    nom: formateur.nom,
    titre: formateur.titre,
    domaine: formateur.domaine,
    presentation: formateur.presentation,
    reseaux: formateur.reseaux,
    photoUrl: formateur.photoUrl,
    rejointLe: formateur.rejointLe,
    nbFormations: formateur.nbFormations,
    peutEcrire: formateur.peutEcrire,
  };
}
