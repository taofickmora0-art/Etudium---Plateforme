"use client";

import { useRef } from "react";
import { ArrowTurnBackwardIcon, Copy01Icon, Delete02Icon, Edit02Icon, Flag02Icon, MoreVerticalIcon, PinIcon, PinOffIcon } from "@hugeicons/core-free-icons";
import { DropdownMenu } from "radix-ui";
import { initiales, tonAvatar } from "@/components/communaute/outils";
import { TexteAvecLiens } from "@/components/communaute/TexteAvecLiens";
import { Avatar } from "@/components/ui/Avatar";
import type { IconSvgElement } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { MenuEntries, menuSeparatorClasses, menuSurfaceClasses, type MenuEntry } from "@/components/ui/Menu";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { nomAuteur, peutModifier } from "@/lib/groupes/regles";
import { REACTIONS, type MessageGroupe } from "@/lib/groupes/types";
import { heure } from "@/lib/notifications/temps";

/** Le nom des six réactions, pour les lecteurs d'écran. */
export const NOMS_REACTIONS: Record<string, string> = {
  "👍": "Pouce levé",
  "❤️": "Cœur",
  "😂": "Rire",
  "😮": "Surprise",
  "😢": "Tristesse",
  "🙏": "Merci",
};

export type ActionMessage = "repondre" | "copier" | "modifier" | "supprimer" | "epingler" | "desepingler" | "signaler";

export type DroitsMessage = {
  /** Supprimer n'importe quel message et épingler : le formateur du groupe et l'équipe. */
  peutModerer: boolean;
  /** L'équipe modère depuis la file : elle ne signale pas. */
  equipe: boolean;
  /** Faux : groupe désactivé, personne n'y écrit ni n'y réagit. */
  peutEcrire: boolean;
};

/** Les actions du menu d'un message, selon les droits : répondre, copier, modifier, épingler, signaler, supprimer. */
export function actionsDuMessage(m: MessageGroupe, droits: DroitsMessage, maintenant: Date): ActionMessage[] {
  if (m.supprime || m.retire) return [];
  const actions: ActionMessage[] = [];
  if (droits.peutEcrire) actions.push("repondre");
  if (m.texte) actions.push("copier");
  if (droits.peutEcrire && m.texte && peutModifier(m, maintenant)) actions.push("modifier");
  if (droits.peutModerer) actions.push(m.epingle ? "desepingler" : "epingler");
  if (!m.deMoi && !droits.equipe) actions.push("signaler");
  if (m.deMoi || droits.peutModerer) actions.push("supprimer");
  return actions;
}

const LIBELLES: Record<ActionMessage, { label: string; icon: IconSvgElement }> = {
  repondre: { label: "Répondre", icon: ArrowTurnBackwardIcon },
  copier: { label: "Copier le texte", icon: Copy01Icon },
  modifier: { label: "Modifier", icon: Edit02Icon },
  epingler: { label: "Épingler", icon: PinIcon },
  desepingler: { label: "Désépingler", icon: PinOffIcon },
  signaler: { label: "Signaler", icon: Flag02Icon },
  supprimer: { label: "Supprimer", icon: Delete02Icon },
};

