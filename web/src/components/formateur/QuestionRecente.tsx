import Link from "next/link";
import { initialesDe } from "@/components/catalogue/BlocsFiche";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { moment } from "@/lib/communaute/regles";
import type { ConversationResume } from "@/lib/messages/types";

/**
 * La question à laquelle répondre : la conversation la plus récente (la base les rend dans cet ordre) dont le dernier
 * message vient de l'étudiant. Null si le formateur a répondu partout, ou sans conversation.
 */
export function derniereQuestion(conversations: ConversationResume[]): ConversationResume | null {
  return conversations.find((c) => c.dernier !== null && !c.dernier.deMoi) ?? null;
}

/** L'extrait du message, sur une ligne : « Pièce jointe » quand l'étudiant n'a envoyé qu'un fichier. */
function extrait(dernier: NonNullable<ConversationResume["dernier"]>) {
  return dernier.texte.replace(/\s+/g, " ").trim() || (dernier.fichier ? "Pièce jointe" : "");
}

/**
 * Le contenu de la carte « Question récente » du tableau de bord du formateur : l'étudiant, l'extrait de son message, le
 * moment, « Non lu », et Répondre vers la conversation de sa messagerie. Sans question (ou si la lecture a échoué),
 * une phrase discrète.
 */
export function QuestionRecente({ conversation }: { conversation: ConversationResume | null }) {
  if (!conversation?.dernier) {
    return <p className="m-0 text-sm leading-[22px] text-discret max-sm:text-[13px] max-sm:leading-5">Aucune question pour le moment. Les messages de vos étudiants s’afficheront ici.</p>;
  }
  const { avec, dernier, nonLu } = conversation;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-3 max-sm:gap-2.5">
        <Avatar initials={initialesDe(avec.nom)} size={36} src={avec.photoUrl} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm leading-[22px] font-medium break-words text-encre max-sm:text-[13px] max-sm:leading-5">{avec.nom}</span>
          <span className="text-[13px] leading-5 text-discret max-sm:text-xs max-sm:leading-[18px]">{moment(dernier.creeLe, new Date())}</span>
        </span>
        {nonLu && (
          <Tag tone="nouveau" className="flex-none">
            Non lu
          </Tag>
        )}
      </div>
      <p className="m-0 line-clamp-2 text-sm leading-[22px] break-words text-texte max-sm:text-[13px] max-sm:leading-5">{extrait(dernier)}</p>
      <Link
        href={`/formateur/messages?c=${conversation.id}`}
        aria-label={`Répondre à ${avec.nom}`}
        className="focus-etudium self-start text-sm leading-[22px] font-medium text-bleu no-underline hover:underline max-sm:text-[13px] max-sm:leading-5"
      >
        Répondre
      </Link>
    </div>
  );
}
