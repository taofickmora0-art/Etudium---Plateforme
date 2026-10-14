"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import { Attachment01Icon, Cancel01Icon, Image01Icon, Pdf01Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { formatDe, formatParMime } from "@/lib/admin/fichiers";
import { publierPublication } from "@/lib/communaute/actions";
import { REFUS_PIECE, refusPiece, refusPublication, tailleLisible, TITRE_MAX } from "@/lib/communaute/regles";
import type { Espace, MoiCommunaute, PieceEnvoyee, Publication } from "@/lib/communaute/types";
import { reconnaitreVideo } from "@/lib/communaute/video";
import { createClient } from "@/lib/supabase/client";
import { VideoIntegree } from "./VideoIntegree";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const ECHEC_ENVOI = "L’envoi du fichier n’a pas abouti. Réessayez.";
const CADRE = "box-border flex min-w-0 rounded-2xl border border-bordure-carte bg-panneau";
const ADRESSE_VIDEO = "Collez l’adresse complète de la vidéo (https://…).";

// L'éditeur visuel (Tiptap) n'est chargé qu'à l'ouverture du champ : le fil reste léger.
const EditeurTexte = dynamic(() => import("./EditeurTexte").then((m) => m.EditeurTexte), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[150px] animate-pulse rounded-champ border border-bordure-champ bg-page" />,
});


type Piece = { fichier: File; type: string; extension: string };

/** Un aperçu local du fichier publié, le temps que le fil soit relu ; absent hors navigateur. */
const apercu = (fichier: File) => (typeof URL.createObjectURL === "function" ? URL.createObjectURL(fichier) : null);

/**
 * Le champ de publication (design NdCommunaute ; spec du fil « Actualités », §1 ; spec mise en forme et vidéo). Fermé :
 * « Quoi de neuf, <prénom> ? », Image, Vidéo et Fichier. Ouvert : un titre facultatif, le texte dans l'éditeur visuel,
 * une image ou un PDF, le lien d'une vidéo et son aperçu, Publier. Le fichier part d'abord du
 * navigateur vers le dossier du compte dans l'espace de stockage « communaute », puis la publication est enregistrée ;
 * si elle est refusée, le fichier est retiré.
 */
