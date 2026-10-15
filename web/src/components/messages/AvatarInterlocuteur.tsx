import { initialesDe } from "@/components/catalogue/BlocsFiche";
import { Avatar } from "@/components/ui/Avatar";
import type { Interlocuteur } from "@/lib/messages/types";

/**
 * L'avatar de la personne en face (NdMessages, 44 px) : « É » gris-bleu pour l'Équipe Étudium, violet pour un
 * formateur, bleu pour un étudiant ; sa photo s'il en a une.
 */
export function AvatarInterlocuteur({ avec }: { avec: Interlocuteur }) {
  if (avec.equipe) return <Avatar initials="É" size={44} tone="neutre" />;
  const formateur = avec.role.startsWith("Formateur");
  return <Avatar initials={initialesDe(avec.nom)} size={44} tone={formateur ? "violet" : "bleu"} src={avec.photoUrl} />;
}
