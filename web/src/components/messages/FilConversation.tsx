"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowLeft01Icon, Attachment01Icon, Cancel01Icon, File02Icon, SentIcon } from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { tailleLisible } from "@/lib/admin/fichiers";
import { identifiantAleatoire } from "@/lib/identifiant";
import { envoyerMessage, lienFichierMessage, relireFil } from "@/lib/messages/actions";
import { ACCEPT_MESSAGE, formatDeMessage, MESSAGE_MAX_OCTETS } from "@/lib/messages/fichiers";
import type { EspaceMessages, Fil, Message } from "@/lib/messages/types";
import { grouperParJour, heure } from "@/lib/notifications/temps";
import { createClient } from "@/lib/supabase/client";
import { AvatarInterlocuteur } from "./AvatarInterlocuteur";
import { rafraichirMessagesNonLus } from "./useMessagesNonLus";

const RELECTURE_MS = 10_000;
const FORMAT_REFUSE = "Ce format n’est pas accepté : PDF, Word, Excel, PowerPoint, image ou ZIP.";
const TROP_LOURD = "Le fichier dépasse 10 Mo.";
const ENVOI_ECHEC = "Votre message n’a pas pu être envoyé. Réessayez.";
const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";

type Choisi = { fichier: File; format: string };

/**
 * Les messages du serveur, plus ceux envoyés depuis cet écran qu'il n'a pas encore rendus (une relecture partie avant
 * l'envoi), sans doublon, dans l'ordre.
 */
function fusionner(serveur: Message[], locaux: Message[]): Message[] {
  const connus = new Set(serveur.map((m) => m.id));
  const dernier = serveur.at(-1)?.creeLe ?? "";
  const enPlus = locaux.filter((m) => !connus.has(m.id) && m.creeLe >= dernier);
  return [...serveur, ...enPlus].sort((a, b) => a.creeLe.localeCompare(b.creeLe));
}

/** Une bulle (NdMessages) : la sienne en bleu à droite, celle de l'autre en gris-bleu à gauche ; sa pièce jointe dessous. */
function Bulle({ message }: { message: Message }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const signature = message.auteur ? `${message.auteur} · ${heure(message.creeLe)}` : message.deMoi ? `Vous · ${heure(message.creeLe)}` : heure(message.creeLe);
  async function telecharger() {
    setErreur(null);
    const lien = await lienFichierMessage(message.id).catch(() => ({ erreur: "Le lien de téléchargement n’a pas pu être créé. Réessayez." }));
    if ("url" in lien) window.location.assign(lien.url);
    else setErreur(lien.erreur);
  }
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", message.deMoi ? "items-end" : "items-start")}>
      {message.texte && (
        <div
          className={cn(
            "box-border max-w-[min(100%,460px)] rounded-carte px-3.5 py-2.5 text-sm leading-[22px] whitespace-pre-line text-pretty [overflow-wrap:anywhere]",
            message.deMoi ? "bg-bleu text-white" : "bg-coque text-texte",
          )}
        >
          {message.texte}
        </div>
      )}
      {message.fichier && (
        <button
          type="button"
          onClick={() => void telecharger()}
          aria-label={`Télécharger ${message.fichier.nom} (${tailleLisible(message.fichier.taille)})`}
          className="focus-etudium box-border flex w-[min(100%,320px)] cursor-pointer items-center gap-3 rounded-bouton border border-bordure-carte bg-panneau px-3.5 py-3 text-left transition-colors hover:bg-page"
        >
          <span className="flex size-10 flex-none items-center justify-center rounded-champ bg-coque text-texte">
            <Icon icon={File02Icon} size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm leading-5 font-medium text-encre">{message.fichier.nom}</span>
            <span className="text-xs leading-[18px] text-discret">{tailleLisible(message.fichier.taille)}</span>
          </span>
        </button>
      )}
      {erreur && (
        <span role="alert" className="text-xs leading-[18px] text-erreur-texte">
          {erreur}
        </span>
      )}
      <span className="text-xs leading-[18px] text-discret">{signature}</span>
    </div>
  );
}

/**
 * Une conversation (NdMessages, colonne de droite) : l'en-tête, les messages par jour, la zone de saisie. Relue toutes
 * les 10 s tant que l'onglet est visible ; une relecture qui échoue ne change rien à l'écran.
 */
