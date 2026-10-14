"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import {
  Attachment01Icon,
  Cancel01Icon,
  CheckmarkSquare02Icon,
  Image01Icon,
  ImageCompositionIcon,
  LeftToRightListBulletIcon,
  Pdf01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { formatDe, formatParMime } from "@/lib/admin/fichiers";
import { publierPublication } from "@/lib/communaute/actions";
import { REFUS_PIECE, refusPiece, refusPublication, tailleLisible, TITRE_MAX } from "@/lib/communaute/regles";
import { refusSondage, type SondageEnvoye, type TypeSondage } from "@/lib/communaute/sondage";
import type { Espace, MoiCommunaute, PieceEnvoyee, Publication } from "@/lib/communaute/types";
import { reconnaitreVideo } from "@/lib/communaute/video";
import { phraseSession } from "@/lib/sessions/regles";
import { createClient } from "@/lib/supabase/client";
import { BoutonPublier } from "./BoutonPublier";
import { ChampSondage, sondageRempli, sondageVide, type EtatSondage } from "./ChampSondage";
import { VideoIntegree } from "./VideoIntegree";
import { identifiantAleatoire } from "@/lib/identifiant";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const ECHEC_ENVOI = "L’envoi du fichier n’a pas abouti. Réessayez.";
const CADRE = "box-border flex min-w-0 rounded-2xl border border-bordure-carte bg-panneau";
const ADRESSE_VIDEO = "Collez l’adresse complète de la vidéo (https://…).";
// La rangée d'options, dans l'ordre de la capture.
const AJOUTS: [Ajout, string, typeof Image01Icon][] = [
  ["image", "Image", Image01Icon],
  ["images", "Sondage avec images", ImageCompositionIcon],
  ["texte", "Sondage avec texte", LeftToRightListBulletIcon],
  ["quiz", "Quiz", CheckmarkSquare02Icon],
  ["video", "Vidéo", Video01Icon],
  ["fichier", "Fichier", Attachment01Icon],
];

// L'éditeur visuel (Tiptap) n'est chargé qu'à l'ouverture du champ : le fil reste léger.
const EditeurTexte = dynamic(() => import("./EditeurTexte").then((m) => m.EditeurTexte), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[150px] animate-pulse rounded-champ border border-bordure-champ bg-page" />,
});


