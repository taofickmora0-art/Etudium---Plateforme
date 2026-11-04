import type { NoteVocale } from "@/lib/vocal/regles";

// La messagerie (lot 5, étape A ; spec de la fin du lot 5, Q1 à Q6) : ce que l'appli lit de la base (migration 0035 ;
// les notes vocales, 0076).

/** L'espace d'où l'on regarde : l'étudiant, le formateur, ou l'équipe (l'assistance). */
export type EspaceMessages = "etudiant" | "formateur" | "equipe";

export const ESPACES_MESSAGES: EspaceMessages[] = ["etudiant", "formateur", "equipe"];

/** La personne en face : « Dr Mireille Adjovi · Formateur·rice », « Équipe Étudium · Assistance »… */
export type Interlocuteur = { nom: string; photoUrl: string | null; role: string; equipe: boolean };

/** Une conversation dans la liste de gauche. */
export type ConversationResume = {
  id: string;
  avec: Interlocuteur;
  /** La formation qui relie l'étudiant au formateur (« Voir la formation ») ; null pour l'assistance. */
  formation: { titre: string; slug: string } | null;
  /** Le dernier message : « Vous : Merci ! », le nom de sa pièce jointe, ou la durée de sa note vocale (ms). */
  dernier: { texte: string; fichier: string | null; vocal: number | null; deMoi: boolean; creeLe: string } | null;
  nonLu: boolean;
};

export type PieceJointe = { nom: string; format: string; taille: number };

/** Une note vocale du fil : sa durée, son onde, son chemin (espace « messages ») et son lien d'écoute d'une heure. */
export type VocalMessage = NoteVocale & { chemin: string; url: string | null };

/**
 * Un message du fil : « de mon côté » (bulle à droite) ou non ; `auteur` : le membre de l'équipe qui a répondu. Une note
 * vocale est une pièce jointe audio (`fichier`) avec sa durée et son onde (`vocal`).
 */
export type Message = { id: string; texte: string; fichier: PieceJointe | null; vocal: VocalMessage | null; deMoi: boolean; auteur: string | null; creeLe: string };

/** Le fil d'une conversation : ses 50 derniers messages, du plus ancien au plus récent. */
export type Fil = { conversation: ConversationResume; messages: Message[]; plusAnciens: boolean };

/** Une personne à qui écrire ; `id` null : l'Équipe Étudium. */
export type Contact = { id: string | null; nom: string; photoUrl: string | null; formation: string | null };

/** Les sujets du formulaire « Contacter l'équipe » de la page Aide (NdAide). */
export const SUJETS_ASSISTANCE = ["Paiement et abonnement", "Accès à une formation", "Certificat", "Problème technique", "Autre"] as const;
export type SujetAssistance = (typeof SUJETS_ASSISTANCE)[number];
