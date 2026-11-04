"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { BubbleChatIcon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { useTempsReel } from "@/components/temps-reel/evenements";
import { Button } from "@/components/ui/Button";
import { correspond, DeuxVolets, EnteteVolet, VoletVide } from "@/components/ui/DeuxVolets";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { relireConversations } from "@/lib/messages/actions";
import type { Contact, ConversationResume, EspaceMessages, Fil, Message } from "@/lib/messages/types";
import { FilConversation } from "./FilConversation";
import { ListeConversations } from "./ListeConversations";
import { NouveauMessage } from "./NouveauMessage";

const LISTE_MS = 60_000;

const VIDES: Record<EspaceMessages, string> = {
  etudiant: "Écrivez au formateur d’une formation que vous suivez, ou à l’équipe Étudium.",
  formateur: "Les messages de vos étudiants s’afficheront ici. Vous pouvez aussi leur écrire.",
  equipe: "Les demandes d’assistance des étudiants s’afficheront ici.",
};

/**
 * La page Messages (NdMessages), la même pour l'étudiant, le formateur et l'équipe, en deux volets comme WhatsApp
 * (demande du 4 novembre 2026) : à gauche les conversations (avec une recherche), à droite celle choisie (`?c=`). Au
 * téléphone, l'une ou l'autre : la conversation s'ouvre en plein écran avec un retour.
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
  // Le serveur relit la liste à chaque conversation ouverte : sa version l'emporte (la conversation ouverte est lue).
  const [vues, setVues] = useState(initiales);
  if (initiales !== vues) {
    setVues(initiales);
    setConversations(initiales);
  }
  const [nouveau, setNouveau] = useState(false);
  const [recherche, setRecherche] = useState("");
  const ecrire = espace !== "equipe";

  // La liste se relit aussitôt qu'un message arrive ou qu'une conversation est lue ailleurs (temps réel, 0044), et chaque
  // minute en secours (onglet visible) ; une relecture qui échoue ne change rien.
  const relire = () =>
    void relireConversations(espace).then((liste) => {
      if (liste) setConversations(liste);
    });
  useTempsReel("message", relire);
  const relireEnSecours = useEffectEvent(relire);
  useEffect(() => {
    const minuterie = setInterval(() => {
      if (document.visibilityState === "visible") relireEnSecours();
    }, LISTE_MS);
    return () => clearInterval(minuterie);
  }, [espace]);

  /** Un message envoyé : sa conversation remonte en tête, avec son aperçu. */
  function envoye(message: Message) {
    if (!fil) return;
    const resume: ConversationResume = {
      ...fil.conversation,
      dernier: { texte: message.texte, fichier: message.fichier?.nom ?? null, vocal: message.vocal?.dureeMs ?? null, deMoi: true, creeLe: message.creeLe },
      nonLu: false,
    };
    setConversations((avant) => [resume, ...avant.filter((c) => c.id !== resume.id)]);
  }

  const affichees = recherche.trim() ? conversations.filter((c) => correspond(c.avec.nom, recherche)) : conversations;
  const liste = (
    <>
      <EnteteVolet
        titre="Messages"
        recherche={recherche}
        onRecherche={setRecherche}
        placeholder="Rechercher une conversation"
        action={ecrire ? <IconButton icon={PencilEdit02Icon} label="Nouveau message" title="Nouveau message" variant="discret" onClick={() => setNouveau(true)} /> : undefined}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {conversations.length === 0 ? (
          <EmptyState
            className="mt-4"
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
        ) : affichees.length === 0 ? (
          <p className="m-0 px-3 py-6 text-center text-sm leading-[22px] text-discret">Aucune conversation ne correspond à « {recherche.trim()} ».</p>
        ) : (
          <ListeConversations conversations={affichees} choisie={choisie} base={base} />
        )}
      </div>
    </>
  );
  return (
    <>
      {/* Une adresse inconnue : au téléphone, la liste reste (sur ordinateur, le volet de droite dit pourquoi). */}
      <DeuxVolets liste={liste} ouvert={fil !== null}>
        {fil ? (
          <FilConversation key={fil.conversation.id} espace={espace} base={base} filInitial={fil} onEnvoye={envoye} />
        ) : choisie ? (
          <VoletVide icon={BubbleChatIcon} titre="Conversation introuvable" description="Elle n’existe pas, ou vous n’y participez pas." />
        ) : (
          <VoletVide
            icon={BubbleChatIcon}
            titre="Choisissez une conversation"
            description={ecrire ? "Ouvrez une conversation à gauche, ou écrivez un nouveau message." : "Les demandes non lues sont marquées d’un point bleu."}
          />
        )}
      </DeuxVolets>
      {ecrire && <NouveauMessage espace={espace} base={base} contactsInitiaux={contacts} open={nouveau} onOpenChange={setNouveau} />}
    </>
  );
}