export function FilConversation({
  espace,
  base,
  filInitial,
  onEnvoye,
}: {
  espace: EspaceMessages;
  base: string;
  filInitial: Fil;
  /** Le message vient de partir : la liste de gauche se met à jour. */
  onEnvoye: (message: Message) => void;
}) {
  const id = useId();
  const conversationId = filInitial.conversation.id;
  const { avec, formation } = filInitial.conversation;
  const [messages, setMessages] = useState<Message[]>(filInitial.messages);
  const [plusAnciens, setPlusAnciens] = useState(filInitial.plusAnciens);
  const [texte, setTexte] = useState("");
  const [choisi, setChoisi] = useState<Choisi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const locaux = useRef<Message[]>([]);
  const fin = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);

  // L'ouverture a marqué la conversation lue : la pastille du menu se relit.
  useEffect(() => {
    rafraichirMessagesNonLus(espace);
  }, [espace, conversationId]);

  useEffect(() => {
    const minuterie = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void relireFil(conversationId).then((fil) => {
        if (!fil) return;
        setMessages((avant) => {
          // Les messages précédents déjà chargés (plus anciens que le premier rendu par le serveur) restent.
          const premier = fil.messages[0]?.creeLe;
          const anciens = premier ? avant.filter((m) => m.creeLe < premier) : [];
          const suivants = [...anciens, ...fusionner(fil.messages, locaux.current)];
          if (suivants.length !== avant.length) rafraichirMessagesNonLus(espace);
          return suivants;
        });
      });
    }, RELECTURE_MS);
    return () => clearInterval(minuterie);
  }, [conversationId, espace]);

  // Le dernier message reste visible quand il en arrive un (pas quand on charge les précédents).
  const dernier = messages.at(-1)?.id;
  useEffect(() => {
    fin.current?.scrollIntoView?.({ block: "nearest" });
  }, [dernier]);

  async function precedents() {
    const premier = messages[0];
    if (!premier) return;
    const fil = await relireFil(conversationId, premier.creeLe);
    if (!fil) return;
    setMessages((avant) => [...fil.messages.filter((m) => !avant.some((a) => a.id === m.id)), ...avant]);
    setPlusAnciens(fil.plusAnciens);
  }

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    if (fichier.size > MESSAGE_MAX_OCTETS) return setErreur(TROP_LOURD);
    const octets = new Uint8Array(await fichier.slice(0, 16).arrayBuffer());
    const format = formatDeMessage(fichier.name, octets);
    if (!format) return setErreur(FORMAT_REFUSE);
    setChoisi({ fichier, format });
  }

  /** Dépose la pièce jointe (dossier du compte), puis envoie ; un refus garde le texte et retire le fichier déposé. */
  async function envoyer(event?: FormEvent) {
    event?.preventDefault();
    if (envoi || (!texte.trim() && !choisi)) return;
    setEnvoi(true);
    setErreur(null);
    let piece: { chemin: string; nom: string } | null = null;
    const supabase = createClient();
    try {
      if (choisi) {
        const { data } = await supabase.auth.getUser();
        const compte = data?.user?.id;
        if (!compte) return setErreur(SESSION_EXPIREE);
        const extension = choisi.fichier.name.split(".").pop()?.toLowerCase() ?? "bin";
        piece = { chemin: `${compte}/${conversationId}/${identifiantAleatoire()}.${extension}`, nom: choisi.fichier.name };
        // Une copie typée : pour un fichier, la bibliothèque ignore contentType et garde le type du navigateur.
        const { error } = await supabase.storage.from("messages").upload(piece.chemin, choisi.fichier.slice(0, choisi.fichier.size, choisi.format), { contentType: choisi.format, upsert: false });
        if (error) return setErreur(ENVOI_ECHEC);
      }
      const reponse = await envoyerMessage(conversationId, texte, piece).catch(() => ({ ok: false as const, message: ENVOI_ECHEC }));
      if (!reponse.ok) {
        if (piece) await supabase.storage.from("messages").remove([piece.chemin]).catch(() => undefined);
        return setErreur(reponse.message);
      }
      locaux.current = [...locaux.current, reponse.message];
      setMessages((avant) => (avant.some((m) => m.id === reponse.message.id) ? avant : [...avant, reponse.message]));
      setTexte("");
      setChoisi(null);
      onEnvoye(reponse.message);
      champ.current?.focus();
    } finally {
      setEnvoi(false);
    }
  }

  function touche(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Entrée envoie ; Maj+Entrée va à la ligne (et une saisie en cours, accents composés, n'est pas coupée). Sur un
    // écran tactile, Entrée va à la ligne : on envoie avec le bouton, comme dans les messageries des téléphones.
    const tactile = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (event.key === "Enter" && !event.shiftKey && !tactile && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void envoyer();
    }
  }

  const maintenant = new Date();
  return (
    <section aria-labelledby={`${id}-titre`} className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau">
      <h2 id={`${id}-titre`} className="sr-only">{`Conversation avec ${avec.nom}`}</h2>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 max-sm:gap-2.5 max-sm:px-3.5 max-sm:py-3">
        <Link href={base} aria-label="Retour aux conversations" className={cn(buttonVariants({ variant: "discret", size: "sm" }), "-ml-1 px-1.5 sm:hidden")}>
          <Icon icon={ArrowLeft01Icon} size={20} />
        </Link>
        <AvatarInterlocuteur avec={avec} />
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5 max-sm:flex-1">
          <span className="truncate text-[15px] leading-[22px] font-semibold text-encre">{avec.nom}</span>
          <span className="text-[13px] leading-5 text-discret">{formation ? `${avec.role} · ${formation.titre}` : avec.role}</span>
        </div>
        {formation && espace === "etudiant" && (
          <Link href={`/formations/${formation.slug}`} className={buttonVariants({ variant: "contour", size: "sm" })}>
            Voir la formation
          </Link>
        )}
      </div>
      <div className="h-px bg-bordure-carte" />
      <div aria-live="polite" className="flex max-h-[min(60dvh,560px)] min-h-[240px] flex-col gap-3.5 overflow-y-auto p-5 max-sm:max-h-[calc(100dvh-280px)] max-sm:px-3.5 max-sm:py-4">
        {plusAnciens && (
          <Button variant="discret" size="sm" className="self-center" onClick={() => void precedents()}>
            Messages précédents
          </Button>
        )}
        {messages.length === 0 && <p className="m-auto text-center text-sm leading-[22px] text-discret">Écrivez le premier message.</p>}
        {grouperParJour(messages, maintenant).map((groupe) => (
          <div key={groupe.cle} className="flex flex-col gap-3.5">
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-bordure-carte" />
              <span className="text-xs leading-[18px] text-discret">{groupe.libelle}</span>
              <span className="h-px flex-1 bg-bordure-carte" />
            </div>
            {groupe.lignes.map((m) => (
              <Bulle key={m.id} message={m} />
            ))}
          </div>
        ))}
        <div ref={fin} />
      </div>
      <div className="h-px bg-bordure-carte" />
      <form onSubmit={(e) => void envoyer(e)} className="flex flex-col gap-2 px-4 py-3.5 max-sm:px-3 max-sm:py-3">
        {choisi && (
          <div className="flex items-center gap-2 self-start rounded-champ border border-bordure-carte py-1.5 pr-1.5 pl-3 text-sm leading-5">
            <Icon icon={File02Icon} size={16} />
            <span className="max-w-[220px] truncate font-medium text-encre">{choisi.fichier.name}</span>
            <span className="text-xs text-discret">{tailleLisible(choisi.fichier.size)}</span>
            <IconButton icon={Cancel01Icon} label="Retirer la pièce jointe" variant="discret" size="sm" onClick={() => setChoisi(null)} />
          </div>
        )}
        {erreur && (
          <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
            {erreur}
          </p>
        )}
        <div className="flex items-end gap-2">
          <label className="flex size-12 flex-none cursor-pointer items-center justify-center rounded-bouton text-texte transition-colors hover:bg-coque has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-bleu max-sm:size-11">
            <input
              type="file"
              aria-label="Joindre un fichier"
              accept={ACCEPT_MESSAGE}
              className="sr-only"
              onChange={(e) => {
                void choisir(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Icon icon={Attachment01Icon} size={20} />
          </label>
          <textarea
            ref={champ}
            rows={1}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={touche}
            aria-label={`Message à ${avec.nom}`}
            placeholder="Écrivez votre message…"
            maxLength={4000}
            className="box-border max-h-40 min-h-12 min-w-0 flex-1 resize-none rounded-champ border border-bordure-champ bg-panneau px-3.5 py-3 font-[inherit] text-[15px] leading-[22px] text-texte [field-sizing:content] placeholder:text-indice focus:border-bleu focus:outline-none max-sm:min-h-11 max-sm:py-2.5"
          />
          <Button type="submit" size="lg" iconLeft={SentIcon} loading={envoi} disabled={!texte.trim() && !choisi} className="max-sm:h-11 max-sm:px-3.5">
            <span className="max-sm:sr-only">Envoyer</span>
          </Button>
        </div>
      </form>
    </section>
  );
}