export function ChampPublication({
  espace,
  espaces = [],
  moi,
  analyseActive = false,
  onPubliee,
}: {
  /** L'espace proposé d'abord : celui de l'onglet (le général pour Actualités). */
  espace: Espace;
  /** Les espaces ouverts au compte, pour « Publication dans » ; vide : l'espace proposé seul. */
  espaces?: Espace[];
  moi: MoiCommunaute;
  /** Migration 0020 : les publications sont analysées par l'IA. */
  analyseActive?: boolean;
  onPubliee: (publication: Publication) => void;
}) {
  const { toast } = useToast();
  const idEspace = useId();
  const choix = espaces.length > 0 ? espaces : [espace];
  // L'espace choisi dans « Publication dans » (identifiant, ou « general »).
  const [destination, setDestination] = useState(espace.id ?? "general");
  const cible = choix.find((e) => (e.id ?? "general") === destination) ?? espace;
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [piece, setPiece] = useState<Piece | null>(null);
  // Le lien de la vidéo ; null : le champ Vidéo est fermé.
  const [video, setVideo] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  // Ouvert par « Ajouter une vidéo » : le lien prend le focus, pas le texte.
  const [focusTexte, setFocusTexte] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const image = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const invite = useRef<HTMLButtonElement>(null);
  // Refermé par « Annuler » : le focus revient sur « Quoi de neuf ».
  const rendreLeFocus = useRef(false);

  useEffect(() => {
    if (!ouvert && rendreLeFocus.current) {
      rendreLeFocus.current = false;
      invite.current?.focus();
    }
  }, [ouvert]);

  function fermer() {
    setTitre("");
    setTexte("");
    setPiece(null);
    setVideo(null);
    setDestination(espace.id ?? "general");
    setErreur(null);
    setFocusTexte(true);
    setOuvert(false);
  }

  async function choisir(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    // Le même fichier peut être choisi de nouveau après un retrait.
    e.target.value = "";
    if (!fichier) return;
    // Le type se lit sur les premiers octets : un « .png » qui n'en est pas un est refusé.
    const octets = new Uint8Array(await fichier.slice(0, 16).arrayBuffer());
    const type = formatDe(fichier.name, octets);
    const extension = type ? formatParMime(type)?.extensions[0] : undefined;
    const refus = type && extension ? refusPiece(type, fichier.size) : REFUS_PIECE;
    setOuvert(true);
    if (refus || !type || !extension) {
      setErreur(refus ?? REFUS_PIECE);
      return;
    }
    setErreur(null);
    setPiece({ fichier, type, extension });
  }

  /** Dépose le fichier dans le dossier du compte ; null si l'envoi échoue. */
  async function deposer(p: Piece): Promise<PieceEnvoyee | null> {
    const chemin = `${moi.compteId}/${crypto.randomUUID()}.${p.extension}`;
    try {
      // Une copie typée (sans recopier les octets) transmet le type vérifié, pas celui qu'annonce le navigateur.
      const { error } = await createClient()
        .storage.from("communaute")
        .upload(chemin, p.fichier.slice(0, p.fichier.size, p.type), { contentType: p.type, upsert: false });
      return error ? null : { chemin, nom: p.fichier.name, type: p.type, taille: p.fichier.size };
    } catch {
      return null;
    }
  }

  async function publier() {
    const refus = refusPublication(titre, texte) ?? (video?.trim() && !reconnaitreVideo(video) ? ADRESSE_VIDEO : null);
    if (refus) {
      setErreur(refus);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const envoyee = piece ? await deposer(piece) : null;
      if (piece && !envoyee) {
        setErreur(ECHEC_ENVOI);
        return;
      }
      let resultat: Awaited<ReturnType<typeof publierPublication>>;
      try {
        resultat = await publierPublication(cible.id, titre.trim(), texte.trim(), envoyee, video?.trim() || null);
      } catch {
        // L'action n'a pas répondu : le fichier ne reste pas sans publication.
        if (envoyee) await createClient().storage.from("communaute").remove([envoyee.chemin]).catch(() => undefined);
        resultat = { ok: false, message: ECHEC };
      }
      if (!resultat.ok) {
        setErreur(resultat.message);
        return;
      }
      onPubliee({
        id: resultat.id,
        auteur: { prenom: moi.prenom, nom: moi.nom, role: null },
        estMoi: true,
        espace: { id: cible.id, nom: cible.id ? cible.nomCourt : "général" },
        titre: titre.trim(),
        texte: texte.trim(),
        pieceJointe: envoyee && piece ? { ...envoyee, url: apercu(piece.fichier) } : null,
        creeLe: new Date().toISOString(),
        modifiee: false,
        statut: resultat.statut,
        reactions: 0,
        jAime: false,
        reponses: 0,
        dernieresReponses: [],
        peutSupprimer: true,
        peutSignaler: false,
        apercu: resultat.apercu,
        enregistree: false,
        aimeePar: [],
        video: resultat.video,
      });
      fermer();
      toast(
        resultat.statut === "en_attente"
          ? { tone: "information", title: "Publication envoyée", description: "Elle paraîtra après vérification par l’équipe Étudium." }
          : { tone: "reussite", title: "Publication en ligne", description: "Elle apparaît en haut du fil." },
      );
    } finally {
      setEnvoi(false);
    }
  }

  // Les champs de fichier restent présents, champ fermé ou ouvert : Image et Fichier les ouvrent.
  const fichiers = (
    <>
      <input ref={image} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Joindre une image" tabIndex={-1} className="sr-only" onChange={(e) => void choisir(e)} />
      <input ref={pdf} type="file" accept="application/pdf,.pdf" aria-label="Joindre un fichier" tabIndex={-1} className="sr-only" onChange={(e) => void choisir(e)} />
    </>
  );

  if (!ouvert) {
    return (
      <div className={`${CADRE} items-center gap-3 px-4 py-3.5 max-sm:gap-2.5 max-sm:px-3 max-sm:py-3`}>
        <Avatar initials={moi.initiales} src={moi.photoUrl} size={44} className="max-sm:size-10 max-sm:text-sm" />
        <button
          ref={invite}
          type="button"
          onClick={() => setOuvert(true)}
          className="focus-etudium h-12 min-w-0 flex-1 cursor-text truncate rounded-champ bg-page px-4 text-left text-[15px] text-indice transition-colors hover:bg-coque max-sm:h-10 max-sm:px-3.5 max-sm:text-sm"
        >
          {moi.prenom ? `Quoi de neuf, ${moi.prenom} ?` : "Quoi de neuf ?"}
        </button>
        {/* Sur téléphone, comme le design : l'avatar et « Quoi de neuf » seuls (Image, Vidéo et Fichier sont dans le champ ouvert). */}
        <span className="flex gap-0.5 max-sm:hidden">
          <IconButton icon={Image01Icon} label="Ajouter une image" variant="discret" onClick={() => image.current?.click()} />
          <IconButton
            icon={Video01Icon}
            label="Ajouter une vidéo"
            variant="discret"
            onClick={() => {
              setVideo("");
              setFocusTexte(false);
              setOuvert(true);
            }}
          />
          <IconButton icon={Attachment01Icon} label="Ajouter un fichier" variant="discret" onClick={() => pdf.current?.click()} />
        </span>
        {fichiers}
      </div>
    );
  }

  return (
    <div className={`${CADRE} flex-col px-5 pt-[18px] pb-4 max-sm:px-4`}>
      <div className="flex min-w-0 items-start gap-3">
        <Avatar initials={moi.initiales} src={moi.photoUrl} size={44} className="max-sm:hidden" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <TextInput
            aria-label="Titre (facultatif)"
            placeholder="Titre (facultatif)"
            value={titre}
            maxLength={TITRE_MAX}
            onChange={(e) => setTitre(e.target.value)}
            className="max-sm:h-11 max-sm:text-sm"
          />
          <EditeurTexte
            etiquette="Nouvelle publication"
            autoFocus={focusTexte}
            placeholder={`Partagez une question ou une réussite dans l’espace ${cible.nomCourt}…`}
            valeur={texte}
            onChange={setTexte}
          />
          {video !== null && <ChampVideo valeur={video} onChange={setVideo} desactive={envoi} />}
          {piece && (
            <div className="flex min-w-0 items-center gap-3 rounded-[14px] border border-bordure-carte px-3.5 py-2.5">
              <IconTile icon={piece.type === "application/pdf" ? Pdf01Icon : Image01Icon} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm leading-5 font-medium text-encre">{piece.fichier.name}</span>
                <span className="text-xs leading-[18px] text-discret">{tailleLisible(piece.fichier.size)}</span>
              </span>
              <IconButton icon={Cancel01Icon} label={`Retirer ${piece.fichier.name}`} variant="discret" size="sm" disabled={envoi} onClick={() => setPiece(null)} />
            </div>
          )}
          {erreur && (
            <p role="alert" className="m-0 text-sm leading-5 text-erreur-texte">
              {erreur}
            </p>
          )}
        </div>
      </div>
      {/* Toutes les publications paraissent dans Actualités ; l'espace dit à quel public elle s'adresse. */}
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:pl-14">
        <label htmlFor={idEspace} className="text-[13px] leading-5 font-medium text-discret">
          Publication dans
        </label>
        <div className="w-[220px] max-w-full">
          <Select
            id={idEspace}
            value={destination}
            disabled={envoi}
            onChange={(e) => setDestination(e.target.value)}
            options={choix.map((e) => ({ value: e.id ?? "general", label: e.id ? e.nomCourt : "Général" }))}
            className="h-10 text-sm"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:pl-14">
        <div className="-ml-3 flex flex-wrap items-center gap-1 sm:ml-0">
          <Button variant="discret" size="sm" iconLeft={Image01Icon} disabled={envoi} onClick={() => image.current?.click()}>
            Image
          </Button>
          <Button variant="discret" size="sm" iconLeft={Video01Icon} disabled={envoi} onClick={() => setVideo((v) => v ?? "")}>
            Vidéo
          </Button>
          <Button variant="discret" size="sm" iconLeft={Attachment01Icon} disabled={envoi} onClick={() => pdf.current?.click()}>
            Fichier
          </Button>
          {fichiers}
        </div>
        <span className="text-xs leading-[18px] text-discret">
          {analyseActive ? "Les publications sont vérifiées automatiquement." : "Soyez bienveillant : l’équipe Étudium veille aux échanges."}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button
          variant="contour"
          disabled={envoi}
          onClick={() => {
            rendreLeFocus.current = true;
            fermer();
          }}
        >
          Annuler
        </Button>
        <Button loading={envoi} onClick={() => void publier()}>
          Publier
        </Button>
      </div>
    </div>
  );
}

