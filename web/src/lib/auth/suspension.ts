import { estFonctionAbsente } from "@/lib/contenus/lecture";

// Compte suspendu (spec des utilisateurs, §4). La base retire déjà tout droit à un compte suspendu (migration 0013) ;
// l'application, elle, le déconnecte : à la page suivante (getShellUser), à la connexion et au retour de Google.

export const MESSAGE_SUSPENDU = "Ce compte est suspendu. Pour en savoir plus, contactez l’équipe Étudium.";

/** Route qui déconnecte un compte suspendu, puis l'envoie à la connexion (`?erreur=suspendu`). */
export const ADRESSE_SUSPENDU = "/auth/suspendu";

type ClientRpc = { rpc: (nom: "compte_suspendu") => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> };

/**
 * Le compte connecté est-il suspendu ? Non en cas de doute : avant la migration 0013 (fonction absente), ou lors d'un
 * incident (consigné). La base, elle, refuse de toute façon tout accès à un compte suspendu.
 */
export async function estSuspendu(supabase: ClientRpc): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("compte_suspendu");
    if (error) {
      if (!estFonctionAbsente(error)) console.error("Lecture de la suspension impossible :", error.message ?? error.code);
      return false;
    }
    return data === true;
  } catch (erreur) {
    console.error("Lecture de la suspension impossible :", erreur instanceof Error ? erreur.message : erreur);
    return false;
  }
}
