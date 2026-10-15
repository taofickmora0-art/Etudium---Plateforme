"use client";

import { useEffect, useState } from "react";
import { BubbleChatIcon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Heading, Lead } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { relireConversations } from "@/lib/messages/actions";
import type { Contact, ConversationResume, EspaceMessages, Fil, Message } from "@/lib/messages/types";
import { FilConversation } from "./FilConversation";
import { ListeConversations } from "./ListeConversations";
import { NouveauMessage } from "./NouveauMessage";

const LISTE_MS = 60_000;

const SOUS_TITRES: Record<EspaceMessages, string> = {
  etudiant: "Une question sur une leçon ? Écrivez directement à votre formateur.",
  formateur: "Les messages de vos étudiants.",
  equipe: "Les demandes d’assistance des étudiants.",
};

const VIDES: Record<EspaceMessages, string> = {
  etudiant: "Écrivez au formateur d’une formation que vous suivez, ou à l’équipe Étudium.",
  formateur: "Les messages de vos étudiants s’afficheront ici. Vous pouvez aussi leur écrire.",
  equipe: "Les demandes d’assistance des étudiants s’afficheront ici.",
};

/**
 * La page Messages (NdMessages), la même pour l'étudiant, le formateur et l'équipe : à gauche les conversations, à
 * droite celle choisie (`?c=`). Au téléphone, l'une ou l'autre : la conversation s'ouvre en plein écran avec un retour.
 */
export function Messagerie({
  espace,
  base,
  conversations: initiales,
  fil,
  choisie,
  contacts,
}: {
  espace: EspaceMessages;
  base: string;
  conversations: ConversationResume[];
  fil: Fil | null;
  choisie: string | null;
  contacts: Contact[];
}) {
  const [conversations, setConversations] = useState(initiales);
  const [nouveau, setNouveau] = useState(false);
  const ecrire = espace !== "equipe";

  // La liste se relit chaque minute (onglet visible) ; une relecture qui échoue ne change rien.
  useEffect(() => {
    const minuterie = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void relireConversations(espace).then((liste) => {
        if (liste) setConversations(liste);
      });
    }, LISTE_MS);
    return () => clearInterval(minuterie);
  }, [espace]);

  /** Un message envoyé : sa conversation remonte en tête, avec son aperçu. */
  function envoye(message: Message) {
    if (!fil) return;
    const resume: ConversationResume = {
      ...fil.conversation,
      dernier: { texte: message.texte, fichier: message.fichier?.nom ?? null, deMoi: true, creeLe: message.creeLe },
      nonLu: false,
    };
    setConversations((avant) => [resume, ...avant.filter((c) => c.id !== resume.id)]);
  }

  const vide = conversations.length === 0 && !choisie;
  return (
    <div className="flex min-w-0 flex-col">
      <div className={cn("flex flex-wrap items-end justify-between gap-4", choisie && "max-sm:hidden")}>
        <div className="min-w-0 flex-[1_1_320px]">
          <Heading level="page">Messages</Heading>
          <Lead className="mt-2.5">{SOUS_TITRES[espace]}</Lead>
        </div>
        {ecrire && !vide && (
          <Button variant="gris" iconLeft={PencilEdit02Icon} onClick={() => setNouveau(true)}>
            Nouveau message
          </Button>
        )}
      </div>
      <div className={cn("mt-5 h-px bg-separateur", choisie && "max-sm:hidden")} />
      {vide ? (
        <EmptyState
          className="mt-8"
          icon={BubbleChatIcon}
          title="Aucune conversation"
          description={VIDES[espace]}
          action={
            ecrire ? (
              <Button iconLeft={PencilEdit02Icon} onClick={() => setNouveau(true)}>
                Nouveau message
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-8 flex flex-wrap items-start gap-6 max-sm:mt-5">
          {conversations.length > 0 && (
            <div className={cn("min-w-0 flex-[1_1_300px]", choisie && "max-sm:hidden")}>
              <ListeConversations conversations={conversations} choisie={choisie} base={base} />
            </div>
          )}
          <div className={cn("min-w-0 flex-[999_1_420px]", !choisie && "max-sm:hidden")}>
            {fil ? (
              <FilConversation key={fil.conversation.id} espace={espace} base={base} filInitial={fil} onEnvoye={envoye} />
            ) : choisie ? (
              <EmptyState icon={BubbleChatIcon} title="Conversation introuvable" description="Elle n’existe pas, ou vous n’y participez pas." />
            ) : (
              <EmptyState
                icon={BubbleChatIcon}
                title="Choisissez une conversation"
                description={ecrire ? "Ou écrivez un nouveau message." : "Les demandes non lues sont marquées d’un point bleu."}
              />
            )}
          </div>
        </div>
      )}
      {ecrire && <NouveauMessage espace={espace} base={base} contactsInitiaux={contacts} open={nouveau} onOpenChange={setNouveau} />}
    </div>
  );
}
