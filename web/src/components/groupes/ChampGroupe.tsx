"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Popover } from "radix-ui";
import { Cancel01Icon, Edit02Icon, ImageAdd01Icon, SentIcon, SmileIcon, ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
import { EMOJIS } from "@/components/communaute/emojis";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { menuSurfaceClasses } from "@/components/ui/Menu";
import { BarreEnregistrement, BoutonMicro, useVocalPossible } from "@/components/vocal/Enregistrement";
import { useEnregistreurVocal, type NoteEnregistree } from "@/components/vocal/useEnregistreurVocal";
import { formatDe } from "@/lib/admin/fichiers";
import { tailleLisible } from "@/lib/admin/fichiers";
import { cn } from "@/lib/cn";
import { ACCEPT_IMAGE, extrait, nomAuteur, refusImage, TEXTE_MAX } from "@/lib/groupes/regles";
import type { MessageGroupe } from "@/lib/groupes/types";
import { identifiantAleatoire } from "@/lib/identifiant";
import { createClient } from "@/lib/supabase/client";
import { deposerNoteVocale } from "@/lib/vocal/depot";
import { libelleVocal, type NoteVocale } from "@/lib/vocal/regles";

const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";
const ENVOI_ECHEC = "Votre message n’a pas pu être envoyé. Réessayez.";
/** Au-delà, le compteur de caractères s'affiche. */
const COMPTEUR_DES = TEXTE_MAX - 200;
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type Choisie = { fichier: File; type: string; apercu: string | null };

/**
 * Le champ d'écriture d'un groupe (spec des groupes, §2) : il grandit avec le texte (2 000 caractères au plus) ;
 * « Entrée » envoie sur ordinateur, « Maj+Entrée » va à la ligne (sur un écran tactile, Entrée va à la ligne et l'on
 * envoie avec le bouton) ; un bouton image (JPEG, PNG ou WebP, 5 Mo au plus) et un bouton emoji. Au-dessus : la réponse
 * en cours (« Réponse à … ») ou la modification d'un message. Échap annule l'une ou l'autre. Le champ vide, le micro
 * remplace « Envoyer » : la note vocale (0076) s'enregistre, se réécoute et part, en réponse s'il y en a une.
 */
export function ChampGroupe({
  nomGroupe,
  reponse,
  edition,
  onAnnuler,
  onEnvoyer,
  onModifier,
}: {
  nomGroupe: string;
  reponse: MessageGroupe | null;
  edition: MessageGroupe | null;
  /** Annule la réponse ou la modification en cours. */
  onAnnuler: () => void;
  /** Rend le message d'erreur, ou null quand le message est parti (`vocal` : le fichier est une note vocale). */
  onEnvoyer: (texte: string, fichier: string | null, vocal?: NoteVocale | null) => Promise<string | null>;
  onModifier: (id: string, texte: string) => Promise<string | null>;
}) {
  const [texte, setTexte] = useState("");
  const [image, setImage] = useState<Choisie | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [emojis, setEmojis] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);
  const vocalPossible = useVocalPossible();
  const enregistreur = useEnregistreurVocal();
  // Le texte en cours, gardé quand on modifie un message : il revient après l'enregistrement ou l'annulation.
  const [brouillon, setBrouillon] = useState("");

  // Modifier un message : son texte dans le champ ; fini (le parent n'a plus de message en cours) : le brouillon revient.
  const editionId = edition?.id ?? null;
  const [editionVue, setEditionVue] = useState<string | null>(null);
  if (editionId !== editionVue) {
    setEditionVue(editionId);
    if (edition) {
      if (!editionVue) setBrouillon(texte);
      setTexte(edition.texte);
      setImage(null);
    } else {
      setTexte(brouillon);
      setBrouillon("");
    }
    setErreur(null);
  }
  useEffect(() => {
    if (editionId || reponse) champ.current?.focus();
  }, [editionId, reponse]);
  useEffect(() => () => {
    if (image?.apercu) URL.revokeObjectURL(image.apercu);
  }, [image]);

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    const type = formatDe(fichier.name, new Uint8Array(await fichier.slice(0, 16).arrayBuffer()));
    const refus = refusImage(type, fichier.size);
    if (refus || !type) return setErreur(refus);
    setImage({ fichier, type, apercu: typeof URL.createObjectURL === "function" ? URL.createObjectURL(fichier) : null });
  }

  /** Dépose l'image (dossier du compte), puis envoie ; un refus garde le texte et retire l'image déposée. */
  async function envoyer(event?: FormEvent) {
    event?.preventDefault();
    if (envoi || (!texte.trim() && !image)) return;
    setEnvoi(true);
    setErreur(null);
    try {
      if (edition) {
        const refus = await onModifier(edition.id, texte);
        if (refus) return setErreur(refus);
        return;
      }
      let chemin: string | null = null;
      let supabase: ReturnType<typeof createClient> | null = null;
      if (image) {
        supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const compte = data?.user?.id;
        if (!compte) return setErreur(SESSION_EXPIREE);
        chemin = `${compte}/${identifiantAleatoire()}.${EXTENSIONS[image.type]}`;
        // Une copie typée : pour un fichier, la bibliothèque ignore contentType et garde le type du navigateur.
        const { error } = await supabase.storage.from("groupes").upload(chemin, image.fichier.slice(0, image.fichier.size, image.type), { contentType: image.type, upsert: false });
        if (error) return setErreur(ENVOI_ECHEC);
      }
      const refus = await onEnvoyer(texte, chemin);
      if (refus) {
        if (supabase && chemin) await supabase.storage.from("groupes").remove([chemin]).catch(() => undefined);
        return setErreur(refus);
      }
      setTexte("");
      setImage(null);
    } finally {
      setEnvoi(false);
      champ.current?.focus();
    }
  }

  /** La note vocale : déposée (dossier du compte), puis envoyée ; un refus retire le fichier et garde la note. */
  async function envoyerNote(note: NoteEnregistree) {
    if (envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const depot = await deposerNoteVocale("groupes", null, note);
      if (!depot.ok) return setErreur(depot.message);
      const refus = await onEnvoyer("", depot.chemin, { dureeMs: note.dureeMs, ondes: note.ondes });
      if (refus) {
        await depot.retirer();
        return setErreur(refus);
      }
      enregistreur.terminer();
    } finally {
      setEnvoi(false);
    }
  }

  function touche(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && (reponse || edition)) {
      event.preventDefault();
      onAnnuler();
      return;
    }
    // Entrée envoie ; Maj+Entrée va à la ligne (et une saisie en cours, accents composés, n'est pas coupée). Sur un
    // écran tactile, Entrée va à la ligne : on envoie avec le bouton, comme dans les messageries des téléphones.
    const tactile = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (event.key === "Enter" && !event.shiftKey && !tactile && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void envoyer();
    }
  }

  /** L'emoji à la place du curseur (ou de la sélection). */
  function inserer(emoji: string) {
    const zone = champ.current;
    const debut = zone?.selectionStart ?? texte.length;
    const fin = zone?.selectionEnd ?? texte.length;
    const suivant = texte.slice(0, debut) + emoji + texte.slice(fin);
    if (suivant.length > TEXTE_MAX) return;
    setTexte(suivant);
    setEmojis(false);
    requestAnimationFrame(() => {
      zone?.focus();
      zone?.setSelectionRange(debut + emoji.length, debut + emoji.length);
    });
  }

  const enCours = edition ?? reponse;
  return (
    <form onSubmit={(e) => void envoyer(e)} className="flex flex-col gap-2 px-4 pt-3 pb-3.5 max-sm:px-2.5 max-sm:pt-2 max-sm:pb-[calc(8px+env(safe-area-inset-bottom))]">
      {enCours && (
        <div className="flex min-w-0 items-center gap-2.5 rounded-champ border-l-[3px] border-bleu bg-coque py-1.5 pr-1 pl-3">
          <Icon icon={edition ? Edit02Icon : ArrowTurnBackwardIcon} size={16} className="flex-none text-bleu" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs leading-[18px] font-semibold text-encre">{edition ? "Modifier votre message" : `Réponse à ${reponse!.deMoi ? "vous-même" : nomAuteur(reponse!.auteur)}`}</span>
            {!edition && (
              <span className="truncate text-xs leading-[18px] text-discret">
                {reponse!.texte ? extrait(reponse!.texte, 120) : reponse!.vocal ? libelleVocal(reponse!.vocal.dureeMs) : reponse!.image ? "Image" : ""}
              </span>
            )}
          </span>
          <IconButton icon={Cancel01Icon} label={edition ? "Annuler la modification" : "Annuler la réponse"} variant="discret" size="sm" onClick={onAnnuler} />
        </div>
      )}
      {image && (
        <div className="flex items-center gap-2.5 self-start rounded-champ border border-bordure-carte py-1.5 pr-1 pl-1.5">
          {image.apercu ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local de l'image choisie
            <img src={image.apercu} alt="" className="size-10 rounded-puce object-cover" />
          ) : (
            <Icon icon={ImageAdd01Icon} size={18} />
          )}
          <span className="flex min-w-0 flex-col">
            <span className="max-w-[200px] truncate text-sm leading-5 font-medium text-encre">{image.fichier.name}</span>
            <span className="text-xs leading-[18px] text-discret">{tailleLisible(image.fichier.size)}</span>
          </span>
          <IconButton icon={Cancel01Icon} label="Retirer l’image" variant="discret" size="sm" onClick={() => setImage(null)} />
        </div>
      )}
      {(erreur ?? enregistreur.erreur) && (
        <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
          {erreur ?? enregistreur.erreur}
        </p>
      )}
      {enregistreur.etat !== "inactif" ? (
        <BarreEnregistrement enregistreur={enregistreur} envoi={envoi} onEnvoyer={(note) => void envoyerNote(note)} />
      ) : (
      <div className="flex items-end gap-1.5 max-sm:gap-1">
        {!edition && (
          <label
            title="Ajouter une image"
            className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-bouton text-texte transition-colors hover:bg-coque has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-bleu max-sm:size-10"
          >
            <input
              type="file"
              aria-label="Ajouter une image"
              accept={ACCEPT_IMAGE}
              className="sr-only"
              onChange={(e) => {
                void choisir(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Icon icon={ImageAdd01Icon} size={20} />
          </label>
        )}
        <Popover.Root open={emojis} onOpenChange={setEmojis}>
          <Popover.Trigger asChild>
            <IconButton icon={SmileIcon} label="Ajouter un emoji" variant="discret" className="size-11 max-sm:size-10" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="top" align="start" sideOffset={8} className={cn(menuSurfaceClasses, "w-[296px] max-w-[calc(100vw_-_32px)] p-2")}>
              <div role="group" aria-label="Emojis" className="grid grid-cols-8 gap-0.5">
                {EMOJIS.map(([emoji, nom]) => (
                  <button
                    key={nom}
                    type="button"
                    aria-label={nom}
                    title={nom}
                    className="focus-etudium flex size-8 cursor-pointer items-center justify-center rounded-puce border-0 bg-transparent text-lg leading-none transition-colors hover:bg-coque"
                    onClick={() => inserer(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <div className="flex min-w-0 flex-1 flex-col">
          <textarea
            ref={champ}
            rows={1}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={touche}
            aria-label={edition ? "Modifier votre message" : `Message au groupe ${nomGroupe}`}
            placeholder="Votre message…"
            maxLength={TEXTE_MAX}
            className="box-border max-h-40 min-h-11 min-w-0 resize-none rounded-champ border border-bordure-champ bg-panneau px-3.5 py-2.5 font-[inherit] text-[15px] leading-[22px] text-texte [field-sizing:content] placeholder:text-indice focus:border-bleu focus:outline-none max-sm:min-h-10 max-sm:px-3 max-sm:py-2 max-sm:text-base max-sm:leading-[22px]"
          />
          {texte.length > COMPTEUR_DES && <span className="mt-1 self-end text-xs leading-[18px] text-discret tabular-nums">{`${texte.length.toLocaleString("fr-FR")} / 2 000`}</span>}
        </div>
        {vocalPossible && !edition && !texte.trim() && !image ? (
          <BoutonMicro
            onClick={() => {
              setErreur(null);
              void enregistreur.demarrer();
            }}
            className="h-11 max-sm:h-10 max-sm:px-3"
          />
        ) : (
          <Button type="submit" size="lg" iconLeft={SentIcon} loading={envoi} disabled={!texte.trim() && !image} className="h-11 flex-none px-4 max-sm:h-10 max-sm:px-3">
            <span className="max-sm:sr-only">{edition ? "Enregistrer" : "Envoyer"}</span>
          </Button>
        )}
      </div>
      )}
    </form>
  );
}
