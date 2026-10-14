"use client";

import { useState } from "react";
import Link from "next/link";
import { Delete02Icon, Image01Icon, Pdf01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { moment, nomEspace } from "@/lib/communaute/regles";
import { LIBELLES_MOTIFS, libelleCategorie } from "@/lib/moderation/regles";
import type { ElementFile, OngletFile } from "@/lib/moderation/types";

const LIEN = "focus-etudium text-sm leading-[22px] font-medium text-bleu no-underline hover:underline";

/** Pourquoi le contenu est dans la file : l'analyse, l'attente, les signalements comptés et leur détail. */
function raisons(e: ElementFile): { texte: string; detail?: boolean }[] {
  const lignes: { texte: string; detail?: boolean }[] = [];
  if (e.analyse?.decision === "echec") lignes.push({ texte: e.analyse.raison || "Analyse impossible." });
  else if (e.analyse && e.analyse.decision !== "autoriser") {
    lignes.push({ texte: `Analyse automatique : ${libelleCategorie(e.analyse.categorie)}${e.analyse.raison ? ` — ${e.analyse.raison}` : ""}` });
  } else if (e.statut === "en_attente") lignes.push({ texte: "En attente : non analysée" });
  const n = e.signalements.nombre;
  if (n > 0) {
    const motifs = e.signalements.motifs.map((m) => `${LIBELLES_MOTIFS[m.motif]} (${m.nombre})`).join(", ");
    lignes.push({ texte: `Signalée par ${n} membre${n > 1 ? "s" : ""}${motifs ? ` : ${motifs}` : ""}` });
    for (const d of e.signalements.details) {
      lignes.push({ texte: `${d.par} · ${LIBELLES_MOTIFS[d.motif]}${d.precisions ? ` : ${d.precisions}` : ""}`, detail: true });
    }
  }
  return lignes;
}

/**
 * Un contenu de la file (spec de la modération, §5) : son auteur (vers sa fiche, pour le suspendre au besoin), son
 * espace, le texte entier, le fichier, les raisons ; Garder, Supprimer (confirmé) ou Rétablir (onglet « Bloquées »).
 */
export function ElementModeration({
  element: e,
  onglet,
  maintenant,
  onAgir,
}: {
  element: ElementFile;
  onglet: OngletFile;
  maintenant: Date;
  /** Rend le message d'erreur, ou null quand l'action a réussi. */
  onAgir: (action: "garder" | "supprimer" | "retablir") => Promise<string | null>;
}) {
  const [occupe, setOccupe] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string>();
  const nom = `${e.auteur.prenom} ${e.auteur.nom}`.trim() || "Membre d’Étudium";
  const reponse = e.type === "reponse";

  async function agir(action: "garder" | "retablir") {
    setOccupe(true);
    await onAgir(action);
    setOccupe(false);
  }

  async function supprimer() {
    const erreur = await onAgir("supprimer");
    if (erreur) {
      setErreurSuppression(erreur);
      throw new Error(erreur);
    }
  }

  return (
    <article aria-label={`${reponse ? "Réponse" : "Publication"} de ${nom}`} className="box-border flex min-w-0 flex-col gap-3 rounded-2xl border border-bordure-carte bg-panneau px-5 py-[18px]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <Tag tone="verrouillee">{reponse ? "Réponse" : "Publication"}</Tag>
        <Link href={`/admin/utilisateurs/${e.auteur.id}`} className="focus-etudium min-w-0 text-[15px] leading-[22px] font-semibold wrap-anywhere text-encre no-underline hover:underline">
          {nom}
        </Link>
        <span className="text-[13px] leading-5 text-discret">{`${nomEspace(e.espace)} · ${moment(e.creeLe, maintenant)}`}</span>
      </div>
      {e.extrait && <p className="m-0 text-[13px] leading-5 wrap-anywhere text-discret">{`En réponse à « ${e.extrait} »`}</p>}
      <div className="flex min-w-0 flex-col gap-1.5">
        {e.titre && <h3 className="m-0 text-base leading-6 font-semibold wrap-anywhere text-encre">{e.titre}</h3>}
        <p className="m-0 text-sm leading-[22px] whitespace-pre-line text-pretty wrap-anywhere text-texte">{e.texte}</p>
      </div>
      {e.pieceJointe && (
        <div className="flex min-w-0 items-center gap-2 text-sm leading-[22px]">
          <Icon icon={e.pieceJointe.type === "application/pdf" ? Pdf01Icon : Image01Icon} size={18} className="flex-none text-discret" />
          {e.pieceJointe.url ? (
            <a href={e.pieceJointe.url} target="_blank" rel="noopener noreferrer" className={`${LIEN} min-w-0 truncate`}>
              {e.pieceJointe.nom}
            </a>
          ) : (
            <span className="min-w-0 truncate text-discret">{e.pieceJointe.nom}</span>
          )}
        </div>
      )}
      <ul className="m-0 flex list-none flex-col gap-1 rounded-[14px] bg-attention-fond p-3.5 text-[13px] leading-5 text-attention-texte">
        {raisons(e).map((r, i) => (
          <li key={i} className={r.detail ? "pl-3 wrap-anywhere" : "font-medium wrap-anywhere"}>
            {r.texte}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        {onglet === "a_examiner" ? (
          <Button size="sm" loading={occupe} onClick={() => void agir("garder")}>
            Garder
          </Button>
        ) : (
          <Button size="sm" loading={occupe} onClick={() => void agir("retablir")}>
            Rétablir
          </Button>
        )}
        <Button
          variant="dangerDoux"
          size="sm"
          iconLeft={Delete02Icon}
          disabled={occupe}
          onClick={() => {
            setErreurSuppression(undefined);
            setSuppression(true);
          }}
        >
          Supprimer
        </Button>
        <Link href={`/communaute/publications/${e.publicationId}`} className={`${LIEN} ml-1`}>
          Ouvrir la publication
        </Link>
      </div>
      <ConfirmDialog
        open={suppression}
        onOpenChange={setSuppression}
        tone="danger"
        icon={Delete02Icon}
        title="Supprimer ce contenu ?"
        description="Il disparaîtra de la communauté et son auteur sera prévenu."
        confirmLabel="Supprimer"
        errorMessage={erreurSuppression}
        onConfirm={supprimer}
      />
    </article>
  );
}
