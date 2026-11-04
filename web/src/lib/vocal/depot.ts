import { identifiantAleatoire } from "@/lib/identifiant";
import { createClient } from "@/lib/supabase/client";
import { extensionVocale, VOCAL_MAX_OCTETS } from "./regles";

// Le dépôt d'une note vocale, depuis le navigateur, dans le dossier du compte (espaces « messages » ou « groupes »,
// migration 0076). Si l'envoi du message échoue ensuite, `retirer` efface le fichier déposé.

export const NOTE_TROP_LOURDE = "La note vocale dépasse 10 Mo.";
export const NOTE_FORMAT = "Ce navigateur enregistre dans un format que la plateforme n’accepte pas.";
const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";
const DEPOT_ECHEC = "La note vocale n’a pas pu être envoyée. Réessayez.";

export type Depot = { ok: true; chemin: string; retirer: () => Promise<void> } | { ok: false; message: string };

/** Dépose la note : « <compte>/<sous-dossier>/<id>.<ext> » (messages) ou « <compte>/<id>.<ext> » (groupes). */
export async function deposerNoteVocale(espace: "messages" | "groupes", sousDossier: string | null, note: { blob: Blob; type: string }): Promise<Depot> {
  const extension = extensionVocale(note.type);
  if (!extension) return { ok: false, message: NOTE_FORMAT };
  if (note.blob.size > VOCAL_MAX_OCTETS) return { ok: false, message: NOTE_TROP_LOURDE };
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const compte = data?.user?.id;
  if (!compte) return { ok: false, message: SESSION_EXPIREE };
  const chemin = [compte, sousDossier, `${identifiantAleatoire()}.${extension}`].filter(Boolean).join("/");
  // Une copie typée : la bibliothèque garde sinon le type du navigateur, avec ses paramètres (« ;codecs=opus »).
  const { error } = await supabase.storage.from(espace).upload(chemin, note.blob.slice(0, note.blob.size, note.type), { contentType: note.type, upsert: false });
  if (error) return { ok: false, message: DEPOT_ECHEC };
  return {
    ok: true,
    chemin,
    retirer: async () => {
      await supabase.storage.from(espace).remove([chemin]).then(
        () => undefined,
        () => undefined,
      );
    },
  };
}