/** Les réactions d'un message : une puce par emoji, la sienne en bleu ; cliquer la met ou l'enlève. */
function Reactions({ message: m, actif, onReagir }: { message: MessageGroupe; actif: boolean; onReagir: (emoji: string) => void }) {
  if (m.reactions.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", m.deMoi && "justify-end")}>
      {m.reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          aria-pressed={r.moi}
          disabled={!actif}
          aria-label={`${NOMS_REACTIONS[r.emoji] ?? r.emoji} : ${r.nombre} réaction${r.nombre > 1 ? "s" : ""}${r.moi ? ", dont la vôtre" : ""}`}
          onClick={() => onReagir(r.emoji)}
          className={cn(
            "focus-etudium inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2 text-[13px] leading-none tabular-nums transition-colors disabled:cursor-default",
            r.moi ? "border-bleu bg-bleu-pale text-bleu" : "border-bordure-carte bg-panneau text-texte enabled:hover:bg-page",
          )}
        >
          <span aria-hidden="true" className="text-[15px]">
            {r.emoji}
          </span>
          <span aria-hidden="true">{r.nombre}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Un message du fil : la bulle (la sienne en bleu à droite, celle des autres en gris-bleu à gauche), la réponse citée
 * (cliquable, elle mène au message), l'image (ouverte en grand au clic), les liens cliquables, l'heure et « modifié » ;
 * les réactions dessous et le menu ⋮ (Répondre, réactions, Copier, Modifier, Épingler, Signaler, Supprimer, selon les
 * droits). En tête de bloc (`premier`) : l'avatar, le nom et le badge « Formateur » ou « Équipe ».
 */
export function MessageDuFil({
  message: m,
  premier,
  droits,
  maintenant,
  surligne,
  onAction,
  onReagir,
  onCitation,
  onImage,
}: {
  message: MessageGroupe;
  premier: boolean;
  droits: DroitsMessage;
  maintenant: Date;
  surligne: boolean;
  onAction: (action: ActionMessage) => void;
  onReagir: (emoji: string) => void;
  onCitation: (id: string) => void;
  onImage: () => void;
}) {
  const nom = m.deMoi ? "vous" : nomAuteur(m.auteur);
  const actions = actionsDuMessage(m, droits, maintenant);
  // Une entrée qui ouvre une fenêtre (Supprimer, Signaler) : la fenêtre garde le focus, le menu ne le reprend pas.
  const fenetreDemandee = useRef(false);
  const horodatage = `${heure(m.creeLe)}${m.modifieLe && !m.supprime && !m.retire ? " · modifié" : ""}`;
  const enLigne = !m.supprime && !m.retire;
  const bulle = cn(
    "box-border flex min-w-0 max-w-full flex-col rounded-carte px-3.5 py-2 text-[15px] leading-[22px] max-sm:px-3 max-sm:text-sm max-sm:leading-5",
    !enLigne ? "border border-dashed border-bordure-carte bg-transparent text-discret italic" : m.deMoi ? "bg-bleu text-white" : "bg-coque text-texte",
    surligne && "ring-2 ring-bleu ring-offset-2 ring-offset-panneau",
  );
  const items: MenuEntry[] = actions.map((a) => ({
    label: LIBELLES[a].label,
    icon: LIBELLES[a].icon,
    danger: a === "supprimer",
    onSelect: () => {
      fenetreDemandee.current = a === "supprimer" || a === "signaler";
      onAction(a);
    },
  }));

  return (
    <div
      data-message={m.id}
      id={`message-${m.id}`}
      className={cn("group/message flex min-w-0 scroll-mt-24 items-start gap-2.5 max-sm:gap-2", m.deMoi && "flex-row-reverse", premier ? "mt-3" : "mt-1")}
    >
      {!m.deMoi && (
        <span className="w-8 flex-none">
          {premier && <Avatar initials={initiales(m.auteur.prenom, m.auteur.nom)} size={32} tone={tonAvatar(nomAuteur(m.auteur))} src={m.auteur.photoUrl} />}
        </span>
      )}
      <div className={cn("flex min-w-0 max-w-[min(100%,560px)] flex-col gap-1", m.deMoi ? "items-end" : "items-start")}>
        {premier && !m.deMoi && (
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-[13px] leading-5 font-semibold wrap-anywhere text-encre">{nomAuteur(m.auteur)}</span>
            {m.auteur.badge === "formateur" && <Tag tone="nouveau">Formateur</Tag>}
            {m.auteur.badge === "equipe" && <Tag tone="complementaire">Équipe</Tag>}
          </span>
        )}
        <div className={cn("flex min-w-0 max-w-full items-start gap-0.5", m.deMoi && "flex-row-reverse")}>
          <div className={bulle}>
            {enLigne && m.reponse && (
              <button
                type="button"
                onClick={() => onCitation(m.reponse!.id)}
                aria-label={`Aller au message cité de ${nomAuteur(m.reponse.auteur)}`}
                className={cn(
                  "focus-etudium mb-1.5 flex min-w-0 cursor-pointer flex-col items-start rounded-champ border-0 border-l-[3px] border-solid px-2.5 py-1.5 text-left not-italic",
                  m.deMoi ? "border-white/70 bg-white/15 text-white" : "border-bleu bg-panneau/80 text-texte",
                )}
              >
                <span className="text-xs leading-[18px] font-semibold">{nomAuteur(m.reponse.auteur)}</span>
                <span className="line-clamp-2 text-xs leading-[18px] wrap-anywhere opacity-90">
                  {m.reponse.supprime ? "Message supprimé" : m.reponse.texte || (m.reponse.image ? "Image" : "")}
                </span>
              </button>
            )}
            {enLigne && m.image && (
              <button
                type="button"
                onClick={onImage}
                aria-label={`Agrandir l’image de ${nom}`}
                className="focus-etudium mb-1 block cursor-zoom-in overflow-hidden rounded-champ border-0 bg-transparent p-0"
              >
                {m.image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image privée, servie par un lien signé d'une heure
                  <img src={m.image.url} alt="" loading="lazy" className="block max-h-72 max-w-full object-cover max-sm:max-h-60" />
                ) : (
                  <span className="block px-3 py-6 text-sm text-discret not-italic">Image indisponible</span>
                )}
              </button>
            )}
            {m.supprime ? (
              <span>Message supprimé</span>
            ) : m.retire ? (
              <span>Message retiré par la modération</span>
            ) : (
              m.texte && <TexteAvecLiens texte={m.texte} className={cn(m.deMoi && "[&_a]:text-white [&_a]:underline")} />
            )}
            <span className={cn("mt-0.5 self-end text-[11px] leading-4 not-italic", m.deMoi && enLigne ? "text-white/80" : "text-discret")}>{horodatage}</span>
          </div>
          {actions.length > 0 && (
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <IconButton
                  icon={MoreVerticalIcon}
                  label={m.deMoi ? "Actions sur votre message" : `Actions sur le message de ${nom}`}
                  variant="discret"
                  size="sm"
                  className="opacity-0 group-hover/message:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
                />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  aria-label="Actions sur le message"
                  align={m.deMoi ? "end" : "start"}
                  sideOffset={6}
                  className={cn(menuSurfaceClasses, "w-[248px]")}
                  onCloseAutoFocus={(e) => {
                    if (fenetreDemandee.current) e.preventDefault();
                    fenetreDemandee.current = false;
                  }}
                >
                  {droits.peutEcrire && (
                    <>
                      <DropdownMenu.Group aria-label="Réagir" className="flex justify-between gap-0.5 px-1 pb-1">
                        {REACTIONS.map((emoji) => (
                          <DropdownMenu.Item
                            key={emoji}
                            aria-label={`Réagir : ${NOMS_REACTIONS[emoji]}`}
                            onSelect={() => onReagir(emoji)}
                            className="focus-etudium flex size-9 cursor-pointer items-center justify-center rounded-puce text-xl leading-none select-none data-[highlighted]:bg-coque"
                          >
                            {emoji}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Group>
                      <DropdownMenu.Separator className={menuSeparatorClasses} />
                    </>
                  )}
                  <MenuEntries items={items} />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
        <Reactions message={m} actif={droits.peutEcrire && enLigne} onReagir={onReagir} />
      </div>
    </div>
  );
}
