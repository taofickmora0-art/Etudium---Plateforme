"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ConversationResume } from "@/lib/messages/types";
import { heure, libelleJour } from "@/lib/notifications/temps";
import { libelleVocal } from "@/lib/vocal/regles";
import { AvatarInterlocuteur } from "./AvatarInterlocuteur";

/** « 14 h 05 » le jour même ; sinon « Hier » ou la date. */
function moment(iso: string, maintenant: Date) {
  const jour = libelleJour(iso, maintenant);
  return jour === "Aujourd’hui" ? heure(iso) : jour;
}

/** L'aperçu du dernier message : « Vous : Merci ! », le nom de sa pièce jointe, ou « 🎤 Note vocale (0:12) ». */
function apercu(c: ConversationResume) {
  if (!c.dernier) return "";
  const texte =
    c.dernier.texte.replace(/\s+/g, " ").trim() ||
    (c.dernier.vocal !== null ? `🎤 ${libelleVocal(c.dernier.vocal)}` : c.dernier.fichier ? `Pièce jointe : ${c.dernier.fichier}` : "");
  return c.dernier.deMoi ? `Vous : ${texte}` : texte;
}

/** La liste des conversations (volet de gauche) : chaque conversation mène à sa page (`?c=`) ; celle ouverte est surlignée. */
export function ListeConversations({ conversations, choisie, base }: { conversations: ConversationResume[]; choisie: string | null; base: string }) {
  const maintenant = new Date();
  return (
    <nav aria-label="Conversations" className="box-border flex min-w-0 flex-col gap-0.5">
      {conversations.map((c) => {
        const active = c.id === choisie;
        return (
          <Link
            key={c.id}
            href={`${base}?c=${c.id}`}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(
              "focus-etudium box-border flex w-full min-w-0 items-center gap-3 rounded-bouton px-3 py-2.5 text-texte no-underline transition-colors max-sm:gap-2.5 max-sm:px-2.5",
              active ? "bg-bleu-clair" : "hover:bg-page",
            )}
          >
            <AvatarInterlocuteur avec={c.avec} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] leading-[22px] font-semibold text-encre">{c.avec.nom}</span>
                {c.dernier && <span className="flex-none text-xs leading-[18px] text-ardoise">{moment(c.dernier.creeLe, maintenant)}</span>}
              </span>
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] leading-5 text-ardoise">{apercu(c)}</span>
                {c.nonLu && <span role="img" aria-label="Non lu" className="size-2 flex-none rounded-full bg-bleu" />}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