type Piece = { fichier: File; type: string; extension: string };
/** Un seul ajout par publication (spec sondages, quiz et programmation, §1). */
type Ajout = "image" | "fichier" | "video" | TypeSondage;
const NOMS_AJOUT: Record<Ajout, string> = { image: "l’image", fichier: "le fichier", video: "la vidéo", texte: "le sondage", images: "le sondage", quiz: "le quiz" };

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
  onProgrammee,
}: {
  /** L'espace proposé d'abord : celui de l'onglet (le général pour Actualités). */
  espace: Espace;
  /** Les espaces ouverts au compte, pour « Publication dans » ; vide : l'espace proposé seul. */
  espaces?: Espace[];
  moi: MoiCommunaute;
  /** Migration 0020 : les publications sont analysées par l'IA. */
  analyseActive?: boolean;
  /** Rend vrai si la publication entre dans le fil affiché (sinon, le message dit dans quel espace la trouver). */
  onPubliee: (publication: Publication) => boolean;
  /** Une publication programmée : l'onglet « Programmées », s'il est ouvert, se relit. */
  onProgrammee?: () => void;
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
  // Le sondage ou le quiz en cours ; l'heure de parution d'une publication programmée (ISO).
  const [sondage, setSondage] = useState<EtatSondage | null>(null);
  const [publieLe, setPublieLe] = useState<string | null>(null);
  // Un ajout rempli que l'on remplace : confirmé d'abord.
  const [remplacement, setRemplacement] = useState<{ actuel: Ajout; suite: () => void } | null>(null);
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
    setSondage(null);
    setPublieLe(null);
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
    setSondage(null);
    setVideo(null);
    setPiece({ fichier, type, extension });
  }

  /** L'ajout en cours (un seul par publication), et s'il est rempli. */
  const actuel: Ajout | null = piece ? (piece.type === "application/pdf" ? "fichier" : "image") : video !== null ? "video" : sondage ? sondage.type : null;
  const actuelRempli = piece !== null || (video ?? "").trim() !== "" || (sondage !== null && sondageRempli(sondage));

  /** Choisir un ajout : un autre ajout rempli est remplacé après confirmation. */
  function ajouter(cible: Ajout) {
    const suite = () => {
      if (cible === "image") return image.current?.click();
      if (cible === "fichier") return pdf.current?.click();
      setPiece(null);
      if (cible === "video") {
        setSondage(null);
        setVideo((v) => v ?? "");
        return;
      }
      setVideo(null);
      setSondage((s) => (s?.type === cible ? s : sondageVide(cible)));
    };
    if (actuel && actuel !== cible && actuelRempli) setRemplacement({ actuel, suite });
    else suite();
  }

  /** Le sondage tel que le serveur l'attend ; les images, déjà déposées. */
  function sondageEnvoye(s: EtatSondage, images: (PieceEnvoyee | null)[]): SondageEnvoye {
    return {
      type: s.type,
      choixMultiples: s.type !== "quiz" && s.choixMultiples,
      dureeJours: s.type === "quiz" || !s.duree ? null : (Number(s.duree) as 1 | 3 | 7 | 14),
      explication: s.type === "quiz" ? s.explication.trim() : "",
      options: s.options.map((o, i) =>
        s.type === "images" ? { texte: o.texte.trim(), image: images[i] } : s.type === "quiz" ? { texte: o.texte.trim(), correcte: o.correcte === true } : { texte: o.texte.trim() },
      ),
    };
  }

  /** Dépose le fichier dans le dossier du compte ; null si l'envoi échoue. */
  async function deposer(p: Piece): Promise<PieceEnvoyee | null> {
    const chemin = `${moi.compteId}/${identifiantAleatoire()}.${p.extension}`;
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
    // Avant le dépôt, une image choisie tient lieu d'image déposée pour vérifier le sondage.
    const essai = sondage ? sondageEnvoye(sondage, sondage.options.map((o) => (o.fichier ? { chemin: "", nom: o.fichier.name, type: o.type ?? "", taille: o.fichier.size } : null))) : null;
    const refus =
      refusPublication(titre, texte) ?? (video?.trim() && !reconnaitreVideo(video) ? ADRESSE_VIDEO : null) ?? (essai ? refusSondage(essai) : null);
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
      // Les images d'un sondage : déposées une à une ; un échec retire celles déjà déposées.
      const images: (PieceEnvoyee | null)[] = [];
      for (const o of sondage?.type === "images" ? sondage.options : []) {
        const extension = o.type ? formatParMime(o.type)?.extensions[0] : undefined;
        const deposee = o.fichier && o.type && extension ? await deposer({ fichier: o.fichier, type: o.type, extension }) : null;
        if (!deposee) {
          const deja = images.flatMap((i) => (i ? [i.chemin] : []));
          if (deja.length > 0) await createClient().storage.from("communaute").remove(deja).catch(() => undefined);
          setErreur(ECHEC_ENVOI);
          return;
        }
        images.push(deposee);
      }
      const envoyeSondage = sondage ? sondageEnvoye(sondage, images) : null;
      const deposes = [...(envoyee ? [envoyee.chemin] : []), ...images.flatMap((i) => (i ? [i.chemin] : []))];
      let resultat: Awaited<ReturnType<typeof publierPublication>>;
      try {
        // Sans sondage ni programmation, l'appel d'avant la 0026.
        resultat =
          envoyeSondage || publieLe
            ? await publierPublication(cible.id, titre.trim(), texte.trim(), envoyee, video?.trim() || null, { sondage: envoyeSondage, publieLe })
            : await publierPublication(cible.id, titre.trim(), texte.trim(), envoyee, video?.trim() || null);
      } catch {
        // L'action n'a pas répondu : les fichiers ne restent pas sans publication.
        if (deposes.length > 0) await createClient().storage.from("communaute").remove(deposes).catch(() => undefined);
        resultat = { ok: false, message: ECHEC };
      }
      if (!resultat.ok) {
        setErreur(resultat.message);
        return;
      }
      // Programmée : pas encore dans le fil ; elle attend dans l'onglet « Programmées ».
      if (publieLe) {
        fermer();
        toast({ tone: "reussite", title: "Publication programmée", description: `Elle paraîtra le ${phraseSession(publieLe)}. Retrouvez-la dans l’onglet « Programmées ».` });
        onProgrammee?.();
        return;
      }
      const dansLeFil = onPubliee({
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
        ...("sondage" in resultat && resultat.sondage ? { sondage: resultat.sondage } : {}),
      });
      fermer();
      toast(
        resultat.statut === "en_attente"
          ? { tone: "information", title: "Publication envoyée", description: "Elle paraîtra après vérification par l’équipe Étudium." }
          : {
              tone: "reussite",
              title: "Publication en ligne",
              description: dansLeFil ? "Elle apparaît en haut du fil." : `Elle apparaît dans l’espace ${cible.id ? cible.nomCourt : "Général"}.`,
            },
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
          {sondage && <ChampSondage etat={sondage} onChange={setSondage} onRetirer={() => setSondage(null)} onErreur={setErreur} desactive={envoi} />}
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
        {/* Un seul ajout par publication : en choisir un autre remplace le premier (après confirmation s'il est rempli). */}
        <div role="group" aria-label="Ajouter à la publication" className="-ml-3 flex flex-wrap items-center gap-1 sm:ml-0">
          {AJOUTS.map(([cle, libelle, icone]) => (
            <Button key={cle} variant="discret" size="sm" iconLeft={icone} disabled={envoi} className="max-sm:px-2" onClick={() => ajouter(cle)}>
              {libelle}
            </Button>
          ))}
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
        <BoutonPublier envoi={envoi} publieLe={publieLe} onPublier={() => void publier()} onProgrammer={setPublieLe} />
      </div>
      <ConfirmDialog
        open={remplacement !== null}
        onOpenChange={(ouverte) => !ouverte && setRemplacement(null)}
        title={remplacement ? `Remplacer ${NOMS_AJOUT[remplacement.actuel]} ?` : ""}
        description="Une publication porte un seul ajout : une image, un fichier, une vidéo, un sondage ou un quiz."
        confirmLabel="Remplacer"
        onConfirm={() => {
          const suite = remplacement?.suite;
          setRemplacement(null);
          suite?.();
        }}
      />
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

