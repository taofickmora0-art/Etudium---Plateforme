import { estFonctionAbsente, liste } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import { CONTACT_EQUIPE, MIGRATION_MESSAGES, versContact, versConversation, versFil } from "./conversion";
import type { Contact, ConversationResume, EspaceMessages, Fil } from "./types";

// Les lectures de la messagerie (migration 0035). La base vérifie tout : on ne lit que ses conversations (l'équipe :
// l'assistance).

export { MIGRATION_MESSAGES };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const echec = (quoi: string, error: { message?: string; code?: string }) => new Error(`Lecture ${quoi} impossible : ${error.message ?? error.code}`);

/** Les conversations d'un espace, la plus récente d'abord. */
export async function lireConversations(espace: EspaceMessages): Promise<Lecture<ConversationResume[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mes_conversations", { p_espace: espace });
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw echec("des conversations", error);
  }
  return { migrationAbsente: false, donnees: liste(data).map(versConversation) };
}

/** Le fil d'une conversation (l'ouvrir la marque lue) ; null pour une adresse inventée ou sans y participer. */
export async function lireFil(id: string): Promise<Lecture<Fil | null>> {
  if (!UUID.test(id)) return { migrationAbsente: false, donnees: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fil_conversation", { p_conversation: id });
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw echec("de la conversation", error);
  }
  return { migrationAbsente: false, donnees: versFil(data) };
}

/** À qui écrire : l'étudiant, ses formateurs puis l'Équipe Étudium ; le formateur, ses étudiants (20 au plus). */
export async function lireContacts(espace: EspaceMessages, recherche = ""): Promise<Lecture<Contact[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contacts_messagerie", { p_espace: espace, p_recherche: recherche });
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw echec("des contacts", error);
  }
  const contacts = liste(data).map(versContact);
  return { migrationAbsente: false, donnees: espace === "etudiant" ? [...contacts, CONTACT_EQUIPE] : contacts };
}