/** Le lien de la vidéo et son aperçu en direct ; une adresse qui n'en est pas une est signalée. */
function ChampVideo({ valeur, onChange, desactive }: { valeur: string; onChange: (valeur: string | null) => void; desactive: boolean }) {
  const reconnue = valeur.trim() ? reconnaitreVideo(valeur) : null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <TextInput
          aria-label="Lien de la vidéo"
          placeholder="https://www.youtube.com/watch?v=…"
          value={valeur}
          autoFocus
          inputMode="url"
          maxLength={1000}
          disabled={desactive}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 max-sm:h-11 max-sm:text-sm"
        />
        <IconButton icon={Cancel01Icon} label="Retirer la vidéo" variant="discret" disabled={desactive} onClick={() => onChange(null)} />
      </div>
      {reconnue ? (
        <VideoIntegree video={reconnue} lien={false} className="rounded-[14px]" />
      ) : (
        <p className={`m-0 text-[13px] leading-5 ${valeur.trim() ? "text-erreur-texte" : "text-discret"}`}>
          {valeur.trim()
            ? ADRESSE_VIDEO
            : "YouTube, Vimeo, TikTok, Facebook, Instagram, Dailymotion, Loom, Google Drive ou un fichier .mp4 ; un autre site s’affiche en carte."}
        </p>
      )}
    </div>
  );
}

