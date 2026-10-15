"use client";

import { useId, useState } from "react";
import { SentIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FileDrop } from "@/components/ui/FileDrop";
import { FileRow } from "@/components/ui/FileRow";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { tailleLisible } from "@/lib/admin/fichiers";
import { rendreExercice } from "@/lib/exercices/actions";
import { ACCEPT_RENDU, formatDeRendu, LIBELLE_FORMATS_RENDU, RENDU_MAX_OCTETS } from "@/lib/exercices/fichiers";
import { identifiantAleatoire } from "@/lib/identifiant";
import { createClient } from "@/lib/supabase/client";

const FORMAT_REFUSE = "Ce format n’est pas accepté : PDF, Word, Excel, PowerPoint, image ou ZIP.";
const TROP_LOURD = "Le fichier dépasse 20 Mo.";
const ENVOI_ECHEC = "Votre travail n’a pas pu être envoyé. Réessayez.";
const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";

type Choisi = { fichier: File; format: string };

/**
 * « Déposer votre travail » (NdExercice, NdExerciceEnvoi) : le fichier (contrôlé dans le navigateur : format et 20 Mo),
 * un message facultatif, puis « Envoyer votre travail ? ». Le fichier part directement dans le dossier du compte (espace
 * « rendus ») ; la base l'enregistre ensuite comme nouvelle version, ou il est retiré si elle refuse.
 */
export function DepotTravail({ leconId, nouvelleVersion, onEnvoye }: { leconId: string; nouvelleVersion: boolean; onEnvoye: () => void }) {
  const id = useId();
  const { toast } = useToast();
  const [choisi, setChoisi] = useState<Choisi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [confirmer, setConfirmer] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string>();

  async function choisir(fichiers: File[]) {
    const fichier = fichiers[0];
    if (!fichier) return;
    setChoisi(null);
    if (fichier.size > RENDU_MAX_OCTETS) return setErreur(TROP_LOURD);
    const octets = new Uint8Array(await fichier.slice(0, 16).arrayBuffer());
    const format = formatDeRendu(fichier.name, octets);
    if (!format) return setErreur(FORMAT_REFUSE);
    setErreur(null);
    setChoisi({ fichier, format });
  }

  /** Dépose le fichier, puis l'enregistre ; un refus garde la fenêtre ouverte avec son message. */
  async function envoyer() {
    if (!choisi) return;
    const echouer = (texte: string) => {
      setErreurEnvoi(texte);
      throw new Error(texte);
    };
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const compte = data?.user?.id;
    if (!compte) return echouer(SESSION_EXPIREE);
    const extension = choisi.fichier.name.split(".").pop()?.toLowerCase() ?? "bin";
    const chemin = `${compte}/${leconId}/${identifiantAleatoire()}.${extension}`;
    const stockage = supabase.storage.from("rendus");
    // Une copie typée : pour un fichier, la bibliothèque ignore contentType et garde le type du navigateur (un ZIP sous
    // Windows s'annonce « application/x-zip-compressed », que l'espace « rendus » refuse).
    const copie = choisi.fichier.slice(0, choisi.fichier.size, choisi.format);
    const { error } = await stockage.upload(chemin, copie, { contentType: choisi.format, upsert: false });
    if (error) return echouer(ENVOI_ECHEC);
    const reponse = await rendreExercice(leconId, chemin, choisi.fichier.name, message).catch(() => ({ ok: false as const, message: ENVOI_ECHEC }));
    if (!reponse.ok) {
      await stockage.remove([chemin]).catch(() => undefined);
      return echouer(reponse.message);
    }
    toast({ tone: "reussite", title: "Travail envoyé", description: "Votre formateur a été prévenu. Vous recevrez une notification dès la correction." });
    setChoisi(null);
    setMessage("");
    onEnvoye();
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FileDrop title={nouvelleVersion ? "Déposer une nouvelle version" : "Déposer votre travail"} accept={ACCEPT_RENDU} maxSizeLabel={LIBELLE_FORMATS_RENDU} onFiles={(f) => void choisir(f)} />
      {erreur && (
        <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
      {choisi && <FileRow name={choisi.fichier.name} meta={`${tailleLisible(choisi.fichier.size)} · prêt à être envoyé`} onRemove={() => setChoisi(null)} />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-message`} className="text-sm leading-5 font-medium text-encre">
          Message pour le formateur <span className="font-normal text-discret">(facultatif)</span>
        </label>
        <Textarea id={`${id}-message`} rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13px] leading-5 text-discret">Vous ne pourrez plus modifier votre fichier tant qu’il n’est pas corrigé.</p>
        <Button
          iconLeft={SentIcon}
          disabled={!choisi}
          onClick={() => {
            setErreurEnvoi(undefined);
            setConfirmer(true);
          }}
          className="max-sm:w-full"
        >
          Envoyer mon travail
        </Button>
      </div>
      <ConfirmDialog
        open={confirmer}
        onOpenChange={setConfirmer}
        title="Envoyer votre travail ?"
        description={`Votre formateur recevra « ${choisi?.fichier.name ?? ""} ». Vous ne pourrez plus le modifier tant qu’il n’est pas corrigé.`}
        confirmLabel="Envoyer"
        errorMessage={erreurEnvoi}
        onConfirm={envoyer}
      />
    </div>
  );
}
