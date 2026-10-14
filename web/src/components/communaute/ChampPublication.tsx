"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Attachment01Icon, Cancel01Icon, Image01Icon, Pdf01Icon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Textarea } from "@/components/ui/Textarea";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { formatDe, formatParMime } from "@/lib/admin/fichiers";
import { publierPublication } from "@/lib/communaute/actions";
import { REFUS_PIECE, refusPiece, refusPublication, tailleLisible, TEXTE_MAX, TITRE_MAX } from "@/lib/communaute/regles";
import type { Espace, MoiCommunaute, PieceEnvoyee, Publication } from "@/lib/communaute/types";
import { createClient } from "@/lib/supabase/client";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const ECHEC_ENVOI = "L’envoi du fichier n’a pas abouti. Réessayez.";

type Piece = { fichier: File; type: string; extension: string };

/** Un aperçu local du fichier publié, le temps que le fil soit relu ; absent hors navigateur. */
const apercu = (fichier: File) => (typeof URL.createObjectURL === "function" ? URL.createObjectURL(fichier) : null);

/**
 * Le champ de publication (design NdCommunaute ; spec, §3 et §4) : un titre facultatif (il paraît dès qu'on écrit), le
 * texte, une image ou un PDF. Le fichier part d'abord du navigateur vers le dossier du compte dans l'espace de stockage
 * « communaute », puis la publication est enregistrée ; si elle est refusée, le fichier est retiré.
 */
export function ChampPublication({
  espace,
  moi,
  analyseActive = false,
  onPubliee,
}: {
  espace: Espace;
  moi: MoiCommunaute;
  /** Migration 0020 : les publications sont analysées par l'IA. */
  analyseActive?: boolean;
  onPubliee: (publication: Publication) => void;
}) {
  const { toast } = useToast();
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [piece, setPiece] = useState<Piece | null>(null);
  const [deplie, setDeplie] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const image = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);

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
    if (refus || !type || !extension) {
      setErreur(refus ?? REFUS_PIECE);
      return;
    }
    setErreur(null);
    setPiece({ fichier, type, extension });
    setDeplie(true);
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
    const refus = refusPublication(titre, texte);
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
        resultat = await publierPublication(espace.id, titre.trim(), texte.trim(), envoyee);
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
        espace: { id: espace.id, nom: espace.id ? espace.nomCourt : "général" },
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
      });
      setTitre("");
      setTexte("");
      setPiece(null);
      setDeplie(false);
      toast(
        resultat.statut === "en_attente"
          ? { tone: "information", title: "Publication envoyée", description: "Elle paraîtra après vérification par l’équipe Étudium." }
          : { tone: "reussite", title: "Publication en ligne", description: "Elle apparaît en haut du fil." },
      );
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="box-border flex min-w-0 flex-col rounded-2xl border border-bordure-carte bg-panneau px-[19px] pt-[18px] pb-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar initials={moi.initiales} src={moi.photoUrl} size={44} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {deplie && (
            <TextInput aria-label="Titre (facultatif)" placeholder="Titre (facultatif)" value={titre} maxLength={TITRE_MAX} onChange={(e) => setTitre(e.target.value)} />
          )}
          <Textarea
            aria-label="Nouvelle publication"
            rows={2}
            placeholder={`Partagez une question ou une réussite dans l’espace ${espace.nomCourt}…`}
            value={texte}
            maxLength={TEXTE_MAX}
            onFocus={() => setDeplie(true)}
            onChange={(e) => setTexte(e.target.value)}
          />
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:pl-12">
        <div className="-ml-3 flex flex-wrap items-center gap-1 sm:ml-0">
          <Button variant="discret" size="sm" iconLeft={Image01Icon} disabled={envoi} onClick={() => image.current?.click()}>
            Image
          </Button>
          <Button variant="discret" size="sm" iconLeft={Attachment01Icon} disabled={envoi} onClick={() => pdf.current?.click()}>
            Fichier
          </Button>
          <input
            ref={image}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Joindre une image"
            tabIndex={-1}
            className="sr-only"
            onChange={(e) => void choisir(e)}
          />
          <input ref={pdf} type="file" accept="application/pdf,.pdf" aria-label="Joindre un fichier" tabIndex={-1} className="sr-only" onChange={(e) => void choisir(e)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs leading-[18px] text-discret">
            {analyseActive ? "Les publications sont vérifiées automatiquement." : "Soyez bienveillant : l’équipe Étudium veille aux échanges."}
          </span>
          <Button loading={envoi} onClick={() => void publier()}>
            Publier
          </Button>
        </div>
      </div>
    </div>
  );
}
