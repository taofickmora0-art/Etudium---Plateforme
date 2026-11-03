"use server";

import { getShellUser } from "@/lib/auth/current-user";
import { sansAccents } from "@/lib/catalogue/filtres";
import { estFonctionAbsente, liste, texte, un } from "@/lib/contenus/lecture";
import { viderFileApres } from "@/lib/envois/declencher";
import { INDISPONIBLE } from "@/lib/indisponible";
import { createClient } from "@/lib/supabase/server";
import { CONTACT_EQUIPE, versContact, versConversation, versFil, versMessage } from "./conversion";
import { ESPACES_MESSAGES, SUJETS_ASSISTANCE, type Contact, type ConversationResume, type EspaceMessages, type Fil, type Message } from "./types";

// Écrire et relire (migration 0035) : la base vérifie le droit d'écrire, le fichier et la cadence, et prévient l'autre
// côté. Les relectures de l'écran (toutes les 10 s) rendent null sur une erreur : l'écran garde ce qu'il montre.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";
const ENVOI_ECHEC = "Votre message n’a pas pu être envoyé. Réessayez.";
const OUVERTURE_ECHEC = "La conversation n’a pas pu s’ouvrir. Réessayez.";
const FICHIER_INACCESSIBLE = "Ce fichier n’est pas accessible.";
const LIEN_ECHEC = "Le lien de téléchargement n’a pas pu être créé. Réessayez.";

type Refus = { ok: false; message: string };

const estEspace = (valeur: unknown): valeur is EspaceMessages => ESPACES_MESSAGES.includes(valeur as EspaceMessages);

/** Le refus de la base (P0001, 42501) tel quel, la migration manquante, ou le message d'échec. */
function refus(error: { code?: string; message?: string }, echec: string): Refus {
  if (estFonctionAbsente(error)) return { ok: false, message: INDISPONIBLE };
  if ((error.code === "P0001" || error.code === "42501") && error.message) return { ok: false, message: error.message.replace(/'/g, "’") };
  return { ok: false, message: echec };
}

/** Ouvre (ou retrouve) la conversation avec quelqu'un ; `avec` null : l'assistance (l'Équipe Étudium). */
export async function ouvrirConversation(avec: string | null): Promise<{ ok: true; id: string } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (avec !== null && !UUID.test(avec)) return { ok: false, message: OUVERTURE_ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ouvrir_conversation", { p_avec: avec });
  if (error) return refus(error, OUVERTURE_ECHEC);
  const id = texte(data);
  return UUID.test(id) ? { ok: true, id } : { ok: false, message: OUVERTURE_ECHEC };
}

/** Envoie un message : un texte, une pièce jointe déjà déposée dans le dossier du compte (espace « messages »), ou les deux. */
export async function envoyerMessage(conversationId: string, texteMessage: string, fichier: { chemin: string; nom: string } | null): Promise<{ ok: true; message: Message } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(conversationId) || typeof texteMessage !== "string") return { ok: false, message: ENVOI_ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("envoyer_message", {
    p_conversation: conversationId,
    p_texte: texteMessage,
    p_fichier: fichier ? fichier.chemin : null,
    p_nom: fichier ? fichier.nom : null,
  });
  if (error) return refus(error, ENVOI_ECHEC);
  const brut = un(data);
  if (!brut) return { ok: false, message: ENVOI_ECHEC };
  viderFileApres();
  return { ok: true, message: versMessage(brut) };
}

/** « Contacter l'équipe » (page Aide) : ouvre l'assistance et écrit « Sujet : … » puis le message. */
export async function contacterEquipe(sujet: string, texteMessage: string): Promise<{ ok: true } | Refus> {
  if (!(SUJETS_ASSISTANCE as readonly string[]).includes(sujet)) return { ok: false, message: "Choisissez un sujet." };
  const corps = typeof texteMessage === "string" ? texteMessage.trim() : "";
  if (!corps) return { ok: false, message: "Écrivez votre message." };
  const ouverture = await ouvrirConversation(null);
  if (!ouverture.ok) return ouverture;
  const envoi = await envoyerMessage(ouverture.id, `Sujet : ${sujet}\n${corps}`, null);
  return envoi.ok ? { ok: true } : envoi;
}

/** Relit le fil ouvert (toutes les 10 s), ou ses messages d'avant `avant` (« Messages précédents ») ; null sur une erreur. */
export async function relireFil(id: string, avant?: string): Promise<Fil | null> {
  if (!UUID.test(id) || !(await getShellUser())) return null;
  const date = typeof avant === "string" && !Number.isNaN(Date.parse(avant)) ? avant : null;
  try {
    const { data, error } = await (await createClient()).rpc("fil_conversation", date ? { p_conversation: id, p_avant: date } : { p_conversation: id });
    return error ? null : versFil(data);
  } catch {
    return null;
  }
}

/** Relit la liste des conversations ; null sur une erreur. */
export async function relireConversations(espace: EspaceMessages): Promise<ConversationResume[] | null> {
  if (!estEspace(espace) || !(await getShellUser())) return null;
  try {
    const { data, error } = await (await createClient()).rpc("mes_conversations", { p_espace: espace });
    return error ? null : liste(data).map(versConversation);
  } catch {
    return null;
  }
}

/**
 * « Nouveau message » : cherche à qui écrire par le nom (le formateur, un de ses étudiants ; l'étudiant, un de ses
 * formateurs). Pour l'étudiant, l'Équipe Étudium s'ajoute si elle correspond au terme (« équipe », « etudium »). Vide sur
 * une erreur.
 */
export async function chercherContacts(espace: EspaceMessages, recherche: string): Promise<Contact[]> {
  if (!estEspace(espace) || !(await getShellUser())) return [];
  const terme = typeof recherche === "string" ? recherche.slice(0, 80) : "";
  try {
    const { data, error } = await (await createClient()).rpc("contacts_messagerie", { p_espace: espace, p_recherche: terme });
    if (error) return [];
    const contacts = liste(data).map(versContact);
    if (espace !== "etudiant") return contacts;
    return sansAccents(CONTACT_EQUIPE.nom).includes(sansAccents(terme)) ? [...contacts, CONTACT_EQUIPE] : contacts;
  } catch {
    return [];
  }
}

/** Le nombre de conversations non lues (pastille « Messages ») ; 0 sans compte, sur une erreur ou avant la 0035. */
export async function compterMessagesNonLus(espace: EspaceMessages): Promise<number> {
  if (!estEspace(espace) || !(await getShellUser())) return 0;
  try {
    const { data, error } = await (await createClient()).rpc("messages_non_lus", { p_espace: espace });
    if (error) return 0;
    const n = Number(data);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Le lien de téléchargement d'une pièce jointe (participants seulement), valable 60 s, avec son nom. */
export async function lienFichierMessage(messageId: string): Promise<{ url: string } | { erreur: string }> {
  if (!UUID.test(messageId)) return { erreur: FICHIER_INACCESSIBLE };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fichier_message", { p_message: messageId });
  const fichier = error ? null : un(data);
  const chemin = texte(fichier?.chemin);
  if (!chemin) return { erreur: FICHIER_INACCESSIBLE };
  // Le nom de téléchargement est ajouté ici : passé en option, la bibliothèque l'encoderait deux fois.
  const lien = await supabase.storage.from("messages").createSignedUrl(chemin, 60);
  const url = lien.error ? "" : texte(lien.data?.signedUrl);
  if (!url) return { erreur: LIEN_ECHEC };
  const nom = texte(fichier?.nom).replace(/[/\\]/g, "-") || "fichier";
  return { url: `${url}&download=${encodeURIComponent(nom)}` };
}
